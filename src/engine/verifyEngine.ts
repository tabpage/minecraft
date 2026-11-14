/**
 * Automated Verification Suite for TERRAVEX Core Engine Systems.
 * Run with: node --experimental-strip-types src/engine/verifyEngine.ts
 */

import {
  BLOCK,
  canHarvestBlock,
  computeAttackDamage,
  computeMiningTime,
  createItemStack,
  ITEM,
} from './blocks.ts';
import { SeededNoise } from './noise.ts';
import { raycastVoxels, stepPhysics } from './physics.ts';
import {
  CRAFTING_RECIPES,
  findSmeltRecipe,
  getRecipeIngredients,
  matchCraftingGrid,
  SMELT_RECIPES,
  TRADER_OFFERS,
} from './recipes.ts';
import { ITEM_REGISTRY } from './blocks.ts';
import { createNewWorldSave } from './saveSystem.ts';
import { CHUNK_HEIGHT, CHUNK_SIZE, localIndex, WorldGenerator } from './worldGen.ts';

function assert(cond: boolean, msg: string) {
  if (!cond) {
    throw new Error(`ASSERTION FAILED: ${msg}`);
  }
}

export function runEngineVerification(): { passed: number; summary: string[] } {
  const summary: string[] = [];
  let passed = 0;

  const test = (name: string, fn: () => void) => {
    fn();
    passed++;
    summary.push(`PASS: ${name}`);
  };

  // 1. Deterministic Seeded Noise
  test('Deterministic seeded noise produces identical output for same seed', () => {
    const n1 = new SeededNoise('TERRAVEX-SEED-42');
    const n2 = new SeededNoise('TERRAVEX-SEED-42');
    const n3 = new SeededNoise('DIFFERENT-SEED-99');
    assert(n1.fbm2D(12.5, -8.3) === n2.fbm2D(12.5, -8.3), 'Same seed mismatch');
    assert(n1.noise3D(4.2, 10.1, -3.7) === n2.noise3D(4.2, 10.1, -3.7), '3D noise mismatch');
    assert(n1.fbm2D(12.5, -8.3) !== n3.fbm2D(12.5, -8.3), 'Different seeds collided');
  });

  // 2. Deterministic World Generation, Biomes, Ores & Landmarks
  test('WorldGenerator deterministically generates chunks, multiple biomes, ores, and starter outpost', () => {
    const g1 = new WorldGenerator('EMERALD-VALLEY-2026');
    const g2 = new WorldGenerator('EMERALD-VALLEY-2026');
    const c1 = g1.generateChunkData(0, 0);
    const c2 = g2.generateChunkData(0, 0);
    assert(c1.length === CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE, 'Chunk array size incorrect');
    for (let i = 0; i < c1.length; i++) {
      assert(c1[i] === c2[i], `Chunk determinism broke at index ${i}`);
    }

    // Verify bedrock floor & safe spawn above water
    assert(c1[localIndex(0, 0, 0)] === BLOCK.BEDROCK, 'Y=0 must be bedrock');
    const spawnH = g1.getTerrainHeight(0, 0).height;
    assert(spawnH >= 24, `Spawn height too low (${spawnH})`);

    // Verify multiple biomes exist across world coordinates
    const seenBiomes = new Set<string>();
    for (let x = -400; x <= 400; x += 40) {
      for (let z = -400; z <= 400; z += 40) {
        seenBiomes.add(g1.getBiome(x, z));
      }
    }
    assert(seenBiomes.size >= 4, `Expected >=4 biomes, saw ${Array.from(seenBiomes).join(',')}`);

    // Verify Starter Outpost in chunk (1,1) includes Crafting Table, Furnace & Chest
    const outpostChunk = g1.generateChunkData(1, 1);
    let hasTable = false;
    let hasFurnace = false;
    let hasChest = false;
    for (let i = 0; i < outpostChunk.length; i++) {
      if (outpostChunk[i] === BLOCK.CRAFTING_TABLE) hasTable = true;
      if (outpostChunk[i] === BLOCK.FURNACE) hasFurnace = true;
      if (outpostChunk[i] === BLOCK.CHEST) hasChest = true;
    }
    assert(hasTable && hasFurnace && hasChest, 'Starter outpost missing functional stations');

    // Verify Obsidian Shrine in chunk (-2, 2) includes Enchanting Altar
    const shrineChunk = g1.generateChunkData(-2, 2);
    let hasAltar = false;
    for (let i = 0; i < shrineChunk.length; i++) {
      if (shrineChunk[i] === BLOCK.ENCHANT_ALTAR) hasAltar = true;
    }
    assert(hasAltar, 'Ancient Shrine missing Arcane Enchanting Altar');
  });

  // 3. Physics, AABB Collision, Ledge-Guard Sneak & 3D DDA Raycast
  test('AABB collision stops falling on solid floor and sneak prevents stepping off ledge', () => {
    // Single platform block at (0, 5, 0)
    const getBlock = (x: number, y: number, z: number) =>
      x === 0 && y === 5 && z === 0 ? BLOCK.STONE : BLOCK.AIR;

    // Falling onto (0, 5, 0) top (y=6)
    const fall = stepPhysics(
      { x: 0.5, y: 6.05, z: 0.5, halfW: 0.3, height: 1.75 },
      0,
      -5,
      0,
      0.05,
      getBlock
    );
    assert(fall.onGround, 'Player should land on top of solid block');
    assert(fall.y >= 6.0 && fall.y <= 6.01, `Unexpected landing y=${fall.y}`);

    // Sneak edge protection should prevent moving off block into void
    const sneak = stepPhysics(
      { x: 0.85, y: 6.001, z: 0.5, halfW: 0.3, height: 1.75 },
      10,
      0,
      0,
      0.05,
      getBlock,
      true
    );
    assert(sneak.x === 0.85, `Sneak allowed walking off ledge (x=${sneak.x})`);
  });

  test('3D DDA Voxel Raycast hits exact voxel and returns outward face normal', () => {
    const getBlock = (x: number, y: number, z: number) =>
      x === 3 && y === 10 && z === 0 ? BLOCK.COBBLESTONE : BLOCK.AIR;

    const hit = raycastVoxels(0.5, 10.5, 0.5, 1, 0, 0, 6, getBlock);
    assert(hit !== null, 'Raycast missed solid block');
    assert(hit!.x === 3 && hit!.y === 10 && hit!.z === 0, 'Wrong hit coordinates');
    assert(hit!.nx === -1 && hit!.ny === 0 && hit!.nz === 0, 'Wrong face normal');
    assert(hit!.blockId === BLOCK.COBBLESTONE, 'Wrong hit blockId');
  });

  // 4. Crafting Grid & Smelting Recipes
  test('2x2 and 3x3 Crafting Grid matches shaped & shapeless recipes accurately', () => {
    // 2x2 Crafting Table (4 planks)
    const grid2x2 = [
      createItemStack(BLOCK.PLANKS, 1),
      createItemStack(BLOCK.PLANKS, 1),
      createItemStack(BLOCK.PLANKS, 1),
      createItemStack(BLOCK.PLANKS, 1),
    ];
    const tableMatch = matchCraftingGrid(grid2x2, 2);
    assert(tableMatch?.result.itemId === BLOCK.CRAFTING_TABLE, '2x2 Workbench recipe failed');

    // 3x3 Iron Pickaxe
    const grid3x3 = [
      createItemStack(ITEM.IRON_INGOT, 1),
      createItemStack(ITEM.IRON_INGOT, 1),
      createItemStack(ITEM.IRON_INGOT, 1),
      null,
      createItemStack(ITEM.STICK, 1),
      null,
      null,
      createItemStack(ITEM.STICK, 1),
      null,
    ];
    const pickMatch = matchCraftingGrid(grid3x3, 3);
    assert(pickMatch?.result.itemId === ITEM.IRON_PICKAXE, '3x3 Iron Pickaxe recipe failed');

    // Smelting Raw Iron -> Iron Ingot
    const smeltIron = findSmeltRecipe(ITEM.RAW_IRON);
    assert(smeltIron?.outputId === ITEM.IRON_INGOT, 'Raw iron smelt recipe missing');
  });

  // 5. Mining Speed, Tool Tiers & Enchantments
  test('Tool harvest tiers, Efficiency mining speed, and Sharpness damage scale properly', () => {
    const bareHand = null;
    const woodPick = createItemStack(ITEM.WOOD_PICKAXE, 1);
    const ironPick = createItemStack(ITEM.IRON_PICKAXE, 1);
    const enchantedIronPick = {
      ...createItemStack(ITEM.IRON_PICKAXE, 1),
      enchantments: [{ type: 'efficiency' as const, level: 2 }],
    };

    assert(!canHarvestBlock(BLOCK.CRYSTAL_ORE, woodPick), 'Wood pick should not harvest Crystal Ore');
    assert(canHarvestBlock(BLOCK.CRYSTAL_ORE, ironPick), 'Iron pick should harvest Crystal Ore');

    const tHand = computeMiningTime(BLOCK.STONE, bareHand);
    const tIron = computeMiningTime(BLOCK.STONE, ironPick);
    const tEnch = computeMiningTime(BLOCK.STONE, enchantedIronPick);
    assert(tIron < tHand && tEnch < tIron, 'Mining times did not decrease with better/enchanted tool');

    const baseSword = createItemStack(ITEM.IRON_SWORD, 1);
    const sharpSword = {
      ...createItemStack(ITEM.IRON_SWORD, 1),
      enchantments: [{ type: 'sharpness' as const, level: 2 }],
    };
    assert(
      computeAttackDamage(sharpSword) === computeAttackDamage(baseSword) + 4,
      'Sharpness II should grant +4 attack damage'
    );
  });

  // 6. Save Schema Construction for all 4 Game Modes
  test('Save constructors initialize valid state for Survival, Creative, Adventure, and Spectator', () => {
    for (const mode of ['survival', 'creative', 'adventure', 'spectator'] as const) {
      const save = createNewWorldSave(`Test ${mode}`, 'SEED123', mode);
      assert(save.meta.gameMode === mode, 'Mode mismatch');
      assert(save.player.inventory.length === 36, 'Inventory must be 36 slots');
      assert(save.objectives.length === 5, 'Expected 5 Adventure objectives');
    }
  });

  // 7. Ore & Cave Generation across underground strata
  test('All 5 underground ore tiers (Coal, Iron, Gold, Crystal, Sparkstone) generate naturally', () => {
    const gen = new WorldGenerator('ORE-AUDIT-2026');
    const counts = {
      coal: 0,
      iron: 0,
      gold: 0,
      crystal: 0,
      sparkstone: 0,
      water: 0,
    };
    for (let cx = -2; cx <= 2; cx++) {
      for (let cz = -2; cz <= 2; cz++) {
        const data = gen.generateChunkData(cx, cz);
        for (let i = 0; i < data.length; i++) {
          const b = data[i];
          if (b === BLOCK.COAL_ORE) counts.coal++;
          else if (b === BLOCK.IRON_ORE) counts.iron++;
          else if (b === BLOCK.GOLD_ORE) counts.gold++;
          else if (b === BLOCK.CRYSTAL_ORE) counts.crystal++;
          else if (b === BLOCK.SPARKSTONE_ORE) counts.sparkstone++;
          else if (b === BLOCK.WATER) counts.water++;
        }
      }
    }
    assert(counts.coal > 20, `Too little coal (${counts.coal})`);
    assert(counts.iron > 15, `Too little iron (${counts.iron})`);
    assert(counts.gold > 5, `Too little gold (${counts.gold})`);
    assert(counts.crystal > 2, `Too little crystal (${counts.crystal})`);
    assert(counts.sparkstone > 4, `Too little sparkstone (${counts.sparkstone})`);
  });

  // 8. Registry Referential Integrity for Crafting, Smelting & Trading
  test('All crafting recipes, smelting recipes, and villager trades reference valid registered items', () => {
    for (const r of CRAFTING_RECIPES) {
      assert(ITEM_REGISTRY.has(r.result.itemId), `Invalid recipe result ${r.id}`);
      const ings = getRecipeIngredients(r);
      assert(ings.length > 0, `Recipe ${r.id} has no ingredients`);
      for (const ing of ings) {
        assert(ITEM_REGISTRY.has(ing.itemId), `Invalid ingredient ${ing.itemId} in ${r.id}`);
      }
    }
    for (const s of SMELT_RECIPES) {
      assert(ITEM_REGISTRY.has(s.inputId) && ITEM_REGISTRY.has(s.outputId), 'Invalid smelt recipe');
    }
    for (const t of TRADER_OFFERS) {
      assert(ITEM_REGISTRY.has(t.costItemId) && ITEM_REGISTRY.has(t.rewardItemId), `Invalid trade ${t.id}`);
    }
  });

  // 9. Water Submersion Detection & Noclip Spectator Physics
  test('Physics detects water submersion and Spectator noclip passes through solid terrain', () => {
    const waterWorld = (_x: number, y: number, _z: number) => (y <= 10 ? BLOCK.WATER : BLOCK.AIR);
    const swim = stepPhysics(
      { x: 0.5, y: 8.5, z: 0.5, halfW: 0.3, height: 1.75 },
      0,
      0,
      0,
      0.05,
      waterWorld
    );
    assert(swim.inWater && swim.headInWater, 'Water submersion not detected');

    const solidWorld = () => BLOCK.STONE;
    const spec = stepPhysics(
      { x: 0, y: 10, z: 0, halfW: 0.3, height: 1.75 },
      10,
      0,
      0,
      0.1,
      solidWorld,
      false,
      true
    );
    assert(Math.abs(spec.x - 1.0) < 0.001, 'Spectator noclip failed to pass through solid blocks');
  });

  return { passed, summary };
}

// Direct CLI execution support
if (typeof process !== 'undefined' && process.argv?.[1]?.includes('verifyEngine')) {
  const result = runEngineVerification();
  for (const line of result.summary) {
    console.log(line);
  }
  console.log(`\nALL ${result.passed} ENGINE VERIFICATION TESTS PASSED.`);
}
