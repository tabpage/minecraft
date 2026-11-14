import { BLOCK, ITEM } from './blocks';
import { CraftingRecipe, ItemStack, SmeltRecipe, TradeOffer } from './types';

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  // === BASICS (2x2 compatible) ===
  {
    id: 'planks_oak',
    name: 'Hewn Planks (Oak)',
    result: { itemId: BLOCK.PLANKS, count: 4 },
    shapeless: [{ itemId: BLOCK.OAK_LOG, count: 1 }],
    requiresTable: false,
    category: 'basics',
  },
  {
    id: 'planks_birch',
    name: 'Hewn Planks (Birch)',
    result: { itemId: BLOCK.PLANKS, count: 4 },
    shapeless: [{ itemId: BLOCK.BIRCH_LOG, count: 1 }],
    requiresTable: false,
    category: 'basics',
  },
  {
    id: 'planks_pine',
    name: 'Hewn Planks (Pine)',
    result: { itemId: BLOCK.PLANKS, count: 4 },
    shapeless: [{ itemId: BLOCK.PINE_LOG, count: 1 }],
    requiresTable: false,
    category: 'basics',
  },
  {
    id: 'sticks',
    name: 'Wood Sticks',
    result: { itemId: ITEM.STICK, count: 4 },
    pattern: ['P', 'P'],
    key: { P: BLOCK.PLANKS },
    requiresTable: false,
    category: 'basics',
  },
  {
    id: 'crafting_table',
    name: 'Artisan Workbench',
    result: { itemId: BLOCK.CRAFTING_TABLE, count: 1 },
    pattern: ['PP', 'PP'],
    key: { P: BLOCK.PLANKS },
    requiresTable: false,
    category: 'basics',
  },
  {
    id: 'torches',
    name: 'Blaze Torches',
    result: { itemId: BLOCK.TORCH, count: 4 },
    pattern: ['C', 'S'],
    key: { C: ITEM.COAL, S: ITEM.STICK },
    requiresTable: false,
    category: 'basics',
  },
  {
    id: 'sandstone',
    name: 'Carved Sandstone',
    result: { itemId: BLOCK.SANDSTONE, count: 2 },
    pattern: ['SS', 'SS'],
    key: { S: BLOCK.SAND },
    requiresTable: false,
    category: 'building',
  },
  {
    id: 'spark_lever',
    name: 'Sparkstone Lever',
    result: { itemId: BLOCK.SPARK_LEVER, count: 1 },
    pattern: ['S', 'C'],
    key: { S: ITEM.STICK, C: BLOCK.COBBLESTONE },
    requiresTable: false,
    category: 'redstone',
  },

  // === STATIONS & BUILDING (3x3 Workbench) ===
  {
    id: 'furnace',
    name: 'Stone Furnace',
    result: { itemId: BLOCK.FURNACE, count: 1 },
    pattern: ['CCC', 'C C', 'CCC'],
    key: { C: BLOCK.COBBLESTONE },
    requiresTable: true,
    category: 'building',
  },
  {
    id: 'chest',
    name: 'Storage Chest',
    result: { itemId: BLOCK.CHEST, count: 1 },
    pattern: ['PPP', 'P P', 'PPP'],
    key: { P: BLOCK.PLANKS },
    requiresTable: true,
    category: 'building',
  },
  {
    id: 'spark_lamp',
    name: 'Sparkstone Lamp',
    result: { itemId: BLOCK.SPARK_LAMP, count: 1 },
    pattern: [' R ', 'RGR', ' R '],
    key: { R: ITEM.SPARK_DUST, G: BLOCK.GLASS },
    requiresTable: true,
    category: 'redstone',
  },
  {
    id: 'enchant_altar',
    name: 'Arcane Enchanting Altar',
    result: { itemId: BLOCK.ENCHANT_ALTAR, count: 1 },
    pattern: [' C ', 'OCO', 'OOO'],
    key: { C: ITEM.CRYSTAL_GEM, O: BLOCK.OBSIDIAN },
    requiresTable: true,
    category: 'advanced',
  },
  {
    id: 'summon_totem',
    name: 'Warden Summon Totem',
    result: { itemId: ITEM.SUMMON_TOTEM, count: 1 },
    pattern: [' G ', 'OCO', ' G '],
    key: { G: ITEM.GOLD_INGOT, O: BLOCK.OBSIDIAN, C: ITEM.CRYSTAL_GEM },
    requiresTable: true,
    category: 'advanced',
  },
  {
    id: 'bread',
    name: 'Artisan Bread',
    result: { itemId: ITEM.BREAD, count: 1 },
    pattern: ['WWW'],
    key: { W: ITEM.WHEAT },
    requiresTable: true,
    category: 'food',
  },

  // === PICKAXES ===
  {
    id: 'wood_pickaxe',
    name: 'Timber Pickaxe',
    result: { itemId: ITEM.WOOD_PICKAXE, count: 1 },
    pattern: ['PPP', ' S ', ' S '],
    key: { P: BLOCK.PLANKS, S: ITEM.STICK },
    requiresTable: true,
    category: 'tools',
  },
  {
    id: 'stone_pickaxe',
    name: 'Stone Pickaxe',
    result: { itemId: ITEM.STONE_PICKAXE, count: 1 },
    pattern: ['CCC', ' S ', ' S '],
    key: { C: BLOCK.COBBLESTONE, S: ITEM.STICK },
    requiresTable: true,
    category: 'tools',
  },
  {
    id: 'iron_pickaxe',
    name: 'Iron Pickaxe',
    result: { itemId: ITEM.IRON_PICKAXE, count: 1 },
    pattern: ['III', ' S ', ' S '],
    key: { I: ITEM.IRON_INGOT, S: ITEM.STICK },
    requiresTable: true,
    category: 'tools',
  },
  {
    id: 'crystal_pickaxe',
    name: 'Aether Pickaxe',
    result: { itemId: ITEM.CRYSTAL_PICKAXE, count: 1 },
    pattern: ['CCC', ' S ', ' S '],
    key: { C: ITEM.CRYSTAL_GEM, S: ITEM.STICK },
    requiresTable: true,
    category: 'tools',
  },

  // === AXES ===
  {
    id: 'wood_axe',
    name: 'Timber Axe',
    result: { itemId: ITEM.WOOD_AXE, count: 1 },
    pattern: ['PP', 'PS', ' S'],
    key: { P: BLOCK.PLANKS, S: ITEM.STICK },
    requiresTable: true,
    category: 'tools',
  },
  {
    id: 'stone_axe',
    name: 'Stone Axe',
    result: { itemId: ITEM.STONE_AXE, count: 1 },
    pattern: ['CC', 'CS', ' S'],
    key: { C: BLOCK.COBBLESTONE, S: ITEM.STICK },
    requiresTable: true,
    category: 'tools',
  },
  {
    id: 'iron_axe',
    name: 'Iron Axe',
    result: { itemId: ITEM.IRON_AXE, count: 1 },
    pattern: ['II', 'IS', ' S'],
    key: { I: ITEM.IRON_INGOT, S: ITEM.STICK },
    requiresTable: true,
    category: 'tools',
  },
  {
    id: 'crystal_axe',
    name: 'Aether Axe',
    result: { itemId: ITEM.CRYSTAL_AXE, count: 1 },
    pattern: ['CC', 'CS', ' S'],
    key: { C: ITEM.CRYSTAL_GEM, S: ITEM.STICK },
    requiresTable: true,
    category: 'tools',
  },

  // === SHOVELS ===
  {
    id: 'wood_shovel',
    name: 'Timber Shovel',
    result: { itemId: ITEM.WOOD_SHOVEL, count: 1 },
    pattern: ['P', 'S', 'S'],
    key: { P: BLOCK.PLANKS, S: ITEM.STICK },
    requiresTable: true,
    category: 'tools',
  },
  {
    id: 'stone_shovel',
    name: 'Stone Shovel',
    result: { itemId: ITEM.STONE_SHOVEL, count: 1 },
    pattern: ['C', 'S', 'S'],
    key: { C: BLOCK.COBBLESTONE, S: ITEM.STICK },
    requiresTable: true,
    category: 'tools',
  },
  {
    id: 'iron_shovel',
    name: 'Iron Shovel',
    result: { itemId: ITEM.IRON_SHOVEL, count: 1 },
    pattern: ['I', 'S', 'S'],
    key: { I: ITEM.IRON_INGOT, S: ITEM.STICK },
    requiresTable: true,
    category: 'tools',
  },

  // === SWORDS ===
  {
    id: 'wood_sword',
    name: 'Timber Blade',
    result: { itemId: ITEM.WOOD_SWORD, count: 1 },
    pattern: ['P', 'P', 'S'],
    key: { P: BLOCK.PLANKS, S: ITEM.STICK },
    requiresTable: true,
    category: 'tools',
  },
  {
    id: 'stone_sword',
    name: 'Stone Broadsword',
    result: { itemId: ITEM.STONE_SWORD, count: 1 },
    pattern: ['C', 'C', 'S'],
    key: { C: BLOCK.COBBLESTONE, S: ITEM.STICK },
    requiresTable: true,
    category: 'tools',
  },
  {
    id: 'iron_sword',
    name: 'Iron Sabre',
    result: { itemId: ITEM.IRON_SWORD, count: 1 },
    pattern: ['I', 'I', 'S'],
    key: { I: ITEM.IRON_INGOT, S: ITEM.STICK },
    requiresTable: true,
    category: 'tools',
  },
  {
    id: 'crystal_sword',
    name: 'Aether Greatsword',
    result: { itemId: ITEM.CRYSTAL_SWORD, count: 1 },
    pattern: ['C', 'C', 'S'],
    key: { C: ITEM.CRYSTAL_GEM, S: ITEM.STICK },
    requiresTable: true,
    category: 'tools',
  },

  // === HOES ===
  {
    id: 'wood_hoe',
    name: 'Timber Hoe',
    result: { itemId: ITEM.WOOD_HOE, count: 1 },
    pattern: ['PP', ' S', ' S'],
    key: { P: BLOCK.PLANKS, S: ITEM.STICK },
    requiresTable: true,
    category: 'tools',
  },
  {
    id: 'iron_hoe',
    name: 'Iron Hoe',
    result: { itemId: ITEM.IRON_HOE, count: 1 },
    pattern: ['II', ' S', ' S'],
    key: { I: ITEM.IRON_INGOT, S: ITEM.STICK },
    requiresTable: true,
    category: 'tools',
  },
];

export const SMELT_RECIPES: SmeltRecipe[] = [
  { inputId: ITEM.RAW_IRON, outputId: ITEM.IRON_INGOT, smeltTime: 4.5, xp: 8 },
  { inputId: ITEM.RAW_GOLD, outputId: ITEM.GOLD_INGOT, smeltTime: 5.0, xp: 12 },
  { inputId: BLOCK.SAND, outputId: BLOCK.GLASS, smeltTime: 3.5, xp: 4 },
  { inputId: BLOCK.COBBLESTONE, outputId: BLOCK.STONE, smeltTime: 3.5, xp: 4 },
  { inputId: BLOCK.CLAY, outputId: BLOCK.BRICK, smeltTime: 4.0, xp: 5 },
  { inputId: ITEM.RAW_MEAT, outputId: ITEM.COOKED_MEAT, smeltTime: 3.5, xp: 6 },
  { inputId: BLOCK.OAK_LOG, outputId: ITEM.COAL, smeltTime: 4.0, xp: 4 },
  { inputId: BLOCK.BIRCH_LOG, outputId: ITEM.COAL, smeltTime: 4.0, xp: 4 },
  { inputId: BLOCK.PINE_LOG, outputId: ITEM.COAL, smeltTime: 4.0, xp: 4 },
];

export function findSmeltRecipe(inputId: number): SmeltRecipe | undefined {
  return SMELT_RECIPES.find((r) => r.inputId === inputId);
}

/**
 * Matches a crafting grid (2x2 or 3x3 flattened) against registered recipes.
 */
export function matchCraftingGrid(
  grid: (ItemStack | null)[],
  gridSize: 2 | 3
): CraftingRecipe | null {
  // Build trimmed bounding box for shaped recipes
  let minR: number = gridSize;
  let maxR = -1;
  let minC: number = gridSize;
  let maxC = -1;

  const counts = new Map<number, number>();
  let totalItems = 0;

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const slot = grid[r * gridSize + c];
      if (slot && slot.count > 0) {
        minR = Math.min(minR, r);
        maxR = Math.max(maxR, r);
        minC = Math.min(minC, c);
        maxC = Math.max(maxC, c);
        counts.set(slot.itemId, (counts.get(slot.itemId) ?? 0) + 1);
        totalItems++;
      }
    }
  }

  if (totalItems === 0) return null;

  const boxH = maxR - minR + 1;
  const boxW = maxC - minC + 1;

  for (const recipe of CRAFTING_RECIPES) {
    if (recipe.requiresTable && gridSize < 3) continue;

    if (recipe.shapeless) {
      let expectedTotal = 0;
      let match = true;
      for (const req of recipe.shapeless) {
        expectedTotal += req.count;
        if ((counts.get(req.itemId) ?? 0) !== req.count) {
          match = false;
          break;
        }
      }
      if (match && expectedTotal === totalItems) return recipe;
      continue;
    }

    if (recipe.pattern && recipe.key) {
      const patH = recipe.pattern.length;
      const patW = recipe.pattern[0].length;
      if (patH !== boxH || patW !== boxW) continue;

      const checkOrientation = (mirror: boolean): boolean => {
        for (let pr = 0; pr < patH; pr++) {
          for (let pc = 0; pc < patW; pc++) {
            const ch = recipe.pattern![pr][mirror ? patW - 1 - pc : pc];
            const expectedId = ch === ' ' ? 0 : recipe.key![ch] ?? 0;
            const slot = grid[(minR + pr) * gridSize + (minC + pc)];
            const actualId = slot ? slot.itemId : 0;
            if (expectedId !== actualId) return false;
          }
        }
        return true;
      };

      if (checkOrientation(false) || checkOrientation(true)) {
        return recipe;
      }
    }
  }

  return null;
}

export function getRecipeIngredients(recipe: CraftingRecipe): { itemId: number; count: number }[] {
  const map = new Map<number, number>();
  if (recipe.shapeless) {
    for (const s of recipe.shapeless) {
      map.set(s.itemId, (map.get(s.itemId) ?? 0) + s.count);
    }
  } else if (recipe.pattern && recipe.key) {
    for (const row of recipe.pattern) {
      for (const ch of row) {
        if (ch !== ' ' && recipe.key[ch]) {
          const id = recipe.key[ch];
          map.set(id, (map.get(id) ?? 0) + 1);
        }
      }
    }
  }
  return Array.from(map.entries()).map(([itemId, count]) => ({ itemId, count }));
}

export const TRADER_OFFERS: TradeOffer[] = [
  {
    id: 'trade_wheat_gold',
    costItemId: ITEM.WHEAT,
    costCount: 6,
    rewardItemId: ITEM.GOLD_INGOT,
    rewardCount: 2,
    label: 'Sell Harvest for Gold',
  },
  {
    id: 'trade_wood_torches',
    costItemId: BLOCK.OAK_LOG,
    costCount: 4,
    rewardItemId: BLOCK.TORCH,
    rewardCount: 12,
    label: 'Timber for Expedition Torches',
  },
  {
    id: 'trade_wool_bread',
    costItemId: ITEM.WOOL,
    costCount: 3,
    rewardItemId: ITEM.BREAD,
    rewardCount: 4,
    label: 'Fleece for Fresh Bread',
  },
  {
    id: 'trade_gold_crystal',
    costItemId: ITEM.GOLD_INGOT,
    costCount: 3,
    rewardItemId: ITEM.CRYSTAL_GEM,
    rewardCount: 2,
    label: 'Gold for Aether Crystals',
  },
  {
    id: 'trade_gold_spark',
    costItemId: ITEM.GOLD_INGOT,
    costCount: 2,
    rewardItemId: ITEM.SPARK_DUST,
    rewardCount: 12,
    label: 'Gold for Sparkstone Dust',
  },
  {
    id: 'trade_gold_obsidian',
    costItemId: ITEM.GOLD_INGOT,
    costCount: 3,
    rewardItemId: BLOCK.OBSIDIAN,
    rewardCount: 6,
    label: 'Gold for Volcanic Obsidian',
  },
  {
    id: 'trade_crystal_sword',
    costItemId: ITEM.GOLD_INGOT,
    costCount: 5,
    rewardItemId: ITEM.IRON_SWORD,
    rewardCount: 1,
    rewardEnchantment: { type: 'sharpness', level: 2 },
    label: 'Enchanted Iron Sabre (Sharpness II)',
  },
  {
    id: 'trade_summon_totem',
    costItemId: ITEM.CRYSTAL_GEM,
    costCount: 2,
    rewardItemId: ITEM.SUMMON_TOTEM,
    rewardCount: 1,
    label: 'Warden Summon Totem (Boss Fight!)',
  },
];
