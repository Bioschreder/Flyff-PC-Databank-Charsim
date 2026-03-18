import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { FlyffItem, EquippedItem, SetEffect, AwakenSlot } from '../types';

// ─── stat label map ───────────────────────────────────────────────────────────

const STAT_LABELS: Record<string, [string, string]> = {
  DST_STR:                ['STR',          ''],
  DST_DEX:                ['DEX',          ''],
  DST_INT:                ['INT',          ''],
  DST_STA:                ['STA',          ''],
  DST_HP_MAX:             ['HP',           ''],
  DST_MP_MAX:             ['MP',           ''],
  DST_FP_MAX:             ['FP',           ''],
  DST_ATKPOWER:           ['ATK',          ''],
  DST_ATKPOWER_RATE:      ['ATK',          '%'],
  DST_ADJDEF:             ['DEF',          ''],
  DST_ADJDEF_RATE:        ['DEF',          '%'],
  DST_CRITICAL_BONUS:     ['Krit. Schaden','%'],
  DST_CRITICAL:           ['Krit. Rate',   '%'],
  DST_SPEED:              ['Geschw.',      '%'],
  DST_ATTACKSPEED:        ['Angriffsgeschw.',  ''],
  DST_HPDRAIN_RATE:       ['Suck Blood',   '%'],
  DST_MPDRAIN_RATE:       ['Suck Mana',    '%'],
  DST_EXPERIENCE:         ['EXP',          '%'],
  DST_BLOCK_MELEE:        ['Melee Block',  '%'],
  DST_BLOCK_RANGE:        ['Range Block',  '%'],
  DST_BLOCK_MAGIC:        ['Magic Block',  '%'],
  DST_ADD_MAGIC:          ['Magie',        ''],
  DST_MONSTER_DMG:        ['Monster DMG',  '%'],
  DST_PVP_DMG:            ['PvP DMG',      '%'],
  DST_DROP_ITEM_ALLGRADE_RATE: ['Drop Rate','%'],
  DST_GOLD_RATE:          ['Gold',         '%'],
};

function statLabel(key: string): [string, string] {
  if (STAT_LABELS[key]) return STAT_LABELS[key];
  return [key.replace('DST_', '').replace(/_/g, ' ').toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase()), ''];
}

const GRADE_COLOR: Record<string, string> = {
  Normal:   'text-white',
  Unique:   'text-yellow-400',
  Ultimate: 'text-orange-400',
  Baruna:   'text-purple-400',
};

const SOULBOUND_LABEL: Record<string, string> = {
  always:     '🔒 Immer Seelengebunden',
  on_equip:   '🔒 Seelengebunden beim Anlegen',
  unbindable: '🔓 Entbindbar',
};

function iconUrl(icon: string) {
  return `/icons/${icon.toLowerCase().replace(/\.dds$/i, '.png')}`;
}

function fmtK(n: number): string {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K`
    : String(n);
}

// ─── tooltip content ──────────────────────────────────────────────────────────

interface TooltipProps {
  item: FlyffItem;
  equipped?: EquippedItem;
  setEffect?: SetEffect;
  x: number;
  y: number;
}

function TooltipContent({ item, equipped, setEffect, x, y }: TooltipProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x + 12, top: y + 12 });

  useEffect(() => {
    if (!ref.current) return;
    const el  = ref.current;
    const vw  = window.innerWidth;
    const vh  = window.innerHeight;
    const w   = el.offsetWidth;
    const h   = el.offsetHeight;
    let left  = x + 14;
    let top   = y + 14;
    if (left + w + 8 > vw) left = x - w - 8;
    if (top  + h + 8 > vh) top  = y - h - 8;
    setPos({ left: Math.max(4, left), top: Math.max(4, top) });
  }, [x, y]);

  const upgradeLevel = equipped?.upgradeLevel ?? 0;
  const awakenSlots  = equipped?.awakenSlots.filter(a => a.stat && a.value !== 0) ?? [];

  const isWeapon = item.atkMin > 0;
  const isArmor  = item.defMin > 0 && !isWeapon;

  const statEntries = Object.entries(item.stats).filter(([, v]) => v !== 0);

  return (
    <div
      ref={ref}
      className="fixed z-[9999] w-72 bg-gray-950 border border-gray-600 rounded-xl shadow-2xl pointer-events-none text-sm"
      style={{ left: pos.left, top: pos.top }}
    >
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-gray-700">
        <div className="flex items-start gap-2.5">
          {item.icon && (
            <div className="w-12 h-12 shrink-0 bg-gray-800 rounded flex items-center justify-center border border-gray-700">
              <img
                src={iconUrl(item.icon)}
                alt={item.name}
                className="w-10 h-10 object-contain"
                style={{ imageRendering: 'pixelated' }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className={`font-bold leading-tight ${GRADE_COLOR[item.grade] ?? 'text-white'}`}>
              {item.name}
              {upgradeLevel > 0 && (
                <span className="text-yellow-400 ml-1">+{upgradeLevel}</span>
              )}
            </div>
            <div className="text-xs text-gray-400 mt-0.5 flex flex-wrap gap-x-2">
              <span>Lv. {item.level}</span>
              {item.grade !== 'Normal' && (
                <span className={GRADE_COLOR[item.grade] ?? ''}>{item.grade}</span>
              )}
              {item.twoHanded && <span className="text-orange-400">Zweihand</span>}
              {item.job && item.job !== 'any' && <span className="text-blue-400">{item.job}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Main stats */}
      <div className="px-3 py-2 space-y-0.5">
        {isWeapon && (
          <Row label="ATK" value={`${item.atkMin} – ${item.atkMax}`} color="text-orange-300" />
        )}
        {isArmor && (
          <Row label="DEF" value={`${item.defMin} – ${item.defMax}`} color="text-blue-300" />
        )}
        {statEntries.map(([key, val]) => {
          const [label, unit] = statLabel(key);
          return (
            <Row key={key} label={label}
              value={`+${val}${unit}`}
              color="text-green-400"
            />
          );
        })}
      </div>

      {/* Upgrade bonus preview */}
      {upgradeLevel > 0 && (
        <div className="mx-3 mb-1 px-2 py-1.5 bg-yellow-900/20 border border-yellow-700/30 rounded">
          <div className="text-[10px] text-yellow-600 uppercase tracking-wide mb-0.5">Upgrade +{upgradeLevel}</div>
          {isWeapon && (
            <div className="text-xs text-yellow-400">
              ATK +{Math.round((item.atkMin + item.atkMax) / 2 * upgradeLevel * 0.05)} (≈ +5%/Stufe)
            </div>
          )}
          {isArmor && (
            <div className="text-xs text-yellow-400">
              DEF +{Math.round((item.defMin + item.defMax) / 2 * upgradeLevel * 0.05)} (≈ +5%/Stufe)
            </div>
          )}
        </div>
      )}

      {/* Awakening slots */}
      {awakenSlots.length > 0 && (
        <div className="mx-3 mb-1 px-2 py-1.5 bg-purple-900/20 border border-purple-700/30 rounded">
          <div className="text-[10px] text-purple-400 uppercase tracking-wide mb-0.5">Erweckung</div>
          <div className="space-y-0.5">
            {awakenSlots.map((a, i) => {
              const [label, unit] = statLabel(a.stat);
              return (
                <div key={i} className="text-xs text-purple-300 flex justify-between">
                  <span>{label}</span>
                  <span>{a.value > 0 ? '+' : ''}{a.value}{unit}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Set effect */}
      {setEffect && (
        <div className="mx-3 mb-2 px-2 py-1.5 bg-green-900/20 border border-green-700/30 rounded">
          <div className="text-[10px] text-green-500 uppercase tracking-wide mb-1">
            Set: {setEffect.name}
          </div>
          {setEffect.bonuses.map(tier => (
            <div key={tier.pieces} className="text-xs mb-0.5">
              <span className="text-yellow-500 mr-1">{tier.pieces} Teile:</span>
              {tier.effects.map((e, i) => (
                <span key={i} className="text-green-300">
                  {e.stat} +{e.value}{e.unit}{i < tier.effects.length - 1 ? ', ' : ''}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Soulbound */}
      {item.soulbound && (
        <div className="px-3 pb-2 text-[10px] text-gray-500">
          {SOULBOUND_LABEL[item.soulbound] ?? item.soulbound}
        </div>
      )}

      {/* Cost */}
      {item.cost > 0 && (
        <div className="px-3 pb-2 text-[10px] text-gray-600">
          Wert: {fmtK(item.cost)} ₱
        </div>
      )}
    </div>
  );
}

function Row({ label, value, color = 'text-white' }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-gray-400">{label}</span>
      <span className={`font-semibold ${color}`}>{value}</span>
    </div>
  );
}

// ─── hook ─────────────────────────────────────────────────────────────────────

interface UseTooltipReturn {
  tooltip: React.ReactNode;
  onMouseEnter: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
  onMouseMove: (e: React.MouseEvent) => void;
}

export function useItemTooltip(
  item: FlyffItem | undefined,
  equipped?: EquippedItem,
  setEffect?: SetEffect,
): UseTooltipReturn {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const onMouseEnter = useCallback((e: React.MouseEvent) => {
    if (item) setPos({ x: e.clientX, y: e.clientY });
  }, [item]);

  const onMouseLeave = useCallback(() => setPos(null), []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (pos) setPos({ x: e.clientX, y: e.clientY });
  }, [pos]);

  const tooltip = pos && item
    ? createPortal(
        <TooltipContent item={item} equipped={equipped} setEffect={setEffect} x={pos.x} y={pos.y} />,
        document.body,
      )
    : null;

  return { tooltip, onMouseEnter, onMouseLeave, onMouseMove };
}

// ─── wrapper component (for use in lists) ─────────────────────────────────────

interface ItemTooltipWrapperProps {
  item: FlyffItem;
  equipped?: EquippedItem;
  setEffect?: SetEffect;
  children: React.ReactNode;
  className?: string;
}

export function ItemTooltipWrapper({ item, equipped, setEffect, children, className }: ItemTooltipWrapperProps) {
  const { tooltip, onMouseEnter, onMouseLeave, onMouseMove } = useItemTooltip(item, equipped, setEffect);
  return (
    <div
      className={className}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseMove={onMouseMove}
    >
      {children}
      {tooltip}
    </div>
  );
}
