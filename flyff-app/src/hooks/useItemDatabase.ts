import { useState, useEffect } from 'react';
import type {
  ItemDatabase,
  SetEffectsDB,
  UpgradeBonusDB,
  AwakeningOptionsDB,
  GemBonusDB,
  JobPrefixDB,
  WeaponCardDB,
  FlyffItem,
  EquipSlot,
} from '../types';

let cachedItems: ItemDatabase | null = null;
let cachedSetEffects: SetEffectsDB | null = null;
let cachedUpgrades: UpgradeBonusDB | null = null;
let cachedAwakening: AwakeningOptionsDB | null = null;
let cachedGems: GemBonusDB | null = null;
let cachedJobPrefixes: JobPrefixDB | null = null;
let cachedWeaponCards: WeaponCardDB | null = null;

// Maps items.json slot values to EquipSlot types
const SLOT_TO_EQUIPSLOT: Record<string, EquipSlot[]> = {
  // Normal armor (Armor / Armor Set subcategory)
  'PARTS_CAP':       ['hat'],
  'Body':            ['suit'],
  'Hands':           ['glove'],
  'Feet':            ['boots'],
  'PARTS_SHIELD':    ['shield'],
  'Right Hand':      ['weapon'],
  // CS / Costume armor (Costume / Costume Accessory subcategory)
  'PARTS_HAT':       ['cs_hat'],
  'PARTS_CLOTH':     ['cs_suit'],
  'PARTS_GLOVE':     ['cs_glove'],
  'PARTS_BOOTS':     ['cs_boots'],
  'Cloak':           ['cloak'],
  'Mask':            ['mask'],
  // Accessories
  'PARTS_RING1':     ['ring1', 'ring2'],
  'PARTS_EARRING1':  ['ear1', 'ear2'],
  'PARTS_NECKLACE1': ['necklace'],
  'PART_TALISMAN1':  ['talisman1'],
  'PART_TALISMAN2':  ['talisman2'],
};

export function useItemDatabase() {
  const [data, setData] = useState<ItemDatabase | null>(cachedItems);
  const [setEffects, setSetEffects] = useState<SetEffectsDB | null>(cachedSetEffects);
  const [upgrades, setUpgrades] = useState<UpgradeBonusDB | null>(cachedUpgrades);
  const [awakening, setAwakening] = useState<AwakeningOptionsDB | null>(cachedAwakening);
  const [gems, setGems] = useState<GemBonusDB | null>(cachedGems);
  const [jobPrefixes, setJobPrefixes] = useState<JobPrefixDB | null>(cachedJobPrefixes);
  const [weaponCards, setWeaponCards] = useState<WeaponCardDB | null>(cachedWeaponCards);
  const [loading, setLoading] = useState(
    !cachedItems || !cachedSetEffects || !cachedUpgrades || !cachedAwakening || !cachedGems || !cachedJobPrefixes || !cachedWeaponCards
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cachedItems && cachedSetEffects && cachedUpgrades && cachedAwakening && cachedGems && cachedJobPrefixes && cachedWeaponCards) return;
    setLoading(true);
    Promise.all([
      cachedItems       ? Promise.resolve(cachedItems)       : fetch('/data/items.json').then(r => r.json()),
      cachedSetEffects  ? Promise.resolve(cachedSetEffects)  : fetch('/data/set_effects.json').then(r => r.json()),
      cachedUpgrades    ? Promise.resolve(cachedUpgrades)    : fetch('/data/upgrade_bonuses.json').then(r => r.json()),
      cachedAwakening   ? Promise.resolve(cachedAwakening)   : fetch('/data/awakening_options.json').then(r => r.json()),
      cachedGems        ? Promise.resolve(cachedGems)        : fetch('/data/gem_bonuses.json').then(r => r.json()),
      cachedJobPrefixes ? Promise.resolve(cachedJobPrefixes) : fetch('/data/job_prefixes.json').then(r => r.json()),
      cachedWeaponCards ? Promise.resolve(cachedWeaponCards) : fetch('/data/weapon_cards.json').then(r => r.json()),
    ])
      .then(([items, effects, ups, awk, gemData, jpData, wcData]) => {
        cachedItems = items;
        cachedSetEffects = effects;
        cachedUpgrades = ups;
        cachedAwakening = awk;
        cachedGems = gemData;
        cachedJobPrefixes = jpData;
        cachedWeaponCards = wcData;
        setData(items);
        setSetEffects(effects);
        setUpgrades(ups);
        setAwakening(awk);
        setGems(gemData);
        setJobPrefixes(jpData);
        setWeaponCards(wcData);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  return { data, setEffects, upgrades, awakening, gems, jobPrefixes, weaponCards, loading, error };
}

// ─── Helper functions ─────────────────────────────────────────────────────────

export function getItemsBySlot(items: FlyffItem[], slot: EquipSlot): FlyffItem[] {
  const slotKeys = Object.entries(SLOT_TO_EQUIPSLOT)
    .filter(([, slots]) => slots.includes(slot))
    .map(([key]) => key);
  return items.filter(item => slotKeys.includes(item.slot));
}

export function getUpgradedATK(item: FlyffItem, level: number): { min: number; max: number } {
  if (level === 0) return { min: item.atkMin, max: item.atkMax };
  const avg = (item.atkMin + item.atkMax) / 2;
  const bonus = avg * level * 0.05;
  const ratio = avg > 0 ? { min: item.atkMin / avg, max: item.atkMax / avg } : { min: 1, max: 1 };
  return {
    min: Math.round(item.atkMin + bonus * ratio.min),
    max: Math.round(item.atkMax + bonus * ratio.max),
  };
}

export function getUpgradedDEF(item: FlyffItem, level: number): { min: number; max: number } {
  if (level === 0) return { min: item.defMin, max: item.defMax };
  const avg = (item.defMin + item.defMax) / 2;
  const bonus = avg * level * 0.05;
  return {
    min: Math.round(item.defMin + bonus),
    max: Math.round(item.defMax + bonus),
  };
}
