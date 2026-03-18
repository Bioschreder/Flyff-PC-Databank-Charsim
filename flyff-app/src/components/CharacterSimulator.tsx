import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSimulatorData } from '../hooks/useSimulatorData';
import { useItemDatabase } from '../hooks/useItemDatabase';
import { useStatCalculator } from '../hooks/useStatCalculator';
import type { CharStats, JobData, SkillData, MonsterStats } from '../formulas';
import {
  calcCharATK, calcDEF, calcSkillDMG, getWeaponFactor,
  calcSkillDmgVsMonster,
} from '../formulas';
import type {
  SimulatorState, EquipSlot, EquippedItem, FlyffItem, Monster,
  ActiveSetBonus, SetBonusTier, ComputedStats,
} from '../types';
import { EquipmentPanel } from './EquipmentPanel';
import { ItemConfigPanel } from './ItemConfigPanel';
import { PowerupPanel } from './PowerupPanel';
import { CombatStatsPanel, DEFAULT_PARTY, type PartyState } from './CombatStatsPanel';
import { ConfigManager } from './ConfigManager';
import { ExpComparisonTable } from './ExpComparisonTable';
import type { AuthState } from '../hooks/useAuth';

// ─── helpers ─────────────────────────────────────────────────────────────────

const fmt  = (n: number) => Math.round(n).toLocaleString('de-DE');
const fmtK = (n: number) => n >= 1_000_000_000
  ? `${(n / 1_000_000_000).toFixed(2)}Mrd`
  : n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(2)}Mio`
    : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n);

const BLADE_JOBS_SIM = new Set([
  'JOB_BLADE', 'JOB_BLADE_MASTER', 'JOB_BLADE_HERO', 'JOB_STORMBLADE_HERO',
]);

function getWeaponTypeFromItem(item: FlyffItem | undefined): string {
  if (!item) return 'Sword';
  const t  = (item.type ?? '').toUpperCase();
  const sc = (item.subcategory ?? '').toLowerCase();
  if (t.includes('SWD') || sc.includes('sword'))   return 'Sword';
  if (t.includes('AXE') || sc.includes('axe'))     return 'Axe';
  if (t.includes('STAFF') || sc.includes('staff')) return 'Staff';
  if (t.includes('WAND') || sc.includes('wand'))   return 'Wand';
  if (t.includes('STICK') || sc.includes('stick')) return 'Stick';
  if (t.includes('KNUCKLE') || sc.includes('knuckle')) return 'Knuckle';
  if (t.includes('YO') || sc.includes('yoyo'))     return 'Yoyo';
  return 'Sword';
}

// ─── stat helpers ─────────────────────────────────────────────────────────────

function StatInput({
  label, value, onChange, min = 1, max = 500, hint,
}: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; hint?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-400 text-sm w-10 text-right">{label}</span>
      <input
        type="number" min={min} max={max} value={value}
        onChange={e => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
        className="w-20 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-white text-center focus:border-blue-500 focus:outline-none"
      />
      <div className="flex-1 flex flex-col gap-0.5">
        <input
          type="range" min={min} max={max} value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="w-full accent-blue-500"
        />
        {hint && <span className="text-[10px] text-gray-600 leading-none">{hint}</span>}
      </div>
    </div>
  );
}

function StatRow({ label, value, color = 'text-white' }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className={`text-sm font-semibold ${color}`}>{value}</span>
    </div>
  );
}

// ─── job layout config ────────────────────────────────────────────────────────

// Display-name overrides (DB names differ from user-facing names)
const JOB_DISPLAY: Record<string, string> = {
  JOB_VAGRANT:             'Vagrant',
  JOB_MERCENARY:           'Mercenary',
  JOB_ACROBAT:             'Acrobat',
  JOB_ASSIST:              'Assist',
  JOB_MAGICIAN:            'Magician',
  // Tier 2
  JOB_KNIGHT:              'Knight',
  JOB_BLADE:               'Blade',
  JOB_JESTER:              'Jester',
  JOB_RANGER:              'Ranger',
  JOB_RINGMASTER:          'Ringmaster',
  JOB_BILLPOSTER:          'Billposter',
  JOB_PSYCHIKEEPER:        'Psykeeper',
  JOB_ELEMENTOR:           'Elementor',
  // Master (same class names as tier 2, suffix added in chip)
  JOB_KNIGHT_MASTER:       'Knight',
  JOB_BLADE_MASTER:        'Blade',
  JOB_JESTER_MASTER:       'Jester',
  JOB_RANGER_MASTER:       'Ranger',
  JOB_RINGMASTER_MASTER:   'Ringmaster',
  JOB_BILLPOSTER_MASTER:   'Billposter',
  JOB_PSYCHIKEEPER_MASTER: 'Psykeeper',
  JOB_ELEMENTOR_MASTER:    'Elementor',
  // Hero 121-130 (same class names, suffix in chip)
  JOB_KNIGHT_HERO:         'Knight',
  JOB_BLADE_HERO:          'Blade',
  JOB_JESTER_HERO:         'Jester',
  JOB_RANGER_HERO:         'Ranger',
  JOB_RINGMASTER_HERO:     'Ringmaster',
  JOB_BILLPOSTER_HERO:     'Billposter',
  JOB_PSYCHIKEEPER_HERO:   'Psykeeper',
  JOB_ELEMENTOR_HERO:      'Elementor',
  // Hero 130-190 (evolved names)
  JOB_LORDTEMPLER_HERO:    'Templar',
  JOB_STORMBLADE_HERO:     'Slayer',
  JOB_WINDLURKER_HERO:     'Harlequin',
  JOB_CRACKSHOOTER_HERO:   'Crackshooter',
  JOB_FLORIST_HERO:        'Seraph',
  JOB_FORCEMASTER_HERO:    'Force Master',
  JOB_MENTALIST_HERO:      'Mentalist',
  JOB_ELEMENTORLORD_HERO:  'Arcanist',
};

// 4 class families → defines column order
const FAMILIES = [
  { label: 'Krieger',  color: 'text-red-400',    ids2: ['JOB_KNIGHT',      'JOB_BLADE'],       m: ['JOB_KNIGHT_MASTER',       'JOB_BLADE_MASTER'],       h1: ['JOB_KNIGHT_HERO',      'JOB_BLADE_HERO'],      h4: ['JOB_LORDTEMPLER_HERO',   'JOB_STORMBLADE_HERO']   },
  { label: 'Akrobat',  color: 'text-green-400',   ids2: ['JOB_JESTER',      'JOB_RANGER'],      m: ['JOB_JESTER_MASTER',       'JOB_RANGER_MASTER'],      h1: ['JOB_JESTER_HERO',      'JOB_RANGER_HERO'],     h4: ['JOB_WINDLURKER_HERO',    'JOB_CRACKSHOOTER_HERO'] },
  { label: 'Assist',   color: 'text-blue-400',    ids2: ['JOB_RINGMASTER',  'JOB_BILLPOSTER'],  m: ['JOB_RINGMASTER_MASTER',   'JOB_BILLPOSTER_MASTER'], h1: ['JOB_RINGMASTER_HERO',  'JOB_BILLPOSTER_HERO'], h4: ['JOB_FLORIST_HERO',       'JOB_FORCEMASTER_HERO']  },
  { label: 'Magier',   color: 'text-purple-400',  ids2: ['JOB_PSYCHIKEEPER','JOB_ELEMENTOR'],   m: ['JOB_PSYCHIKEEPER_MASTER', 'JOB_ELEMENTOR_MASTER'],  h1: ['JOB_PSYCHIKEEPER_HERO','JOB_ELEMENTOR_HERO'],  h4: ['JOB_MENTALIST_HERO',     'JOB_ELEMENTORLORD_HERO']},
];

// ─── JobSelector component ────────────────────────────────────────────────────

function JobSelector({ jobs, selected, onSelect }: {
  jobs: JobData[]; selected: string; onSelect: (id: string) => void;
}) {
  const jobMap = useMemo(() => new Map(jobs.map(j => [j.id, j])), [jobs]);

  const ancestors = useMemo(() => {
    const set = new Set<string>();
    let cur = jobMap.get(selected);
    while (cur) {
      set.add(cur.id);
      if (!cur.parent) break;
      cur = jobMap.get(cur.parent);
    }
    return set;
  }, [selected, jobMap]);

  function chip(id: string, badge?: string, heroGold?: boolean) {
    if (!jobMap.has(id)) return null;
    const isSelected = selected === id;
    const isAnc      = !isSelected && ancestors.has(id);
    const label      = JOB_DISPLAY[id] ?? id;
    return (
      <button
        key={id}
        onClick={() => onSelect(id)}
        className={`
          flex-1 min-w-0 px-1.5 py-1 rounded border text-[10px] font-semibold text-center transition-all leading-tight
          ${isSelected
            ? heroGold
              ? 'bg-yellow-700/40 border-yellow-500 text-yellow-200'
              : 'bg-blue-700/40 border-blue-500 text-blue-200'
            : isAnc
              ? 'bg-gray-700/60 border-gray-500 text-gray-300'
              : 'bg-gray-800/60 border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300'
          }
        `}
      >
        {label}
        {badge && <span className="block text-[9px] opacity-60 leading-none mt-0.5">{badge}</span>}
      </button>
    );
  }

  return (
    <div className="space-y-2 text-xs">

      {/* Vagrant */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-600 w-20 shrink-0">Lv. 1–15</span>
        {chip('JOB_VAGRANT')}
      </div>

      {/* Tier 1 */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-600 w-20 shrink-0">Lv. 15–60</span>
        <div className="flex gap-1 flex-1">
          {chip('JOB_MERCENARY')}
          {chip('JOB_ACROBAT')}
          {chip('JOB_ASSIST')}
          {chip('JOB_MAGICIAN')}
        </div>
      </div>

      {/* Tier 2 */}
      <div className="flex items-start gap-2">
        <span className="text-[10px] text-gray-600 w-20 shrink-0 pt-1">Lv. 60–120</span>
        <div className="flex-1 grid grid-cols-4 gap-1">
          {FAMILIES.map(f => (
            <div key={f.label} className="flex flex-col gap-0.5">
              <span className={`text-[9px] font-bold uppercase tracking-wide text-center ${f.color}`}>{f.label}</span>
              {f.ids2.map(id => chip(id))}
            </div>
          ))}
        </div>
      </div>

      {/* Master */}
      <div className="flex items-start gap-2">
        <span className="text-[10px] text-gray-600 w-20 shrink-0 pt-1">Master<br/>60M–120M</span>
        <div className="flex-1 grid grid-cols-4 gap-1">
          {FAMILIES.map(f => (
            <div key={f.label} className="flex flex-col gap-0.5">
              {f.m.map(id => chip(id, 'M'))}
            </div>
          ))}
        </div>
      </div>

      {/* Hero 121-130 */}
      <div className="flex items-start gap-2">
        <span className="text-[10px] text-gray-600 w-20 shrink-0 pt-1">Hero<br/>121–130</span>
        <div className="flex-1 grid grid-cols-4 gap-1">
          {FAMILIES.map(f => (
            <div key={f.label} className="flex flex-col gap-0.5">
              {f.h1.map(id => chip(id, 'H', true))}
            </div>
          ))}
        </div>
      </div>

      {/* Hero 130-190 */}
      <div className="flex items-start gap-2">
        <span className="text-[10px] text-gray-600 w-20 shrink-0 pt-1">Hero<br/>130–190</span>
        <div className="flex-1 grid grid-cols-4 gap-1">
          {FAMILIES.map(f => (
            <div key={f.label} className="flex flex-col gap-0.5">
              {f.h4.map(id => chip(id, undefined, true))}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}


// ─── skill card ──────────────────────────────────────────────────────────────

function SkillCard({
  skill, selectedLevel, onLevelChange, charAtkMin, charAtkMax, critRate, critDmg,
  monster, charLevel, monsterDmgPct,
}: {
  skill: SkillData;
  selectedLevel: number;
  onLevelChange: (lvl: number) => void;
  charAtkMin: number;
  charAtkMax: number;
  critRate: number;
  critDmg: number;
  monster?: MonsterStats | null;
  charLevel?: number;
  monsterDmgPct?: number;
}) {
  const lvl = skill.levels.find(l => l.level === selectedLevel) ?? skill.levels[0];
  if (!lvl) return null;

  const hasAtk = lvl.atkMin > 0 || lvl.atkMax > 0;
  const mdmgMult = 1 + (monsterDmgPct ?? 0) / 100;

  const dmgMin = hasAtk
    ? (monster && charLevel != null
        ? { ...calcSkillDmgVsMonster(charAtkMin, lvl, critRate, critDmg, monster, charLevel),
            normal: calcSkillDmgVsMonster(charAtkMin, lvl, critRate, critDmg, monster, charLevel).normal * mdmgMult,
            crit:   calcSkillDmgVsMonster(charAtkMin, lvl, critRate, critDmg, monster, charLevel).crit   * mdmgMult,
            expected: calcSkillDmgVsMonster(charAtkMin, lvl, critRate, critDmg, monster, charLevel).expected * mdmgMult }
        : calcSkillDMG(charAtkMin, lvl, critRate, critDmg))
    : null;
  const dmgMax = hasAtk
    ? (monster && charLevel != null
        ? { ...calcSkillDmgVsMonster(charAtkMax, lvl, critRate, critDmg, monster, charLevel),
            normal: calcSkillDmgVsMonster(charAtkMax, lvl, critRate, critDmg, monster, charLevel).normal * mdmgMult,
            crit:   calcSkillDmgVsMonster(charAtkMax, lvl, critRate, critDmg, monster, charLevel).crit   * mdmgMult,
            expected: calcSkillDmgVsMonster(charAtkMax, lvl, critRate, critDmg, monster, charLevel).expected * mdmgMult }
        : calcSkillDMG(charAtkMax, lvl, critRate, critDmg))
    : null;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-white">{skill.name}</span>
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">Lv.</span>
          <select
            value={selectedLevel}
            onChange={e => onLevelChange(Number(e.target.value))}
            className="bg-gray-900 border border-gray-700 rounded px-1 py-0.5 text-xs text-white focus:outline-none"
          >
            {skill.levels.map(l => (
              <option key={l.level} value={l.level}>{l.level}</option>
            ))}
          </select>
          <span className="text-xs text-gray-600">/ {skill.maxLevel}</span>
        </div>
      </div>

      {hasAtk && dmgMin && dmgMax && (
        <div className="grid grid-cols-2 gap-x-3 text-xs">
          <div className="text-gray-400">Normal</div>
          <div className="text-green-400 font-mono">
            {fmt(dmgMin.normal)} – {fmt(dmgMax.normal)}
          </div>
          <div className="text-gray-400">Kritisch</div>
          <div className="text-yellow-400 font-mono">
            {fmt(dmgMin.crit)} – {fmt(dmgMax.crit)}
          </div>
          <div className="text-gray-400">Erwartet</div>
          <div className="text-blue-400 font-mono">
            {fmt(dmgMin.expected)} – {fmt(dmgMax.expected)}
          </div>
        </div>
      )}

      {lvl.effects.length > 0 && (
        <div className="text-xs space-y-0.5 border-t border-gray-700 pt-1.5">
          {lvl.effects.map((e, i) => (
            <div key={i} className="flex justify-between">
              <span className="text-gray-400">{e.stat}</span>
              <span className="text-purple-400">
                +{e.value}{e.unit}
                {e.valuePerLevel ? ` (+${e.valuePerLevel}${e.unit}/Lv)` : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3 text-xs text-gray-500">
        {lvl.needMP > 0   && <span>MP -{lvl.needMP}</span>}
        {lvl.needFP > 0   && <span>FP -{lvl.needFP}</span>}
        {lvl.cooldown > 0 && <span>CD {lvl.cooldown}s</span>}
        {lvl.range > 0    && <span>Range {lvl.range}</span>}
      </div>
    </div>
  );
}

// ─── initial state ────────────────────────────────────────────────────────────

const DEFAULT_SIM_STATE: SimulatorState = {
  jobId: 'JOB_BLADE',
  gender: 'M',
  level: 120,
  baseStr: 100,
  baseSta: 60,
  baseDex: 60,
  baseInt: 30,
  equipment: {},
  activeBuffIds: [],
};

// ─── ActiveBonusPanel ─────────────────────────────────────────────────────────

const STAT_DISPLAY: Record<string, [string, string]> = {
  DST_STR:                  ['STR',               ''],
  DST_DEX:                  ['DEX',               ''],
  DST_INT:                  ['INT',               ''],
  DST_STA:                  ['STA',               ''],
  DST_HP_MAX:               ['HP',                ''],
  DST_MP_MAX:               ['MP',                ''],
  DST_FP_MAX:               ['FP',                ''],
  DST_ATKPOWER:             ['ATK',               ''],
  DST_ATKPOWER_RATE:        ['ATK',               '%'],
  DST_ADJDEF:               ['DEF',               ''],
  DST_ADJDEF_RATE:          ['DEF',               '%'],
  DST_CRITICAL_BONUS:       ['Krit. Schaden',     '%'],
  DST_CRITICAL:             ['Krit. Rate',        '%'],
  DST_SPEED:                ['Geschwindigkeit',   '%'],
  DST_ATTACKSPEED:          ['Angriffsgeschw.',   ''],
  DST_HPDRAIN_RATE:         ['Suck Blood',        '%'],
  DST_MPDRAIN_RATE:         ['Suck Mana',         '%'],
  DST_EXPERIENCE:           ['EXP Bonus',         '%'],
  DST_BLOCK_MELEE:          ['Melee Block',       '%'],
  DST_BLOCK_RANGE:          ['Range Block',       '%'],
  DST_BLOCK_MAGIC:          ['Magic Block',       '%'],
  DST_ADD_MAGIC:            ['Magic ATK',         ''],
  DST_MONSTER_DMG:          ['Monster DMG',       '%'],
  DST_PVP_DMG:              ['PvP DMG',           '%'],
  DST_DROP_ITEM_ALLGRADE_RATE: ['Drop Rate',      '%'],
  DST_GOLD_RATE:            ['Gold Bonus',        '%'],
};

function dstLabel(k: string): [string, string] {
  return STAT_DISPLAY[k] ?? [k.replace('DST_', '').replace(/_/g, ' '), ''];
}

interface ActiveBonusPanelProps {
  equipment: Partial<Record<EquipSlot, EquippedItem>>;
  itemMap: Map<string, FlyffItem>;
  activeSetBonuses: ActiveSetBonus[];
  activePowerups: ComputedStats['activePowerups'];
  armorSetUpgradeLevel: number;
  totalEvolutionValue: number;
  hitRate: number;
  blockRate: number;
  pvpDmgPct: number;
  atkSpeedPct: number;
}

function ActiveBonusPanel({
  equipment, itemMap, activeSetBonuses, activePowerups,
  armorSetUpgradeLevel, totalEvolutionValue, hitRate, blockRate, pvpDmgPct, atkSpeedPct,
}: ActiveBonusPanelProps) {
  const [open, setOpen] = useState(true);

  // Aggregate all item stat bonuses
  const itemBonuses = useMemo(() => {
    const agg: Record<string, number> = {};
    for (const [, eq] of Object.entries(equipment)) {
      if (!eq) continue;
      const item = itemMap.get(eq.itemId);
      if (!item) continue;
      for (const [k, v] of Object.entries(item.stats)) {
        if (v !== 0) agg[k] = (agg[k] ?? 0) + v;
      }
      // Awakening
      for (const a of eq.awakenSlots) {
        if (a.stat && a.value !== 0) agg[a.stat] = (agg[a.stat] ?? 0) + a.value;
      }
    }
    return Object.entries(agg)
      .filter(([, v]) => v !== 0)
      .sort(([a], [b]) => a.localeCompare(b));
  }, [equipment, itemMap]);

  // Gather set bonus entries
  const setBonusEntries = useMemo(() => {
    const entries: Array<{ setName: string; pieces: number; effects: SetBonusTier['effects'] }> = [];
    for (const sb of activeSetBonuses) {
      for (const tier of sb.activeTiers) {
        entries.push({ setName: sb.name, pieces: tier.pieces, effects: tier.effects });
      }
    }
    return entries;
  }, [activeSetBonuses]);

  // Evolution set bonus tier label
  const evoTier = totalEvolutionValue >= 25 ? 4
    : totalEvolutionValue >= 20 ? 3
    : totalEvolutionValue >= 15 ? 2
    : totalEvolutionValue >= 10 ? 1
    : 0;
  const EVO_TIER_BONUSES = [
    null,
    { label: '≥10', hit: 25, hp: 15, allStat: 10, atk: 0 },
    { label: '≥15', hit: 35, hp: 20, allStat: 10, atk: 0 },
    { label: '≥20', hit: 45, hp: 25, allStat: 15, atk: 5 },
    { label: '≥25', hit: 60, hp: 40, allStat: 20, atk: 15 },
  ];

  const hasContent = itemBonuses.length > 0 || setBonusEntries.length > 0 || activePowerups.length > 0
    || armorSetUpgradeLevel >= 3 || totalEvolutionValue > 0 || hitRate > 0 || blockRate > 0;
  if (!hasContent) return null;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-750 transition-colors"
      >
        <span className="text-xs font-semibold text-gray-300">Aktive Ausrüstungs-Bonuse</span>
        <span className="text-gray-500 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3">

          {/* Armor Set Upgrade Bonus */}
          {armorSetUpgradeLevel >= 3 && (
            <div>
              <div className="text-[10px] text-yellow-500 uppercase tracking-wider mb-1">
                Rüstungsset Upgrade-Bonus (alle +{armorSetUpgradeLevel})
              </div>
              <div className="bg-yellow-900/15 border border-yellow-700/30 rounded px-2 py-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5">
                {[
                  ['Hit', `+${[0,0,0,5,10,10,20,20,30,30,45][Math.min(armorSetUpgradeLevel,10)]}%`],
                  ['Block', `+${[0,0,0,3,3,3,6,6,10,10,15][Math.min(armorSetUpgradeLevel,10)]}%`],
                  ['HP', `+${[0,0,0,0,0,5,5,5,10,10,20][Math.min(armorSetUpgradeLevel,10)]}%`],
                  ['AddMagic', `+${Math.min(armorSetUpgradeLevel,10)}`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-gray-400">{k}</span>
                    <span className="text-yellow-300 font-mono">{v}</span>
                  </div>
                ))}
                {armorSetUpgradeLevel >= 5 && (
                  <div className="col-span-2 flex justify-between text-xs">
                    <span className="text-gray-400">AllStat</span>
                    <span className="text-yellow-300 font-mono">+{[0,0,0,0,0,1,1,1,2,2,2][Math.min(armorSetUpgradeLevel,10)]}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Baruna Evolution Set Bonus */}
          {totalEvolutionValue > 0 && (
            <div>
              <div className="text-[10px] text-purple-400 uppercase tracking-wider mb-1">
                Baruna Evolution (Gesamt: +{totalEvolutionValue})
              </div>
              {evoTier > 0 && EVO_TIER_BONUSES[evoTier] && (
                <div className="bg-purple-900/15 border border-purple-700/30 rounded px-2 py-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5">
                  {[
                    ['Hit', `+${EVO_TIER_BONUSES[evoTier]!.hit}%`],
                    ['Max HP', `+${EVO_TIER_BONUSES[evoTier]!.hp}%`],
                    ['AllStat', `+${EVO_TIER_BONUSES[evoTier]!.allStat}`],
                    ...(EVO_TIER_BONUSES[evoTier]!.atk > 0 ? [['ATK%', `+${EVO_TIER_BONUSES[evoTier]!.atk}%`]] : []),
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-xs">
                      <span className="text-gray-400">{k}</span>
                      <span className="text-purple-300 font-mono">{v}</span>
                    </div>
                  ))}
                </div>
              )}
              {evoTier === 0 && (
                <div className="text-[10px] text-gray-500 px-1">Set-Bonus ab Gesamt ≥10. Noch {10 - totalEvolutionValue} fehlen.</div>
              )}
            </div>
          )}

          {/* Combat stats summary (hit, block, pvp, speed) */}
          {(hitRate > 0 || blockRate > 0 || pvpDmgPct > 0 || atkSpeedPct > 0) && (
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Kampf-Boni (kumuliert)</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                {hitRate > 0   && <><span className="text-xs text-gray-400">Trefferrate</span><span className="text-xs text-green-400 font-mono text-right">+{hitRate}%</span></>}
                {blockRate > 0 && <><span className="text-xs text-gray-400">Blockrate</span><span className="text-xs text-blue-400 font-mono text-right">+{blockRate}%</span></>}
                {pvpDmgPct > 0 && <><span className="text-xs text-gray-400">PvP-Schaden</span><span className="text-xs text-red-400 font-mono text-right">+{pvpDmgPct}%</span></>}
                {atkSpeedPct > 0 && <><span className="text-xs text-gray-400">Angriffsgeschw.</span><span className="text-xs text-yellow-400 font-mono text-right">+{atkSpeedPct}%</span></>}
              </div>
            </div>
          )}

          {/* Item + Awakening stats */}
          {itemBonuses.length > 0 && (
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Item-Stats &amp; Erweckung</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                {itemBonuses.map(([k, v]) => {
                  const [label, unit] = dstLabel(k);
                  return (
                    <div key={k} className="flex justify-between text-xs">
                      <span className="text-gray-400 truncate">{label}</span>
                      <span className="text-green-400 font-mono shrink-0 ml-1">
                        {v > 0 ? '+' : ''}{v}{unit}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Set bonuses */}
          {setBonusEntries.length > 0 && (
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Set-Effekte</div>
              <div className="space-y-1.5">
                {setBonusEntries.map((entry, i) => (
                  <div key={i} className="bg-green-900/20 border border-green-700/30 rounded px-2 py-1.5">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] text-green-400 font-semibold truncate">{entry.setName}</span>
                      <span className="text-[10px] text-yellow-500 shrink-0">{entry.pieces} Teile</span>
                    </div>
                    <div className="space-y-0.5">
                      {entry.effects.map((e, j) => (
                        <div key={j} className="flex justify-between text-xs">
                          <span className="text-gray-400 truncate">{e.stat.replace('DST_','').replace(/_/g,' ')}</span>
                          <span className="text-green-300 font-mono shrink-0 ml-1">+{e.value}{e.unit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active powerups */}
          {activePowerups.length > 0 && (
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Aktive Buffs</div>
              <div className="space-y-1">
                {activePowerups.map(buf => (
                  <div key={buf.id} className="bg-blue-900/20 border border-blue-700/30 rounded px-2 py-1">
                    <div className="text-[10px] text-blue-300 font-semibold mb-0.5">{buf.name}</div>
                    <div className="text-xs text-blue-200">
                      {buf.effects.map(e => `${e.stat} +${e.value}${e.unit}`).join(' · ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}



export function CharacterSimulator({
  auth,
  initialState,
}: {
  auth?: AuthState;
  initialState?: SimulatorState;
}) {
  const { jobs, skills, expTable, loading: simLoading } = useSimulatorData();
  const { data: itemDB, setEffects, upgrades, awakening, gems, jobPrefixes, weaponCards, loading: dbLoading } = useItemDatabase();

  const [simState, setSimState] = useState<SimulatorState>(initialState ?? DEFAULT_SIM_STATE);
  const [skillLevels, setSkillLevels] = useState<Record<string, number>>({});
  const [skillSearch, setSkillSearch] = useState('');
  const [activeSlot, setActiveSlot] = useState<EquipSlot | null>(null);
  const [activePowerupTab, setActivePowerupTab] = useState(false);
  const [showConfigManager, setShowConfigManager] = useState(false);
  const [rightTab, setRightTab] = useState<'equip' | 'stats' | 'skills' | 'combat' | 'exptable'>('equip');

  // Apply external initialState changes (e.g. shared config loaded from ShareView)
  useEffect(() => {
    if (initialState) setSimState(initialState);
  }, [initialState]);

  // Monster state
  const [monsters, setMonsters] = useState<Monster[]>([]);
  const [monsterSearch, setMonsterSearch] = useState('');
  const [selectedMonster, setSelectedMonster] = useState<Monster | null>(null);

  // Party + EXP state
  const [party, setParty] = useState<PartyState>(DEFAULT_PARTY);

  useEffect(() => {
    fetch('/data/monsters.json')
      .then(r => r.json())
      .then(d => setMonsters(d.monsters));
  }, []);

  const job = useMemo(
    () => jobs.find(j => j.id === simState.jobId),
    [jobs, simState.jobId]
  );

  // Master EXP malus applies from _MASTER / _HERO jobs (tier 3) up to 3rd class change
  const isMasterJob = useMemo(() => {
    const id = simState.jobId;
    return id.endsWith('_MASTER') || id.endsWith('_HERO');
  }, [simState.jobId]);

  const items = useMemo(() => itemDB?.items ?? [], [itemDB]);
  const itemMap = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);

  // Compute stats from equipment
  const computed = useStatCalculator({
    state: simState,
    items,
    job: job ?? null,
    setEffectsDB: setEffects ?? null,
    upgradeDB: upgrades ?? null,
    gemDB: gems ?? null,
    jobPrefixDB: jobPrefixes ?? null,
    weaponCardDB: weaponCards ?? null,
  });

  // Determine weapon type from equipped weapon
  const equippedWeapon = useMemo(() => {
    const eq = simState.equipment['weapon'];
    return eq ? itemMap.get(eq.itemId) : undefined;
  }, [simState.equipment, itemMap]);
  const weaponType = getWeaponTypeFromItem(equippedWeapon);

  // Build CharStats for formula calculations
  const charStatsMin: CharStats = {
    str: computed.str, sta: computed.sta, dex: computed.dex, int: computed.int,
    level: simState.level,
    weaponAtkMin: computed.atkMin, weaponAtkMax: computed.atkMin,
    weaponType,
    equipAtk: computed.equipAtk,
    equipAtkPct: computed.atkPct,
    equipCritRate: computed.critRate,
    equipCritDmg: computed.critDmg,
  };
  const charStatsMax: CharStats = { ...charStatsMin, weaponAtkMin: computed.atkMax, weaponAtkMax: computed.atkMax };

  const charAtkMin = useMemo(() => job ? calcCharATK(charStatsMin, job, true)  : computed.atkMin, [charStatsMin, job]);
  const charAtkMax = useMemo(() => job ? calcCharATK(charStatsMax, job, false) : computed.atkMax, [charStatsMax, job]);
  const def = useMemo(() => job ? calcDEF(charStatsMin, job, 0) + computed.defMin : computed.defMin, [charStatsMin, job, computed.defMin]);

  const critRate = job ? job.criticalFactor + computed.critRate : computed.critRate;
  const critDmg  = computed.critDmg;

  const jobSkills = useMemo(() => {
    if (!job) return [];
    return job.skills.map(id => skills.find(s => s.id === id)).filter(Boolean) as SkillData[];
  }, [job, skills]);

  const filteredSkills = useMemo(() =>
    jobSkills.filter(s => s.name.toLowerCase().includes(skillSearch.toLowerCase())),
    [jobSkills, skillSearch]
  );

  // Handlers
  const handleJobSelect = useCallback((id: string) => {
    setSimState(prev => ({ ...prev, jobId: id }));
  }, []);

  const handleBaseStat = useCallback((key: 'baseStr' | 'baseSta' | 'baseDex' | 'baseInt' | 'level') =>
    (v: number) => setSimState(prev => ({ ...prev, [key]: v })),
    []
  );

  const handleSlotSave = useCallback((slot: EquipSlot, equipped: EquippedItem | undefined) => {
    setSimState(prev => {
      const eq = { ...prev.equipment };
      if (equipped) eq[slot] = equipped;
      else delete eq[slot];
      return { ...prev, equipment: eq };
    });
  }, []);

  const handleReset = useCallback(() => {
    setSimState(prev => ({ ...prev, equipment: {}, activeBuffIds: [] }));
  }, []);

  const handleBuffToggle = useCallback((id: string) => {
    setSimState(prev => ({
      ...prev,
      activeBuffIds: prev.activeBuffIds.includes(id)
        ? prev.activeBuffIds.filter(b => b !== id)
        : [...prev.activeBuffIds, id],
    }));
  }, []);

  const activeSlotEquipped = activeSlot ? simState.equipment[activeSlot] : undefined;

  // Monster DMG calculations
  const monsterStats: MonsterStats | null = selectedMonster
    ? { def: selectedMonster.def, hp: selectedMonster.hp, exp: selectedMonster.exp,
        level: selectedMonster.level, resMagic: selectedMonster.resMagic }
    : null;

  const monsterDmgMult = 1 + computed.monsterDmgPct / 100;
  void monsterDmgMult; // passed to CombatStatsPanel via props

  const filteredMonsters = useMemo(() => {
    const q = monsterSearch.toLowerCase();
    if (!q) return monsters.slice(0, 80);
    return monsters.filter(m =>
      m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)
    ).slice(0, 80);
  }, [monsters, monsterSearch]);

  const loading = simLoading || dbLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Lade Simulator-Daten...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-3">

      {/* ── Header ── */}
      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-lg font-bold text-white">Charakter-Simulator</h2>
        <button
          onClick={() => setShowConfigManager(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 border border-gray-600 text-sm text-gray-200 font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          Konfigurationen
        </button>
      </div>

      {showConfigManager && (
        <ConfigManager
          currentState={simState}
          auth={auth}
          onLoad={state => setSimState(state)}
          onClose={() => setShowConfigManager(false)}
        />
      )}

      {/* ── 2-Panel Layout ── */}
      <div className="flex-1 flex gap-3 min-h-0">

        {/* ════ LEFT: Job + Base Stats (slim) ════ */}
        <div className="w-[220px] shrink-0 flex flex-col gap-3 overflow-y-auto pb-2">

          {/* Job */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-3">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Klasse</div>
            <JobSelector jobs={jobs} selected={simState.jobId} onSelect={handleJobSelect} />
          </div>

          {/* Base Stats */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 space-y-2.5">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Basis-Stats</div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400 w-10 shrink-0">Geschl.</span>
              <div className="flex rounded overflow-hidden border border-gray-600 flex-1">
                {(['M', 'F'] as const).map(g => (
                  <button
                    key={g}
                    onClick={() => setSimState(prev => ({ ...prev, gender: g }))}
                    className={`flex-1 py-1 text-xs font-medium transition-colors ${
                      simState.gender === g
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    }`}
                  >
                    {g === 'M' ? 'M' : 'W'}
                  </button>
                ))}
              </div>
            </div>
            <StatInput label="Lv."  value={simState.level}   onChange={handleBaseStat('level')}   min={1}  max={200}
              hint={expTable.get(simState.level) ? `EXP: ${fmtK(expTable.get(simState.level)!)}` : undefined} />
            <StatInput label="STR"  value={simState.baseStr} onChange={handleBaseStat('baseStr')} min={15} max={700} />
            <StatInput label="STA"  value={simState.baseSta} onChange={handleBaseStat('baseSta')} min={15} max={700} />
            <StatInput label="DEX"  value={simState.baseDex} onChange={handleBaseStat('baseDex')} min={15} max={700} />
            <StatInput label="INT"  value={simState.baseInt} onChange={handleBaseStat('baseInt')} min={15} max={700} />
          </div>
        </div>

        {/* ════ RIGHT: Tabbed panel ════ */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">

          {/* Tab Bar */}
          <div className="flex gap-1 mb-3 shrink-0 bg-gray-900 border border-gray-700 rounded-xl p-1">
            {([
              { id: 'equip',    label: 'Ausrüstung',   icon: '🛡️' },
              { id: 'stats',    label: 'Charakter',    icon: '📊' },
              { id: 'skills',   label: 'Skills',       icon: '⚡' },
              { id: 'combat',   label: 'Kampf',        icon: '⚔️' },
              { id: 'exptable', label: 'EXP/h',        icon: '📈' },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setRightTab(tab.id)}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm transition-colors flex-1 justify-center ${
                  rightTab === tab.id
                    ? 'bg-blue-700 text-white font-semibold'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                }`}
              >
                <span>{tab.icon}</span>
                <span className="hidden lg:inline text-xs">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto">

            {/* ── AUSRÜSTUNG TAB ── */}
            {rightTab === 'equip' && (
              <div className="flex flex-col gap-3">
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-3">
                  <EquipmentPanel
                    equipment={simState.equipment}
                    itemMap={itemMap}
                    activeSetBonuses={computed.activeSetBonuses}
                    setEffectsDB={setEffects ?? {}}
                    jobId={simState.jobId}
                    onSlotClick={setActiveSlot}
                    onReset={handleReset}
                  />
                </div>

                {/* Powerups */}
                <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setActivePowerupTab(v => !v)}
                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-750 transition-colors"
                  >
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Powerups / Buffs
                      {simState.activeBuffIds.length > 0 && (
                        <span className="ml-1.5 bg-blue-700 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                          {simState.activeBuffIds.length}
                        </span>
                      )}
                    </span>
                    <span className="text-gray-500 text-xs">{activePowerupTab ? '▲' : '▼'}</span>
                  </button>
                  {activePowerupTab && (
                    <div className="px-3 pb-3 max-h-64 overflow-y-auto border-t border-gray-700">
                      <PowerupPanel
                        items={items}
                        activeBuffIds={simState.activeBuffIds}
                        onToggle={handleBuffToggle}
                      />
                    </div>
                  )}
                </div>

                {/* Active Bonuses */}
                <ActiveBonusPanel
                  equipment={simState.equipment}
                  itemMap={itemMap}
                  activeSetBonuses={computed.activeSetBonuses}
                  activePowerups={computed.activePowerups}
                  armorSetUpgradeLevel={computed.armorSetUpgradeLevel}
                  totalEvolutionValue={computed.totalEvolutionValue}
                  hitRate={computed.hitRate}
                  blockRate={computed.blockRate}
                  pvpDmgPct={computed.pvpDmgPct}
                  atkSpeedPct={computed.atkSpeedPct}
                />
              </div>
            )}

            {/* ── STATS TAB ── */}
            {rightTab === 'stats' && (
              <div className="flex flex-col gap-3">
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                  <div className="text-sm font-semibold text-gray-300 mb-3">
                    {job?.name ?? '–'} · Lv. {simState.level}
                    {isMasterJob && (
                      <span className="ml-2 text-xs text-orange-400 font-normal">Master/Hero</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 mb-4">
                    <StatRow label="STR" value={fmt(computed.str)} color="text-red-300" />
                    <StatRow label="STA" value={fmt(computed.sta)} color="text-orange-300" />
                    <StatRow label="DEX" value={fmt(computed.dex)} color="text-yellow-300" />
                    <StatRow label="INT" value={fmt(computed.int)} color="text-blue-300" />
                  </div>

                  <div className="border-t border-gray-700 pt-3 grid grid-cols-2 gap-x-6 gap-y-1 mb-4">
                    <StatRow label="HP"  value={fmtK(computed.hp)}  color="text-green-400" />
                    <StatRow label="MP"  value={fmtK(computed.mp)}  color="text-blue-400"  />
                    <StatRow label="FP"  value={fmtK(computed.fp)}  color="text-yellow-400"/>
                    <StatRow label="DEF" value={`${fmt(computed.defMin)}–${fmt(computed.defMax)}`} color="text-gray-300" />
                  </div>

                  <div className="border-t border-gray-700 pt-3 mb-3">
                    <div className="text-xs text-gray-500 mb-2">Angriff (Melee)</div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                      <StatRow label="Waffentyp"    value={weaponType} />
                      <StatRow label="Waffen-Fakt." value={job ? `×${getWeaponFactor(job, weaponType).toFixed(1)}` : '–'} />
                      <StatRow label="ATK Min"      value={fmt(charAtkMin)} color="text-orange-400" />
                      <StatRow label="ATK Max"      value={fmt(charAtkMax)} color="text-orange-400" />
                      <StatRow label="Crit Rate"    value={`${critRate.toFixed(1)}%`} />
                      <StatRow label="Crit DMG"     value={`×${(2 * (1 + critDmg / 100)).toFixed(2)}`} color="text-red-400" />
                      {computed.monsterDmgPct > 0 && (
                        <StatRow label="PvE DMG" value={`+${computed.monsterDmgPct.toFixed(0)}%`} color="text-green-400" />
                      )}
                      {computed.addMagic > 0 && (
                        <StatRow label="Magic ATK" value={fmt(computed.addMagic)} color="text-purple-400" />
                      )}
                    </div>
                  </div>

                  <div className="border-t border-gray-700 pt-3 mb-3">
                    <div className="text-xs text-gray-500 mb-2">Normalangriff (Ergebnis)</div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                      <StatRow label="Normal Min" value={fmt(charAtkMin)} color="text-green-300" />
                      <StatRow label="Normal Max" value={fmt(charAtkMax)} color="text-green-300" />
                      <StatRow label="Krit Min"   value={fmt(charAtkMin * 2 * (1 + critDmg / 100))} color="text-red-400" />
                      <StatRow label="Krit Max"   value={fmt(charAtkMax * 2 * (1 + critDmg / 100))} color="text-red-400" />
                    </div>
                  </div>

                  {job && (
                    <div className="border-t border-gray-700 pt-3">
                      <div className="text-xs text-gray-500 mb-2">Klassen-Multiplikatoren</div>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                        <StatRow label="HP ×"  value={job.hpMultiplier.toFixed(2)}  />
                        <StatRow label="MP ×"  value={job.mpMultiplier.toFixed(2)}  />
                        <StatRow label="FP ×"  value={job.fpMultiplier.toFixed(2)}  />
                        <StatRow label="DEF ×" value={job.defMultiplier.toFixed(2)} />
                        <StatRow label="Block" value={`${(job.blockingRate * 100).toFixed(0)}%`} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── SKILLS TAB ── */}
            {rightTab === 'skills' && (
              <div className="flex flex-col gap-3">
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-3">
                  <div className="text-sm font-semibold text-gray-300 mb-2">
                    Skills ({filteredSkills.length})
                  </div>
                  <input
                    placeholder="Skill suchen…"
                    value={skillSearch}
                    onChange={e => setSkillSearch(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  {filteredSkills.map(skill => (
                    <SkillCard
                      key={skill.id}
                      skill={skill}
                      selectedLevel={skillLevels[skill.id] ?? skill.maxLevel}
                      onLevelChange={lvl => setSkillLevels(prev => ({ ...prev, [skill.id]: lvl }))}
                      charAtkMin={charAtkMin}
                      charAtkMax={charAtkMax}
                      critRate={critRate}
                      critDmg={critDmg}
                      monster={monsterStats}
                      charLevel={simState.level}
                      monsterDmgPct={computed.monsterDmgPct}
                    />
                  ))}
                  {filteredSkills.length === 0 && (
                    <div className="text-center text-gray-500 text-sm py-8">
                      Keine Skills für diese Klasse
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── KAMPF TAB ── */}
            {rightTab === 'combat' && (
              <div className="flex flex-col gap-3">
                {/* Monster Search & Selection */}
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-3">
                  <div className="text-sm font-semibold text-gray-300 mb-2">Monster-Ziel</div>
                  <input
                    placeholder="Monster suchen…"
                    value={monsterSearch}
                    onChange={e => setMonsterSearch(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 mb-2"
                  />

                  {selectedMonster && (
                    <div className="bg-gray-900 rounded-lg p-2.5 mb-2 border border-blue-700/40">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {(selectedMonster as Monster & { icon?: string }).icon && (
                            <img
                              src={(selectedMonster as Monster & { icon?: string }).icon}
                              alt={selectedMonster.name}
                              className="w-8 h-8 object-contain rounded"
                              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          )}
                          <span className="text-sm font-semibold text-blue-300">{selectedMonster.name}</span>
                        </div>
                        <button onClick={() => setSelectedMonster(null)}
                          className="text-gray-600 hover:text-gray-400 text-xs">×</button>
                      </div>
                      <div className="text-xs text-gray-500 mb-2">
                        Lv. {selectedMonster.level} · {selectedMonster.rank}
                        {selectedMonster.element !== 'None' && ` · ${selectedMonster.element}`}
                      </div>
                      <div className="grid grid-cols-4 gap-x-2 gap-y-0.5 text-xs">
                        <div className="text-gray-500">HP</div>
                        <div className="text-green-400 font-mono">{fmtK(selectedMonster.hp)}</div>
                        <div className="text-gray-500">DEF</div>
                        <div className="text-blue-300 font-mono">{fmt(selectedMonster.def)}</div>
                        <div className="text-gray-500">ATK</div>
                        <div className="text-red-300 font-mono col-span-3">
                          {fmt(selectedMonster.atkMin)}–{fmt(selectedMonster.atkMax)}
                        </div>
                        <div className="text-gray-500">EXP</div>
                        <div className="text-purple-300 font-mono">{fmtK(selectedMonster.exp)}</div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1 max-h-52 overflow-y-auto">
                    {filteredMonsters.map(m => (
                      <button
                        key={m.id}
                        onClick={() => setSelectedMonster(m)}
                        className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors flex items-center gap-2 ${
                          selectedMonster?.id === m.id
                            ? 'bg-blue-700/30 border border-blue-600/50 text-blue-200'
                            : 'bg-gray-750 hover:bg-gray-700 border border-transparent text-gray-300'
                        }`}
                      >
                        {(m as Monster & { icon?: string }).icon && (
                          <img
                            src={(m as Monster & { icon?: string }).icon}
                            alt=""
                            className="w-5 h-5 object-contain shrink-0 rounded"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        )}
                        <span className="truncate flex-1">{m.name}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-gray-500">Lv.{m.level}</span>
                          {m.rank !== 'Normal' && m.rank !== 'Low' && (
                            <span className={`text-[9px] px-1 rounded ${
                              m.rank === 'Boss'    ? 'bg-yellow-900/60 text-yellow-400' :
                              m.rank === 'Captain' ? 'bg-blue-900/60 text-blue-400' :
                                                     'bg-purple-900/60 text-purple-400'
                            }`}>{m.rank}</span>
                          )}
                        </div>
                      </button>
                    ))}
                    {filteredMonsters.length === 0 && (
                      <div className="text-center text-gray-600 text-xs py-4">Kein Monster gefunden</div>
                    )}
                    {!monsterSearch && monsters.length > 80 && (
                      <div className="text-center text-gray-600 text-[10px] py-1">
                        Suche um alle {monsters.length} Monster anzuzeigen
                      </div>
                    )}
                  </div>
                </div>

                <CombatStatsPanel
                  monster={selectedMonster}
                  computed={computed}
                  charLevel={simState.level}
                  charDef={def}
                  charAtkMin={charAtkMin}
                  charAtkMax={charAtkMax}
                  weaponType={weaponType}
                  expTable={expTable}
                  party={party}
                  onPartyChange={setParty}
                  isMasterJob={isMasterJob}
                />
              </div>
            )}

            {/* ── EXP/h TABELLE TAB ── */}
            {rightTab === 'exptable' && (
              <ExpComparisonTable
                charAtkMin={charAtkMin}
                charAtkMax={charAtkMax}
                charLevel={simState.level}
                critRate={critRate}
                critDmg={critDmg}
                weaponType={weaponType}
                dex={computed.dex}
                expTable={expTable}
                monsters={monsters}
                isMasterJob={isMasterJob}
                expBonus={computed.expBonus}
              />
            )}

          </div>
        </div>
      </div>

      {/* Item Config Panel (slide-in overlay) */}
      {activeSlot !== null && (
        <ItemConfigPanel
          slot={activeSlot}
          equipped={activeSlotEquipped}
          items={items}
          awakeningOptions={awakening?.options ?? []}
          gemDB={gems ?? null}
          jobPrefixDB={jobPrefixes ?? null}
          weaponCardDB={weaponCards ?? null}
          upgradeDB={upgrades ?? null}
          setEffectsDB={setEffects ?? {}}
          jobId={simState.jobId}
          gender={simState.gender}
          jobs={jobs}
          isDualWield={BLADE_JOBS_SIM.has(simState.jobId)}
          equippedWeapon={simState.equipment.weapon ? itemMap.get(simState.equipment.weapon.itemId) : undefined}
          onSave={handleSlotSave}
          onClose={() => setActiveSlot(null)}
        />
      )}
    </div>
  );
}
