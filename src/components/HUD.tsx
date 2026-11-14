import React from 'react';
import {
  Backpack,
  CheckCircle2,
  CloudLightning,
  CloudRain,
  CloudSnow,
  Droplets,
  Gamepad2,
  Heart,
  Menu,
  Moon,
  Skull,
  Sun,
  Utensils,
  Wind,
} from 'lucide-react';
import { getItemDef } from '../engine/blocks';
import { GameNotification, HudSnapshot } from '../engine/types';
import { ItemSlot } from './ItemSlot';

interface HUDProps {
  hud: HudSnapshot;
  showDebug: boolean;
  notifications: GameNotification[];
  onSelectHotbar: (idx: number) => void;
  onOpenInventory: () => void;
  onOpenPause: () => void;
  onLockCanvas: () => void;
}

function formatClock(worldTime: number): { label: string; isNight: boolean } {
  const totalMinutes = Math.floor(((worldTime + 6000) % 24000) / 1000 * 60);
  const hh = Math.floor(totalMinutes / 60) % 24;
  const mm = totalMinutes % 60;
  const isNight = worldTime >= 12800 && worldTime <= 23200;
  return {
    label: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`,
    isNight,
  };
}

export const HUD: React.FC<HUDProps> = ({
  hud,
  showDebug,
  notifications,
  onSelectHotbar,
  onOpenInventory,
  onOpenPause,
  onLockCanvas,
}) => {
  const held = hud.inventory[hud.selectedHotbar] ?? null;
  const heldDef = held ? getItemDef(held.itemId) : null;
  const clock = formatClock(hud.worldTime);

  const WeatherIcon =
    hud.weather === 'storm'
      ? CloudLightning
      : hud.weather === 'rain'
      ? CloudRain
      : hud.weather === 'snow'
      ? CloudSnow
      : clock.isNight
      ? Moon
      : Sun;

  const xpPct = Math.min(100, Math.round((hud.xp / Math.max(1, hud.xpToNext)) * 100));

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-3">
      {/* Underwater Blue Vignette */}
      {hud.isUnderwater && (
        <div className="fixed inset-0 bg-sky-900/35 ring-inset ring-8 ring-sky-500/25 pointer-events-none" />
      )}

      {/* TOP BAR */}
      <div className="flex items-start justify-between gap-3 relative z-10">
        {/* Top-Left: Coordinates, Biome, Time, Weather, Mode */}
        <div className="flex flex-col gap-1.5">
          {showDebug && (
            <div className="bg-slate-950/65 backdrop-blur-sm border border-slate-700/60 rounded-xl px-3 py-1.5 text-[11px] text-slate-200 flex items-center gap-2.5 flex-wrap shadow-lg">
              <span className="font-extrabold uppercase tracking-wider text-emerald-400">
                {hud.gameMode}
              </span>
              <span className="text-slate-500">|</span>
              <span className="font-mono text-slate-100">
                XYZ {hud.x}, {hud.y}, {hud.z}
              </span>
              <span className="text-slate-500">|</span>
              <span className="capitalize text-sky-300 font-semibold">{hud.biome}</span>
              <span className="text-slate-500">|</span>
              <span className="inline-flex items-center gap-1 text-amber-200">
                <WeatherIcon className="w-3.5 h-3.5" />
                Day {hud.dayCount} &bull; {clock.label}
              </span>
              <span className="text-slate-500 hidden sm:inline">|</span>
              <span className="text-slate-400 hidden sm:inline">
                {hud.fps} FPS &bull; {hud.loadedChunks} chunks
              </span>
              {hud.isFlying && (
                <span className="inline-flex items-center gap-1 text-sky-300 font-bold">
                  <Wind className="w-3 h-3" /> FLY
                </span>
              )}
              {hud.gamepadConnected && (
                <span className="inline-flex items-center gap-1 text-purple-300 font-bold">
                  <Gamepad2 className="w-3.5 h-3.5" /> PAD
                </span>
              )}
            </div>
          )}

          {/* Pointer Lock Helper Pill */}
          {!hud.pointerLocked && !hud.isDead && (
            <button
              onClick={onLockCanvas}
              className="pointer-events-auto self-start px-3 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-emerald-500/40 text-[11px] text-emerald-200 font-semibold transition cursor-pointer shadow"
            >
              Click world for FPS Mouse Lock (or drag to look) &bull; E Inventory &bull; Esc Pause
            </button>
          )}
        </div>

        {/* Top-Center: Active Boss Health Bar */}
        {hud.activeBoss && (
          <div className="absolute left-1/2 -translate-x-1/2 top-1 w-72 sm:w-96 bg-slate-950/85 backdrop-blur-md border border-purple-500/60 rounded-xl p-2.5 shadow-2xl shadow-purple-900/40">
            <div className="flex items-center justify-between text-xs font-extrabold text-purple-200 mb-1">
              <span className="flex items-center gap-1.5">
                <Skull className="w-4 h-4 text-sky-400" />
                {hud.activeBoss.name}
              </span>
              <span className="font-mono text-sky-300">
                {hud.activeBoss.hp} / {hud.activeBoss.maxHp}
              </span>
            </div>
            <div className="h-2.5 bg-slate-900 rounded-full overflow-hidden border border-purple-900">
              <div
                className="h-full bg-gradient-to-r from-purple-600 via-fuchsia-500 to-sky-400 transition-all duration-150"
                style={{
                  width: `${Math.max(0, Math.min(100, (hud.activeBoss.hp / hud.activeBoss.maxHp) * 100))}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Top-Right: Quick Action Buttons + Objectives (Adventure Mode) + Notifications */}
        <div className="flex flex-col items-end gap-2 max-w-xs">
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <button
              onClick={onOpenInventory}
              className="px-2.5 py-1.5 rounded-lg bg-slate-950/75 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              title="Open Inventory (E)"
            >
              <Backpack className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Inventory</span>
            </button>
            <button
              onClick={onOpenPause}
              className="px-2.5 py-1.5 rounded-lg bg-slate-950/75 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              title="Pause Menu (Esc)"
            >
              <Menu className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Menu</span>
            </button>
          </div>

          {hud.gameMode === 'adventure' && (
            <div className="bg-slate-950/75 backdrop-blur-sm border border-amber-500/35 rounded-xl p-2.5 w-60 text-[11px] space-y-1.5 shadow-lg">
              <div className="font-extrabold text-amber-300 uppercase tracking-wider text-[10px]">
                Adventure Objectives
              </div>
              {hud.objectives.map((o) => (
                <div
                  key={o.id}
                  className={`flex items-start gap-1.5 ${
                    o.completed ? 'text-emerald-300/75 line-through' : 'text-slate-200'
                  }`}
                >
                  <CheckCircle2
                    className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                      o.completed ? 'text-emerald-400' : 'text-slate-600'
                    }`}
                  />
                  <div className="flex-1 leading-tight">
                    <div className="font-semibold">{o.title}</div>
                    {!o.completed && (
                      <div className="text-[10px] text-slate-400">
                        {o.progress}/{o.target} &bull; {o.description}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Notifications Stack */}
          <div className="flex flex-col items-end gap-1.5">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold backdrop-blur-md border shadow-lg max-w-xs text-right ${
                  n.type === 'achievement'
                    ? 'bg-amber-950/85 border-amber-400/60 text-amber-200'
                    : n.type === 'danger'
                    ? 'bg-rose-950/85 border-rose-500/60 text-rose-200'
                    : n.type === 'warning'
                    ? 'bg-orange-950/85 border-orange-500/50 text-orange-200'
                    : n.type === 'success'
                    ? 'bg-emerald-950/85 border-emerald-500/50 text-emerald-200'
                    : 'bg-slate-950/80 border-slate-600/60 text-slate-200'
                }`}
              >
                {n.message}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CENTER CROSSHAIR & TARGET PROMPT */}
      {!hud.isDead && (
        <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none">
          <div className="relative w-6 h-6 flex items-center justify-center">
            <div
              className={`w-4 h-0.5 rounded-full shadow-[0_0_4px_rgba(0,0,0,0.9)] ${
                hud.target.type === 'entity'
                  ? 'bg-rose-400'
                  : hud.target.interactPrompt
                  ? 'bg-amber-300'
                  : 'bg-white/90'
              }`}
            />
            <div
              className={`absolute h-4 w-0.5 rounded-full shadow-[0_0_4px_rgba(0,0,0,0.9)] ${
                hud.target.type === 'entity'
                  ? 'bg-rose-400'
                  : hud.target.interactPrompt
                  ? 'bg-amber-300'
                  : 'bg-white/90'
              }`}
            />
          </div>

          {/* Mining Progress Bar */}
          {hud.target.type === 'block' && (hud.target.breakProgress ?? 0) > 0.02 && (
            <div className="mt-2 w-20 h-1.5 bg-slate-950/85 rounded-full overflow-hidden border border-slate-600/70">
              <div
                className="h-full bg-amber-400 transition-all duration-75"
                style={{ width: `${Math.round((hud.target.breakProgress ?? 0) * 100)}%` }}
              />
            </div>
          )}

          {/* Target Label & Interact Prompt */}
          {hud.target.type !== 'none' && (
            <div className="mt-3 flex flex-col items-center gap-1">
              {hud.target.type === 'entity' && (
                <div className="px-2.5 py-1 rounded-lg bg-slate-950/75 border border-slate-700/70 text-[11px] font-bold text-white flex items-center gap-2">
                  <span>{hud.target.entityName}</span>
                  <span className="text-rose-400 font-mono">
                    {hud.target.entityHp}/{hud.target.entityMaxHp} HP
                  </span>
                </div>
              )}
              {hud.target.type === 'block' && hud.target.blockName && (
                <div className="px-2 py-0.5 rounded-md bg-slate-950/55 text-[10px] font-semibold text-slate-200">
                  {hud.target.blockName}
                </div>
              )}
              {hud.target.interactPrompt && (
                <div className="px-2.5 py-1 rounded-lg bg-amber-500/90 text-slate-950 text-[11px] font-extrabold shadow-lg">
                  {hud.target.interactPrompt}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* BOTTOM BAR: VITALS + XP + HOTBAR */}
      <div className="flex flex-col items-center gap-1.5 relative z-10 pb-1">
        {/* Held Item Name & Enchants */}
        {heldDef && (
          <div className="px-3 py-0.5 rounded-full bg-slate-950/70 border border-slate-700/60 text-xs font-bold text-white flex items-center gap-2">
            <span>{heldDef.name}</span>
            {held?.enchantments && held.enchantments.length > 0 && (
              <span className="text-[10px] text-purple-300 font-semibold">
                ({held.enchantments.map((e) => `${e.type} ${e.level}`).join(', ')})
              </span>
            )}
          </div>
        )}

        {/* Survival / Adventure Vitals */}
        {(hud.gameMode === 'survival' || hud.gameMode === 'adventure') && (
          <div className="w-full max-w-[468px] flex flex-col gap-1 px-1">
            <div className="flex items-center justify-between gap-4">
              {/* Health Bar */}
              <div className="flex items-center gap-1.5 flex-1 bg-slate-950/65 px-2.5 py-1 rounded-lg border border-slate-800">
                <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 shrink-0" />
                <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-rose-600 to-rose-400 transition-all"
                    style={{ width: `${(hud.hp / hud.maxHp) * 100}%` }}
                  />
                </div>
                <span className="text-[11px] font-bold text-rose-200 font-mono w-9 text-right">
                  {hud.hp}/{hud.maxHp}
                </span>
              </div>

              {/* Oxygen (only when underwater or recovering) */}
              {hud.oxygen < hud.maxOxygen && (
                <div className="flex items-center gap-1 bg-sky-950/80 px-2 py-1 rounded-lg border border-sky-500/40">
                  <Droplets className="w-3.5 h-3.5 text-sky-400" />
                  <span className="text-[11px] font-bold text-sky-200 font-mono">
                    {hud.oxygen}
                  </span>
                </div>
              )}

              {/* Hunger Bar */}
              <div className="flex items-center gap-1.5 flex-1 bg-slate-950/65 px-2.5 py-1 rounded-lg border border-slate-800">
                <Utensils className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all"
                    style={{ width: `${(hud.hunger / hud.maxHunger) * 100}%` }}
                  />
                </div>
                <span className="text-[11px] font-bold text-amber-200 font-mono w-9 text-right">
                  {hud.hunger}/{hud.maxHunger}
                </span>
              </div>
            </div>

            {/* XP Progress Bar */}
            <div className="relative h-2 bg-slate-950/85 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-lime-400 transition-all"
                style={{ width: `${xpPct}%` }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-white drop-shadow">
                LVL {hud.level}
              </span>
            </div>
          </div>
        )}

        {/* 9-Slot Hotbar */}
        {hud.gameMode !== 'spectator' && (
          <div className="pointer-events-auto flex items-center gap-1 sm:gap-1.5 p-1.5 rounded-2xl bg-slate-950/80 backdrop-blur-md border border-slate-700/80 shadow-2xl">
            {Array.from({ length: 9 }).map((_, idx) => (
              <ItemSlot
                key={idx}
                stack={hud.inventory[idx] ?? null}
                selected={hud.selectedHotbar === idx}
                slotLabel={String(idx + 1)}
                size="md"
                onClick={() => onSelectHotbar(idx)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
