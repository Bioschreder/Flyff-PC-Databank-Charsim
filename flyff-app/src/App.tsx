import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
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
  const navigate = useNavigate();
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
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center gap-4">
        <div className="flex items-center gap-2 shrink-0">
          <Sword size={20} className="text-blue-400" />
          <span className="font-bold text-lg tracking-tight">Flyff DB</span>
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">PC</span>
        </div>

        <nav className="flex gap-1 ml-2 flex-1 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded text-sm transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-blue-700 text-white'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="shrink-0 ml-2">
          <AuthButton auth={auth} />
        </div>
      </header>

      <main className="flex-1 p-4 overflow-hidden" style={{ height: 'calc(100vh - 57px)' }}>
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
      <Routes>
        <Route path="/sim/:token" element={<ShareView />} />
        <Route path="*" element={<MainApp />} />
      </Routes>
    </BrowserRouter>
  );
}
