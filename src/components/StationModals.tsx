import React, { useState } from 'react';
import {
  ArrowRight,
  Coins,
  Flame,
  Package,
  Sparkles,
  Store,
  X,
} from 'lucide-react';
import { getItemDef, ITEM } from '../engine/blocks';
import { GameEngine } from '../engine/gameEngine';
import { findSmeltRecipe, TRADER_OFFERS } from '../engine/recipes';
import { getItemIcon } from '../engine/textures';
import { ChestState, Enchantment, FurnaceState, ItemStack } from '../engine/types';
import { ItemSlot } from './ItemSlot';

// ==========================================
// 1. STONE FURNACE MODAL
// ==========================================
interface FurnaceModalProps {
  engine: GameEngine;
  furnace: FurnaceState;
  inventory: (ItemStack | null)[];
  onClose: () => void;
}

export const FurnaceModal: React.FC<FurnaceModalProps> = ({
  engine,
  furnace,
  inventory,
  onClose,
}) => {
  const burnPct =
    furnace.maxBurnTime > 0
      ? Math.min(100, (furnace.burnTime / furnace.maxBurnTime) * 100)
      : 0;
  const smeltPct =
    furnace.smeltTotal > 0
      ? Math.min(100, (furnace.smeltProgress / furnace.smeltTotal) * 100)
      : 0;

  const insertFromInv = (invIdx: number, preferFuel = false) => {
    const item = inventory[invIdx];
    if (!item) return;
    const def = getItemDef(item.itemId);
    const isSmeltable = Boolean(findSmeltRecipe(item.itemId));
    const isFuel = Boolean(def.fuelDuration && def.fuelDuration > 0);

    engine.updateFurnace(furnace.key, (f) => {
      if (!preferFuel && isSmeltable && (!f.input || f.input.itemId === item.itemId)) {
        if (!f.input) {
          f.input = { ...item };
          engine.setInventorySlot(invIdx, null);
        } else {
          const add = Math.min(item.count, def.stackSize - f.input.count);
          if (add > 0) {
            f.input.count += add;
            engine.setInventorySlot(
              invIdx,
              item.count - add > 0 ? { ...item, count: item.count - add } : null
            );
          }
        }
      } else if (isFuel && (!f.fuel || f.fuel.itemId === item.itemId)) {
        if (!f.fuel) {
          f.fuel = { ...item };
          engine.setInventorySlot(invIdx, null);
        } else {
          const add = Math.min(item.count, def.stackSize - f.fuel.count);
          if (add > 0) {
            f.fuel.count += add;
            engine.setInventorySlot(
              invIdx,
              item.count - add > 0 ? { ...item, count: item.count - add } : null
            );
          }
        }
      } else {
        engine.notify('Item cannot be smelted or burned as fuel.', 'warning');
      }
    });
  };

  const takeSlot = (slotName: 'input' | 'fuel' | 'output') => {
    engine.updateFurnace(furnace.key, (f) => {
      const stack = f[slotName];
      if (!stack) return;
      if (engine.addItemToInventory(stack.itemId, stack.count)) {
        f[slotName] = null;
        engine.audio.playPickup();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Flame className="w-5 h-5 text-orange-400" />
            <div>
              <h2 className="text-base font-extrabold text-white">Stone Furnace</h2>
              <p className="text-[11px] text-slate-400">
                Click smeltable ores/sand/meat or fuel (coal/wood) below to load automatically.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Furnace Mechanism */}
          <div className="bg-slate-950/65 border border-slate-800 rounded-xl p-5 flex items-center justify-center gap-8">
            <div className="flex flex-col items-center gap-3">
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold uppercase text-slate-400 mb-1">Input</span>
                <ItemSlot
                  stack={furnace.input}
                  size="lg"
                  onClick={() => takeSlot('input')}
                />
              </div>

              {/* Flame Indicator */}
              <div className="w-14 flex flex-col items-center gap-1">
                <Flame
                  className={`w-5 h-5 ${
                    burnPct > 0 ? 'text-orange-400 fill-orange-500 animate-pulse' : 'text-slate-600'
                  }`}
                />
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-orange-500 to-yellow-400 transition-all"
                    style={{ width: `${burnPct}%` }}
                  />
                </div>
              </div>

              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold uppercase text-slate-400 mb-1">Fuel</span>
                <ItemSlot
                  stack={furnace.fuel}
                  size="lg"
                  onClick={() => takeSlot('fuel')}
                />
              </div>
            </div>

            {/* Progress Arrow */}
            <div className="flex flex-col items-center gap-2 w-24">
              <ArrowRight className="w-6 h-6 text-slate-400" />
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-100"
                  style={{ width: `${smeltPct}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                {Math.round(smeltPct)}%
              </span>
            </div>

            <div className="flex flex-col items-center">
              <span className="text-[10px] font-bold uppercase text-emerald-400 mb-1">
                Smelted Output
              </span>
              <ItemSlot
                stack={furnace.output}
                size="lg"
                selected={Boolean(furnace.output)}
                onClick={() => takeSlot('output')}
              />
              {furnace.output && (
                <span className="text-[10px] text-emerald-300 mt-1">Click to collect</span>
              )}
            </div>
          </div>

          {/* Player Inventory */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Your Inventory (Click Smeltable Item or Fuel to Insert)
            </div>
            <div className="grid grid-cols-9 gap-1.5">
              {inventory.map((slot, idx) => (
                <ItemSlot
                  key={idx}
                  stack={slot}
                  size="sm"
                  onClick={() => insertFromInv(idx, false)}
                  onContextMenu={() => insertFromInv(idx, true)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 2. STORAGE CHEST MODAL
// ==========================================
interface ChestModalProps {
  engine: GameEngine;
  chest: ChestState;
  inventory: (ItemStack | null)[];
  onClose: () => void;
}

export const ChestModal: React.FC<ChestModalProps> = ({
  engine,
  chest,
  inventory,
  onClose,
}) => {
  const moveChestToInv = (cIdx: number) => {
    engine.updateChest(chest.key, (c) => {
      const stack = c.slots[cIdx];
      if (!stack) return;
      if (engine.addItemToInventory(stack.itemId, stack.count, stack.enchantments)) {
        c.slots[cIdx] = null;
        engine.audio.playPickup();
      } else {
        engine.notify('Backpack is full!', 'warning');
      }
    });
  };

  const moveInvToChest = (iIdx: number) => {
    const stack = inventory[iIdx];
    if (!stack) return;
    engine.updateChest(chest.key, (c) => {
      const def = getItemDef(stack.itemId);
      // Try stacking first
      if (def.stackSize > 1 && !stack.enchantments?.length) {
        for (let i = 0; i < c.slots.length; i++) {
          const target = c.slots[i];
          if (target && target.itemId === stack.itemId && target.count < def.stackSize) {
            const add = Math.min(stack.count, def.stackSize - target.count);
            target.count += add;
            engine.setInventorySlot(
              iIdx,
              stack.count - add > 0 ? { ...stack, count: stack.count - add } : null
            );
            engine.audio.playPickup();
            return;
          }
        }
      }
      // Empty slot
      const empty = c.slots.findIndex((s) => s === null);
      if (empty !== -1) {
        c.slots[empty] = { ...stack };
        engine.setInventorySlot(iIdx, null);
        engine.audio.playPickup();
      } else {
        engine.notify('Storage Chest is full!', 'warning');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Package className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-base font-extrabold text-white">Storage Chest (18 Slots)</h2>
              <p className="text-[11px] text-slate-400">
                Click any item to transfer instantaneously between Chest and Inventory.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="bg-slate-950/60 border border-amber-500/25 rounded-xl p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300 mb-2">
              Chest Contents
            </div>
            <div className="grid grid-cols-9 gap-1.5">
              {chest.slots.map((slot, idx) => (
                <ItemSlot
                  key={idx}
                  stack={slot}
                  onClick={() => moveChestToInv(idx)}
                />
              ))}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Your Inventory (Click to Deposit)
            </div>
            <div className="grid grid-cols-9 gap-1.5">
              {inventory.map((slot, idx) => (
                <ItemSlot
                  key={idx}
                  stack={slot}
                  size="sm"
                  onClick={() => moveInvToChest(idx)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 3. ARCANE ENCHANTING ALTAR MODAL
// ==========================================
interface EnchantModalProps {
  engine: GameEngine;
  inventory: (ItemStack | null)[];
  playerLevel: number;
  onClose: () => void;
}

const ENCHANT_OPTIONS: {
  enchant: Enchantment;
  title: string;
  desc: string;
  xpCost: number;
  crystalCost: number;
}[] = [
  {
    enchant: { type: 'efficiency', level: 2 },
    title: 'Efficiency II',
    desc: 'Dramatically increases block mining speed for pickaxes, axes & shovels.',
    xpCost: 2,
    crystalCost: 1,
  },
  {
    enchant: { type: 'sharpness', level: 2 },
    title: 'Sharpness II',
    desc: 'Adds +4 bonus attack damage against creatures and the Obsidian Warden.',
    xpCost: 2,
    crystalCost: 1,
  },
  {
    enchant: { type: 'unbreaking', level: 2 },
    title: 'Unbreaking II',
    desc: '50% chance to preserve tool durability on every strike or block mined.',
    xpCost: 3,
    crystalCost: 1,
  },
  {
    enchant: { type: 'fortune', level: 2 },
    title: 'Fortune II',
    desc: 'High chance to yield bonus coal, ores, and Aether Crystals while mining.',
    xpCost: 3,
    crystalCost: 2,
  },
];

export const EnchantModal: React.FC<EnchantModalProps> = ({
  engine,
  inventory,
  playerLevel,
  onClose,
}) => {
  const enchantableSlots = inventory
    .map((stack, idx) => ({ stack, idx }))
    .filter((entry) => entry.stack && Boolean(getItemDef(entry.stack.itemId).toolType));

  const [selectedIdx, setSelectedIdx] = useState<number | null>(
    enchantableSlots[0]?.idx ?? null
  );

  const crystalCount = engine.countInventoryItem(ITEM.CRYSTAL_GEM);
  const selectedStack = selectedIdx !== null ? inventory[selectedIdx] : null;

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="w-full max-w-2xl bg-slate-900 border border-purple-500/50 rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 py-3.5 bg-purple-950/40 border-b border-purple-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <div>
              <h2 className="text-base font-extrabold text-white">Arcane Enchanting Altar</h2>
              <p className="text-[11px] text-purple-200/80">
                Your Level: <strong>{playerLevel}</strong> &bull; Aether Crystals: <strong>{crystalCount}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              1. Select Tool or Weapon to Infuse
            </div>
            {enchantableSlots.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-400">
                Craft or carry any Pickaxe, Axe, Shovel, Sword, or Hoe to enchant it here.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {enchantableSlots.map(({ stack, idx }) => (
                  <ItemSlot
                    key={idx}
                    stack={stack}
                    selected={selectedIdx === idx}
                    onClick={() => setSelectedIdx(idx)}
                  />
                ))}
              </div>
            )}
          </div>

          {selectedStack && selectedIdx !== null && (
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-purple-300">
                2. Choose Enchantment for {getItemDef(selectedStack.itemId).name}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {ENCHANT_OPTIONS.map((opt) => (
                  <button
                    key={opt.title}
                    onClick={() =>
                      engine.applyEnchantmentToSlot(
                        selectedIdx,
                        opt.enchant,
                        opt.xpCost,
                        opt.crystalCost
                      )
                    }
                    className="text-left p-3 rounded-xl bg-slate-950/80 hover:bg-purple-950/40 border border-purple-500/35 hover:border-purple-400 transition cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-sm text-purple-200">
                        ✦ {opt.title}
                      </span>
                      <span className="text-[11px] font-mono text-sky-300">
                        {opt.xpCost} LVL &bull; {opt.crystalCost} Crystal
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 4. VILLAGER TRADER MODAL
// ==========================================
interface TraderModalProps {
  engine: GameEngine;
  traderName: string;
  onClose: () => void;
}

export const TraderModal: React.FC<TraderModalProps> = ({
  engine,
  traderName,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-40 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="w-full max-w-2xl bg-slate-900 border border-emerald-500/45 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        <div className="px-5 py-3.5 bg-emerald-950/40 border-b border-emerald-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Store className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-extrabold text-white">{traderName}</h2>
              <p className="text-[11px] text-emerald-200/80">
                Exchange harvests, timber, gold, and crystals for rare frontier supplies!
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-2">
          {TRADER_OFFERS.map((offer) => {
            const have = engine.countInventoryItem(offer.costItemId);
            const canAfford =
              engine.saveData.meta.gameMode === 'creative' || have >= offer.costCount;
            const costDef = getItemDef(offer.costItemId);
            const rewardDef = getItemDef(offer.rewardItemId);

            return (
              <div
                key={offer.id}
                className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition ${
                  canAfford
                    ? 'bg-slate-800/80 border-emerald-500/40'
                    : 'bg-slate-950/60 border-slate-800 opacity-65'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center gap-1.5 bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-700">
                    <img
                      src={getItemIcon(offer.costItemId)}
                      alt={costDef.name}
                      className="w-6 h-6 pixelated"
                    />
                    <span className="text-xs font-bold text-amber-300">
                      {offer.costCount}×
                    </span>
                  </div>

                  <ArrowRight className="w-4 h-4 text-slate-500 shrink-0" />

                  <div className="flex items-center gap-1.5 bg-slate-900 px-2.5 py-1.5 rounded-lg border border-emerald-500/30">
                    <img
                      src={getItemIcon(offer.rewardItemId)}
                      alt={rewardDef.name}
                      className="w-6 h-6 pixelated"
                    />
                    <span className="text-xs font-bold text-emerald-300">
                      {offer.rewardCount}×
                    </span>
                  </div>

                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">
                      {offer.label}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Cost: {offer.costCount} {costDef.name} (You have {have})
                    </div>
                  </div>
                </div>

                <button
                  disabled={!canAfford}
                  onClick={() => engine.executeTrade(offer)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-extrabold flex items-center gap-1.5 shrink-0 transition ${
                    canAfford
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Coins className="w-3.5 h-3.5" />
                  Trade
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
