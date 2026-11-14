import * as THREE from 'three';
import { BLOCK, isBlockSolid } from './blocks';
import { buildChunkMesh } from './chunkMesher';
import { getAtlasBundle } from './textures';
import { BiomeType } from './types';
import { CHUNK_HEIGHT, CHUNK_SIZE, localIndex, WorldGenerator } from './worldGen';

export interface LoadedChunk {
  cx: number;
  cz: number;
  key: string;
  blocks: Uint8Array;
  opaqueMesh: THREE.Mesh | null;
  translucentMesh: THREE.Mesh | null;
  dirty: boolean;
}

export function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

export function blockKey(wx: number, y: number, wz: number): string {
  return `${wx},${y},${wz}`;
}

export class ChunkManager {
  public readonly generator: WorldGenerator;
  public readonly chunks: Map<string, LoadedChunk> = new Map();
  public readonly modifiedBlocks: Map<string, number> = new Map();
  private readonly chunkModsIndex: Map<string, Map<number, number>> = new Map();
  public readonly blockMeta: Map<string, number> = new Map();

  private readonly scene: THREE.Scene;
  private readonly opaqueMat: THREE.MeshLambertMaterial;
  private readonly translucentMat: THREE.MeshLambertMaterial;

  // Track active farmland & crop coordinates for fast lightweight ticks
  private readonly farmedCoords: Set<string> = new Set();
  private readonly sparkCoords: Set<string> = new Set();
  private farmTickTimer = 0;

  constructor(
    scene: THREE.Scene,
    seed: string,
    initialMods?: Record<string, number>,
    initialMeta?: Record<string, number>
  ) {
    this.scene = scene;
    this.generator = new WorldGenerator(seed);

    const atlas = getAtlasBundle();
    this.opaqueMat = new THREE.MeshLambertMaterial({
      map: atlas.opaqueTexture,
      vertexColors: true,
      alphaTest: 0.45,
      side: THREE.FrontSide,
    });
    this.translucentMat = new THREE.MeshLambertMaterial({
      map: atlas.translucentTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    if (initialMods) {
      for (const [k, v] of Object.entries(initialMods)) {
        this.modifiedBlocks.set(k, v);
        const [wx, y, wz] = k.split(',').map(Number);
        if (Number.isFinite(wx) && Number.isFinite(y) && Number.isFinite(wz)) {
          this.indexMod(wx, y, wz, v);
        }
        if (
          v === BLOCK.FARMLAND ||
          v === BLOCK.FARMLAND_WET ||
          v === BLOCK.WHEAT_1 ||
          v === BLOCK.WHEAT_2
        ) {
          this.farmedCoords.add(k);
        }
        if (
          v === BLOCK.SPARK_LEVER ||
          v === BLOCK.SPARK_WIRE ||
          v === BLOCK.SPARK_WIRE_ON ||
          v === BLOCK.SPARK_LAMP ||
          v === BLOCK.SPARK_LAMP_ON
        ) {
          this.sparkCoords.add(k);
        }
      }
    }

    if (initialMeta) {
      for (const [k, v] of Object.entries(initialMeta)) {
        this.blockMeta.set(k, v);
      }
    }
  }

  public getWorldCoordsChunk(wx: number, wz: number): [number, number] {
    return [Math.floor(wx / CHUNK_SIZE), Math.floor(wz / CHUNK_SIZE)];
  }

  public getBlock(wx: number, y: number, wz: number): number {
    if (y < 0 || y >= CHUNK_HEIGHT) return BLOCK.AIR;
    const fx = Math.floor(wx);
    const fy = Math.floor(y);
    const fz = Math.floor(wz);
    const cx = Math.floor(fx / CHUNK_SIZE);
    const cz = Math.floor(fz / CHUNK_SIZE);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk) {
      const mod = this.modifiedBlocks.get(blockKey(fx, fy, fz));
      return mod !== undefined ? mod : BLOCK.AIR;
    }
    const lx = ((fx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((fz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return chunk.blocks[localIndex(lx, fy, lz)];
  }

  public getMeta(wx: number, y: number, wz: number): number {
    return this.blockMeta.get(blockKey(Math.floor(wx), Math.floor(y), Math.floor(wz))) ?? 0;
  }

  public setMeta(wx: number, y: number, wz: number, value: number) {
    const fx = Math.floor(wx);
    const fy = Math.floor(y);
    const fz = Math.floor(wz);
    const k = blockKey(fx, fy, fz);
    if (value === 0) this.blockMeta.delete(k);
    else this.blockMeta.set(k, value);
    this.markDirtyAround(fx, fz);
  }

  public setBlock(wx: number, y: number, wz: number, blockId: number, recordMod = true): boolean {
    const fx = Math.floor(wx);
    const fy = Math.floor(y);
    const fz = Math.floor(wz);
    if (fy < 0 || fy >= CHUNK_HEIGHT) return false;

    const k = blockKey(fx, fy, fz);
    if (recordMod) {
      this.modifiedBlocks.set(k, blockId);
      this.indexMod(fx, fy, fz, blockId);
    }

    // Track farming & sparkstone coordinates
    if (
      blockId === BLOCK.FARMLAND ||
      blockId === BLOCK.FARMLAND_WET ||
      blockId === BLOCK.WHEAT_1 ||
      blockId === BLOCK.WHEAT_2
    ) {
      this.farmedCoords.add(k);
    } else {
      this.farmedCoords.delete(k);
    }

    if (
      blockId === BLOCK.SPARK_LEVER ||
      blockId === BLOCK.SPARK_WIRE ||
      blockId === BLOCK.SPARK_WIRE_ON ||
      blockId === BLOCK.SPARK_LAMP ||
      blockId === BLOCK.SPARK_LAMP_ON
    ) {
      this.sparkCoords.add(k);
    } else {
      this.sparkCoords.delete(k);
    }

    if (blockId === BLOCK.AIR) {
      this.blockMeta.delete(k);
    }

    const cx = Math.floor(fx / CHUNK_SIZE);
    const cz = Math.floor(fz / CHUNK_SIZE);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (chunk) {
      const lx = ((fx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const lz = ((fz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      chunk.blocks[localIndex(lx, fy, lz)] = blockId;
      this.markDirtyAround(fx, fz);
    }
    return true;
  }

  public markDirtyAround(wx: number, wz: number) {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

    const mark = (x: number, z: number) => {
      const c = this.chunks.get(chunkKey(x, z));
      if (c) c.dirty = true;
    };

    mark(cx, cz);
    if (lx <= 1) mark(cx - 1, cz);
    if (lx >= CHUNK_SIZE - 2) mark(cx + 1, cz);
    if (lz <= 1) mark(cx, cz - 1);
    if (lz >= CHUNK_SIZE - 2) mark(cx, cz + 1);
  }

  public getSurfaceY(wx: number, wz: number): number {
    const fx = Math.floor(wx);
    const fz = Math.floor(wz);
    const [cx, cz] = this.getWorldCoordsChunk(fx, fz);
    if (this.chunks.has(chunkKey(cx, cz))) {
      for (let y = CHUNK_HEIGHT - 2; y >= 1; y--) {
        if (isBlockSolid(this.getBlock(fx, y, fz))) {
          return y + 1;
        }
      }
    }
    return this.generator.getTerrainHeight(fx, fz).height + 1;
  }

  public getBiomeAt(wx: number, wz: number): BiomeType {
    return this.generator.getBiome(Math.floor(wx), Math.floor(wz));
  }

  /**
   * Loads missing chunks around player, unloads distant chunks, and meshes dirty chunks
   * within a smooth per-frame budget so exploration stays fluid.
   */
  public updateStreaming(
    playerX: number,
    playerZ: number,
    renderDistance: number,
    immediateBootstrap = false
  ) {
    const pcx = Math.floor(playerX / CHUNK_SIZE);
    const pcz = Math.floor(playerZ / CHUNK_SIZE);
    const unloadDist = renderDistance + 2;

    // 1. Unload far chunks
    for (const [key, chunk] of this.chunks.entries()) {
      if (
        Math.abs(chunk.cx - pcx) > unloadDist ||
        Math.abs(chunk.cz - pcz) > unloadDist
      ) {
        this.disposeChunkMeshes(chunk);
        this.chunks.delete(key);
      }
    }

    // 2. Collect missing chunks sorted closest-first
    const needed: { cx: number; cz: number; dist: number }[] = [];
    for (let dz = -renderDistance; dz <= renderDistance; dz++) {
      for (let dx = -renderDistance; dx <= renderDistance; dx++) {
        if (dx * dx + dz * dz > (renderDistance + 0.5) * (renderDistance + 0.5)) continue;
        const cx = pcx + dx;
        const cz = pcz + dz;
        if (!this.chunks.has(chunkKey(cx, cz))) {
          needed.push({ cx, cz, dist: dx * dx + dz * dz });
        }
      }
    }
    needed.sort((a, b) => a.dist - b.dist);

    const genBudget = immediateBootstrap ? 16 : 2;
    for (let i = 0; i < Math.min(genBudget, needed.length); i++) {
      const { cx, cz } = needed[i];
      this.loadChunkData(cx, cz);
    }

    // 3. Rebuild dirty chunks (closest first)
    const dirtyList: { chunk: LoadedChunk; dist: number }[] = [];
    for (const chunk of this.chunks.values()) {
      if (chunk.dirty) {
        const dx = chunk.cx - pcx;
        const dz = chunk.cz - pcz;
        dirtyList.push({ chunk, dist: dx * dx + dz * dz });
      }
    }
    dirtyList.sort((a, b) => a.dist - b.dist);

    const meshBudget = immediateBootstrap ? 16 : 3;
    for (let i = 0; i < Math.min(meshBudget, dirtyList.length); i++) {
      this.rebuildChunkMesh(dirtyList[i].chunk);
    }
  }

  public rebuildImmediateAt(wx: number, wz: number) {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const c = this.chunks.get(chunkKey(cx + dx, cz + dz));
        if (c && c.dirty) {
          this.rebuildChunkMesh(c);
        }
      }
    }
  }

  private indexMod(wx: number, y: number, wz: number, blockId: number) {
    if (y < 0 || y >= CHUNK_HEIGHT) return;
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const ck = chunkKey(cx, cz);
    let bucket = this.chunkModsIndex.get(ck);
    if (!bucket) {
      bucket = new Map();
      this.chunkModsIndex.set(ck, bucket);
    }
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    bucket.set(localIndex(lx, y, lz), blockId);
  }

  private loadChunkData(cx: number, cz: number) {
    const blocks = this.generator.generateChunkData(cx, cz);
    const ck = chunkKey(cx, cz);
    const bucket = this.chunkModsIndex.get(ck);
    if (bucket) {
      bucket.forEach((blockId, idx) => {
        blocks[idx] = blockId;
      });
    }

    const key = chunkKey(cx, cz);
    const chunk: LoadedChunk = {
      cx,
      cz,
      key,
      blocks,
      opaqueMesh: null,
      translucentMesh: null,
      dirty: true,
    };
    this.chunks.set(key, chunk);

    // Mark adjacent already-loaded chunks dirty so chunk-seam faces cull cleanly
    const neighbors = [
      [cx - 1, cz],
      [cx + 1, cz],
      [cx, cz - 1],
      [cx, cz + 1],
    ];
    for (const [nx, nz] of neighbors) {
      const nc = this.chunks.get(chunkKey(nx, nz));
      if (nc) nc.dirty = true;
    }
  }

  private rebuildChunkMesh(chunk: LoadedChunk) {
    this.disposeChunkMeshes(chunk);

    const { opaqueGeometry, translucentGeometry } = buildChunkMesh(
      chunk.cx,
      chunk.cz,
      chunk.blocks,
      (wx, y, wz) => this.getBlock(wx, y, wz),
      (wx, y, wz) => this.getMeta(wx, y, wz)
    );

    const px = chunk.cx * CHUNK_SIZE;
    const pz = chunk.cz * CHUNK_SIZE;

    if (opaqueGeometry) {
      const mesh = new THREE.Mesh(opaqueGeometry, this.opaqueMat);
      mesh.position.set(px, 0, pz);
      mesh.frustumCulled = true;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.scene.add(mesh);
      chunk.opaqueMesh = mesh;
    }

    if (translucentGeometry) {
      const mesh = new THREE.Mesh(translucentGeometry, this.translucentMat);
      mesh.position.set(px, 0, pz);
      mesh.frustumCulled = true;
      mesh.renderOrder = 2;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.scene.add(mesh);
      chunk.translucentMesh = mesh;
    }

    chunk.dirty = false;
  }

  private disposeChunkMeshes(chunk: LoadedChunk) {
    if (chunk.opaqueMesh) {
      this.scene.remove(chunk.opaqueMesh);
      chunk.opaqueMesh.geometry.dispose();
      chunk.opaqueMesh = null;
    }
    if (chunk.translucentMesh) {
      this.scene.remove(chunk.translucentMesh);
      chunk.translucentMesh.geometry.dispose();
      chunk.translucentMesh = null;
    }
  }

  /**
   * Simulates farmland irrigation and wheat crop growth.
   */
  public tickFarming(dt: number, isRaining: boolean) {
    this.farmTickTimer += dt;
    if (this.farmTickTimer < 2.2) return;
    this.farmTickTimer = 0;

    const coords = Array.from(this.farmedCoords);
    for (const k of coords) {
      const [wx, y, wz] = k.split(',').map(Number);
      const id = this.getBlock(wx, y, wz);

      if (id === BLOCK.FARMLAND || id === BLOCK.FARMLAND_WET) {
        let nearWater = isRaining;
        if (!nearWater) {
          outer: for (let dx = -4; dx <= 4; dx++) {
            for (let dz = -4; dz <= 4; dz++) {
              for (let dy = 0; dy <= 1; dy++) {
                if (this.getBlock(wx + dx, y + dy, wz + dz) === BLOCK.WATER) {
                  nearWater = true;
                  break outer;
                }
              }
            }
          }
        }
        if (nearWater && id === BLOCK.FARMLAND) {
          this.setBlock(wx, y, wz, BLOCK.FARMLAND_WET, true);
        } else if (!nearWater && id === BLOCK.FARMLAND_WET) {
          this.setBlock(wx, y, wz, BLOCK.FARMLAND, true);
        }
      } else if (id === BLOCK.WHEAT_1 || id === BLOCK.WHEAT_2) {
        const below = this.getBlock(wx, y - 1, wz);
        const wet = below === BLOCK.FARMLAND_WET;
        const chance = wet ? 0.24 : 0.08;
        if (Math.random() < chance) {
          const nextStage = id === BLOCK.WHEAT_1 ? BLOCK.WHEAT_2 : BLOCK.WHEAT_3;
          this.setBlock(wx, y, wz, nextStage, true);
        }
      }
    }
  }

  /**
   * Re-evaluates all Sparkstone wires and lamps connected to active Sparkstone Levers via BFS.
   */
  public propagateSparkstone() {
    if (this.sparkCoords.size === 0) return;

    const powered = new Set<string>();
    const queue: { x: number; y: number; z: number; power: number }[] = [];

    // Seed from all ON levers
    for (const k of this.sparkCoords) {
      const [wx, y, wz] = k.split(',').map(Number);
      const id = this.getBlock(wx, y, wz);
      if (id === BLOCK.SPARK_LEVER && this.getMeta(wx, y, wz) > 0) {
        powered.add(k);
        queue.push({ x: wx, y, z: wz, power: 12 });
      }
    }

    const dirs = [
      [1, 0, 0], [-1, 0, 0],
      [0, 1, 0], [0, -1, 0],
      [0, 0, 1], [0, 0, -1],
    ];

    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (cur.power <= 0) continue;
      for (const [dx, dy, dz] of dirs) {
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        const nz = cur.z + dz;
        const nk = blockKey(nx, ny, nz);
        if (powered.has(nk)) continue;
        const nid = this.getBlock(nx, ny, nz);
        if (
          nid === BLOCK.SPARK_WIRE ||
          nid === BLOCK.SPARK_WIRE_ON ||
          nid === BLOCK.SPARK_LAMP ||
          nid === BLOCK.SPARK_LAMP_ON
        ) {
          powered.add(nk);
          if (nid === BLOCK.SPARK_WIRE || nid === BLOCK.SPARK_WIRE_ON) {
            queue.push({ x: nx, y: ny, z: nz, power: cur.power - 1 });
          }
        }
      }
    }

    // Update wire and lamp states
    for (const k of Array.from(this.sparkCoords)) {
      const [wx, y, wz] = k.split(',').map(Number);
      const id = this.getBlock(wx, y, wz);
      const isLit = powered.has(k);
      if (id === BLOCK.SPARK_WIRE && isLit) {
        this.setBlock(wx, y, wz, BLOCK.SPARK_WIRE_ON, true);
      } else if (id === BLOCK.SPARK_WIRE_ON && !isLit) {
        this.setBlock(wx, y, wz, BLOCK.SPARK_WIRE, true);
      } else if (id === BLOCK.SPARK_LAMP && isLit) {
        this.setBlock(wx, y, wz, BLOCK.SPARK_LAMP_ON, true);
      } else if (id === BLOCK.SPARK_LAMP_ON && !isLit) {
        this.setBlock(wx, y, wz, BLOCK.SPARK_LAMP, true);
      }
    }
  }

  public serializeModifications(): {
    modifiedBlocks: Record<string, number>;
    blockMeta: Record<string, number>;
  } {
    const modifiedBlocks: Record<string, number> = {};
    this.modifiedBlocks.forEach((v, k) => {
      modifiedBlocks[k] = v;
    });
    const blockMeta: Record<string, number> = {};
    this.blockMeta.forEach((v, k) => {
      blockMeta[k] = v;
    });
    return { modifiedBlocks, blockMeta };
  }

  public disposeAll() {
    for (const chunk of this.chunks.values()) {
      this.disposeChunkMeshes(chunk);
    }
    this.chunks.clear();
    this.opaqueMat.dispose();
    this.translucentMat.dispose();
  }
}
