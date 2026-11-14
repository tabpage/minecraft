import { useCallback, useEffect, useRef, useState } from 'react';
import { HUD } from './components/HUD';
import { InventoryModal } from './components/InventoryModal';
import { MainMenu } from './components/MainMenu';
import {
  DeathOverlay,
  PauseMenu,
  SettingsModal,
  TouchControls,
} from './components/MenuOverlays';
import {
  ChestModal,
  EnchantModal,
  FurnaceModal,
  TraderModal,
} from './components/StationModals';
import { WorldCreator } from './components/WorldCreator';
import { GameEngine } from './engine/gameEngine';
import {
  createNewWorldSave,
  deleteWorld,
  listWorlds,
  loadSettings,
  loadWorld,
  saveSettings,
  saveWorld,
} from './engine/saveSystem';
import {
  ActiveModal,
  ChestState,
  FurnaceState,
  GameMode,
  GameNotification,
  GameSettings,
  HudSnapshot,
  WorldMetadata,
  WorldSaveData,
} from './engine/types';

type AppScreen = 'menu' | 'create' | 'playing';

function detectWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function App() {
  const [screen, setScreen] = useState<AppScreen>('menu');
  const [worlds, setWorlds] = useState<WorldMetadata[]>([]);
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());
  const [menuSettingsOpen, setMenuSettingsOpen] = useState(false);

  const [activeWorldData, setActiveWorldData] = useState<WorldSaveData | null>(null);
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [modal, setModal] = useState<ActiveModal>({ type: 'none' });
  const [notifications, setNotifications] = useState<GameNotification[]>([]);
  const [activeFurnace, setActiveFurnace] = useState<FurnaceState | null>(null);
  const [activeChest, setActiveChest] = useState<ChestState | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);

  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const isTouchDevice =
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  const showTouchUI =
    settings.touchControls === 'on' ||
    (settings.touchControls === 'auto' && isTouchDevice);

  const refreshWorlds = useCallback(async () => {
    const list = await listWorlds();
    setWorlds(list);
  }, []);

  useEffect(() => {
    refreshWorlds();
  }, [refreshWorlds]);

  const handleSettingsChange = useCallback((next: GameSettings) => {
    setSettings(next);
    saveSettings(next);
    engineRef.current?.updateSettings(next);
  }, []);

  const pushNotification = useCallback((notif: GameNotification) => {
    setNotifications((prev) => [...prev.slice(-3), notif]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
    }, 4400);
  }, []);

  const launchWorld = useCallback((save: WorldSaveData) => {
    if (!detectWebGL()) {
      setWebglError(
        'WebGL is unavailable in this browser context. Please enable hardware acceleration or use a modern WebGL-capable browser.'
      );
      return;
    }
    setWebglError(null);
    setActiveWorldData(save);
    setModal({ type: 'none' });
    setNotifications([]);
    setScreen('playing');
  }, []);

  const handleCreateWorld = useCallback(
    async (name: string, seed: string, mode: GameMode) => {
      const save = createNewWorldSave(name, seed, mode);
      await saveWorld(save);
      await refreshWorlds();
      launchWorld(save);
    },
    [launchWorld, refreshWorlds]
  );

  const handleQuickStart = useCallback(
    async (mode: GameMode) => {
      const titles: Record<GameMode, string> = {
        survival: 'Survival Frontier',
        creative: 'Creative Sandbox',
        adventure: 'Frontier Quest',
        spectator: 'World Explorer',
      };
      const seed = `TVX-${Math.floor(1000 + Math.random() * 9000)}`;
      const save = createNewWorldSave(titles[mode], seed, mode);
      await saveWorld(save);
      await refreshWorlds();
      launchWorld(save);
    },
    [launchWorld, refreshWorlds]
  );

  const handlePlayWorld = useCallback(
    async (worldId: string) => {
      const loaded = await loadWorld(worldId);
      if (loaded) launchWorld(loaded);
    },
    [launchWorld]
  );

  const handleDeleteWorld = useCallback(
    async (worldId: string) => {
      await deleteWorld(worldId);
      await refreshWorlds();
    },
    [refreshWorlds]
  );

  const handleExitToMenu = useCallback(async () => {
    if (engineRef.current) {
      await engineRef.current.saveNow(true);
      engineRef.current.dispose();
      engineRef.current = null;
    }
    setActiveWorldData(null);
    setHud(null);
    setModal({ type: 'none' });
    setActiveFurnace(null);
    setActiveChest(null);
    setScreen('menu');
    await refreshWorlds();
  }, [refreshWorlds]);

  // Mount / Unmount GameEngine when entering/leaving playing screen
  useEffect(() => {
    if (screen !== 'playing' || !activeWorldData || !canvasHostRef.current) return;

    const engine = new GameEngine(canvasHostRef.current, activeWorldData, settings, {
      onHudUpdate: (snapshot) => setHud(snapshot),
      onModalChange: (nextModal) => {
        setModal(nextModal);
        if (nextModal.type === 'furnace') {
          const f = engine.getFurnace(nextModal.key);
          setActiveFurnace(f ? { ...f } : null);
        } else {
          setActiveFurnace(null);
        }
        if (nextModal.type === 'chest') {
          const c = engine.getChest(nextModal.key);
          setActiveChest(c ? { ...c, slots: [...c.slots] } : null);
        } else {
          setActiveChest(null);
        }
      },
      onNotification: pushNotification,
      onFurnaceUpdate: (f) => setActiveFurnace({ ...f }),
      onChestUpdate: (c) => setActiveChest({ ...c, slots: [...c.slots] }),
    });

    engineRef.current = engine;

    return () => {
      engine.dispose();
      if (engineRef.current === engine) {
        engineRef.current = null;
      }
    };
    // Intentionally initialize engine once per activeWorldData launch; live settings update via updateSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, activeWorldData]);

  const closeModal = useCallback(() => {
    engineRef.current?.setModal({ type: 'none' });
  }, []);

  if (webglError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-950 p-6">
        <div className="max-w-md bg-slate-900 border border-rose-500/40 rounded-2xl p-6 text-center space-y-3">
          <h2 className="text-xl font-black text-white">3D Renderer Unavailable</h2>
          <p className="text-sm text-slate-300">{webglError}</p>
          <button
            onClick={() => setWebglError(null)}
            className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-sm cursor-pointer"
          >
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative overflow-hidden bg-slate-950">
      {screen === 'menu' && (
        <>
          <MainMenu
            worlds={worlds}
            onPlayWorld={handlePlayWorld}
            onCreateWorldClick={() => setScreen('create')}
            onQuickStart={handleQuickStart}
            onDeleteWorld={handleDeleteWorld}
            onOpenSettings={() => setMenuSettingsOpen(true)}
          />
          {menuSettingsOpen && (
            <SettingsModal
              settings={settings}
              onChange={handleSettingsChange}
              onClose={() => setMenuSettingsOpen(false)}
            />
          )}
        </>
      )}

      {screen === 'create' && (
        <WorldCreator
          onBack={() => setScreen('menu')}
          onCreate={handleCreateWorld}
        />
      )}

      {screen === 'playing' && (
        <div className="w-full h-full relative">
          {/* 3D WebGL Canvas Mount */}
          <div ref={canvasHostRef} className="w-full h-full" />

          {/* In-Game HUD */}
          {hud && (
            <HUD
              hud={hud}
              showDebug={settings.showDebugHud}
              notifications={notifications}
              onSelectHotbar={(idx) => engineRef.current?.selectHotbarSlot(idx)}
              onOpenInventory={() =>
                engineRef.current?.setModal({ type: 'inventory', tableMode: false })
              }
              onOpenPause={() => engineRef.current?.setModal({ type: 'pause' })}
              onLockCanvas={() => engineRef.current?.input.requestLock()}
            />
          )}

          {/* Mobile Touch Controls */}
          {showTouchUI && engineRef.current && modal.type === 'none' && !hud?.isDead && (
            <TouchControls engine={engineRef.current} />
          )}

          {/* Inventory & Crafting Modal */}
          {modal.type === 'inventory' && engineRef.current && hud && (
            <InventoryModal
              engine={engineRef.current}
              inventory={hud.inventory}
              gameMode={hud.gameMode}
              tableMode={modal.tableMode}
              onClose={closeModal}
            />
          )}

          {/* Stone Furnace Modal */}
          {modal.type === 'furnace' && engineRef.current && hud && activeFurnace && (
            <FurnaceModal
              engine={engineRef.current}
              furnace={activeFurnace}
              inventory={hud.inventory}
              onClose={closeModal}
            />
          )}

          {/* Storage Chest Modal */}
          {modal.type === 'chest' && engineRef.current && hud && activeChest && (
            <ChestModal
              engine={engineRef.current}
              chest={activeChest}
              inventory={hud.inventory}
              onClose={closeModal}
            />
          )}

          {/* Arcane Enchanting Altar Modal */}
          {modal.type === 'enchant' && engineRef.current && hud && (
            <EnchantModal
              engine={engineRef.current}
              inventory={hud.inventory}
              playerLevel={hud.level}
              onClose={closeModal}
            />
          )}

          {/* Frontier Villager Trader Modal */}
          {modal.type === 'trader' && engineRef.current && (
            <TraderModal
              engine={engineRef.current}
              traderName={modal.traderName}
              onClose={closeModal}
            />
          )}

          {/* Pause Menu */}
          {modal.type === 'pause' && engineRef.current && hud && activeWorldData && (
            <PauseMenu
              engine={engineRef.current}
              gameMode={hud.gameMode}
              worldName={activeWorldData.meta.name}
              seed={activeWorldData.meta.seed}
              onResume={closeModal}
              onOpenSettings={() => engineRef.current?.setModal({ type: 'settings' })}
              onExitToMenu={handleExitToMenu}
            />
          )}

          {/* In-Game Settings Modal */}
          {modal.type === 'settings' && (
            <SettingsModal
              settings={settings}
              onChange={handleSettingsChange}
              onClose={() => engineRef.current?.setModal({ type: 'pause' })}
            />
          )}

          {/* Death Respawn Overlay */}
          {hud?.isDead && (
            <DeathOverlay
              onRespawn={() => engineRef.current?.respawnPlayer()}
              onExit={handleExitToMenu}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default App;
