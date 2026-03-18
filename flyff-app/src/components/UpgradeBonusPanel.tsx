import { useState } from 'react';
import type { UpgradeBonusDB } from '../types';

interface Props {
  itemId: string;
  upgrades: UpgradeBonusDB | null;
}

export function UpgradeBonusPanel({ itemId, upgrades }: Props) {
  const levels = upgrades?.[itemId];
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);

  if (!levels || levels.length === 0) return null;

  const maxLevel = levels[levels.length - 1].level;
  const minLevel = levels[0].level;

  // Active selection: default to last (max) level
  const activeLevel = selectedLevel ?? maxLevel;
  const entry = levels.find(e => e.level === activeLevel) ?? levels[levels.length - 1];

  return (
    <div className="bg-gray-900 rounded-lg p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-cyan-400">Upgrade Bonuses</span>
        <span className="text-xs text-gray-500 font-mono">+{activeLevel}</span>
      </div>

      {/* Level slider */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-600 w-4 text-right">{minLevel}</span>
        <input
          type="range"
          min={minLevel}
          max={maxLevel}
          step={1}
          value={activeLevel}
          onChange={e => setSelectedLevel(Number(e.target.value))}
          className="flex-1 accent-cyan-500 h-1.5"
        />
        <span className="text-xs text-gray-600 w-5">{maxLevel}</span>
      </div>

      {/* Level selector buttons for quick access */}
      <div className="flex flex-wrap gap-1">
        {levels.map(e => (
          <button
            key={e.level}
            onClick={() => setSelectedLevel(e.level)}
            className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
              e.level === activeLevel
                ? 'bg-cyan-700 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            +{e.level}
          </button>
        ))}
      </div>

      {/* Stats at selected level */}
      <div className="flex flex-col gap-1 mt-1">
        {Object.entries(entry.stats).map(([stat, { value, unit }]) => (
          <div key={stat} className="flex justify-between text-xs">
            <span className="text-gray-400">{stat}</span>
            <span className="text-cyan-400 font-medium">+{value}{unit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
