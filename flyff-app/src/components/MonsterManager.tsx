import { useState, useMemo, useEffect } from 'react';
import type { Monster } from '../types';

// ─── helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => Math.round(n).toLocaleString('de-DE');
const fmtK = (n: number) =>
  n >= 1_000_000_000 ? `${(n / 1_000_000_000).toFixed(2)}Mrd`
  : n >= 1_000_000  ? `${(n / 1_000_000).toFixed(2)}Mio`
  : n >= 1_000      ? `${(n / 1_000).toFixed(1)}K`
  : String(Math.round(n));

const RANK_COLOR: Record<string, string> = {
  Normal:    'text-gray-300',
  Low:       'text-gray-400',
  Captain:   'text-blue-400',
  'Mini-Boss': 'text-purple-400',
  Boss:      'text-yellow-400',
  Guard:     'text-green-400',
};
const RANK_BADGE: Record<string, string> = {
  Normal:    'bg-gray-700 text-gray-300',
  Low:       'bg-gray-800 text-gray-500',
  Captain:   'bg-blue-900/60 text-blue-300',
  'Mini-Boss': 'bg-purple-900/60 text-purple-300',
  Boss:      'bg-yellow-900/60 text-yellow-300',
  Guard:     'bg-green-900/60 text-green-300',
};
const ELEM_COLOR: Record<string, string> = {
  Fire: 'text-orange-400', Water: 'text-cyan-400', Electric: 'text-yellow-300',
  Wind: 'text-green-300', Earth: 'text-amber-600', None: 'text-gray-500',
};

// ─── MonsterCard ──────────────────────────────────────────────────────────────

function MonsterCard({ monster, onClick }: { monster: Monster; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="bg-gray-800 border border-gray-700 rounded-lg p-3 hover:border-blue-600/60 cursor-pointer transition-all hover:bg-gray-750"
    >
      <div className="flex items-start gap-2 mb-2">
        {/* Monster icon */}
        <div className="w-10 h-10 shrink-0 bg-gray-900 rounded border border-gray-700 flex items-center justify-center overflow-hidden">
          {(monster as Monster & { icon?: string }).icon ? (
            <img
              src={(monster as Monster & { icon?: string }).icon}
              alt={monster.name}
              className="w-full h-full object-contain"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <span className="text-gray-600 text-lg">?</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`font-semibold text-sm truncate ${RANK_COLOR[monster.rank] ?? 'text-white'}`}>
            {monster.name}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-xs text-gray-500">Lv. {monster.level}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${RANK_BADGE[monster.rank] ?? 'bg-gray-700 text-gray-300'}`}>
              {monster.rank}
            </span>
            {monster.race && monster.race !== 'Unknown' && monster.race !== '0' && (
              <span className="text-[10px] text-gray-600">{monster.race}</span>
            )}
            {monster.element !== 'None' && (
              <span className={`text-[10px] font-semibold ${ELEM_COLOR[monster.element] ?? 'text-gray-400'}`}>
                {monster.element}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-500">HP</span>
          <span className="text-green-400 font-mono">{fmtK(monster.hp)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">DEF</span>
          <span className="text-blue-300 font-mono">{fmt(monster.def)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">ATK</span>
          <span className="text-orange-300 font-mono">{fmt(monster.atkMin)}–{fmt(monster.atkMax)}</span>
        </div>
        {monster.skillMult > 1.0 && (
          <div className="flex justify-between">
            <span className="text-gray-500">Skill ATK</span>
            <span className="text-red-300 font-mono">{fmt(monster.skillAtkMin)}–{fmt(monster.skillAtkMax)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-gray-500">EXP</span>
          <span className="text-purple-300 font-mono">{fmtK(monster.exp)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── MonsterDetail ────────────────────────────────────────────────────────────

function MonsterDetail({ monster, onClose }: { monster: Monster; onClose: () => void }) {
  const resistances = [
    { label: 'Feuer',    value: monster.resFire,  color: 'text-orange-400' },
    { label: 'Wasser',   value: monster.resWater, color: 'text-cyan-400' },
    { label: 'Elektro',  value: monster.resElec,  color: 'text-yellow-300' },
    { label: 'Wind',     value: monster.resWind,  color: 'text-green-300' },
    { label: 'Erde',     value: monster.resEarth, color: 'text-amber-600' },
  ].filter(r => r.value !== 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-600 rounded-xl p-5 w-96 max-h-[80vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3">
            {(monster as Monster & { icon?: string }).icon && (
              <img
                src={(monster as Monster & { icon?: string }).icon}
                alt={monster.name}
                className="w-16 h-16 object-contain bg-gray-800 rounded-lg border border-gray-700 p-1"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            <div>
              <div className={`text-lg font-bold ${RANK_COLOR[monster.rank] ?? 'text-white'}`}>
                {monster.name}
              </div>
              <div className="flex gap-2 mt-1">
                <span className="text-sm text-gray-400">Lv. {monster.level}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${RANK_BADGE[monster.rank] ?? ''}`}>{monster.rank}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
        </div>

        <div className="space-y-4">
          <Section label="Vitals">
            <Row label="HP"  value={fmt(monster.hp)}  color="text-green-400" />
            <Row label="MP"  value={fmt(monster.mp)}  color="text-blue-400" />
            <Row label="EXP" value={fmtK(monster.exp)} color="text-purple-300" />
          </Section>

          <Section label="Kampf">
            <Row label="ATK Min"  value={fmt(monster.atkMin)} color="text-orange-300" />
            <Row label="ATK Max"  value={fmt(monster.atkMax)} color="text-orange-300" />
            {monster.skillMult > 1.0 && (
              <>
                <Row label={`Skill ATK Min (×${monster.skillMult})`} value={fmt(monster.skillAtkMin)} color="text-red-300" />
                <Row label={`Skill ATK Max (×${monster.skillMult})`} value={fmt(monster.skillAtkMax)} color="text-red-300" />
              </>
            )}
            <Row label="DEF"      value={fmt(monster.def)}    color="text-blue-300" />
            <Row label="Res Magie" value={`${monster.resMagic}`} />
          </Section>

          {monster.element !== 'None' && (
            <Section label="Element">
              <Row label="Typ"    value={monster.element} color={ELEM_COLOR[monster.element]} />
              <Row label="Stärke" value={String(monster.elementAtk)} />
            </Section>
          )}

          {resistances.length > 0 && (
            <Section label="Resistenzen">
              {resistances.map(r => (
                <Row key={r.label} label={r.label}
                  value={r.value > 0 ? `+${r.value}` : String(r.value)}
                  color={r.value > 0 ? r.color : 'text-red-400'} />
              ))}
            </Section>
          )}

          {(monster.race && monster.race !== 'Unknown' && monster.race !== '0') && (
            <Section label="Info">
              <Row label="Rasse" value={monster.race} />
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</div>
      <div className="bg-gray-800 rounded-lg p-2.5 space-y-0.5">{children}</div>
    </div>
  );
}
function Row({ label, value, color = 'text-white' }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-400">{label}</span>
      <span className={`font-semibold ${color}`}>{value}</span>
    </div>
  );
}

// ─── MonsterManager ───────────────────────────────────────────────────────────

const RANKS = ['Alle', 'Normal', 'Captain', 'Mini-Boss', 'Boss'];
const ELEMENTS = ['Alle', 'None', 'Fire', 'Water', 'Electric', 'Wind', 'Earth'];

export function MonsterManager() {
  const [monsters, setMonsters] = useState<Monster[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [rankFilter, setRankFilter] = useState('Alle');
  const [elemFilter, setElemFilter] = useState('Alle');
  const [minLevel, setMinLevel] = useState(1);
  const [maxLevel, setMaxLevel] = useState(200);
  const [sortBy, setSortBy] = useState<'level' | 'name' | 'exp' | 'hp'>('level');
  const [selected, setSelected] = useState<Monster | null>(null);
  const [page, setPage] = useState(0);

  const PAGE_SIZE = 48;

  useEffect(() => {
    fetch('/data/monsters.json')
      .then(r => r.json())
      .then(d => { setMonsters(d.monsters); setLoading(false); });
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return monsters
      .filter(m =>
        (q === '' || m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)) &&
        (rankFilter === 'Alle' || m.rank === rankFilter) &&
        (elemFilter === 'Alle' || m.element === elemFilter) &&
        m.level >= minLevel && m.level <= maxLevel
      )
      .sort((a, b) => {
        if (sortBy === 'level') return a.level - b.level;
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'exp') return b.exp - a.exp;
        if (sortBy === 'hp') return b.hp - a.hp;
        return 0;
      });
  }, [monsters, search, rankFilter, elemFilter, minLevel, maxLevel, sortBy]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // reset page when filter changes
  useMemo(() => setPage(0), [search, rankFilter, elemFilter, minLevel, maxLevel, sortBy]);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Lade Monster-Datenbank…</div>;
  }

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between">
        <div className="text-xl font-bold text-white">Monster-Datenbank</div>
        <div className="text-sm text-gray-500">{filtered.length} von {monsters.length} Monstern</div>
      </div>

      {/* Filter bar */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 flex flex-wrap gap-3 items-center">
        <input
          placeholder="Name suchen…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[180px] bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">Rang:</span>
          <div className="flex gap-1 flex-wrap">
            {RANKS.map(r => (
              <button key={r} onClick={() => setRankFilter(r)}
                className={`px-2 py-0.5 rounded text-xs transition-colors ${
                  rankFilter === r ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >{r}</button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">Element:</span>
          <select value={elemFilter} onChange={e => setElemFilter(e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:outline-none"
          >
            {ELEMENTS.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">Level:</span>
          <input type="number" min={1} max={200} value={minLevel}
            onChange={e => setMinLevel(Number(e.target.value))}
            className="w-16 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white text-center focus:outline-none"
          />
          <span className="text-gray-600 text-xs">–</span>
          <input type="number" min={1} max={200} value={maxLevel}
            onChange={e => setMaxLevel(Number(e.target.value))}
            className="w-16 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white text-center focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">Sortierung:</span>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:outline-none"
          >
            <option value="level">Level</option>
            <option value="name">Name</option>
            <option value="exp">EXP ↓</option>
            <option value="hp">HP ↓</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
          {paginated.map(m => (
            <MonsterCard key={m.id} monster={m} onClick={() => setSelected(m)} />
          ))}
        </div>
        {filtered.length === 0 && (
          <div className="text-center text-gray-500 py-16">Keine Monster gefunden</div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-2">
          <button onClick={() => setPage(0)} disabled={page === 0}
            className="px-2 py-1 text-xs bg-gray-700 rounded disabled:opacity-40 hover:bg-gray-600">«</button>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            className="px-2 py-1 text-xs bg-gray-700 rounded disabled:opacity-40 hover:bg-gray-600">‹</button>
          <span className="text-xs text-gray-400">{page + 1} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
            className="px-2 py-1 text-xs bg-gray-700 rounded disabled:opacity-40 hover:bg-gray-600">›</button>
          <button onClick={() => setPage(totalPages - 1)} disabled={page === totalPages - 1}
            className="px-2 py-1 text-xs bg-gray-700 rounded disabled:opacity-40 hover:bg-gray-600">»</button>
        </div>
      )}

      {/* Detail modal */}
      {selected && <MonsterDetail monster={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
