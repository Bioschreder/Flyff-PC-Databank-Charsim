import { X, ArrowUp, ArrowDown } from 'lucide-react';
import type { FlyffItem } from '../types';

interface Props {
  items: FlyffItem[];
  onRemove: (item: FlyffItem) => void;
}

const GRADE_COLORS: Record<string, string> = {
  Normal: 'text-gray-300',
  Rare: 'text-blue-400',
  Unique: 'text-yellow-400',
  Ultimate: 'text-orange-400',
  Baruna: 'text-purple-400',
};

const STAT_LABELS: Record<string, string> = {
  DST_STR: 'STR', DST_INT: 'INT', DST_DEX: 'DEX', DST_STA: 'STA',
  DST_HP: 'Max HP', DST_MP: 'Max MP', DST_FP: 'Max FP',
  DST_ATKSPEED: 'Attack Speed', DST_MOVING_SPEED: 'Move Speed',
  DST_CRITICAL_BONUS: 'Critical Bonus', DST_HPDAMAGE_RATE: 'HP Damage',
  DST_MELEE_ATK: 'Melee ATK', DST_MAGIC_ATK: 'Magic ATK',
  DST_MELEE_BLOCK: 'Block Rate', DST_MAGIC_BLOCK: 'Magic Block',
  DST_PARRY: 'Parry', DST_REFLECT_DAMAGE: 'Reflect DMG',
  DST_RES_WIND: 'Wind RES', DST_RES_FIRE: 'Fire RES',
  DST_RES_WATER: 'Water RES', DST_RES_ELECTRICITY: 'Elec RES',
  DST_RES_EARTH: 'Earth RES',
};

function formatStat(key: string): string {
  return STAT_LABELS[key] ?? key.replace(/^DST_/, '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

export function ItemComparison({ items, onRemove }: Props) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-gray-500">
        <div className="w-16 h-16 border-2 border-dashed border-gray-700 rounded-full flex items-center justify-center text-2xl">+</div>
        <div className="text-sm">Add items from the Item Manager to compare them</div>
      </div>
    );
  }

  // Collect all stat keys
  const baseKeys = ['level', 'atkMin', 'atkMax', 'defMin', 'defMax', 'cost'];
  const allStatKeys = Array.from(new Set(items.flatMap(i => Object.keys(i.stats))));

  const getBaseVal = (item: FlyffItem, key: string): number => {
    const map: Record<string, number> = {
      level: item.level,
      atkMin: item.atkMin,
      atkMax: item.atkMax,
      defMin: item.defMin,
      defMax: item.defMax,
      cost: item.cost,
    };
    return map[key] ?? 0;
  };

  const maxVals: Record<string, number> = {};
  for (const key of baseKeys) {
    maxVals[key] = Math.max(...items.map(i => getBaseVal(i, key)));
  }
  for (const key of allStatKeys) {
    maxVals[key] = Math.max(...items.map(i => i.stats[key] ?? 0));
  }

  return (
    <div className="flex flex-col gap-4 overflow-x-auto">
      {/* Item Headers */}
      <div className="flex gap-4" style={{ minWidth: items.length * 220 }}>
        {items.map(item => {
          const iconUrl = item.icon
            ? `/icons/${item.icon.toLowerCase().replace(/\.dds$/i, '.png')}`
            : null;
          return (
            <div
              key={item.id}
              className="flex-1 bg-gray-800 rounded-lg p-4 flex flex-col items-center gap-2 relative"
              style={{ minWidth: 200 }}
            >
              <button
                onClick={() => onRemove(item)}
                className="absolute top-2 right-2 text-gray-600 hover:text-red-400 transition-colors"
              >
                <X size={14} />
              </button>
              <div className="w-16 h-16 bg-gray-900 rounded border border-gray-700 flex items-center justify-center">
                {iconUrl && (
                  <img src={iconUrl} alt={item.name} className="w-full h-full object-contain"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                )}
              </div>
              <div className={`font-bold text-center text-sm ${GRADE_COLORS[item.grade] ?? 'text-white'}`}>
                {item.name}
              </div>
              <div className="text-xs text-gray-500">{item.grade}</div>
              <div className="text-xs text-gray-400">{[item.subcategory, item.type].filter(Boolean).join(' › ')}</div>
            </div>
          );
        })}
      </div>

      {/* Stat Table */}
      <div className="bg-gray-800 rounded-lg overflow-hidden" style={{ minWidth: items.length * 220 }}>
        <StatSection label="General">
          <StatRow label="Level" items={items} statKey="level" maxVals={maxVals} getVal={i => getBaseVal(i, 'level')} />
          <StatRow label="Job" items={items} statKey="" getVal={i => i.job} />
          <StatRow label="Slot" items={items} statKey="" getVal={i => i.slot} />
          {items.some(i => i.twoHanded) && (
            <StatRow label="Handed" items={items} statKey="" getVal={i => i.twoHanded ? '2H' : '1H'} />
          )}
          {items.some(i => i.atkMin > 0) && (
            <StatRow label="Attack" items={items} statKey="atkMax" maxVals={maxVals}
              getVal={i => i.atkMin > 0 ? `${i.atkMin}–${i.atkMax}` : '—'}
              numVal={i => i.atkMax} />
          )}
          {items.some(i => i.defMin > 0) && (
            <StatRow label="Defense" items={items} statKey="defMax" maxVals={maxVals}
              getVal={i => i.defMin > 0 ? `${i.defMin}–${i.defMax}` : '—'}
              numVal={i => i.defMax} />
          )}
          <StatRow label="Cost" items={items} statKey="cost" maxVals={maxVals}
            getVal={i => i.cost > 0 ? i.cost.toLocaleString() + ' P' : '—'} numVal={i => i.cost} />
        </StatSection>

        {allStatKeys.length > 0 && (
          <StatSection label="Bonus Stats">
            {allStatKeys.map(key => (
              <StatRow
                key={key}
                label={formatStat(key)}
                items={items}
                statKey={key}
                maxVals={maxVals}
                getVal={i => i.stats[key] ? `+${i.stats[key]}` : '—'}
                numVal={i => i.stats[key] ?? 0}
              />
            ))}
          </StatSection>
        )}
      </div>
    </div>
  );
}

function StatSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="bg-gray-900 px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
        {label}
      </div>
      {children}
    </div>
  );
}

function StatRow({ label, items, statKey: _statKey, maxVals: _maxVals, getVal, numVal }: {
  label: string;
  items: FlyffItem[];
  statKey: string;
  maxVals?: Record<string, number>;
  getVal: (i: FlyffItem) => string | number;
  numVal?: (i: FlyffItem) => number;
}) {
  const nums = numVal ? items.map(numVal) : null;
  const max = nums ? Math.max(...nums) : null;
  const min = nums ? Math.min(...nums) : null;

  return (
    <div className="flex border-b border-gray-700 last:border-0">
      <div className="w-32 flex-shrink-0 px-4 py-2.5 text-xs text-gray-500 flex items-center">{label}</div>
      {items.map((item, _idx) => {
        const val = getVal(item);
        const num = numVal ? numVal(item) : null;
        const isBest = num !== null && max !== null && min !== null && max > 0 && num === max && max !== min;
        const isWorst = num !== null && max !== null && min !== null && max > 0 && num === min && max !== min;
        return (
          <div
            key={item.id}
            className={`flex-1 px-4 py-2.5 text-xs flex items-center gap-1 ${isBest ? 'text-green-400' : isWorst ? 'text-red-400' : 'text-gray-300'}`}
          >
            {String(val)}
            {isBest && num && num > 0 && <ArrowUp size={10} className="text-green-500" />}
            {isWorst && num && num > 0 && <ArrowDown size={10} className="text-red-500" />}
          </div>
        );
      })}
    </div>
  );
}
