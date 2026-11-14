export type GameMode = 'survival' | 'creative' | 'adventure' | 'spectator';

export type BiomeType =
  | 'plains'
  | 'forest'
  | 'desert'
  | 'mountains'
  | 'tundra'
  | 'swamp';

export type WeatherType = 'clear' | 'rain' | 'storm' | 'snow';

export type ToolCategory = 'none' | 'pickaxe' | 'axe' | 'shovel' | 'sword' | 'hoe';

export type EnchantmentType = 'efficiency' | 'sharpness' | 'unbreaking' | 'fortune';

export interface Enchantment {
  type: EnchantmentType;
  level: number; // 1..3
}

export interface ItemStack {
  itemId: number;
  count: number;
  durability?: number;
  maxDurability?: number;
  enchantments?: Enchantment[];
}

export type BlockRenderType = 'cube' | 'cross' | 'torch' | 'wire' | 'lever' | 'crop';

export interface BlockFaceTiles {
  top: number;
  bottom: number;
  side: number;
  front?: number;
}

export interface ItemDefinition {
  id: number;
  key: string;
  name: string;
  category: 'block' | 'tool' | 'resource' | 'food' | 'redstone' | 'special';
  isBlock: boolean;
  blockId?: number;
  stackSize: number;
  // Block properties
  solid?: boolean;
  transparent?: boolean;
  liquid?: boolean;
  hardness?: number; // seconds with bare hand; -1 = unbreakable
  preferredTool?: ToolCategory;
  minToolTier?: number; // 0=hand, 1=wood, 2=stone, 3=iron, 4=crystal
  dropsItemId?: number;
  dropsCount?: number;
  bonusDropItemId?: number;
  bonusDropChance?: number;
  lightLevel?: number; // 0..15
  renderType?: BlockRenderType;
  faces?: BlockFaceTiles;
  interactable?: 'crafting_table' | 'furnace' | 'chest' | 'enchant_altar' | 'lever';
  adventureBreakableWith?: ToolCategory;
  // Tool properties
  toolType?: ToolCategory;
  toolTier?: number; // 1=wood, 2=stone, 3=iron, 4=gold, 5=crystal
  miningSpeed?: number;
  attackDamage?: number;
  maxDurability?: number;
  // Food properties
  hungerRestore?: number;
  healthRestore?: number;
  // Smelting fuel value (seconds)
  fuelDuration?: number;
  // Visual description
  description?: string;
}

export interface CraftingRecipe {
  id: string;
  name: string;
  result: { itemId: number; count: number };
  // If pattern is provided, it's shaped (1x1 up to 3x3). Otherwise shapeless ingredients list.
  pattern?: string[];
  key?: Record<string, number>;
  shapeless?: { itemId: number; count: number }[];
  requiresTable: boolean;
  category: 'basics' | 'tools' | 'building' | 'redstone' | 'food' | 'advanced';
}

export interface SmeltRecipe {
  inputId: number;
  outputId: number;
  smeltTime: number; // seconds
  xp: number;
}

export interface FurnaceState {
  key: string; // "x,y,z"
  input: ItemStack | null;
  fuel: ItemStack | null;
  output: ItemStack | null;
  burnTime: number;
  maxBurnTime: number;
  smeltProgress: number;
  smeltTotal: number;
}

export interface ChestState {
  key: string; // "x,y,z"
  slots: (ItemStack | null)[]; // 18 slots
}

export interface TradeOffer {
  id: string;
  costItemId: number;
  costCount: number;
  rewardItemId: number;
  rewardCount: number;
  rewardEnchantment?: Enchantment;
  label: string;
}

export type EntityKind =
  | 'sheep'
  | 'boar'
  | 'stag'
  | 'stalker'
  | 'archer'
  | 'slime'
  | 'trader'
  | 'boss_warden';

export interface EntitySnapshot {
  id: string;
  kind: EntityKind;
  name: string;
  hostile: boolean;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  z: number;
  isBoss?: boolean;
}

export interface AdventureObjective {
  id: string;
  title: string;
  description: string;
  target: number;
  progress: number;
  completed: boolean;
}

export interface GameSettings {
  renderDistance: number; // 3..6 chunks
  fov: number; // 60..100
  mouseSensitivity: number; // 0.3..2.0
  masterVolume: number; // 0..1
  muted: boolean;
  enableWeather: boolean;
  showDebugHud: boolean;
  touchControls: 'auto' | 'on' | 'off';
  graphicsQuality: 'high' | 'medium';
}

export interface WorldMetadata {
  id: string;
  name: string;
  seed: string;
  gameMode: GameMode;
  createdAt: number;
  lastPlayed: number;
  playTimeSeconds: number;
  biomeAtSpawn?: BiomeType;
  blocksModified?: number;
}

export interface WorldSaveData {
  meta: WorldMetadata;
  player: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    hp: number;
    maxHp: number;
    hunger: number;
    maxHunger: number;
    xp: number;
    level: number;
    selectedHotbar: number;
    inventory: (ItemStack | null)[]; // 36 slots (0-8 hotbar, 9-35 main)
    spawnX: number;
    spawnY: number;
    spawnZ: number;
  };
  worldTime: number; // 0..24000 (0=dawn, 6000=noon, 12000=dusk, 18000=midnight)
  dayCount: number;
  weather: WeatherType;
  modifiedBlocks: Record<string, number>; // "x,y,z" -> blockId
  blockMeta: Record<string, number>; // "x,y,z" -> metadata (e.g. lever on/off, crop age, spark power)
  furnaces: Record<string, FurnaceState>;
  chests: Record<string, ChestState>;
  objectives: AdventureObjective[];
}

export interface GameNotification {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'danger' | 'achievement';
  timestamp: number;
}

export interface TargetInfo {
  type: 'none' | 'block' | 'entity';
  x?: number;
  y?: number;
  z?: number;
  blockId?: number;
  blockName?: string;
  interactPrompt?: string;
  breakProgress?: number; // 0..1
  entityId?: string;
  entityName?: string;
  entityHp?: number;
  entityMaxHp?: number;
  entityKind?: EntityKind;
}

export interface HudSnapshot {
  hp: number;
  maxHp: number;
  hunger: number;
  maxHunger: number;
  oxygen: number;
  maxOxygen: number;
  xp: number;
  xpToNext: number;
  level: number;
  gameMode: GameMode;
  x: number;
  y: number;
  z: number;
  biome: BiomeType;
  worldTime: number;
  dayCount: number;
  weather: WeatherType;
  fps: number;
  loadedChunks: number;
  entityCount: number;
  isFlying: boolean;
  isUnderwater: boolean;
  isDead: boolean;
  pointerLocked: boolean;
  selectedHotbar: number;
  inventory: (ItemStack | null)[];
  target: TargetInfo;
  activeBoss: { name: string; hp: number; maxHp: number } | null;
  objectives: AdventureObjective[];
  gamepadConnected: boolean;
}

export type ActiveModal =
  | { type: 'none' }
  | { type: 'inventory'; tableMode: boolean }
  | { type: 'furnace'; key: string }
  | { type: 'chest'; key: string }
  | { type: 'enchant' }
  | { type: 'trader'; entityId: string; traderName: string }
  | { type: 'pause' }
  | { type: 'settings' };
