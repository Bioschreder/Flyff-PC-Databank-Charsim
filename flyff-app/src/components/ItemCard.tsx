import type { FlyffItem } from '../types';

const GRADE_COLORS: Record<string, string> = {
  Normal: 'text-gray-300',
  Rare: 'text-blue-400',
  Unique: 'text-yellow-400',
  Ultimate: 'text-orange-400',
  Baruna: 'text-purple-400',
};

const GRADE_BORDER: Record<string, string> = {
  Normal: 'border-gray-600',
  Rare: 'border-blue-500',
  Unique: 'border-yellow-500',
  Ultimate: 'border-orange-500',
  Baruna: 'border-purple-500',
};

const SOULBOUND_LABELS: Record<string, { label: string; color: string }> = {
  always:    { label: 'Seelengebunden',           color: 'bg-red-900/40 text-red-400' },
  permanent: { label: 'Permanent gebunden',        color: 'bg-red-900/40 text-red-400' },
};

function formatDuration(sec: number): string {
  if (sec >= 86400) return `${Math.round(sec / 86400)} Tage`;
  if (sec >= 3600)  return `${Math.round(sec / 3600)} Std.`;
  if (sec >= 60)    return `${Math.round(sec / 60)} Min.`;
  return `${sec} Sek.`;
}

interface Props {
  item: FlyffItem;
  onSelect?: (item: FlyffItem) => void;
  isComparing?: boolean;
  onAddToCompare?: (item: FlyffItem) => void;
  onRemoveFromCompare?: (item: FlyffItem) => void;
  inCompareList?: boolean;
}

export function ItemCard({ item, onSelect, onAddToCompare, onRemoveFromCompare, inCompareList }: Props) {
  const gradeColor = GRADE_COLORS[item.grade] ?? 'text-gray-300';
  const gradeBorder = GRADE_BORDER[item.grade] ?? 'border-gray-600';

  const iconUrl = item.icon
    ? `/icons/${item.icon.toLowerCase().replace(/\.dds$/i, '.png')}`
    : null;

  const hasAtk = item.atkMin > 0 || item.atkMax > 0;
  const hasDef = item.defMin > 0 || item.defMax > 0;
  const sbInfo = item.soulbound ? SOULBOUND_LABELS[item.soulbound] : null;

  return (
    <div
      className={`relative flex flex-col bg-gray-800 border ${gradeBorder} rounded-lg p-3 gap-2 cursor-pointer hover:bg-gray-750 transition-colors group`}
      onClick={() => onSelect?.(item)}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 flex-shrink-0 bg-gray-900 rounded border border-gray-700 flex items-center justify-center overflow-hidden">
          {iconUrl ? (
            <img
              src={iconUrl}
              alt={item.name}
              className="w-full h-full object-contain"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <span className="text-gray-600 text-xs">?</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`font-semibold text-sm truncate ${gradeColor}`}>{item.name}</div>
          <div className="text-xs text-gray-400 truncate">
            {[item.subcategory, item.type].filter(Boolean).join(' › ')}
          </div>
        </div>
        <div className="text-xs text-gray-500 flex-shrink-0">Lv.{item.level}</div>
      </div>

      <div className="flex flex-wrap gap-1 text-xs">
        {item.grade !== 'Normal' && (
          <span className={`px-1.5 py-0.5 rounded text-xs font-medium bg-gray-900 ${gradeColor}`}>
            {item.grade}
          </span>
        )}
        {item.isSet && (
          <span className="px-1.5 py-0.5 rounded bg-yellow-900/40 text-yellow-400 text-xs">Set</span>
        )}
        {Object.keys(item.stats).length > 0 && (
          <span className="px-1.5 py-0.5 rounded bg-green-900/40 text-green-400 text-xs">+{Object.keys(item.stats).length} stats</span>
        )}
        {item.job && item.job !== 'Vagrant' && (
          <span className="px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">{item.job}</span>
        )}
        {item.slot && (
          <span className="px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">{item.slot}</span>
        )}
        {sbInfo && (
          <span className={`px-1.5 py-0.5 rounded text-xs ${sbInfo.color}`}>{sbInfo.label}</span>
        )}
      </div>

      {(hasAtk || hasDef) && (
        <div className="text-xs text-gray-400 flex gap-3">
          {hasAtk && <span>ATK: {item.atkMin}–{item.atkMax}{item.twoHanded ? ' · 2H' : ''}</span>}
          {hasDef && <span>DEF: {item.defMin}–{item.defMax}</span>}
        </div>
      )}

      {item.description && (
        <div className="text-xs text-gray-400 italic border-t border-gray-700 pt-1.5">
          {item.description}
        </div>
      )}

      {item.powerup && (
        <div className="text-xs border-t border-gray-700 pt-1.5 space-y-0.5">
          <div className="text-blue-400 font-medium">
            {item.powerup.effectType} · {formatDuration(item.powerup.durationSec)}
          </div>
          {item.powerup.effects.map((e, i) => (
            <div key={i} className="text-green-400">
              {e.stat} +{e.value}{e.unit}
            </div>
          ))}
        </div>
      )}

      <button
        className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
          inCompareList
            ? 'bg-red-700 hover:bg-red-600 text-white'
            : 'bg-blue-700 hover:bg-blue-600 text-white'
        }`}
        onClick={e => {
          e.stopPropagation();
          if (inCompareList) onRemoveFromCompare?.(item);
          else onAddToCompare?.(item);
        }}
      >
        {inCompareList ? '−' : '+'}
      </button>
    </div>
  );
}
