import * as THREE from 'three';
import { SoundEngine } from './audio';
import {
  BLOCK,
  canHarvestBlock,
  computeAttackDamage,
  computeMiningTime,
  createItemStack,
  getEnchantLevel,
  getItemDef,
  isLogBlock,
  ITEM,
} from './blocks';
import { blockKey, ChunkManager } from './chunkManager';
import { EntityManager, WorldEntity } from './entities';
import { InputManager } from './input';
import { blockIntersectsPlayer, raycastVoxels, stepPhysics, VoxelRaycastHit } from './physics';
import { findSmeltRecipe, getRecipeIngredients } from './recipes';
import { saveWorld } from './saveSystem';
import { getAtlasBundle } from './textures';
import {
  ActiveModal,
  AdventureObjective,
  ChestState,
  CraftingRecipe,
  Enchantment,
  FurnaceState,
  GameMode,
  GameNotification,
  GameSettings,
  HudSnapshot,
  ItemStack,
  TargetInfo,
  TradeOffer,
  WeatherType,
  WorldSaveData,
} from './types';
import { CHUNK_HEIGHT } from './worldGen';

export interface EngineCallbacks {
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onModalChange: (modal: ActiveModal) => void;
  onNotification: (notif: GameNotification) => void;
  onFurnaceUpdate?: (furnace: FurnaceState) => void;
  onChestUpdate?: (chest: ChestState) => void;
}

const PLAYER_HALF_W = 0.3;
const PLAYER_HEIGHT = 1.75;
const REACH_DISTANCE = 5.4;

export class GameEngine {
  private readonly container: HTMLElement;
  private readonly callbacks: EngineCallbacks;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;

  public readonly audio: SoundEngine;
  public readonly input: InputManager;
  public readonly chunkManager: ChunkManager;
  public readonly entityManager: EntityManager;

  // Lighting & Atmosphere
  private readonly hemiLight: THREE.HemisphereLight;
  private readonly sunLight: THREE.DirectionalLight;
  private readonly skyGroup: THREE.Group;
  private readonly sunMesh: THREE.Mesh;
  private readonly moonMesh: THREE.Mesh;
  private readonly starField: THREE.Points;
  private readonly weatherPoints: THREE.Points;
  private readonly weatherPositions: Float32Array;
  private readonly fog: THREE.Fog;

  // Target & Viewmodel Visuals
  private readonly highlightBox: THREE.LineSegments;
  private readonly crackBox: THREE.Mesh;
  private readonly crackMat: THREE.MeshBasicMaterial;
  private readonly viewmodelGroup: THREE.Group;
  private readonly viewmodelMesh: THREE.Mesh;

  // Game & World State
  public saveData: WorldSaveData;
  public settings: GameSettings;
  public activeModal: ActiveModal = { type: 'none' };

  // Player dynamic state
  private px: number;
  private py: number;
  private pz: number;
  private vx = 0;
  private vy = 0;
  private vz = 0;
  private yaw: number;
  private pitch: number;
  private onGround = false;
  private inWater = false;
  private headInWater = false;
  private isFlying = false;
  private isCrouching = false;
  private highestAirY = 0;

  private hp: number;
  private maxHp: number;
  private hunger: number;
  private maxHunger: number;
  private oxygen = 20;
  private readonly maxOxygen = 20;
  private xp: number;
  private level: number;
  private isDead = false;
  private hurtCooldown = 0;
  private hungerTimer = 0;
  private regenTimer = 0;
  private stepDistAccum = 0;
  private walkBobPhase = 0;
  private swingAnim = 0;

  private selectedHotbar: number;
  public inventory: (ItemStack | null)[];
  public furnaces: Map<string, FurnaceState> = new Map();
  public chests: Map<string, ChestState> = new Map();
  public objectives: AdventureObjective[];

  // Mining state
  private miningKey = '';
  private miningElapsed = 0;
  private miningRequired = 1;
  private mineSoundTimer = 0;
  private attackCooldown = 0;
  private lastBlockHit: VoxelRaycastHit | null = null;
  private lastEntityHit: { entity: WorldEntity; distance: number } | null = null;

  // Time & Weather
  private worldTime: number;
  private dayCount: number;
  private weather: WeatherType;
  private weatherTimer = 180;
  private lightningFlash = 0;
  private autoSaveTimer = 0;

  // Loop & Telemetry
  private rafId = 0;
  private lastFrameTime = 0;
  private hudEmitTimer = 0;
  private fpsAccum = 0;
  private fpsFrames = 0;
  private currentFps = 60;
  private disposed = false;

  constructor(
    container: HTMLElement,
    saveData: WorldSaveData,
    settings: GameSettings,
    callbacks: EngineCallbacks
  ) {
    this.container = container;
    this.saveData = saveData;
    this.settings = { ...settings };
    this.callbacks = callbacks;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: settings.graphicsQuality === 'high',
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, settings.graphicsQuality === 'high' ? 2 : 1.25));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.innerHTML = '';
    container.appendChild(this.renderer.domElement);

    // Scene & Fog
    this.scene = new THREE.Scene();
    this.fog = new THREE.Fog(0x73b9f5, 28, Math.max(44, settings.renderDistance * 15));
    this.scene.fog = this.fog;
    this.scene.background = new THREE.Color(0x73b9f5);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      settings.fov,
      Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
      0.08,
      240
    );
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    // Lighting
    this.hemiLight = new THREE.HemisphereLight(0xd8ecff, 0x455046, 0.85);
    this.scene.add(this.hemiLight);
    this.sunLight = new THREE.DirectionalLight(0xfff5e0, 0.92);
    this.sunLight.position.set(40, 80, 30);
    this.scene.add(this.sunLight);

    // Sky Group (Sun, Moon, Stars)
    this.skyGroup = new THREE.Group();
    this.sunMesh = new THREE.Mesh(
      new THREE.BoxGeometry(10, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xfef08a, fog: false })
    );
    this.moonMesh = new THREE.Mesh(
      new THREE.BoxGeometry(7.5, 7.5, 7.5),
      new THREE.MeshBasicMaterial({ color: 0xe2e8f0, fog: false })
    );
    this.skyGroup.add(this.sunMesh, this.moonMesh);

    const starPos = new Float32Array(260 * 3);
    for (let i = 0; i < 260; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 0.85 + 0.1);
      const r = 130;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.cos(phi);
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    this.starField = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 1.4, transparent: true, opacity: 0, fog: false })
    );
    this.skyGroup.add(this.starField);
    this.scene.add(this.skyGroup);

    // Weather Precipitation Cloud
    const dropCount = 700;
    this.weatherPositions = new Float32Array(dropCount * 3);
    for (let i = 0; i < dropCount; i++) {
      this.weatherPositions[i * 3] = (Math.random() - 0.5) * 32;
      this.weatherPositions[i * 3 + 1] = Math.random() * 22;
      this.weatherPositions[i * 3 + 2] = (Math.random() - 0.5) * 32;
    }
    const weatherGeo = new THREE.BufferGeometry();
    weatherGeo.setAttribute('position', new THREE.BufferAttribute(this.weatherPositions, 3));
    this.weatherPoints = new THREE.Points(
      weatherGeo,
      new THREE.PointsMaterial({ color: 0xaad4ff, size: 0.2, transparent: true, opacity: 0.72 })
    );
    this.weatherPoints.visible = false;
    this.scene.add(this.weatherPoints);

    // Block Selection Wireframe & Crack Overlay
    const boxEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.008, 1.008, 1.008));
    this.highlightBox = new THREE.LineSegments(
      boxEdges,
      new THREE.LineBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.85 })
    );
    this.highlightBox.visible = false;
    this.scene.add(this.highlightBox);

    const atlas = getAtlasBundle();
    this.crackMat = new THREE.MeshBasicMaterial({
      map: atlas.crackTextures[0],
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    this.crackBox = new THREE.Mesh(new THREE.BoxGeometry(1.012, 1.012, 1.012), this.crackMat);
    this.crackBox.visible = false;
    this.scene.add(this.crackBox);

    // First-person held hand / item viewmodel attached to camera
    this.viewmodelGroup = new THREE.Group();
    this.viewmodelMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.24, 0.24),
      new THREE.MeshLambertMaterial({ color: 0xd9a982 })
    );
    this.viewmodelMesh.position.set(0.46, -0.38, -0.62);
    this.viewmodelMesh.rotation.set(0.25, -0.45, 0.12);
    this.viewmodelGroup.add(this.viewmodelMesh);
    this.camera.add(this.viewmodelGroup);

    // Subsystems
    this.audio = new SoundEngine();
    this.audio.setSettings(settings.masterVolume, settings.muted);

    this.chunkManager = new ChunkManager(
      this.scene,
      saveData.meta.seed,
      saveData.modifiedBlocks,
      saveData.blockMeta
    );

    // Restore player state
    this.px = saveData.player.x;
    this.py = saveData.player.y;
    this.pz = saveData.player.z;
    this.yaw = saveData.player.yaw;
    this.pitch = saveData.player.pitch;
    this.hp = saveData.player.hp;
    this.maxHp = saveData.player.maxHp;
    this.hunger = saveData.player.hunger;
    this.maxHunger = saveData.player.maxHunger;
    this.xp = saveData.player.xp;
    this.level = saveData.player.level;
    this.selectedHotbar = saveData.player.selectedHotbar;
    this.inventory = saveData.player.inventory.map((s) => (s ? { ...s } : null));
    while (this.inventory.length < 36) this.inventory.push(null);

    this.worldTime = saveData.worldTime;
    this.dayCount = saveData.dayCount;
    this.weather = saveData.weather;
    this.objectives = saveData.objectives.map((o) => ({ ...o }));
    this.isFlying = saveData.meta.gameMode === 'spectator';

    for (const [k, f] of Object.entries(saveData.furnaces || {})) {
      this.furnaces.set(k, { ...f });
    }
    for (const [k, c] of Object.entries(saveData.chests || {})) {
      this.chests.set(k, { ...c, slots: c.slots.map((s) => (s ? { ...s } : null)) });
    }

    // Bootstrap immediate chunks around player & ensure safe landing height
    this.chunkManager.updateStreaming(this.px, this.pz, Math.min(3, settings.renderDistance), true);
    const safeY = this.chunkManager.getSurfaceY(this.px, this.pz);
    if (this.saveData.meta.playTimeSeconds === 0) {
      this.py = safeY + 0.5;
      this.saveData.player.spawnY = this.py;
      this.saveData.meta.biomeAtSpawn = this.chunkManager.getBiomeAt(this.px, this.pz);
    } else if (this.py < 2) {
      this.py = safeY + 0.5;
    }
    this.highestAirY = this.py;

    // Entity Manager
    this.entityManager = new EntityManager(this.scene, {
      onPlayerDamaged: (amount, source) => this.damagePlayer(amount, source),
      onItemPickedUp: (itemId, count) => {
        const added = this.addItemToInventory(itemId, count);
        if (added) this.audio.playPickup();
        return added;
      },
      onEntityKilled: (entity) => {
        const xpGain = entity.isBoss ? 120 : entity.hostile ? 18 : 6;
        this.addXp(xpGain);
        if (entity.isBoss) {
          this.notify(`VICTORY! You defeated the ${entity.name}! (+${xpGain} XP)`, 'achievement');
          this.advanceObjective('obj_boss', 1);
        }
      },
      onBossSpawned: (name) => {
        this.audio.playBossRoar();
        this.notify(`BOSS AWAKENED: ${name} has entered the realm!`, 'danger');
      },
    });

    // Input Manager
    this.input = new InputManager(this.renderer.domElement, {
      onSelectHotbar: (slot) => {
        this.selectedHotbar = slot;
        this.updateViewmodelAppearance();
        this.emitHudSnapshot();
      },
      onScrollHotbar: (delta) => {
        this.selectedHotbar = (this.selectedHotbar + delta + 9) % 9;
        this.updateViewmodelAppearance();
        this.emitHudSnapshot();
      },
      onToggleInventory: () => {
        if (this.isDead) return;
        if (this.activeModal.type === 'none') {
          this.setModal({ type: 'inventory', tableMode: false });
        } else {
          this.setModal({ type: 'none' });
        }
      },
      onTogglePause: () => {
        if (this.activeModal.type !== 'none') {
          this.setModal({ type: 'none' });
        } else {
          this.setModal({ type: 'pause' });
        }
      },
      onPrimaryClick: () => this.handlePrimaryClick(),
      onSecondaryClick: () => this.handleSecondaryClick(),
      onDoubleSpace: () => {
        if (this.saveData.meta.gameMode === 'creative') {
          this.isFlying = !this.isFlying;
          this.vy = 0;
          this.notify(this.isFlying ? 'Flight enabled' : 'Flight disabled', 'info');
          this.emitHudSnapshot();
        }
      },
      onPointerLockChange: () => this.emitHudSnapshot(),
    });

    this.updateViewmodelAppearance();
    window.addEventListener('resize', this.onResize);

    // Welcome tip
    this.notify(
      `Welcome to ${this.saveData.meta.name}! Explore NE for the Trading Outpost & NW for the Ancient Shrine.`,
      'info'
    );

    this.lastFrameTime = performance.now();
    this.emitHudSnapshot();
    this.loop(this.lastFrameTime);
  }

  private onResize = () => {
    if (this.disposed) return;
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  public setModal(modal: ActiveModal) {
    this.activeModal = modal;
    this.input.setEnabled(modal.type === 'none' && !this.isDead);
    this.callbacks.onModalChange(modal);
    this.emitHudSnapshot();
  }

  public notify(message: string, type: GameNotification['type'] = 'info') {
    this.callbacks.onNotification({
      id: `${Date.now()}_${Math.random()}`,
      message,
      type,
      timestamp: Date.now(),
    });
  }

  public getHeldItem(): ItemStack | null {
    return this.inventory[this.selectedHotbar] ?? null;
  }

  public selectHotbarSlot(slot: number) {
    if (slot < 0 || slot > 8) return;
    this.selectedHotbar = slot;
    this.updateViewmodelAppearance();
    this.emitHudSnapshot();
  }

  private updateViewmodelAppearance() {
    const held = this.getHeldItem();
    const mat = this.viewmodelMesh.material as THREE.MeshLambertMaterial;
    if (!held) {
      this.viewmodelMesh.scale.set(0.85, 0.85, 1.45);
      mat.color.setHex(0xd9a982); // bare hand
      return;
    }
    const def = getItemDef(held.itemId);
    if (def.toolType) {
      this.viewmodelMesh.scale.set(0.32, 1.45, 0.32);
      const tierColors = [0xb8844b, 0xb8844b, 0x94a3b8, 0xe2e8f0, 0x38bdf8];
      mat.color.setHex(tierColors[def.toolTier ?? 1] ?? 0x94a3b8);
    } else if (def.isBlock) {
      this.viewmodelMesh.scale.set(1.05, 1.05, 1.05);
      const blockTint: Record<number, number> = {
        [BLOCK.GRASS]: 0x58a846,
        [BLOCK.DIRT]: 0x7b5438,
        [BLOCK.STONE]: 0x7f8691,
        [BLOCK.COBBLESTONE]: 0x6b727d,
        [BLOCK.PLANKS]: 0xbe915a,
        [BLOCK.OAK_LOG]: 0x6b492c,
        [BLOCK.SAND]: 0xe3cf94,
        [BLOCK.BRICK]: 0xa84738,
        [BLOCK.GLASS]: 0xbae6fd,
        [BLOCK.TORCH]: 0xf97316,
        [BLOCK.SPARK_LAMP]: 0xf59e0b,
        [BLOCK.OBSIDIAN]: 0x3b0764,
      };
      mat.color.setHex(blockTint[held.itemId] ?? 0x94a3b8);
    } else {
      this.viewmodelMesh.scale.set(0.6, 0.6, 0.6);
      mat.color.setHex(def.hungerRestore ? 0xf59e0b : 0x38bdf8);
    }
  }

  private getLookDirection(): THREE.Vector3 {
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    return dir.normalize();
  }

  private getEyeY(): number {
    return this.py + (this.isCrouching ? 1.32 : 1.6);
  }

  private handlePrimaryClick() {
    if (this.isDead || this.saveData.meta.gameMode === 'spectator') return;
    this.swingAnim = 1.0;

    // 1. Check entity attack first
    if (this.lastEntityHit && this.attackCooldown <= 0) {
      const target = this.lastEntityHit.entity;
      if (!target.isNpc) {
        const held = this.getHeldItem();
        const dmg = computeAttackDamage(held);
        const dir = this.getLookDirection();
        this.entityManager.damageEntity(target.id, dmg, dir.x, dir.z);
        this.audio.playHitEntity();
        this.attackCooldown = 0.34;
        if (held && getItemDef(held.itemId).toolType) {
          this.damageHeldTool();
        }
        return;
      }
    }

    // 2. Creative instant break
    if (this.saveData.meta.gameMode === 'creative' && this.lastBlockHit) {
      this.breakBlockAt(this.lastBlockHit.x, this.lastBlockHit.y, this.lastBlockHit.z, true);
    }
  }

  public triggerSecondaryAction() {
    this.handleSecondaryClick();
  }

  private handleSecondaryClick() {
    if (this.isDead || this.saveData.meta.gameMode === 'spectator') return;
    this.swingAnim = 0.75;

    // 1. Interact with Villager Merchant NPC
    if (this.lastEntityHit && this.lastEntityHit.entity.isNpc) {
      const npc = this.lastEntityHit.entity;
      this.setModal({ type: 'trader', entityId: npc.id, traderName: npc.name });
      return;
    }

    const held = this.getHeldItem();
    const heldDef = held ? getItemDef(held.itemId) : null;

    // 2. Use Warden Summon Totem!
    if (held && held.itemId === ITEM.SUMMON_TOTEM) {
      const dir = this.getLookDirection();
      const sx = this.px + dir.x * 10;
      const sz = this.pz + dir.z * 10;
      const sy = this.chunkManager.getSurfaceY(sx, sz);
      this.entityManager.spawnEntity('boss_warden', sx, sy + 0.5, sz);
      if (this.saveData.meta.gameMode !== 'creative') {
        this.consumeHeldItem(1);
      }
      return;
    }

    // 3. Interact with targeted special blocks
    if (this.lastBlockHit && !this.isCrouching) {
      const { x, y, z, blockId } = this.lastBlockHit;
      const bDef = getItemDef(blockId);

      if (bDef.interactable === 'crafting_table') {
        this.setModal({ type: 'inventory', tableMode: true });
        return;
      }
      if (bDef.interactable === 'furnace') {
        const key = blockKey(x, y, z);
        if (!this.furnaces.has(key)) {
          this.furnaces.set(key, {
            key,
            input: null,
            fuel: null,
            output: null,
            burnTime: 0,
            maxBurnTime: 0,
            smeltProgress: 0,
            smeltTotal: 4,
          });
        }
        this.setModal({ type: 'furnace', key });
        return;
      }
      if (bDef.interactable === 'chest') {
        const key = blockKey(x, y, z);
        if (!this.chests.has(key)) {
          const slots: (ItemStack | null)[] = new Array(18).fill(null);
          // Pre-stock naturally generated Frontier Outpost chest with welcome loot!
          if (x >= 18 && x <= 30 && z >= 18 && z <= 30) {
            slots[0] = createItemStack(ITEM.BREAD, 6);
            slots[1] = createItemStack(ITEM.IRON_INGOT, 4);
            slots[2] = createItemStack(ITEM.WHEAT_SEEDS, 8);
            slots[3] = createItemStack(ITEM.COAL, 12);
            slots[4] = createItemStack(ITEM.GOLD_INGOT, 3);
            slots[5] = createItemStack(BLOCK.SPARK_LAMP, 2);
            slots[6] = createItemStack(ITEM.SPARK_DUST, 12);
            slots[7] = createItemStack(BLOCK.SPARK_LEVER, 2);
          }
          this.chests.set(key, { key, slots });
        }
        this.setModal({ type: 'chest', key });
        return;
      }
      if (bDef.interactable === 'enchant_altar') {
        this.setModal({ type: 'enchant' });
        return;
      }
      if (bDef.interactable === 'lever') {
        const cur = this.chunkManager.getMeta(x, y, z);
        const next = cur > 0 ? 0 : 1;
        this.chunkManager.setMeta(x, y, z, next);
        this.chunkManager.propagateSparkstone();
        this.chunkManager.rebuildImmediateAt(x, z);
        this.audio.playLeverClick();
        this.notify(next ? 'Sparkstone circuit ACTIVATED' : 'Sparkstone circuit DEACTIVATED', 'info');
        return;
      }

      // Hoe tilling Grass/Dirt into Farmland!
      if (heldDef?.toolType === 'hoe' && (blockId === BLOCK.GRASS || blockId === BLOCK.DIRT)) {
        if (this.chunkManager.getBlock(x, y + 1, z) === BLOCK.AIR) {
          this.chunkManager.setBlock(x, y, z, BLOCK.FARMLAND, true);
          this.chunkManager.rebuildImmediateAt(x, z);
          this.audio.playBlockPlace();
          this.damageHeldTool();
          this.advanceObjective('obj_farm', 1);
          return;
        }
      }
    }

    // 4. Eat Food if holding edible item
    if (held && heldDef?.hungerRestore && this.saveData.meta.gameMode !== 'creative') {
      if (this.hunger < this.maxHunger || this.hp < this.maxHp) {
        this.hunger = Math.min(this.maxHunger, this.hunger + heldDef.hungerRestore);
        if (heldDef.healthRestore) {
          this.hp = Math.min(this.maxHp, this.hp + heldDef.healthRestore);
        }
        this.consumeHeldItem(1);
        this.audio.playEat();
        this.notify(`Ate ${heldDef.name}`, 'success');
        this.emitHudSnapshot();
        return;
      }
    }

    // 5. Place held block (or plant seeds / wire)
    if (held && heldDef?.isBlock && heldDef.blockId && this.lastBlockHit) {
      if (this.saveData.meta.gameMode === 'adventure') {
        // Adventure mode permits placing torches, seeds, and workstations
        const allowedInAdventure =
          heldDef.blockId === BLOCK.TORCH ||
          heldDef.blockId === BLOCK.WHEAT_1 ||
          heldDef.blockId === BLOCK.CRAFTING_TABLE ||
          heldDef.blockId === BLOCK.FURNACE ||
          heldDef.blockId === BLOCK.CHEST ||
          heldDef.blockId === BLOCK.SPARK_WIRE ||
          heldDef.blockId === BLOCK.SPARK_LEVER ||
          heldDef.blockId === BLOCK.SPARK_LAMP;
        if (!allowedInAdventure) {
          this.notify('Adventure Mode restricts free building (torches, crops & stations allowed).', 'warning');
          return;
        }
      }

      const tx = this.lastBlockHit.x + this.lastBlockHit.nx;
      const ty = this.lastBlockHit.y + this.lastBlockHit.ny;
      const tz = this.lastBlockHit.z + this.lastBlockHit.nz;

      if (ty <= 0 || ty >= CHUNK_HEIGHT - 1) return;

      // Seeds can only be planted on top of farmland
      if (held.itemId === ITEM.WHEAT_SEEDS) {
        const below = this.chunkManager.getBlock(tx, ty - 1, tz);
        if (below !== BLOCK.FARMLAND && below !== BLOCK.FARMLAND_WET) {
          this.notify('Till Grass or Soil with a Hoe before planting Wheat Seeds!', 'warning');
          return;
        }
        this.advanceObjective('obj_farm', 1);
      }

      // Prevent placing solid block inside player's body
      const placeDef = getItemDef(heldDef.blockId);
      if (
        placeDef.solid &&
        blockIntersectsPlayer(tx, ty, tz, {
          x: this.px,
          y: this.py,
          z: this.pz,
          halfW: PLAYER_HALF_W,
          height: PLAYER_HEIGHT,
        })
      ) {
        return;
      }

      const existing = this.chunkManager.getBlock(tx, ty, tz);
      if (existing !== BLOCK.AIR && existing !== BLOCK.WATER) return;

      this.chunkManager.setBlock(tx, ty, tz, heldDef.blockId, true);
      if (
        heldDef.blockId === BLOCK.SPARK_WIRE ||
        heldDef.blockId === BLOCK.SPARK_LEVER ||
        heldDef.blockId === BLOCK.SPARK_LAMP
      ) {
        this.chunkManager.propagateSparkstone();
      }
      this.chunkManager.rebuildImmediateAt(tx, tz);
      this.audio.playBlockPlace();

      if (this.saveData.meta.gameMode !== 'creative') {
        this.consumeHeldItem(1);
      }
      this.emitHudSnapshot();
    }
  }

  private breakBlockAt(x: number, y: number, z: number, instantCreative = false) {
    const blockId = this.chunkManager.getBlock(x, y, z);
    if (blockId === BLOCK.AIR || blockId === BLOCK.BEDROCK) return;

    const bDef = getItemDef(blockId);
    const held = this.getHeldItem();

    // Adventure mode tool restriction
    if (this.saveData.meta.gameMode === 'adventure') {
      const heldTool = held ? getItemDef(held.itemId).toolType : 'none';
      const isSoft = (bDef.hardness ?? 1) <= 0.35;
      if (!isSoft && (!bDef.adventureBreakableWith || bDef.adventureBreakableWith !== heldTool)) {
        this.notify(
          `Adventure Mode: requires ${bDef.adventureBreakableWith ?? 'proper tool'} to break ${bDef.name}.`,
          'warning'
        );
        return;
      }
    }

    this.chunkManager.setBlock(x, y, z, BLOCK.AIR, true);
    if (
      blockId === BLOCK.SPARK_WIRE ||
      blockId === BLOCK.SPARK_WIRE_ON ||
      blockId === BLOCK.SPARK_LEVER ||
      blockId === BLOCK.SPARK_LAMP ||
      blockId === BLOCK.SPARK_LAMP_ON
    ) {
      this.chunkManager.propagateSparkstone();
    }
    this.chunkManager.rebuildImmediateAt(x, z);
    this.audio.playBlockBreak();

    // Spawn particles
    const partCol =
      blockId === BLOCK.GRASS
        ? 0x58a846
        : blockId === BLOCK.SAND
        ? 0xe3cf94
        : blockId === BLOCK.CRYSTAL_ORE
        ? 0x38bdf8
        : blockId === BLOCK.OAK_LOG
        ? 0x6b492c
        : 0x7f8691;
    this.entityManager.spawnBreakParticles(x, y, z, partCol, 10);

    // Clear furnace/chest metadata if broken
    const k = blockKey(x, y, z);
    this.furnaces.delete(k);
    this.chests.delete(k);

    if (!instantCreative) {
      if (canHarvestBlock(blockId, held)) {
        const dropId = bDef.dropsItemId ?? blockId;
        let dropCount = bDef.dropsCount ?? 1;
        const fortune = getEnchantLevel(held, 'fortune');
        if (fortune > 0 && dropId >= 100 && Math.random() < fortune * 0.35) {
          dropCount += 1;
        }
        if (dropId !== BLOCK.AIR) {
          this.entityManager.spawnDrop(dropId, dropCount, x + 0.5, y + 0.35, z + 0.5);
        }
        if (bDef.bonusDropItemId && Math.random() < (bDef.bonusDropChance ?? 0)) {
          this.entityManager.spawnDrop(bDef.bonusDropItemId, 1, x + 0.5, y + 0.4, z + 0.5);
        }

        // XP & Objective progression
        if (isLogBlock(blockId)) {
          this.advanceObjective('obj_timber', 1);
        }
        if (
          blockId === BLOCK.COAL_ORE ||
          blockId === BLOCK.IRON_ORE ||
          blockId === BLOCK.GOLD_ORE ||
          blockId === BLOCK.CRYSTAL_ORE ||
          blockId === BLOCK.SPARKSTONE_ORE
        ) {
          this.addXp(blockId === BLOCK.CRYSTAL_ORE ? 22 : 10);
          this.advanceObjective('obj_mine', 1);
        }
        if (blockId === BLOCK.WHEAT_3) {
          this.addXp(5);
        }
      }

      if (held && getItemDef(held.itemId).toolType) {
        this.damageHeldTool();
      }
    }
  }

  private damageHeldTool() {
    if (this.saveData.meta.gameMode === 'creative') return;
    const held = this.inventory[this.selectedHotbar];
    if (!held || !held.maxDurability || held.durability === undefined) return;
    const unbreaking = getEnchantLevel(held, 'unbreaking');
    if (unbreaking > 0 && Math.random() < unbreaking * 0.25) return;
    held.durability -= 1;
    if (held.durability <= 0) {
      const name = getItemDef(held.itemId).name;
      this.inventory[this.selectedHotbar] = null;
      this.audio.playBlockBreak();
      this.notify(`Your ${name} broke!`, 'warning');
      this.updateViewmodelAppearance();
    }
    this.emitHudSnapshot();
  }

  private consumeHeldItem(amount: number) {
    const held = this.inventory[this.selectedHotbar];
    if (!held) return;
    held.count -= amount;
    if (held.count <= 0) {
      this.inventory[this.selectedHotbar] = null;
      this.updateViewmodelAppearance();
    }
  }

  public addItemToInventory(itemId: number, count: number, enchantments?: Enchantment[]): boolean {
    const def = getItemDef(itemId);
    let remaining = count;

    // 1. Stack onto existing matching stacks (only if non-enchanted stackable)
    if (def.stackSize > 1 && (!enchantments || enchantments.length === 0)) {
      for (let i = 0; i < this.inventory.length && remaining > 0; i++) {
        const slot = this.inventory[i];
        if (slot && slot.itemId === itemId && slot.count < def.stackSize && !slot.enchantments?.length) {
          const add = Math.min(remaining, def.stackSize - slot.count);
          slot.count += add;
          remaining -= add;
        }
      }
    }

    // 2. Fill empty slots
    for (let i = 0; i < this.inventory.length && remaining > 0; i++) {
      if (!this.inventory[i]) {
        const add = Math.min(remaining, def.stackSize);
        const stack = createItemStack(itemId, add);
        if (enchantments && enchantments.length > 0) {
          stack.enchantments = [...enchantments];
        }
        this.inventory[i] = stack;
        remaining -= add;
      }
    }

    this.updateViewmodelAppearance();
    this.emitHudSnapshot();
    return remaining < count;
  }

  public removeItemFromInventory(itemId: number, count: number): boolean {
    // Check availability first
    let have = 0;
    for (const s of this.inventory) {
      if (s && s.itemId === itemId) have += s.count;
    }
    if (have < count) return false;

    let rem = count;
    for (let i = 0; i < this.inventory.length && rem > 0; i++) {
      const s = this.inventory[i];
      if (s && s.itemId === itemId) {
        const take = Math.min(rem, s.count);
        s.count -= take;
        rem -= take;
        if (s.count <= 0) this.inventory[i] = null;
      }
    }
    this.updateViewmodelAppearance();
    this.emitHudSnapshot();
    return true;
  }

  public countInventoryItem(itemId: number): number {
    let total = 0;
    for (const s of this.inventory) {
      if (s && s.itemId === itemId) total += s.count;
    }
    return total;
  }

  public setInventorySlot(index: number, stack: ItemStack | null) {
    if (index < 0 || index >= this.inventory.length) return;
    this.inventory[index] = stack ? { ...stack } : null;
    if (index === this.selectedHotbar) this.updateViewmodelAppearance();
    this.emitHudSnapshot();
  }

  public swapOrMergeSlots(fromIdx: number, toIdx: number, halfSplit = false) {
    if (fromIdx === toIdx) return;
    const from = this.inventory[fromIdx];
    const to = this.inventory[toIdx];
    if (!from) return;

    if (halfSplit && from.count > 1 && !to) {
      const half = Math.ceil(from.count / 2);
      this.inventory[toIdx] = { ...from, count: half };
      from.count -= half;
    } else if (
      to &&
      to.itemId === from.itemId &&
      !to.enchantments?.length &&
      !from.enchantments?.length
    ) {
      const max = getItemDef(to.itemId).stackSize;
      const move = Math.min(from.count, max - to.count);
      if (move > 0) {
        to.count += move;
        from.count -= move;
        if (from.count <= 0) this.inventory[fromIdx] = null;
      } else {
        this.inventory[fromIdx] = to;
        this.inventory[toIdx] = from;
      }
    } else {
      this.inventory[fromIdx] = to;
      this.inventory[toIdx] = from;
    }
    this.updateViewmodelAppearance();
    this.emitHudSnapshot();
  }

  public quickCraftRecipe(recipe: CraftingRecipe): boolean {
    const ingredients = getRecipeIngredients(recipe);
    if (this.saveData.meta.gameMode !== 'creative') {
      for (const req of ingredients) {
        if (this.countInventoryItem(req.itemId) < req.count) return false;
      }
      for (const req of ingredients) {
        this.removeItemFromInventory(req.itemId, req.count);
      }
    }
    this.addItemToInventory(recipe.result.itemId, recipe.result.count);
    this.audio.playCraft();
    if (recipe.result.itemId === BLOCK.CRAFTING_TABLE) {
      this.advanceObjective('obj_timber', 6);
    }
    this.emitHudSnapshot();
    return true;
  }

  public executeTrade(offer: TradeOffer): boolean {
    if (this.saveData.meta.gameMode !== 'creative') {
      if (!this.removeItemFromInventory(offer.costItemId, offer.costCount)) {
        this.notify('Not enough items for this trade.', 'warning');
        return false;
      }
    }
    this.addItemToInventory(
      offer.rewardItemId,
      offer.rewardCount,
      offer.rewardEnchantment ? [offer.rewardEnchantment] : undefined
    );
    this.audio.playCraft();
    this.addXp(10);
    this.advanceObjective('obj_trade', 1);
    this.notify(`Traded for ${offer.rewardCount}× ${getItemDef(offer.rewardItemId).name}!`, 'success');
    this.emitHudSnapshot();
    return true;
  }

  public applyEnchantmentToSlot(slotIndex: number, enchant: Enchantment, xpCost: number, crystalCost: number): boolean {
    const item = this.inventory[slotIndex];
    if (!item) return false;
    const def = getItemDef(item.itemId);
    if (!def.toolType) {
      this.notify('Only tools and weapons can be enchanted!', 'warning');
      return false;
    }
    if (this.saveData.meta.gameMode !== 'creative') {
      if (this.level < xpCost) {
        this.notify(`Requires Level ${xpCost}!`, 'warning');
        return false;
      }
      if (this.countInventoryItem(ITEM.CRYSTAL_GEM) < crystalCost) {
        this.notify(`Requires ${crystalCost} Aether Crystal(s)!`, 'warning');
        return false;
      }
      this.level = Math.max(1, this.level - xpCost);
      this.removeItemFromInventory(ITEM.CRYSTAL_GEM, crystalCost);
    }

    const existing = item.enchantments ? [...item.enchantments] : [];
    const idx = existing.findIndex((e) => e.type === enchant.type);
    if (idx >= 0) {
      existing[idx] = { ...enchant, level: Math.max(existing[idx].level, enchant.level) };
    } else {
      existing.push({ ...enchant });
    }
    item.enchantments = existing;
    this.audio.playEnchant();
    this.notify(`Enchanted ${def.name} with ${enchant.type.toUpperCase()} ${enchant.level}!`, 'achievement');
    this.emitHudSnapshot();
    return true;
  }

  public getFurnace(key: string): FurnaceState | undefined {
    return this.furnaces.get(key);
  }

  public updateFurnace(key: string, updater: (f: FurnaceState) => void) {
    const f = this.furnaces.get(key);
    if (!f) return;
    updater(f);
    this.callbacks.onFurnaceUpdate?.({ ...f });
    this.emitHudSnapshot();
  }

  public getChest(key: string): ChestState | undefined {
    return this.chests.get(key);
  }

  public updateChest(key: string, updater: (c: ChestState) => void) {
    const c = this.chests.get(key);
    if (!c) return;
    updater(c);
    this.callbacks.onChestUpdate?.({ ...c, slots: [...c.slots] });
    this.emitHudSnapshot();
  }

  private tickFurnaces(dt: number) {
    for (const f of this.furnaces.values()) {
      let changed = false;
      if (f.burnTime > 0) {
        f.burnTime = Math.max(0, f.burnTime - dt);
        changed = true;
      }

      const recipe = f.input ? findSmeltRecipe(f.input.itemId) : undefined;
      const canOutput =
        recipe &&
        (!f.output ||
          (f.output.itemId === recipe.outputId &&
            f.output.count < getItemDef(recipe.outputId).stackSize));

      if (recipe && canOutput) {
        f.smeltTotal = recipe.smeltTime;
        // Consume fuel if needed
        if (f.burnTime <= 0 && f.fuel) {
          const fuelDur = getItemDef(f.fuel.itemId).fuelDuration;
          if (fuelDur && fuelDur > 0) {
            f.burnTime = fuelDur;
            f.maxBurnTime = fuelDur;
            f.fuel.count -= 1;
            if (f.fuel.count <= 0) f.fuel = null;
            changed = true;
          }
        }

        if (f.burnTime > 0) {
          f.smeltProgress += dt;
          changed = true;
          if (f.smeltProgress >= recipe.smeltTime) {
            f.smeltProgress = 0;
            if (f.output) {
              f.output.count += 1;
            } else {
              f.output = createItemStack(recipe.outputId, 1);
            }
            if (f.input) {
              f.input.count -= 1;
              if (f.input.count <= 0) f.input = null;
            }
            this.addXp(recipe.xp);
          }
        }
      } else if (f.smeltProgress > 0) {
        f.smeltProgress = 0;
        changed = true;
      }

      if (changed && this.activeModal.type === 'furnace' && this.activeModal.key === f.key) {
        this.callbacks.onFurnaceUpdate?.({ ...f });
      }
    }
  }

  private addXp(amount: number) {
    this.xp += amount;
    let needed = this.getXpToNextLevel();
    while (this.xp >= needed) {
      this.xp -= needed;
      this.level += 1;
      needed = this.getXpToNextLevel();
      this.audio.playLevelUp();
      this.notify(`Level Up! You reached Level ${this.level}`, 'achievement');
    }
  }

  private getXpToNextLevel(): number {
    return 40 + (this.level - 1) * 20;
  }

  private advanceObjective(objId: string, delta: number) {
    const obj = this.objectives.find((o) => o.id === objId);
    if (!obj || obj.completed) return;
    obj.progress = Math.min(obj.target, obj.progress + delta);
    if (obj.progress >= obj.target) {
      obj.completed = true;
      this.addXp(35);
      this.audio.playLevelUp();
      this.notify(`Objective Complete: ${obj.title}! (+35 XP)`, 'achievement');
    }
  }

  public damagePlayer(amount: number, source: string) {
    if (
      this.isDead ||
      this.hurtCooldown > 0 ||
      this.saveData.meta.gameMode === 'creative' ||
      this.saveData.meta.gameMode === 'spectator'
    ) {
      return;
    }
    this.hp = Math.max(0, this.hp - amount);
    this.hurtCooldown = 0.65;
    this.audio.playPlayerHurt();
    if (this.hp <= 0) {
      this.isDead = true;
      this.input.setEnabled(false);
      this.notify(`Defeated by ${source}!`, 'danger');
    }
    this.emitHudSnapshot();
  }

  public respawnPlayer() {
    this.isDead = false;
    this.hp = this.maxHp;
    this.hunger = this.maxHunger;
    this.oxygen = this.maxOxygen;
    this.px = this.saveData.player.spawnX;
    this.pz = this.saveData.player.spawnZ;
    this.py = this.chunkManager.getSurfaceY(this.px, this.pz) + 0.5;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.highestAirY = this.py;
    this.input.setEnabled(this.activeModal.type === 'none');
    this.notify('Respawned safely at Frontier Spawn!', 'info');
    this.emitHudSnapshot();
  }

  public setGameMode(mode: GameMode) {
    this.saveData.meta.gameMode = mode;
    if (mode === 'spectator') {
      this.isFlying = true;
    } else if (mode === 'survival' || mode === 'adventure') {
      this.isFlying = false;
    }
    this.notify(`Game mode switched to ${mode.toUpperCase()}`, 'info');
    this.emitHudSnapshot();
  }

  public setWeather(w: WeatherType) {
    this.weather = w;
    this.weatherTimer = 180;
    this.notify(`Weather set to ${w.toUpperCase()}`, 'info');
    this.emitHudSnapshot();
  }

  public setTimeOfDay(timeVal: number) {
    this.worldTime = ((timeVal % 24000) + 24000) % 24000;
    this.emitHudSnapshot();
  }

  public summonBossNow() {
    const dir = this.getLookDirection();
    const sx = this.px + dir.x * 11;
    const sz = this.pz + dir.z * 11;
    const sy = this.chunkManager.getSurfaceY(sx, sz);
    this.entityManager.spawnEntity('boss_warden', sx, sy + 0.5, sz);
  }

  public teleportToSpawn() {
    this.px = this.saveData.player.spawnX;
    this.pz = this.saveData.player.spawnZ;
    this.py = this.chunkManager.getSurfaceY(this.px, this.pz) + 1;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.notify('Teleported back to World Spawn!', 'info');
  }

  public updateSettings(newSettings: GameSettings) {
    this.settings = { ...newSettings };
    this.camera.fov = newSettings.fov;
    this.camera.updateProjectionMatrix();
    this.fog.far = Math.max(44, newSettings.renderDistance * 15);
    this.fog.near = Math.max(18, this.fog.far * 0.45);
    this.audio.setSettings(newSettings.masterVolume, newSettings.muted);
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, newSettings.graphicsQuality === 'high' ? 2 : 1.25)
    );
  }

  public buildSaveData(): WorldSaveData {
    const { modifiedBlocks, blockMeta } = this.chunkManager.serializeModifications();
    const furnacesObj: Record<string, FurnaceState> = {};
    this.furnaces.forEach((v, k) => {
      furnacesObj[k] = { ...v };
    });
    const chestsObj: Record<string, ChestState> = {};
    this.chests.forEach((v, k) => {
      chestsObj[k] = { ...v, slots: v.slots.map((s) => (s ? { ...s } : null)) };
    });

    this.saveData = {
      ...this.saveData,
      meta: {
        ...this.saveData.meta,
        lastPlayed: Date.now(),
        blocksModified: Object.keys(modifiedBlocks).length,
      },
      player: {
        x: this.px,
        y: this.py,
        z: this.pz,
        yaw: this.yaw,
        pitch: this.pitch,
        hp: this.hp,
        maxHp: this.maxHp,
        hunger: this.hunger,
        maxHunger: this.maxHunger,
        xp: this.xp,
        level: this.level,
        selectedHotbar: this.selectedHotbar,
        inventory: this.inventory.map((s) => (s ? { ...s } : null)),
        spawnX: this.saveData.player.spawnX,
        spawnY: this.saveData.player.spawnY,
        spawnZ: this.saveData.player.spawnZ,
      },
      worldTime: this.worldTime,
      dayCount: this.dayCount,
      weather: this.weather,
      modifiedBlocks,
      blockMeta,
      furnaces: furnacesObj,
      chests: chestsObj,
      objectives: this.objectives.map((o) => ({ ...o })),
    };
    return this.saveData;
  }

  public async saveNow(silent = false): Promise<boolean> {
    const ok = await saveWorld(this.buildSaveData());
    if (!silent) {
      this.notify(ok ? 'World saved successfully!' : 'Save warning: storage limit reached.', ok ? 'success' : 'warning');
    }
    return ok;
  }

  private loop = (now: number) => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.loop);

    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastFrameTime) / 1000));
    this.lastFrameTime = now;

    // FPS measurement
    this.fpsAccum += dt;
    this.fpsFrames++;
    if (this.fpsAccum >= 0.5) {
      this.currentFps = Math.round(this.fpsFrames / this.fpsAccum);
      this.fpsAccum = 0;
      this.fpsFrames = 0;
    }

    const paused = this.activeModal.type === 'pause' || this.activeModal.type === 'settings';
    if (!paused) {
      this.stepSimulation(dt);
    }

    this.renderer.render(this.scene, this.camera);
  };

  private stepSimulation(dt: number) {
    this.saveData.meta.playTimeSeconds += dt;
    this.hurtCooldown = Math.max(0, this.hurtCooldown - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);

    // 1. Poll Gamepad & Look controls
    this.input.pollGamepad(dt, this.settings.mouseSensitivity);
    const { dx, dy } = this.input.consumeLookDelta();
    if (!this.isDead && this.activeModal.type === 'none') {
      const sens = 0.0022 * this.settings.mouseSensitivity;
      this.yaw -= dx * sens;
      this.pitch = Math.max(-Math.PI / 2 + 0.02, Math.min(Math.PI / 2 - 0.02, this.pitch - dy * sens));
    }

    // 2. Player movement & collision physics
    const mv = this.input.getMoveVector();
    this.isCrouching = mv.crouch && !this.isFlying;
    const mode = this.saveData.meta.gameMode;
    const noClip = mode === 'spectator';

    if (!this.isDead) {
      const forwardX = -Math.sin(this.yaw);
      const forwardZ = -Math.cos(this.yaw);
      const rightX = Math.cos(this.yaw);
      const rightZ = -Math.sin(this.yaw);

      const moveDirX = forwardX * mv.forward + rightX * mv.strafe;
      const moveDirZ = forwardZ * mv.forward + rightZ * mv.strafe;

      const baseSpeed = this.isFlying
        ? mv.sprint
          ? 15
          : 9.5
        : this.isCrouching
        ? 2.4
        : mv.sprint && (this.hunger > 4 || mode === 'creative')
        ? 6.9
        : 4.7;

      const speedMult = this.inWater && !this.isFlying ? 0.62 : 1.0;
      const targetVx = moveDirX * baseSpeed * speedMult;
      const targetVz = moveDirZ * baseSpeed * speedMult;

      const accel = this.onGround || this.isFlying ? 14 : 4.5;
      this.vx += (targetVx - this.vx) * Math.min(1, accel * dt);
      this.vz += (targetVz - this.vz) * Math.min(1, accel * dt);

      if (this.isFlying) {
        let targetVy = 0;
        if (mv.jump) targetVy += 7.5;
        if (mv.crouch) targetVy -= 7.5;
        this.vy += (targetVy - this.vy) * Math.min(1, 10 * dt);
      } else if (this.inWater) {
        this.vy -= 6.5 * dt;
        if (mv.jump) this.vy = Math.min(4.6, this.vy + 22 * dt);
        this.vy = Math.max(-4.5, Math.min(4.8, this.vy));
      } else {
        this.vy -= 23.5 * dt;
        if (mv.jump && this.onGround) {
          this.vy = 8.45;
          this.onGround = false;
        }
      }

      const prevX = this.px;
      const prevZ = this.pz;
      const wasGrounded = this.onGround;

      const res = stepPhysics(
        {
          x: this.px,
          y: this.py,
          z: this.pz,
          halfW: PLAYER_HALF_W,
          height: PLAYER_HEIGHT,
        },
        this.vx,
        this.vy,
        this.vz,
        dt,
        (wx, y, wz) => this.chunkManager.getBlock(wx, y, wz),
        this.isCrouching,
        noClip
      );

      this.px = res.x;
      this.py = Math.max(1.2, Math.min(CHUNK_HEIGHT + 18, res.y));
      this.pz = res.z;
      this.vx = res.vx;
      this.vy = res.vy;
      this.vz = res.vz;
      this.onGround = res.onGround;
      this.inWater = res.inWater;
      this.headInWater = res.headInWater;

      // Fall damage check
      if (!this.onGround && !this.inWater && !this.isFlying) {
        this.highestAirY = Math.max(this.highestAirY, this.py);
      } else {
        if (!wasGrounded && this.onGround && !this.inWater && !this.isFlying) {
          const fallDist = this.highestAirY - this.py;
          if (fallDist > 4.4) {
            const dmg = Math.floor((fallDist - 3.6) * 1.35);
            if (dmg > 0) this.damagePlayer(dmg, 'Falling');
          }
        }
        this.highestAirY = this.py;
      }

      // Footsteps & Walk bobbing
      const horizMoved = Math.hypot(this.px - prevX, this.pz - prevZ);
      if (this.onGround && horizMoved > 0.002 && !this.isFlying) {
        this.stepDistAccum += horizMoved;
        this.walkBobPhase += horizMoved * 3.1;
        if (this.stepDistAccum > 1.75) {
          this.stepDistAccum = 0;
          const under = this.chunkManager.getBlock(Math.floor(this.px), Math.floor(this.py - 0.3), Math.floor(this.pz));
          const mat =
            this.inWater
              ? 'water'
              : under === BLOCK.STONE || under === BLOCK.COBBLESTONE
              ? 'stone'
              : under === BLOCK.PLANKS || under === BLOCK.OAK_LOG
              ? 'wood'
              : under === BLOCK.SAND
              ? 'sand'
              : 'grass';
          this.audio.playStep(mat);
        }
      }

      // Survival Hunger, Oxygen & Natural Health Regen
      if (mode === 'survival' || mode === 'adventure') {
        const effort = horizMoved * (mv.sprint ? 0.12 : 0.04) + dt * 0.015;
        this.hungerTimer += effort;
        if (this.hungerTimer >= 4.0) {
          this.hungerTimer = 0;
          this.hunger = Math.max(0, this.hunger - 1);
        }

        if (this.hunger >= 15 && this.hp < this.maxHp) {
          this.regenTimer += dt;
          if (this.regenTimer >= 3.2) {
            this.regenTimer = 0;
            this.hp = Math.min(this.maxHp, this.hp + 1);
          }
        } else if (this.hunger === 0 && this.hp > 1) {
          this.regenTimer += dt;
          if (this.regenTimer >= 4.0) {
            this.regenTimer = 0;
            this.damagePlayer(1, 'Starvation');
          }
        }

        if (this.headInWater) {
          this.oxygen = Math.max(0, this.oxygen - dt * 2.2);
          if (this.oxygen <= 0) {
            this.damagePlayer(2, 'Drowning');
          }
        } else {
          this.oxygen = Math.min(this.maxOxygen, this.oxygen + dt * 5);
        }
      }
    }

    // 3. Camera Transform & Viewmodel Bob/Swing
    const eyeY = this.getEyeY();
    const bobY = this.onGround && !this.isFlying ? Math.sin(this.walkBobPhase * 2) * 0.035 : 0;
    this.camera.position.set(this.px, eyeY + bobY, this.pz);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');

    this.swingAnim = Math.max(0, this.swingAnim - dt * 5.2);
    const swing = Math.sin(this.swingAnim * Math.PI);
    this.viewmodelGroup.visible = mode !== 'spectator';
    this.viewmodelMesh.position.set(
      0.46 - swing * 0.14,
      -0.38 - Math.abs(Math.sin(this.walkBobPhase)) * 0.03 - swing * 0.08,
      -0.62 - swing * 0.18
    );
    this.viewmodelMesh.rotation.set(0.25 - swing * 0.9, -0.45 + swing * 0.3, 0.12);

    // 4. Raycast Targets (Blocks + Entities)
    const lookDir = this.getLookDirection();
    this.lastBlockHit = raycastVoxels(
      this.px,
      eyeY,
      this.pz,
      lookDir.x,
      lookDir.y,
      lookDir.z,
      REACH_DISTANCE,
      (wx, y, wz) => this.chunkManager.getBlock(wx, y, wz)
    );
    const entityHit = this.entityManager.raycastEntity(
      this.px,
      eyeY,
      this.pz,
      lookDir.x,
      lookDir.y,
      lookDir.z,
      4.5
    );
    if (entityHit && (!this.lastBlockHit || entityHit.distance < this.lastBlockHit.distance)) {
      this.lastEntityHit = entityHit;
    } else {
      this.lastEntityHit = null;
    }

    // Highlight box
    if (this.lastBlockHit && !this.lastEntityHit && mode !== 'spectator') {
      this.highlightBox.visible = true;
      this.highlightBox.position.set(
        this.lastBlockHit.x + 0.5,
        this.lastBlockHit.y + 0.5,
        this.lastBlockHit.z + 0.5
      );
    } else {
      this.highlightBox.visible = false;
    }

    // 5. Continuous Survival/Adventure Block Mining
    if (
      mv.mineHeld &&
      this.lastBlockHit &&
      !this.lastEntityHit &&
      mode !== 'creative' &&
      mode !== 'spectator' &&
      !this.isDead
    ) {
      const { x, y, z, blockId } = this.lastBlockHit;
      const key = blockKey(x, y, z);
      const req = computeMiningTime(blockId, this.getHeldItem());
      if (req < Infinity) {
        if (this.miningKey !== key) {
          this.miningKey = key;
          this.miningElapsed = 0;
          this.miningRequired = req;
        }
        this.miningElapsed += dt;
        this.swingAnim = Math.max(this.swingAnim, 0.45);
        this.mineSoundTimer += dt;
        if (this.mineSoundTimer >= 0.22) {
          this.mineSoundTimer = 0;
          this.audio.playMineTick();
        }
        const progress = Math.min(1, this.miningElapsed / this.miningRequired);
        const stage = Math.min(7, Math.floor(progress * 8));
        this.crackMat.map = getAtlasBundle().crackTextures[stage];
        this.crackMat.needsUpdate = true;
        this.crackBox.visible = true;
        this.crackBox.position.set(x + 0.5, y + 0.5, z + 0.5);

        if (this.miningElapsed >= this.miningRequired) {
          this.breakBlockAt(x, y, z, false);
          this.miningKey = '';
          this.miningElapsed = 0;
          this.crackBox.visible = false;
        }
      } else {
        this.crackBox.visible = false;
      }
    } else {
      this.miningKey = '';
      this.miningElapsed = 0;
      this.crackBox.visible = false;
    }

    // 6. Chunk Streaming, Farming, Furnaces, Entities, Day/Night & Weather
    this.chunkManager.updateStreaming(this.px, this.pz, this.settings.renderDistance, false);
    this.chunkManager.tickFarming(dt, this.weather === 'rain' || this.weather === 'storm');
    this.tickFurnaces(dt);

    const isNight = this.worldTime >= 12800 && this.worldTime <= 23200;
    this.entityManager.update(
      dt,
      this.px,
      this.py,
      this.pz,
      mode,
      isNight,
      (wx, y, wz) => this.chunkManager.getBlock(wx, y, wz),
      (wx, wz) => this.chunkManager.getSurfaceY(wx, wz)
    );

    this.updateDayNightAndWeather(dt);

    // 7. Periodic Autosave (every 45s)
    this.autoSaveTimer += dt;
    if (this.autoSaveTimer >= 45) {
      this.autoSaveTimer = 0;
      this.saveNow(true);
    }

    // 8. Throttled HUD Snapshot emission (~12 Hz)
    this.hudEmitTimer += dt;
    if (this.hudEmitTimer >= 0.08) {
      this.hudEmitTimer = 0;
      this.emitHudSnapshot();
    }
  }

  private updateDayNightAndWeather(dt: number) {
    // Advance day/night (24000 ticks ~ 10 minutes real time)
    this.worldTime += dt * 40;
    if (this.worldTime >= 24000) {
      this.worldTime -= 24000;
      this.dayCount += 1;
      this.notify(`Dawn of Day ${this.dayCount}`, 'info');
    }

    // Weather transitions
    if (this.settings.enableWeather) {
      this.weatherTimer -= dt;
      if (this.weatherTimer <= 0) {
        this.weatherTimer = 110 + Math.random() * 140;
        const r = Math.random();
        const biome = this.chunkManager.getBiomeAt(this.px, this.pz);
        if (r < 0.62) {
          this.weather = 'clear';
        } else if (r < 0.88) {
          this.weather = biome === 'tundra' ? 'snow' : 'rain';
        } else {
          this.weather = biome === 'tundra' ? 'snow' : 'storm';
        }
      }
    } else {
      this.weather = 'clear';
    }

    const angle = (this.worldTime / 24000) * Math.PI * 2;
    const sunElev = Math.sin(angle); // +1 noon, -1 midnight
    const dayFactor = Math.max(0, Math.min(1, (sunElev + 0.18) / 0.72));
    const duskFactor = Math.max(0, 1 - Math.abs(sunElev) * 4.5);

    this.skyGroup.position.set(this.px, this.py, this.pz);
    const orbitR = 115;
    this.sunMesh.position.set(Math.cos(angle) * orbitR, Math.sin(angle) * orbitR, -20);
    this.moonMesh.position.set(-Math.cos(angle) * orbitR, -Math.sin(angle) * orbitR, 20);
    (this.starField.material as THREE.PointsMaterial).opacity = Math.max(0, (1 - dayFactor) * 0.9);

    // Sky color blending
    const daySky = new THREE.Color(0x73b9f5);
    const nightSky = new THREE.Color(0x0b1226);
    const duskSky = new THREE.Color(0xe9825c);
    const skyColor = nightSky.clone().lerp(daySky, dayFactor);
    if (duskFactor > 0.05) skyColor.lerp(duskSky, duskFactor * 0.45);

    if (this.weather === 'rain' || this.weather === 'storm') {
      skyColor.multiplyScalar(this.weather === 'storm' ? 0.52 : 0.72);
    }

    // Occasional storm lightning
    this.lightningFlash = Math.max(0, this.lightningFlash - dt * 3.5);
    if (this.weather === 'storm' && Math.random() < dt * 0.09) {
      this.lightningFlash = 1.0;
      this.audio.playThunder();
    }
    if (this.lightningFlash > 0) {
      skyColor.lerp(new THREE.Color(0xffffff), this.lightningFlash * 0.65);
    }

    // Underwater fog override
    if (this.headInWater) {
      const uw = new THREE.Color(0x164e87);
      this.scene.background = uw;
      this.fog.color.copy(uw);
      this.fog.near = 2;
      this.fog.far = 16;
    } else {
      this.scene.background = skyColor;
      this.fog.color.copy(skyColor);
      const maxFog = Math.max(44, this.settings.renderDistance * 15);
      this.fog.far = this.weather === 'storm' ? maxFog * 0.68 : maxFog;
      this.fog.near = this.fog.far * 0.44;
    }

    // Directional & Hemisphere light intensities
    this.sunLight.position.set(
      this.px + Math.cos(angle) * 50,
      this.py + Math.max(15, Math.abs(Math.sin(angle)) * 65),
      this.pz + 24
    );
    const stormDim = this.weather === 'storm' ? 0.65 : this.weather === 'rain' ? 0.82 : 1.0;
    this.sunLight.intensity = (0.14 + dayFactor * 0.85) * stormDim + this.lightningFlash * 0.7;
    this.hemiLight.intensity = (0.28 + dayFactor * 0.62) * stormDim;

    // Weather particles animation
    const biome = this.chunkManager.getBiomeAt(this.px, this.pz);
    const showPrecip =
      this.weather !== 'clear' && biome !== 'desert' && !this.headInWater;
    this.weatherPoints.visible = showPrecip;
    if (showPrecip) {
      const isSnow = this.weather === 'snow' || biome === 'tundra';
      const pMat = this.weatherPoints.material as THREE.PointsMaterial;
      pMat.color.setHex(isSnow ? 0xffffff : 0x93c5fd);
      pMat.size = isSnow ? 0.28 : 0.18;

      const fallSpeed = isSnow ? 3.8 : this.weather === 'storm' ? 22 : 15;
      const arr = this.weatherPositions;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 1] -= fallSpeed * dt;
        if (isSnow) arr[i] += Math.sin(this.worldTime * 0.05 + i) * dt * 0.8;
        if (arr[i + 1] < -4) {
          arr[i] = (Math.random() - 0.5) * 32;
          arr[i + 1] = 18 + Math.random() * 6;
          arr[i + 2] = (Math.random() - 0.5) * 32;
        }
      }
      this.weatherPoints.position.set(this.px, this.py, this.pz);
      (this.weatherPoints.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  public emitHudSnapshot() {
    let target: TargetInfo = { type: 'none' };
    if (this.lastEntityHit) {
      const e = this.lastEntityHit.entity;
      target = {
        type: 'entity',
        entityId: e.id,
        entityName: e.name,
        entityHp: Math.ceil(e.hp),
        entityMaxHp: e.maxHp,
        entityKind: e.kind,
        interactPrompt: e.isNpc ? `[Right-Click / F] Trade with ${e.name}` : undefined,
      };
    } else if (this.lastBlockHit) {
      const bDef = getItemDef(this.lastBlockHit.blockId);
      let interactPrompt: string | undefined;
      if (bDef.interactable === 'crafting_table') interactPrompt = '[Right-Click / F] Open Workbench';
      else if (bDef.interactable === 'furnace') interactPrompt = '[Right-Click / F] Open Stone Furnace';
      else if (bDef.interactable === 'chest') interactPrompt = '[Right-Click / F] Open Storage Chest';
      else if (bDef.interactable === 'enchant_altar') interactPrompt = '[Right-Click / F] Open Enchanting Altar';
      else if (bDef.interactable === 'lever') interactPrompt = '[Right-Click / F] Flip Sparkstone Lever';

      target = {
        type: 'block',
        x: this.lastBlockHit.x,
        y: this.lastBlockHit.y,
        z: this.lastBlockHit.z,
        blockId: this.lastBlockHit.blockId,
        blockName: bDef.name,
        interactPrompt,
        breakProgress: this.miningRequired > 0 ? Math.min(1, this.miningElapsed / this.miningRequired) : 0,
      };
    }

    this.callbacks.onHudUpdate({
      hp: Math.ceil(this.hp),
      maxHp: this.maxHp,
      hunger: Math.ceil(this.hunger),
      maxHunger: this.maxHunger,
      oxygen: Math.ceil(this.oxygen),
      maxOxygen: this.maxOxygen,
      xp: Math.floor(this.xp),
      xpToNext: this.getXpToNextLevel(),
      level: this.level,
      gameMode: this.saveData.meta.gameMode,
      x: Math.floor(this.px),
      y: Math.floor(this.py),
      z: Math.floor(this.pz),
      biome: this.chunkManager.getBiomeAt(this.px, this.pz),
      worldTime: this.worldTime,
      dayCount: this.dayCount,
      weather: this.weather,
      fps: this.currentFps,
      loadedChunks: this.chunkManager.chunks.size,
      entityCount: this.entityManager.entities.length,
      isFlying: this.isFlying,
      isUnderwater: this.headInWater,
      isDead: this.isDead,
      pointerLocked: this.input.pointerLocked,
      selectedHotbar: this.selectedHotbar,
      inventory: this.inventory.map((s) => (s ? { ...s } : null)),
      target,
      activeBoss: this.entityManager.getActiveBoss(),
      objectives: this.objectives.map((o) => ({ ...o })),
      gamepadConnected: this.input.gamepadConnected,
    });
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.onResize);
    this.input.dispose();
    this.chunkManager.disposeAll();
    this.entityManager.disposeAll();
    this.renderer.dispose();
  }
}
