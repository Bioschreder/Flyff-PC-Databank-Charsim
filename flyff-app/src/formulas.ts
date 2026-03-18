// Flyff attack damage formulas (verified against game source / community wikis)
// ─────────────────────────────────────────────────────────────────────────────

export interface JobData {
  id: string;
  name: string;
  tier: number;
  parent: string | null;
  maxLevel: number;
  hpMultiplier: number;
  mpMultiplier: number;
  fpMultiplier: number;
  defMultiplier: number;
  hpRecovery: number;
  mpRecovery: number;
  fpRecovery: number;
  swordFactor: number;
  axeFactor: number;
  staffFactor: number;
  stickFactor: number;
  knuckleFactor: number;
  wandFactor: number;
  blockingRate: number;
  yoyoFactor: number;
  criticalFactor: number;
  skills: string[];
}

export interface SkillLevel {
  level: number;
  atkMin: number;
  atkMax: number;
  attackSpeed: number;
  needMP: number;
  needFP: number;
  cooldown: number;
  range: number;
  keepTime: number;
  effects: { stat: string; value: number; valuePerLevel: number; unit: string }[];
}

export interface SkillData {
  id: string;
  name: string;
  maxLevel: number;
  levels: SkillLevel[];
}

export interface CharStats {
  str: number;
  sta: number;
  dex: number;
  int: number;
  level: number;
  weaponAtkMin: number;
  weaponAtkMax: number;
  weaponType: string;
  // Equipment bonuses
  equipAtk: number;
  equipAtkPct: number;
  equipCritRate: number;
  equipCritDmg: number;
}

// ─── FLYFF MELEE DAMAGE FORMULA ───────────────────────────────────────────────
// Source: Flyff community-reverse-engineered formula
//
// CharATK  = weaponATK * weaponFactor  +  STR * (level/5 + 5)  +  STR * (STR/5)
// (simplified): base = STR*(lvl/5+5) + STR*STR/5 + weaponMin..weaponMax * factor
//
// FinalATK = CharATK * (1 + equipAtkPct/100) + equipAtk
// CritDMG  = FinalATK * 2.0 * (1 + critDmgBonus/100)
//
// Skill DMG = FinalATK * (SkillAtkMin + SkillAtkMax) / 200
//   (SkillAtkMin/Max are % modifiers from propSkillAdd, e.g. 180/220 means 180-220% of weapon ATK)

export function calcCharATK(stats: CharStats, job: JobData, useMin: boolean): number {
  const weaponFactor = getWeaponFactor(job, stats.weaponType);
  const strBonus = stats.str * (stats.level / 5 + 5) + (stats.str * stats.str) / 5;
  const weaponAtk = useMin ? stats.weaponAtkMin : stats.weaponAtkMax;
  const base = strBonus + weaponAtk * weaponFactor;
  return base * (1 + stats.equipAtkPct / 100) + stats.equipAtk;
}

export function calcSkillDMG(
  charAtk: number,
  skillLevel: SkillLevel,
  critRate: number,
  critDmgBonus: number
): { normal: number; crit: number; expected: number } {
  // Skill factor from propSkillAdd atkMin/atkMax (as %)
  const factor = (skillLevel.atkMin + skillLevel.atkMax) / 200;
  const normal = charAtk * factor;
  const crit   = normal * 2.0 * (1 + critDmgBonus / 100);
  const cr     = Math.min(critRate / 100, 1);
  return { normal, crit, expected: normal * (1 - cr) + crit * cr };
}

export function getWeaponFactor(job: JobData, weaponType: string): number {
  switch (weaponType) {
    case "Sword":   return job.swordFactor;
    case "Axe":     return job.axeFactor;
    case "Staff":   return job.staffFactor;
    case "Stick":   return job.stickFactor;
    case "Knuckle": return job.knuckleFactor;
    case "Wand":    return job.wandFactor;
    case "Yoyo":    return job.yoyoFactor;
    default:        return job.swordFactor;
  }
}

// Flyff PC HP/MP/FP formula (reverse-engineered from community sources):
//   MaxHP = STA * (STA + Level) * hpMultiplier
//   MaxMP = INT * (INT + Level) * mpMultiplier
//   MaxFP = DEX * (DEX + Level) * fpMultiplier
//
// Calibration: Templar lv181, STA=750 → 750*(750+181)*2.0 = 1,396,500 base HP
//   With typical gear HP% (+40-50%) → ~1.95M–2.09M, matching the ~2M in-game value.

export function calcHP(stats: CharStats, job: JobData): number {
  return Math.round(stats.sta * (stats.sta + stats.level) * job.hpMultiplier);
}

export function calcMP(stats: CharStats, job: JobData): number {
  return Math.round(stats.int * (stats.int + stats.level) * job.mpMultiplier);
}

export function calcFP(stats: CharStats, job: JobData): number {
  return Math.round(stats.dex * (stats.dex + stats.level) * job.fpMultiplier);
}

export function calcDEF(stats: CharStats, job: JobData, equipDef: number): number {
  return Math.round((stats.sta * job.defMultiplier + equipDef));
}

// ─── MONSTER DAMAGE CALCULATION ───────────────────────────────────────────────
//
// In Flyff the damage dealt TO a monster is:
//   DMG = max(1, CharATK - MonsterDEF)
//   The monster's DEF reduces your damage directly.
//   resMagic = 0 (no reduction), higher = more resistant.
//
// For a simple approximation used by many community tools:
//   effectiveDEF = monsterDef * (1 - (attackerLevel - monsterLevel) * 0.01)
//   The level difference provides a ±1% damage modifier per level.

export interface MonsterStats {
  def: number;
  hp: number;
  exp: number;
  level: number;
  resMagic: number;
}

export function calcDmgVsMonster(
  charAtk: number,
  monster: MonsterStats,
  charLevel: number,
): number {
  const levelMod = 1 + (charLevel - monster.level) * 0.01;
  const effDef   = Math.max(0, monster.def * Math.max(0.1, 1 / levelMod));
  return Math.max(1, (charAtk - effDef) * levelMod);
}

export function calcSkillDmgVsMonster(
  charAtk: number,
  skillLevel: SkillLevel,
  critRate: number,
  critDmgBonus: number,
  monster: MonsterStats,
  charLevel: number,
): { normal: number; crit: number; expected: number } {
  const factor = (skillLevel.atkMin + skillLevel.atkMax) / 200;
  const rawAtk = charAtk * factor;
  const levelMod = 1 + (charLevel - monster.level) * 0.01;
  const effDef   = Math.max(0, monster.def * Math.max(0.1, 1 / levelMod));
  const normal = Math.max(1, (rawAtk - effDef) * levelMod);
  const crit   = normal * 2.0 * (1 + critDmgBonus / 100);
  const cr     = Math.min(critRate / 100, 1);
  return { normal, crit, expected: normal * (1 - cr) + crit * cr };
}

export function killsForLevelUp(expNeeded: number, expPerKill: number): number {
  if (expPerKill <= 0) return Infinity;
  return Math.ceil(expNeeded / expPerKill);
}

// ─── MONSTER DAMAGE TO CHARACTER ──────────────────────────────────────────────
//
// Flyff PC formula: damage = max(1, monsterATK - charDEF)
//
// Level difference → DEF bypass:
//   Each level the monster is ABOVE the character reduces effective DEF by 2%
//   (capped at 30% bypass). This models the "defense penetration" effect of
//   higher-level enemies; it does NOT multiply the monster's raw ATK.
//
// Skill attacks: Boss monsters use special ability attacks that multiply their
//   base ATK. Multipliers per rank (observed in-game):
//     Super   = ×2.5  (e.g. Kalipogon SUPER: 855K × 2.5 ≈ 2.14M)
//     Midboss = ×1.8
//     Boss    = ×1.5
//     Captain = ×1.2
//     Normal  = ×1.0  (no skill bonus)
//   These are stored in monsters.json as skillAtkMin/skillAtkMax.

export function calcMonsterDmgToChar(
  monsterAtkMin: number,
  monsterAtkMax: number,
  charDef: number,
  monsterLevel: number,
  charLevel: number,
): { min: number; max: number; avg: number } {
  // DEF bypass: monster levels above player reduce effective DEF (2% per level, cap 30%)
  const levelDiff = monsterLevel - charLevel;
  const defBypassPct = Math.max(0, Math.min(30, levelDiff * 2));
  const effectiveDef = Math.max(0, charDef * (1 - defBypassPct / 100));

  const rawMin = Math.max(1, monsterAtkMin - effectiveDef);
  const rawMax = Math.max(1, monsterAtkMax - effectiveDef);
  return {
    min: Math.round(rawMin),
    max: Math.round(rawMax),
    avg: Math.round((rawMin + rawMax) / 2),
  };
}

// ─── DPS & KILL TIME ──────────────────────────────────────────────────────────
//
// Attack interval (ms):
//   Base: 1600ms for melee, 1800ms for ranged, 1400ms for fast weapons (yoyo, wand)
//   DEX reduces it: factor = max(0.5, 1 - DEX * 0.002)   → 100 DEX = -20% interval
//   Final minimum: 800ms (Flyff server tick floor)
//
// DPS = (avgDmg * critExpectedMultiplier) / attackIntervalSec

export type WeaponSpeedCategory = 'fast' | 'normal' | 'slow';

export function getWeaponBaseIntervalMs(weaponType: string): number {
  switch (weaponType) {
    case 'Yo-Yo':
    case 'Wand':
    case 'Knuckle': return 1200;
    case 'Staff':
    case 'Two-Hand Sword':
    case 'Two-Hand Axe': return 2000;
    case 'Bow':
    case 'Crossbow':    return 1800;
    default:            return 1600; // Sword, Axe, etc.
  }
}

export function calcAttackIntervalMs(weaponType: string, dex: number): number {
  const base = getWeaponBaseIntervalMs(weaponType);
  const factor = Math.max(0.5, 1 - dex * 0.0015);
  return Math.max(800, Math.round(base * factor));
}

export function calcDPS(
  avgDmg: number,
  critRate: number,
  critDmgBonus: number,
  attackIntervalMs: number,
): number {
  const cr   = Math.min(critRate / 100, 1);
  const crit = avgDmg * 2 * (1 + critDmgBonus / 100);
  const expected = avgDmg * (1 - cr) + crit * cr;
  return expected / (attackIntervalMs / 1000);
}

export function calcKillTimeMs(monsterHp: number, dps: number): number {
  if (dps <= 0) return Infinity;
  return (monsterHp / dps) * 1000;
}

// ─── EXP CALCULATION ──────────────────────────────────────────────────────────
//
// All modifiers are MULTIPLICATIVE (stacked together):
//   finalEXP = baseEXP × expEvent × lordEvent × ampli × expStatMod
//              × cheerMod × lordCheerMod × masterMalus × advPartyMod × votersMod
//
// Exception: Bubble-Point Rested EXP applies only to baseEXP before other mods.
//
// Level penalty/bonus (per-level EXP limit applied before all mods):
//   charLevel > monsterLevel + 10 → -5% per extra level (floor 5%)
//   monsterLevel > charLevel      → +5% per level above (cap 150%)
//
// Ampli stacks ADD their % within the ampli group:
//   5x Q (+200% each) → total ampli bonus = +1000% → multiplier = ×11

// ─── Ampli tiers ──────────────────────────────────────────────────────────────
export interface AmpliTier {
  id: string;
  label: string;
  bonusPct: number;
  maxStack: number;
}

export const AMPLI_TIERS: AmpliTier[] = [
  { id: 'none', label: 'Kein Ampli',  bonusPct: 0,   maxStack: 0 },
  { id: 'ES',   label: 'ES  +50%',    bonusPct: 50,  maxStack: 5 },
  { id: 'EM',   label: 'EM  +100%',   bonusPct: 100, maxStack: 1 },
  { id: 'R',    label: 'R   +100%',   bonusPct: 100, maxStack: 5 },
  { id: 'V',    label: 'V   +100%',   bonusPct: 100, maxStack: 5 },
  { id: 'Q',    label: 'Q   +200%',   bonusPct: 200, maxStack: 5 },
  { id: 'P',    label: 'P   +200%',   bonusPct: 200, maxStack: 5 },
  { id: 'W',    label: 'W   +250%',   bonusPct: 250, maxStack: 5 },
  { id: 'X',    label: 'X   +300%',   bonusPct: 300, maxStack: 5 },
];

// ─── EXP modifier options (passed from UI) ────────────────────────────────────
export interface ExpModifiers {
  expEventMult: number;         // server event – e.g. 3.5  (1 = no event)
  lordEventPct: number;         // Lord EXP event – e.g. 50 → ×1.5
  ampliTierId: string;          // e.g. 'Q'
  ampliStacks: number;          // 0–maxStack
  expStatPct: number;           // from equipment/powerups (DST_EXPERIENCE)
  cheerActive: boolean;         // Ringmaster Cheer party skill  +5%
  lordCheerActive: boolean;     // Lordship Cheer                +10%
  masterMalus: boolean;         // Master/Hero malus (×0.5, pre 130H)
  advancedPartyContrib: boolean;// Advanced Party Contribution   ×2.5
  votersBuff: boolean;          // Voter's Buff                  +50%
  // Rested (Bubble-Point) EXP applies only to base, tracked separately
  bubblePointPct: number;       // e.g. 100 → +100% applied to base before mods
  isMasterHero?: boolean;       // true → use Lv60M-130H penalty column
}

// EXP Level Penalty – based on official Flyff table:
//
//  Monster unter Char-Lv │ Lv1-120 / Lv130-170 │ Lv60M-130H
//  ─────────────────────────────────────────────────────────
//  0                     │  0% Verlust (×1.00)  │ 50% (×0.50)
//  1–5                   │ 30% Verlust (×0.70)  │ 65% (×0.35)
//  6–10                  │ 50% Verlust (×0.50)  │ 75% (×0.25)
//  11–14                 │ 70% Verlust (×0.30)  │ 85% (×0.15)
//  ≥15                   │ 90% Verlust (×0.10)  │ 95% (×0.05)
//
// Monster higher than char: +5% per level above, capped at ×1.50
export function calcExpLevelModifier(
  charLevel: number,
  monsterLevel: number,
  isMasterHero = false,
): number {
  const diff = charLevel - monsterLevel; // positive → monster is lower

  // Monster is higher level → small bonus, cap 150%
  if (diff < 0) {
    return Math.min(1.5, 1 + Math.abs(diff) * 0.05);
  }

  if (isMasterHero) {
    // Lv60M–130H column
    if (diff === 0)          return 0.50;
    if (diff <= 5)           return 0.35;
    if (diff <= 10)          return 0.25;
    if (diff <= 14)          return 0.15;
    return 0.05;
  } else {
    // Lv1-120 / Lv130-170 column
    if (diff === 0)          return 1.00;
    if (diff <= 5)           return 0.70;
    if (diff <= 10)          return 0.50;
    if (diff <= 14)          return 0.30;
    return 0.10;
  }
}

export function calcAmpliMultiplier(tierId: string, stacks: number): number {
  const tier = AMPLI_TIERS.find(t => t.id === tierId);
  if (!tier || tier.id === 'none' || stacks === 0) return 1;
  const totalPct = tier.bonusPct * Math.min(stacks, tier.maxStack);
  return 1 + totalPct / 100;
}

export function calcFlyffExp(
  baseExp: number,
  charLevel: number,
  monsterLevel: number,
  mods: ExpModifiers,
): { expPerKill: number; breakdown: Record<string, number>; totalMult: number } {
  // Per-level EXP limit (applied first, before all other mods)
  const levelMod   = calcExpLevelModifier(charLevel, monsterLevel, mods.isMasterHero ?? false);
  const limitedBase = Math.round(baseExp * levelMod);

  // Bubble-Point Rested EXP: applies only to limitedBase
  const restedBonus = Math.round(limitedBase * mods.bubblePointPct / 100);
  const effectiveBase = limitedBase + restedBonus;

  // All remaining mods are multiplicative
  const expEventMult     = mods.expEventMult > 0 ? mods.expEventMult : 1;
  const lordEventMult    = 1 + mods.lordEventPct / 100;
  const ampliMult        = calcAmpliMultiplier(mods.ampliTierId, mods.ampliStacks);
  const expStatMult      = 1 + mods.expStatPct / 100;
  const cheerMult        = mods.cheerActive ? 1.05 : 1;
  const lordCheerMult    = mods.lordCheerActive ? 1.10 : 1;
  const masterMalusMult  = mods.masterMalus ? 0.5 : 1;
  const advPartyMult     = mods.advancedPartyContrib ? 2.5 : 1;
  const votersMult       = mods.votersBuff ? 1.5 : 1;

  const totalMult = expEventMult * lordEventMult * ampliMult * expStatMult
    * cheerMult * lordCheerMult * masterMalusMult * advPartyMult * votersMult;

  const expPerKill = Math.round(effectiveBase * totalMult);

  const breakdown: Record<string, number> = {
    levelMod,
    bubblePointPct: mods.bubblePointPct,
    expEventMult,
    lordEventMult,
    ampliMult,
    expStatMult,
    cheerMult,
    lordCheerMult,
    masterMalusMult,
    advPartyMult,
    votersMult,
    totalMult,
  };

  return { expPerKill, breakdown, totalMult };
}

// ─── DROP RATE MODIFIERS ──────────────────────────────────────────────────────
export function calcTotalDropRateMultiplier(
  itemBonusPct: number,
  partyFortuneCircle: boolean,
): number {
  let total = itemBonusPct;
  if (partyFortuneCircle) total += 50;
  return 1 + total / 100;
}

// ─── PARTY LINK ATTACK ────────────────────────────────────────────────────────
export const LINK_ATTACK_BONUS = 0.30;

