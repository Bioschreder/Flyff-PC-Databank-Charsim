import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Search, X, ChevronDown, ArrowUpDown, ChevronRight, Sword, Shield, Star, Package, Sparkles } from 'lucide-react';
import { useItemDatabase } from '../hooks/useItemDatabase';
import { ItemCard } from './ItemCard';
import { SetEffectPanel } from './SetEffectPanel';
import { UpgradeBonusPanel } from './UpgradeBonusPanel';
import type { FlyffItem, SortKey, SetEffectsDB, UpgradeBonusDB } from '../types';

const PAGE_SIZE = 50;

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'level_asc',  label: 'Level ↑' },
  { value: 'level_desc', label: 'Level ↓' },
  { value: 'name_asc',   label: 'Name A–Z' },
  { value: 'grade_asc',  label: 'Grade ↑' },
  { value: 'grade_desc', label: 'Grade ↓' },
];

const GRADE_ORDER: Record<string, number> = {
  Normal: 0, Rare: 1, Unique: 2, Ultimate: 3, Baruna: 4,
};

// ─── Super-Category System ───────────────────────────────────────────────────

type SuperCatId = 'equipment' | 'costumes' | 'powerups' | 'materials' | 'misc';

interface SubCategory {
  label: string;
  filter: (item: FlyffItem) => boolean;
}

interface SuperCategory {
  id: SuperCatId;
  label: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  filter: (item: FlyffItem) => boolean;
  subCategories: SubCategory[];
}

const SUPER_CATEGORIES: SuperCategory[] = [
  {
    id: 'equipment',
    label: 'Waffen & Equipment',
    Icon: Sword,
    filter: (item) =>
      item.category === 'Weapon' ||
      (item.category === 'Armor' && (item.subcategory === 'Armor Set' || item.subcategory === 'Armor')) ||
      (item.category === 'General' && item.subcategory === 'Jewelry'),
    subCategories: [
      {
        label: 'Waffen',
        filter: (item) =>
          item.category === 'Weapon' && !item.id.startsWith('II_WEA_MOB_'),
      },
      {
        label: 'Rüstungen',
        filter: (item) =>
          item.category === 'Armor' && item.subcategory === 'Armor Set',
      },
      {
        label: 'Schilde',
        filter: (item) =>
          item.category === 'Armor' && item.subcategory === 'Armor',
      },
      {
        label: 'Schmuck & Talismane',
        filter: (item) =>
          item.category === 'General' && item.subcategory === 'Jewelry',
      },
    ],
  },
  {
    id: 'costumes',
    label: 'Kostüme & Fashion',
    Icon: Sparkles,
    filter: (item) =>
      (item.category === 'Armor' && (item.subcategory === 'Costume' || item.subcategory === 'Costume Accessory')) ||
      item.category === 'Mount',
    subCategories: [
      {
        label: 'CS Rüstung',
        filter: (item) =>
          item.category === 'Armor' && item.subcategory === 'Costume Accessory',
      },
      {
        label: 'CS Accessoires',
        filter: (item) =>
          item.category === 'Armor' && item.subcategory === 'Costume',
      },
      {
        label: 'Reittiere & Flügel',
        filter: (item) => item.category === 'Mount',
      },
    ],
  },
  {
    id: 'powerups',
    label: 'Powerups & Verbrauch',
    Icon: Star,
    filter: (item) =>
      item.subcategory === 'Buff Scroll' ||
      item.subcategory === 'Food' ||
      item.subcategory === 'Potion' ||
      item.subcategory === 'Refresher' ||
      (item.category === 'Consumable' && item.subcategory === 'Consumable') ||
      (item.category === 'Consumable' && item.subcategory === 'Scroll'),
    subCategories: [
      {
        label: 'Buff Scrolls',
        filter: (item) => item.subcategory === 'Buff Scroll',
      },
      {
        label: 'Essen & Food',
        filter: (item) => item.subcategory === 'Food',
      },
      {
        label: 'Tränke',
        filter: (item) => item.subcategory === 'Potion',
      },
      {
        label: 'Refresher',
        filter: (item) => item.subcategory === 'Refresher',
      },
      {
        label: 'Scrolls & Sonstiges',
        filter: (item) =>
          (item.category === 'Consumable' && (item.subcategory === 'Consumable' || item.subcategory === 'Scroll')),
      },
    ],
  },
  {
    id: 'materials',
    label: 'Materialien & Upgrade',
    Icon: Package,
    filter: (item) =>
      item.category === 'General' &&
      ['Gem', 'Material', 'Bullet', 'Charm', 'Skill Item', 'Tools'].includes(item.subcategory),
    subCategories: [
      {
        label: 'Edelsteine & Sockel',
        filter: (item) => item.subcategory === 'Gem',
      },
      {
        label: 'Materialien',
        filter: (item) => item.subcategory === 'Material',
      },
      {
        label: 'Werkzeuge',
        filter: (item) => item.subcategory === 'Tools',
      },
      {
        label: 'Karten & Talismane',
        filter: (item) => item.subcategory === 'Charm' || item.subcategory === 'Skill Item',
      },
      {
        label: 'Munition',
        filter: (item) => item.subcategory === 'Bullet',
      },
    ],
  },
  {
    id: 'misc',
    label: 'Sonstiges',
    Icon: Shield,
    filter: (item) =>
      (item.category === 'Consumable' && ['Magic Item', 'Blink Wing'].includes(item.subcategory)) ||
      (item.category === 'General' && ['Warp Scroll', 'General', 'Magic Item', 'Melee'].includes(item.subcategory)),
    subCategories: [
      {
        label: 'Warp & Teleport',
        filter: (item) => item.subcategory === 'Warp Scroll',
      },
      {
        label: 'Feuerwerk & Events',
        filter: (item) => item.subcategory === 'Magic Item',
      },
      {
        label: 'Rückkehr-Flügel',
        filter: (item) => item.subcategory === 'Blink Wing',
      },
      {
        label: 'Sonstiges',
        filter: (item) =>
          (item.category === 'General' && ['General', 'Melee'].includes(item.subcategory)),
      },
    ],
  },
];

// ─── Filter State ─────────────────────────────────────────────────────────────

interface FilterState {
  search: string;
  superCat: SuperCatId | '';
  subCat: string;
  job: string;
  grade: string;
  minLevel: number;
  maxLevel: number;
  sort: SortKey;
}

function sortItems(items: FlyffItem[], sort: SortKey): FlyffItem[] {
  return [...items].sort((a, b) => {
    switch (sort) {
      case 'level_asc':  return a.level - b.level || a.name.localeCompare(b.name);
      case 'level_desc': return b.level - a.level || a.name.localeCompare(b.name);
      case 'name_asc':   return a.name.localeCompare(b.name);
      case 'grade_asc':  return (GRADE_ORDER[a.grade] ?? 0) - (GRADE_ORDER[b.grade] ?? 0) || a.level - b.level;
      case 'grade_desc': return (GRADE_ORDER[b.grade] ?? 0) - (GRADE_ORDER[a.grade] ?? 0) || a.level - b.level;
      default:           return 0;
    }
  });
}

interface Props {
  compareList: FlyffItem[];
  onAddToCompare: (item: FlyffItem) => void;
  onRemoveFromCompare: (item: FlyffItem) => void;
  onSwitchToCompare: () => void;
}

export function ItemManager({ compareList, onAddToCompare, onRemoveFromCompare, onSwitchToCompare }: Props) {
  const { data, setEffects, upgrades, loading, error } = useItemDatabase();
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    superCat: '',
    subCat: '',
    job: '',
    grade: '',
    minLevel: 0,
    maxLevel: 300,
    sort: 'level_asc',
  });
  const [expandedCats, setExpandedCats] = useState<Record<SuperCatId, boolean>>({
    equipment: false, costumes: false, powerups: false, materials: false, misc: false,
  });
  const [page, setPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<FlyffItem | null>(null);

  const setFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters(f => ({ ...f, [key]: value }));
    setPage(1);
  }, []);

  const selectSuperCat = (id: SuperCatId | '') => {
    setFilters(f => ({ ...f, superCat: id, subCat: '' }));
    if (id) {
      setExpandedCats(prev => ({ ...prev, [id]: true }));
    }
    setPage(1);
  };

  const selectSubCat = (label: string) => {
    setFilters(f => ({ ...f, subCat: f.subCat === label ? '' : label }));
    setPage(1);
  };

  // Compute item counts for each super/sub category
  const allItems = useMemo(() => data?.items ?? [], [data]);

  const counts = useMemo(() => {
    const result: Record<string, number> = { '': allItems.length };
    for (const sc of SUPER_CATEGORIES) {
      const scItems = allItems.filter(sc.filter);
      result[sc.id] = scItems.length;
      for (const sub of sc.subCategories) {
        result[`${sc.id}::${sub.label}`] = scItems.filter(sub.filter).length;
      }
    }
    return result;
  }, [allItems]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let items = data.items;

    // Super category
    if (filters.superCat) {
      const sc = SUPER_CATEGORIES.find(c => c.id === filters.superCat);
      if (sc) items = items.filter(sc.filter);

      // Sub category
      if (filters.subCat) {
        const sub = sc?.subCategories.find(s => s.label === filters.subCat);
        if (sub) items = items.filter(sub.filter);
      }
    }

    const q = filters.search.toLowerCase().trim();
    if (q) items = items.filter(i => i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q));
    if (filters.job)   items = items.filter(i => i.job === filters.job);
    if (filters.grade) items = items.filter(i => i.grade === filters.grade);
    items = items.filter(i => i.level >= filters.minLevel && i.level <= filters.maxLevel);

    return sortItems(items, filters.sort);
  }, [data, filters]);

  const paged = useMemo(() => filtered.slice(0, page * PAGE_SIZE), [filtered, page]);
  const hasMore = paged.length < filtered.length;
  const compareIds = useMemo(() => new Set(compareList.map(i => i.id)), [compareList]);

  const hasActiveFilters = !!(filters.search || filters.superCat || filters.subCat || filters.job || filters.grade || filters.minLevel > 0 || filters.maxLevel < 300);

  const clearFilters = () => {
    setFilters({ search: '', superCat: '', subCat: '', job: '', grade: '', minLevel: 0, maxLevel: 300, sort: 'level_asc' });
    setPage(1);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <div className="text-gray-400">Loading Flyff database...</div>
      </div>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center h-64 text-red-400">
      Error loading database: {error}
    </div>
  );

  return (
    <div className="flex h-full gap-4">
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="w-60 flex-shrink-0 flex flex-col gap-3 overflow-y-auto">

        {/* Category Navigation Tree */}
        <nav className="bg-gray-800 rounded-lg overflow-hidden">
          <div className="px-3 py-2 flex items-center justify-between border-b border-gray-700/50">
            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Kategorien</span>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                <X size={11} /> Reset
              </button>
            )}
          </div>

          {/* All Items */}
          <button
            onClick={() => selectSuperCat('')}
            className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
              !filters.superCat
                ? 'bg-blue-600/20 text-blue-300 font-medium'
                : 'text-gray-300 hover:bg-gray-700/50'
            }`}
          >
            <span>Alle Items</span>
            <span className="text-xs text-gray-500">{(counts[''] ?? 0).toLocaleString()}</span>
          </button>

          {/* Super Categories */}
          {SUPER_CATEGORIES.map(sc => {
            const isActive = filters.superCat === sc.id;
            const isExpanded = expandedCats[sc.id];

            return (
              <div key={sc.id} className="border-t border-gray-700/30">
                {/* Super Cat Header */}
                <button
                  onClick={() => {
                    if (isActive) {
                      setExpandedCats(prev => ({ ...prev, [sc.id]: !prev[sc.id] }));
                    } else {
                      selectSuperCat(sc.id);
                    }
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors ${
                    isActive
                      ? 'bg-blue-600/20 text-blue-300 font-medium'
                      : 'text-gray-300 hover:bg-gray-700/50'
                  }`}
                >
                  <sc.Icon size={14} className={isActive ? 'text-blue-400' : 'text-gray-500'} />
                  <span className="flex-1 text-left text-xs font-medium">{sc.label}</span>
                  <span className="text-xs text-gray-500 mr-1">{(counts[sc.id] ?? 0).toLocaleString()}</span>
                  <ChevronRight
                    size={12}
                    className={`text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedCats(prev => ({ ...prev, [sc.id]: !prev[sc.id] }));
                    }}
                  />
                </button>

                {/* Sub Categories */}
                {isExpanded && (
                  <div className="bg-gray-900/40">
                    {sc.subCategories.map(sub => {
                      const subActive = isActive && filters.subCat === sub.label;
                      const subCount = counts[`${sc.id}::${sub.label}`] ?? 0;
                      if (subCount === 0) return null;
                      return (
                        <button
                          key={sub.label}
                          onClick={() => {
                            if (!isActive) selectSuperCat(sc.id);
                            selectSubCat(sub.label);
                          }}
                          className={`w-full flex items-center justify-between pl-8 pr-3 py-1.5 text-xs transition-colors ${
                            subActive
                              ? 'bg-blue-600/15 text-blue-300'
                              : 'text-gray-400 hover:bg-gray-700/40 hover:text-gray-300'
                          }`}
                        >
                          <span>{sub.label}</span>
                          <span className="text-gray-600">{subCount.toLocaleString()}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Filters */}
        <div className="bg-gray-800 rounded-lg p-3 flex flex-col gap-2.5">
          <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Filter</span>

          <SelectFilter label="Grade" value={filters.grade} onChange={v => setFilter('grade', v)}>
            <option value="">Alle Grades</option>
            {data?.grades.map(g => <option key={g} value={g}>{g}</option>)}
          </SelectFilter>

          <SelectFilter label="Klasse" value={filters.job} onChange={v => setFilter('job', v)}>
            <option value="">Alle Klassen</option>
            {data?.jobs.map(j => <option key={j} value={j}>{j}</option>)}
          </SelectFilter>

          <div>
            <label className="text-xs text-gray-400 mb-1 block">Level-Bereich</label>
            <div className="flex gap-2">
              <input
                type="number" min={0} max={300}
                value={filters.minLevel}
                onChange={e => setFilter('minLevel', Number(e.target.value))}
                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200"
                placeholder="Min"
              />
              <input
                type="number" min={0} max={300}
                value={filters.maxLevel}
                onChange={e => setFilter('maxLevel', Number(e.target.value))}
                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200"
                placeholder="Max"
              />
            </div>
          </div>

          <div className="border-t border-gray-700 pt-2">
            <label className="text-xs text-gray-400 mb-1 flex items-center gap-1">
              <ArrowUpDown size={11} /> Sortierung
            </label>
            <div className="relative">
              <select
                value={filters.sort}
                onChange={e => setFilter('sort', e.target.value as SortKey)}
                className="w-full appearance-none bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
              >
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Compare List */}
        {compareList.length > 0 && (
          <div className="bg-gray-800 border border-blue-700 rounded-lg p-3">
            <div className="text-xs font-semibold text-blue-400 mb-2">Vergleich ({compareList.length}/4)</div>
            <div className="flex flex-col gap-1">
              {compareList.map(item => (
                <div key={item.id} className="flex items-center gap-1 text-xs text-gray-300">
                  <span className="flex-1 truncate">{item.name}</span>
                  <button onClick={() => onRemoveFromCompare(item)} className="text-gray-500 hover:text-red-400">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={onSwitchToCompare}
              className="mt-2 w-full bg-blue-700 hover:bg-blue-600 text-white text-xs py-1.5 rounded transition-colors"
            >
              Items vergleichen
            </button>
          </div>
        )}
      </aside>

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        {/* Search + breadcrumb */}
        <div className="flex flex-col gap-2">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={filters.search}
              onChange={e => setFilter('search', e.target.value)}
              placeholder="Item nach Name oder ID suchen..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            {filters.search && (
              <button onClick={() => setFilter('search', '')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Active filter breadcrumb */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500">{filtered.length.toLocaleString()} Items</span>
            {filters.superCat && (
              <span className="flex items-center gap-1 bg-blue-900/40 border border-blue-700/50 text-blue-300 text-xs px-2 py-0.5 rounded-full">
                {SUPER_CATEGORIES.find(c => c.id === filters.superCat)?.label}
                {filters.subCat && <> › {filters.subCat}</>}
                <button onClick={() => selectSuperCat('')} className="hover:text-white ml-1">
                  <X size={10} />
                </button>
              </span>
            )}
            {filters.grade && (
              <span className="flex items-center gap-1 bg-gray-700/60 text-gray-300 text-xs px-2 py-0.5 rounded-full">
                {filters.grade}
                <button onClick={() => setFilter('grade', '')} className="hover:text-white ml-1"><X size={10} /></button>
              </span>
            )}
            {filters.job && (
              <span className="flex items-center gap-1 bg-gray-700/60 text-gray-300 text-xs px-2 py-0.5 rounded-full">
                {filters.job}
                <button onClick={() => setFilter('job', '')} className="hover:text-white ml-1"><X size={10} /></button>
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 pb-4">
            {paged.map(item => (
              <ItemCard
                key={item.id}
                item={item}
                onSelect={setSelectedItem}
                onAddToCompare={onAddToCompare}
                onRemoveFromCompare={onRemoveFromCompare}
                inCompareList={compareIds.has(item.id)}
              />
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-500 text-sm">
              Keine Items gefunden. Filter zurücksetzen oder Suchbegriff ändern.
            </div>
          )}

          {hasMore && (
            <div className="text-center py-4">
              <button
                onClick={() => setPage(p => p + 1)}
                className="bg-gray-700 hover:bg-gray-600 text-gray-200 px-6 py-2 rounded-lg text-sm transition-colors"
              >
                Mehr laden ({filtered.length - paged.length} weitere)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Item Detail Panel ────────────────────────────────────────────── */}
      {selectedItem && (
        <ItemDetail
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onAddToCompare={onAddToCompare}
          setEffects={setEffects}
          upgrades={upgrades}
          allItems={data?.items ?? []}
        />
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SelectFilter({ label, value, onChange, children }: {
  label: string; value: string; onChange: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs text-gray-400 mb-1 block">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full appearance-none bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
        >
          {children}
        </select>
        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
      </div>
    </div>
  );
}

const GRADE_COLORS: Record<string, string> = {
  Normal: 'text-gray-300', Rare: 'text-blue-400', Unique: 'text-yellow-400',
  Ultimate: 'text-orange-400', Baruna: 'text-purple-400',
};

function ItemDetail({ item, onClose, onAddToCompare, setEffects, upgrades, allItems }: {
  item: FlyffItem; onClose: () => void; onAddToCompare: (i: FlyffItem) => void;
  setEffects: SetEffectsDB | null; upgrades: UpgradeBonusDB | null; allItems: FlyffItem[];
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const iconUrl = item.icon
    ? `/icons/${item.icon.toLowerCase().replace(/\.dds$/i, '.png')}`
    : null;

  return (
    <div className="w-72 flex-shrink-0 bg-gray-800 border border-gray-700 rounded-lg p-4 flex flex-col gap-3 overflow-y-auto">
      <div className="flex items-start justify-between">
        <span className="text-xs text-gray-500 font-mono">{item.id}</span>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X size={14} /></button>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-16 h-16 bg-gray-900 rounded border border-gray-700 flex items-center justify-center flex-shrink-0">
          {iconUrl && (
            <img src={iconUrl} alt={item.name} className="w-full h-full object-contain"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          )}
        </div>
        <div>
          <div className={`font-bold text-base ${GRADE_COLORS[item.grade] ?? 'text-white'}`}>{item.name}</div>
          <div className="text-xs text-gray-400">{item.grade} · Level {item.level}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <Stat label="Kategorie" value={item.category} />
        <Stat label="Typ" value={item.type || item.subcategory} />
        <Stat label="Slot" value={item.slot} />
        <Stat label="Klasse" value={item.job} />
        {item.twoHanded && <Stat label="Händig" value="Zweihändig" />}
        {item.atkMin > 0 && <Stat label="Angriff" value={`${item.atkMin} – ${item.atkMax}`} />}
        {item.defMin > 0 && <Stat label="Verteidigung" value={`${item.defMin} – ${item.defMax}`} />}
        {item.cost > 0 && <Stat label="Preis" value={item.cost.toLocaleString() + ' P'} />}
        {item.soulbound && (
          <Stat
            label="Seelengebunden"
            value={item.soulbound === 'permanent' ? 'Permanent' : 'Beim Anlegen'}
          />
        )}
      </div>

      {Object.keys(item.stats).length > 0 && (
        <div className="bg-gray-900 rounded-lg p-3">
          <div className="text-xs font-semibold text-green-400 mb-2">Bonus Stats</div>
          <div className="flex flex-col gap-1.5">
            {Object.entries(item.stats).map(([k, v]) => (
              <div key={k} className="flex justify-between text-xs">
                <span className="text-gray-400">{k}</span>
                <span className="text-green-400 font-medium">+{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {item.powerup && (
        <div className="bg-gray-900 rounded-lg p-3">
          <div className="text-xs font-semibold text-yellow-400 mb-2">
            Powerup · {item.powerup.durationSec >= 3600
              ? `${Math.round(item.powerup.durationSec / 60)} Min`
              : `${item.powerup.durationSec} Sek`}
          </div>
          <div className="flex flex-col gap-1">
            {item.powerup.effects.map((e, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-gray-400">{e.stat}</span>
                <span className="text-yellow-300 font-medium">
                  +{e.value}{e.unit}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <UpgradeBonusPanel itemId={item.id} upgrades={upgrades} />

      {item.isSet && (
        <SetEffectPanel item={item} setEffects={setEffects} allItems={allItems} />
      )}

      <button
        onClick={() => onAddToCompare(item)}
        className="mt-auto bg-blue-700 hover:bg-blue-600 text-white text-sm py-2 rounded-lg transition-colors"
      >
        Zum Vergleich hinzufügen
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  if (!value && value !== 0) return null;
  return (
    <>
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-200">{value}</span>
    </>
  );
}
