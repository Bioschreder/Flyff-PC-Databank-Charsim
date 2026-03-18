import type { EquipSlot, EquippedItem, FlyffItem, SetEffect } from '../types';
import { useItemTooltip } from './ItemTooltip';

const SLOT_LABELS: Record<EquipSlot, string> = {
  weapon: 'Waffe',
  shield: 'Schild',
  hat: 'Helm',
  suit: 'Rüstung',
  glove: 'Handschuhe',
  boots: 'Stiefel',
  cs_hat: 'CS Helm',
  cs_suit: 'CS Rüstung',
  cs_glove: 'CS Handschuhe',
  cs_boots: 'CS Stiefel',
  cloak: 'Umhang',
  mask: 'Maske',
  ring1: 'Ring 1',
  ring2: 'Ring 2',
  ear1: 'Ohrring 1',
  ear2: 'Ohrring 2',
  necklace: 'Halskette',
  talisman1: 'Talisman 1',
  talisman2: 'Talisman 2',
};

const GRADE_BORDER: Record<string, string> = {
  Normal:   'border-gray-600',
  Unique:   'border-yellow-500/70',
  Ultimate: 'border-orange-500/70',
  Baruna:   'border-purple-500/70',
};

function iconUrl(icon: string): string {
  return `/icons/${icon.toLowerCase().replace(/\.dds$/i, '.png')}`;
}

interface Props {
  slot: EquipSlot;
  equipped: EquippedItem | undefined;
  item: FlyffItem | undefined;
  setEffect?: SetEffect;
  disabled?: boolean;
  overrideLabel?: string;
  onClick: () => void;
}

export function EquipmentSlot({ slot, equipped, item, setEffect, disabled, overrideLabel, onClick }: Props) {
  const label        = overrideLabel ?? SLOT_LABELS[slot];
  const hasItem      = !!item && !disabled;
  const upgradeLevel = equipped?.upgradeLevel ?? 0;
  const awakenCount  = equipped?.awakenSlots.filter(a => a.stat && a.value !== 0).length ?? 0;
  const gradeBorder  = item && !disabled ? (GRADE_BORDER[item.grade] ?? 'border-gray-600') : 'border-gray-700';

  const { tooltip, onMouseEnter, onMouseLeave, onMouseMove } = useItemTooltip(
    disabled ? undefined : item, equipped, setEffect
  );

  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseMove={onMouseMove}
      disabled={disabled && !hasItem}
      title={disabled ? '2H-Waffe ausgerüstet' : undefined}
      className={`
        relative flex flex-col items-center justify-center gap-0.5
        w-16 h-16 rounded border-2 transition-all text-center
        ${disabled
          ? 'border-gray-800 bg-gray-950/80 opacity-40 cursor-not-allowed'
          : hasItem
            ? `${gradeBorder} bg-gray-800 hover:bg-gray-700 cursor-pointer`
            : 'border-gray-700/60 bg-gray-900/80 hover:border-gray-500 hover:bg-gray-800 cursor-pointer'
        }
      `}
    >
      {hasItem ? (
        <>
          <div className="w-10 h-10 flex items-center justify-center">
            {item.icon ? (
              <img
                src={iconUrl(item.icon)}
                alt={item.name}
                className="w-full h-full object-contain"
                style={{ imageRendering: 'pixelated' }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <span className="text-gray-600 text-xs">?</span>
            )}
          </div>

          {upgradeLevel > 0 && (
            <span className="absolute top-0.5 right-0.5 text-[10px] text-yellow-400 font-bold leading-none drop-shadow">
              +{upgradeLevel}
            </span>
          )}
          {awakenCount > 0 && (
            <span className="absolute bottom-0.5 right-0.5 text-[10px] text-purple-400 font-bold leading-none">
              ✦{awakenCount}
            </span>
          )}

          <span className="text-[9px] text-gray-300 leading-tight max-w-full truncate px-0.5 w-full text-center">
            {item.name.length > 11 ? item.name.slice(0, 10) + '…' : item.name}
          </span>
        </>
      ) : (
        <span className="text-[10px] text-gray-600 leading-tight px-0.5">{label}</span>
      )}

      {tooltip}
    </button>
  );
}
