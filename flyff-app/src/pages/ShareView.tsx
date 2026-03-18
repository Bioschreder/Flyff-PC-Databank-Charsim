import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Sword, ExternalLink, Loader } from 'lucide-react';
import { useCloudConfigs } from '../hooks/useCloudConfigs';
import type { SimulatorState } from '../types';

const JOB_SHORT: Record<string, string> = {
  JOB_VAGRANT: 'Vagrant', JOB_MERCENARY: 'Mercenary', JOB_ACROBAT: 'Acrobat',
  JOB_ASSIST: 'Assist', JOB_MAGICIAN: 'Magician', JOB_KNIGHT: 'Knight',
  JOB_BLADE: 'Blade', JOB_JESTER: 'Jester', JOB_RANGER: 'Ranger',
  JOB_RINGMASTER: 'Ringmaster', JOB_BILLPOSTER: 'Billposter',
  JOB_PSYCHIKEEPER: 'Psykeeper', JOB_ELEMENTOR: 'Elementor',
  JOB_KNIGHT_MASTER: 'Knight (M)', JOB_BLADE_MASTER: 'Blade (M)',
  JOB_KNIGHT_HERO: 'Knight (H)', JOB_BLADE_HERO: 'Blade (H)',
  JOB_LORDTEMPLER_HERO: 'Templar', JOB_STORMBLADE_HERO: 'Slayer',
  JOB_WINDLURKER_HERO: 'Harlequin', JOB_CRACKSHOOTER_HERO: 'Crackshooter',
  JOB_FLORIST_HERO: 'Seraph', JOB_FORCEMASTER_HERO: 'Force Master',
  JOB_MENTALIST_HERO: 'Mentalist', JOB_ELEMENTORLORD_HERO: 'Arcanist',
};

function jobLabel(id: string) {
  return JOB_SHORT[id] ?? id.replace('JOB_', '').replace(/_/g, ' ');
}

function countEquipped(state: SimulatorState) {
  return Object.values(state.equipment ?? {}).filter(Boolean).length;
}

export function ShareView() {
  const { token } = useParams<{ token: string }>();
  const navigate   = useNavigate();
  const { loadByToken } = useCloudConfigs(null);

  const [loaded, setLoaded]   = useState<{ name: string; state: SimulatorState } | null>(null);
  const [error, setError]     = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied]   = useState(false);

  useEffect(() => {
    if (!token) { setError(true); setLoading(false); return; }
    loadByToken(token).then(cfg => {
      if (cfg) setLoaded({ name: cfg.name, state: cfg.state });
      else setError(true);
      setLoading(false);
    });
  }, [token]);

  function handleOpenInSimulator() {
    if (!loaded) return;
    sessionStorage.setItem('flyff-shared-config', JSON.stringify(loaded.state));
    navigate('/');
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <Sword size={20} className="text-blue-400" />
          <span className="font-bold text-lg tracking-tight">Flyff DB</span>
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">PC</span>
        </button>
        <span className="text-gray-600">/</span>
        <span className="text-gray-400 text-sm">Geteilte Konfiguration</span>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        {loading && (
          <div className="flex flex-col items-center gap-4 text-gray-400">
            <Loader size={32} className="animate-spin text-blue-500" />
            <span>Konfiguration wird geladen...</span>
          </div>
        )}

        {error && !loading && (
          <div className="text-center space-y-4 max-w-md">
            <div className="text-5xl">🔒</div>
            <h2 className="text-xl font-bold text-white">Konfiguration nicht gefunden</h2>
            <p className="text-gray-400 text-sm">
              Dieser Link ist ungültig oder die Konfiguration wurde privat gesetzt.
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
            >
              Zur App
            </button>
          </div>
        )}

        {loaded && !loading && (
          <div className="w-full max-w-lg space-y-4">
            {/* Config card */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-xl font-bold text-white">{loaded.name}</h1>
                  <p className="text-sm text-gray-400 mt-1">
                    {jobLabel(loaded.state.jobId)} · Lv. {loaded.state.level} · {countEquipped(loaded.state)} Items ausgerüstet
                  </p>
                </div>
                <div className="shrink-0 px-2 py-1 rounded bg-green-700/40 border border-green-600/50 text-green-300 text-xs font-semibold">
                  Öffentlich
                </div>
              </div>

              {/* Stats preview */}
              <div className="grid grid-cols-2 gap-2 text-sm border-t border-gray-700 pt-4">
                {([
                  ['STR', loaded.state.baseStr],
                  ['STA', loaded.state.baseSta],
                  ['DEX', loaded.state.baseDex],
                  ['INT', loaded.state.baseInt],
                ] as [string, number][]).map(([stat, val]) => (
                  <div key={stat} className="flex justify-between bg-gray-900 rounded px-3 py-1.5">
                    <span className="text-gray-400">{stat}</span>
                    <span className="text-white font-semibold">{val}</span>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleOpenInSimulator}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
                >
                  <ExternalLink size={15} />
                  Im Simulator öffnen
                </button>
                <button
                  onClick={handleCopyLink}
                  className="px-4 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm text-gray-200 font-semibold transition-colors"
                >
                  {copied ? '✓ Kopiert' : 'Link kopieren'}
                </button>
              </div>
            </div>

            <p className="text-center text-xs text-gray-600">
              Geteilte Konfigurationen sind lesbar ohne Login.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
