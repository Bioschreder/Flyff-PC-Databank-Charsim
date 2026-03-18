import { useState, useMemo } from 'react';
import { Sword, Shield, Zap, TrendingUp, Users, Gift, ChevronDown } from 'lucide-react';
import {
  calcMonsterDmgToChar,
  calcAttackIntervalMs,
  calcKillTimeMs,
  calcFlyffExp,
  calcExpLevelModifier,
  calcAmpliMultiplier,
  calcTotalDropRateMultiplier,
  AMPLI_TIERS,
  LINK_ATTACK_BONUS,
  type ExpModifiers,
} from '../formulas';
import type { ComputedStats } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface MonsterEntry {
  id: string;
  name: string;
  level: number;
  hp: number;
  atkMin: number;
  atkMax: number;
  def: number;
  exp: number;
  rank: string;
  element: string;
  skillAtkMin: number;
  skillAtkMax: number;
  skillMult: number;
}

export interface PartyState {
  size: number;
  linkAttack: boolean;
  fortuneCircle: boolean;
  cheer: boolean;
  lordCheer: boolean;
  advancedPartyContrib: boolean;
}

export const DEFAULT_PARTY: PartyState = {
  size: 1,
  linkAttack: false,
  fortuneCircle: false,
  cheer: false,
  lordCheer: false,
  advancedPartyContrib: false,
};

interface Props {
  monster: MonsterEntry | null;
  computed: ComputedStats;
  charLevel: number;
  charDef: number;
  charAtkMin: number;
  charAtkMax: number;
  weaponType: string;
  expTable: Map<number, number>;
  party: PartyState;
  onPartyChange: (p: PartyState) => void;
  isMasterJob: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  if (!isFinite(n) || n === 0) return n === 0 ? '0' : '∞';
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return Math.round(n).toLocaleString();
}

function fmtTime(ms: number): string {
  if (!isFinite(ms) || ms <= 0) return '∞';
  const s = ms / 1000;
  if (s < 60) return s.toFixed(1) + 's';
  if (s < 3600) { const m = Math.floor(s / 60); const r = Math.round(s % 60); return `${m}m ${r}s`; }
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); return `${h}h ${m}m`;
}

function fmtMult(n: number): string {
  return `×${n.toFixed(2)}`;
}

function SectionHeader({ icon: Icon, title, color = 'text-blue-400' }: {
  icon: React.ElementType; title: string; color?: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-2.5">
      <Icon size={13} className={color} />
      <span className={`text-xs font-semibold uppercase tracking-wider ${color}`}>{title}</span>
    </div>
  );
}

function Row({ label, value, color = 'text-gray-200', sub, highlight }: {
  label: string; value: string | number; color?: string; sub?: string; highlight?: boolean;
}) {
  return (
    <div className={`flex items-baseline justify-between gap-2 ${highlight ? 'bg-gray-800/50 rounded px-1.5 py-0.5 -mx-1.5' : ''}`}>
      <span className="text-xs text-gray-400 shrink-0">{label}</span>
      <span className={`text-xs font-medium text-right ${color}`}>
        {value}{sub && <span className="text-gray-500 font-normal ml-1">{sub}</span>}
      </span>
    </div>
  );
}

function ToggleRow({ label, checked, onChange, disabled, sub }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; sub?: string;
}) {
  return (
    <label className={`flex items-center gap-2 cursor-pointer select-none ${disabled ? 'opacity-40' : ''}`}>
      <div
        onClick={() => !disabled && onChange(!checked)}
        className={`w-8 h-4 rounded-full transition-colors relative flex-shrink-0 ${
          checked && !disabled ? 'bg-blue-600' : 'bg-gray-700'
        }`}
      >
        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${
          checked && !disabled ? 'translate-x-4' : 'translate-x-0.5'
        }`} />
      </div>
      <span className="text-xs text-gray-300 flex-1">{label}</span>
      {sub && <span className="text-xs text-gray-500 shrink-0">{sub}</span>}
    </label>
  );
}

function Select({ value, onChange, children, className = '' }: {
  value: string | number; onChange: (v: string) => void; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full appearance-none bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
      >
        {children}
      </select>
      <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export function CombatStatsPanel({
  monster, computed, charLevel, charDef, charAtkMin, charAtkMax,
  weaponType, expTable, party, onPartyChange, isMasterJob,
}: Props) {

  // ── EXP modifier state (all live in this component) ──────────────────────────
  const [expEventMult, setExpEventMult]       = useState(1);
  const [lordEventPct, setLordEventPct]       = useState(0);
  const [ampliTierId, setAmpliTierId]         = useState('none');
  const [ampliStacks, setAmpliStacks]         = useState(1);
  const [bubblePointPct, setBubblePointPct]   = useState(0);
  const [votersBuff, setVotersBuff]           = useState(false);
  const [masterMalus, setMasterMalus]         = useState(isMasterJob);

  const linkMultiplier = (party.size > 1 && party.linkAttack) ? (1 + LINK_ATTACK_BONUS) : 1;
  const effAtkMin = charAtkMin * linkMultiplier;
  const effAtkMax = charAtkMax * linkMultiplier;

  const attackIntervalMs = calcAttackIntervalMs(weaponType, computed.dex);

  // ── Damage to monster ────────────────────────────────────────────────────────
  const dmgToMonster = useMemo(() => {
    if (!monster) return null;
    const lvlMod = 1 + (charLevel - monster.level) * 0.01;
    const effDef = Math.max(0, monster.def * Math.max(0.1, 1 / Math.max(0.01, lvlMod)));
    const dmin = Math.max(1, (effAtkMin - effDef) * lvlMod);
    const dmax = Math.max(1, (effAtkMax - effDef) * lvlMod);
    const avg  = (dmin + dmax) / 2;
    const cr   = Math.min(computed.critRate / 100, 1);
    const crit = avg * 2 * (1 + computed.critDmg / 100);
    const expected = avg * (1 - cr) + crit * cr;
    return { dmin, dmax, avg, crit, expected };
  }, [monster, charLevel, effAtkMin, effAtkMax, computed.critRate, computed.critDmg]);

  const dps = dmgToMonster ? dmgToMonster.expected / (attackIntervalMs / 1000) : 0;
  const killTimeMs = monster && dps > 0 ? calcKillTimeMs(monster.hp, dps) : Infinity;

  // ── Incoming damage ──────────────────────────────────────────────────────────
  const incomingDmg = useMemo(() => {
    if (!monster) return null;
    return calcMonsterDmgToChar(monster.atkMin, monster.atkMax, charDef, monster.level, charLevel);
  }, [monster, charDef, charLevel]);

  const incomingSkillDmg = useMemo(() => {
    if (!monster || !monster.skillAtkMin || !monster.skillAtkMax) return null;
    return calcMonsterDmgToChar(monster.skillAtkMin, monster.skillAtkMax, charDef, monster.level, charLevel);
  }, [monster, charDef, charLevel]);

  // ── EXP ──────────────────────────────────────────────────────────────────────
  const selectedAmpli = AMPLI_TIERS.find(t => t.id === ampliTierId) ?? AMPLI_TIERS[0];

  const expMods: ExpModifiers = {
    expEventMult,
    lordEventPct,
    ampliTierId,
    ampliStacks,
    expStatPct: computed.expBonus,
    cheerActive: party.cheer && party.size > 1,
    lordCheerActive: party.lordCheer,
    masterMalus,
    advancedPartyContrib: party.advancedPartyContrib && party.size > 1,
    votersBuff,
    bubblePointPct,
  };

  const expResult = monster
    ? calcFlyffExp(monster.exp, charLevel, monster.level, expMods)
    : null;

  const expNeeded      = expTable.get(charLevel) ?? 0;
  const killsForLvlUp  = expResult && expResult.expPerKill > 0 && expNeeded > 0
    ? Math.ceil(expNeeded / expResult.expPerKill) : Infinity;
  const timeForLvlUpMs = isFinite(killsForLvlUp) && isFinite(killTimeMs)
    ? killsForLvlUp * killTimeMs : Infinity;

  const levelMod = monster ? calcExpLevelModifier(charLevel, monster.level) : 1;

  // ── Drop ─────────────────────────────────────────────────────────────────────
  const dropMult    = calcTotalDropRateMultiplier(computed.dropRateBonus, party.fortuneCircle && party.size > 1);
  const dropBonusPct = Math.round((dropMult - 1) * 100);

  return (
    <div className="flex flex-col gap-3">

      {/* ── OUTGOING DAMAGE ─────────────────────────────────────────────────── */}
      {monster && dmgToMonster && (
        <div className="bg-gray-900/60 border border-gray-700/40 rounded-lg p-3">
          <SectionHeader icon={Sword} title="Dein Schaden" color="text-green-400" />
          <div className="flex flex-col gap-1">
            <Row label="Normal Ø"       value={fmt(dmgToMonster.avg)}      color="text-green-300" />
            <Row label="Normal Min–Max" value={`${fmt(dmgToMonster.dmin)} – ${fmt(dmgToMonster.dmax)}`} />
            <Row label="Kritisch Ø"    value={fmt(dmgToMonster.crit)}     color="text-yellow-300" />
            <Row label="Erwartet Ø"    value={fmt(dmgToMonster.expected)} color="text-blue-300" highlight />
            {party.size > 1 && party.linkAttack && (
              <div className="text-xs text-orange-400 flex items-center gap-1 mt-0.5">
                <Zap size={11} /> Link Attack +30% aktiv
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── DPS & KILL TIME ─────────────────────────────────────────────────── */}
      {monster && (
        <div className="bg-gray-900/60 border border-gray-700/40 rounded-lg p-3">
          <SectionHeader icon={Zap} title="DPS & Kill-Zeit" color="text-blue-400" />
          <div className="flex flex-col gap-1">
            <Row label="Angriffs-Intervall" value={`${attackIntervalMs}ms`} sub={`${(1000/attackIntervalMs).toFixed(2)}/s`} />
            <Row label="DPS"               value={fmt(dps)}             color="text-blue-300" highlight />
            <Row label="Kill-Zeit"         value={fmtTime(killTimeMs)}  color="text-purple-300" highlight />
          </div>
        </div>
      )}

      {/* ── INCOMING DAMAGE ─────────────────────────────────────────────────── */}
      {monster && incomingDmg && (
        <div className="bg-gray-900/60 border border-gray-700/40 rounded-lg p-3">
          <SectionHeader icon={Shield} title="Monster-Schaden an dir" color="text-red-400" />
          <div className="flex flex-col gap-1">
            <Row label="Dein DEF" value={fmt(charDef)} />
            <div className="mt-1 mb-0.5">
              <span className="text-xs text-gray-500 font-medium">Normaler Angriff</span>
            </div>
            <Row label="Monster ATK" value={`${fmt(monster.atkMin)} – ${fmt(monster.atkMax)}`} />
            <Row label="Schaden"     value={`${fmt(incomingDmg.min)} – ${fmt(incomingDmg.max)}`} color="text-red-300" highlight />
            <Row label="Ø Schaden"   value={fmt(incomingDmg.avg)}  color="text-orange-300" />
            <Row label="Überlebt"    value={incomingDmg.avg > 0 ? `~${fmt(Math.floor(computed.hp / incomingDmg.avg))} Treffer` : '∞'} color="text-green-400" />
            {incomingSkillDmg && monster.skillMult > 1.0 && (
              <>
                <div className="mt-1.5 mb-0.5">
                  <span className="text-xs text-gray-500 font-medium">
                    Skill-Angriff (×{monster.skillMult.toFixed(1)} est.)
                  </span>
                </div>
                <Row label="Skill ATK"   value={`${fmt(monster.skillAtkMin)} – ${fmt(monster.skillAtkMax)}`} />
                <Row label="Skill-Schaden" value={`${fmt(incomingSkillDmg.min)} – ${fmt(incomingSkillDmg.max)}`} color="text-red-400" highlight />
                <Row label="Ø Skill-Schn." value={fmt(incomingSkillDmg.avg)} color="text-orange-400" />
                <Row label="Überlebt (Skill)" value={incomingSkillDmg.avg > 0 ? `~${fmt(Math.floor(computed.hp / incomingSkillDmg.avg))} Treffer` : '∞'} color="text-yellow-400" />
              </>
            )}
          </div>
        </div>
      )}

      {/* ── EXP BERECHNUNG ──────────────────────────────────────────────────── */}
      <div className="bg-gray-900/60 border border-gray-700/40 rounded-lg p-3">
        <SectionHeader icon={TrendingUp} title="EXP Berechnung" color="text-yellow-400" />

        {/* Server EXP Event */}
        <div className="mb-3 grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">EXP Event</label>
            <Select value={expEventMult} onChange={v => setExpEventMult(Number(v))}>
              {[1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 7, 10].map(v => (
                <option key={v} value={v}>×{v}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Lord EXP Event</label>
            <Select value={lordEventPct} onChange={v => setLordEventPct(Number(v))}>
              {[0, 25, 50, 75, 100].map(v => (
                <option key={v} value={v}>{v === 0 ? 'Kein' : `+${v}%`}</option>
              ))}
            </Select>
          </div>
        </div>

        {/* Ampli */}
        <div className="mb-3">
          <label className="text-xs text-gray-500 mb-1 block">Scroll of Amplification</label>
          <div className="flex gap-2">
            <Select value={ampliTierId} onChange={v => { setAmpliTierId(v); setAmpliStacks(1); }} className="flex-1">
              {AMPLI_TIERS.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </Select>
            {selectedAmpli.id !== 'none' && selectedAmpli.maxStack > 1 && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setAmpliStacks(s => Math.max(1, s - 1))}
                  className="w-6 h-7 bg-gray-800 border border-gray-700 rounded text-gray-400 hover:text-white flex items-center justify-center text-sm"
                >−</button>
                <span className="text-xs text-gray-200 w-4 text-center">{ampliStacks}</span>
                <button
                  onClick={() => setAmpliStacks(s => Math.min(selectedAmpli.maxStack, s + 1))}
                  className="w-6 h-7 bg-gray-800 border border-gray-700 rounded text-gray-400 hover:text-white flex items-center justify-center text-sm"
                >+</button>
              </div>
            )}
          </div>
          {selectedAmpli.id !== 'none' && (
            <div className="text-xs text-yellow-500 mt-1">
              {ampliStacks}× +{selectedAmpli.bonusPct}% = +{ampliStacks * selectedAmpli.bonusPct}% total
              → {fmtMult(calcAmpliMultiplier(ampliTierId, ampliStacks))}
            </div>
          )}
        </div>

        {/* Bubble Point (Rested) */}
        <div className="mb-3 flex items-center gap-2">
          <label className="text-xs text-gray-500 w-32 shrink-0">Rested EXP (Bubble)</label>
          <Select value={bubblePointPct} onChange={v => setBubblePointPct(Number(v))} className="flex-1">
            {[0, 50, 100, 150, 200].map(v => (
              <option key={v} value={v}>{v === 0 ? 'Kein' : `+${v}%`}</option>
            ))}
          </Select>
        </div>

        {/* Toggle buffs */}
        <div className="flex flex-col gap-1.5 mb-3 border-t border-gray-700 pt-2.5">
          <div className="text-xs text-gray-500 mb-1 uppercase tracking-wider">Buffs</div>
          <ToggleRow
            label="Voter's Buff"
            sub="+50%"
            checked={votersBuff}
            onChange={setVotersBuff}
          />
          <ToggleRow
            label="Master EXP Malus"
            sub="×0.5"
            checked={masterMalus}
            onChange={setMasterMalus}
          />
          {isMasterJob && !masterMalus && (
            <div className="text-xs text-orange-400 pl-10">⚠ Malus für Master/Hero aktiv</div>
          )}
        </div>

        {/* Results */}
        {monster ? (
          <div className="border-t border-gray-700 pt-2">
            <div className="text-xs text-gray-500 mb-1.5 uppercase tracking-wider">Multiplikatoren</div>
            <div className="flex flex-col gap-0.5">
              <Row label="Basis EXP"         value={fmt(monster.exp)} />
              <Row label="Level-Mod"         value={fmtMult(levelMod)}
                color={levelMod < 1 ? 'text-red-400' : levelMod > 1 ? 'text-green-400' : 'text-gray-300'} />
              {bubblePointPct > 0 && <Row label="Rested EXP"       value={`+${bubblePointPct}%`} color="text-cyan-400" sub="(nur auf Basis)" />}
              {expEventMult > 1 && <Row label="EXP Event"          value={fmtMult(expEventMult)}         color="text-yellow-300" />}
              {lordEventPct > 0 && <Row label="Lord EXP Event"     value={`+${lordEventPct}%`}           color="text-yellow-300" />}
              {selectedAmpli.id !== 'none' && <Row label="Ampli"   value={fmtMult(calcAmpliMultiplier(ampliTierId, ampliStacks))} color="text-orange-300" />}
              {computed.expBonus > 0 && <Row label="EXP Stat"      value={`+${computed.expBonus}%`}      color="text-green-400" />}
              {party.cheer && party.size > 1 && <Row label="Cheer" value="+5%"                           color="text-blue-300" />}
              {party.lordCheer && <Row label="Lord's Cheer"        value="+10%"                          color="text-blue-300" />}
              {party.advancedPartyContrib && party.size > 1 && <Row label="Adv. Party Contrib." value="×2.5" color="text-purple-400" />}
              {votersBuff && <Row label="Voter's Buff"             value="+50%"                          color="text-cyan-300" />}
              {masterMalus && <Row label="Master Malus"            value="×0.5"                         color="text-red-400" />}

              <div className="border-t border-gray-700 mt-1 pt-1 flex flex-col gap-1">
                <Row label="Gesamt ×"         value={fmtMult(expResult?.totalMult ?? 1)} color="text-white" highlight />
                <Row label="EXP / Kill"       value={fmt(expResult?.expPerKill ?? 0)}   color="text-yellow-300" highlight />
                <Row label="Kills für Lv Up"  value={fmt(killsForLvlUp)}               color="text-orange-300" />
                {isFinite(timeForLvlUpMs) && (
                  <Row label="Zeit für Lv Up" value={fmtTime(timeForLvlUpMs)}          color="text-purple-300" />
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-gray-500 italic border-t border-gray-700 pt-2">Kein Monster ausgewählt</div>
        )}
      </div>

      {/* ── PARTY ────────────────────────────────────────────────────────────── */}
      <div className="bg-gray-900/60 border border-gray-700/40 rounded-lg p-3">
        <SectionHeader icon={Users} title="Party" color="text-blue-400" />

        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-400">Mitglieder</span>
            <span className="text-xs font-bold text-gray-200">{party.size}/8</span>
          </div>
          <input type="range" min={1} max={8} step={1}
            value={party.size}
            onChange={e => onPartyChange({ ...party, size: Number(e.target.value) })}
            className="w-full accent-blue-500"
          />
          <div className="flex justify-between text-[10px] text-gray-600 mt-0.5">
            {[1,2,3,4,5,6,7,8].map(n => <span key={n}>{n}</span>)}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Party Skills</div>
          <ToggleRow label="Link Attack"    sub="+30% ATK"  checked={party.linkAttack}         onChange={v => onPartyChange({...party, linkAttack: v})}         disabled={party.size < 2} />
          <ToggleRow label="Fortune Circle" sub="+50% Drop" checked={party.fortuneCircle}      onChange={v => onPartyChange({...party, fortuneCircle: v})}      disabled={party.size < 2} />
          <ToggleRow label="Cheer"          sub="+5% EXP"   checked={party.cheer}              onChange={v => onPartyChange({...party, cheer: v})}              disabled={party.size < 2} />
          <div className="text-xs text-gray-500 uppercase tracking-wider mt-1 mb-0.5">Lordship</div>
          <ToggleRow label="Lord's Cheer"   sub="+10% EXP"  checked={party.lordCheer}          onChange={v => onPartyChange({...party, lordCheer: v})}          />
          <ToggleRow label="Adv. Party Contribution" sub="×2.5 EXP" checked={party.advancedPartyContrib} onChange={v => onPartyChange({...party, advancedPartyContrib: v})} disabled={party.size < 2} />
        </div>

        {party.size > 1 && (
          <div className="mt-2 pt-2 border-t border-gray-700 flex flex-col gap-0.5">
            {party.linkAttack    && <Row label="Link Attack"    value="+30% ATK"  color="text-orange-300" />}
            {party.fortuneCircle && <Row label="Fortune Circle" value="+50% Drop" color="text-yellow-300" />}
            {party.cheer         && <Row label="Cheer"          value="+5% EXP"   color="text-blue-300"  />}
          </div>
        )}
      </div>

      {/* ── DROP RATE ────────────────────────────────────────────────────────── */}
      <div className="bg-gray-900/60 border border-gray-700/40 rounded-lg p-3">
        <SectionHeader icon={Gift} title="Drop Rate" color="text-yellow-400" />
        <div className="flex flex-col gap-1">
          {computed.dropRateBonus > 0 && (
            <Row label="Ausrüstung/Buffs"     value={`+${computed.dropRateBonus}%`} color="text-green-400" />
          )}
          {party.fortuneCircle && party.size > 1 && (
            <Row label="Fortune Circle"       value="+50%"                          color="text-yellow-400" />
          )}
          {dropBonusPct === 0 ? (
            <Row label="Gesamt" value="×1.00 (kein Bonus)" color="text-gray-500" />
          ) : (
            <Row label="Gesamt Multiplikator" value={`×${dropMult.toFixed(2)}`}    color="text-yellow-300" sub={`(+${dropBonusPct}%)`} highlight />
          )}
        </div>
      </div>
    </div>
  );
}
