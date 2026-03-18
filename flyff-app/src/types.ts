export type SoulboundType = 'always' | 'permanent' | null;

export interface PowerupEffect {
  stat: string;
  value: number;
  unit: string;
}

export interface PowerupInfo {
  effectType: string;
  durationSec: number;
  effects: PowerupEffect[];
}

export interface FlyffItem {
  id: string;
  name: string;
  nameId: string;
  description: string;
  level: number;
  category: string;
  subcategory: string;
  type: string;
  job: string;
  grade: string;
  slot: string;
  cost: number;
  twoHanded: boolean;
  atkMin: number;
  atkMax: number;
  defMin: number;
  defMax: number;
  icon: string;
  hasIcon: boolean;
  isSet: boolean;
  setFamily: string;
  setMembers: string[];
  stats: Record<string, number>;
  soulbound: SoulboundType;
  powerup: PowerupInfo | null;
}

export interface SetBonusEffect {
  stat: string;
  value: number;
  unit: string;
}

export interface SetBonusTier {
  pieces: number;
  effects: SetBonusEffect[];
}

export interface SetEffect {
  name: string;
  bonuses: SetBonusTier[];
}

export type SetEffectsDB = Record<string, SetEffect>;

export interface UpgradeLevelEntry {
  level: number;
  stats: Record<string, { value: number; unit: string }>;
}

export type UpgradeBonusDB = Record<string, UpgradeLevelEntry[]>;

export interface ItemDatabase {
  items: FlyffItem[];
  categories: Record<string, string[]>;
  jobs: string[];
  grades: string[];
  total: number;
}

export type SortKey = 'level_asc' | 'level_desc' | 'name_asc' | 'grade_asc' | 'grade_desc';

export interface FilterState {
  search: string;
  category: string;
  subcategory: string;
  job: string;
  grade: string;
  minLevel: number;
  maxLevel: number;
  sort: SortKey;
}

// ─── Equipment Simulator Types ────────────────────────────────────────────────

export type EquipSlot =
  // Normal armor
  | 'weapon'
  | 'shield'
  | 'hat'
  | 'suit'
  | 'glove'
  | 'boots'
  // CS / Costume armor (separate overlay slots)
  | 'cs_hat'
  | 'cs_suit'
  | 'cs_glove'
  | 'cs_boots'
  | 'cloak'
  | 'mask'
  // Accessories
  | 'ring1'
  | 'ring2'
  | 'ear1'
  | 'ear2'
  | 'necklace'
  | 'talisman1'
  | 'talisman2';

export interface AwakenSlot {
  stat: string;
  value: number;
}

export interface GemSlot {
  gemType: 'ultimate' | 'suit' | 'costume';
  stat: string;
  tier: number;
}

export interface FusedWeapon {
  itemId: string;
  upgradeLevel: number;
}

// Essence enhancement for cloaks (Forgotten Flaris system)
export interface EssenceSlot {
  stat: 'STR' | 'STA' | 'DEX' | 'INT' | 'All';
  grade: 'Common' | 'Uncommon' | 'Rare' | 'Hero' | 'Legendary';
  primaryValue: number;
  awakenStat?: string;
  awakenValue?: number;
}

export interface EquippedItem {
  itemId: string;
  upgradeLevel: number;
  awakenSlots: AwakenSlot[];
  gemSlots: GemSlot[];
  cardSlots: (string | null)[];   // up to 10 card IDs; null = empty
  barunaRune?: string | null;     // single rune ID for Baruna weapons (max 1)
  fusedWeapon?: FusedWeapon;
  jobPrefixTier?: number;
  evolutionLevel?: number;        // 0-5 for Baruna items (Baruna Evolution System)
  essence?: EssenceSlot;          // Cloak slot only (Essence/Forgotten Flaris system)
}

export interface SimulatorState {
  jobId: string;
  gender: 'M' | 'F';
  level: number;
  baseStr: number;
  baseSta: number;
  baseDex: number;
  baseInt: number;
  equipment: Partial<Record<EquipSlot, EquippedItem>>;
  activeBuffIds: string[];
}

export interface ActiveSetBonus {
  familyId: string;
  name: string;
  equippedCount: number;
  activeTiers: SetBonusTier[];
}

export interface ComputedStats {
  str: number;
  sta: number;
  dex: number;
  int: number;
  hp: number;
  mp: number;
  fp: number;
  defMin: number;
  defMax: number;
  atkMin: number;
  atkMax: number;
  critRate: number;
  critDmg: number;
  atkPct: number;
  equipAtk: number;
  addMagic: number;
  monsterDmgPct: number;
  expBonus: number;
  dropRateBonus: number;
  blockRate: number;
  hitRate: number;             // Hit% bonus (armor set upgrade, items)
  atkSpeedPct: number;         // Attack speed % bonus
  pvpDmgPct: number;           // PvP damage % (Baruna boots evolution, display only)
  armorSetUpgradeLevel: number; // 0 if no armor set bonus active; else matching level
  totalEvolutionValue: number;  // Sum of all equipped Baruna evolution levels
  activeSetBonuses: ActiveSetBonus[];
  activePowerups: { id: string; name: string; effects: PowerupEffect[]; durationSec: number }[];
}

// ─── Monster Types ────────────────────────────────────────────────────────────

export interface Monster {
  id: string;
  name: string;
  level: number;
  rank: string;
  race: string;
  hp: number;
  mp: number;
  atkMin: number;
  atkMax: number;
  /** Estimated skill/special attack min (rank-based multiplier × base ATK) */
  skillAtkMin: number;
  /** Estimated skill/special attack max (rank-based multiplier × base ATK) */
  skillAtkMax: number;
  /** Multiplier used: Super=2.5, Midboss=1.8, Boss=1.5, Captain=1.2, Normal=1.0 */
  skillMult: number;
  def: number;
  exp: number;
  element: string;
  elementAtk: number;
  resMagic: number;
  resElec: number;
  resFire: number;
  resWind: number;
  resWater: number;
  resEarth: number;
}

// ─── Awakening & Gem Data ─────────────────────────────────────────────────────

export interface AwakeningOption {
  stat: string;
  label: string;
  minVal: number;
  maxVal: number;
  unit: string;
}

export interface AwakeningOptionsDB {
  options: AwakeningOption[];
}

export interface GemBonusDB {
  ultimate: Record<string, number[]>;
  suit: Record<string, Record<string, number[]>>;
  costume: Record<string, number[]>;
}

// ─── Job Prefix (Baruna Armor) ────────────────────────────────────────────────

export interface JobPrefixStat {
  stat: string;
  valuePerTier: number;
  tiers: number;
}

export interface JobPrefixEntry {
  id: number;
  label: string;
  stats: JobPrefixStat[];
}

export type JobPrefixDB = Record<string, JobPrefixEntry>;

// ─── Weapon Card & Baruna Rune System ────────────────────────────────────────

export interface WeaponCard {
  id: string;
  name: string;
  rank: 'D' | 'C' | 'B' | 'A' | 'S' | 'R' | 'SR' | 'N';
  group: 'fire' | 'water' | 'electric' | 'earth' | 'wind' | 'utility';
  stats: Record<string, number>;
}

export interface BarunaRune {
  id: string;
  name: string;
  stats: Record<string, number>;
}

export interface WeaponCardDB {
  cards: WeaponCard[];
  baruna_runes: BarunaRune[];
}
