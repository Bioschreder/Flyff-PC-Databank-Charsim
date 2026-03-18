import { useState, useMemo } from 'react';
import {
  calcAttackIntervalMs,
  calcFlyffExp,
  calcExpLevelModifier,
  calcAmpliMultiplier,
  AMPLI_TIERS,
  type ExpModifiers,
} from '../formulas';
import type { MonsterEntry } from './CombatStatsPanel';

interface Props {
  charAtkMin: number;
  charAtkMax: number;
  charLevel: number;
  critRate: number;
  critDmg: number;
  weaponType: string;
  dex: number;
  expTable: Map<number, number>;
  monsters: MonsterEntry[];
  isMasterJob: boolean;
  expBonus: number;
}

interface MonsterRow {
  monster: MonsterEntry;
  killTimeS: number;
  expPerKill: number;
  expPerHour: number;
  levelPenalty: number;
  dps: number;
}

type SortKey = 'rank' | 'name' | 'level' | 'penalty' | 'killTime' | 'dps' | 'expPerKill' | 'expPerHour';
type SortDir = 'asc' | 'desc';
type KillMode = '1on1' | 'aoe';

const MIN_KILL_TIME_S = 1.0;

function fmtCompact(n: number): string {
  if (!isFinite(n) || n <= 0) return '0';
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return Math.round(n).toString();
}

function fmtPct(val: number, total: number): string {
  if (!total || !isFinite(val) || val <= 0) return '';
  const p = (val / total) * 100;
  if (p >= 100) return '≥100%';
  if (p >= 1) return p.toFixed(1) + '%';
  return p.toFixed(2) + '%';
}

function fmtTime(ms: number): string {
  if (!isFinite(ms) || ms <= 0) return '∞';
  const s = ms / 1000;
  if (s < 60) return s.toFixed(1) + 's';
  const m = Math.floor(s / 60); const r = Math.round(s % 60);
  if (s < 3600) return `${m}m ${r}s`;
  const h = Math.floor(s / 3600); const min = Math.floor((s % 3600) / 60);
  return `${h}h ${min}m`;
}

function SortIcon({ col, sortKey, dir }: { col: SortKey; sortKey: SortKey; dir: SortDir }) {
  if (col !== sortKey) return <span className="opacity-20 ml-0.5">↕</span>;
  return <span className="ml-0.5 text-blue-400">{dir === 'desc' ? '↓' : '↑'}</span>;
}

export function ExpComparisonTable({
  charAtkMin, charAtkMax, charLevel, critRate, critDmg,
  weaponType, dex, expTable, monsters, isMasterJob, expBonus,
}: Props) {
  const [expEventMult, setExpEventMult] = useState(1);
  const [lordEventPct, setLordEventPct] = useState(0);
  const [ampliTierId, setAmpliTierId] = useState('none');
  const [ampliStacks, setAmpliStacks] = useState(1);
  const [votersBuff, setVotersBuff] = useState(false);
  const [masterMalus, setMasterMalus] = useState(isMasterJob);
  const [cheerActive, setCheerActive] = useState(false);
  const [lordCheer, setLordCheer] = useState(false);
  const [topN] = useState(20);
  const [showAll, setShowAll] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('expPerHour');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Kill-Mode: 1on1 or AoE
  const [killMode, setKillMode] = useState<KillMode>('1on1');
  const [aoeMobCount, setAoeMobCount] = useState(5);
  const [aoeCycleMin, setAoeCycleMin] = useState(1);

  // Monster exclusion set (by monster id)
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [showExcludePanel, setShowExcludePanel] = useState(false);
  const [excludeSearch, setExcludeSearch] = useState('');

  const selectedAmpli = AMPLI_TIERS.find(t => t.id === ampliTierId) ?? AMPLI_TIERS[0];
  const attackIntervalMs = calcAttackIntervalMs(weaponType, dex);

  // Effective kill time in seconds considering mode and min kill time
  function getEffectiveKillTimeS(rawKillTimeS: number): number {
    const clamped = Math.max(MIN_KILL_TIME_S, rawKillTimeS);
    if (killMode === 'aoe') {
      // In AoE mode: aoeMobCount mobs per aoeCycleMin minutes
      const cycleS = aoeCycleMin * 60;
      return cycleS / aoeMobCount;
    }
    return clamped;
  }

  const baseRows = useMemo((): MonsterRow[] => {
    const expMods: ExpModifiers = {
      expEventMult, lordEventPct, ampliTierId, ampliStacks,
      expStatPct: expBonus,
      cheerActive, lordCheerActive: lordCheer,
      masterMalus, advancedPartyContrib: false,
      votersBuff, bubblePointPct: 0,
      isMasterHero: isMasterJob,
    };

    return monsters
      .filter(m => m.exp > 0 && m.hp > 0 && isFinite(m.hp) && !excludedIds.has(m.id))
      .map(m => {
        const lvlMod = 1 + (charLevel - m.level) * 0.01;
        const effDef = m.def * Math.max(0.1, 1 / Math.max(0.01, lvlMod));
        const dmin = Math.max(1, (charAtkMin - effDef) * lvlMod);
        const dmax = Math.max(1, (charAtkMax - effDef) * lvlMod);
        const avg = (dmin + dmax) / 2;
        const cr = Math.min(critRate / 100, 1);
        const crit = avg * 2 * (1 + critDmg / 100);
        const expected = avg * (1 - cr) + crit * cr;
        const dps = expected / (attackIntervalMs / 1000);
        const rawKillTimeS = dps > 0 ? m.hp / dps : Infinity;
        const killTimeS = getEffectiveKillTimeS(rawKillTimeS);
        const levelPenalty = calcExpLevelModifier(charLevel, m.level, isMasterJob);
        const expResult = calcFlyffExp(m.exp, charLevel, m.level, expMods);
        const expPerHour = isFinite(killTimeS) && killTimeS > 0
          ? expResult.expPerKill * 3600 / killTimeS : 0;
        return { monster: m, killTimeS, expPerKill: expResult.expPerKill, expPerHour, levelPenalty, dps };
      })
      .filter(r => r.expPerHour > 0 && isFinite(r.expPerHour))
      .sort((a, b) => b.expPerHour - a.expPerHour);
  }, [
    monsters, charAtkMin, charAtkMax, charLevel, critRate, critDmg,
    attackIntervalMs, expEventMult, lordEventPct, ampliTierId, ampliStacks,
    expBonus, cheerActive, lordCheer, masterMalus, votersBuff, isMasterJob,
    excludedIds, killMode, aoeMobCount, aoeCycleMin,
  ]);

  const rows = useMemo(() => {
    const sorted = [...baseRows].sort((a, b) => {
      let va = 0, vb = 0;
      switch (sortKey) {
        case 'name':      return sortDir === 'asc'
          ? a.monster.name.localeCompare(b.monster.name)
          : b.monster.name.localeCompare(a.monster.name);
        case 'level':     va = a.monster.level;  vb = b.monster.level; break;
        case 'penalty':   va = a.levelPenalty;   vb = b.levelPenalty; break;
        case 'killTime':  va = a.killTimeS;       vb = b.killTimeS; break;
        case 'dps':       va = a.dps;             vb = b.dps; break;
        case 'expPerKill':va = a.expPerKill;      vb = b.expPerKill; break;
        case 'expPerHour':va = a.expPerHour;      vb = b.expPerHour; break;
        default:          va = a.expPerHour;      vb = b.expPerHour;
      }
      return sortDir === 'asc' ? va - vb : vb - va;
    });
    return showAll ? sorted : sorted.slice(0, topN);
  }, [baseRows, sortKey, sortDir, showAll, topN]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  function toggleExclude(id: string) {
    setExcludedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const expNeeded = expTable.get(charLevel) ?? 0;

  const toggles = [
    { label: "Voter's Buff", sub: '+50%', checked: votersBuff, set: setVotersBuff },
    { label: 'Cheer', sub: '+5%', checked: cheerActive, set: setCheerActive },
    { label: "Lord's Cheer", sub: '+10%', checked: lordCheer, set: setLordCheer },
    { label: 'Master Malus', sub: '×0.5', checked: masterMalus, set: setMasterMalus },
  ];

  const top3 = baseRows.slice(0, 3);

  // Candidates for exclusion panel: monsters that have exp and are valid
  const excludeCandidates = useMemo(() => {
    return monsters
      .filter(m => m.exp > 0 && m.hp > 0 && isFinite(m.hp))
      .filter(m => !excludeSearch || m.name.toLowerCase().includes(excludeSearch.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [monsters, excludeSearch]);

  return (
    <div className="flex flex-col gap-3">

      {/* ── Kill Mode & EXP Modifier Controls ── */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-3">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Modus & EXP Modifikatoren</div>

        {/* Kill Mode */}
        <div className="flex gap-2 mb-3 items-center flex-wrap">
          <span className="text-xs text-gray-500">Kill-Modus:</span>
          <button
            onClick={() => setKillMode('1on1')}
            className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
              killMode === '1on1' ? 'bg-blue-700 border-blue-600 text-white' : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'
            }`}>
            1on1
          </button>
          <button
            onClick={() => setKillMode('aoe')}
            className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
              killMode === 'aoe' ? 'bg-purple-700 border-purple-600 text-white' : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'
            }`}>
            AoE
          </button>
          {killMode === 'aoe' && (
            <div className="flex items-center gap-2 flex-wrap ml-2">
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">Monster/Zyklus:</span>
                <button onClick={() => setAoeMobCount(c => Math.max(1, c - 1))}
                  className="w-6 h-6 bg-gray-700 border border-gray-600 rounded text-gray-300 hover:text-white text-sm flex items-center justify-center">−</button>
                <span className="text-xs text-gray-200 w-5 text-center font-mono">{aoeMobCount}</span>
                <button onClick={() => setAoeMobCount(c => Math.min(50, c + 1))}
                  className="w-6 h-6 bg-gray-700 border border-gray-600 rounded text-gray-300 hover:text-white text-sm flex items-center justify-center">+</button>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">Minuten/Zyklus:</span>
                <button onClick={() => setAoeCycleMin(c => Math.max(0.5, +(c - 0.5).toFixed(1)))}
                  className="w-6 h-6 bg-gray-700 border border-gray-600 rounded text-gray-300 hover:text-white text-sm flex items-center justify-center">−</button>
                <span className="text-xs text-gray-200 w-6 text-center font-mono">{aoeCycleMin}</span>
                <button onClick={() => setAoeCycleMin(c => Math.min(60, +(c + 0.5).toFixed(1)))}
                  className="w-6 h-6 bg-gray-700 border border-gray-600 rounded text-gray-300 hover:text-white text-sm flex items-center justify-center">+</button>
              </div>
              <span className="text-[10px] text-purple-400">
                → {(aoeMobCount / aoeCycleMin).toFixed(1)} Mobs/min
              </span>
            </div>
          )}
          {killMode === '1on1' && (
            <span className="text-[10px] text-gray-600 ml-2">Min. Kill-Zeit: {MIN_KILL_TIME_S}s</span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">EXP Event</label>
            <select value={expEventMult} onChange={e => setExpEventMult(Number(e.target.value))}
              className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none">
              {[1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 7, 10].map(v => (
                <option key={v} value={v}>×{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Lord Event</label>
            <select value={lordEventPct} onChange={e => setLordEventPct(Number(e.target.value))}
              className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none">
              {[0, 25, 50, 75, 100].map(v => (
                <option key={v} value={v}>{v === 0 ? 'Kein' : `+${v}%`}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Ampli Scroll</label>
            <div className="flex gap-1">
              <select value={ampliTierId} onChange={e => { setAmpliTierId(e.target.value); setAmpliStacks(1); }}
                className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none">
                {AMPLI_TIERS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              {selectedAmpli.id !== 'none' && selectedAmpli.maxStack > 1 && (
                <div className="flex items-center gap-0.5 shrink-0">
                  <button onClick={() => setAmpliStacks(s => Math.max(1, s - 1))}
                    className="w-6 h-7 bg-gray-800 border border-gray-700 rounded text-gray-400 hover:text-white text-sm flex items-center justify-center">−</button>
                  <span className="text-xs text-gray-200 w-3 text-center">{ampliStacks}</span>
                  <button onClick={() => setAmpliStacks(s => Math.min(selectedAmpli.maxStack, s + 1))}
                    className="w-6 h-7 bg-gray-800 border border-gray-700 rounded text-gray-400 hover:text-white text-sm flex items-center justify-center">+</button>
                </div>
              )}
            </div>
            {selectedAmpli.id !== 'none' && (
              <div className="text-[10px] text-yellow-500 mt-0.5">
                {fmtCompact(calcAmpliMultiplier(ampliTierId, ampliStacks) * 100 - 100)}% Bonus
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {toggles.map(({ label, sub, checked, set }) => (
            <button key={label} onClick={() => set(!checked)}
              className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                checked
                  ? 'bg-blue-700 border-blue-600 text-white'
                  : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'
              }`}>
              {label} <span className="opacity-60">{sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Monster Exclusion Panel ── */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowExcludePanel(p => !p)}
          className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-700/30 transition-colors">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Monster ausschließen
            {excludedIds.size > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-red-800 text-red-200 rounded text-[10px]">
                {excludedIds.size} ausgeschlossen
              </span>
            )}
          </span>
          <span className="text-gray-600 text-xs">{showExcludePanel ? '▲' : '▼'}</span>
        </button>
        {showExcludePanel && (
          <div className="border-t border-gray-700 p-3">
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="Monster suchen..."
                value={excludeSearch}
                onChange={e => setExcludeSearch(e.target.value)}
                className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500"
              />
              {excludedIds.size > 0 && (
                <button
                  onClick={() => setExcludedIds(new Set())}
                  className="px-2.5 py-1.5 bg-red-900/50 border border-red-800 rounded text-xs text-red-300 hover:bg-red-900 transition-colors">
                  Alle zurücksetzen
                </button>
              )}
            </div>
            <div className="max-h-48 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-1">
              {excludeCandidates.slice(0, 150).map(m => {
                const excluded = excludedIds.has(m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => toggleExclude(m.id)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded text-left text-xs transition-colors ${
                      excluded
                        ? 'bg-red-900/40 border border-red-800/50 text-red-300 line-through opacity-60'
                        : 'bg-gray-900 border border-gray-700 text-gray-300 hover:border-gray-500'
                    }`}>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${excluded ? 'bg-red-500' : 'bg-gray-600'}`} />
                    <span className="truncate">{m.name}</span>
                    <span className="text-gray-600 shrink-0">Lv.{m.level}</span>
                  </button>
                );
              })}
              {excludeCandidates.length === 0 && (
                <div className="col-span-3 text-center text-gray-600 text-xs py-3">Keine Monster gefunden.</div>
              )}
              {excludeCandidates.length > 150 && (
                <div className="col-span-3 text-center text-gray-600 text-[10px] py-1">
                  {excludeCandidates.length - 150} weitere – Suche verfeinern
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Top 3 Level-Up cards ── */}
      {top3.length > 0 && expNeeded > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {top3.map((row, i) => {
            const killsForLvl = row.expPerKill > 0 ? Math.ceil(expNeeded / row.expPerKill) : 0;
            const timeForLvl = killsForLvl * row.killTimeS;
            return (
              <div key={row.monster.id}
                className={`bg-gray-800 border rounded-xl p-3 ${i === 0 ? 'border-yellow-700/50' : 'border-gray-700'}`}>
                <div className={`text-[10px] font-bold mb-1 ${i === 0 ? 'text-yellow-400' : 'text-gray-500'}`}>
                  #{i + 1} {i === 0 ? '🏆' : i === 1 ? '🥈' : '🥉'}
                </div>
                <div className="text-xs text-gray-200 truncate mb-1.5">{row.monster.name}</div>
                <div className="space-y-0.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">EXP/h</span>
                    <span className={`font-mono font-semibold ${i === 0 ? 'text-yellow-300' : 'text-green-300'}`}>
                      {fmtCompact(row.expPerHour)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Kills für Lv-Up</span>
                    <span className="font-mono text-gray-300">{fmtCompact(killsForLvl)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Zeit für Lv-Up</span>
                    <span className="font-mono text-gray-300">{fmtTime(timeForLvl * 1000)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Comparison Table ── */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {showAll ? `Alle ${baseRows.length}` : `Top ${topN}`} Monster
              {killMode === 'aoe' && <span className="ml-2 text-purple-400">[AoE: {aoeMobCount} Mobs/{aoeCycleMin}min]</span>}
            </span>
            {baseRows.length > topN && (
              <button
                onClick={() => setShowAll(s => !s)}
                className="text-[10px] px-2 py-0.5 rounded border border-gray-600 text-gray-500 hover:text-gray-300 hover:border-gray-500 transition-colors">
                {showAll ? `Nur Top ${topN}` : `Alle ${baseRows.length} anzeigen`}
              </button>
            )}
          </div>
          <span className="text-xs text-gray-600">
            Char Lv. {charLevel}{expNeeded > 0 ? ` · ${fmtCompact(expNeeded)} EXP für Lv-Up` : ''}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="text-[10px] text-gray-500 uppercase tracking-wider bg-gray-900/40 border-b border-gray-700/50 select-none">
                <th className="text-left px-3 py-2 font-medium w-6">#</th>
                <th className="text-left px-2 py-2 font-medium cursor-pointer hover:text-gray-300 transition-colors"
                  onClick={() => handleSort('name')}>
                  Monster <SortIcon col="name" sortKey={sortKey} dir={sortDir} />
                </th>
                <th className="text-right px-2 py-2 font-medium cursor-pointer hover:text-gray-300 transition-colors"
                  onClick={() => handleSort('level')}>
                  Lv. <SortIcon col="level" sortKey={sortKey} dir={sortDir} />
                </th>
                <th className="text-right px-2 py-2 font-medium cursor-pointer hover:text-gray-300 transition-colors"
                  onClick={() => handleSort('penalty')}>
                  Penalty <SortIcon col="penalty" sortKey={sortKey} dir={sortDir} />
                </th>
                <th className="text-right px-2 py-2 font-medium cursor-pointer hover:text-gray-300 transition-colors"
                  onClick={() => handleSort('killTime')}>
                  Kill-Zeit <SortIcon col="killTime" sortKey={sortKey} dir={sortDir} />
                </th>
                <th className="text-right px-2 py-2 font-medium cursor-pointer hover:text-gray-300 transition-colors"
                  onClick={() => handleSort('dps')}>
                  DPS <SortIcon col="dps" sortKey={sortKey} dir={sortDir} />
                </th>
                <th className="text-right px-2 py-2 font-medium cursor-pointer hover:text-gray-300 transition-colors"
                  onClick={() => handleSort('expPerKill')}>
                  EXP/Kill <SortIcon col="expPerKill" sortKey={sortKey} dir={sortDir} />
                </th>
                <th className="text-right px-3 py-2 font-medium cursor-pointer hover:text-gray-300 transition-colors"
                  onClick={() => handleSort('expPerHour')}>
                  EXP/h <SortIcon col="expPerHour" sortKey={sortKey} dir={sortDir} />
                </th>
                <th className="px-2 py-2 font-medium w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/30">
              {rows.map((row, i) => {
                const pctPerKill = fmtPct(row.expPerKill, expNeeded);
                const pctPerHour = fmtPct(row.expPerHour, expNeeded);
                const isTop = sortKey === 'expPerHour' && i === 0;
                return (
                  <tr key={row.monster.id}
                    className={`hover:bg-gray-700/30 transition-colors ${isTop ? 'bg-yellow-900/10' : ''}`}>
                    <td className="px-3 py-2">
                      <span className={`text-xs font-bold ${
                        i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-amber-700' : 'text-gray-600'
                      }`}>{i + 1}</span>
                    </td>
                    <td className="px-2 py-2 max-w-[160px]">
                      <div className="text-xs text-gray-200 truncate">{row.monster.name}</div>
                      <div className="text-[10px] text-gray-600">{row.monster.rank}</div>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <span className="text-xs text-gray-400 font-mono">{row.monster.level}</span>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <span className={`text-xs font-mono font-semibold ${
                        row.levelPenalty >= 1 ? 'text-green-400' :
                        row.levelPenalty >= 0.8 ? 'text-yellow-400' :
                        row.levelPenalty >= 0.5 ? 'text-orange-400' : 'text-red-400'
                      }`}>{(row.levelPenalty * 100).toFixed(0)}%</span>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <span className="text-xs text-gray-300 font-mono">
                        {row.killTimeS < 1
                          ? `${(row.killTimeS * 1000).toFixed(0)}ms`
                          : row.killTimeS < 60
                            ? `${row.killTimeS.toFixed(1)}s`
                            : `${(row.killTimeS / 60).toFixed(1)}m`}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <span className="text-xs text-blue-300 font-mono">{fmtCompact(row.dps)}</span>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <div className="text-xs text-purple-300 font-mono">{fmtCompact(row.expPerKill)}</div>
                      {pctPerKill && (
                        <div className="text-[10px] text-purple-500 font-mono">{pctPerKill} Lv-Up</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className={`text-xs font-mono font-semibold ${
                        isTop ? 'text-yellow-300' : 'text-green-300'
                      }`}>{fmtCompact(row.expPerHour)}</div>
                      {pctPerHour && (
                        <div className={`text-[10px] font-mono ${isTop ? 'text-yellow-600' : 'text-green-700'}`}>
                          {pctPerHour}/h
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button
                        onClick={() => toggleExclude(row.monster.id)}
                        title="Monster ausschließen"
                        className="text-gray-700 hover:text-red-400 transition-colors text-sm leading-none">
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-gray-500 text-sm">
                    Keine Daten verfügbar.
                    <div className="text-xs text-gray-600 mt-1">Waffe ausrüsten und Stats konfigurieren.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-3 py-2 border-t border-gray-700/50 text-[10px] text-gray-600">
          * {killMode === '1on1' ? `1on1-Modus, min. Kill-Zeit ${MIN_KILL_TIME_S}s.` : `AoE-Modus: ${aoeMobCount} Mobs pro ${aoeCycleMin} Min.`} Level-Penalty nach Flyff-Formel. Spaltenheader klicken zum Sortieren. ✕ zum Ausschließen.
        </div>
      </div>
    </div>
  );
}
