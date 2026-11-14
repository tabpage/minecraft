import * as THREE from 'three';
import { BLOCK, ITEM, ITEM_REGISTRY, TILE } from './blocks';
import { mulberry32 } from './noise';

export const ATLAS_GRID = 8;
export const TILE_SIZE = 16;
export const ATLAS_PX = ATLAS_GRID * TILE_SIZE; // 128

interface AtlasBundle {
  canvas: HTMLCanvasElement;
  opaqueTexture: THREE.CanvasTexture;
  translucentTexture: THREE.CanvasTexture;
  crackTextures: THREE.CanvasTexture[];
  itemIcons: Map<number, string>;
}

let cachedBundle: AtlasBundle | null = null;

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.replace('#', ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function rgbStr(r: number, g: number, b: number, a = 1): string {
  return a < 1
    ? `rgba(${clampByte(r)},${clampByte(g)},${clampByte(b)},${a})`
    : `rgb(${clampByte(r)},${clampByte(g)},${clampByte(b)})`;
}

function drawNoisyFill(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  baseHex: string,
  variance: number,
  seed: number,
  alpha = 1
) {
  const [br, bg, bb] = hexToRgb(baseHex);
  const rand = mulberry32(seed);
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const delta = (rand() - 0.5) * 2 * variance;
      ctx.fillStyle = rgbStr(br + delta, bg + delta, bb + delta, alpha);
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  }
}

function drawTile(ctx: CanvasRenderingContext2D, tileIndex: number) {
  const col = tileIndex % ATLAS_GRID;
  const row = Math.floor(tileIndex / ATLAS_GRID);
  const ox = col * TILE_SIZE;
  const oy = row * TILE_SIZE;
  const rand = mulberry32(1000 + tileIndex * 97);

  ctx.clearRect(ox, oy, TILE_SIZE, TILE_SIZE);

  switch (tileIndex) {
    case TILE.GRASS_TOP: {
      drawNoisyFill(ctx, ox, oy, '#58a846', 18, tileIndex * 17);
      for (let i = 0; i < 28; i++) {
        const x = Math.floor(rand() * 16);
        const y = Math.floor(rand() * 16);
        ctx.fillStyle = rand() > 0.5 ? '#6ec454' : '#438534';
        ctx.fillRect(ox + x, oy + y, 1, 1);
      }
      break;
    }
    case TILE.GRASS_SIDE: {
      drawNoisyFill(ctx, ox, oy, '#7b5438', 15, tileIndex * 19);
      // Grass fringe along top
      for (let x = 0; x < 16; x++) {
        const depth = 3 + Math.floor(rand() * 3);
        for (let y = 0; y < depth; y++) {
          ctx.fillStyle = y === depth - 1 ? '#3f7d32' : rand() > 0.4 ? '#58a846' : '#69bc52';
          ctx.fillRect(ox + x, oy + y, 1, 1);
        }
      }
      break;
    }
    case TILE.DIRT: {
      drawNoisyFill(ctx, ox, oy, '#7b5438', 16, tileIndex * 23);
      for (let i = 0; i < 18; i++) {
        ctx.fillStyle = rand() > 0.5 ? '#61412b' : '#94694a';
        ctx.fillRect(ox + Math.floor(rand() * 15), oy + Math.floor(rand() * 15), 2, 1);
      }
      break;
    }
    case TILE.STONE: {
      drawNoisyFill(ctx, ox, oy, '#7f8691', 14, tileIndex * 29);
      for (let i = 0; i < 14; i++) {
        ctx.fillStyle = rand() > 0.5 ? '#69707a' : '#969da8';
        ctx.fillRect(ox + Math.floor(rand() * 13), oy + Math.floor(rand() * 15), 3, 1);
      }
      break;
    }
    case TILE.COBBLESTONE: {
      drawNoisyFill(ctx, ox, oy, '#6b727d', 14, tileIndex * 31);
      const stones = [
        [0, 0, 7, 5], [8, 0, 8, 6], [0, 6, 5, 5], [6, 6, 6, 4],
        [12, 7, 4, 5], [0, 12, 7, 4], [8, 11, 8, 5],
      ];
      for (const [sx, sy, sw, sh] of stones) {
        ctx.fillStyle = '#484e57';
        ctx.fillRect(ox + sx, oy + sy, sw, sh);
        ctx.fillStyle = rand() > 0.5 ? '#878e99' : '#777e88';
        ctx.fillRect(ox + sx + 1, oy + sy + 1, Math.max(1, sw - 2), Math.max(1, sh - 2));
      }
      break;
    }
    case TILE.BEDROCK: {
      drawNoisyFill(ctx, ox, oy, '#2c3038', 22, tileIndex * 37);
      for (let i = 0; i < 26; i++) {
        ctx.fillStyle = rand() > 0.45 ? '#16191f' : '#4a505c';
        ctx.fillRect(ox + Math.floor(rand() * 14), oy + Math.floor(rand() * 14), 2, 2);
      }
      break;
    }
    case TILE.SAND: {
      drawNoisyFill(ctx, ox, oy, '#e3cf94', 14, tileIndex * 41);
      for (let i = 0; i < 18; i++) {
        ctx.fillStyle = rand() > 0.5 ? '#f0dfa8' : '#cdb77c';
        ctx.fillRect(ox + Math.floor(rand() * 15), oy + Math.floor(rand() * 15), 2, 1);
      }
      break;
    }
    case TILE.SANDSTONE_TOP: {
      drawNoisyFill(ctx, ox, oy, '#dbc484', 10, tileIndex * 43);
      ctx.strokeStyle = '#bfa668';
      ctx.strokeRect(ox + 0.5, oy + 0.5, 15, 15);
      break;
    }
    case TILE.SANDSTONE_SIDE: {
      drawNoisyFill(ctx, ox, oy, '#d7be7c', 10, tileIndex * 47);
      ctx.fillStyle = '#c4aa68';
      ctx.fillRect(ox, oy + 4, 16, 1);
      ctx.fillRect(ox, oy + 10, 16, 1);
      ctx.fillStyle = '#ebd69c';
      ctx.fillRect(ox, oy + 5, 16, 1);
      break;
    }
    case TILE.GRAVEL: {
      drawNoisyFill(ctx, ox, oy, '#868280', 22, tileIndex * 53);
      for (let i = 0; i < 24; i++) {
        ctx.fillStyle = rand() > 0.5 ? '#a29e9a' : '#5e5a58';
        ctx.fillRect(ox + Math.floor(rand() * 15), oy + Math.floor(rand() * 15), 2, 2);
      }
      break;
    }
    case TILE.WATER: {
      drawNoisyFill(ctx, ox, oy, '#2d7bd6', 12, tileIndex * 59, 0.78);
      for (let y = 2; y < 16; y += 5) {
        ctx.fillStyle = 'rgba(130, 200, 255, 0.38)';
        ctx.fillRect(ox + ((y * 3) % 10), oy + y, 6, 1);
      }
      break;
    }
    case TILE.OAK_TOP:
    case TILE.BIRCH_TOP:
    case TILE.PINE_TOP: {
      const bark = tileIndex === TILE.BIRCH_TOP ? '#d8d5cc' : tileIndex === TILE.PINE_TOP ? '#473322' : '#65462b';
      const inner = tileIndex === TILE.BIRCH_TOP ? '#ccb68b' : '#b78f5c';
      const ring = tileIndex === TILE.BIRCH_TOP ? '#a99166' : '#8b663c';
      ctx.fillStyle = bark;
      ctx.fillRect(ox, oy, 16, 16);
      ctx.fillStyle = inner;
      ctx.fillRect(ox + 2, oy + 2, 12, 12);
      ctx.fillStyle = ring;
      ctx.fillRect(ox + 4, oy + 4, 8, 8);
      ctx.fillStyle = inner;
      ctx.fillRect(ox + 6, oy + 6, 4, 4);
      break;
    }
    case TILE.OAK_SIDE: {
      drawNoisyFill(ctx, ox, oy, '#6b492c', 12, tileIndex * 61);
      for (let x = 1; x < 16; x += 3) {
        ctx.fillStyle = '#4e331d';
        ctx.fillRect(ox + x, oy, 1, 16);
      }
      break;
    }
    case TILE.BIRCH_SIDE: {
      drawNoisyFill(ctx, ox, oy, '#dddcd5', 10, tileIndex * 67);
      for (let i = 0; i < 12; i++) {
        ctx.fillStyle = '#33363b';
        ctx.fillRect(ox + Math.floor(rand() * 12), oy + Math.floor(rand() * 15), 3 + Math.floor(rand() * 3), 1);
      }
      break;
    }
    case TILE.PINE_SIDE: {
      drawNoisyFill(ctx, ox, oy, '#4b3421', 12, tileIndex * 71);
      for (let x = 0; x < 16; x += 4) {
        ctx.fillStyle = '#332215';
        ctx.fillRect(ox + x, oy, 1, 16);
      }
      break;
    }
    case TILE.OAK_LEAVES:
    case TILE.PINE_LEAVES: {
      const c1 = tileIndex === TILE.OAK_LEAVES ? '#3a8c38' : '#2a6646';
      const c2 = tileIndex === TILE.OAK_LEAVES ? '#52aa46' : '#3a805a';
      const c3 = tileIndex === TILE.OAK_LEAVES ? '#256127' : '#1b4730';
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const r = rand();
          if (r < 0.16) continue; // crisp alpha leaf cutouts
          ctx.fillStyle = r < 0.5 ? c1 : r < 0.8 ? c2 : c3;
          ctx.fillRect(ox + x, oy + y, 1, 1);
        }
      }
      break;
    }
    case TILE.PLANKS: {
      drawNoisyFill(ctx, ox, oy, '#be915a', 10, tileIndex * 73);
      for (let y = 0; y < 16; y += 4) {
        ctx.fillStyle = '#8b6439';
        ctx.fillRect(ox, oy + y, 16, 1);
        const splitX = ((y * 5) + 4) % 14 + 1;
        ctx.fillRect(ox + splitX, oy + y, 1, 4);
      }
      break;
    }
    case TILE.SNOW: {
      drawNoisyFill(ctx, ox, oy, '#eef5fb', 8, tileIndex * 79);
      break;
    }
    case TILE.ICE: {
      drawNoisyFill(ctx, ox, oy, '#8fd3ff', 10, tileIndex * 83, 0.82);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillRect(ox + 2, oy + 2, 5, 1);
      ctx.fillRect(ox + 3, oy + 3, 4, 1);
      ctx.fillRect(ox + 9, oy + 10, 5, 1);
      break;
    }
    case TILE.CLAY: {
      drawNoisyFill(ctx, ox, oy, '#9ea5b3', 10, tileIndex * 89);
      break;
    }
    case TILE.BRICK: {
      ctx.fillStyle = '#c8c2b8'; // mortar
      ctx.fillRect(ox, oy, 16, 16);
      for (let rowIdx = 0; rowIdx < 4; rowIdx++) {
        const y = rowIdx * 4;
        const offset = (rowIdx % 2) * 4;
        for (let b = -1; b < 3; b++) {
          const bx = b * 8 + offset;
          ctx.fillStyle = rand() > 0.5 ? '#a84738' : '#963b2e';
          const sx = Math.max(0, bx);
          const ex = Math.min(16, bx + 7);
          if (ex > sx) ctx.fillRect(ox + sx, oy + y, ex - sx, 3);
        }
      }
      break;
    }
    case TILE.GLASS: {
      ctx.fillStyle = 'rgba(185, 232, 255, 0.22)';
      ctx.fillRect(ox, oy, 16, 16);
      ctx.fillStyle = 'rgba(210, 240, 255, 0.9)';
      ctx.fillRect(ox, oy, 16, 1);
      ctx.fillRect(ox, oy + 15, 16, 1);
      ctx.fillRect(ox, oy, 1, 16);
      ctx.fillRect(ox + 15, oy, 1, 16);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillRect(ox + 3, oy + 3, 2, 1);
      ctx.fillRect(ox + 4, oy + 4, 1, 2);
      ctx.fillRect(ox + 11, oy + 11, 2, 1);
      break;
    }
    case TILE.COAL_ORE:
    case TILE.IRON_ORE:
    case TILE.GOLD_ORE:
    case TILE.CRYSTAL_ORE:
    case TILE.SPARKSTONE_ORE: {
      drawNoisyFill(ctx, ox, oy, '#7f8691', 14, tileIndex * 97);
      const gemColor =
        tileIndex === TILE.COAL_ORE
          ? '#202227'
          : tileIndex === TILE.IRON_ORE
          ? '#d6a988'
          : tileIndex === TILE.GOLD_ORE
          ? '#facc15'
          : tileIndex === TILE.CRYSTAL_ORE
          ? '#38bdf8'
          : '#ef4444';
      const hiColor =
        tileIndex === TILE.COAL_ORE
          ? '#3f434c'
          : tileIndex === TILE.IRON_ORE
          ? '#f0d3bc'
          : tileIndex === TILE.GOLD_ORE
          ? '#fef08a'
          : tileIndex === TILE.CRYSTAL_ORE
          ? '#bae6fd'
          : '#fca5a5';
      const spots = [
        [2, 3], [6, 2], [11, 4], [4, 9], [9, 8], [12, 11], [3, 13], [8, 13],
      ];
      for (const [sx, sy] of spots) {
        ctx.fillStyle = gemColor;
        ctx.fillRect(ox + sx, oy + sy, 2, 2);
        ctx.fillStyle = hiColor;
        ctx.fillRect(ox + sx, oy + sy, 1, 1);
      }
      break;
    }
    case TILE.CACTUS_TOP: {
      drawNoisyFill(ctx, ox, oy, '#2f8a42', 12, tileIndex * 101);
      ctx.fillStyle = '#48aa58';
      ctx.fillRect(ox + 3, oy + 3, 10, 10);
      break;
    }
    case TILE.CACTUS_SIDE: {
      drawNoisyFill(ctx, ox, oy, '#2d853f', 12, tileIndex * 103);
      for (let x = 2; x < 16; x += 4) {
        ctx.fillStyle = '#1d5e2b';
        ctx.fillRect(ox + x, oy, 1, 16);
      }
      for (let i = 0; i < 10; i++) {
        ctx.fillStyle = '#d9e3c8';
        ctx.fillRect(ox + Math.floor(rand() * 15), oy + Math.floor(rand() * 15), 1, 1);
      }
      break;
    }
    case TILE.CRAFT_TOP: {
      drawNoisyFill(ctx, ox, oy, '#9e6f3d', 8, tileIndex * 107);
      ctx.fillStyle = '#5e3d1e';
      ctx.fillRect(ox + 2, oy + 2, 12, 12);
      ctx.fillStyle = '#c89b66';
      for (let gx = 0; gx < 3; gx++) {
        for (let gy = 0; gy < 3; gy++) {
          ctx.fillRect(ox + 3 + gx * 4, oy + 3 + gy * 4, 3, 3);
        }
      }
      break;
    }
    case TILE.CRAFT_SIDE: {
      drawNoisyFill(ctx, ox, oy, '#b5844e', 10, tileIndex * 109);
      ctx.fillStyle = '#634323';
      ctx.fillRect(ox, oy, 16, 2);
      ctx.fillRect(ox, oy + 14, 16, 2);
      // Tool silhouette on workbench side
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(ox + 4, oy + 4, 2, 7);
      ctx.fillRect(ox + 9, oy + 5, 4, 2);
      ctx.fillStyle = '#7c4d24';
      ctx.fillRect(ox + 10, oy + 7, 2, 5);
      break;
    }
    case TILE.FURNACE_TOP:
    case TILE.FURNACE_SIDE: {
      drawNoisyFill(ctx, ox, oy, '#757c87', 12, tileIndex * 113);
      ctx.fillStyle = '#4c525c';
      ctx.fillRect(ox, oy, 16, 1);
      ctx.fillRect(ox, oy + 15, 16, 1);
      ctx.fillRect(ox, oy, 1, 16);
      ctx.fillRect(ox + 15, oy, 1, 16);
      break;
    }
    case TILE.FURNACE_FRONT: {
      drawNoisyFill(ctx, ox, oy, '#757c87', 12, tileIndex * 127);
      ctx.fillStyle = '#252830';
      ctx.fillRect(ox + 3, oy + 3, 10, 4);
      ctx.fillRect(ox + 3, oy + 9, 10, 5);
      // Glowing hearth embers
      ctx.fillStyle = '#f97316';
      ctx.fillRect(ox + 4, oy + 11, 8, 2);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(ox + 6, oy + 11, 4, 1);
      break;
    }
    case TILE.CHEST_TOP:
    case TILE.CHEST_SIDE: {
      drawNoisyFill(ctx, ox, oy, '#a56d37', 10, tileIndex * 131);
      ctx.fillStyle = '#4f3318';
      ctx.fillRect(ox, oy, 16, 2);
      ctx.fillRect(ox, oy + 14, 16, 2);
      ctx.fillRect(ox, oy, 2, 16);
      ctx.fillRect(ox + 14, oy, 2, 16);
      break;
    }
    case TILE.CHEST_FRONT: {
      drawNoisyFill(ctx, ox, oy, '#a56d37', 10, tileIndex * 137);
      ctx.fillStyle = '#4f3318';
      ctx.fillRect(ox, oy, 16, 2);
      ctx.fillRect(ox, oy + 14, 16, 2);
      ctx.fillRect(ox, oy, 2, 16);
      ctx.fillRect(ox + 14, oy, 2, 16);
      ctx.fillRect(ox, oy + 6, 16, 1);
      // Golden lock clasp
      ctx.fillStyle = '#facc15';
      ctx.fillRect(ox + 6, oy + 5, 4, 4);
      ctx.fillStyle = '#78350f';
      ctx.fillRect(ox + 7, oy + 7, 2, 1);
      break;
    }
    case TILE.ENCHANT_TOP: {
      drawNoisyFill(ctx, ox, oy, '#2b1d42', 10, tileIndex * 139);
      ctx.fillStyle = '#7e22ce';
      ctx.fillRect(ox + 2, oy + 2, 12, 12);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(ox + 5, oy + 5, 6, 6);
      ctx.fillStyle = '#e0f2fe';
      ctx.fillRect(ox + 7, oy + 7, 2, 2);
      break;
    }
    case TILE.ENCHANT_SIDE: {
      drawNoisyFill(ctx, ox, oy, '#211730', 10, tileIndex * 149);
      ctx.fillStyle = '#9333ea';
      ctx.fillRect(ox, oy, 16, 3);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(ox + 3, oy + 7, 2, 5);
      ctx.fillRect(ox + 7, oy + 6, 2, 6);
      ctx.fillRect(ox + 11, oy + 7, 2, 5);
      break;
    }
    case TILE.TORCH: {
      ctx.fillStyle = '#7c4d24';
      ctx.fillRect(ox + 7, oy + 6, 2, 10);
      ctx.fillStyle = '#f97316';
      ctx.fillRect(ox + 6, oy + 3, 4, 4);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(ox + 7, oy + 4, 2, 2);
      break;
    }
    case TILE.FARMLAND_DRY: {
      drawNoisyFill(ctx, ox, oy, '#825838', 12, tileIndex * 151);
      for (let y = 2; y < 16; y += 4) {
        ctx.fillStyle = '#5c3c24';
        ctx.fillRect(ox, oy + y, 16, 1);
      }
      break;
    }
    case TILE.FARMLAND_WET: {
      drawNoisyFill(ctx, ox, oy, '#4b311e', 10, tileIndex * 157);
      for (let y = 2; y < 16; y += 4) {
        ctx.fillStyle = '#2d1c11';
        ctx.fillRect(ox, oy + y, 16, 1);
      }
      break;
    }
    case TILE.WHEAT_1:
    case TILE.WHEAT_2:
    case TILE.WHEAT_3: {
      const h = tileIndex === TILE.WHEAT_1 ? 5 : tileIndex === TILE.WHEAT_2 ? 10 : 14;
      const stem = tileIndex === TILE.WHEAT_3 ? '#eab308' : '#4ade80';
      const tip = tileIndex === TILE.WHEAT_3 ? '#fef08a' : '#86efac';
      for (let x = 2; x < 15; x += 3) {
        ctx.fillStyle = stem;
        ctx.fillRect(ox + x, oy + 16 - h, 2, h);
        ctx.fillStyle = tip;
        ctx.fillRect(ox + x, oy + 16 - h, 2, 2);
      }
      break;
    }
    case TILE.FLOWER: {
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(ox + 7, oy + 8, 2, 8);
      ctx.fillRect(ox + 5, oy + 11, 2, 2);
      ctx.fillRect(ox + 9, oy + 10, 2, 2);
      ctx.fillStyle = '#f43f5e';
      ctx.fillRect(ox + 5, oy + 4, 6, 5);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(ox + 7, oy + 6, 2, 2);
      break;
    }
    case TILE.BERRY_BUSH: {
      for (let y = 4; y < 16; y++) {
        for (let x = 2; x < 14; x++) {
          if (rand() > 0.25) {
            ctx.fillStyle = rand() > 0.5 ? '#266e33' : '#398f46';
            ctx.fillRect(ox + x, oy + y, 1, 1);
          }
        }
      }
      const berries = [[4, 6], [10, 7], [6, 10], [11, 12], [5, 13]];
      for (const [bx, by] of berries) {
        ctx.fillStyle = '#e11d48';
        ctx.fillRect(ox + bx, oy + by, 2, 2);
      }
      break;
    }
    case TILE.SPARK_WIRE_OFF: {
      ctx.fillStyle = '#7f1d1d';
      ctx.fillRect(ox + 6, oy, 4, 16);
      ctx.fillRect(ox, oy + 6, 16, 4);
      ctx.fillStyle = '#991b1b';
      ctx.fillRect(ox + 7, oy + 1, 2, 14);
      ctx.fillRect(ox + 1, oy + 7, 14, 2);
      break;
    }
    case TILE.SPARK_WIRE_ON: {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(ox + 6, oy, 4, 16);
      ctx.fillRect(ox, oy + 6, 16, 4);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(ox + 7, oy + 2, 2, 12);
      ctx.fillRect(ox + 2, oy + 7, 12, 2);
      break;
    }
    case TILE.SPARK_LEVER: {
      ctx.fillStyle = '#64748b';
      ctx.fillRect(ox + 4, oy + 12, 8, 4);
      ctx.fillStyle = '#92400e';
      ctx.fillRect(ox + 7, oy + 4, 2, 9);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(ox + 6, oy + 2, 4, 3);
      break;
    }
    case TILE.SPARK_LAMP_OFF: {
      drawNoisyFill(ctx, ox, oy, '#5c4632', 8, tileIndex * 163);
      ctx.fillStyle = '#362719';
      ctx.fillRect(ox, oy, 16, 2);
      ctx.fillRect(ox, oy + 14, 16, 2);
      ctx.fillRect(ox, oy, 2, 16);
      ctx.fillRect(ox + 14, oy, 2, 16);
      ctx.fillStyle = '#7c5d41';
      ctx.fillRect(ox + 4, oy + 4, 8, 8);
      break;
    }
    case TILE.SPARK_LAMP_ON: {
      drawNoisyFill(ctx, ox, oy, '#f59e0b', 10, tileIndex * 167);
      ctx.fillStyle = '#b45309';
      ctx.fillRect(ox, oy, 16, 2);
      ctx.fillRect(ox, oy + 14, 16, 2);
      ctx.fillRect(ox, oy, 2, 16);
      ctx.fillRect(ox + 14, oy, 2, 16);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(ox + 3, oy + 3, 10, 10);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(ox + 6, oy + 6, 4, 4);
      break;
    }
    case TILE.MOSSY_STONE: {
      drawNoisyFill(ctx, ox, oy, '#757d88', 14, tileIndex * 173);
      for (let i = 0; i < 34; i++) {
        ctx.fillStyle = rand() > 0.4 ? '#3d8242' : '#2b6131';
        ctx.fillRect(ox + Math.floor(rand() * 15), oy + Math.floor(rand() * 15), 2, 2);
      }
      break;
    }
    case TILE.OBSIDIAN: {
      drawNoisyFill(ctx, ox, oy, '#1b1429', 10, tileIndex * 179);
      for (let i = 0; i < 16; i++) {
        ctx.fillStyle = rand() > 0.5 ? '#4c1d95' : '#0f0a19';
        ctx.fillRect(ox + Math.floor(rand() * 14), oy + Math.floor(rand() * 14), 2, 2);
      }
      break;
    }
    default: {
      drawNoisyFill(ctx, ox, oy, '#ff00ff', 10, tileIndex);
    }
  }
}

function buildCrackTextures(): THREE.CanvasTexture[] {
  const list: THREE.CanvasTexture[] = [];
  for (let stage = 0; stage < 8; stage++) {
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 16;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, 16, 16);
    const rand = mulberry32(9900 + stage * 13);
    ctx.fillStyle = `rgba(15, 18, 25, ${0.42 + stage * 0.06})`;
    const branches = 2 + stage * 2;
    for (let b = 0; b < branches; b++) {
      let x = 8;
      let y = 8;
      const steps = 3 + stage;
      for (let s = 0; s < steps; s++) {
        x = Math.max(0, Math.min(15, x + Math.floor(rand() * 3) - 1));
        y = Math.max(0, Math.min(15, y + Math.floor(rand() * 3) - 1));
        ctx.fillRect(x, y, 1, 1);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    list.push(tex);
  }
  return list;
}

function renderIsometricBlockIcon(atlasCanvas: HTMLCanvasElement, topTile: number, sideTile: number): string {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const sampleTile = (tileIdx: number) => {
    const tc = document.createElement('canvas');
    tc.width = 16;
    tc.height = 16;
    const tctx = tc.getContext('2d')!;
    const col = tileIdx % ATLAS_GRID;
    const row = Math.floor(tileIdx / ATLAS_GRID);
    tctx.drawImage(atlasCanvas, col * 16, row * 16, 16, 16, 0, 0, 16, 16);
    return tc;
  };

  const topImg = sampleTile(topTile);
  const sideImg = sampleTile(sideTile);

  // Top rhombus
  ctx.save();
  ctx.translate(16, 4);
  ctx.transform(0.82, 0.42, -0.82, 0.42, 0, 0);
  ctx.drawImage(topImg, 0, 0, 14, 14);
  ctx.restore();

  // Left face
  ctx.save();
  ctx.translate(4.5, 9.9);
  ctx.transform(0.82, 0.42, 0, 1.0, 0, 0);
  ctx.drawImage(sideImg, 0, 0, 14, 14);
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.fillRect(0, 0, 14, 14);
  ctx.restore();

  // Right face
  ctx.save();
  ctx.translate(16, 15.7);
  ctx.transform(0.82, -0.42, 0, 1.0, 0, 0);
  ctx.drawImage(sideImg, 0, 0, 14, 14);
  ctx.fillStyle = 'rgba(0,0,0,0.34)';
  ctx.fillRect(0, 0, 14, 14);
  ctx.restore();

  return c.toDataURL();
}

function renderFlatTileIcon(atlasCanvas: HTMLCanvasElement, tileIdx: number): string {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const col = tileIdx % ATLAS_GRID;
  const row = Math.floor(tileIdx / ATLAS_GRID);
  ctx.drawImage(atlasCanvas, col * 16, row * 16, 16, 16, 2, 2, 28, 28);
  return c.toDataURL();
}

function renderPixelSprite(itemId: number): string {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 16;
  const ctx = c.getContext('2d')!;

  const px = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };

  const drawHandle = () => {
    for (let i = 0; i < 8; i++) {
      px(3 + i, 12 - i, 2, 2, i % 2 === 0 ? '#854d0e' : '#a16207');
    }
  };

  const tierColors = (id: number): [string, string] => {
    if (
      id === ITEM.WOOD_PICKAXE ||
      id === ITEM.WOOD_AXE ||
      id === ITEM.WOOD_SHOVEL ||
      id === ITEM.WOOD_SWORD ||
      id === ITEM.WOOD_HOE
    ) {
      return ['#b8844b', '#8c5e2c'];
    }
    if (
      id === ITEM.STONE_PICKAXE ||
      id === ITEM.STONE_AXE ||
      id === ITEM.STONE_SHOVEL ||
      id === ITEM.STONE_SWORD
    ) {
      return ['#94a3b8', '#64748b'];
    }
    if (
      id === ITEM.IRON_PICKAXE ||
      id === ITEM.IRON_AXE ||
      id === ITEM.IRON_SHOVEL ||
      id === ITEM.IRON_SWORD ||
      id === ITEM.IRON_HOE
    ) {
      return ['#e2e8f0', '#94a3b8'];
    }
    return ['#38bdf8', '#0284c7']; // Crystal tier
  };

  switch (itemId) {
    case ITEM.STICK:
      for (let i = 0; i < 10; i++) {
        px(3 + i, 12 - i, 2, 2, i % 2 === 0 ? '#92400e' : '#b45309');
      }
      break;
    case ITEM.COAL:
      px(4, 5, 8, 7, '#1f2937');
      px(5, 4, 6, 9, '#111827');
      px(6, 6, 3, 2, '#4b5563');
      break;
    case ITEM.RAW_IRON:
      px(4, 5, 8, 7, '#a87d60');
      px(5, 4, 6, 8, '#d6a988');
      px(6, 6, 2, 2, '#f5decb');
      break;
    case ITEM.IRON_INGOT:
      px(2, 6, 12, 5, '#94a3b8');
      px(3, 5, 10, 4, '#e2e8f0');
      px(4, 6, 6, 1, '#ffffff');
      break;
    case ITEM.RAW_GOLD:
      px(4, 5, 8, 7, '#ca8a04');
      px(5, 4, 6, 8, '#facc15');
      px(6, 6, 2, 2, '#fef08a');
      break;
    case ITEM.GOLD_INGOT:
      px(2, 6, 12, 5, '#ca8a04');
      px(3, 5, 10, 4, '#facc15');
      px(4, 6, 6, 1, '#fef9c3');
      break;
    case ITEM.CRYSTAL_GEM:
      px(6, 2, 4, 12, '#0284c7');
      px(4, 4, 8, 8, '#38bdf8');
      px(6, 5, 4, 5, '#bae6fd');
      px(7, 4, 2, 2, '#ffffff');
      break;
    case ITEM.SPARK_DUST:
      px(5, 5, 6, 6, '#dc2626');
      px(4, 7, 8, 3, '#ef4444');
      px(6, 6, 3, 2, '#fca5a5');
      px(3, 10, 2, 2, '#ef4444');
      px(11, 4, 2, 2, '#f87171');
      break;
    case ITEM.WHEAT:
      for (let i = 0; i < 8; i++) {
        px(3 + i, 12 - i, 3, 2, i % 2 === 0 ? '#eab308' : '#facc15');
      }
      px(6, 9, 4, 2, '#a16207');
      break;
    case ITEM.WHEAT_SEEDS:
      px(4, 6, 2, 3, '#84cc16');
      px(8, 5, 2, 3, '#65a30d');
      px(6, 9, 2, 3, '#a3e635');
      px(10, 8, 2, 3, '#84cc16');
      break;
    case ITEM.BREAD:
      px(2, 6, 12, 6, '#92400e');
      px(3, 5, 10, 5, '#d97706');
      px(5, 6, 6, 2, '#fbbf24');
      break;
    case ITEM.APPLE:
      px(7, 2, 2, 3, '#78350f');
      px(9, 3, 2, 2, '#22c55e');
      px(4, 5, 8, 8, '#dc2626');
      px(5, 6, 2, 2, '#fca5a5');
      break;
    case ITEM.BERRIES:
      px(6, 3, 4, 2, '#16a34a');
      px(4, 6, 4, 4, '#be123c');
      px(8, 6, 4, 4, '#e11d48');
      px(6, 9, 4, 4, '#f43f5e');
      px(5, 7, 1, 1, '#fda4af');
      break;
    case ITEM.RAW_MEAT:
      px(3, 5, 10, 7, '#e11d48');
      px(4, 6, 8, 5, '#fb7185');
      px(5, 7, 3, 2, '#ffe4e6');
      break;
    case ITEM.COOKED_MEAT:
      px(3, 5, 10, 7, '#7c2d12');
      px(4, 6, 8, 5, '#b45309');
      px(5, 7, 4, 2, '#d97706');
      break;
    case ITEM.WOOL:
      px(3, 4, 10, 8, '#e2e8f0');
      px(4, 3, 8, 10, '#f8fafc');
      px(6, 6, 4, 4, '#cbd5e1');
      break;
    case ITEM.ANCIENT_CORE:
      px(3, 3, 10, 10, '#3b0764');
      px(4, 4, 8, 8, '#7e22ce');
      px(6, 6, 4, 4, '#38bdf8');
      px(7, 7, 2, 2, '#ffffff');
      break;
    case ITEM.SUMMON_TOTEM:
      px(5, 2, 6, 12, '#4c1d95');
      px(3, 5, 10, 4, '#6d28d9');
      px(6, 4, 1, 2, '#38bdf8');
      px(9, 4, 1, 2, '#38bdf8');
      px(6, 9, 4, 2, '#facc15');
      break;

    // Pickaxes
    case ITEM.WOOD_PICKAXE:
    case ITEM.STONE_PICKAXE:
    case ITEM.IRON_PICKAXE:
    case ITEM.CRYSTAL_PICKAXE: {
      const [c1, c2] = tierColors(itemId);
      drawHandle();
      px(5, 2, 7, 2, c1);
      px(10, 4, 2, 5, c1);
      px(4, 3, 2, 2, c2);
      px(11, 8, 2, 2, c2);
      break;
    }
    // Axes
    case ITEM.WOOD_AXE:
    case ITEM.STONE_AXE:
    case ITEM.IRON_AXE:
    case ITEM.CRYSTAL_AXE: {
      const [c1, c2] = tierColors(itemId);
      drawHandle();
      px(7, 2, 5, 5, c1);
      px(6, 3, 2, 4, c2);
      px(10, 6, 3, 2, c2);
      break;
    }
    // Shovels
    case ITEM.WOOD_SHOVEL:
    case ITEM.STONE_SHOVEL:
    case ITEM.IRON_SHOVEL: {
      const [c1, c2] = tierColors(itemId);
      drawHandle();
      px(9, 2, 5, 5, c1);
      px(10, 3, 3, 3, c2);
      break;
    }
    // Swords
    case ITEM.WOOD_SWORD:
    case ITEM.STONE_SWORD:
    case ITEM.IRON_SWORD:
    case ITEM.CRYSTAL_SWORD: {
      const [c1, c2] = tierColors(itemId);
      px(2, 12, 3, 3, '#78350f');
      px(4, 9, 4, 4, '#a16207');
      for (let i = 0; i < 8; i++) {
        px(6 + i, 9 - i, 2, 2, i % 2 === 0 ? c1 : c2);
      }
      px(12, 2, 2, 2, c1);
      break;
    }
    // Hoes
    case ITEM.WOOD_HOE:
    case ITEM.IRON_HOE: {
      const [c1, c2] = tierColors(itemId);
      drawHandle();
      px(6, 2, 6, 2, c1);
      px(10, 4, 2, 2, c2);
      break;
    }
    default:
      px(4, 4, 8, 8, '#f472b6');
  }

  // Scale up cleanly to 32x32
  const out = document.createElement('canvas');
  out.width = 32;
  out.height = 32;
  const octx = out.getContext('2d')!;
  octx.imageSmoothingEnabled = false;
  octx.drawImage(c, 0, 0, 32, 32);
  return out.toDataURL();
}

export function getAtlasBundle(): AtlasBundle {
  if (cachedBundle) return cachedBundle;

  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_PX;
  canvas.height = ATLAS_PX;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, ATLAS_PX, ATLAS_PX);

  for (let i = 0; i <= TILE.OBSIDIAN; i++) {
    drawTile(ctx, i);
  }

  const opaqueTexture = new THREE.CanvasTexture(canvas);
  opaqueTexture.magFilter = THREE.NearestFilter;
  opaqueTexture.minFilter = THREE.NearestFilter;
  opaqueTexture.colorSpace = THREE.SRGBColorSpace;
  opaqueTexture.generateMipmaps = false;
  opaqueTexture.flipY = false;
  opaqueTexture.needsUpdate = true;

  const translucentTexture = new THREE.CanvasTexture(canvas);
  translucentTexture.magFilter = THREE.NearestFilter;
  translucentTexture.minFilter = THREE.NearestFilter;
  translucentTexture.colorSpace = THREE.SRGBColorSpace;
  translucentTexture.generateMipmaps = false;
  translucentTexture.flipY = false;
  translucentTexture.needsUpdate = true;

  const crackTextures = buildCrackTextures();

  // Generate UI icons for every registered item
  const itemIcons = new Map<number, string>();
  ITEM_REGISTRY.forEach((def, id) => {
    if (id === BLOCK.AIR) return;
    if (def.isBlock && def.faces && def.id < 100) {
      if (
        def.renderType === 'cross' ||
        def.renderType === 'torch' ||
        def.renderType === 'crop' ||
        def.renderType === 'wire' ||
        def.renderType === 'lever'
      ) {
        itemIcons.set(id, renderFlatTileIcon(canvas, def.faces.side));
      } else {
        itemIcons.set(
          id,
          renderIsometricBlockIcon(canvas, def.faces.top, def.faces.front ?? def.faces.side)
        );
      }
    } else {
      itemIcons.set(id, renderPixelSprite(id));
    }
  });

  cachedBundle = {
    canvas,
    opaqueTexture,
    translucentTexture,
    crackTextures,
    itemIcons,
  };
  return cachedBundle;
}

export function getItemIcon(itemId: number): string {
  return getAtlasBundle().itemIcons.get(itemId) ?? '';
}

export function getTileUVs(tileIndex: number): [number, number, number, number] {
  const col = tileIndex % ATLAS_GRID;
  const row = Math.floor(tileIndex / ATLAS_GRID);
  const step = 1 / ATLAS_GRID;
  const pad = 0.0015; // prevents texture bleeding across atlas cells
  const u0 = col * step + pad;
  const v0 = row * step + pad;
  const u1 = (col + 1) * step - pad;
  const v1 = (row + 1) * step - pad;
  return [u0, v0, u1, v1];
}
