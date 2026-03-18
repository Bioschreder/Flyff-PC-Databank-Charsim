import type React from 'react';
import type { EquipSlot, EquippedItem, FlyffItem, ActiveSetBonus, SetEffectsDB } from '../types';
import { EquipmentSlot } from './EquipmentSlot';

const BLADE_JOBS = new Set(['JOB_BLADE', 'JOB_BLADE_MASTER', 'JOB_BLADE_HERO', 'JOB_STORMBLADE_HERO']);

interface Props {
  equipment: Partial<Record<EquipSlot, EquippedItem>>;
  itemMap: Map<string, FlyffItem>;
  activeSetBonuses: ActiveSetBonus[];
  setEffectsDB: SetEffectsDB;
  jobId: string;
  onSlotClick: (slot: EquipSlot) => void;
  onReset: () => void;
}

function S({ slot, equipment, itemMap, setEffectsDB, onSlotClick, style, disabled, overrideLabel }: {
  slot: EquipSlot;
  equipment: Partial<Record<EquipSlot, EquippedItem>>;
  itemMap: Map<string, FlyffItem>;
  setEffectsDB: SetEffectsDB;
  onSlotClick: (slot: EquipSlot) => void;
  style?: React.CSSProperties;
  disabled?: boolean;
  overrideLabel?: string;
}) {
  const equipped   = equipment[slot];
  const item       = equipped ? itemMap.get(equipped.itemId) : undefined;
  const setEffect  = item?.setFamily ? setEffectsDB[item.setFamily] : undefined;
  return (
    <div style={style}>
      <EquipmentSlot
        slot={slot}
        equipped={equipped}
        item={item}
        setEffect={setEffect}
        disabled={disabled}
        overrideLabel={overrideLabel}
        onClick={() => !disabled && onSlotClick(slot)}
      />
    </div>
  );
}

// Grid cell size
const SZ = 66;
const GAP = 6;
const cell = (col: number, row: number, colSpan = 1, rowSpan = 1): React.CSSProperties => ({
  gridColumn: `${col} / span ${colSpan}`,
  gridRow:    `${row} / span ${rowSpan}`,
});

export function EquipmentPanel({ equipment, itemMap, activeSetBonuses, setEffectsDB, jobId, onSlotClick, onReset }: Props) {
  const isDualWield = BLADE_JOBS.has(jobId);
  const weaponItem  = equipment.weapon ? itemMap.get(equipment.weapon.itemId) : undefined;
  const has2H       = weaponItem?.twoHanded === true;
  // Shield slot: disabled if 2H equipped (and not dual-wield with a 2H), shows as Waffe 2 for Blade
  const shieldDisabled = has2H;
  const shieldLabel    = isDualWield && !has2H ? 'Waffe 2' : undefined;
  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(5, ${SZ}px)`,
    gridTemplateRows:    `repeat(7, ${SZ}px)`,
    gap: `${GAP}px`,
  };

  return (
    <div className="flex flex-col gap-3">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300">Ausrüstung</h3>
        <button onClick={onReset} className="text-xs text-gray-500 hover:text-red-400 transition-colors">
          Zurücksetzen
        </button>
      </div>

      {/* ── Paper-doll grid ── */}
      <div style={gridStyle}>

        {/* Row 1 – Accessories */}
        <S slot="ring1"     style={cell(1,1)} equipment={equipment} itemMap={itemMap} setEffectsDB={setEffectsDB} onSlotClick={onSlotClick} />
        <S slot="ear1"      style={cell(2,1)} equipment={equipment} itemMap={itemMap} setEffectsDB={setEffectsDB} onSlotClick={onSlotClick} />
        <S slot="necklace"  style={cell(3,1)} equipment={equipment} itemMap={itemMap} setEffectsDB={setEffectsDB} onSlotClick={onSlotClick} />
        <S slot="ear2"      style={cell(4,1)} equipment={equipment} itemMap={itemMap} setEffectsDB={setEffectsDB} onSlotClick={onSlotClick} />
        <S slot="ring2"     style={cell(5,1)} equipment={equipment} itemMap={itemMap} setEffectsDB={setEffectsDB} onSlotClick={onSlotClick} />

        {/* Row 2 – Talismane unter den Ohrringen (col 2 + col 4) */}
        <S slot="talisman1" style={cell(2,2)} equipment={equipment} itemMap={itemMap} setEffectsDB={setEffectsDB} onSlotClick={onSlotClick} />
        <S slot="talisman2" style={cell(4,2)} equipment={equipment} itemMap={itemMap} setEffectsDB={setEffectsDB} onSlotClick={onSlotClick} />

        {/* Character silhouette: cols 2-4, rows 3-6 */}
        <div
          style={{ ...cell(2, 3, 3, 4) }}
          className="bg-gray-900/60 rounded-xl border border-gray-700/40 flex flex-col items-center justify-center relative overflow-hidden"
        >
          <svg viewBox="0 0 60 100" className="w-16 h-28 opacity-15 fill-gray-400">
            <circle cx="30" cy="12" r="10" />
            <rect x="16" y="24" width="28" height="34" rx="5" />
            <rect x="4"  y="24" width="11" height="26" rx="4" />
            <rect x="45" y="24" width="11" height="26" rx="4" />
            <rect x="16" y="58" width="11" height="30" rx="4" />
            <rect x="33" y="58" width="11" height="30" rx="4" />
          </svg>
          <span className="absolute bottom-2 text-[9px] text-gray-700 tracking-wide select-none">Charakter</span>
        </div>

        {/* Left column: Weapon, Shield, empty, Cloak */}
        <S slot="weapon" style={cell(1,3)} equipment={equipment} itemMap={itemMap} setEffectsDB={setEffectsDB} onSlotClick={onSlotClick} />
        <S slot="shield" style={cell(1,4)} equipment={equipment} itemMap={itemMap} setEffectsDB={setEffectsDB} onSlotClick={onSlotClick}
           disabled={shieldDisabled} overrideLabel={shieldLabel} />
        <S slot="cloak"  style={cell(1,6)} equipment={equipment} itemMap={itemMap} setEffectsDB={setEffectsDB} onSlotClick={onSlotClick} />

        {/* Right column: Hat, Suit, Glove, Boots */}
        <S slot="hat"   style={cell(5,3)} equipment={equipment} itemMap={itemMap} setEffectsDB={setEffectsDB} onSlotClick={onSlotClick} />
        <S slot="suit"  style={cell(5,4)} equipment={equipment} itemMap={itemMap} setEffectsDB={setEffectsDB} onSlotClick={onSlotClick} />
        <S slot="glove" style={cell(5,5)} equipment={equipment} itemMap={itemMap} setEffectsDB={setEffectsDB} onSlotClick={onSlotClick} />
        <S slot="boots" style={cell(5,6)} equipment={equipment} itemMap={itemMap} setEffectsDB={setEffectsDB} onSlotClick={onSlotClick} />

        {/* Row 7 – CS / Kostüm */}
        <S slot="mask"     style={cell(1,7)} equipment={equipment} itemMap={itemMap} setEffectsDB={setEffectsDB} onSlotClick={onSlotClick} />
        <S slot="cs_hat"   style={cell(2,7)} equipment={equipment} itemMap={itemMap} setEffectsDB={setEffectsDB} onSlotClick={onSlotClick} />
        <S slot="cs_suit"  style={cell(3,7)} equipment={equipment} itemMap={itemMap} setEffectsDB={setEffectsDB} onSlotClick={onSlotClick} />
        <S slot="cs_glove" style={cell(4,7)} equipment={equipment} itemMap={itemMap} setEffectsDB={setEffectsDB} onSlotClick={onSlotClick} />
        <S slot="cs_boots" style={cell(5,7)} equipment={equipment} itemMap={itemMap} setEffectsDB={setEffectsDB} onSlotClick={onSlotClick} />

      </div>

      {/* ── Active Set Bonuses ── */}
      {activeSetBonuses.length > 0 && (
        <div className="space-y-1.5 mt-1">
          <div className="text-[10px] text-gray-500 uppercase tracking-widest">Aktive Sets</div>
          {activeSetBonuses.map(set => (
            <div key={set.familyId} className="bg-gray-800 rounded p-2 border border-green-800/40">
              <div className="text-xs font-semibold text-green-400 mb-1">
                {set.name} ({set.equippedCount} Teile)
              </div>
              {set.activeTiers.map(tier => (
                <div key={tier.pieces} className="text-xs text-gray-300">
                  <span className="text-yellow-500">{tier.pieces}/set: </span>
                  {tier.effects.map((e, i) => (
                    <span key={i}>
                      {e.stat} +{e.value}{e.unit}{i < tier.effects.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
