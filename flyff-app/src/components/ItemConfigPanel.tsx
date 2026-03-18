import { useState, useMemo } from 'react';
import type {
  EquipSlot,
  EquippedItem,
  FlyffItem,
  AwakenSlot,
  GemSlot,
  AwakeningOption,
  GemBonusDB,
  JobPrefixDB,
  WeaponCardDB,
  UpgradeBonusDB,
  SetEffectsDB,
  EssenceSlot,
} from '../types';
import type { JobData } from '../formulas';
import { getItemsBySlot, getUpgradedATK, getUpgradedDEF } from '../hooks/useItemDatabase';
import { ItemTooltipWrapper } from './ItemTooltip';

const SLOT_LABELS: Record<EquipSlot, string> = {
  weapon: 'Waffe', shield: 'Schild', hat: 'Helm', suit: 'Rüstung',
  glove: 'Handschuhe', boots: 'Stiefel',
  cs_hat: 'CS Helm', cs_suit: 'CS Rüstung', cs_glove: 'CS Handschuhe', cs_boots: 'CS Stiefel',
  cloak: 'Umhang', mask: 'Maske',
  ring1: 'Ring 1', ring2: 'Ring 2', ear1: 'Ohrring 1', ear2: 'Ohrring 2',
  necklace: 'Halskette', talisman1: 'Talisman 1', talisman2: 'Talisman 2',
};

// Maps job IDs → the item.job field strings that job is allowed to use.
// Needed because jobs.json uses different display names than the item database.
const JOB_ITEM_NAMES: Record<string, string[]> = {
  JOB_VAGRANT:             ['Vagrant'],
  JOB_MERCENARY:           ['Mercenary'],
  JOB_ACROBAT:             ['Acrobat'],
  JOB_ASSIST:              ['Assist'],
  JOB_MAGICIAN:            ['Magician'],
  JOB_KNIGHT:              ['Knight'],
  JOB_BLADE:               ['Blade'],
  JOB_JESTER:              ['Jester'],
  JOB_RANGER:              ['Ranger'],
  JOB_RINGMASTER:          ['Ringmaster'],
  JOB_BILLPOSTER:          ['Billposter'],
  JOB_PSYCHIKEEPER:        ['Psykeeper'],
  JOB_ELEMENTOR:           ['Elementor'],
  JOB_KNIGHT_MASTER:       ['Knight (Master)'],
  JOB_BLADE_MASTER:        ['Blade (Master)'],
  JOB_JESTER_MASTER:       ['Jester (Master)'],
  JOB_RANGER_MASTER:       ['Ranger (Master)'],
  JOB_RINGMASTER_MASTER:   ['Ringmaster (Master)'],
  JOB_BILLPOSTER_MASTER:   ['Billposter (Master)'],
  JOB_PSYCHIKEEPER_MASTER: ['Psykeeper (Master)'],
  JOB_ELEMENTOR_MASTER:    ['Elementor (Master)'],
  JOB_KNIGHT_HERO:         ['Knight (Hero)'],
  JOB_BLADE_HERO:          ['Blade (Hero)'],
  JOB_JESTER_HERO:         ['Jester (Hero)'],
  JOB_RANGER_HERO:         ['Ranger (Hero)'],
  JOB_RINGMASTER_HERO:     ['Ringmaster (Hero)'],
  JOB_BILLPOSTER_HERO:     ['Billposter (Hero)'],
  JOB_PSYCHIKEEPER_HERO:   ['Psykeeper (Hero)'],
  JOB_ELEMENTOR_HERO:      ['Elementor (Hero)'],
  // Hero 130-190: same item names as their 121-130 counterpart + unique hero names
  JOB_LORDTEMPLER_HERO:    ['Knight (Hero)', 'Templar'],
  JOB_STORMBLADE_HERO:     ['Blade (Hero)', 'Slayer'],
  JOB_WINDLURKER_HERO:     ['Jester (Hero)', 'Harlequin'],
  JOB_CRACKSHOOTER_HERO:   ['Ranger (Hero)', 'Crackshooter'],
  JOB_FLORIST_HERO:        ['Ringmaster (Hero)', 'Seraph'],
  JOB_FORCEMASTER_HERO:    ['Billposter (Hero)', 'Force Master'],
  JOB_MENTALIST_HERO:      ['Psykeeper (Hero)', 'Mentalist'],
  JOB_ELEMENTORLORD_HERO:  ['Elementor (Hero)', 'Arcanist'],
};

// For Hero jobs that have parent:null in jobs.json, we manually define
// their logical parent so the ancestor chain is complete.
const HERO_FALLBACK_PARENT: Record<string, string> = {
  JOB_KNIGHT_HERO:       'JOB_KNIGHT_MASTER',
  JOB_BLADE_HERO:        'JOB_BLADE_MASTER',
  JOB_JESTER_HERO:       'JOB_JESTER_MASTER',
  JOB_RANGER_HERO:       'JOB_RANGER_MASTER',
  JOB_RINGMASTER_HERO:   'JOB_RINGMASTER_MASTER',
  JOB_BILLPOSTER_HERO:   'JOB_BILLPOSTER_MASTER',
  JOB_PSYCHIKEEPER_HERO: 'JOB_PSYCHIKEEPER_MASTER',
  JOB_ELEMENTOR_HERO:    'JOB_ELEMENTOR_MASTER',
};

// Build set of item.job strings the current job is allowed to use (self + all ancestors)
function buildAncestors(jobId: string, jobs: JobData[]): { names: Set<string>; ids: Set<string> } {
  const names = new Set<string>();
  const ids = new Set<string>();
  const jobMap = new Map(jobs.map(j => [j.id, j]));

  let currentId: string | null | undefined = jobId;
  while (currentId) {
    const current = jobMap.get(currentId);
    if (!current) break;
    ids.add(current.id);
    names.add(current.name);
    // Add the normalized item.job names for this job
    for (const n of (JOB_ITEM_NAMES[current.id] ?? [])) names.add(n);
    // Determine next parent (use fallback for orphaned hero jobs)
    const nextParent = current.parent ?? HERO_FALLBACK_PARENT[current.id] ?? null;
    currentId = nextParent;
  }
  return { names, ids };
}

function itemMatchesJob(item: FlyffItem, ancestors: { names: Set<string>; ids: Set<string> }): boolean {
  if (!item.job) return true;
  return ancestors.names.has(item.job) || ancestors.ids.has(item.job);
}

function itemMatchesGender(item: FlyffItem, gender: 'M' | 'F'): boolean {
  const hasM = item.id.includes('_M_') || item.name.includes('(M)');
  const hasF = item.id.includes('_F_') || item.name.includes('(F)');
  if (hasM && !hasF) return gender === 'M';
  if (hasF && !hasM) return gender === 'F';
  return true; // gender-neutral
}

interface Props {
  slot: EquipSlot;
  equipped: EquippedItem | undefined;
  items: FlyffItem[];
  awakeningOptions: AwakeningOption[];
  gemDB: GemBonusDB | null;
  jobPrefixDB: JobPrefixDB | null;
  weaponCardDB: WeaponCardDB | null;
  upgradeDB: UpgradeBonusDB | null;
  setEffectsDB: SetEffectsDB;
  jobId: string;
  gender: 'M' | 'F';
  jobs: JobData[];
  isDualWield?: boolean;
  equippedWeapon?: FlyffItem;
  onSave: (slot: EquipSlot, equipped: EquippedItem | undefined) => void;
  onClose: () => void;
}

// ── Icon URL helper ──────────────────────────────────────────────────────────
function iconUrl(icon: string): string {
  return `/icons/${icon.toLowerCase().replace(/\.dds$/i, '.png')}`;
}

const GRADE_COLOR: Record<string, string> = {
  Normal:   'text-gray-200',
  Unique:   'text-yellow-400',
  Ultimate: 'text-orange-400',
  Baruna:   'text-purple-400',
};

const GRADE_BADGE: Record<string, string> = {
  Unique:   'bg-yellow-900/30 border-yellow-600/40',
  Ultimate: 'bg-orange-900/30 border-orange-600/40',
  Baruna:   'bg-purple-900/30 border-purple-600/40',
};

const MAX_AWAKEN = 5;
const AWAKEABLE_SLOTS: EquipSlot[] = ['hat', 'suit', 'glove', 'boots', 'weapon', 'shield'];
const MAX_GEMS = 4;

// Weapon/shield card slots (max 10, non-Baruna)
const CARD_SLOTS: EquipSlot[] = ['weapon', 'shield'];
const MAX_CARDS = 10;

// Card rank colors
const RANK_COLORS: Record<string, string> = {
  D:  'text-gray-400',
  C:  'text-green-400',
  B:  'text-blue-400',
  A:  'text-purple-400',
  S:  'text-yellow-400',
  R:  'text-orange-400',
  SR: 'text-red-400',
  N:  'text-gray-300',
};

const RANK_BG: Record<string, string> = {
  D:  'border-gray-600',
  C:  'border-green-700/50',
  B:  'border-blue-700/50',
  A:  'border-purple-700/50',
  S:  'border-yellow-700/50',
  R:  'border-orange-700/50',
  SR: 'border-red-700/60',
  N:  'border-gray-600',
};
const SUIT_GEM_SLOTS: EquipSlot[] = ['hat', 'suit', 'glove', 'boots'];
const COSTUME_GEM_SLOTS: EquipSlot[] = ['cs_hat', 'cs_suit', 'cs_glove', 'cs_boots'];
const BARUNA_ARMOR_SLOTS: EquipSlot[] = ['hat', 'suit', 'glove', 'boots'];
const ULTIMATE_GEM_SLOTS: EquipSlot[] = ['weapon', 'shield'];

export function ItemConfigPanel({
  slot,
  equipped,
  items,
  awakeningOptions,
  gemDB,
  jobPrefixDB,
  weaponCardDB,
  upgradeDB,
  setEffectsDB,
  jobId,
  gender,
  jobs,
  isDualWield,
  equippedWeapon: _equippedWeapon,
  onSave,
  onClose,
}: Props) {
  const slotItems = useMemo(() => {
    // Blade dual-wield: shield slot shows weapons
    if (slot === 'shield' && isDualWield) return getItemsBySlot(items, 'weapon');
    return getItemsBySlot(items, slot);
  }, [items, slot, isDualWield]);
  const ancestors = useMemo(() => buildAncestors(jobId, jobs), [jobId, jobs]);

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(equipped?.itemId ?? '');
  const [upgradeLevel, setUpgradeLevel] = useState(equipped?.upgradeLevel ?? 0);
  const [awakenSlots, setAwakenSlots] = useState<AwakenSlot[]>(
    equipped?.awakenSlots ?? []
  );
  const [gemSlots, setGemSlots] = useState<GemSlot[]>(
    equipped?.gemSlots ?? []
  );
  const [fusedItemId, setFusedItemId]   = useState(equipped?.fusedWeapon?.itemId ?? '');
  const [fusedUpgrade, setFusedUpgrade] = useState(equipped?.fusedWeapon?.upgradeLevel ?? 0);
  const [fusionSearch, setFusionSearch] = useState('');
  const [jobPrefixTier, setJobPrefixTier] = useState<number>(equipped?.jobPrefixTier ?? 0);
  const [cardSlots, setCardSlots] = useState<(string | null)[]>(
    equipped?.cardSlots ?? []
  );
  const [barunaRune, setBarunaRune] = useState<string | null>(
    equipped?.barunaRune ?? null
  );
  const [cardSearch, setCardSearch] = useState('');
  const [evolutionLevel, setEvolutionLevel] = useState<number>(
    equipped?.evolutionLevel ?? 0
  );
  const [essence, setEssence] = useState<EssenceSlot>(
    equipped?.essence ?? { stat: 'STR', grade: 'Common', primaryValue: 1 }
  );
  const [hasEssence, setHasEssence] = useState<boolean>(!!equipped?.essence);

  const selectedItem = useMemo(
    () => slotItems.find(i => i.id === selectedId),
    [slotItems, selectedId]
  );

  const filteredItems = useMemo(() => {
    const q = search.toLowerCase();
    return slotItems
      .filter(i =>
        itemMatchesJob(i, ancestors) &&
        itemMatchesGender(i, gender) &&
        (!q || i.name.toLowerCase().includes(q))
      )
      .sort((a, b) => b.level - a.level);
  }, [slotItems, ancestors, gender, search]);

  const displayedItems = filteredItems.slice(0, 200);

  const ACCESSORY_SLOTS: EquipSlot[] = ['ring1', 'ring2', 'ear1', 'ear2', 'necklace', 'talisman1', 'talisman2'];
  const WEAPON_SLOTS: EquipSlot[] = ['weapon', 'shield'];

  const maxUpgrade = useMemo(() => {
    if (ACCESSORY_SLOTS.includes(slot)) return 20;
    if (selectedItem?.grade === 'Baruna') return 20;
    return 10;
  }, [slot, selectedItem?.grade]);

  // Upgrade preview
  const upgradePreview = useMemo(() => {
    if (!selectedItem || upgradeLevel === 0) return null;
    if (WEAPON_SLOTS.includes(slot) && selectedItem.atkMin > 0) {
      const upd = getUpgradedATK(selectedItem, upgradeLevel);
      return `ATK: ${upd.min}–${upd.max}`;
    }
    if (!WEAPON_SLOTS.includes(slot) && !ACCESSORY_SLOTS.includes(slot) && selectedItem.defMin > 0) {
      const upd = getUpgradedDEF(selectedItem, upgradeLevel);
      return `DEF: ${upd.min}–${upd.max}`;
    }
    if (upgradeDB) {
      const table = upgradeDB[selectedItem.id];
      if (table) {
        const entry = table.find(e => e.level === upgradeLevel);
        return entry ? Object.entries(entry.stats).map(([k, v]) => `${k}: +${v.value}${v.unit}`).join(', ') : null;
      }
    }
    return null;
  }, [selectedItem, upgradeLevel, upgradeDB, slot]);

  // Gem stats available
  const gemStats = useMemo(() => {
    if (!gemDB) return { ultimate: [] as string[], costume: [] as string[] };
    return {
      ultimate: Object.keys(gemDB.ultimate),
      costume: Object.keys(gemDB.costume),
    };
  }, [gemDB]);

  const suitGemStats = useMemo(() => {
    if (!gemDB) return [] as string[];
    const jobKey = jobId.startsWith('JOB_') ? jobId : `JOB_${jobId}`;
    const jobData = gemDB.suit[jobKey] ?? Object.values(gemDB.suit)[0] ?? {};
    return Object.keys(jobData);
  }, [gemDB, jobId]);

  function handleSave() {
    if (!selectedId) {
      onSave(slot, undefined);
      onClose();
      return;
    }
    onSave(slot, {
      itemId: selectedId,
      upgradeLevel,
      awakenSlots: awakenSlots.filter(a => a.stat && a.value !== 0),
      gemSlots: gemSlots.filter(g => g.stat),
      cardSlots: cardSlots.filter(c => c !== null),
      barunaRune: barunaRune ?? undefined,
      fusedWeapon: fusedItemId ? { itemId: fusedItemId, upgradeLevel: fusedUpgrade } : undefined,
      jobPrefixTier: jobPrefixTier > 0 ? jobPrefixTier : undefined,
      evolutionLevel: evolutionLevel > 0 ? evolutionLevel : undefined,
      essence: (slot === 'cloak' && hasEssence) ? essence : undefined,
    });
    onClose();
  }

  function addAwakenSlot() {
    if (awakenSlots.length < MAX_AWAKEN) {
      setAwakenSlots([...awakenSlots, { stat: awakeningOptions[0]?.stat ?? 'DST_STR', value: 1 }]);
    }
  }

  function updateAwakenSlot(idx: number, field: keyof AwakenSlot, val: string | number) {
    setAwakenSlots(prev => prev.map((s, i) => i === idx ? { ...s, [field]: val } : s));
  }

  function removeAwakenSlot(idx: number) {
    setAwakenSlots(prev => prev.filter((_, i) => i !== idx));
  }

  function addGemSlot() {
    if (gemSlots.length < MAX_GEMS) {
      let defaultType: GemSlot['gemType'] = 'ultimate';
      let defaultStat = gemStats.ultimate[0] ?? '';
      if (SUIT_GEM_SLOTS.includes(slot)) {
        defaultType = 'suit';
        defaultStat = suitGemStats[0] ?? '';
      } else if (COSTUME_GEM_SLOTS.includes(slot)) {
        defaultType = 'costume';
        defaultStat = gemStats.costume[0] ?? '';
      }
      setGemSlots([...gemSlots, { gemType: defaultType, stat: defaultStat, tier: 1 }]);
    }
  }

  function updateGemSlot(idx: number, patch: Partial<GemSlot>) {
    setGemSlots(prev => prev.map((g, i) => i === idx ? { ...g, ...patch } : g));
  }

  function removeGemSlot(idx: number) {
    setGemSlots(prev => prev.filter((_, i) => i !== idx));
  }

  function getGemValue(gem: GemSlot): number | null {
    if (!gemDB || !gem.stat) return null;
    const tierIdx = gem.tier - 1;
    let values: number[] | undefined;
    if (gem.gemType === 'ultimate') values = gemDB.ultimate[gem.stat];
    else if (gem.gemType === 'costume') values = gemDB.costume[gem.stat];
    else {
      const jobKey = jobId.startsWith('JOB_') ? jobId : `JOB_${jobId}`;
      values = gemDB.suit[jobKey]?.[gem.stat] ?? Object.values(gemDB.suit)[0]?.[gem.stat];
    }
    if (values && tierIdx >= 0 && tierIdx < values.length) return values[tierIdx];
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/60" onClick={onClose}>
      <div
        className="relative w-96 h-full bg-gray-900 border-l border-gray-700 shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-900 flex-shrink-0">
          <h2 className="text-sm font-bold text-white">{SLOT_LABELS[slot]} konfigurieren</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
          {/* Item search */}
          <div>
            <div className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Item auswählen</div>
            <input
              type="text"
              placeholder="Suchen..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 mb-2"
            />
            {selectedItem && (
              <div className={`flex items-center gap-2 rounded p-2 mb-2 border ${GRADE_BADGE[selectedItem.grade] ?? 'bg-gray-800 border-gray-700'}`}>
                <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center">
                  {selectedItem.icon && (
                    <img
                      src={iconUrl(selectedItem.icon)}
                      alt={selectedItem.name}
                      className="w-full h-full object-contain"
                      style={{ imageRendering: 'pixelated' }}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-semibold truncate ${GRADE_COLOR[selectedItem.grade] ?? 'text-white'}`}>
                    {selectedItem.name}
                  </div>
                  <div className="text-[10px] text-gray-400">
                    Lv.{selectedItem.level}
                    {selectedItem.grade !== 'Normal' && (
                      <span className={`ml-1 ${GRADE_COLOR[selectedItem.grade] ?? ''}`}>· {selectedItem.grade}</span>
                    )}
                    {selectedItem.atkMin > 0 && (
                      <span className="ml-1">· ATK {selectedItem.atkMin}–{selectedItem.atkMax}</span>
                    )}
                    {selectedItem.defMin > 0 && (
                      <span className="ml-1">· DEF {selectedItem.defMin}–{selectedItem.defMax}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => { setSelectedId(''); setUpgradeLevel(0); setAwakenSlots([]); setGemSlots([]); }}
                  className="text-gray-500 hover:text-red-400 text-xs flex-shrink-0"
                >
                  ✕
                </button>
              </div>
            )}
            <div className="max-h-56 overflow-y-auto space-y-0.5 border border-gray-700 rounded">
              {filteredItems.length === 0 && (
                <div className="text-xs text-gray-600 text-center py-4">Keine Items gefunden</div>
              )}
              {displayedItems.map(item => (
                <ItemTooltipWrapper
                  key={item.id}
                  item={item}
                  setEffect={item.setFamily ? setEffectsDB[item.setFamily] : undefined}
                >
                  <button
                    onClick={() => { setSelectedId(item.id); setUpgradeLevel(0); }}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-gray-700 transition-colors ${
                      selectedId === item.id ? 'bg-gray-700/60' : ''
                    }`}
                  >
                    <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
                      {item.icon && (
                        <img
                          src={iconUrl(item.icon)}
                          alt=""
                          className="w-full h-full object-contain"
                          style={{ imageRendering: 'pixelated' }}
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`text-xs truncate ${GRADE_COLOR[item.grade] ?? 'text-white'}`}>
                        {item.name}
                      </div>
                      <div className="text-[10px] text-gray-500 flex flex-wrap gap-x-1.5 gap-y-0">
                        <span>Lv.{item.level}</span>
                        {item.grade !== 'Normal' && (
                          <span className={GRADE_COLOR[item.grade] ?? ''}>{item.grade}</span>
                        )}
                        {item.atkMin > 0 && <span className="text-orange-400/70">ATK {item.atkMin}–{item.atkMax}</span>}
                        {item.defMin > 0 && !item.atkMin && <span className="text-blue-400/70">DEF {item.defMin}–{item.defMax}</span>}
                        {item.isSet && <span className="text-green-500/70">Set</span>}
                        {item.twoHanded && <span className="text-orange-400/70">2H</span>}
                        {Object.entries(item.stats).slice(0, 2).map(([k, v]) => {
                          const label = k.replace('DST_', '').replace(/_RATE$/, '%').replace(/_/g, ' ');
                          return <span key={k} className="text-green-400/60">+{v} {label}</span>;
                        })}
                        {item.soulbound && <span className="text-red-400/60">🔒</span>}
                      </div>
                    </div>
                  </button>
                </ItemTooltipWrapper>
              ))}
              {filteredItems.length > 200 && (
                <div className="text-[10px] text-gray-600 text-center py-2 border-t border-gray-700/40">
                  {filteredItems.length - 200} weitere – Suche verfeinern
                </div>
              )}
            </div>
          </div>

          {/* Upgrade level */}
          {selectedItem && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs text-gray-400 uppercase tracking-wide">Upgrade-Stufe</div>
                <span className="text-sm font-bold text-yellow-400">+{upgradeLevel}</span>
              </div>
              <input
                type="range"
                min={0}
                max={maxUpgrade}
                value={upgradeLevel}
                onChange={e => setUpgradeLevel(Number(e.target.value))}
                className="w-full accent-yellow-400"
              />
              {upgradePreview && (
                <div className="text-xs text-green-400 mt-1">{upgradePreview}</div>
              )}
            </div>
          )}

          {/* ── Fusion (only for 2H weapons in weapon slot) ── */}
          {selectedItem && slot === 'weapon' && selectedItem.twoHanded && (
            <div className="border border-orange-700/40 rounded-lg p-3 bg-orange-900/10">
              <div className="text-xs text-orange-400 uppercase tracking-wide font-semibold mb-2">
                Fusion
              </div>
              <p className="text-[10px] text-gray-500 mb-2">
                Schmelze eine zweite Waffe ein – deren ATK-Wert wird als Bonus addiert.
              </p>

              {/* Fusion item picker */}
              <input
                placeholder="Fusionswaffe suchen…"
                value={fusionSearch}
                onChange={e => setFusionSearch(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 mb-1"
              />
              {fusedItemId ? (
                <div className="flex items-center gap-2 bg-gray-800 rounded p-2 mb-1">
                  {(() => {
                    const fi = items.find(i => i.id === fusedItemId);
                    return fi ? (
                      <>
                        {fi.icon && (
                          <img src={`/icons/${fi.icon.toLowerCase().replace(/\.dds$/i, '.png')}`} alt=""
                            className="w-7 h-7 object-contain" style={{ imageRendering: 'pixelated' }}
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-orange-300 truncate">{fi.name}</div>
                          <div className="text-[10px] text-gray-500">ATK {fi.atkMin}–{fi.atkMax}</div>
                        </div>
                        <button onClick={() => { setFusedItemId(''); setFusedUpgrade(0); }}
                          className="text-gray-500 hover:text-red-400 text-sm">×</button>
                      </>
                    ) : null;
                  })()}
                </div>
              ) : null}

              {fusionSearch && (
                <div className="max-h-28 overflow-y-auto border border-gray-700 rounded mb-2">
                  {items
                    .filter(i => i.atkMin > 0 && i.name.toLowerCase().includes(fusionSearch.toLowerCase()))
                    .slice(0, 30)
                    .map(i => (
                      <button key={i.id}
                        onClick={() => { setFusedItemId(i.id); setFusionSearch(''); }}
                        className="w-full flex items-center gap-2 px-2 py-1 text-left hover:bg-gray-700 text-xs text-gray-300"
                      >
                        {i.icon && (
                          <img src={`/icons/${i.icon.toLowerCase().replace(/\.dds$/i, '.png')}`} alt=""
                            className="w-6 h-6 object-contain shrink-0" style={{ imageRendering: 'pixelated' }}
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        )}
                        <span className="truncate">{i.name}</span>
                        <span className="text-gray-600 shrink-0">ATK {i.atkMin}–{i.atkMax}</span>
                      </button>
                    ))
                  }
                </div>
              )}

              {fusedItemId && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-gray-500 shrink-0">Upgrade</span>
                  <input type="range" min={0} max={20} value={fusedUpgrade}
                    onChange={e => setFusedUpgrade(Number(e.target.value))}
                    className="flex-1 accent-orange-500" />
                  <span className="text-xs text-yellow-400 w-7 text-right">+{fusedUpgrade}</span>
                </div>
              )}

              {fusedItemId && (() => {
                const fi = items.find(i => i.id === fusedItemId);
                if (!fi) return null;
                const bonus = Math.round((fi.atkMin + fi.atkMax) / 2 * (1 + fusedUpgrade * 0.05));
                return (
                  <div className="text-[10px] text-orange-300 mt-1">
                    Fusion-Bonus: ~+{bonus} ATK
                  </div>
                );
              })()}
            </div>
          )}

          {/* Awakening slots */}
          {selectedItem && AWAKEABLE_SLOTS.includes(slot) && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-gray-400 uppercase tracking-wide">Erweckungs-Slots</div>
                {awakenSlots.length < MAX_AWAKEN && (
                  <button
                    onClick={addAwakenSlot}
                    className="text-xs text-purple-400 hover:text-purple-300 border border-purple-700/40 rounded px-2 py-0.5"
                  >
                    + Slot
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {awakenSlots.map((slot_, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-gray-800 rounded p-2">
                    <select
                      value={slot_.stat}
                      onChange={e => updateAwakenSlot(idx, 'stat', e.target.value)}
                      className="flex-1 bg-gray-700 border border-gray-600 rounded text-xs text-white px-1 py-1 focus:outline-none"
                    >
                      {awakeningOptions.map(opt => (
                        <option key={opt.stat} value={opt.stat}>
                          {opt.label} ({opt.unit || 'flat'})
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={slot_.value}
                      onChange={e => updateAwakenSlot(idx, 'value', Number(e.target.value))}
                      className="w-16 bg-gray-700 border border-gray-600 rounded text-xs text-white text-center px-1 py-1 focus:outline-none"
                    />
                    <button
                      onClick={() => removeAwakenSlot(idx)}
                      className="text-gray-500 hover:text-red-400 text-sm"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {awakenSlots.length === 0 && (
                  <div className="text-xs text-gray-600 text-center py-2">Kein Erweckungs-Slot</div>
                )}
              </div>
            </div>
          )}

          {/* ── Ultimate Gems (only for weapon/shield slots with Ultimate/Baruna grade) ── */}
          {selectedItem && ULTIMATE_GEM_SLOTS.includes(slot) &&
           (selectedItem.grade === 'Ultimate' || selectedItem.grade === 'Baruna') && (
            <div className="border border-orange-700/30 rounded-lg p-3 bg-orange-900/5">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-orange-400 uppercase tracking-wide font-semibold">
                  Ultimate Gems (Sockel)
                </div>
                {gemSlots.length < MAX_GEMS && (
                  <button onClick={addGemSlot}
                    className="text-xs text-orange-400 hover:text-orange-300 border border-orange-700/40 rounded px-2 py-0.5">
                    + Gem
                  </button>
                )}
              </div>
              <p className="text-[10px] text-gray-500 mb-2">Max 4 Sockel · Ultimate &amp; Baruna Waffen</p>
              <div className="space-y-2">
                {gemSlots.map((gem, idx) => {
                  const statList = gemStats.ultimate;
                  const gemValue = getGemValue(gem);
                  const maxTiers = gemDB?.ultimate[gem.stat]?.length ?? 5;
                  return (
                    <div key={idx} className="bg-gray-800 rounded p-2 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <select value={gem.stat} onChange={e => updateGemSlot(idx, { stat: e.target.value })}
                          className="flex-1 bg-gray-700 border border-gray-600 rounded text-xs text-white px-1 py-1 focus:outline-none">
                          {statList.map(s => (
                            <option key={s} value={s}>{s.replace('DST_', '').replace(/_/g, ' ')}</option>
                          ))}
                        </select>
                        <button onClick={() => removeGemSlot(idx)} className="text-gray-500 hover:text-red-400 text-sm">×</button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-gray-500">Anzahl:</span>
                        {Array.from({ length: maxTiers }, (_, i) => i + 1).map(t => (
                          <button key={t} onClick={() => updateGemSlot(idx, { tier: t })}
                            className={`w-6 h-6 rounded text-[10px] font-bold transition-colors ${gem.tier === t ? 'bg-orange-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>
                            {t}
                          </button>
                        ))}
                        {gemValue !== null && (
                          <span className="text-xs text-orange-300 ml-1">+{gemValue}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {gemSlots.length === 0 && (
                  <div className="text-xs text-gray-600 text-center py-2">Kein Gem eingesetzt</div>
                )}
              </div>
            </div>
          )}

          {/* ── Suit Piercing (normal armor: hat/suit/glove/boots) ── */}
          {selectedItem && SUIT_GEM_SLOTS.includes(slot) && (
            <div className="border border-blue-700/30 rounded-lg p-3 bg-blue-900/5">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-blue-400 uppercase tracking-wide font-semibold">
                  Piercing Sockel
                </div>
                {gemSlots.length < MAX_GEMS && (
                  <button onClick={addGemSlot}
                    className="text-xs text-blue-400 hover:text-blue-300 border border-blue-700/40 rounded px-2 py-0.5">
                    + Sockel
                  </button>
                )}
              </div>
              <p className="text-[10px] text-gray-500 mb-2">
                Max 4 Sockel ·{' '}
                {selectedItem.grade === 'Baruna' ? 'Baruna: bis +18% pro Sockel' : 'Normal: bis +12% pro Sockel'}
              </p>
              <div className="space-y-2">
                {gemSlots.map((gem, idx) => {
                  const statList = suitGemStats;
                  const gemValue = getGemValue(gem);
                  const maxTiers = 4;
                  return (
                    <div key={idx} className="bg-gray-800 rounded p-2 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <select value={gem.stat} onChange={e => updateGemSlot(idx, { stat: e.target.value })}
                          className="flex-1 bg-gray-700 border border-gray-600 rounded text-xs text-white px-1 py-1 focus:outline-none">
                          {statList.map(s => (
                            <option key={s} value={s}>{s.replace('DST_', '').replace(/_/g, ' ')}</option>
                          ))}
                        </select>
                        <button onClick={() => removeGemSlot(idx)} className="text-gray-500 hover:text-red-400 text-sm">×</button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-gray-500">Tier:</span>
                        {Array.from({ length: maxTiers }, (_, i) => i + 1).map(t => (
                          <button key={t} onClick={() => updateGemSlot(idx, { tier: t })}
                            className={`w-6 h-6 rounded text-[10px] font-bold transition-colors ${gem.tier === t ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>
                            {t}
                          </button>
                        ))}
                        {gemValue !== null && (
                          <span className="text-xs text-green-400 ml-1">+{gemValue}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {gemSlots.length === 0 && (
                  <div className="text-xs text-gray-600 text-center py-2">Kein Piercing eingesetzt</div>
                )}
              </div>
            </div>
          )}

          {/* ── Costume Gems (only for CS slots) ── */}
          {selectedItem && COSTUME_GEM_SLOTS.includes(slot) && (
            <div className="border border-pink-700/30 rounded-lg p-3 bg-pink-900/5">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-pink-400 uppercase tracking-wide font-semibold">
                  Costume Gems
                </div>
                {gemSlots.length < MAX_GEMS && (
                  <button onClick={addGemSlot}
                    className="text-xs text-pink-400 hover:text-pink-300 border border-pink-700/40 rounded px-2 py-0.5">
                    + Gem
                  </button>
                )}
              </div>
              <p className="text-[10px] text-gray-500 mb-2">Max 4 Sockel · Nur für CS Rüstungsteile</p>
              <div className="space-y-2">
                {gemSlots.map((gem, idx) => {
                  const statList = gemStats.costume;
                  const gemValue = getGemValue(gem);
                  const maxTiers = gemDB?.costume[gem.stat]?.length ?? 4;
                  return (
                    <div key={idx} className="bg-gray-800 rounded p-2 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <select value={gem.stat} onChange={e => updateGemSlot(idx, { stat: e.target.value })}
                          className="flex-1 bg-gray-700 border border-gray-600 rounded text-xs text-white px-1 py-1 focus:outline-none">
                          {statList.map(s => (
                            <option key={s} value={s}>{s.replace('DST_', '').replace(/_/g, ' ')}</option>
                          ))}
                        </select>
                        <button onClick={() => removeGemSlot(idx)} className="text-gray-500 hover:text-red-400 text-sm">×</button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-gray-500">Tier:</span>
                        {Array.from({ length: maxTiers }, (_, i) => i + 1).map(t => (
                          <button key={t} onClick={() => updateGemSlot(idx, { tier: t })}
                            className={`w-6 h-6 rounded text-[10px] font-bold transition-colors ${gem.tier === t ? 'bg-pink-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>
                            {t}
                          </button>
                        ))}
                        {gemValue !== null && (
                          <span className="text-xs text-pink-300 ml-1">+{gemValue}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {gemSlots.length === 0 && (
                  <div className="text-xs text-gray-600 text-center py-2">Kein Costume Gem eingesetzt</div>
                )}
              </div>
            </div>
          )}

          {/* ── Baruna Job Prefix (only for Baruna armor) ── */}
          {selectedItem && BARUNA_ARMOR_SLOTS.includes(slot) && selectedItem.grade === 'Baruna' && jobPrefixDB && (() => {
            const jobKey = jobId.startsWith('JOB_') ? jobId : `JOB_${jobId}`;
            const prefix = jobPrefixDB[jobKey];
            if (!prefix) return null;
            return (
              <div className="border border-purple-700/40 rounded-lg p-3 bg-purple-900/10">
                <div className="text-xs text-purple-400 uppercase tracking-wide font-semibold mb-2">
                  Baruna Job-Prefix: {prefix.label}
                </div>
                <p className="text-[10px] text-gray-500 mb-2">
                  Klassen-spezifische Verstärkung für Baruna Rüstungen (0–4 Stufen)
                </p>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] text-gray-400">Stufe:</span>
                  {[0, 1, 2, 3, 4].map(t => (
                    <button key={t} onClick={() => setJobPrefixTier(t)}
                      className={`w-7 h-7 rounded text-xs font-bold transition-colors ${jobPrefixTier === t ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>
                      {t === 0 ? '–' : t}
                    </button>
                  ))}
                </div>
                {jobPrefixTier > 0 && (
                  <div className="space-y-1">
                    {prefix.stats.map(s => (
                      <div key={s.stat} className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">{s.stat.replace('DST_', '').replace(/_/g, ' ')}</span>
                        <span className="text-purple-300">+{s.valuePerTier * jobPrefixTier}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── Weapon Card Sockets (non-Baruna weapon/shield, max 10) ── */}
          {selectedItem && CARD_SLOTS.includes(slot) && selectedItem.grade !== 'Baruna' && weaponCardDB && (
            <div className="border border-green-700/30 rounded-lg p-3 bg-green-900/5">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-green-400 uppercase tracking-wide font-semibold">
                  Karten-Sockel ({cardSlots.filter(Boolean).length}/{MAX_CARDS})
                </div>
                {cardSlots.length < MAX_CARDS && (
                  <button
                    onClick={() => setCardSlots(prev => [...prev, null])}
                    className="text-xs text-green-400 hover:text-green-300 border border-green-700/40 rounded px-2 py-0.5"
                  >
                    + Sockel
                  </button>
                )}
              </div>
              <p className="text-[10px] text-gray-500 mb-2">Waffen &amp; Schilde · max 10 Karten · Rang D bis SR</p>

              {/* Card search */}
              {cardSlots.length > 0 && (
                <input
                  value={cardSearch}
                  onChange={e => setCardSearch(e.target.value)}
                  placeholder="Karte suchen..."
                  className="w-full bg-gray-800 border border-gray-600 rounded text-xs text-white px-2 py-1 mb-2 focus:outline-none focus:border-green-500"
                />
              )}

              <div className="space-y-1.5">
                {cardSlots.map((cardId, idx) => {
                  const allCards = weaponCardDB.cards;
                  const filtered = cardSearch
                    ? allCards.filter(c =>
                        c.name.toLowerCase().includes(cardSearch.toLowerCase()) ||
                        c.rank.toLowerCase().includes(cardSearch.toLowerCase()) ||
                        c.group.toLowerCase().includes(cardSearch.toLowerCase()) ||
                        Object.keys(c.stats).some(s => s.toLowerCase().includes(cardSearch.toLowerCase()))
                      )
                    : allCards;
                  const selected = cardId ? allCards.find(c => c.id === cardId) : null;
                  return (
                    <div key={idx} className={`bg-gray-800 border rounded p-2 ${selected ? RANK_BG[selected.rank] ?? 'border-gray-600' : 'border-gray-700'}`}>
                      <div className="flex items-center gap-2">
                        <select
                          value={cardId ?? ''}
                          onChange={e => {
                            const updated = [...cardSlots];
                            updated[idx] = e.target.value || null;
                            setCardSlots(updated);
                          }}
                          className="flex-1 bg-gray-700 border border-gray-600 rounded text-xs text-white px-1 py-1 focus:outline-none"
                        >
                          <option value="">– Leer –</option>
                          {filtered.map(c => (
                            <option key={c.id} value={c.id}>
                              [{c.rank}] {c.name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => setCardSlots(prev => prev.filter((_, i) => i !== idx))}
                          className="text-gray-500 hover:text-red-400 text-sm shrink-0"
                        >×</button>
                      </div>
                      {selected && (
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                          {Object.entries(selected.stats).map(([dst, val]) => (
                            <span key={dst} className={`text-[10px] font-medium ${RANK_COLORS[selected.rank]}`}>
                              {dst.replace('DST_', '').replace(/_/g, ' ')} +{val}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {cardSlots.length === 0 && (
                  <div className="text-xs text-gray-600 text-center py-2">Keine Karten gesockelt</div>
                )}
              </div>
            </div>
          )}

          {/* ── Baruna Weapon Rune (max 1) ── */}
          {selectedItem && CARD_SLOTS.includes(slot) && selectedItem.grade === 'Baruna' && weaponCardDB && (
            <div className="border border-cyan-700/40 rounded-lg p-3 bg-cyan-900/5">
              <div className="text-xs text-cyan-400 uppercase tracking-wide font-semibold mb-2">
                Baruna Rune (max 1)
              </div>
              <p className="text-[10px] text-gray-500 mb-3">
                Baruna Waffen können nicht mit Karten gesockelt werden. Stattdessen eine einzige mächtige Rune.
              </p>
              <div className="space-y-2">
                {weaponCardDB.baruna_runes.map(rune => {
                  const isSelected = barunaRune === rune.id;
                  return (
                    <button
                      key={rune.id}
                      onClick={() => setBarunaRune(isSelected ? null : rune.id)}
                      className={`w-full text-left rounded p-2.5 border transition-colors ${
                        isSelected
                          ? 'bg-cyan-900/40 border-cyan-500 text-cyan-200'
                          : 'bg-gray-800 border-gray-700 hover:border-cyan-700/50 text-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">{rune.name}</span>
                        {isSelected && <span className="text-[10px] text-cyan-400">✓ Aktiv</span>}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                        {Object.entries(rune.stats).map(([dst, val]) => (
                          <span key={dst} className="text-[10px] text-cyan-300">
                            {dst.replace('DST_', '').replace(/_/g, ' ')} +{val}
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })}
                {barunaRune && (
                  <button
                    onClick={() => setBarunaRune(null)}
                    className="text-xs text-gray-500 hover:text-red-400 w-full text-center py-1"
                  >
                    Rune entfernen
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Baruna Evolution Level ── */}
          {selectedItem?.grade === 'Baruna' && (
            <div className="border border-purple-700/40 rounded-lg p-3 bg-purple-900/5">
              <div className="text-xs text-purple-400 uppercase tracking-wide font-semibold mb-1">
                Baruna Evolution
              </div>
              <p className="text-[10px] text-gray-500 mb-3">
                Stufe 1: +1% · Stufe 2: +3% · Stufe 3: +6% · Stufe 4: +10% · Stufe 5: +20% ATK/DEF
              </p>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-24">Evolutions-Stufe</span>
                <input
                  type="range" min={0} max={5} value={evolutionLevel}
                  onChange={e => setEvolutionLevel(Number(e.target.value))}
                  className="flex-1 accent-purple-500"
                />
                <span className={`text-sm font-bold w-8 text-center ${evolutionLevel > 0 ? 'text-purple-400' : 'text-gray-600'}`}>
                  +{evolutionLevel}
                </span>
              </div>
              {evolutionLevel > 0 && (
                <div className="mt-2 text-[10px] text-purple-300 bg-purple-900/20 rounded p-2">
                  {(() => {
                    const EVOLUTION_BASE_PCT = [0, 1, 3, 6, 10, 20];
                    const basePct = EVOLUTION_BASE_PCT[evolutionLevel] ?? 0;
                    const indivPct = evolutionLevel >= 2 && evolutionLevel <= 4 ? evolutionLevel - 1 : 0;
                    const slotBonuses: Record<string, string> = {
                      weapon: `ATK +${basePct + indivPct}%`,
                      hat: `DEF +${basePct}%, HP +${indivPct}%`,
                      suit: `DEF +${basePct + indivPct}%`,
                      glove: `DEF +${basePct}%, PvE-Schaden +${indivPct}%`,
                      boots: `DEF +${basePct}%, PvP-Schaden +${indivPct}%`,
                      shield: `DEF +${basePct}%, EXP +${indivPct}%`,
                    };
                    return slotBonuses[slot] ?? `Basis ATK/DEF +${basePct}%`;
                  })()}
                </div>
              )}
            </div>
          )}

          {/* ── Cloak Essence (Forgotten Flaris system) ── */}
          {slot === 'cloak' && selectedItem && (
            <div className="border border-teal-700/40 rounded-lg p-3 bg-teal-900/5">
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs text-teal-400 uppercase tracking-wide font-semibold">
                  Essence (Vergessenes Flaris)
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasEssence}
                    onChange={e => setHasEssence(e.target.checked)}
                    className="accent-teal-500"
                  />
                  <span className="text-xs text-gray-400">Aktiv</span>
                </label>
              </div>
              {hasEssence && (
                <div className="space-y-2 mt-2">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] text-gray-500 block mb-0.5">Primär-Stat</label>
                      <select
                        value={essence.stat}
                        onChange={e => setEssence(p => ({ ...p, stat: e.target.value as EssenceSlot['stat'] }))}
                        className="w-full bg-gray-800 border border-gray-600 rounded text-xs text-white px-2 py-1 focus:outline-none focus:border-teal-500"
                      >
                        {(['STR', 'STA', 'DEX', 'INT', 'All'] as const).map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-gray-500 block mb-0.5">Grad</label>
                      <select
                        value={essence.grade}
                        onChange={e => setEssence(p => ({ ...p, grade: e.target.value as EssenceSlot['grade'] }))}
                        className="w-full bg-gray-800 border border-gray-600 rounded text-xs text-white px-2 py-1 focus:outline-none focus:border-teal-500"
                      >
                        <option value="Common">Common (+1–5)</option>
                        <option value="Uncommon">Uncommon (+5–10)</option>
                        <option value="Rare">Rare (+10–15)</option>
                        <option value="Hero">Hero (+15–25)</option>
                        <option value="Legendary">Legendary (+25–35)</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-0.5">
                      Primär-Wert ({essence.stat === 'All' ? 'alle Stats' : essence.stat})
                    </label>
                    <input
                      type="number" min={1} max={50}
                      value={essence.primaryValue}
                      onChange={e => setEssence(p => ({ ...p, primaryValue: Number(e.target.value) }))}
                      className="w-full bg-gray-800 border border-gray-600 rounded text-xs text-white px-2 py-1 focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] text-gray-500 block mb-0.5">Sekundär-Stat (Erweckt)</label>
                      <input
                        type="text"
                        value={essence.awakenStat ?? ''}
                        onChange={e => setEssence(p => ({ ...p, awakenStat: e.target.value || undefined }))}
                        placeholder="z.B. DST_CRITICAL_BONUS"
                        className="w-full bg-gray-800 border border-gray-600 rounded text-xs text-white px-2 py-1 focus:outline-none focus:border-teal-500"
                      />
                    </div>
                    <div className="w-20">
                      <label className="text-[10px] text-gray-500 block mb-0.5">Wert</label>
                      <input
                        type="number"
                        value={essence.awakenValue ?? ''}
                        onChange={e => setEssence(p => ({ ...p, awakenValue: e.target.value ? Number(e.target.value) : undefined }))}
                        className="w-full bg-gray-800 border border-gray-600 rounded text-xs text-white px-2 py-1 focus:outline-none focus:border-teal-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer – always visible at bottom */}
        <div className="bg-gray-900 border-t border-gray-700 p-4 flex gap-2 flex-shrink-0">
          <button
            onClick={handleSave}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded py-2 transition-colors"
          >
            Speichern
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded py-2 transition-colors"
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}
