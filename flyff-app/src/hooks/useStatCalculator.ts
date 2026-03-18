import { useMemo } from 'react';
import type {
  SimulatorState,
  ComputedStats,
  FlyffItem,
  EquipSlot,
  ActiveSetBonus,
  SetBonusTier,
} from '../types';
import type { JobData } from '../formulas';
import { calcHP, calcMP, calcFP } from '../formulas';
import type { SetEffectsDB, UpgradeBonusDB, GemBonusDB, JobPrefixDB, WeaponCardDB } from '../types';

// ─── Item slot → EquipSlot mapping (matches items.json slot field values) ─────
const SLOT_MAP: Record<string, EquipSlot> = {
  'Right Hand':      'weapon',
  'PARTS_SHIELD':    'shield',
  'PARTS_CAP':       'hat',
  'Body':            'suit',
  'Hands':           'glove',
  'Feet':            'boots',
  'PARTS_HAT':       'cs_hat',
  'PARTS_CLOTH':     'cs_suit',
  'PARTS_GLOVE':     'cs_glove',
  'PARTS_BOOTS':     'cs_boots',
  'Cloak':           'cloak',
  'Mask':            'mask',
  'PARTS_RING1':     'ring1',
  'PARTS_EARRING1':  'ear1',
  'PARTS_NECKLACE1': 'necklace',
  'PART_TALISMAN1':  'talisman1',
  'PART_TALISMAN2':  'talisman2',
};

// Blade-Klassen können Dual-Wield
const BLADE_JOBS = new Set([
  'JOB_BLADE',
  'JOB_BLADE_MASTER',
  'JOB_BLADE_HERO',
  'JOB_STORMBLADE_HERO',
]);

// Accessory slots that use upgrade_bonuses.json exact tables
const ACCESSORY_SLOTS: EquipSlot[] = ['ring1', 'ring2', 'ear1', 'ear2', 'necklace', 'talisman1', 'talisman2'];

// ─── Deferred stats (applied after base HP/MP/FP calculation) ────────────────
interface Deferred {
  hpFlat: number;
  mpFlat: number;
  fpFlat: number;
  hpPct: number;
  mpPct: number;
  fpPct: number;
  defPct: number;
}

function emptyDeferred(): Deferred {
  return { hpFlat: 0, mpFlat: 0, fpFlat: 0, hpPct: 0, mpPct: 0, fpPct: 0, defPct: 0 };
}

export interface StatCalcDeps {
  state: SimulatorState;
  items: FlyffItem[];
  job: JobData | null;
  setEffectsDB: SetEffectsDB | null;
  upgradeDB: UpgradeBonusDB | null;
  gemDB: GemBonusDB | null;
  jobPrefixDB: JobPrefixDB | null;
  weaponCardDB: WeaponCardDB | null;
}

// ─── Armor Set Upgrade Bonus table ───────────────────────────────────────────
// Source: https://flyffwiki.com/guides-gameplay/upgrading/armor/
// Applies when hat + suit + gloves + boots are ALL at the same upgrade level ≥ 3.
const ARMOR_SET_UPGRADE_BONUS: Record<number, {
  hitRate: number; blockRate: number; hpPct: number; addMagic: number; allStat: number;
}> = {
  3:  { hitRate: 5,  blockRate: 3,  hpPct: 0,  addMagic: 3,  allStat: 0 },
  4:  { hitRate: 10, blockRate: 3,  hpPct: 0,  addMagic: 4,  allStat: 0 },
  5:  { hitRate: 10, blockRate: 3,  hpPct: 5,  addMagic: 5,  allStat: 1 },
  6:  { hitRate: 20, blockRate: 6,  hpPct: 5,  addMagic: 6,  allStat: 1 },
  7:  { hitRate: 20, blockRate: 6,  hpPct: 5,  addMagic: 7,  allStat: 1 },
  8:  { hitRate: 30, blockRate: 10, hpPct: 10, addMagic: 8,  allStat: 2 },
  9:  { hitRate: 30, blockRate: 10, hpPct: 10, addMagic: 9,  allStat: 2 },
  10: { hitRate: 45, blockRate: 15, hpPct: 20, addMagic: 10, allStat: 2 },
};

// ─── Baruna Evolution Set Bonus thresholds ────────────────────────────────────
// Source: https://flyffwiki.com/guides-gameplay/baruna-evolution-system/
// Highest threshold met wins. allStat = flat bonus to STR/STA/DEX/INT each.
const EVOLUTION_SET_THRESHOLDS: {
  total: number; hitRate: number; hpPct: number; allStat: number; atkPct: number;
}[] = [
  { total: 25, hitRate: 60, hpPct: 40, allStat: 20, atkPct: 15 },
  { total: 20, hitRate: 45, hpPct: 25, allStat: 15, atkPct: 5  },
  { total: 15, hitRate: 35, hpPct: 20, allStat: 10, atkPct: 0  },
  { total: 10, hitRate: 25, hpPct: 15, allStat: 10, atkPct: 0  },
];

export function useStatCalculator(deps: StatCalcDeps): ComputedStats {
  const { state, items, job, setEffectsDB, upgradeDB, gemDB, jobPrefixDB, weaponCardDB } = deps;

  return useMemo(() => {
    const itemMap = new Map<string, FlyffItem>(items.map(i => [i.id, i]));
    const def = emptyDeferred();

    const acc: ComputedStats = {
      str: state.baseStr,
      sta: state.baseSta,
      dex: state.baseDex,
      int: state.baseInt,
      hp: 0,
      mp: 0,
      fp: 0,
      defMin: 0,
      defMax: 0,
      atkMin: 0,
      atkMax: 0,
      critRate: 0,
      critDmg: 0,
      atkPct: 0,
      equipAtk: 0,
      addMagic: 0,
      monsterDmgPct: 0,
      expBonus: 0,
      dropRateBonus: 0,
      blockRate: 0,
      hitRate: 0,
      atkSpeedPct: 0,
      pvpDmgPct: 0,
      armorSetUpgradeLevel: 0,
      totalEvolutionValue: 0,
      activeSetBonuses: [],
      activePowerups: [],
    };

    // ── 1. Collect equipped items ──────────────────────────────────────────
    const equippedSlots = Object.entries(state.equipment) as [EquipSlot, typeof state.equipment[EquipSlot]][];

    for (const [slot, equipped] of equippedSlots) {
      if (!equipped) continue;
      const item = itemMap.get(equipped.itemId);
      if (!item) continue;

      // ── 2. Item base stats ──────────────────────────────────────────────
      if (item.stats) {
        for (const [key, value] of Object.entries(item.stats)) {
          applyItemStat(acc, def, key, value as number);
        }
      }

      // Weapon ATK (weapon slot + dual-wield shield slot for Blade)
      if (slot === 'weapon' || (slot === 'shield' && BLADE_JOBS.has(state.jobId) && item.atkMin > 0)) {
        acc.atkMin += item.atkMin;
        acc.atkMax += item.atkMax;

        // Fusion bonus: fused weapon adds its base ATK
        if (slot === 'weapon' && equipped.fusedWeapon) {
          const fusedItem = itemMap.get(equipped.fusedWeapon.itemId);
          if (fusedItem && fusedItem.atkMin > 0) {
            const fuseLvl = equipped.fusedWeapon.upgradeLevel;
            const fuseBonus = (fusedItem.atkMin + fusedItem.atkMax) / 2 * fuseLvl * 0.05;
            acc.atkMin += fusedItem.atkMin + Math.round(fuseBonus);
            acc.atkMax += fusedItem.atkMax + Math.round(fuseBonus);
          }
        }
      }

      // Armor DEF (normal + CS slots)
      if (['hat', 'suit', 'glove', 'boots', 'cloak', 'shield',
           'cs_hat', 'cs_suit', 'cs_glove', 'cs_boots', 'mask'].includes(slot)) {
        acc.defMin += item.defMin;
        acc.defMax += item.defMax;
      }

      // ── 3. Upgrade bonuses ──────────────────────────────────────────────
      const upgradeLevel = equipped.upgradeLevel;
      if (upgradeLevel > 0) {
        if (ACCESSORY_SLOTS.includes(slot) && upgradeDB) {
          const table = upgradeDB[equipped.itemId];
          if (table) {
            const entry = table.find(e => e.level === upgradeLevel);
            if (entry) {
              for (const [label, { value, unit }] of Object.entries(entry.stats)) {
                applyLabelStat(acc, def, label, value, unit);
              }
            }
          }
        } else if (slot === 'weapon' || (slot === 'shield' && BLADE_JOBS.has(state.jobId) && item.atkMin > 0)) {
          const avgAtk = (item.atkMin + item.atkMax) / 2 || 1;
          const bonus = avgAtk * upgradeLevel * 0.05;
          acc.atkMin += Math.round(bonus * (item.atkMin / avgAtk));
          acc.atkMax += Math.round(bonus * (item.atkMax / avgAtk));
        } else if (['hat', 'suit', 'glove', 'boots', 'cloak', 'shield'].includes(slot) && item.defMin > 0) {
          const avgDef = (item.defMin + item.defMax) / 2;
          const bonus = avgDef * upgradeLevel * 0.05;
          acc.defMin += Math.round(bonus);
          acc.defMax += Math.round(bonus);
        }
      }

      // ── 4. Awakening slots ──────────────────────────────────────────────
      for (const awaken of equipped.awakenSlots) {
        applyDstStat(acc, def, awaken.stat, awaken.value);
      }

      // ── 5. Gem slots ────────────────────────────────────────────────────
      if (gemDB) {
        for (const gem of equipped.gemSlots) {
          const tierIdx = gem.tier - 1;
          let values: number[] | undefined;

          if (gem.gemType === 'ultimate') {
            values = gemDB.ultimate[gem.stat];
          } else if (gem.gemType === 'costume') {
            values = gemDB.costume[gem.stat];
          } else if (gem.gemType === 'suit') {
            const jobKey = state.jobId.startsWith('JOB_') ? state.jobId : `JOB_${state.jobId}`;
            values = gemDB.suit[jobKey]?.[gem.stat];
            if (!values) {
              const firstJob = Object.values(gemDB.suit)[0];
              values = firstJob?.[gem.stat];
            }
          }

          if (values && tierIdx >= 0 && tierIdx < values.length) {
            applyDstStat(acc, def, gem.stat, values[tierIdx]);
          }
        }
      }

      // ── 5b. Baruna Job Prefix ────────────────────────────────────────────
      if (jobPrefixDB && equipped.jobPrefixTier && equipped.jobPrefixTier > 0) {
        const jobKey = state.jobId.startsWith('JOB_') ? state.jobId : `JOB_${state.jobId}`;
        const prefix = jobPrefixDB[jobKey];
        if (prefix) {
          for (const s of prefix.stats) {
            applyDstStat(acc, def, s.stat, s.valuePerTier * equipped.jobPrefixTier);
          }
        }
      }

      // ── 5c. Weapon / Shield Card Sockets (max 10, non-Baruna) ────────────
      if (weaponCardDB && equipped.cardSlots && equipped.cardSlots.length > 0) {
        const cardMap = new Map(weaponCardDB.cards.map(c => [c.id, c]));
        for (const cardId of equipped.cardSlots) {
          if (!cardId) continue;
          const card = cardMap.get(cardId);
          if (card) {
            for (const [dst, val] of Object.entries(card.stats)) {
              applyDstStat(acc, def, dst, val);
            }
          }
        }
      }

      // ── 5d. Baruna Weapon Rune (max 1) ────────────────────────────────────
      if (weaponCardDB && equipped.barunaRune) {
        const rune = weaponCardDB.baruna_runes.find(r => r.id === equipped.barunaRune);
        if (rune) {
          for (const [dst, val] of Object.entries(rune.stats)) {
            applyDstStat(acc, def, dst, val);
          }
        }
      }

      // ── 5e. Baruna Evolution ──────────────────────────────────────────────
      // Source: https://flyffwiki.com/guides-gameplay/baruna-evolution-system/
      // Base ATK/DEF: +1% at evo1, +3% at evo2, +6% at evo3, +10% at evo4, +20% at evo5
      // Individual bonus (evo 2-4 only): evo2=+1%, evo3=+2%, evo4=+3%
      //   weapon→atkPct, helmet→hpPct, suit→defPct, gauntlet→monsterDmgPct, boots→pvpDmgPct
      if (item.grade === 'Baruna' && equipped.evolutionLevel && equipped.evolutionLevel > 0) {
        const evo = Math.min(5, equipped.evolutionLevel);
        const EVOLUTION_BASE_PCT = [0, 1, 3, 6, 10, 20];
        const basePct = EVOLUTION_BASE_PCT[evo] ?? 0;
        const indivPct = (evo >= 2 && evo <= 4) ? (evo - 1) : 0;

        const isWeaponSlot = slot === 'weapon' || (slot === 'shield' && BLADE_JOBS.has(state.jobId) && item.atkMin > 0);
        const isArmorSlot  = ['hat', 'suit', 'glove', 'boots', 'shield', 'cloak'].includes(slot);

        if (isWeaponSlot) {
          acc.atkPct += basePct + indivPct;
        } else if (isArmorSlot) {
          def.defPct += basePct;
          if (slot === 'hat')   def.hpPct  += indivPct;
          if (slot === 'suit')  def.defPct += indivPct;
          if (slot === 'glove') acc.monsterDmgPct += indivPct;
          if (slot === 'boots') acc.pvpDmgPct += indivPct;
          if (slot === 'shield') acc.expBonus += indivPct;
        }
        acc.totalEvolutionValue += evo;
      }

      // ── 5f. Cloak Essence (Forgotten Flaris system) ───────────────────────
      // Source: https://flyffwiki.com/guides-gameplay/essence-system/
      // Primary stat applied directly; secondary stat via awakening-style bonus
      if (slot === 'cloak' && equipped.essence) {
        const { stat, primaryValue, awakenStat, awakenValue } = equipped.essence;
        if (stat === 'All') {
          acc.str += primaryValue;
          acc.sta += primaryValue;
          acc.dex += primaryValue;
          acc.int += primaryValue;
        } else if (stat === 'STR') acc.str += primaryValue;
        else if (stat === 'STA') acc.sta += primaryValue;
        else if (stat === 'DEX') acc.dex += primaryValue;
        else if (stat === 'INT') acc.int += primaryValue;
        if (awakenStat && awakenValue) {
          applyDstStat(acc, def, awakenStat, awakenValue);
        }
      }
    }

    // ── 6. Set bonuses ───────────────────────────────────────────────────
    if (setEffectsDB) {
      const familyCount = new Map<string, number>();
      for (const [, equipped] of equippedSlots) {
        if (!equipped) continue;
        const item = itemMap.get(equipped.itemId);
        if (!item || !item.isSet || !item.setFamily) continue;
        familyCount.set(item.setFamily, (familyCount.get(item.setFamily) ?? 0) + 1);
      }

      for (const [familyId, count] of familyCount.entries()) {
        const setDef = setEffectsDB[familyId];
        if (!setDef) continue;

        const activeTiers: SetBonusTier[] = [];
        for (const tier of setDef.bonuses) {
          if (count >= tier.pieces) {
            activeTiers.push(tier);
            for (const effect of tier.effects) {
              applyLabelStat(acc, def, effect.stat, effect.value, effect.unit);
            }
          }
        }

        if (activeTiers.length > 0) {
          acc.activeSetBonuses.push({
            familyId,
            name: setDef.name,
            equippedCount: count,
            activeTiers,
          } as ActiveSetBonus);
        }
      }
    }

    // ── 7. Powerup buffs ────────────────────────────────────────────────
    for (const buffId of state.activeBuffIds) {
      const item = itemMap.get(buffId);
      if (!item?.powerup) continue;
      for (const effect of item.powerup.effects) {
        applyLabelStat(acc, def, effect.stat, effect.value, effect.unit);
      }
      acc.activePowerups.push({
        id: item.id,
        name: item.name,
        effects: item.powerup.effects,
        durationSec: item.powerup.durationSec,
      });
    }

    // ── 7b. Armor Set Upgrade Bonus ─────────────────────────────────────
    // Source: https://flyffwiki.com/guides-gameplay/upgrading/armor/
    // When hat + suit + glove + boots are all at the SAME upgrade level (≥ 3),
    // an additional set bonus is granted.
    {
      const armorPieces: EquipSlot[] = ['hat', 'suit', 'glove', 'boots'];
      const levels = armorPieces.map(s => state.equipment[s]?.upgradeLevel ?? -1);
      const allEquipped = levels.every(l => l >= 0);
      const allSame     = allEquipped && levels.every(l => l === levels[0]);
      const setLevel    = allSame ? levels[0] : 0;

      if (setLevel >= 3) {
        const bonus = ARMOR_SET_UPGRADE_BONUS[Math.min(setLevel, 10)];
        if (bonus) {
          acc.hitRate   += bonus.hitRate;
          acc.blockRate += bonus.blockRate;
          def.hpPct     += bonus.hpPct;
          acc.addMagic  += bonus.addMagic;
          const stat = bonus.allStat;
          if (stat > 0) { acc.str += stat; acc.sta += stat; acc.dex += stat; acc.int += stat; }
          acc.armorSetUpgradeLevel = setLevel;
        }
      }
    }

    // ── 7c. Baruna Evolution Set Bonus ──────────────────────────────────
    // Source: https://flyffwiki.com/guides-gameplay/baruna-evolution-system/
    // Based on total evolution value across ALL equipped Baruna pieces.
    if (acc.totalEvolutionValue >= 10) {
      const tier = EVOLUTION_SET_THRESHOLDS.find(t => acc.totalEvolutionValue >= t.total);
      if (tier) {
        acc.hitRate   += tier.hitRate;
        def.hpPct     += tier.hpPct;
        acc.atkPct    += tier.atkPct;
        const stat = tier.allStat;
        if (stat > 0) { acc.str += stat; acc.sta += stat; acc.dex += stat; acc.int += stat; }
      }
    }

    // ── 8. Base HP/MP/FP from job formula ────────────────────────────────
    if (job) {
      const charStats = {
        str: acc.str, sta: acc.sta, dex: acc.dex, int: acc.int,
        level: state.level,
        weaponAtkMin: acc.atkMin, weaponAtkMax: acc.atkMax,
        weaponType: 'Sword',
        equipAtk: acc.equipAtk, equipAtkPct: acc.atkPct,
        equipCritRate: acc.critRate, equipCritDmg: acc.critDmg,
      };
      acc.hp = calcHP(charStats, job);
      acc.mp = calcMP(charStats, job);
      acc.fp = calcFP(charStats, job);
    }

    // ── 9. Apply deferred HP/MP/FP bonuses ──────────────────────────────
    acc.hp = Math.round((acc.hp + def.hpFlat) * (1 + def.hpPct / 100));
    acc.mp = Math.round((acc.mp + def.mpFlat) * (1 + def.mpPct / 100));
    acc.fp = Math.round((acc.fp + def.fpFlat) * (1 + def.fpPct / 100));

    // ── 10. Apply DEF% bonus ─────────────────────────────────────────────
    if (def.defPct !== 0) {
      acc.defMin = Math.round(acc.defMin * (1 + def.defPct / 100));
      acc.defMax = Math.round(acc.defMax * (1 + def.defPct / 100));
    }

    return acc;
  }, [state, items, job, setEffectsDB, upgradeDB, gemDB, jobPrefixDB, weaponCardDB]);
}

// ─── Item stat mapper (human-readable keys from items.json) ──────────────────
//
// items.json stores stats as human-readable strings parsed from DST_* constants.
// This function maps those string keys to the corresponding ComputedStats fields.
//
function applyItemStat(acc: ComputedStats, def: Deferred, key: string, value: number) {
  switch (key) {
    // Base stats
    case 'STR':         acc.str += value; break;
    case 'STA':         acc.sta += value; break;
    case 'DEX':         acc.dex += value; break;
    case 'INT':         acc.int += value; break;
    case 'Stat Allup':  acc.str += value; acc.sta += value; acc.dex += value; acc.int += value; break;

    // Attack
    case 'ATK Power':       acc.equipAtk += value; break;
    case 'Atkpower Rate':   acc.atkPct   += value; break;
    case 'Chr Dmg':         acc.equipAtk += value; break;
    case 'Chr Weaeatkchange': acc.atkPct  += value; break;
    case 'Addmagic':        acc.addMagic  += value; break;

    // Critical
    case 'Chr Chancecritical': acc.critRate += value; break;
    case 'Critical Bonus':     acc.critDmg  += value; break;

    // PVE
    case 'Monster Dmg':    acc.monsterDmgPct += value; break;

    // Defense
    case 'DEF':          acc.defMin += value; acc.defMax += value; break;
    case 'Adjdef Rate':  def.defPct  += value; break;
    case 'Parry':        acc.defMin += value; acc.defMax += value; break;

    // HP / MP / FP (flat)
    case 'Max HP':       def.hpFlat += value; break;
    case 'Max MP':       def.mpFlat += value; break;
    case 'Max FP':       def.fpFlat += value; break;
    case 'Fp Max':       def.fpFlat += value; break;
    case 'Mp Max':       def.mpFlat += value; break;

    // HP / MP / FP (percent)
    case 'Max HP %':     def.hpPct += value; break;
    case 'Mp Max Rate':  def.mpPct += value; break;
    case 'Fp Max Rate':  def.fpPct += value; break;

    // Explicitly ignored (tracked but not yet in ComputedStats)
    case 'Attackspeed':
    case 'Attackspeed Rate':
      acc.atkSpeedPct += value; break;
    case 'Block Melee':
    case 'Block Range':
      acc.blockRate += value; break;
    case 'Hit Rate':
    case 'Hawkeye Rate':
      acc.hitRate += value; break;
    case 'Pvp Dmg':
    case 'Pvp Dmg Rate':
      acc.pvpDmgPct += value; break;
    case 'Experience':
      acc.expBonus += value; break;
    case 'Speed':
    case 'Locomotion':
    case 'Melee Stealhp':
    case 'Kill Hp':
      break;
    case 'Drop Item Allgrade Rate':
      acc.dropRateBonus += value; break;
    case 'Reflect DMG':
    case 'Hp Recovery':
    case 'Mp Recovery':
    case 'Fp Dec Rate':
    case 'Mp Dec Rate':
    case 'Restpoint Rate':
    case 'Giftbox':
    case 'Spell Rate':
    case 'Magic RES':
    case 'Swd Dmg':
    case 'Axe Dmg':
    case 'Bow Dmg':
    case 'Yoy Dmg':
    case 'Give Dmg Rate Enemy Bleeding':
    case 'Give Dmg Rate Enemy Dark':
    case 'Give Dmg Rate Enemy Poison':
    case 'Give Dmg Rate Enemy Slow':
    case 'Give Dmg Rate Enemy Stun':
    case 'Give Pve Dmg Element Earth Rate':
    case 'Give Pve Dmg Element Elect Rate':
    case 'Give Pve Dmg Element Fire Rate':
    case 'Give Pve Dmg Element Water Rate':
    case 'Give Pve Dmg Element Wind Rate':
    case 'Mastry Electricity':
    case 'Mastry Fire':
    case 'Mastry Wind':
      break;

    // Fallthrough: try DST_* format (used by awakening / gem stats stored with DST keys)
    default:
      if (key.startsWith('DST_')) applyDstStat(acc, def, key, value);
      break;
  }
}

// ─── DST_* stat mapper (used by awakening, gems, job prefixes, set effects) ──
function applyDstStat(acc: ComputedStats, def: Deferred, dst: string, value: number) {
  switch (dst) {
    case 'DST_STR':  acc.str += value; break;
    case 'DST_DEX':  acc.dex += value; break;
    case 'DST_INT':  acc.int += value; break;
    case 'DST_STA':  acc.sta += value; break;

    case 'DST_ATKPOWER':      acc.equipAtk += value; break;
    case 'DST_ATKPOWER_RATE': acc.atkPct   += value; break;
    case 'DST_ADDMAGIC':      acc.addMagic  += value; break;

    case 'DST_ADJDEF':      acc.defMin += value; acc.defMax += value; break;
    case 'DST_ADJDEF_RATE': def.defPct  += value; break;

    case 'DST_CRITICAL_BONUS':     acc.critDmg  += value; break;
    case 'DST_CHR_CHANCECRITICAL': acc.critRate += value; break;

    // PVE
    case 'DST_MONSTER_DMG':   acc.monsterDmgPct += value; break;

    case 'DST_HP_MAX':        def.hpFlat += value; break;
    case 'DST_HP_MAX_RATE':   def.hpPct  += value; break;
    case 'DST_MP_MAX':        def.mpFlat += value; break;
    case 'DST_MP_MAX_RATE':   def.mpPct  += value; break;
    case 'DST_FP_MAX':        def.fpFlat += value; break;
    case 'DST_FP_MAX_RATE':   def.fpPct  += value; break;

    // Ignored (no matching ComputedStats field)
    case 'DST_ATTACKSPEED':
    case 'DST_SPEED':
    case 'DST_BLOCK_MELEE':
    case 'DST_BLOCK_RANGE':
      acc.blockRate += value; break;
    case 'DST_EXPERIENCE':
      acc.expBonus += value; break;
    case 'DST_DROP_ITEM_ALLGRADE_RATE':
      acc.dropRateBonus += value; break;
    case 'DST_REFLECT_DAMAGE':
    case 'DST_MELEE_STEALHP':
    case 'DST_SPELL_RATE':
      break;
  }
}

// ─── Label stat mapper (used by set effects, powerups, upgrade tables) ────────
function applyLabelStat(acc: ComputedStats, def: Deferred, label: string, value: number, unit: string) {
  const pct = unit === '%';
  switch (label) {
    case 'STR': acc.str += value; break;
    case 'DEX': acc.dex += value; break;
    case 'INT': acc.int += value; break;
    case 'STA': acc.sta += value; break;
    case 'Stat Allup': acc.str += value; acc.sta += value; acc.dex += value; acc.int += value; break;

    case 'ATK':
      pct ? (acc.atkPct += value) : (acc.equipAtk += value);
      break;
    case 'DEF':
      pct ? (def.defPct += value) : (acc.defMin += value, acc.defMax += value);
      break;

    case 'Crit Rate':   acc.critRate += value; break;
    case 'Crit DMG':    acc.critDmg  += value; break;
    case 'Magic ATK':   acc.addMagic  += value; break;
    case 'Monster DMG': acc.monsterDmgPct += value; break;

    case 'Max HP':
      pct ? (def.hpPct += value) : (def.hpFlat += value);
      break;
    case 'Max MP':
      pct ? (def.mpPct += value) : (def.mpFlat += value);
      break;
    case 'Max FP':
      pct ? (def.fpPct += value) : (def.fpFlat += value);
      break;

    case 'Block Melee':
    case 'Block Range':
      acc.blockRate += value; break;
    case 'Speed':
    case 'ATK Speed':
      break;
    case 'EXP':
      acc.expBonus += value; break;
    case 'Drop Rate':
      acc.dropRateBonus += value; break;
    case 'Suck Blood':
    case 'PvP DMG':
    case 'Reflect DMG':
      break;

    default:
      // Try DST_* pass-through for set effects that emit raw DST keys
      if (label.startsWith('DST_')) applyDstStat(acc, def, label, value);
      break;
  }
}

export { SLOT_MAP };
