import * as THREE from 'three';
import { BLOCK, ITEM } from './blocks';
import { BlockGetter, stepPhysics } from './physics';
import { EntityKind, GameMode } from './types';

export interface WorldEntity {
  id: string;
  kind: EntityKind;
  name: string;
  hostile: boolean;
  isBoss: boolean;
  isNpc: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  halfW: number;
  height: number;
  hp: number;
  maxHp: number;
  speed: number;
  attackDamage: number;
  attackCooldown: number;
  aiTimer: number;
  walkPhase: number;
  hurtFlash: number;
  wanderDirX: number;
  wanderDirZ: number;
  fleeTimer: number;
  mesh: THREE.Group;
  limbs: THREE.Object3D[];
}

export interface DroppedItem {
  id: string;
  itemId: number;
  count: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  mesh: THREE.Mesh;
}

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  mesh: THREE.Mesh;
}

interface Projectile {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  damage: number;
  life: number;
  mesh: THREE.Mesh;
}

export interface EntityCallbacks {
  onPlayerDamaged: (amount: number, sourceName: string) => void;
  onItemPickedUp: (itemId: number, count: number) => boolean;
  onEntityKilled: (entity: WorldEntity) => void;
  onBossSpawned: (name: string) => void;
}

const SHARED_BOX = new THREE.BoxGeometry(1, 1, 1);

function makePart(
  w: number,
  h: number,
  d: number,
  color: number,
  x: number,
  y: number,
  z: number,
  emissive = 0x000000
): THREE.Mesh {
  const mat = new THREE.MeshLambertMaterial({
    color,
    emissive,
    emissiveIntensity: emissive ? 0.85 : 0,
  });
  const mesh = new THREE.Mesh(SHARED_BOX, mat);
  mesh.scale.set(w, h, d);
  mesh.position.set(x, y, z);
  return mesh;
}

function buildCreatureMesh(kind: EntityKind): { group: THREE.Group; limbs: THREE.Object3D[] } {
  const group = new THREE.Group();
  const limbs: THREE.Object3D[] = [];

  if (kind === 'sheep') {
    group.add(makePart(0.85, 0.65, 1.15, 0xf1f5f9, 0, 0.72, 0)); // fleece body
    group.add(makePart(0.46, 0.44, 0.52, 0x334155, 0, 0.92, 0.72)); // head
    group.add(makePart(0.08, 0.08, 0.05, 0xffffff, -0.12, 0.98, 0.98));
    group.add(makePart(0.08, 0.08, 0.05, 0xffffff, 0.12, 0.98, 0.98));
    const legPos = [
      [-0.25, 0.25, 0.36],
      [0.25, 0.25, 0.36],
      [-0.25, 0.25, -0.36],
      [0.25, 0.25, -0.36],
    ];
    for (const [lx, ly, lz] of legPos) {
      const leg = makePart(0.2, 0.5, 0.2, 0x334155, lx, ly, lz);
      group.add(leg);
      limbs.push(leg);
    }
  } else if (kind === 'boar') {
    group.add(makePart(0.75, 0.55, 1.05, 0x854d27, 0, 0.6, 0));
    group.add(makePart(0.48, 0.42, 0.46, 0x6b3b1c, 0, 0.72, 0.66));
    group.add(makePart(0.26, 0.18, 0.16, 0xd69e85, 0, 0.64, 0.92)); // snout
    group.add(makePart(0.06, 0.16, 0.06, 0xfef9c3, -0.16, 0.64, 0.92)); // tusks
    group.add(makePart(0.06, 0.16, 0.06, 0xfef9c3, 0.16, 0.64, 0.92));
    const legPos = [
      [-0.22, 0.2, 0.32],
      [0.22, 0.2, 0.32],
      [-0.22, 0.2, -0.32],
      [0.22, 0.2, -0.32],
    ];
    for (const [lx, ly, lz] of legPos) {
      const leg = makePart(0.18, 0.4, 0.18, 0x45220e, lx, ly, lz);
      group.add(leg);
      limbs.push(leg);
    }
  } else if (kind === 'stag') {
    group.add(makePart(0.65, 0.6, 1.2, 0xa16207, 0, 0.95, 0));
    group.add(makePart(0.32, 0.6, 0.32, 0xa16207, 0, 1.32, 0.55)); // neck
    group.add(makePart(0.38, 0.36, 0.5, 0x854d0e, 0, 1.62, 0.7)); // head
    // Antlers
    group.add(makePart(0.07, 0.48, 0.07, 0xe7d3b0, -0.2, 1.98, 0.62));
    group.add(makePart(0.07, 0.48, 0.07, 0xe7d3b0, 0.2, 1.98, 0.62));
    group.add(makePart(0.25, 0.07, 0.07, 0xe7d3b0, -0.28, 2.05, 0.62));
    group.add(makePart(0.25, 0.07, 0.07, 0xe7d3b0, 0.28, 2.05, 0.62));
    const legPos = [
      [-0.2, 0.36, 0.42],
      [0.2, 0.36, 0.42],
      [-0.2, 0.36, -0.42],
      [0.2, 0.36, -0.42],
    ];
    for (const [lx, ly, lz] of legPos) {
      const leg = makePart(0.16, 0.72, 0.16, 0x713f12, lx, ly, lz);
      group.add(leg);
      limbs.push(leg);
    }
  } else if (kind === 'stalker') {
    group.add(makePart(0.62, 0.8, 0.38, 0x1e1b4b, 0, 1.1, 0)); // torso
    group.add(makePart(0.5, 0.5, 0.5, 0x312e81, 0, 1.78, 0)); // head
    group.add(makePart(0.11, 0.08, 0.05, 0xef4444, -0.12, 1.82, 0.25, 0xef4444));
    group.add(makePart(0.11, 0.08, 0.05, 0xef4444, 0.12, 1.82, 0.25, 0xef4444));
    const lLeg = makePart(0.24, 0.72, 0.26, 0x0f172a, -0.17, 0.36, 0);
    const rLeg = makePart(0.24, 0.72, 0.26, 0x0f172a, 0.17, 0.36, 0);
    const lArm = makePart(0.22, 0.75, 0.22, 0x312e81, -0.44, 1.15, 0.18);
    const rArm = makePart(0.22, 0.75, 0.22, 0x312e81, 0.44, 1.15, 0.18);
    lArm.rotation.x = -0.6;
    rArm.rotation.x = -0.6;
    group.add(lLeg, rLeg, lArm, rArm);
    limbs.push(lLeg, rLeg, lArm, rArm);
  } else if (kind === 'archer') {
    group.add(makePart(0.54, 0.78, 0.3, 0xe2e8f0, 0, 1.1, 0));
    group.add(makePart(0.46, 0.46, 0.46, 0xf8fafc, 0, 1.74, 0));
    group.add(makePart(0.1, 0.08, 0.05, 0x38bdf8, -0.11, 1.78, 0.24, 0x38bdf8));
    group.add(makePart(0.1, 0.08, 0.05, 0x38bdf8, 0.11, 1.78, 0.24, 0x38bdf8));
    const lLeg = makePart(0.18, 0.72, 0.18, 0xcbd5e1, -0.15, 0.36, 0);
    const rLeg = makePart(0.18, 0.72, 0.18, 0xcbd5e1, 0.15, 0.36, 0);
    const lArm = makePart(0.16, 0.7, 0.16, 0xcbd5e1, -0.38, 1.14, 0.12);
    const rArm = makePart(0.16, 0.7, 0.16, 0xcbd5e1, 0.38, 1.14, 0.25);
    rArm.rotation.x = -1.2;
    group.add(lLeg, rLeg, lArm, rArm);
    limbs.push(lLeg, rLeg, lArm, rArm);
  } else if (kind === 'slime') {
    group.add(makePart(0.92, 0.82, 0.92, 0xf97316, 0, 0.41, 0));
    group.add(makePart(0.46, 0.42, 0.46, 0xfef08a, 0, 0.42, 0, 0xf59e0b));
    group.add(makePart(0.14, 0.14, 0.05, 0x1e293b, -0.2, 0.55, 0.47));
    group.add(makePart(0.14, 0.14, 0.05, 0x1e293b, 0.2, 0.55, 0.47));
  } else if (kind === 'trader') {
    // Emerald cloak Frontier Merchant NPC
    group.add(makePart(0.68, 0.95, 0.46, 0x047857, 0, 0.98, 0)); // cloak
    group.add(makePart(0.72, 0.14, 0.5, 0xfacc15, 0, 0.82, 0)); // gold sash
    group.add(makePart(0.5, 0.5, 0.5, 0xf1c27d, 0, 1.72, 0)); // face
    group.add(makePart(0.66, 0.22, 0.66, 0x065f46, 0, 2.02, 0)); // merchant hat brim
    group.add(makePart(0.46, 0.26, 0.46, 0x059669, 0, 2.22, 0)); // hat crown
    group.add(makePart(0.08, 0.08, 0.05, 0x1e293b, -0.11, 1.75, 0.26));
    group.add(makePart(0.08, 0.08, 0.05, 0x1e293b, 0.11, 1.75, 0.26));
    const lLeg = makePart(0.24, 0.52, 0.24, 0x064e3b, -0.16, 0.26, 0);
    const rLeg = makePart(0.24, 0.52, 0.24, 0x064e3b, 0.16, 0.26, 0);
    group.add(lLeg, rLeg);
    limbs.push(lLeg, rLeg);
  } else if (kind === 'boss_warden') {
    // Towering Obsidian & Aether Crystal Warden Boss!
    group.add(makePart(1.55, 1.45, 0.95, 0x1e1033, 0, 1.9, 0)); // massive chest
    group.add(makePart(0.58, 0.62, 0.25, 0x38bdf8, 0, 1.95, 0.45, 0x38bdf8)); // glowing aether core
    group.add(makePart(0.95, 0.85, 0.9, 0x2e1065, 0, 3.05, 0.08)); // horned head
    group.add(makePart(0.22, 0.52, 0.22, 0x7e22ce, -0.52, 3.45, 0)); // left horn
    group.add(makePart(0.22, 0.52, 0.22, 0x7e22ce, 0.52, 3.45, 0)); // right horn
    group.add(makePart(0.2, 0.12, 0.08, 0x38bdf8, -0.22, 3.08, 0.52, 0x38bdf8)); // eye L
    group.add(makePart(0.2, 0.12, 0.08, 0x38bdf8, 0.22, 3.08, 0.52, 0x38bdf8)); // eye R
    const lLeg = makePart(0.52, 1.2, 0.54, 0x170d26, -0.44, 0.6, 0);
    const rLeg = makePart(0.52, 1.2, 0.54, 0x170d26, 0.44, 0.6, 0);
    const lArm = makePart(0.52, 1.55, 0.54, 0x3b0764, -1.06, 1.85, 0.18);
    const rArm = makePart(0.52, 1.55, 0.54, 0x3b0764, 1.06, 1.85, 0.18);
    group.add(lLeg, rLeg, lArm, rArm);
    limbs.push(lLeg, rLeg, lArm, rArm);
  }

  return { group, limbs };
}

export class EntityManager {
  public readonly entities: WorldEntity[] = [];
  public readonly drops: DroppedItem[] = [];
  private readonly particles: Particle[] = [];
  private readonly projectiles: Projectile[] = [];

  private readonly scene: THREE.Scene;
  private readonly callbacks: EntityCallbacks;
  private spawnTimer = 0;
  private entityIdCounter = 1;
  private starterTraderSpawned = false;
  private shrineBossSpawned = false;

  constructor(scene: THREE.Scene, callbacks: EntityCallbacks) {
    this.scene = scene;
    this.callbacks = callbacks;
  }

  public spawnEntity(kind: EntityKind, x: number, y: number, z: number): WorldEntity {
    const { group, limbs } = buildCreatureMesh(kind);
    group.position.set(x, y, z);
    this.scene.add(group);

    const specs: Record<
      EntityKind,
      {
        name: string;
        hostile: boolean;
        isBoss: boolean;
        isNpc: boolean;
        hp: number;
        speed: number;
        dmg: number;
        halfW: number;
        height: number;
      }
    > = {
      sheep: { name: 'Meadow Sheep', hostile: false, isBoss: false, isNpc: false, hp: 10, speed: 1.7, dmg: 0, halfW: 0.45, height: 1.15 },
      boar: { name: 'Wild Boar', hostile: false, isBoss: false, isNpc: false, hp: 12, speed: 2.1, dmg: 0, halfW: 0.42, height: 1.0 },
      stag: { name: 'Forest Stag', hostile: false, isBoss: false, isNpc: false, hp: 14, speed: 2.8, dmg: 0, halfW: 0.42, height: 1.8 },
      stalker: { name: 'Dusk Stalker', hostile: true, isBoss: false, isNpc: false, hp: 22, speed: 3.1, dmg: 3, halfW: 0.36, height: 1.95 },
      archer: { name: 'Bone Marksman', hostile: true, isBoss: false, isNpc: false, hp: 18, speed: 2.4, dmg: 3, halfW: 0.35, height: 1.95 },
      slime: { name: 'Ember Slime', hostile: true, isBoss: false, isNpc: false, hp: 14, speed: 2.6, dmg: 2, halfW: 0.46, height: 0.9 },
      trader: { name: 'Frontier Merchant', hostile: false, isBoss: false, isNpc: true, hp: 40, speed: 1.3, dmg: 0, halfW: 0.4, height: 2.1 },
      boss_warden: { name: 'Obsidian Warden', hostile: true, isBoss: true, isNpc: false, hp: 140, speed: 3.3, dmg: 6, halfW: 0.85, height: 3.4 },
    };

    const s = specs[kind];
    const entity: WorldEntity = {
      id: `ent_${this.entityIdCounter++}`,
      kind,
      name: s.name,
      hostile: s.hostile,
      isBoss: s.isBoss,
      isNpc: s.isNpc,
      x,
      y,
      z,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: Math.random() * Math.PI * 2,
      halfW: s.halfW,
      height: s.height,
      hp: s.hp,
      maxHp: s.hp,
      speed: s.speed,
      attackDamage: s.dmg,
      attackCooldown: 0,
      aiTimer: 1 + Math.random() * 2,
      walkPhase: 0,
      hurtFlash: 0,
      wanderDirX: 0,
      wanderDirZ: 0,
      fleeTimer: 0,
      mesh: group,
      limbs,
    };

    this.entities.push(entity);
    if (s.isBoss) {
      this.callbacks.onBossSpawned(s.name);
    }
    return entity;
  }

  public spawnDrop(itemId: number, count: number, x: number, y: number, z: number) {
    const colorMap: Record<number, number> = {
      [BLOCK.GRASS]: 0x58a846,
      [BLOCK.DIRT]: 0x7b5438,
      [BLOCK.COBBLESTONE]: 0x6b727d,
      [BLOCK.STONE]: 0x7f8691,
      [BLOCK.OAK_LOG]: 0x6b492c,
      [BLOCK.BIRCH_LOG]: 0xd8d5cc,
      [BLOCK.PINE_LOG]: 0x4b3421,
      [BLOCK.SAND]: 0xe3cf94,
      [ITEM.COAL]: 0x1f2937,
      [ITEM.RAW_IRON]: 0xd6a988,
      [ITEM.RAW_GOLD]: 0xfacc15,
      [ITEM.CRYSTAL_GEM]: 0x38bdf8,
      [ITEM.SPARK_DUST]: 0xef4444,
      [ITEM.WHEAT]: 0xeab308,
      [ITEM.WHEAT_SEEDS]: 0x84cc16,
      [ITEM.RAW_MEAT]: 0xfb7185,
      [ITEM.WOOL]: 0xf8fafc,
      [ITEM.APPLE]: 0xdc2626,
      [ITEM.BERRIES]: 0xe11d48,
      [ITEM.ANCIENT_CORE]: 0x9333ea,
    };
    const col = colorMap[itemId] ?? 0xcbd5e1;
    const mat = new THREE.MeshLambertMaterial({
      color: col,
      emissive: itemId === ITEM.CRYSTAL_GEM || itemId === ITEM.ANCIENT_CORE ? col : 0x000000,
      emissiveIntensity: 0.45,
    });
    const mesh = new THREE.Mesh(SHARED_BOX, mat);
    mesh.scale.set(0.28, 0.28, 0.28);
    mesh.position.set(x, y, z);
    this.scene.add(mesh);

    this.drops.push({
      id: `drop_${this.entityIdCounter++}`,
      itemId,
      count,
      x,
      y,
      z,
      vx: (Math.random() - 0.5) * 2.5,
      vy: 3.4,
      vz: (Math.random() - 0.5) * 2.5,
      age: 0,
      mesh,
    });
  }

  public spawnBreakParticles(x: number, y: number, z: number, colorHex = 0x94a3b8, count = 10) {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: colorHex });
      const mesh = new THREE.Mesh(SHARED_BOX, mat);
      const s = 0.08 + Math.random() * 0.1;
      mesh.scale.set(s, s, s);
      const px = x + 0.2 + Math.random() * 0.6;
      const py = y + 0.2 + Math.random() * 0.6;
      const pz = z + 0.2 + Math.random() * 0.6;
      mesh.position.set(px, py, pz);
      this.scene.add(mesh);
      this.particles.push({
        x: px,
        y: py,
        z: pz,
        vx: (Math.random() - 0.5) * 4.5,
        vy: 1.8 + Math.random() * 3.5,
        vz: (Math.random() - 0.5) * 4.5,
        life: 0,
        maxLife: 0.4 + Math.random() * 0.35,
        mesh,
      });
    }
  }

  public damageEntity(entityId: string, damage: number, knockX: number, knockZ: number): boolean {
    const idx = this.entities.findIndex((e) => e.id === entityId);
    if (idx === -1) return false;
    const e = this.entities[idx];
    if (e.isNpc) return false; // Protect friendly traders from accidental murder

    e.hp -= damage;
    e.hurtFlash = 0.22;
    e.vx += knockX * (e.isBoss ? 2.2 : 6.0);
    e.vy = Math.max(e.vy, e.isBoss ? 2.5 : 4.2);
    e.vz += knockZ * (e.isBoss ? 2.2 : 6.0);
    if (!e.hostile) e.fleeTimer = 4.0;

    this.spawnBreakParticles(e.x - 0.5, e.y + e.height * 0.5, e.z - 0.5, e.isBoss ? 0x38bdf8 : 0xef4444, 8);

    if (e.hp <= 0) {
      this.killEntity(idx);
      return true;
    }
    return true;
  }

  private disposeEntityGroup(group: THREE.Group) {
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
    this.scene.remove(group);
  }

  private killEntity(index: number) {
    const e = this.entities[index];
    this.disposeEntityGroup(e.mesh);
    this.entities.splice(index, 1);

    // Loot drops
    if (e.kind === 'sheep') {
      this.spawnDrop(ITEM.WOOL, 2, e.x, e.y + 0.6, e.z);
      this.spawnDrop(ITEM.RAW_MEAT, 1, e.x, e.y + 0.6, e.z);
    } else if (e.kind === 'boar' || e.kind === 'stag') {
      this.spawnDrop(ITEM.RAW_MEAT, 2, e.x, e.y + 0.6, e.z);
    } else if (e.kind === 'stalker') {
      this.spawnDrop(ITEM.COAL, 1, e.x, e.y + 0.8, e.z);
      if (Math.random() < 0.45) this.spawnDrop(ITEM.RAW_IRON, 1, e.x, e.y + 0.8, e.z);
    } else if (e.kind === 'archer') {
      this.spawnDrop(ITEM.STICK, 2, e.x, e.y + 0.8, e.z);
      if (Math.random() < 0.4) this.spawnDrop(ITEM.GOLD_INGOT, 1, e.x, e.y + 0.8, e.z);
    } else if (e.kind === 'slime') {
      this.spawnDrop(ITEM.SPARK_DUST, 2, e.x, e.y + 0.5, e.z);
    } else if (e.kind === 'boss_warden') {
      this.spawnDrop(ITEM.ANCIENT_CORE, 1, e.x, e.y + 1.5, e.z);
      this.spawnDrop(ITEM.CRYSTAL_GEM, 6, e.x + 0.5, e.y + 1.5, e.z);
      this.spawnDrop(ITEM.GOLD_INGOT, 5, e.x - 0.5, e.y + 1.5, e.z);
    }

    this.callbacks.onEntityKilled(e);
  }

  public raycastEntity(
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
    maxDist: number
  ): { entity: WorldEntity; distance: number } | null {
    let best: { entity: WorldEntity; distance: number } | null = null;
    for (const e of this.entities) {
      // Sphere/capsule quick ray intersection
      const cx = e.x;
      const cy = e.y + e.height * 0.5;
      const cz = e.z;
      const rx = cx - ox;
      const ry = cy - oy;
      const rz = cz - oz;
      const proj = rx * dx + ry * dy + rz * dz;
      if (proj < 0 || proj > maxDist) continue;
      const px = ox + dx * proj;
      const py = oy + dy * proj;
      const pz = oz + dz * proj;
      const distSq = (px - cx) ** 2 + (py - cy) ** 2 + (pz - cz) ** 2;
      const radius = Math.max(e.halfW + 0.22, e.height * 0.45);
      if (distSq <= radius * radius) {
        if (!best || proj < best.distance) {
          best = { entity: e, distance: proj };
        }
      }
    }
    return best;
  }

  public getActiveBoss(): { name: string; hp: number; maxHp: number } | null {
    const boss = this.entities.find((e) => e.isBoss);
    if (!boss) return null;
    return { name: boss.name, hp: Math.max(0, Math.ceil(boss.hp)), maxHp: boss.maxHp };
  }

  public update(
    dt: number,
    playerX: number,
    playerY: number,
    playerZ: number,
    gameMode: GameMode,
    isNight: boolean,
    getBlock: BlockGetter,
    getSurfaceY: (wx: number, wz: number) => number
  ) {
    // 1. Ensure starter Villager Merchant at NE Outpost (~23, 23) and ambient wildlife
    if (!this.starterTraderSpawned) {
      const tx = 24.5;
      const tz = 20.5;
      const ty = getSurfaceY(tx, tz);
      if (ty > 22) {
        this.spawnEntity('trader', tx, ty + 0.1, tz);
        this.starterTraderSpawned = true;
      }
    }

    // Spawn Obsidian Warden near NW Ancient Shrine (-24, 40) if player approaches it!
    if (!this.shrineBossSpawned && Math.hypot(playerX - -24, playerZ - 40) < 26) {
      const by = getSurfaceY(-24, 40);
      if (by > 22) {
        this.spawnEntity('boss_warden', -23.5, by + 0.2, 40.5);
        this.shrineBossSpawned = true;
      }
    }

    // Periodic ambient spawning & despawning
    this.spawnTimer += dt;
    if (this.spawnTimer >= 4.0) {
      this.spawnTimer = 0;
      const passiveCount = this.entities.filter((e) => !e.hostile && !e.isNpc).length;
      const hostileCount = this.entities.filter((e) => e.hostile && !e.isBoss).length;

      if (passiveCount < 9) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 16 + Math.random() * 24;
        const sx = playerX + Math.cos(angle) * dist;
        const sz = playerZ + Math.sin(angle) * dist;
        const sy = getSurfaceY(sx, sz);
        if (sy > 23 && sy < 52) {
          const kinds: EntityKind[] = ['sheep', 'boar', 'stag'];
          const pick = kinds[Math.floor(Math.random() * kinds.length)];
          this.spawnEntity(pick, sx, sy + 0.1, sz);
        }
      }

      if (isNight && hostileCount < 7 && (gameMode === 'survival' || gameMode === 'adventure')) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 18 + Math.random() * 20;
        const sx = playerX + Math.cos(angle) * dist;
        const sz = playerZ + Math.sin(angle) * dist;
        const sy = getSurfaceY(sx, sz);
        if (sy > 22 && sy < 52) {
          const kinds: EntityKind[] = ['stalker', 'archer', 'slime'];
          const pick = kinds[Math.floor(Math.random() * kinds.length)];
          this.spawnEntity(pick, sx, sy + 0.1, sz);
        }
      }
    }

    // 2. Update Entities
    const canAttackPlayer = gameMode === 'survival' || gameMode === 'adventure';
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i];
      const distToPlayer = Math.hypot(e.x - playerX, e.z - playerZ);

      // Despawn far non-boss, non-NPC mobs
      if (distToPlayer > 72 && !e.isBoss && !e.isNpc) {
        this.disposeEntityGroup(e.mesh);
        this.entities.splice(i, 1);
        continue;
      }

      // Daylight slowly weakens night stalkers/archers
      if (!isNight && e.hostile && !e.isBoss && e.kind !== 'slime') {
        e.hp -= dt * 1.4;
        if (e.hp <= 0) {
          this.killEntity(i);
          continue;
        }
      }

      e.attackCooldown = Math.max(0, e.attackCooldown - dt);
      e.aiTimer -= dt;
      e.fleeTimer = Math.max(0, e.fleeTimer - dt);

      let desiredVx = 0;
      let desiredVz = 0;

      if (e.hostile && canAttackPlayer && distToPlayer < (e.isBoss ? 32 : 20)) {
        const dx = playerX - e.x;
        const dz = playerZ - e.z;
        const len = Math.max(0.01, Math.hypot(dx, dz));
        const nx = dx / len;
        const nz = dz / len;
        e.yaw = Math.atan2(nx, nz);

        if (e.kind === 'archer' && distToPlayer < 14 && distToPlayer > 5) {
          // Strafe & fire arrow
          desiredVx = -nz * e.speed * 0.45;
          desiredVz = nx * e.speed * 0.45;
          if (e.attackCooldown <= 0) {
            e.attackCooldown = 2.1;
            this.fireProjectile(e.x, e.y + 1.5, e.z, playerX, playerY + 1.2, playerZ, e.attackDamage);
          }
        } else {
          desiredVx = nx * e.speed;
          desiredVz = nz * e.speed;
          const reach = e.isBoss ? 2.6 : 1.75;
          if (distToPlayer < reach && Math.abs(e.y - playerY) < 2.2 && e.attackCooldown <= 0) {
            e.attackCooldown = e.isBoss ? 1.45 : 1.25;
            this.callbacks.onPlayerDamaged(e.attackDamage, e.name);
          }
          // Boss leap slam every few seconds
          if (e.isBoss && distToPlayer > 5 && distToPlayer < 16 && e.aiTimer <= 0) {
            e.aiTimer = 4.2;
            e.vy = 8.2;
            desiredVx = nx * e.speed * 2.2;
            desiredVz = nz * e.speed * 2.2;
          }
        }
      } else if (e.fleeTimer > 0) {
        const dx = e.x - playerX;
        const dz = e.z - playerZ;
        const len = Math.max(0.01, Math.hypot(dx, dz));
        desiredVx = (dx / len) * e.speed * 1.45;
        desiredVz = (dz / len) * e.speed * 1.45;
        e.yaw = Math.atan2(desiredVx, desiredVz);
      } else if (e.isNpc && distToPlayer < 6) {
        // Trader turns politely to face player
        e.yaw = Math.atan2(playerX - e.x, playerZ - e.z);
      } else {
        if (e.aiTimer <= 0) {
          e.aiTimer = 2.0 + Math.random() * 3.2;
          if (Math.random() < 0.65) {
            const ang = Math.random() * Math.PI * 2;
            e.wanderDirX = Math.sin(ang);
            e.wanderDirZ = Math.cos(ang);
            e.yaw = ang;
          } else {
            e.wanderDirX = 0;
            e.wanderDirZ = 0;
          }
        }
        desiredVx = e.wanderDirX * e.speed * 0.65;
        desiredVz = e.wanderDirZ * e.speed * 0.65;
      }

      // Smooth velocity blend + gravity
      e.vx = e.vx * 0.82 + desiredVx * 0.18;
      e.vz = e.vz * 0.82 + desiredVz * 0.18;
      e.vy -= 22 * dt;

      const prevX = e.x;
      const prevZ = e.z;
      const res = stepPhysics(
        { x: e.x, y: e.y, z: e.z, halfW: e.halfW, height: e.height },
        e.vx,
        e.vy,
        e.vz,
        dt,
        getBlock
      );

      // Auto-hop obstacles & slime bounce
      const movedDist = Math.hypot(res.x - prevX, res.z - prevZ);
      const wantedSpeed = Math.hypot(desiredVx, desiredVz);
      if (res.onGround && ((wantedSpeed > 0.4 && movedDist < 0.01) || (e.kind === 'slime' && wantedSpeed > 0.2))) {
        res.vy = e.kind === 'slime' ? 7.2 : 6.9;
      }
      if (res.inWater) {
        res.vy = Math.min(3.5, res.vy + 26 * dt);
      }

      e.x = res.x;
      e.y = res.y;
      e.z = res.z;
      e.vx = res.vx;
      e.vy = res.vy;
      e.vz = res.vz;

      // Update mesh transform & limb swing animation
      e.mesh.position.set(e.x, e.y, e.z);
      e.mesh.rotation.y = e.yaw;

      const hSpeed = Math.hypot(e.vx, e.vz);
      if (hSpeed > 0.2) {
        e.walkPhase += dt * hSpeed * 4.5;
        const swing = Math.sin(e.walkPhase) * 0.55;
        if (e.limbs[0]) e.limbs[0].rotation.x = swing;
        if (e.limbs[1]) e.limbs[1].rotation.x = -swing;
        if (e.limbs[2]) e.limbs[2].rotation.x = e.hostile ? -0.6 - swing * 0.4 : -swing;
        if (e.limbs[3]) e.limbs[3].rotation.x = e.hostile ? -0.6 + swing * 0.4 : swing;
      }

      // Hurt flash tint
      if (e.hurtFlash > 0) {
        e.hurtFlash = Math.max(0, e.hurtFlash - dt);
        const s = 1 + e.hurtFlash * 0.25;
        e.mesh.scale.set(s, s, s);
      } else {
        e.mesh.scale.set(1, 1, 1);
      }
    }

    // 3. Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.vy -= 6.5 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.mesh.position.set(p.x, p.y, p.z);

      const hitPlayer =
        canAttackPlayer &&
        Math.hypot(p.x - playerX, p.z - playerZ) < 0.7 &&
        p.y >= playerY &&
        p.y <= playerY + 1.8;

      if (hitPlayer) {
        this.callbacks.onPlayerDamaged(p.damage, 'Bone Marksman');
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
        continue;
      }

      if (p.life <= 0 || getBlock(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)) !== BLOCK.AIR) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }

    // 4. Update Dropped Items (magnetize & bob)
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.age += dt;
      d.vy -= 18 * dt;
      const res = stepPhysics(
        { x: d.x, y: d.y, z: d.z, halfW: 0.14, height: 0.28 },
        d.vx,
        d.vy,
        d.vz,
        dt,
        getBlock
      );
      d.x = res.x;
      d.y = res.y;
      d.z = res.z;
      d.vx = res.vx * 0.9;
      d.vy = res.vy;
      d.vz = res.vz * 0.9;

      // Magnetize toward player
      const dx = playerX - d.x;
      const dy = playerY + 0.8 - d.y;
      const dz = playerZ - d.z;
      const dist = Math.hypot(dx, dy, dz);
      if (d.age > 0.25 && dist < 2.8 && gameMode !== 'spectator') {
        const pull = 8.5 * dt;
        d.x += (dx / Math.max(0.1, dist)) * pull;
        d.y += (dy / Math.max(0.1, dist)) * pull;
        d.z += (dz / Math.max(0.1, dist)) * pull;
        if (dist < 0.95) {
          if (this.callbacks.onItemPickedUp(d.itemId, d.count)) {
            this.scene.remove(d.mesh);
            (d.mesh.material as THREE.Material).dispose();
            this.drops.splice(i, 1);
            continue;
          }
        }
      }

      if (d.age > 120) {
        this.scene.remove(d.mesh);
        (d.mesh.material as THREE.Material).dispose();
        this.drops.splice(i, 1);
        continue;
      }

      d.mesh.position.set(d.x, d.y + 0.2 + Math.sin(d.age * 4) * 0.08, d.z);
      d.mesh.rotation.y = d.age * 2.2;
    }

    // 5. Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.scene.remove(p.mesh);
        (p.mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
        continue;
      }
      p.vy -= 18 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.mesh.position.set(p.x, p.y, p.z);
      const shrink = 1 - p.life / p.maxLife;
      p.mesh.scale.setScalar(Math.max(0.01, 0.14 * shrink));
    }
  }

  private fireProjectile(
    sx: number,
    sy: number,
    sz: number,
    tx: number,
    ty: number,
    tz: number,
    damage: number
  ) {
    const dx = tx - sx;
    const dy = ty - sy + 0.5;
    const dz = tz - sz;
    const len = Math.max(0.1, Math.hypot(dx, dy, dz));
    const speed = 13.5;

    const mat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const mesh = new THREE.Mesh(SHARED_BOX, mat);
    mesh.scale.set(0.12, 0.12, 0.55);
    mesh.position.set(sx, sy, sz);
    mesh.lookAt(tx, ty, tz);
    this.scene.add(mesh);

    this.projectiles.push({
      x: sx,
      y: sy,
      z: sz,
      vx: (dx / len) * speed,
      vy: (dy / len) * speed,
      vz: (dz / len) * speed,
      damage,
      life: 2.5,
      mesh,
    });
  }

  public disposeAll() {
    for (const e of this.entities) this.disposeEntityGroup(e.mesh);
    for (const d of this.drops) {
      this.scene.remove(d.mesh);
      (d.mesh.material as THREE.Material).dispose();
    }
    for (const p of this.particles) {
      this.scene.remove(p.mesh);
      (p.mesh.material as THREE.Material).dispose();
    }
    for (const pr of this.projectiles) {
      this.scene.remove(pr.mesh);
      (pr.mesh.material as THREE.Material).dispose();
    }
    this.entities.length = 0;
    this.drops.length = 0;
    this.particles.length = 0;
    this.projectiles.length = 0;
  }
}
