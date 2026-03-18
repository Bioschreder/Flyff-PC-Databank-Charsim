import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { Database, GitCompare, Sword, Users, Bug } from 'lucide-react';
import { ItemManager } from './components/ItemManager';
import { ItemComparison } from './components/ItemComparison';
import { CharacterSimulator } from './components/CharacterSimulator';
import { MonsterManager } from './components/MonsterManager';
import { AuthButton } from './components/AuthButton';
import { ShareView } from './pages/ShareView';
import { useAuth } from './hooks/useAuth';
import type { FlyffItem, SimulatorState } from './types';

type Tab = 'manager' | 'compare' | 'simulator' | 'monsters';

function MainApp() {
  const auth = useAuth();
  const location = useLocation();

  const [activeTab, setActiveTab]   = useState<Tab>('manager');
  const [compareList, setCompareList] = useState<FlyffItem[]>([]);
  const [sharedConfig, setSharedConfig] = useState<SimulatorState | null>(null);

  // Pick up config passed from ShareView via sessionStorage
  useEffect(() => {
    const raw = sessionStorage.getItem('flyff-shared-config');
    if (raw) {
      try {
        const state = JSON.parse(raw) as SimulatorState;
        setSharedConfig(state);
        setActiveTab('simulator');
      } catch { /* ignore */ }
      sessionStorage.removeItem('flyff-shared-config');
    }
  }, [location]);

  const addToCompare = (item: FlyffItem) => {
    setCompareList(prev => {
      if (prev.find(i => i.id === item.id)) return prev;
      if (prev.length >= 4) return prev;
      return [...prev, item];
    });
  };

  const removeFromCompare = (item: FlyffItem) => {
    setCompareList(prev => prev.filter(i => i.id !== item.id));
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'manager',   label: 'Item Manager',    icon: <Database size={16} /> },
    { id: 'compare',   label: `Vergleich${compareList.length > 0 ? ` (${compareList.length})` : ''}`, icon: <GitCompare size={16} /> },
    { id: 'simulator', label: 'Char-Simulator',  icon: <Users size={16} /> },
    { id: 'monsters',  label: 'Monster-DB',      icon: <Bug size={16} /> },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      <header className="bg-gray-900 border-b border-gray-800 px-3 sm:px-6">
        {/* Top row: logo + auth */}
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-2 shrink-0">
            <Sword size={18} className="text-blue-400" />
            <span className="font-bold text-base tracking-tight">Flyff DB</span>
            <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">PC</span>
          </div>
          <div className="shrink-0">
            <AuthButton auth={auth} />
          </div>
        </div>
        {/* Bottom row: tabs */}
        <nav className="flex gap-1 overflow-x-auto pb-2 -mx-1 px-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors whitespace-nowrap shrink-0 ${
                activeTab === tab.id
                  ? 'bg-blue-700 text-white'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 p-2 sm:p-4 overflow-hidden" style={{ height: 'calc(100dvh - 84px)' }}>
        {activeTab === 'manager' && (
          <ItemManager
            compareList={compareList}
            onAddToCompare={addToCompare}
            onRemoveFromCompare={removeFromCompare}
            onSwitchToCompare={() => setActiveTab('compare')}
          />
        )}
        {activeTab === 'compare' && (
          <div className="h-full overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Item Vergleich</h2>
              {compareList.length > 0 && (
                <button
                  onClick={() => setCompareList([])}
                  className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                >
                  Alle entfernen
                </button>
              )}
            </div>
            <ItemComparison items={compareList} onRemove={removeFromCompare} />
          </div>
        )}
        {activeTab === 'simulator' && (
          <div className="h-full overflow-y-auto">
            <CharacterSimulator auth={auth} initialState={sharedConfig ?? undefined} />
          </div>
        )}
        {activeTab === 'monsters' && (
          <div className="h-full overflow-y-auto">
            <MonsterManager />
          </div>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Analytics />
      <Routes>
        <Route path="/sim/:token" element={<ShareView />} />
        <Route path="*" element={<MainApp />} />
      </Routes>
      <div className="fixed bottom-3 right-3 z-40 text-right leading-tight pointer-events-none">
        <div className="bg-gray-900/80 border border-gray-700/60 rounded-lg px-3 py-1.5 backdrop-blur-sm">
          <div className="text-[11px] font-semibold text-gray-400">Alpha 0.1</div>
          <div className="text-[10px] text-gray-600">DB: 14.06.2025</div>
        </div>
      </div>
    </BrowserRouter>
  );
}
