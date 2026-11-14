import React, { useState } from 'react';
import { ArrowLeft, Compass, Dices, Eye, Play, Shield, Sparkles } from 'lucide-react';
import { GameMode } from '../engine/types';

interface WorldCreatorProps {
  onBack: () => void;
  onCreate: (name: string, seed: string, mode: GameMode) => void;
}

const PRESET_SEEDS = [
  { label: 'Emerald Valley', seed: 'EMERALD-VALLEY-2026' },
  { label: 'Alpine Peaks', seed: 'ALPINE-SUMMIT-99' },
  { label: 'Sunscorched Oasis', seed: 'DESERT-MIRAGE-77' },
  { label: 'Frost Frontier', seed: 'GLACIER-NORTH-42' },
];

const MODES: {
  id: GameMode;
  title: string;
  desc: string;
  perks: string;
  accent: string;
  icon: React.ReactNode;
}[] = [
  {
    id: 'survival',
    title: 'Survival',
    desc: 'Gather resources, craft tiered tools, smelt ores, farm crops, manage health & hunger, and survive night creatures.',
    perks: 'Full progression & crafting',
    accent: 'border-emerald-500/70 bg-emerald-500/10 text-emerald-300',
    icon: <Shield className="w-5 h-5" />,
  },
  {
    id: 'creative',
    title: 'Creative',
    desc: 'Unlimited access to every block, tool, and Sparkstone device. Instant mining, invulnerability, and double-Space flight.',
    perks: 'Unlimited building & flight',
    accent: 'border-sky-500/70 bg-sky-500/10 text-sky-300',
    icon: <Sparkles className="w-5 h-5" />,
  },
  {
    id: 'adventure',
    title: 'Adventure',
    desc: 'Tool-gated mining with 5 tracked Frontier Objectives leading from the NE Trading Outpost to the Obsidian Warden Boss.',
    perks: 'Guided objectives & combat',
    accent: 'border-amber-500/70 bg-amber-500/10 text-amber-300',
    icon: <Compass className="w-5 h-5" />,
  },
  {
    id: 'spectator',
    title: 'Spectator',
    desc: 'Pass effortlessly through mountains, caves, and oceans with noclip flight to inspect biomes and procedural structures.',
    perks: 'Free noclip camera flight',
    accent: 'border-purple-500/70 bg-purple-500/10 text-purple-300',
    icon: <Eye className="w-5 h-5" />,
  },
];

export const WorldCreator: React.FC<WorldCreatorProps> = ({ onBack, onCreate }) => {
  const [name, setName] = useState('New Frontier');
  const [seed, setSeed] = useState('TERRAVEX-7421');
  const [mode, setMode] = useState<GameMode>('survival');

  const randomizeSeed = () => {
    const words = ['AETHER', 'TIMBER', 'CRYSTAL', 'GRANITE', 'HORIZON', 'OBSIDIAN', 'SUMMIT'];
    const w = words[Math.floor(Math.random() * words.length)];
    const n = Math.floor(1000 + Math.random() * 9000);
    setSeed(`${w}-${n}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate(name, seed, mode);
  };

  return (
    <div className="w-full h-full flex items-center justify-center bg-slate-950 p-4 overflow-y-auto">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-3xl bg-slate-900/95 border border-slate-700/80 rounded-2xl p-6 shadow-2xl space-y-5"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-xl font-extrabold text-white">Create New Frontier World</h2>
              <p className="text-xs text-slate-400">
                Deterministic procedural terrain, 6 biomes, 3D caves, trading outposts & boss shrines.
              </p>
            </div>
          </div>
        </div>

        {/* World Name & Seed */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              World Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={32}
              placeholder="Enter world name..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-emerald-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              World Seed
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                maxLength={32}
                placeholder="Any word or number..."
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-emerald-300 font-mono text-sm focus:outline-none focus:border-emerald-400"
              />
              <button
                type="button"
                onClick={randomizeSeed}
                title="Random Seed"
                className="px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 transition cursor-pointer"
              >
                <Dices className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Seed Presets */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-slate-400 font-semibold">Presets:</span>
          {PRESET_SEEDS.map((p) => (
            <button
              key={p.seed}
              type="button"
              onClick={() => {
                setSeed(p.seed);
                setName(p.label);
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-[11px] text-slate-300 border border-slate-700 transition cursor-pointer"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Game Modes */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
            Select Game Mode
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {MODES.map((m) => {
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  className={`text-left p-3.5 rounded-xl border transition cursor-pointer ${
                    active
                      ? `${m.accent} ring-2 ring-white/20 shadow-lg`
                      : 'border-slate-800 bg-slate-950/70 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-extrabold text-sm flex items-center gap-2">
                      {m.icon} {m.title}
                    </span>
                    <span className="text-[10px] font-semibold opacity-80">{m.perks}</span>
                  </div>
                  <p className="text-[11px] text-slate-300/90 leading-relaxed">{m.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/25 transition cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            Generate &amp; Enter World
          </button>
        </div>
      </form>
    </div>
  );
};
