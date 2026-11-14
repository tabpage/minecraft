import React, { useEffect, useRef } from 'react';
import {
  Compass,
  Gamepad2,
  Hammer,
  Play,
  Plus,
  Settings,
  Shield,
  Sparkles,
  Trash2,
  Eye,
} from 'lucide-react';
import { GameMode, WorldMetadata } from '../engine/types';

interface MainMenuProps {
  worlds: WorldMetadata[];
  onPlayWorld: (worldId: string) => void;
  onCreateWorldClick: () => void;
  onQuickStart: (mode: GameMode) => void;
  onDeleteWorld: (worldId: string) => void;
  onOpenSettings: () => void;
}

const MODE_BADGE: Record<GameMode, { label: string; color: string; icon: React.ReactNode }> = {
  survival: {
    label: 'Survival',
    color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    icon: <Shield className="w-3.5 h-3.5" />,
  },
  creative: {
    label: 'Creative',
    color: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    icon: <Sparkles className="w-3.5 h-3.5" />,
  },
  adventure: {
    label: 'Adventure',
    color: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    icon: <Compass className="w-3.5 h-3.5" />,
  },
  spectator: {
    label: 'Spectator',
    color: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    icon: <Eye className="w-3.5 h-3.5" />,
  },
};

export const MainMenu: React.FC<MainMenuProps> = ({
  worlds,
  onPlayWorld,
  onCreateWorldClick,
  onQuickStart,
  onDeleteWorld,
  onOpenSettings,
}) => {
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Subtle animated procedural voxel sunset landscape backdrop
  useEffect(() => {
    const canvas = bgCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let t = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      t += 0.008;
      const w = canvas.width;
      const h = canvas.height;

      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#091024');
      grad.addColorStop(0.42, '#14294f');
      grad.addColorStop(0.72, '#2d577a');
      grad.addColorStop(1, '#0f172a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Drifting blocky clouds
      ctx.fillStyle = 'rgba(226, 232, 240, 0.1)';
      for (let i = 0; i < 8; i++) {
        const cx = ((i * 270 + t * (16 + (i % 3) * 8)) % (w + 300)) - 150;
        const cy = 65 + (i % 4) * 48;
        ctx.fillRect(cx, cy, 120 + (i % 3) * 40, 22);
      }

      // 3 Parallax voxel mountain ridges
      const drawRidge = (baseY: number, amp: number, step: number, speed: number, color: string) => {
        ctx.fillStyle = color;
        const cols = Math.ceil(w / step) + 2;
        for (let i = 0; i < cols; i++) {
          const x = i * step;
          const n =
            Math.sin((i + t * speed) * 0.14) * amp +
            Math.cos((i + t * speed) * 0.31) * (amp * 0.42);
          const bh = Math.max(24, Math.floor((baseY + n) / step) * step);
          ctx.fillRect(x, h - bh, step + 1, bh);
        }
      };

      drawRidge(h * 0.42, 70, 26, 1.4, '#132743');
      drawRidge(h * 0.31, 55, 22, 2.5, '#193550');
      drawRidge(h * 0.2, 34, 18, 4.2, '#0f2933');

      animId = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  const formatDate = (ts: number) => {
    try {
      return new Date(ts).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
      <canvas ref={bgCanvasRef} className="absolute inset-0 w-full h-full" />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/30 via-slate-950/40 to-slate-950/85" />

      <div className="relative z-10 w-full max-w-5xl px-5 py-6 flex flex-col max-h-full gap-6">
        {/* Hero Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-semibold tracking-wider uppercase">
            <Hammer className="w-3.5 h-3.5" />
            3D Procedural Voxel Sandbox Engine
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-100 to-emerald-300 drop-shadow-[0_6px_24px_rgba(16,185,129,0.3)]">
            TERRAVEX
          </h1>
          <p className="text-slate-300 text-sm md:text-base max-w-xl mx-auto">
            Explore infinite seeded biomes, mine deep crystal caverns, craft & smelt tools, wire Sparkstone circuits, trade with villagers, and challenge the Obsidian Warden.
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-0 flex-1">
          {/* Left Column: Quick Launch & Controls */}
          <div className="lg:col-span-5 flex flex-col gap-3">
            <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/70 rounded-2xl p-4 space-y-3 shadow-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                  Launch Frontier
                </h2>
                <button
                  onClick={onOpenSettings}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600/60 transition cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5" /> Settings
                </button>
              </div>

              <button
                onClick={onCreateWorldClick}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition cursor-pointer"
              >
                <Plus className="w-5 h-5" />
                Create New World
              </button>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => onQuickStart('survival')}
                  className="py-2.5 px-3 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-emerald-500/30 text-left transition cursor-pointer group"
                >
                  <div className="flex items-center gap-1.5 text-emerald-300 font-bold text-xs">
                    <Shield className="w-3.5 h-3.5" /> Quick Survival
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Gather, craft & survive</div>
                </button>
                <button
                  onClick={() => onQuickStart('creative')}
                  className="py-2.5 px-3 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-sky-500/30 text-left transition cursor-pointer group"
                >
                  <div className="flex items-center gap-1.5 text-sky-300 font-bold text-xs">
                    <Sparkles className="w-3.5 h-3.5" /> Quick Creative
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Fly & unlimited blocks</div>
                </button>
                <button
                  onClick={() => onQuickStart('adventure')}
                  className="py-2.5 px-3 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-amber-500/30 text-left transition cursor-pointer group"
                >
                  <div className="flex items-center gap-1.5 text-amber-300 font-bold text-xs">
                    <Compass className="w-3.5 h-3.5" /> Quick Adventure
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">5 Frontier Quests</div>
                </button>
                <button
                  onClick={() => onQuickStart('spectator')}
                  className="py-2.5 px-3 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-purple-500/30 text-left transition cursor-pointer group"
                >
                  <div className="flex items-center gap-1.5 text-purple-300 font-bold text-xs">
                    <Eye className="w-3.5 h-3.5" /> Quick Spectator
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Free noclip exploration</div>
                </button>
              </div>
            </div>

            {/* Compact Controls Card */}
            <div className="bg-slate-900/75 backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 text-xs text-slate-300 space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-200 uppercase tracking-wider">
                <Gamepad2 className="w-4 h-4 text-emerald-400" />
                Controls (Keyboard, Mouse, Touch & Gamepad)
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                <div><span className="text-white font-semibold">WASD</span> Move &bull; <span className="text-white font-semibold">Space</span> Jump</div>
                <div><span className="text-white font-semibold">L-Click</span> Mine / Attack</div>
                <div><span className="text-white font-semibold">R-Click / F</span> Place / Use / Eat</div>
                <div><span className="text-white font-semibold">Shift</span> Crouch (Ledge Guard)</div>
                <div><span className="text-white font-semibold">E / Tab</span> Inventory & Craft</div>
                <div><span className="text-white font-semibold">1-9 / Wheel</span> Hotbar Slot</div>
                <div><span className="text-white font-semibold">2× Space</span> Fly (Creative)</div>
                <div><span className="text-white font-semibold">Esc</span> Pause & Save</div>
              </div>
            </div>
          </div>

          {/* Right Column: Saved Worlds List */}
          <div className="lg:col-span-7 bg-slate-900/80 backdrop-blur-md border border-slate-700/70 rounded-2xl p-4 flex flex-col min-h-[260px] max-h-[420px] shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                Saved Worlds ({worlds.length})
              </h2>
              <span className="text-[11px] text-slate-400">Persisted in Browser IndexedDB</span>
            </div>

            {worlds.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-8 border border-dashed border-slate-700 rounded-xl bg-slate-950/40">
                <Compass className="w-10 h-10 text-slate-600 mb-2" />
                <div className="text-slate-300 font-semibold text-sm">No Saved Worlds Yet</div>
                <p className="text-slate-400 text-xs mt-1 max-w-xs">
                  Create a custom seeded world or launch any Quick Mode on the left. Your builds, chests, and furnaces save automatically!
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {worlds.map((w) => {
                  const badge = MODE_BADGE[w.gameMode] ?? MODE_BADGE.survival;
                  return (
                    <div
                      key={w.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-800/75 hover:bg-slate-800 border border-slate-700/70 transition"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white text-sm truncate">{w.name}</span>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.color}`}
                          >
                            {badge.icon}
                            {badge.label}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-3 flex-wrap">
                          <span>Seed: <span className="text-slate-200 font-mono">{w.seed}</span></span>
                          <span>Edits: <span className="text-slate-200">{w.blocksModified ?? 0}</span></span>
                          <span>Played: {formatDate(w.lastPlayed)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => onPlayWorld(w.id)}
                          className="px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" /> Play
                        </button>
                        <button
                          onClick={() => onDeleteWorld(w.id)}
                          title="Delete world"
                          className="p-2 rounded-lg bg-slate-900/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-700 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
