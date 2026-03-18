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

function fmtCompact(n: number): string {
  if (!isFinite(n) || n <= 0) return '0';
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return Math.round(n).toString();
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
  const [topN] = useState(10);

  const selectedAmpli = AMPLI_TIERS.find(t => t.id === ampliTierId) ?? AMPLI_TIERS[0];
  const attackIntervalMs = calcAttackIntervalMs(weaponType, dex);

  const rows = useMemo((): MonsterRow[] => {
    const expMods: ExpModifiers = {
      expEventMult, lordEventPct, ampliTierId, ampliStacks,
      expStatPct: expBonus,
      cheerActive, lordCheerActive: lordCheer,
      masterMalus, advancedPartyContrib: false,
      votersBuff, bubblePointPct: 0,
      isMasterHero: isMasterJob,
    };

    return monsters
      .filter(m => m.exp > 0 && m.hp > 0 && isFinite(m.hp))
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
        const killTimeS = dps > 0 ? m.hp / dps : Infinity;
        const levelPenalty = calcExpLevelModifier(charLevel, m.level, isMasterJob);
        const expResult = calcFlyffExp(m.exp, charLevel, m.level, expMods);
        const expPerHour = isFinite(killTimeS) && killTimeS > 0
          ? expResult.expPerKill * 3600 / killTimeS : 0;

        return { monster: m, killTimeS, expPerKill: expResult.expPerKill, expPerHour, levelPenalty, dps };
      })
      .filter(r => r.expPerHour > 0 && isFinite(r.expPerHour))
      .sort((a, b) => b.expPerHour - a.expPerHour)
      .slice(0, topN);
  }, [
    monsters, charAtkMin, charAtkMax, charLevel, critRate, critDmg,
    attackIntervalMs, expEventMult, lordEventPct, ampliTierId, ampliStacks,
    expBonus, cheerActive, lordCheer, masterMalus, votersBuff, topN,
  ]);

  const expNeeded = expTable.get(charLevel) ?? 0;

  const toggles = [
    { label: "Voter's Buff", sub: '+50%', checked: votersBuff, set: setVotersBuff },
    { label: 'Cheer', sub: '+5%', checked: cheerActive, set: setCheerActive },
    { label: "Lord's Cheer", sub: '+10%', checked: lordCheer, set: setLordCheer },
    { label: 'Master Malus', sub: '×0.5', checked: masterMalus, set: setMasterMalus },
  ];

  return (
    <div className="flex flex-col gap-3">

      {/* ── EXP Modifier Controls ── */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-3">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">EXP Modifikatoren</div>
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

      {/* ── Top 3 Level-Up cards ── */}
      {rows.length > 0 && expNeeded > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {rows.slice(0, 3).map((row, i) => {
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
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Top {topN} Monster nach EXP/h</span>
          <span className="text-xs text-gray-600">Char Lv. {charLevel} · {fmtCompact(expNeeded)} EXP für Lv-Up</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="text-[10px] text-gray-500 uppercase tracking-wider bg-gray-900/40 border-b border-gray-700/50">
                <th className="text-left px-3 py-2 font-medium">#</th>
                <th className="text-left px-2 py-2 font-medium">Monster</th>
                <th className="text-right px-2 py-2 font-medium">Lv.</th>
                <th className="text-right px-2 py-2 font-medium">Penalty</th>
                <th className="text-right px-2 py-2 font-medium">Kill-Zeit</th>
                <th className="text-right px-2 py-2 font-medium">DPS</th>
                <th className="text-right px-2 py-2 font-medium">EXP/Kill</th>
                <th className="text-right px-3 py-2 font-medium">EXP/h</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/30">
              {rows.map((row, i) => (
                <tr key={row.monster.id}
                  className={`hover:bg-gray-700/30 transition-colors ${i === 0 ? 'bg-yellow-900/10' : ''}`}>
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
                    <span className="text-xs text-purple-300 font-mono">{fmtCompact(row.expPerKill)}</span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className={`text-xs font-mono font-semibold ${
                      i === 0 ? 'text-yellow-300' : 'text-green-300'
                    }`}>{fmtCompact(row.expPerHour)}</span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-500 text-sm">
                    Keine Daten verfügbar.
                    <div className="text-xs text-gray-600 mt-1">Waffe ausrüsten und Stats konfigurieren.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-3 py-2 border-t border-gray-700/50 text-[10px] text-gray-600">
          * Berechnung ohne Laufzeit zwischen Monstern. Level-Penalty nach Flyff-Formel berücksichtigt.
        </div>
      </div>
    </div>
  );
}
