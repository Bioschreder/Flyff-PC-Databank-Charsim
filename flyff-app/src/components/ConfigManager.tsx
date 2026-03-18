import { useState } from 'react';
import type { SimulatorState } from '../types';
import type { AuthState } from '../hooks/useAuth';
import { useCloudConfigs } from '../hooks/useCloudConfigs';

// ─── localStorage fallback (used when not logged in) ──────────────────────────

const LS_KEY = 'flyff-sim-configs';

interface LocalConfig {
  id: string;
  name: string;
  savedAt: string;
  state: SimulatorState;
}

function loadLocal(): LocalConfig[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]'); } catch { return []; }
}
function saveLocal(configs: LocalConfig[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(configs));
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const JOB_SHORT: Record<string, string> = {
  JOB_VAGRANT: 'Vagrant', JOB_MERCENARY: 'Mercenary', JOB_ACROBAT: 'Acrobat',
  JOB_ASSIST: 'Assist', JOB_MAGICIAN: 'Magician', JOB_KNIGHT: 'Knight',
  JOB_BLADE: 'Blade', JOB_JESTER: 'Jester', JOB_RANGER: 'Ranger',
  JOB_RINGMASTER: 'Ringmaster', JOB_BILLPOSTER: 'Billposter',
  JOB_PSYCHIKEEPER: 'Psykeeper', JOB_ELEMENTOR: 'Elementor',
  JOB_LORDTEMPLER_HERO: 'Templar', JOB_STORMBLADE_HERO: 'Slayer',
  JOB_WINDLURKER_HERO: 'Harlequin', JOB_CRACKSHOOTER_HERO: 'Crackshooter',
  JOB_FLORIST_HERO: 'Seraph', JOB_FORCEMASTER_HERO: 'Force Master',
  JOB_MENTALIST_HERO: 'Mentalist', JOB_ELEMENTORLORD_HERO: 'Arcanist',
};

function jobLabel(id: string) {
  return JOB_SHORT[id] ?? id.replace('JOB_', '').replace(/_/g, ' ');
}

function countEquipped(state: SimulatorState): number {
  return Object.values(state.equipment ?? {}).filter(Boolean).length;
}

// ─── component ───────────────────────────────────────────────────────────────

interface Props {
  currentState: SimulatorState;
  auth?: AuthState;
  onLoad: (state: SimulatorState) => void;
  onClose: () => void;
}

export function ConfigManager({ currentState, auth, onLoad, onClose }: Props) {
  const isLoggedIn = !!auth?.user;
  const cloud      = useCloudConfigs(auth?.user ?? null);

  // Local state
  const [localConfigs, setLocalConfigs] = useState<LocalConfig[]>(() => loadLocal());
  const [newName, setNewName]           = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [copiedId, setCopiedId]         = useState<string | null>(null);
  const [busy, setBusy]                 = useState(false);

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    if (isLoggedIn) {
      await cloud.saveConfig(name, currentState);
    } else {
      const cfg: LocalConfig = {
        id: crypto.randomUUID(),
        name,
        savedAt: new Date().toLocaleString('de-DE'),
        state: JSON.parse(JSON.stringify(currentState)),
      };
      const updated = [cfg, ...localConfigs];
      setLocalConfigs(updated);
      saveLocal(updated);
    }
    setNewName('');
    setBusy(false);
  }

  // ── Overwrite ─────────────────────────────────────────────────────────────
  async function handleOverwrite(id: string) {
    setBusy(true);
    if (isLoggedIn) {
      await cloud.updateConfig(id, { state: currentState });
    } else {
      const updated = localConfigs.map(c =>
        c.id === id
          ? { ...c, state: JSON.parse(JSON.stringify(currentState)), savedAt: new Date().toLocaleString('de-DE') }
          : c
      );
      setLocalConfigs(updated);
      saveLocal(updated);
    }
    setBusy(false);
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    setBusy(true);
    if (isLoggedIn) {
      await cloud.deleteConfig(id);
    } else {
      const updated = localConfigs.filter(c => c.id !== id);
      setLocalConfigs(updated);
      saveLocal(updated);
    }
    setConfirmDelete(null);
    setBusy(false);
  }

  // ── Share (cloud only) ────────────────────────────────────────────────────
  async function handleShare(id: string, currentlyPublic: boolean) {
    if (!isLoggedIn) return;
    setBusy(true);
    const token = await cloud.togglePublic(id);
    if (!currentlyPublic && token) {
      const appUrl = import.meta.env.VITE_APP_URL as string | undefined;
      const base   = appUrl ?? window.location.origin;
      const link   = `${base}/sim/${token}`;
      await navigator.clipboard.writeText(link);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2500);
    }
    setBusy(false);
  }

  // ── Export (local JSON) ───────────────────────────────────────────────────
  function handleExport(name: string, state: SimulatorState) {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${name.replace(/[^a-z0-9äöü]/gi, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Import ────────────────────────────────────────────────────────────────
  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        const state = JSON.parse(ev.target?.result as string) as SimulatorState;
        const name  = file.name.replace(/\.json$/i, '').replace(/_/g, ' ');
        if (isLoggedIn) {
          await cloud.saveConfig(name, state);
        } else {
          const cfg: LocalConfig = { id: crypto.randomUUID(), name, savedAt: new Date().toLocaleString('de-DE'), state };
          const updated = [cfg, ...localConfigs];
          setLocalConfigs(updated);
          saveLocal(updated);
        }
      } catch { alert('Ungültige Konfigurationsdatei.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  // ── Render helpers ────────────────────────────────────────────────────────
  const equippedCount = countEquipped(currentState);

  // Unify cloud + local into a display list
  type DisplayConfig = {
    id: string; name: string; savedAt: string; state: SimulatorState;
    is_public?: boolean; share_token?: string;
  };

  const displayConfigs: DisplayConfig[] = isLoggedIn
    ? cloud.configs.map(c => ({
        id: c.id, name: c.name,
        savedAt: new Date(c.updated_at).toLocaleString('de-DE'),
        state: c.state, is_public: c.is_public, share_token: c.share_token,
      }))
    : localConfigs;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg mx-4 max-h-[82vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h2 className="text-white font-semibold text-base">Konfigurationen</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700 transition-colors text-lg leading-none"
          >×</button>
        </div>

        {/* Login hint */}
        {!isLoggedIn && (
          <div className="px-4 py-2.5 bg-[#5865F2]/10 border-b border-[#5865F2]/30 flex items-center gap-2">
            <span className="text-[11px] text-indigo-300">
              Mit Discord einloggen um Konfigurationen in der Cloud zu speichern und zu teilen.
            </span>
            {auth && (
              <button
                onClick={auth.signIn}
                className="ml-auto shrink-0 px-2.5 py-1 rounded bg-[#5865F2] hover:bg-[#4752C4] text-white text-[11px] font-semibold transition-colors"
              >
                Einloggen
              </button>
            )}
          </div>
        )}

        {/* Logged in badge */}
        {isLoggedIn && auth?.user && (
          <div className="px-4 py-2 bg-green-900/20 border-b border-green-700/30 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
            <span className="text-[11px] text-green-300">
              Eingeloggt als <span className="font-semibold">
                {(auth.user.user_metadata as Record<string,string>)?.full_name ?? auth.user.email}
              </span> – Configs werden in der Cloud gespeichert.
            </span>
          </div>
        )}

        {/* Save new */}
        <div className="px-4 py-3 border-b border-gray-700 space-y-2">
          <div className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider">Aktuell speichern</div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Name der Konfiguration..."
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleSave}
              disabled={!newName.trim() || busy}
              className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors whitespace-nowrap"
            >
              Speichern
            </button>
          </div>
          <div className="text-[11px] text-gray-600">
            {jobLabel(currentState.jobId)} · Lv. {currentState.level} · {equippedCount} Items ausgerüstet
          </div>
        </div>

        {/* Import */}
        <div className="px-4 py-2 border-b border-gray-700 flex items-center gap-3">
          <label className="cursor-pointer px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-xs text-gray-200 font-semibold transition-colors">
            JSON importieren
            <input type="file" accept=".json" className="hidden" onChange={handleImport} />
          </label>
          <span className="text-[11px] text-gray-600">Konfiguration aus Datei laden</span>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 p-2 space-y-1.5">
          {cloud.loading ? (
            <div className="text-center text-gray-500 text-sm py-8 animate-pulse">Lade...</div>
          ) : displayConfigs.length === 0 ? (
            <div className="text-center text-gray-500 text-sm py-10">
              Noch keine gespeicherten Konfigurationen.
            </div>
          ) : (
            displayConfigs.map(cfg => (
              <div
                key={cfg.id}
                className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-800 border border-gray-700 hover:border-gray-600"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white font-medium truncate">{cfg.name}</span>
                    {cfg.is_public && (
                      <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] bg-green-700/40 text-green-300 border border-green-700/50 font-semibold">
                        Öffentlich
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {jobLabel(cfg.state.jobId)} · Lv. {cfg.state.level} · {countEquipped(cfg.state)} Items · {cfg.savedAt}
                  </div>
                </div>

                <div className="flex gap-1 shrink-0">
                  {/* Load */}
                  <button
                    onClick={() => { onLoad(cfg.state); onClose(); }}
                    className="px-2.5 py-1 rounded bg-green-700/60 hover:bg-green-600/80 text-green-200 text-xs font-semibold transition-colors"
                    title="Konfiguration laden"
                  >
                    Laden
                  </button>

                  {/* Overwrite */}
                  <button
                    onClick={() => handleOverwrite(cfg.id)}
                    disabled={busy}
                    className="px-2 py-1 rounded bg-yellow-700/50 hover:bg-yellow-600/70 text-yellow-200 text-xs transition-colors disabled:opacity-40"
                    title="Mit aktueller Konfiguration überschreiben"
                  >
                    ↑
                  </button>

                  {/* Share (cloud only) */}
                  {isLoggedIn && (
                    <button
                      onClick={() => handleShare(cfg.id, !!cfg.is_public)}
                      disabled={busy}
                      className={`px-2 py-1 rounded text-xs transition-colors disabled:opacity-40 ${
                        cfg.is_public
                          ? 'bg-green-700/40 hover:bg-red-800/40 text-green-300 hover:text-red-300'
                          : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                      }`}
                      title={cfg.is_public ? 'Link kopiert – klicken zum Privat setzen' : 'Link erstellen & kopieren'}
                    >
                      {copiedId === cfg.id ? '✓' : cfg.is_public ? '🔗' : '↗'}
                    </button>
                  )}

                  {/* Export */}
                  <button
                    onClick={() => handleExport(cfg.name, cfg.state)}
                    className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs transition-colors"
                    title="Als JSON-Datei exportieren"
                  >
                    ↓
                  </button>

                  {/* Delete */}
                  {confirmDelete === cfg.id ? (
                    <>
                      <button
                        onClick={() => handleDelete(cfg.id)}
                        disabled={busy}
                        className="px-2 py-1 rounded bg-red-700 hover:bg-red-600 text-white text-xs font-semibold transition-colors disabled:opacity-40"
                      >
                        Löschen?
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs transition-colors"
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(cfg.id)}
                      className="px-2 py-1 rounded bg-gray-700 hover:bg-red-800/60 text-gray-400 hover:text-red-300 text-xs transition-colors"
                      title="Löschen"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer legend */}
        <div className="px-4 py-2 border-t border-gray-700 flex gap-4 text-[11px] text-gray-600 flex-wrap">
          <span><span className="text-green-400 font-semibold">Laden</span> – übernehmen</span>
          <span><span className="text-yellow-400 font-semibold">↑</span> – überschreiben</span>
          {isLoggedIn && <span><span className="text-blue-400 font-semibold">↗ / 🔗</span> – teilen / privat</span>}
          <span><span className="text-gray-400 font-semibold">↓</span> – JSON exportieren</span>
        </div>
      </div>
    </div>
  );
}
