import { BLOCK, isBlockLiquid, isBlockSolid } from './blocks';

export interface AABB {
  x: number;
  y: number; // feet Y
  z: number;
  halfW: number;
  height: number;
}

export interface MoveResult {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  onGround: boolean;
  hitCeiling: boolean;
  inWater: boolean;
  headInWater: boolean;
}

export interface VoxelRaycastHit {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  blockId: number;
  distance: number;
}

export type BlockGetter = (wx: number, y: number, wz: number) => number;

export function collidesWithWorld(box: AABB, getBlock: BlockGetter): boolean {
  const minX = Math.floor(box.x - box.halfW);
  const maxX = Math.floor(box.x + box.halfW);
  const minY = Math.floor(box.y);
  const maxY = Math.floor(box.y + box.height - 0.001);
  const minZ = Math.floor(box.z - box.halfW);
  const maxZ = Math.floor(box.z + box.halfW);

  for (let y = minY; y <= maxY; y++) {
    for (let z = minZ; z <= maxZ; z++) {
      for (let x = minX; x <= maxX; x++) {
        if (isBlockSolid(getBlock(x, y, z))) {
          return true;
        }
      }
    }
  }
  return false;
}

export function blockIntersectsPlayer(
  bx: number,
  by: number,
  bz: number,
  playerBox: AABB
): boolean {
  const pMinX = playerBox.x - playerBox.halfW;
  const pMaxX = playerBox.x + playerBox.halfW;
  const pMinY = playerBox.y;
  const pMaxY = playerBox.y + playerBox.height;
  const pMinZ = playerBox.z - playerBox.halfW;
  const pMaxZ = playerBox.z + playerBox.halfW;

  return (
    bx + 1 > pMinX &&
    bx < pMaxX &&
    by + 1 > pMinY &&
    by < pMaxY &&
    bz + 1 > pMinZ &&
    bz < pMaxZ
  );
}

/**
 * Axis-separated AABB collision step with sneak ledge protection.
 */
export function stepPhysics(
  box: AABB,
  vx: number,
  vy: number,
  vz: number,
  dt: number,
  getBlock: BlockGetter,
  preventLedgeDrop = false,
  noClip = false
): MoveResult {
  const res: MoveResult = {
    x: box.x,
    y: box.y,
    z: box.z,
    vx,
    vy,
    vz,
    onGround: false,
    hitCeiling: false,
    inWater: false,
    headInWater: false,
  };

  if (noClip) {
    res.x += vx * dt;
    res.y += vy * dt;
    res.z += vz * dt;
    return res;
  }

  // Check if currently grounded before horizontal move (for sneak edge guard)
  const wasGrounded = collidesWithWorld(
    { ...box, y: box.y - 0.06 },
    getBlock
  );

  // 1. Move X
  const nextX = res.x + vx * dt;
  const testX: AABB = { ...box, x: nextX, y: res.y, z: res.z };
  if (collidesWithWorld(testX, getBlock)) {
    res.vx = 0;
  } else if (
    preventLedgeDrop &&
    wasGrounded &&
    !collidesWithWorld({ ...testX, y: res.y - 0.35 }, getBlock)
  ) {
    res.vx = 0;
  } else {
    res.x = nextX;
  }

  // 2. Move Z
  const nextZ = res.z + vz * dt;
  const testZ: AABB = { ...box, x: res.x, y: res.y, z: nextZ };
  if (collidesWithWorld(testZ, getBlock)) {
    res.vz = 0;
  } else if (
    preventLedgeDrop &&
    wasGrounded &&
    !collidesWithWorld({ ...testZ, y: res.y - 0.35 }, getBlock)
  ) {
    res.vz = 0;
  } else {
    res.z = nextZ;
  }

  // 3. Move Y
  const nextY = res.y + vy * dt;
  const testY: AABB = { ...box, x: res.x, y: nextY, z: res.z };
  if (collidesWithWorld(testY, getBlock)) {
    if (vy < 0) {
      // Snap cleanly onto block top
      res.y = Math.floor(nextY) + 1.0001;
      res.onGround = true;
    } else if (vy > 0) {
      res.hitCeiling = true;
    }
    res.vy = 0;
  } else {
    res.y = nextY;
  }

  // Re-verify ground contact
  if (!res.onGround && res.vy <= 0) {
    res.onGround = collidesWithWorld(
      { ...box, x: res.x, y: res.y - 0.05, z: res.z },
      getBlock
    );
  }

  // Check water submersion
  const feetBlock = getBlock(Math.floor(res.x), Math.floor(res.y + 0.3), Math.floor(res.z));
  const headBlock = getBlock(Math.floor(res.x), Math.floor(res.y + box.height - 0.18), Math.floor(res.z));
  res.inWater = isBlockLiquid(feetBlock) || isBlockLiquid(headBlock);
  res.headInWater = isBlockLiquid(headBlock);

  return res;
}

/**
 * Fast 3D DDA Voxel Raycast (Amanatides & Woo).
 */
export function raycastVoxels(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxDist: number,
  getBlock: BlockGetter
): VoxelRaycastHit | null {
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-6) return null;
  dx /= len;
  dy /= len;
  dz /= len;

  let x = Math.floor(ox);
  let y = Math.floor(oy);
  let z = Math.floor(oz);

  const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;
  const stepZ = dz > 0 ? 1 : dz < 0 ? -1 : 0;

  const tDeltaX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
  const tDeltaY = dy !== 0 ? Math.abs(1 / dy) : Infinity;
  const tDeltaZ = dz !== 0 ? Math.abs(1 / dz) : Infinity;

  let tMaxX =
    dx > 0 ? (x + 1 - ox) * tDeltaX : dx < 0 ? (ox - x) * tDeltaX : Infinity;
  let tMaxY =
    dy > 0 ? (y + 1 - oy) * tDeltaY : dy < 0 ? (oy - y) * tDeltaY : Infinity;
  let tMaxZ =
    dz > 0 ? (z + 1 - oz) * tDeltaZ : dz < 0 ? (oz - z) * tDeltaZ : Infinity;

  let dist = 0;
  let nx = 0;
  let ny = 0;
  let nz = 0;

  for (let i = 0; i < 64; i++) {
    const id = getBlock(x, y, z);
    if (id !== BLOCK.AIR && id !== BLOCK.WATER) {
      return { x, y, z, nx, ny, nz, blockId: id, distance: dist };
    }

    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      dist = tMaxX;
      if (dist > maxDist) break;
      x += stepX;
      tMaxX += tDeltaX;
      nx = -stepX;
      ny = 0;
      nz = 0;
    } else if (tMaxY < tMaxZ) {
      dist = tMaxY;
      if (dist > maxDist) break;
      y += stepY;
      tMaxY += tDeltaY;
      nx = 0;
      ny = -stepY;
      nz = 0;
    } else {
      dist = tMaxZ;
      if (dist > maxDist) break;
      z += stepZ;
      tMaxZ += tDeltaZ;
      nx = 0;
      ny = 0;
      nz = -stepZ;
    }
  }

  return null;
}
