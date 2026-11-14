import React, { useRef, useState } from 'react';
import {
  CloudRain,
  Compass,
  Eye,
  Home,
  LogOut,
  Play,
  RotateCcw,
  Save,
  Settings,
  Shield,
  Skull,
  Sparkles,
  Sun,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { GameEngine } from '../engine/gameEngine';
import { GameMode, GameSettings, WeatherType } from '../engine/types';

// ==========================================
// 1. PAUSE MENU
// ==========================================
interface PauseMenuProps {
  engine: GameEngine;
  gameMode: GameMode;
  worldName: string;
  seed: string;
  onResume: () => void;
  onOpenSettings: () => void;
  onExitToMenu: () => void;
}

export const PauseMenu: React.FC<PauseMenuProps> = ({
  engine,
  gameMode,
  worldName,
  seed,
  onResume,
  onOpenSettings,
  onExitToMenu,
}) => {
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await engine.saveNow(false);
    setSaving(false);
  };

  const handleSaveExit = async () => {
    setSaving(true);
    await engine.saveNow(true);
    setSaving(false);
    onExitToMenu();
  };

  const modes: { id: GameMode; label: string; icon: React.ReactNode }[] = [
    { id: 'survival', label: 'Survival', icon: <Shield className="w-3.5 h-3.5" /> },
    { id: 'creative', label: 'Creative', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'adventure', label: 'Adventure', icon: <Compass className="w-3.5 h-3.5" /> },
    { id: 'spectator', label: 'Spectator', icon: <Eye className="w-3.5 h-3.5" /> },
  ];

  const weathers: WeatherType[] = ['clear', 'rain', 'storm', 'snow'];

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="text-center border-b border-slate-800 pb-3">
          <h2 className="text-2xl font-black text-white">Game Paused</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {worldName} &bull; Seed: <span className="font-mono text-emerald-300">{seed}</span>
          </p>
        </div>

        <button
          onClick={onResume}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 transition cursor-pointer"
        >
          <Play className="w-4 h-4 fill-current" />
          Resume Exploring
        </button>

        {/* Live Game Mode Switcher */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Switch Game Mode
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {modes.map((m) => (
              <button
                key={m.id}
                onClick={() => engine.setGameMode(m.id)}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border transition cursor-pointer ${
                  gameMode === m.id
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {m.icon} {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* World Time, Weather & Frontier Utilities */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 space-y-2.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Sandbox World Controls
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => {
                engine.setTimeOfDay(2500);
                onResume();
              }}
              className="py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-amber-200 font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Sun className="w-3.5 h-3.5" /> Set Morning
            </button>
            <button
              onClick={() => {
                engine.setTimeOfDay(16500);
                onResume();
              }}
              className="py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-indigo-200 font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              Nightfall
            </button>
            <button
              onClick={() => {
                engine.teleportToSpawn();
                onResume();
              }}
              className="py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Home className="w-3.5 h-3.5" /> Teleport Spawn
            </button>
            <button
              onClick={() => {
                engine.summonBossNow();
                onResume();
              }}
              className="py-1.5 px-2.5 rounded-lg bg-purple-950/80 hover:bg-purple-900 border border-purple-500/40 text-xs text-purple-200 font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Skull className="w-3.5 h-3.5" /> Summon Boss
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <CloudRain className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            {weathers.map((w) => (
              <button
                key={w}
                onClick={() => engine.setWeather(w)}
                className="flex-1 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px] capitalize text-slate-200 font-semibold cursor-pointer"
              >
                {w}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Save className="w-4 h-4 text-emerald-400" />
            {saving ? 'Saving...' : 'Save World'}
          </button>
          <button
            onClick={onOpenSettings}
            className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Settings className="w-4 h-4 text-sky-400" />
            Settings
          </button>
        </div>

        <button
          onClick={handleSaveExit}
          disabled={saving}
          className="w-full py-2.5 rounded-xl bg-rose-950/70 hover:bg-rose-900/80 border border-rose-500/40 text-rose-200 text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          Save &amp; Exit to Main Menu
        </button>
      </div>
    </div>
  );
};

// ==========================================
// 2. SETTINGS MODAL
// ==========================================
interface SettingsModalProps {
  settings: GameSettings;
  onChange: (next: GameSettings) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onChange,
  onClose,
}) => {
  const patch = (partial: Partial<GameSettings>) => {
    onChange({ ...settings, ...partial });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-sky-400" />
            <h2 className="text-base font-extrabold text-white">Game Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs text-slate-200 max-h-[75vh] overflow-y-auto">
          {/* Render Distance */}
          <div className="space-y-1">
            <div className="flex justify-between font-bold">
              <span>Chunk Render Distance</span>
              <span className="text-emerald-300 font-mono">{settings.renderDistance} chunks</span>
            </div>
            <input
              type="range"
              min={3}
              max={6}
              step={1}
              value={settings.renderDistance}
              onChange={(e) => patch({ renderDistance: Number(e.target.value) })}
              className="w-full accent-emerald-500"
            />
          </div>

          {/* Field of View */}
          <div className="space-y-1">
            <div className="flex justify-between font-bold">
              <span>Field of View (FOV)</span>
              <span className="text-emerald-300 font-mono">{settings.fov}°</span>
            </div>
            <input
              type="range"
              min={60}
              max={100}
              step={1}
              value={settings.fov}
              onChange={(e) => patch({ fov: Number(e.target.value) })}
              className="w-full accent-emerald-500"
            />
          </div>

          {/* Mouse Sensitivity */}
          <div className="space-y-1">
            <div className="flex justify-between font-bold">
              <span>Look Sensitivity</span>
              <span className="text-emerald-300 font-mono">
                {Math.round(settings.mouseSensitivity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0.3}
              max={2.0}
              step={0.1}
              value={settings.mouseSensitivity}
              onChange={(e) => patch({ mouseSensitivity: Number(e.target.value) })}
              className="w-full accent-emerald-500"
            />
          </div>

          {/* Audio Volume */}
          <div className="space-y-1">
            <div className="flex justify-between items-center font-bold">
              <span className="flex items-center gap-1.5">
                {settings.muted ? (
                  <VolumeX className="w-4 h-4 text-rose-400" />
                ) : (
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                )}
                Master Audio Volume
              </span>
              <button
                onClick={() => patch({ muted: !settings.muted })}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] cursor-pointer"
              >
                {settings.muted ? 'Unmute' : 'Mute'}
              </button>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.masterVolume}
              onChange={(e) => patch({ masterVolume: Number(e.target.value) })}
              className="w-full accent-emerald-500"
            />
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              onClick={() => patch({ enableWeather: !settings.enableWeather })}
              className={`p-2.5 rounded-xl border font-bold text-left cursor-pointer ${
                settings.enableWeather
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                  : 'bg-slate-950 border-slate-800 text-slate-400'
              }`}
            >
              Dynamic Weather: {settings.enableWeather ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={() => patch({ showDebugHud: !settings.showDebugHud })}
              className={`p-2.5 rounded-xl border font-bold text-left cursor-pointer ${
                settings.showDebugHud
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                  : 'bg-slate-950 border-slate-800 text-slate-400'
              }`}
            >
              Coords &amp; FPS HUD: {settings.showDebugHud ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={() =>
                patch({
                  graphicsQuality: settings.graphicsQuality === 'high' ? 'medium' : 'high',
                })
              }
              className="p-2.5 rounded-xl border border-slate-700 bg-slate-800/80 font-bold text-left cursor-pointer"
            >
              Graphics: {settings.graphicsQuality.toUpperCase()}
            </button>
            <button
              onClick={() => {
                const order: ('auto' | 'on' | 'off')[] = ['auto', 'on', 'off'];
                const next = order[(order.indexOf(settings.touchControls) + 1) % 3];
                patch({ touchControls: next });
              }}
              className="p-2.5 rounded-xl border border-slate-700 bg-slate-800/80 font-bold text-left cursor-pointer"
            >
              Touch UI: {settings.touchControls.toUpperCase()}
            </button>
          </div>
        </div>

        <div className="px-5 py-3 bg-slate-950/70 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 3. DEATH OVERLAY
// ==========================================
interface DeathOverlayProps {
  onRespawn: () => void;
  onExit: () => void;
}

export const DeathOverlay: React.FC<DeathOverlayProps> = ({ onRespawn, onExit }) => {
  return (
    <div className="fixed inset-0 z-40 bg-rose-950/65 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-slate-950/90 border border-rose-500/50 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
        <Skull className="w-12 h-12 text-rose-400 mx-auto" />
        <div>
          <h2 className="text-2xl font-black text-white">You Were Defeated</h2>
          <p className="text-xs text-slate-400 mt-1">
            Your inventory and builds are safe. Respawn back at the Frontier Spawn Point!
          </p>
        </div>
        <button
          onClick={onRespawn}
          className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" /> Respawn at Spawn
        </button>
        <button
          onClick={onExit}
          className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
        >
          Save &amp; Main Menu
        </button>
      </div>
    </div>
  );
};

// ==========================================
// 4. MOBILE TOUCH CONTROLS OVERLAY
// ==========================================
interface TouchControlsProps {
  engine: GameEngine;
}

export const TouchControls: React.FC<TouchControlsProps> = ({ engine }) => {
  const stickRef = useRef<HTMLDivElement | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const lookTouchRef = useRef<{ id: number; x: number; y: number } | null>(null);

  const updateStick = (clientX: number, clientY: number) => {
    const el = stickRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.38;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    setKnob({ x: dx, y: dy });
    engine.input.touchMoveX = dx / maxR;
    engine.input.touchMoveZ = dy / maxR;
  };

  const resetStick = () => {
    setKnob({ x: 0, y: 0 });
    engine.input.touchMoveX = 0;
    engine.input.touchMoveZ = 0;
  };

  return (
    <div className="fixed inset-0 z-25 pointer-events-none select-none">
      {/* Right-half invisible touch-look zone */}
      <div
        className="pointer-events-auto absolute right-0 top-14 bottom-24 w-1/2"
        onTouchStart={(e) => {
          const t = e.changedTouches[0];
          if (t && !lookTouchRef.current) {
            lookTouchRef.current = { id: t.identifier, x: t.clientX, y: t.clientY };
          }
        }}
        onTouchMove={(e) => {
          if (!lookTouchRef.current) return;
          for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            if (t.identifier === lookTouchRef.current.id) {
              engine.input.lookDeltaX += (t.clientX - lookTouchRef.current.x) * 1.9;
              engine.input.lookDeltaY += (t.clientY - lookTouchRef.current.y) * 1.9;
              lookTouchRef.current.x = t.clientX;
              lookTouchRef.current.y = t.clientY;
            }
          }
        }}
        onTouchEnd={(e) => {
          const active = lookTouchRef.current;
          if (!active) return;
          for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === active.id) {
              lookTouchRef.current = null;
              break;
            }
          }
        }}
      />

      {/* Left Virtual Movement Joystick */}
      <div
        ref={stickRef}
        className="pointer-events-auto absolute left-5 bottom-24 w-28 h-28 rounded-full bg-slate-950/50 border-2 border-slate-500/50 flex items-center justify-center backdrop-blur-sm"
        onTouchStart={(e) => {
          const t = e.changedTouches[0];
          if (t) updateStick(t.clientX, t.clientY);
        }}
        onTouchMove={(e) => {
          const t = e.changedTouches[0];
          if (t) updateStick(t.clientX, t.clientY);
        }}
        onTouchEnd={resetStick}
        onTouchCancel={resetStick}
      >
        <div
          className="w-11 h-11 rounded-full bg-emerald-400/75 border-2 border-white shadow-lg"
          style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
        />
      </div>

      {/* Right Action Buttons */}
      <div className="pointer-events-auto absolute right-5 bottom-24 flex flex-col gap-2.5 items-end">
        <div className="flex gap-2">
          <button
            onTouchStart={() => {
              engine.input.touchMine = true;
            }}
            onTouchEnd={() => {
              engine.input.touchMine = false;
            }}
            onMouseDown={() => {
              engine.input.touchMine = true;
            }}
            onMouseUp={() => {
              engine.input.touchMine = false;
            }}
            className="w-14 h-14 rounded-2xl bg-rose-600/80 active:bg-rose-500 border border-rose-300/50 text-white font-extrabold text-[11px] shadow-lg"
          >
            MINE
          </button>
          <button
            onClick={() => engine.triggerSecondaryAction()}
            className="w-14 h-14 rounded-2xl bg-sky-600/80 active:bg-sky-500 border border-sky-300/50 text-white font-extrabold text-[11px] shadow-lg"
          >
            USE
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onTouchStart={() => {
              engine.input.touchCrouch = true;
            }}
            onTouchEnd={() => {
              engine.input.touchCrouch = false;
            }}
            className="w-14 h-12 rounded-2xl bg-slate-800/80 border border-slate-500/60 text-slate-100 font-bold text-[11px]"
          >
            SNEAK
          </button>
          <button
            onTouchStart={() => {
              engine.input.touchJump = true;
            }}
            onTouchEnd={() => {
              engine.input.touchJump = false;
            }}
            className="w-14 h-12 rounded-2xl bg-emerald-600/85 border border-emerald-300/60 text-white font-extrabold text-[11px]"
          >
            JUMP
          </button>
        </div>
      </div>
    </div>
  );
};
