import * as THREE from 'three';
import { BLOCK, getItemDef, isBlockSolid, isBlockTransparent } from './blocks';
import { getTileUVs } from './textures';
import { CHUNK_HEIGHT, CHUNK_SIZE, localIndex } from './worldGen';

export interface ChunkMeshResult {
  opaqueGeometry: THREE.BufferGeometry | null;
  translucentGeometry: THREE.BufferGeometry | null;
}

interface MeshBuffers {
  positions: number[];
  normals: number[];
  uvs: number[];
  colors: number[];
  indices: number[];
  vertCount: number;
}

function createBuffers(): MeshBuffers {
  return {
    positions: [],
    normals: [],
    uvs: [],
    colors: [],
    indices: [],
    vertCount: 0,
  };
}

function buildGeometry(buf: MeshBuffers): THREE.BufferGeometry | null {
  if (buf.vertCount === 0) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(buf.positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(buf.normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(buf.uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(buf.colors, 3));
  geo.setIndex(buf.indices);
  geo.computeBoundingSphere();
  return geo;
}

function pushQuad(
  buf: MeshBuffers,
  p0: [number, number, number],
  p1: [number, number, number],
  p2: [number, number, number],
  p3: [number, number, number],
  normal: [number, number, number],
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  ao0: number,
  ao1: number,
  ao2: number,
  ao3: number,
  tintR = 1,
  tintG = 1,
  tintB = 1
) {
  const base = buf.vertCount;
  buf.positions.push(...p0, ...p1, ...p2, ...p3);
  buf.normals.push(...normal, ...normal, ...normal, ...normal);
  // Standard bottom-left -> bottom-right -> top-right -> top-left UV order (flipY=false)
  buf.uvs.push(u0, v1, u1, v1, u1, v0, u0, v0);
  buf.colors.push(
    ao0 * tintR, ao0 * tintG, ao0 * tintB,
    ao1 * tintR, ao1 * tintG, ao1 * tintB,
    ao2 * tintR, ao2 * tintG, ao2 * tintB,
    ao3 * tintR, ao3 * tintG, ao3 * tintB
  );

  // Flip quad diagonal based on AO to prevent anisotropy artifacts
  if (ao0 + ao2 > ao1 + ao3) {
    buf.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  } else {
    buf.indices.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
  }
  buf.vertCount += 4;
}

function vertexAO(side1: boolean, side2: boolean, corner: boolean): number {
  if (side1 && side2) return 0.56;
  const occ = (side1 ? 1 : 0) + (side2 ? 1 : 0) + (corner ? 1 : 0);
  return 1.0 - occ * 0.145;
}

export function buildChunkMesh(
  cx: number,
  cz: number,
  blocks: Uint8Array,
  getWorldBlock: (wx: number, y: number, wz: number) => number,
  getBlockMeta?: (wx: number, y: number, wz: number) => number
): ChunkMeshResult {
  const opaque = createBuffers();
  const translucent = createBuffers();

  const baseWx = cx * CHUNK_SIZE;
  const baseWz = cz * CHUNK_SIZE;

  // Fast local lookup falling back to world lookup only on chunk boundaries
  const getB = (lx: number, y: number, lz: number): number => {
    if (y < 0 || y >= CHUNK_HEIGHT) return BLOCK.AIR;
    if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE) {
      return blocks[localIndex(lx, y, lz)];
    }
    return getWorldBlock(baseWx + lx, y, baseWz + lz);
  };

  const isOccluding = (lx: number, y: number, lz: number): boolean => {
    const id = getB(lx, y, lz);
    return id !== BLOCK.AIR && isBlockSolid(id) && !isBlockTransparent(id);
  };

  // Check if any nearby block within radius 3 emits strong light (torch, lamp, crystal)
  const localGlow = (lx: number, y: number, lz: number): [number, number, number] => {
    let glow = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dz = -2; dz <= 2; dz++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nid = getB(lx + dx, y + dy, lz + dz);
          if (nid === BLOCK.TORCH || nid === BLOCK.SPARK_LAMP_ON) {
            const dist = Math.abs(dx) + Math.abs(dy) + Math.abs(dz);
            glow = Math.max(glow, Math.max(0, 1 - dist * 0.25));
          } else if (nid === BLOCK.CRYSTAL_ORE || nid === BLOCK.ENCHANT_ALTAR || nid === BLOCK.SPARK_WIRE_ON) {
            const dist = Math.abs(dx) + Math.abs(dy) + Math.abs(dz);
            glow = Math.max(glow, Math.max(0, 0.55 - dist * 0.18));
          }
        }
      }
    }
    if (glow <= 0) return [1, 1, 1];
    return [1 + glow * 0.35, 1 + glow * 0.22, 1 + glow * 0.05];
  };

  for (let y = 0; y < CHUNK_HEIGHT; y++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const id = blocks[localIndex(lx, y, lz)];
        if (id === BLOCK.AIR) continue;

        const def = getItemDef(id);
        if (!def.faces) continue;

        const renderType = def.renderType ?? 'cube';
        const isTranslucentMesh = id === BLOCK.WATER || id === BLOCK.GLASS || id === BLOCK.ICE;
        const targetBuf = isTranslucentMesh ? translucent : opaque;

        // Non-cube custom geometries
        if (renderType === 'cross' || renderType === 'crop') {
          const [u0, v0, u1, v1] = getTileUVs(def.faces.side);
          const inset = renderType === 'crop' ? 0.08 : 0.14;
          const x0 = lx + inset;
          const x1 = lx + 1 - inset;
          const z0 = lz + inset;
          const z1 = lz + 1 - inset;
          const y0 = y;
          const y1 = y + 0.96;
          // Diagonal 1 (both sides)
          pushQuad(targetBuf, [x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0], [0.7, 0.3, -0.7], u0, v0, u1, v1, 0.95, 0.95, 1, 1);
          pushQuad(targetBuf, [x1, y0, z1], [x0, y0, z0], [x0, y1, z0], [x1, y1, z1], [-0.7, 0.3, 0.7], u0, v0, u1, v1, 0.95, 0.95, 1, 1);
          // Diagonal 2 (both sides)
          pushQuad(targetBuf, [x0, y0, z1], [x1, y0, z0], [x1, y1, z0], [x0, y1, z1], [0.7, 0.3, 0.7], u0, v0, u1, v1, 0.95, 0.95, 1, 1);
          pushQuad(targetBuf, [x1, y0, z0], [x0, y0, z1], [x0, y1, z1], [x1, y1, z0], [-0.7, 0.3, -0.7], u0, v0, u1, v1, 0.95, 0.95, 1, 1);
          continue;
        }

        if (renderType === 'torch') {
          const [u0, v0, u1, v1] = getTileUVs(def.faces.side);
          const pad = 0.42;
          const x0 = lx + pad;
          const x1 = lx + 1 - pad;
          const z0 = lz + pad;
          const z1 = lz + 1 - pad;
          const y0 = y;
          const y1 = y + 0.72;
          const glowR = 1.35;
          const glowG = 1.18;
          const glowB = 0.95;
          pushQuad(targetBuf, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], u0, v0, u1, v1, 1, 1, 1, 1, glowR, glowG, glowB);
          pushQuad(targetBuf, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], u0, v0, u1, v1, 1, 1, 1, 1, glowR, glowG, glowB);
          pushQuad(targetBuf, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], u0, v0, u1, v1, 1, 1, 1, 1, glowR, glowG, glowB);
          pushQuad(targetBuf, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], u0, v0, u1, v1, 1, 1, 1, 1, glowR, glowG, glowB);
          pushQuad(targetBuf, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], u0, v0, u1, v1, 1, 1, 1, 1, glowR, glowG, glowB);
          continue;
        }

        if (renderType === 'wire') {
          const [u0, v0, u1, v1] = getTileUVs(def.faces.top);
          const wy = y + 0.04;
          const lit = id === BLOCK.SPARK_WIRE_ON;
          const r = lit ? 1.45 : 0.9;
          const g = lit ? 0.95 : 0.7;
          const b = lit ? 0.85 : 0.7;
          pushQuad(
            targetBuf,
            [lx, wy, lz + 1],
            [lx + 1, wy, lz + 1],
            [lx + 1, wy, lz],
            [lx, wy, lz],
            [0, 1, 0],
            u0, v0, u1, v1,
            1, 1, 1, 1,
            r, g, b
          );
          continue;
        }

        if (renderType === 'lever') {
          const [u0, v0, u1, v1] = getTileUVs(def.faces.side);
          const meta = getBlockMeta ? getBlockMeta(baseWx + lx, y, baseWz + lz) : 0;
          const on = meta > 0;
          const lean = on ? 0.2 : -0.2;
          const cx0 = lx + 0.43;
          const cx1 = lx + 0.57;
          const cz0 = lz + 0.43;
          const cz1 = lz + 0.57;
          const r = on ? 1.3 : 0.95;
          const g = on ? 1.05 : 0.95;
          const b = on ? 0.85 : 0.95;
          // Base plinth
          pushQuad(targetBuf, [lx + 0.25, y + 0.18, lz + 0.75], [lx + 0.75, y + 0.18, lz + 0.75], [lx + 0.75, y + 0.18, lz + 0.25], [lx + 0.25, y + 0.18, lz + 0.25], [0, 1, 0], u0, v0, u1, v1, 0.9, 0.9, 0.9, 0.9, r, g, b);
          // Lever handle
          pushQuad(targetBuf, [cx0, y + 0.12, cz1], [cx1, y + 0.12, cz1], [cx1 + lean, y + 0.72, cz1], [cx0 + lean, y + 0.72, cz1], [0, 0, 1], u0, v0, u1, v1, 1, 1, 1, 1, r, g, b);
          pushQuad(targetBuf, [cx1, y + 0.12, cz0], [cx0, y + 0.12, cz0], [cx0 + lean, y + 0.72, cz0], [cx1 + lean, y + 0.72, cz0], [0, 0, -1], u0, v0, u1, v1, 1, 1, 1, 1, r, g, b);
          pushQuad(targetBuf, [cx1, y + 0.12, cz1], [cx1, y + 0.12, cz0], [cx1 + lean, y + 0.72, cz0], [cx1 + lean, y + 0.72, cz1], [1, 0, 0], u0, v0, u1, v1, 1, 1, 1, 1, r, g, b);
          pushQuad(targetBuf, [cx0, y + 0.12, cz0], [cx0, y + 0.12, cz1], [cx0 + lean, y + 0.72, cz1], [cx0 + lean, y + 0.72, cz0], [-1, 0, 0], u0, v0, u1, v1, 1, 1, 1, 1, r, g, b);
          continue;
        }

        // Standard Cube with face culling & AO
        const shouldDrawFace = (nx: number, ny: number, nz: number): boolean => {
          const nid = getB(nx, ny, nz);
          if (nid === BLOCK.AIR) return true;
          if (id === BLOCK.WATER) {
            return nid !== BLOCK.WATER && isBlockTransparent(nid);
          }
          if (id === BLOCK.GLASS || id === BLOCK.ICE) {
            return nid !== id && isBlockTransparent(nid);
          }
          if (id === BLOCK.OAK_LEAVES || id === BLOCK.PINE_LEAVES) {
            return isBlockTransparent(nid);
          }
          return isBlockTransparent(nid);
        };

        const isWaterTop = id === BLOCK.WATER && getB(lx, y + 1, lz) === BLOCK.AIR;
        const topY = isWaterTop ? y + 0.88 : y + 1;
        const isSelfLit = (def.lightLevel ?? 0) >= 8;
        const [tr, tg, tb] = isSelfLit ? [1.3, 1.22, 1.08] : localGlow(lx, y, lz);

        // +Y (Top)
        if (shouldDrawFace(lx, y + 1, lz)) {
          const [u0, v0, u1, v1] = getTileUVs(def.faces.top);
          const shade = 1.0;
          const ao0 = isTranslucentMesh ? shade : shade * vertexAO(isOccluding(lx - 1, y + 1, lz), isOccluding(lx, y + 1, lz + 1), isOccluding(lx - 1, y + 1, lz + 1));
          const ao1 = isTranslucentMesh ? shade : shade * vertexAO(isOccluding(lx + 1, y + 1, lz), isOccluding(lx, y + 1, lz + 1), isOccluding(lx + 1, y + 1, lz + 1));
          const ao2 = isTranslucentMesh ? shade : shade * vertexAO(isOccluding(lx + 1, y + 1, lz), isOccluding(lx, y + 1, lz - 1), isOccluding(lx + 1, y + 1, lz - 1));
          const ao3 = isTranslucentMesh ? shade : shade * vertexAO(isOccluding(lx - 1, y + 1, lz), isOccluding(lx, y + 1, lz - 1), isOccluding(lx - 1, y + 1, lz - 1));
          pushQuad(
            targetBuf,
            [lx, topY, lz + 1],
            [lx + 1, topY, lz + 1],
            [lx + 1, topY, lz],
            [lx, topY, lz],
            [0, 1, 0],
            u0, v0, u1, v1,
            ao0, ao1, ao2, ao3,
            tr, tg, tb
          );
        }

        // -Y (Bottom)
        if (shouldDrawFace(lx, y - 1, lz)) {
          const [u0, v0, u1, v1] = getTileUVs(def.faces.bottom);
          const shade = 0.6;
          const ao0 = isTranslucentMesh ? shade : shade * vertexAO(isOccluding(lx - 1, y - 1, lz), isOccluding(lx, y - 1, lz - 1), isOccluding(lx - 1, y - 1, lz - 1));
          const ao1 = isTranslucentMesh ? shade : shade * vertexAO(isOccluding(lx + 1, y - 1, lz), isOccluding(lx, y - 1, lz - 1), isOccluding(lx + 1, y - 1, lz - 1));
          const ao2 = isTranslucentMesh ? shade : shade * vertexAO(isOccluding(lx + 1, y - 1, lz), isOccluding(lx, y - 1, lz + 1), isOccluding(lx + 1, y - 1, lz + 1));
          const ao3 = isTranslucentMesh ? shade : shade * vertexAO(isOccluding(lx - 1, y - 1, lz), isOccluding(lx, y - 1, lz + 1), isOccluding(lx - 1, y - 1, lz + 1));
          pushQuad(
            targetBuf,
            [lx, y, lz],
            [lx + 1, y, lz],
            [lx + 1, y, lz + 1],
            [lx, y, lz + 1],
            [0, -1, 0],
            u0, v0, u1, v1,
            ao0, ao1, ao2, ao3,
            tr, tg, tb
          );
        }

        // +Z (South / Front)
        if (shouldDrawFace(lx, y, lz + 1)) {
          const tile = def.faces.front ?? def.faces.side;
          const [u0, v0, u1, v1] = getTileUVs(tile);
          const shade = 0.88;
          const ao0 = isTranslucentMesh ? shade : shade * vertexAO(isOccluding(lx - 1, y, lz + 1), isOccluding(lx, y - 1, lz + 1), isOccluding(lx - 1, y - 1, lz + 1));
          const ao1 = isTranslucentMesh ? shade : shade * vertexAO(isOccluding(lx + 1, y, lz + 1), isOccluding(lx, y - 1, lz + 1), isOccluding(lx + 1, y - 1, lz + 1));
          const ao2 = isTranslucentMesh ? shade : shade * vertexAO(isOccluding(lx + 1, y, lz + 1), isOccluding(lx, y + 1, lz + 1), isOccluding(lx + 1, y + 1, lz + 1));
          const ao3 = isTranslucentMesh ? shade : shade * vertexAO(isOccluding(lx - 1, y, lz + 1), isOccluding(lx, y + 1, lz + 1), isOccluding(lx - 1, y + 1, lz + 1));
          pushQuad(
            targetBuf,
            [lx, y, lz + 1],
            [lx + 1, y, lz + 1],
            [lx + 1, topY, lz + 1],
            [lx, topY, lz + 1],
            [0, 0, 1],
            u0, v0, u1, v1,
            ao0, ao1, ao2, ao3,
            tr, tg, tb
          );
        }

        // -Z (North / Back)
        if (shouldDrawFace(lx, y, lz - 1)) {
          const [u0, v0, u1, v1] = getTileUVs(def.faces.side);
          const shade = 0.85;
          const ao0 = isTranslucentMesh ? shade : shade * vertexAO(isOccluding(lx + 1, y, lz - 1), isOccluding(lx, y - 1, lz - 1), isOccluding(lx + 1, y - 1, lz - 1));
          const ao1 = isTranslucentMesh ? shade : shade * vertexAO(isOccluding(lx - 1, y, lz - 1), isOccluding(lx, y - 1, lz - 1), isOccluding(lx - 1, y - 1, lz - 1));
          const ao2 = isTranslucentMesh ? shade : shade * vertexAO(isOccluding(lx - 1, y, lz - 1), isOccluding(lx, y + 1, lz - 1), isOccluding(lx - 1, y + 1, lz - 1));
          const ao3 = isTranslucentMesh ? shade : shade * vertexAO(isOccluding(lx + 1, y, lz - 1), isOccluding(lx, y + 1, lz - 1), isOccluding(lx + 1, y + 1, lz - 1));
          pushQuad(
            targetBuf,
            [lx + 1, y, lz],
            [lx, y, lz],
            [lx, topY, lz],
            [lx + 1, topY, lz],
            [0, 0, -1],
            u0, v0, u1, v1,
            ao0, ao1, ao2, ao3,
            tr, tg, tb
          );
        }

        // +X (East)
        if (shouldDrawFace(lx + 1, y, lz)) {
          const [u0, v0, u1, v1] = getTileUVs(def.faces.side);
          const shade = 0.78;
          const ao0 = isTranslucentMesh ? shade : shade * vertexAO(isOccluding(lx + 1, y, lz + 1), isOccluding(lx + 1, y - 1, lz), isOccluding(lx + 1, y - 1, lz + 1));
          const ao1 = isTranslucentMesh ? shade : shade * vertexAO(isOccluding(lx + 1, y, lz - 1), isOccluding(lx + 1, y - 1, lz), isOccluding(lx + 1, y - 1, lz - 1));
          const ao2 = isTranslucentMesh ? shade : shade * vertexAO(isOccluding(lx + 1, y, lz - 1), isOccluding(lx + 1, y + 1, lz), isOccluding(lx + 1, y + 1, lz - 1));
          const ao3 = isTranslucentMesh ? shade : shade * vertexAO(isOccluding(lx + 1, y, lz + 1), isOccluding(lx + 1, y + 1, lz), isOccluding(lx + 1, y + 1, lz + 1));
          pushQuad(
            targetBuf,
            [lx + 1, y, lz + 1],
            [lx + 1, y, lz],
            [lx + 1, topY, lz],
            [lx + 1, topY, lz + 1],
            [1, 0, 0],
            u0, v0, u1, v1,
            ao0, ao1, ao2, ao3,
            tr, tg, tb
          );
        }

        // -X (West)
        if (shouldDrawFace(lx - 1, y, lz)) {
          const [u0, v0, u1, v1] = getTileUVs(def.faces.side);
          const shade = 0.74;
          const ao0 = isTranslucentMesh ? shade : shade * vertexAO(isOccluding(lx - 1, y, lz - 1), isOccluding(lx - 1, y - 1, lz), isOccluding(lx - 1, y - 1, lz - 1));
          const ao1 = isTranslucentMesh ? shade : shade * vertexAO(isOccluding(lx - 1, y, lz + 1), isOccluding(lx - 1, y - 1, lz), isOccluding(lx - 1, y - 1, lz + 1));
          const ao2 = isTranslucentMesh ? shade : shade * vertexAO(isOccluding(lx - 1, y, lz + 1), isOccluding(lx - 1, y + 1, lz), isOccluding(lx - 1, y + 1, lz + 1));
          const ao3 = isTranslucentMesh ? shade : shade * vertexAO(isOccluding(lx - 1, y, lz - 1), isOccluding(lx - 1, y + 1, lz), isOccluding(lx - 1, y + 1, lz - 1));
          pushQuad(
            targetBuf,
            [lx, y, lz],
            [lx, y, lz + 1],
            [lx, topY, lz + 1],
            [lx, topY, lz],
            [-1, 0, 0],
            u0, v0, u1, v1,
            ao0, ao1, ao2, ao3,
            tr, tg, tb
          );
        }
      }
    }
  }

  return {
    opaqueGeometry: buildGeometry(opaque),
    translucentGeometry: buildGeometry(translucent),
  };
}
