import React, { useMemo, useState } from 'react';
import { ArrowRight, BookOpen, Hammer, Package, Search, Sparkles, X } from 'lucide-react';
import { ALL_ITEMS, createItemStack, getItemDef } from '../engine/blocks';
import { GameEngine } from '../engine/gameEngine';
import {
  CRAFTING_RECIPES,
  getRecipeIngredients,
  matchCraftingGrid,
} from '../engine/recipes';
import { getItemIcon } from '../engine/textures';
import { CraftingRecipe, GameMode, ItemStack } from '../engine/types';
import { ItemSlot } from './ItemSlot';

interface InventoryModalProps {
  engine: GameEngine;
  inventory: (ItemStack | null)[];
  gameMode: GameMode;
  tableMode: boolean;
  onClose: () => void;
}

export const InventoryModal: React.FC<InventoryModalProps> = ({
  engine,
  inventory,
  gameMode,
  tableMode,
  onClose,
}) => {
  const gridSize: 2 | 3 = tableMode ? 3 : 2;
  const [craftGrid, setCraftGrid] = useState<(ItemStack | null)[]>(
    () => new Array(gridSize * gridSize).fill(null)
  );
  const [activeTab, setActiveTab] = useState<'craft' | 'creative'>(
    gameMode === 'creative' && !tableMode ? 'creative' : 'craft'
  );
  const [recipeSearch, setRecipeSearch] = useState('');
  const [creativeSearch, setCreativeSearch] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<{
    zone: 'inv' | 'craft';
    idx: number;
  } | null>(null);
  const [hoveredItem, setHoveredItem] = useState<ItemStack | null>(null);

  const matchedRecipe = useMemo(
    () => matchCraftingGrid(craftGrid, gridSize),
    [craftGrid, gridSize]
  );

  // Return any items left inside the crafting grid back to inventory on close
  const handleClose = () => {
    for (const s of craftGrid) {
      if (s && s.count > 0) {
        engine.addItemToInventory(s.itemId, s.count, s.enchantments);
      }
    }
    onClose();
  };

  const handleInvSlotClick = (idx: number, rightClick = false) => {
    if (!selectedSlot) {
      if (inventory[idx]) setSelectedSlot({ zone: 'inv', idx });
      return;
    }

    if (selectedSlot.zone === 'inv') {
      engine.swapOrMergeSlots(selectedSlot.idx, idx, rightClick);
      setSelectedSlot(null);
      return;
    }

    // Moving from craft grid back to inventory
    const fromCraft = craftGrid[selectedSlot.idx];
    const targetInv = inventory[idx];
    if (fromCraft) {
      const nextGrid = [...craftGrid];
      if (!targetInv) {
        engine.setInventorySlot(idx, fromCraft);
        nextGrid[selectedSlot.idx] = null;
      } else if (targetInv.itemId === fromCraft.itemId) {
        const max = getItemDef(targetInv.itemId).stackSize;
        const move = Math.min(fromCraft.count, max - targetInv.count);
        if (move > 0) {
          engine.setInventorySlot(idx, { ...targetInv, count: targetInv.count + move });
          if (fromCraft.count - move <= 0) nextGrid[selectedSlot.idx] = null;
          else nextGrid[selectedSlot.idx] = { ...fromCraft, count: fromCraft.count - move };
        }
      } else {
        engine.setInventorySlot(idx, fromCraft);
        nextGrid[selectedSlot.idx] = targetInv;
      }
      setCraftGrid(nextGrid);
    }
    setSelectedSlot(null);
  };

  const handleCraftSlotClick = (cIdx: number, rightClick = false) => {
    const cur = craftGrid[cIdx];

    if (!selectedSlot) {
      if (cur) setSelectedSlot({ zone: 'craft', idx: cIdx });
      return;
    }

    const nextGrid = [...craftGrid];
    if (selectedSlot.zone === 'inv') {
      const src = inventory[selectedSlot.idx];
      if (src) {
        const moveCount = rightClick ? 1 : src.count;
        if (!cur) {
          nextGrid[cIdx] = { ...src, count: moveCount };
          if (src.count - moveCount <= 0) {
            engine.setInventorySlot(selectedSlot.idx, null);
          } else {
            engine.setInventorySlot(selectedSlot.idx, { ...src, count: src.count - moveCount });
          }
        } else if (cur.itemId === src.itemId) {
          const max = getItemDef(cur.itemId).stackSize;
          const add = Math.min(moveCount, max - cur.count);
          if (add > 0) {
            nextGrid[cIdx] = { ...cur, count: cur.count + add };
            if (src.count - add <= 0) engine.setInventorySlot(selectedSlot.idx, null);
            else engine.setInventorySlot(selectedSlot.idx, { ...src, count: src.count - add });
          }
        } else {
          // Swap
          nextGrid[cIdx] = src;
          engine.setInventorySlot(selectedSlot.idx, cur);
        }
      }
      setCraftGrid(nextGrid);
      setSelectedSlot(null);
      return;
    }

    // Craft -> Craft swap
    if (selectedSlot.idx !== cIdx) {
      const from = nextGrid[selectedSlot.idx];
      nextGrid[selectedSlot.idx] = cur;
      nextGrid[cIdx] = from;
      setCraftGrid(nextGrid);
    }
    setSelectedSlot(null);
  };

  const handleTakeCraftResult = () => {
    if (!matchedRecipe) return;
    const added = engine.addItemToInventory(
      matchedRecipe.result.itemId,
      matchedRecipe.result.count
    );
    if (!added) {
      engine.notify('Inventory full!', 'warning');
      return;
    }
    engine.audio.playCraft();
    // Consume 1 from each occupied craft grid cell
    const nextGrid = craftGrid.map((s) => {
      if (!s) return null;
      return s.count > 1 ? { ...s, count: s.count - 1 } : null;
    });
    setCraftGrid(nextGrid);
  };

  const handleDragStartInv = (e: React.DragEvent, idx: number) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ zone: 'inv', idx }));
  };

  const handleDragStartCraft = (e: React.DragEvent, idx: number) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ zone: 'craft', idx }));
  };

  const handleDropOnInv = (e: React.DragEvent, targetIdx: number) => {
    try {
      const payload = JSON.parse(e.dataTransfer.getData('text/plain')) as {
        zone: 'inv' | 'craft';
        idx: number;
      };
      if (payload.zone === 'inv') {
        engine.swapOrMergeSlots(payload.idx, targetIdx, false);
      } else {
        const src = craftGrid[payload.idx];
        if (!src) return;
        const nextGrid = [...craftGrid];
        const dest = inventory[targetIdx];
        if (!dest) {
          engine.setInventorySlot(targetIdx, src);
          nextGrid[payload.idx] = null;
        } else {
          engine.setInventorySlot(targetIdx, src);
          nextGrid[payload.idx] = dest;
        }
        setCraftGrid(nextGrid);
      }
    } catch {
      // ignore invalid drag data
    }
  };

  const handleDropOnCraft = (e: React.DragEvent, targetIdx: number) => {
    try {
      const payload = JSON.parse(e.dataTransfer.getData('text/plain')) as {
        zone: 'inv' | 'craft';
        idx: number;
      };
      const nextGrid = [...craftGrid];
      if (payload.zone === 'inv') {
        const src = inventory[payload.idx];
        if (!src) return;
        const dest = nextGrid[targetIdx];
        nextGrid[targetIdx] = src;
        engine.setInventorySlot(payload.idx, dest);
      } else {
        const src = nextGrid[payload.idx];
        nextGrid[payload.idx] = nextGrid[targetIdx];
        nextGrid[targetIdx] = src;
      }
      setCraftGrid(nextGrid);
    } catch {
      // ignore
    }
  };

  const canCraftRecipe = (r: CraftingRecipe): boolean => {
    if (r.requiresTable && !tableMode && gameMode !== 'creative') return false;
    if (gameMode === 'creative') return true;
    return getRecipeIngredients(r).every(
      (req) => engine.countInventoryItem(req.itemId) >= req.count
    );
  };

  const filteredRecipes = useMemo(() => {
    const q = recipeSearch.trim().toLowerCase();
    return CRAFTING_RECIPES.filter((r) => {
      if (!tableMode && r.requiresTable && gameMode !== 'creative') return false;
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || r.category.includes(q);
    });
  }, [recipeSearch, tableMode, gameMode]);

  const filteredCreativeItems = useMemo(() => {
    const q = creativeSearch.trim().toLowerCase();
    return ALL_ITEMS.filter((item) => {
      if (!q) return true;
      return item.name.toLowerCase().includes(q) || item.category.includes(q);
    });
  }, [creativeSearch]);

  const hoveredDef = hoveredItem ? getItemDef(hoveredItem.itemId) : null;

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400">
              {tableMode ? <Hammer className="w-5 h-5" /> : <Package className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">
                {tableMode ? 'Artisan Workbench (3×3 Crafting)' : 'Inventory & Crafting'}
              </h2>
              <p className="text-[11px] text-slate-400">
                Drag &amp; drop or click slots to organize. Right-click to split/place 1 item.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {gameMode === 'creative' && (
              <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
                <button
                  onClick={() => setActiveTab('craft')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    activeTab === 'craft'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Crafting
                </button>
                <button
                  onClick={() => setActiveTab('creative')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer ${
                    activeTab === 'creative'
                      ? 'bg-sky-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3 h-3" /> Catalog
                </button>
              </div>
            )}

            <button
              onClick={handleClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Panel: Crafting / Creative Catalog + Player Inventory */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            {activeTab === 'creative' && gameMode === 'creative' ? (
              <div className="bg-slate-950/60 border border-sky-500/30 rounded-xl p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-sky-300">
                    Creative Item Catalog (Click to Take Stack)
                  </span>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={creativeSearch}
                      onChange={(e) => setCreativeSearch(e.target.value)}
                      placeholder="Filter items..."
                      className="pl-8 pr-3 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-400 w-40"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-7 sm:grid-cols-9 gap-1.5 max-h-44 overflow-y-auto pr-1">
                  {filteredCreativeItems.map((item) => {
                    const previewStack = createItemStack(
                      item.id,
                      item.stackSize > 1 ? 64 : 1
                    );
                    return (
                      <ItemSlot
                        key={item.id}
                        stack={previewStack}
                        size="sm"
                        onHover={setHoveredItem}
                        onClick={() => {
                          engine.addItemToInventory(item.id, item.stackSize > 1 ? 64 : 1);
                          engine.audio.playPickup();
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Interactive Crafting Grid */
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 flex items-center justify-center gap-5">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    {gridSize}×{gridSize} Crafting Grid
                  </div>
                  <div
                    className="grid gap-1.5"
                    style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
                  >
                    {craftGrid.map((slot, cIdx) => (
                      <ItemSlot
                        key={cIdx}
                        stack={slot}
                        selected={selectedSlot?.zone === 'craft' && selectedSlot.idx === cIdx}
                        draggable
                        onDragStart={(e) => handleDragStartCraft(e, cIdx)}
                        onDrop={(e) => handleDropOnCraft(e, cIdx)}
                        onClick={() => handleCraftSlotClick(cIdx, false)}
                        onContextMenu={() => handleCraftSlotClick(cIdx, true)}
                        onHover={setHoveredItem}
                      />
                    ))}
                  </div>
                </div>

                <ArrowRight className="w-6 h-6 text-slate-500" />

                <div className="flex flex-col items-center">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 mb-2">
                    Output
                  </div>
                  <ItemSlot
                    stack={
                      matchedRecipe
                        ? createItemStack(
                            matchedRecipe.result.itemId,
                            matchedRecipe.result.count
                          )
                        : null
                    }
                    size="lg"
                    selected={Boolean(matchedRecipe)}
                    onClick={handleTakeCraftResult}
                    onHover={setHoveredItem}
                  />
                  {matchedRecipe && (
                    <span className="text-[10px] text-emerald-300 font-semibold mt-1">
                      Click to craft!
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Player Backpack (Slots 9-35) */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Backpack Storage
              </div>
              <div className="grid grid-cols-9 gap-1.5">
                {Array.from({ length: 27 }).map((_, i) => {
                  const idx = i + 9;
                  return (
                    <ItemSlot
                      key={idx}
                      stack={inventory[idx] ?? null}
                      selected={selectedSlot?.zone === 'inv' && selectedSlot.idx === idx}
                      draggable
                      onDragStart={(e) => handleDragStartInv(e, idx)}
                      onDrop={(e) => handleDropOnInv(e, idx)}
                      onClick={() => handleInvSlotClick(idx, false)}
                      onContextMenu={() => handleInvSlotClick(idx, true)}
                      onHover={setHoveredItem}
                    />
                  );
                })}
              </div>
            </div>

            {/* Player Hotbar (Slots 0-8) */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-1.5">
                Active Hotbar (Keys 1–9)
              </div>
              <div className="grid grid-cols-9 gap-1.5">
                {Array.from({ length: 9 }).map((_, idx) => (
                  <ItemSlot
                    key={idx}
                    stack={inventory[idx] ?? null}
                    slotLabel={String(idx + 1)}
                    selected={selectedSlot?.zone === 'inv' && selectedSlot.idx === idx}
                    draggable
                    onDragStart={(e) => handleDragStartInv(e, idx)}
                    onDrop={(e) => handleDropOnInv(e, idx)}
                    onClick={() => handleInvSlotClick(idx, false)}
                    onContextMenu={() => handleInvSlotClick(idx, true)}
                    onHover={setHoveredItem}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel: Quick-Craft Recipe Book */}
          <div className="lg:col-span-5 bg-slate-950/65 border border-slate-800 rounded-xl p-3 flex flex-col max-h-[430px]">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-emerald-300">
                <BookOpen className="w-4 h-4" />
                Recipe Book
              </div>
              <input
                type="text"
                value={recipeSearch}
                onChange={(e) => setRecipeSearch(e.target.value)}
                placeholder="Search recipes..."
                className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-400 w-36"
              />
            </div>

            {!tableMode && gameMode !== 'creative' && (
              <div className="text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2.5 py-1.5 mb-2">
                Place &amp; right-click an <strong>Artisan Workbench</strong> to unlock 3×3 tools, furnaces, chests &amp; altars!
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {filteredRecipes.map((r) => {
                const craftable = canCraftRecipe(r);
                const ings = getRecipeIngredients(r);
                return (
                  <div
                    key={r.id}
                    className={`flex items-center justify-between gap-2 p-2 rounded-xl border transition ${
                      craftable
                        ? 'bg-slate-800/80 border-emerald-500/40'
                        : 'bg-slate-900/60 border-slate-800/80 opacity-65'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <img
                        src={getItemIcon(r.result.itemId)}
                        alt={r.name}
                        className="w-7 h-7 pixelated shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">
                          {r.name}{' '}
                          {r.result.count > 1 && (
                            <span className="text-emerald-300">×{r.result.count}</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {ings
                            .map((i) => `${i.count}× ${getItemDef(i.itemId).name}`)
                            .join(', ')}
                        </div>
                      </div>
                    </div>

                    <button
                      disabled={!craftable}
                      onClick={() => engine.quickCraftRecipe(r)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold shrink-0 transition ${
                        craftable
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      Craft
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Item Inspector Footer */}
        <div className="px-5 py-2.5 bg-slate-950/80 border-t border-slate-800 min-h-[48px] flex items-center justify-between gap-4 text-xs">
          {hoveredDef && hoveredItem ? (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-extrabold text-white">{hoveredDef.name}</span>
              {hoveredDef.attackDamage && (
                <span className="text-rose-300 font-semibold">
                  ATK {hoveredDef.attackDamage}
                </span>
              )}
              {hoveredDef.miningSpeed && (
                <span className="text-sky-300 font-semibold">
                  SPD {hoveredDef.miningSpeed}×
                </span>
              )}
              {hoveredItem.enchantments && hoveredItem.enchantments.length > 0 && (
                <span className="text-purple-300 font-bold">
                  ✦ {hoveredItem.enchantments.map((e) => `${e.type.toUpperCase()} ${e.level}`).join(' • ')}
                </span>
              )}
              {hoveredDef.description && (
                <span className="text-slate-400">{hoveredDef.description}</span>
              )}
            </div>
          ) : (
            <span className="text-slate-500">
              Hover over any item to view stats, durability, and enchantments.
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
