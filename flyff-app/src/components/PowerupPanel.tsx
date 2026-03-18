import { useState, useMemo } from 'react';
import type { FlyffItem } from '../types';

interface Props {
  items: FlyffItem[];
  activeBuffIds: string[];
  onToggle: (id: string) => void;
}

function formatDuration(sec: number): string {
  if (sec <= 0) return '';
  if (sec >= 3600) return `${(sec / 3600).toFixed(0)}h`;
  if (sec >= 60) return `${(sec / 60).toFixed(0)}min`;
  return `${sec}s`;
}

function iconUrl(icon: string): string {
  return `/icons/${icon.toLowerCase().replace(/\.dds$/i, '.png')}`;
}

// Filter category definitions
type FilterKey = 'all' | 'active' | 'atk' | 'def' | 'stats' | 'exp' | 'hp' | 'element';

const FILTER_LABELS: Record<FilterKey, string> = {
  all:     'Alle',
  active:  'Aktiv',
  atk:     'Angriff',
  def:     'Verteidigung',
  stats:   'Stats',
  exp:     'EXP/Drop',
  hp:      'HP/MP/FP',
  element: 'Element',
};

const ATK_STATS   = new Set(['ATK', 'Addmagic', 'Chr Dmg', 'Crit DMG', 'Axe Dmg', 'Bow Dmg',
  'Swd Dmg', 'Yoy Dmg', 'Monster Dmg', 'PvP DMG', 'Pvp Dmg Rate', 'Melee Stealhp',
  'Adj Hitrate', 'Attackspeed', 'Chr Chancecritical', 'Spell Rate', 'Give Pve Dmg Element Earth Rate',
  'Give Pve Dmg Element Elect Rate', 'Give Pve Dmg Element Fire Rate', 'Give Pve Dmg Element Water Rate']);
const DEF_STATS   = new Set(['DEF', 'Block Melee', 'Block Range', 'Parry', 'Reflect Damage', 'Resist Magic']);
const STAT_STATS  = new Set(['STR', 'STA', 'DEX', 'INT', 'Stat Allup']);
const EXP_STATS   = new Set(['EXP', 'Drop Item Allgrade Rate', 'Restpoint Rate']);
const HP_STATS    = new Set(['Hp', 'Max HP', 'Max MP', 'FP', 'HP/MP/FP', 'Move Speed', 'Jump Power']);
const ELEM_STATS  = new Set(['Fire ATK', 'Fire RES', 'Water ATK', 'Water RES', 'Elec ATK', 'Elec RES',
  'Earth ATK', 'Earth RES', 'Wind ATK', 'Wind DMG', 'Wind RES']);

function itemMatchesFilter(item: FlyffItem, filter: FilterKey, activeIds: string[]): boolean {
  if (filter === 'all') return true;
  if (filter === 'active') return activeIds.includes(item.id);
  const stats = item.powerup!.effects.map(e => e.stat);
  if (filter === 'atk')     return stats.some(s => ATK_STATS.has(s));
  if (filter === 'def')     return stats.some(s => DEF_STATS.has(s));
  if (filter === 'stats')   return stats.some(s => STAT_STATS.has(s));
  if (filter === 'exp')     return stats.some(s => EXP_STATS.has(s));
  if (filter === 'hp')      return stats.some(s => HP_STATS.has(s));
  if (filter === 'element') return stats.some(s => ELEM_STATS.has(s));
  return true;
}

export function PowerupPanel({ items, activeBuffIds, onToggle }: Props) {
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState<FilterKey>('all');

  const allPowerups = useMemo(
    () => items.filter(i => i.powerup !== null).sort((a, b) => a.name.localeCompare(b.name)),
    [items]
  );

  const visible = useMemo(() => {
    const q = search.toLowerCase();
    return allPowerups.filter(item =>
      itemMatchesFilter(item, filter, activeBuffIds) &&
      (!q || item.name.toLowerCase().includes(q))
    );
  }, [allPowerups, filter, activeBuffIds, search]);

  if (allPowerups.length === 0) {
    return <div className="text-xs text-gray-600 text-center py-4">Keine Powerups verfügbar</div>;
  }

  return (
    <div className="flex flex-col gap-2">

      {/* Search */}
      <input
        type="text"
        placeholder="Powerup suchen…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
      />

      {/* Filter chips */}
      <div className="flex flex-wrap gap-1">
        {(Object.keys(FILTER_LABELS) as FilterKey[]).map(key => {
          const isActive = filter === key;
          const count = key === 'all'
            ? allPowerups.length
            : allPowerups.filter(i => itemMatchesFilter(i, key, activeBuffIds)).length;
          if (count === 0 && key !== 'all' && key !== 'active') return null;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                isActive
                  ? key === 'active'
                    ? 'bg-green-700 text-white'
                    : 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {FILTER_LABELS[key]}
              <span className={`ml-1 text-[10px] ${isActive ? 'opacity-80' : 'text-gray-500'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active count hint */}
      {activeBuffIds.length > 0 && filter !== 'active' && (
        <div className="text-[10px] text-green-400">
          {activeBuffIds.length} Buff{activeBuffIds.length > 1 ? 's' : ''} aktiv
          <button
            onClick={() => setFilter('active')}
            className="ml-1 underline hover:text-green-300"
          >
            Anzeigen
          </button>
        </div>
      )}

      {/* Results count */}
      <div className="text-[10px] text-gray-600">
        {visible.length} von {allPowerups.length} Powerups
      </div>

      {/* Item list */}
      <div className="space-y-1">
        {visible.length === 0 && (
          <div className="text-xs text-gray-600 text-center py-3">Keine Treffer</div>
        )}
        {visible.map(item => {
          const active = activeBuffIds.includes(item.id);
          const p = item.powerup!;
          const dur = formatDuration(p.durationSec);
          return (
            <button
              key={item.id}
              onClick={() => onToggle(item.id)}
              className={`
                w-full flex items-center gap-2 px-2 py-2 rounded text-left transition-colors border
                ${active
                  ? 'bg-green-900/40 border-green-700/50 hover:bg-green-900/60'
                  : 'bg-gray-800 border-gray-700 hover:bg-gray-700'
                }
              `}
            >
              {/* Icon */}
              <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
                {item.icon && (
                  <img
                    src={iconUrl(item.icon)}
                    alt=""
                    className="w-full h-full object-contain"
                    style={{ imageRendering: 'pixelated' }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className={`text-xs font-semibold truncate ${active ? 'text-green-300' : 'text-gray-200'}`}>
                  {item.name}
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">
                  {dur && <span className="text-blue-400 mr-1">{dur}</span>}
                  {p.effects.map((e, i) => (
                    <span key={i}>
                      {e.stat} +{e.value}{e.unit}
                      {i < p.effects.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </div>
              </div>

              {/* Checkbox */}
              <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${
                active ? 'bg-green-500 border-green-400' : 'border-gray-600'
              }`}>
                {active && <span className="text-white text-[10px] leading-none">✓</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
