import React from 'react';
import { getItemDef } from '../engine/blocks';
import { getItemIcon } from '../engine/textures';
import { ItemStack } from '../engine/types';

interface ItemSlotProps {
  stack: ItemStack | null;
  selected?: boolean;
  size?: 'sm' | 'md' | 'lg';
  slotLabel?: string;
  placeholderIcon?: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onHover?: (stack: ItemStack | null) => void;
  className?: string;
}

export const ItemSlot: React.FC<ItemSlotProps> = ({
  stack,
  selected = false,
  size = 'md',
  slotLabel,
  placeholderIcon,
  onClick,
  onContextMenu,
  draggable = false,
  onDragStart,
  onDragOver,
  onDrop,
  onHover,
  className = '',
}) => {
  const dims =
    size === 'sm'
      ? 'w-9 h-9 sm:w-10 sm:h-10'
      : size === 'lg'
      ? 'w-13 h-13 sm:w-14 sm:h-14'
      : 'w-9 h-9 sm:w-12 sm:h-12';

  const def = stack ? getItemDef(stack.itemId) : null;
  const iconUrl = stack ? getItemIcon(stack.itemId) : '';
  const hasEnchant = Boolean(stack?.enchantments && stack.enchantments.length > 0);
  const durabilityPct =
    stack?.maxDurability && stack.durability !== undefined
      ? Math.max(0, Math.min(100, (stack.durability / stack.maxDurability) * 100))
      : null;

  return (
    <div
      onClick={onClick}
      onContextMenu={(e) => {
        if (onContextMenu) {
          e.preventDefault();
          onContextMenu(e);
        }
      }}
      draggable={draggable && Boolean(stack)}
      onDragStart={onDragStart}
      onDragOver={(e) => {
        if (onDrop || onDragOver) {
          e.preventDefault();
          onDragOver?.(e);
        }
      }}
      onDrop={(e) => {
        if (onDrop) {
          e.preventDefault();
          onDrop(e);
        }
      }}
      onMouseEnter={() => onHover?.(stack)}
      onMouseLeave={() => onHover?.(null)}
      title={def ? def.name : undefined}
      className={`relative ${dims} rounded-lg flex items-center justify-center transition-all cursor-pointer select-none overflow-hidden border ${
        selected
          ? 'border-amber-400 bg-slate-800/95 ring-2 ring-amber-400/50 scale-105 z-10 shadow-lg shadow-amber-500/20'
          : 'border-slate-700/90 bg-slate-900/85 hover:border-slate-500 hover:bg-slate-800/90'
      } ${className}`}
    >
      {slotLabel && (
        <span className="absolute top-0.5 left-1 text-[9px] font-bold text-slate-500 pointer-events-none">
          {slotLabel}
        </span>
      )}

      {!stack && placeholderIcon && (
        <div className="text-slate-600/70 pointer-events-none">{placeholderIcon}</div>
      )}

      {stack && iconUrl && (
        <>
          <img
            src={iconUrl}
            alt={def?.name ?? ''}
            draggable={false}
            className="w-7 h-7 sm:w-8 sm:h-8 pixelated pointer-events-none drop-shadow-[0_2px_2px_rgba(0,0,0,0.65)]"
          />
          {hasEnchant && (
            <div className="absolute inset-0 enchant-glint pointer-events-none" />
          )}
          {stack.count > 1 && (
            <span className="absolute bottom-0.5 right-1 text-[11px] font-extrabold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] pointer-events-none">
              {stack.count}
            </span>
          )}
          {durabilityPct !== null && durabilityPct < 100 && (
            <div className="absolute bottom-0.5 left-1 right-1 h-1 bg-slate-950/90 rounded-full overflow-hidden pointer-events-none">
              <div
                className="h-full transition-all"
                style={{
                  width: `${durabilityPct}%`,
                  backgroundColor:
                    durabilityPct > 50
                      ? '#22c55e'
                      : durabilityPct > 25
                      ? '#f59e0b'
                      : '#ef4444',
                }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};
