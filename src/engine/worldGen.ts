import { BLOCK } from './blocks';
import { hashCoords, SeededNoise } from './noise';
import { BiomeType } from './types';

export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 64;
export const WATER_LEVEL = 22;

export function localIndex(lx: number, y: number, lz: number): number {
  return (y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx;
}

export class WorldGenerator {
  private readonly noise: SeededNoise;
  private readonly tempNoise: SeededNoise;
  private readonly moistNoise: SeededNoise;
  private readonly caveNoise: SeededNoise;
  public readonly seedInt: number;

  constructor(seed: string) {
    this.noise = new SeededNoise(seed);
    this.tempNoise = new SeededNoise(seed + '_TEMP_MAP');
    this.moistNoise = new SeededNoise(seed + '_MOIST_MAP');
    this.caveNoise = new SeededNoise(seed + '_CAVES_3D');
    this.seedInt = this.noise.seedInt;
  }

  public getBiome(wx: number, wz: number): BiomeType {
    // Keep spawn area welcoming (plains/forest near 0,0)
    const distFromOrigin = Math.hypot(wx, wz);
    const t = this.tempNoise.fbm2D(wx * 0.0055, wz * 0.0055, 3);
    const m = this.moistNoise.fbm2D(wx * 0.0055, wz * 0.0055, 3);
    const mountainVal = this.noise.ridged2D(wx * 0.006, wz * 0.006, 3);

    if (distFromOrigin < 28) {
      return m > 0.1 ? 'forest' : 'plains';
    }

    if (mountainVal > 0.64) return 'mountains';
    if (t < -0.22) return 'tundra';
    if (t > 0.24 && m < 0.05) return 'desert';
    if (m > 0.26 && t > -0.05) return 'swamp';
    if (m > 0.04) return 'forest';
    return 'plains';
  }

  public getTerrainHeight(wx: number, wz: number): { height: number; biome: BiomeType } {
    const biome = this.getBiome(wx, wz);
    const base = this.noise.fbm2D(wx * 0.012, wz * 0.012, 4);
    const detail = this.noise.fbm2D(wx * 0.045, wz * 0.045, 2);

    let h = 25 + base * 10 + detail * 2.5;

    switch (biome) {
      case 'plains':
        h = 25 + base * 6.5 + detail * 1.8;
        break;
      case 'forest':
        h = 26 + base * 8.5 + detail * 2.2;
        break;
      case 'desert':
        h = 24 + base * 7.0 + Math.sin(wx * 0.08 + wz * 0.04) * 1.6;
        break;
      case 'mountains': {
        const ridge = this.noise.ridged2D(wx * 0.011, wz * 0.011, 4);
        h = 27 + ridge * 24 + detail * 3.0;
        break;
      }
      case 'tundra':
        h = 24 + base * 5.5 + detail * 1.5;
        break;
      case 'swamp':
        h = 21.8 + base * 3.2 + detail * 1.2;
        break;
    }

    // Flatten immediate spawn pad gently so player always spawns safely above water
    const dSpawn = Math.hypot(wx, wz);
    if (dSpawn < 12) {
      const blend = 1 - dSpawn / 12;
      h = h * (1 - blend) + 27 * blend;
    }

    return {
      height: Math.max(6, Math.min(CHUNK_HEIGHT - 8, Math.floor(h))),
      biome,
    };
  }

  public generateChunkData(cx: number, cz: number): Uint8Array {
    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
    const baseWx = cx * CHUNK_SIZE;
    const baseWz = cz * CHUNK_SIZE;

    const heights = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
    const biomes: BiomeType[] = new Array(CHUNK_SIZE * CHUNK_SIZE);

    // 1. Primary terrain elevation, strata, water, caves, ores
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = baseWx + lx;
        const wz = baseWz + lz;
        const { height, biome } = this.getTerrainHeight(wx, wz);
        heights[lz * CHUNK_SIZE + lx] = height;
        biomes[lz * CHUNK_SIZE + lx] = biome;

        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          let blockId: number = BLOCK.AIR;

          if (y === 0) {
            blockId = BLOCK.BEDROCK;
          } else if (y === 1 && hashCoords(this.seedInt, wx, y, wz) < 0.5) {
            blockId = BLOCK.BEDROCK;
          } else if (y <= height) {
            // Surface & sub-surface strata
            if (y === height) {
              if (y <= WATER_LEVEL + 1 && biome !== 'tundra') {
                blockId = biome === 'swamp' ? BLOCK.CLAY : BLOCK.SAND;
              } else if (biome === 'desert') {
                blockId = BLOCK.SAND;
              } else if (biome === 'tundra') {
                blockId = BLOCK.SNOW_BLOCK;
              } else if (biome === 'mountains') {
                blockId = y >= 41 ? BLOCK.SNOW_BLOCK : y >= 34 ? BLOCK.STONE : BLOCK.GRASS;
              } else {
                blockId = BLOCK.GRASS;
              }
            } else if (y >= height - 3) {
              if (biome === 'desert') {
                blockId = y >= height - 2 ? BLOCK.SAND : BLOCK.SANDSTONE;
              } else if (biome === 'mountains' && height >= 35) {
                blockId = BLOCK.STONE;
              } else if (y <= WATER_LEVEL && biome === 'swamp') {
                blockId = BLOCK.CLAY;
              } else {
                blockId = BLOCK.DIRT;
              }
            } else {
              blockId = BLOCK.STONE;
            }

            // 3D Cave carving (keep away from immediate spawn and bedrock)
            if (y > 2 && y < height - 2 && Math.hypot(wx, wz) > 10) {
              const caveVal = this.caveNoise.noise3D(wx * 0.065, y * 0.085, wz * 0.065);
              const caveVal2 = this.caveNoise.noise3D(wx * 0.04 + 50, y * 0.06, wz * 0.04 - 50);
              if (Math.abs(caveVal) < 0.085 && Math.abs(caveVal2) < 0.14 && y < WATER_LEVEL + 12) {
                blockId = y <= 5 ? BLOCK.OBSIDIAN : BLOCK.AIR;
              }
            }

            // Ore veins inside stone
            if (blockId === BLOCK.STONE) {
              const r = hashCoords(this.seedInt + 777, wx, y, wz);
              const veinNoise = this.noise.noise3D(wx * 0.18, y * 0.18, wz * 0.18);
              if (y <= 11 && r < 0.011 && veinNoise > 0.25) {
                blockId = BLOCK.CRYSTAL_ORE;
              } else if (y <= 15 && r < 0.018 && veinNoise > 0.22) {
                blockId = BLOCK.SPARKSTONE_ORE;
              } else if (y <= 18 && r < 0.016 && veinNoise > 0.24) {
                blockId = BLOCK.GOLD_ORE;
              } else if (y <= 32 && r < 0.032 && veinNoise > 0.16) {
                blockId = BLOCK.IRON_ORE;
              } else if (y <= 45 && r < 0.046 && veinNoise > 0.12) {
                blockId = BLOCK.COAL_ORE;
              } else if (y < 20 && r > 0.965) {
                blockId = BLOCK.GRAVEL;
              }
            }
          } else if (y <= WATER_LEVEL) {
            blockId = biome === 'tundra' && y === WATER_LEVEL ? BLOCK.ICE : BLOCK.WATER;
          }

          blocks[localIndex(lx, y, lz)] = blockId;
        }
      }
    }

    // 2. Trees, cacti, flowers, berry bushes (keep trees inside chunk padding [2..13] to prevent clipping)
    for (let lz = 2; lz <= CHUNK_SIZE - 3; lz++) {
      for (let lx = 2; lx <= CHUNK_SIZE - 3; lx++) {
        const wx = baseWx + lx;
        const wz = baseWz + lz;
        if (Math.hypot(wx, wz) < 7) continue; // Keep spawn landing clear

        const h = heights[lz * CHUNK_SIZE + lx];
        const biome = biomes[lz * CHUNK_SIZE + lx];
        if (h <= WATER_LEVEL + 1 || h >= CHUNK_HEIGHT - 10) continue;

        const surfBlock = blocks[localIndex(lx, h, lz)];
        const r = hashCoords(this.seedInt + 313, wx, 0, wz);

        if (biome === 'desert' && surfBlock === BLOCK.SAND && r < 0.012) {
          const cHeight = 2 + Math.floor(hashCoords(this.seedInt + 99, wx, 1, wz) * 3);
          for (let cy = 1; cy <= cHeight; cy++) {
            blocks[localIndex(lx, h + cy, lz)] = BLOCK.CACTUS;
          }
          continue;
        }

        const treeChance =
          biome === 'forest'
            ? 0.052
            : biome === 'plains'
            ? 0.011
            : biome === 'swamp'
            ? 0.025
            : biome === 'tundra'
            ? 0.014
            : biome === 'mountains'
            ? 0.015
            : 0;

        if (
          (surfBlock === BLOCK.GRASS || surfBlock === BLOCK.SNOW_BLOCK) &&
          r < treeChance &&
          (wx & 1) === 0 &&
          (wz & 1) === 0
        ) {
          if (biome === 'tundra' || biome === 'mountains') {
            this.placePineTree(blocks, lx, h + 1, lz, wx, wz);
          } else {
            const isBirch = biome === 'forest' && hashCoords(this.seedInt + 42, wx, 2, wz) > 0.62;
            this.placeOakTree(blocks, lx, h + 1, lz, isBirch ? BLOCK.BIRCH_LOG : BLOCK.OAK_LOG, wx, wz);
          }
          continue;
        }

        // Flowers and wild berry bushes
        if (surfBlock === BLOCK.GRASS && blocks[localIndex(lx, h + 1, lz)] === BLOCK.AIR) {
          if (r > 0.975) {
            blocks[localIndex(lx, h + 1, lz)] = BLOCK.FLOWER;
          } else if (r > 0.962 && (biome === 'forest' || biome === 'plains' || biome === 'swamp')) {
            blocks[localIndex(lx, h + 1, lz)] = BLOCK.BERRY_BUSH;
          }
        }
      }
    }

    // 3. Deterministic Frontier Outpost (guaranteed near chunk (1, 1) and spaced every 6 chunks)
    const isStarterOutpost = cx === 1 && cz === 1;
    const isPeriodicOutpost =
      !isStarterOutpost &&
      Math.abs(cx) % 6 === 3 &&
      Math.abs(cz) % 6 === 3 &&
      hashCoords(this.seedInt + 808, cx, 0, cz) > 0.35;

    if (isStarterOutpost || isPeriodicOutpost) {
      const midH = heights[7 * CHUNK_SIZE + 7];
      if (midH > WATER_LEVEL && midH < CHUNK_HEIGHT - 12) {
        this.placeFrontierOutpost(blocks, 5, midH, 5);
      }
    }

    // 4. Ancient Obsidian Boss Monolith Shrine (at chunk (-2, 2) and periodically)
    const isStarterShrine = cx === -2 && cz === 2;
    const isPeriodicShrine =
      !isStarterShrine &&
      Math.abs(cx) % 8 === 4 &&
      Math.abs(cz) % 8 === 5;
    if (isStarterShrine || isPeriodicShrine) {
      const midH = heights[7 * CHUNK_SIZE + 7];
      if (midH > WATER_LEVEL && midH < CHUNK_HEIGHT - 12) {
        this.placeObsidianShrine(blocks, 5, midH, 5);
      }
    }

    return blocks;
  }

  private placeOakTree(
    blocks: Uint8Array,
    lx: number,
    baseY: number,
    lz: number,
    logBlock: number,
    wx: number,
    wz: number
  ) {
    const trunkH = 4 + Math.floor(hashCoords(this.seedInt + 55, wx, 5, wz) * 2);
    for (let y = 0; y < trunkH; y++) {
      if (baseY + y < CHUNK_HEIGHT) {
        blocks[localIndex(lx, baseY + y, lz)] = logBlock;
      }
    }
    const crownBase = baseY + trunkH - 2;
    for (let dy = 0; dy <= 3; dy++) {
      const y = crownBase + dy;
      if (y >= CHUNK_HEIGHT) continue;
      const radius = dy >= 2 ? 1 : 2;
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.abs(dx) === radius && Math.abs(dz) === radius && (dy === 0 || dy === 3)) {
            continue;
          }
          const nx = lx + dx;
          const nz = lz + dz;
          if (nx < 0 || nx >= CHUNK_SIZE || nz < 0 || nz >= CHUNK_SIZE) continue;
          const idx = localIndex(nx, y, nz);
          if (blocks[idx] === BLOCK.AIR) {
            blocks[idx] = BLOCK.OAK_LEAVES;
          }
        }
      }
    }
  }

  private placePineTree(
    blocks: Uint8Array,
    lx: number,
    baseY: number,
    lz: number,
    wx: number,
    wz: number
  ) {
    const trunkH = 5 + Math.floor(hashCoords(this.seedInt + 88, wx, 6, wz) * 3);
    for (let y = 0; y < trunkH; y++) {
      if (baseY + y < CHUNK_HEIGHT) {
        blocks[localIndex(lx, baseY + y, lz)] = BLOCK.PINE_LOG;
      }
    }
    for (let dy = 2; dy <= trunkH + 1; dy++) {
      const y = baseY + dy;
      if (y >= CHUNK_HEIGHT) continue;
      const radius = dy > trunkH ? 0 : dy > trunkH - 2 ? 1 : 2;
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (radius === 2 && Math.abs(dx) + Math.abs(dz) > 2) continue;
          const nx = lx + dx;
          const nz = lz + dz;
          if (nx < 0 || nx >= CHUNK_SIZE || nz < 0 || nz >= CHUNK_SIZE) continue;
          const idx = localIndex(nx, y, nz);
          if (blocks[idx] === BLOCK.AIR) {
            blocks[idx] = BLOCK.PINE_LEAVES;
          }
        }
      }
    }
  }

  private placeFrontierOutpost(blocks: Uint8Array, ox: number, baseY: number, oz: number) {
    // Clear interior & lay sturdy foundation down 4 blocks
    for (let dx = 0; dx < 7; dx++) {
      for (let dz = 0; dz < 7; dz++) {
        for (let fy = baseY - 4; fy <= baseY; fy++) {
          if (fy > 1) {
            blocks[localIndex(ox + dx, fy, oz + dz)] = BLOCK.COBBLESTONE;
          }
        }
        for (let cy = 1; cy <= 6; cy++) {
          if (baseY + cy < CHUNK_HEIGHT) {
            blocks[localIndex(ox + dx, baseY + cy, oz + dz)] = BLOCK.AIR;
          }
        }
      }
    }

    // Walls (5x5 cabin)
    for (let dx = 1; dx <= 5; dx++) {
      for (let dz = 1; dz <= 5; dz++) {
        const isEdge = dx === 1 || dx === 5 || dz === 1 || dz === 5;
        const isCorner = (dx === 1 || dx === 5) && (dz === 1 || dz === 5);
        for (let h = 1; h <= 4; h++) {
          const y = baseY + h;
          if (h === 4) {
            blocks[localIndex(ox + dx, y, oz + dz)] = BLOCK.PLANKS;
          } else if (isEdge) {
            // Front doorway at dx=3, dz=1
            if (dx === 3 && dz === 1 && (h === 1 || h === 2)) continue;
            // Side glass windows
            if (!isCorner && h === 2 && (dx === 3 || dz === 3)) {
              blocks[localIndex(ox + dx, y, oz + dz)] = BLOCK.GLASS;
            } else {
              blocks[localIndex(ox + dx, y, oz + dz)] = isCorner ? BLOCK.OAK_LOG : BLOCK.PLANKS;
            }
          }
        }
      }
    }

    // Interior stations (functional Workbench, Furnace, Chest, Torches!)
    blocks[localIndex(ox + 2, baseY + 1, oz + 4)] = BLOCK.CRAFTING_TABLE;
    blocks[localIndex(ox + 3, baseY + 1, oz + 4)] = BLOCK.FURNACE;
    blocks[localIndex(ox + 4, baseY + 1, oz + 4)] = BLOCK.CHEST;
    blocks[localIndex(ox + 2, baseY + 2, oz + 2)] = BLOCK.TORCH;
    blocks[localIndex(ox + 2, baseY + 1, oz + 0)] = BLOCK.TORCH;
    blocks[localIndex(ox + 4, baseY + 1, oz + 0)] = BLOCK.TORCH;
  }

  private placeObsidianShrine(blocks: Uint8Array, ox: number, baseY: number, oz: number) {
    for (let dx = 0; dx < 7; dx++) {
      for (let dz = 0; dz < 7; dz++) {
        for (let fy = baseY - 3; fy <= baseY; fy++) {
          if (fy > 1) {
            blocks[localIndex(ox + dx, fy, oz + dz)] =
              (dx + dz) % 2 === 0 ? BLOCK.MOSSY_STONE : BLOCK.OBSIDIAN;
          }
        }
        for (let cy = 1; cy <= 6; cy++) {
          if (baseY + cy < CHUNK_HEIGHT) {
            blocks[localIndex(ox + dx, baseY + cy, oz + dz)] = BLOCK.AIR;
          }
        }
      }
    }
    // 4 Corner obsidian pillars with torches
    const corners = [
      [1, 1],
      [5, 1],
      [1, 5],
      [5, 5],
    ];
    for (const [cx, cz] of corners) {
      for (let h = 1; h <= 4; h++) {
        blocks[localIndex(ox + cx, baseY + h, oz + cz)] = BLOCK.OBSIDIAN;
      }
      blocks[localIndex(ox + cx, baseY + 5, oz + cz)] = BLOCK.TORCH;
    }
    // Center Enchanting Altar!
    blocks[localIndex(ox + 3, baseY + 1, oz + 3)] = BLOCK.ENCHANT_ALTAR;
  }
}
