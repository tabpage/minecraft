import { BLOCK, createItemStack, ITEM } from './blocks';
import {
  AdventureObjective,
  GameMode,
  GameSettings,
  ItemStack,
  WorldMetadata,
  WorldSaveData,
} from './types';

const DB_NAME = 'terravex_worlds_db_v1';
const STORE_NAME = 'worlds';
const LS_PREFIX = 'terravex_world_';
const LS_INDEX = 'terravex_world_index';
const LS_SETTINGS = 'terravex_settings_v1';

export const DEFAULT_SETTINGS: GameSettings = {
  renderDistance: 4,
  fov: 75,
  mouseSensitivity: 1.0,
  masterVolume: 0.65,
  muted: false,
  enableWeather: true,
  showDebugHud: true,
  touchControls: 'auto',
  graphicsQuality: 'high',
};

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(LS_SETTINGS);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(LS_SETTINGS, JSON.stringify(settings));
  } catch {
    // Ignore quota failures on settings
  }
}

function openDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'meta.id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function listWorlds(): Promise<WorldMetadata[]> {
  const db = await openDB();
  if (db) {
    try {
      const metas = await new Promise<WorldMetadata[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
          const all = (req.result as WorldSaveData[]) || [];
          resolve(all.map((w) => w.meta));
        };
        req.onerror = () => reject(req.error);
      });
      return metas.sort((a, b) => b.lastPlayed - a.lastPlayed);
    } catch {
      // Fallback below
    }
  }

  try {
    const idxRaw = localStorage.getItem(LS_INDEX);
    const ids: string[] = idxRaw ? JSON.parse(idxRaw) : [];
    const metas: WorldMetadata[] = [];
    for (const id of ids) {
      const raw = localStorage.getItem(LS_PREFIX + id);
      if (raw) {
        const parsed = JSON.parse(raw) as WorldSaveData;
        if (parsed?.meta) metas.push(parsed.meta);
      }
    }
    return metas.sort((a, b) => b.lastPlayed - a.lastPlayed);
  } catch {
    return [];
  }
}

export async function loadWorld(id: string): Promise<WorldSaveData | null> {
  const db = await openDB();
  if (db) {
    try {
      const res = await new Promise<WorldSaveData | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(id);
        req.onsuccess = () => resolve((req.result as WorldSaveData) || null);
        req.onerror = () => reject(req.error);
      });
      if (res) return res;
    } catch {
      // Fallback below
    }
  }

  try {
    const raw = localStorage.getItem(LS_PREFIX + id);
    return raw ? (JSON.parse(raw) as WorldSaveData) : null;
  } catch {
    return null;
  }
}

export async function saveWorld(data: WorldSaveData): Promise<boolean> {
  data.meta.lastPlayed = Date.now();
  data.meta.blocksModified = Object.keys(data.modifiedBlocks).length;

  const db = await openDB();
  if (db) {
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(data);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      return true;
    } catch {
      // Fall through to localStorage
    }
  }

  try {
    localStorage.setItem(LS_PREFIX + data.meta.id, JSON.stringify(data));
    const idxRaw = localStorage.getItem(LS_INDEX);
    const ids: string[] = idxRaw ? JSON.parse(idxRaw) : [];
    if (!ids.includes(data.meta.id)) {
      ids.push(data.meta.id);
      localStorage.setItem(LS_INDEX, JSON.stringify(ids));
    }
    return true;
  } catch {
    return false;
  }
}

export async function deleteWorld(id: string): Promise<void> {
  const db = await openDB();
  if (db) {
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      // ignore
    }
  }

  try {
    localStorage.removeItem(LS_PREFIX + id);
    const idxRaw = localStorage.getItem(LS_INDEX);
    const ids: string[] = idxRaw ? JSON.parse(idxRaw) : [];
    localStorage.setItem(
      LS_INDEX,
      JSON.stringify(ids.filter((x) => x !== id))
    );
  } catch {
    // ignore
  }
}

export function createStarterInventory(mode: GameMode): (ItemStack | null)[] {
  const inv: (ItemStack | null)[] = new Array(36).fill(null);

  if (mode === 'creative') {
    inv[0] = createItemStack(BLOCK.GRASS, 64);
    inv[1] = createItemStack(BLOCK.COBBLESTONE, 64);
    inv[2] = createItemStack(BLOCK.PLANKS, 64);
    inv[3] = createItemStack(BLOCK.BRICK, 64);
    inv[4] = createItemStack(BLOCK.GLASS, 64);
    inv[5] = createItemStack(BLOCK.TORCH, 64);
    inv[6] = createItemStack(BLOCK.SPARK_LEVER, 16);
    inv[7] = createItemStack(ITEM.SPARK_DUST, 64);
    inv[8] = createItemStack(BLOCK.SPARK_LAMP, 32);
    inv[9] = createItemStack(BLOCK.CRAFTING_TABLE, 1);
    inv[10] = createItemStack(BLOCK.FURNACE, 1);
    inv[11] = createItemStack(BLOCK.CHEST, 1);
    inv[12] = createItemStack(BLOCK.ENCHANT_ALTAR, 1);
    inv[13] = createItemStack(ITEM.CRYSTAL_SWORD, 1);
    inv[14] = createItemStack(ITEM.SUMMON_TOTEM, 2);
  } else if (mode === 'adventure') {
    inv[0] = createItemStack(ITEM.IRON_SWORD, 1);
    inv[1] = createItemStack(ITEM.STONE_PICKAXE, 1);
    inv[2] = createItemStack(ITEM.STONE_AXE, 1);
    inv[3] = createItemStack(ITEM.WOOD_HOE, 1);
    inv[4] = createItemStack(ITEM.BREAD, 8);
    inv[5] = createItemStack(BLOCK.TORCH, 16);
    inv[6] = createItemStack(ITEM.WHEAT_SEEDS, 6);
    inv[7] = createItemStack(ITEM.GOLD_INGOT, 4);
  } else if (mode === 'survival') {
    inv[0] = createItemStack(ITEM.WOOD_AXE, 1);
    inv[1] = createItemStack(ITEM.WOOD_PICKAXE, 1);
    inv[2] = createItemStack(ITEM.APPLE, 4);
    inv[3] = createItemStack(BLOCK.TORCH, 8);
  }

  return inv;
}

export function createDefaultObjectives(): AdventureObjective[] {
  return [
    {
      id: 'obj_timber',
      title: 'Frontier Foundations',
      description: 'Harvest 6 logs of timber or craft a Workbench',
      target: 6,
      progress: 0,
      completed: false,
    },
    {
      id: 'obj_mine',
      title: 'Deep Vein Prospector',
      description: 'Mine 5 ore blocks (Coal, Iron, Gold, Crystal, or Sparkstone)',
      target: 5,
      progress: 0,
      completed: false,
    },
    {
      id: 'obj_trade',
      title: 'Outpost Diplomacy',
      description: 'Complete 1 trade with a Frontier Villager Merchant (NE Outpost)',
      target: 1,
      progress: 0,
      completed: false,
    },
    {
      id: 'obj_farm',
      title: 'Golden Harvest',
      description: 'Till farmland with a hoe or plant 3 wheat seeds',
      target: 3,
      progress: 0,
      completed: false,
    },
    {
      id: 'obj_boss',
      title: 'Slay the Obsidian Warden',
      description: 'Summon (or find at NW Shrine) and defeat the Obsidian Warden boss',
      target: 1,
      progress: 0,
      completed: false,
    },
  ];
}

export function createNewWorldSave(
  name: string,
  seed: string,
  gameMode: GameMode
): WorldSaveData {
  const cleanSeed = seed.trim() || String(Math.floor(100000 + Math.random() * 899999));
  const id = `w_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const now = Date.now();

  return {
    meta: {
      id,
      name: name.trim() || 'Frontier Realm',
      seed: cleanSeed,
      gameMode,
      createdAt: now,
      lastPlayed: now,
      playTimeSeconds: 0,
      blocksModified: 0,
    },
    player: {
      x: 0.5,
      y: 30,
      z: 0.5,
      yaw: 0,
      pitch: -0.1,
      hp: 20,
      maxHp: 20,
      hunger: 20,
      maxHunger: 20,
      xp: 0,
      level: 1,
      selectedHotbar: 0,
      inventory: createStarterInventory(gameMode),
      spawnX: 0.5,
      spawnY: 30,
      spawnZ: 0.5,
    },
    worldTime: 2200, // Bright sunny morning!
    dayCount: 1,
    weather: 'clear',
    modifiedBlocks: {},
    blockMeta: {},
    furnaces: {},
    chests: {},
    objectives: createDefaultObjectives(),
  };
}
