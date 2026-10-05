import { useState, useEffect } from 'react';
import ItemGrid from './components/ItemGrid';
import PropertyEngine from './components/PropertyEngine';
import SinkingFundEngine from './components/SinkingFundEngine';
import HelpModal from './components/HelpModal';
import FloatingDock from './components/FloatingDock';
import type { FinancialItem } from './types';
import {
  isDemoMode,
  getDemoData,
  updateDemoItem,
  createDemoItem,
  deleteDemoItem,
  revertDemoItem,
  promoteDemoItem,
  deleteDemoAuditLog,
  clearDemoAuditLogs,
  resetDemoStorage,
} from './utils/demoStorageAdapter';
import './App.css';

function App() {
  const isDemo = isDemoMode();
  const defaultActor = isDemo ? 'Alex' : 'Alex';
  const partnerActor = isDemo ? 'Jordan' : 'Jordan';

  const [sessionActor, setSessionActor] = useState<string | null>(() => {
    const stored = localStorage.getItem('demo_session_actor');
    if (isDemo && (stored === 'Alex' || !stored)) return 'Alex';
    return stored || defaultActor;
  });
  const [activeTab, setActiveTab] = useState<'Alex' | 'Jordan' | 'Property' | 'Sinking'>(() => {
    const stored = localStorage.getItem('demo_session_actor') as any;
    if (isDemo && (stored === 'Alex' || !stored)) return 'Alex'; // Note: Alex tab maps to Alex
    return stored || 'Alex';
  });
  const [isLocked, setIsLocked] = useState<boolean>(true);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [data, setData] = useState<FinancialItem[]>([]);
  const [baselines, setBaselines] = useState<FinancialItem[]>([]);
  const [loading, setLoading] = useState(true);

  const handleSelectActor = (actor: string) => {
    setSessionActor(actor);
    setActiveTab(actor === 'Jordan' || actor === 'Jordan' ? 'Jordan' : 'Alex');
    localStorage.setItem('demo_session_actor', actor);
  };

  const handleToggleActor = () => {
    const nextActor = sessionActor === defaultActor ? partnerActor : defaultActor;
    handleSelectActor(nextActor);
  };
  
  const [currentTheme, setCurrentTheme] = useState<string>(() => localStorage.getItem('dashboard-theme') || 'dark');

  useEffect(() => {
    if (currentTheme === 'dark') document.documentElement.classList.add('dark'); else document.documentElement.classList.remove('dark');
    localStorage.setItem('dashboard-theme', currentTheme);
  }, [currentTheme]);

  const loadData = async () => {
    if (isDemo) {
      const demo = getDemoData();
      setData(demo.items);
      setBaselines(demo.baselines);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/data');
      const json = await res.json();
      setData(json.items || json);
      if (json.baselines) setBaselines(json.baselines);
      setLoading(false);
    } catch (err) {
      console.warn('Backend unavailable, falling back to Demo Mock Adapter');
      const demo = getDemoData();
      setData(demo.items);
      setBaselines(demo.baselines);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateItem = async (updatedItem: FinancialItem, reason?: string) => {
    if (!sessionActor) return { success: false, error: 'Unauthorized.' };
    if (isDemo) {
      const ok = updateDemoItem(updatedItem, reason, sessionActor);
      if (ok) loadData();
      return { success: ok, error: ok ? undefined : 'Failed to update in demo mode' };
    }
    try {
      const res = await fetch(`/api/item/${updatedItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updatedItem, edit_reason: reason, actor: sessionActor })
      });
      if (!res.ok) {
        const error = await res.json();
        return { success: false, error: error.error };
      }
      loadData();
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Network error.' };
    }
  };

  const handleRevert = async (id: string) => {
    if (!sessionActor) return { success: false, error: 'Unauthorized.' };
    if (isDemo) {
      const ok = revertDemoItem(id, sessionActor);
      if (ok) loadData();
      return { success: ok, error: ok ? undefined : 'Revert failed in demo mode' };
    }
    try {
      const res = await fetch(`/api/revert/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor: sessionActor })
      });
      if (!res.ok) return { success: false, error: 'Revert failed' };
      loadData();
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Network error.' };
    }
  };

  const handleApproveBaseline = async (id: string) => {
    if (!sessionActor) return { success: false, error: 'Unauthorized.' };
    if (isDemo) {
      const ok = promoteDemoItem(id, 'Approved baseline in demo mode', sessionActor);
      if (ok) loadData();
      return { success: ok };
    }
    try {
      const res = await fetch(`/api/approve-baseline/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor: sessionActor })
      });
      if (!res.ok) {
        const error = await res.json();
        return { success: false, error: error.error };
      }
      loadData();
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Network error' };
    }
  };

  const handleRejectBaseline = async (id: string) => {
    if (!sessionActor) return { success: false, error: 'Unauthorized.' };
    if (isDemo) {
      const ok = revertDemoItem(id, sessionActor);
      if (ok) loadData();
      return { success: ok };
    }
    try {
      const res = await fetch(`/api/reject-baseline/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor: sessionActor })
      });
      if (!res.ok) {
        const error = await res.json();
        return { success: false, error: error.error };
      }
      loadData();
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Network error' };
    }
  };

  const handlePromote = async (id: string, reason: string) => {
    if (!sessionActor) return { success: false, error: 'Unauthorized.' };
    if (isDemo) {
      const ok = promoteDemoItem(id, reason, sessionActor);
      if (ok) loadData();
      return { success: ok };
    }
    try {
      const res = await fetch(`/api/promote-to-baseline/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, actor: sessionActor })
      });
      if (!res.ok) {
        const error = await res.json();
        return { success: false, error: error.error };
      }
      loadData();
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Network error.' };
    }
  };

  const handleCreateItem = async (newItem: Partial<FinancialItem>) => {
    if (!sessionActor) return { success: false, error: 'Unauthorized.' };
    if (isDemo) {
      const res = createDemoItem(newItem, sessionActor);
      if (res.success) loadData();
      return { success: res.success, error: res.success ? undefined : 'Failed to create in demo mode' };
    }
    try {
      const res = await fetch(`/api/item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newItem, actor: sessionActor })
      });
      if (!res.ok) {
        const error = await res.json();
        return { success: false, error: error.error };
      }
      loadData();
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Network error.' };
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!sessionActor) return { success: false, error: 'Unauthorized.' };
    if (isDemo) {
      const ok = deleteDemoItem(id);
      if (ok) loadData();
      return { success: ok };
    }
    try {
      const res = await fetch(`/api/item/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) return { success: false, error: 'Failed to delete' };
      await loadData();
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Network error.' };
    }
  };

  const handleDeleteAuditLog = async (id: string, logIndex: number) => {
    if (!sessionActor) return { success: false, error: 'Unauthorized.' };
    if (isDemo) {
      const ok = deleteDemoAuditLog(id, logIndex);
      if (ok) loadData();
      return { success: ok };
    }
    try {
      const res = await fetch(`/api/item/${id}/audit/${logIndex}`, {
        method: 'DELETE'
      });
      if (!res.ok) return { success: false, error: 'Failed to delete audit log entry' };
      await loadData();
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Network error.' };
    }
  };

  const handleClearAuditLogs = async (id: string) => {
    if (!sessionActor) return { success: false, error: 'Unauthorized.' };
    if (isDemo) {
      const ok = clearDemoAuditLogs(id);
      if (ok) loadData();
      return { success: ok };
    }
    try {
      const res = await fetch(`/api/item/${id}/audit`, {
        method: 'DELETE'
      });
      if (!res.ok) return { success: false, error: 'Failed to clear audit trail' };
      await loadData();
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Network error.' };
    }
  };

  if (!sessionActor) {
    return (
      <div className="gateway-overlay">
        <div className="gateway-card">
          <h2>Who is editing?</h2>
          <p>Global Session Lock Required. Forensic audit trails enforce actor attribution on all changes.</p>
          <div className="gateway-buttons">
            <button className="gateway-btn" onClick={() => handleSelectActor(defaultActor)}>{defaultActor}</button>
            <button className="gateway-btn" onClick={() => handleSelectActor(partnerActor)}>{partnerActor}</button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) return <div className="app-container">Loading Engine Backend...</div>;

  return (
    <div className="app-container">
      {isDemo && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 uppercase tracking-wider text-[10px]">Public Live Demo</span>
            <span>Running in client-side sandbox mode with synthetic dummy data. All changes persist in your browser.</span>
          </div>
          <button
            onClick={() => {
              resetDemoStorage();
              loadData();
            }}
            className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-zinc-200 text-xs font-medium cursor-pointer transition-colors"
          >
            Reset Demo Data
          </button>
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <select 
            value={currentTheme} 
            onChange={e => setCurrentTheme(e.target.value)} 
            className="px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900/80 text-zinc-300 text-xs font-medium cursor-pointer hover:border-zinc-700 focus:outline-hidden"
          >
            <option value="light">☀️ Light Mode</option>
            <option value="dark">🌙 Dark Mode</option>
          </select>
          <button
            onClick={() => setShowHelpModal(true)}
            className="px-2.5 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900/80 text-zinc-300 hover:text-emerald-400 hover:border-zinc-700 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Open Engine Operations Manual & SOP (SOP Cheat Sheet)"
          >
            <span>📖</span>
            <span>Manual</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsLocked(!isLocked)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 border transition-all cursor-pointer shadow-xs ${
              isLocked 
                ? 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border-zinc-800 hover:border-zinc-700' 
                : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25 shadow-[0_0_12px_rgba(52,211,153,0.15)]'
            }`}
          >
            <span>{isLocked ? '🔒' : '🔓'}</span>
            <span>{isLocked ? 'Engine Locked (Read-Only)' : 'Edit Mode Active'}</span>
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-400">
            <span>Editing As: <strong className="text-zinc-200 font-semibold">{sessionActor}</strong></span>
            <button 
              className="px-2 py-0.5 rounded border border-zinc-700/60 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 text-[11px] transition-colors cursor-pointer" 
              onClick={handleToggleActor}
              title={`Switch actor and tab to ${sessionActor === defaultActor ? partnerActor : defaultActor}`}
            >
              Switch to {sessionActor === defaultActor ? partnerActor : defaultActor}
            </button>
            <button 
              className="px-1.5 py-0.5 rounded border border-zinc-800 text-zinc-500 hover:text-zinc-400 hover:bg-zinc-800 text-[10px] transition-colors cursor-pointer" 
              onClick={() => { setSessionActor(null); localStorage.removeItem('demo_session_actor'); }}
              title="Lock session and show Gateway"
            >
              Gateway
            </button>
          </div>
        </div>
      </div>
      
      <header className="app-header">
        <div className="header-content">
          <h1>{isDemo ? 'Couple Financial OS & Property Engine' : 'Demo Property & Cash Flow Engine'}</h1>
          <p className="subtitle">Real-Time Cash Flow, Sinking Funds & Settlement Readiness</p>
        </div>
        <div className="tabs">
          <button className={activeTab === 'Alex' ? 'active' : ''} onClick={() => setActiveTab('Alex')}>{defaultActor} Dashboard</button>
          <button className={activeTab === 'Jordan' ? 'active' : ''} onClick={() => setActiveTab('Jordan')}>{partnerActor} Dashboard</button>
          <button className={activeTab === 'Property' ? 'active' : ''} onClick={() => setActiveTab('Property')} style={{color: activeTab === 'Property' ? '#059669' : '', borderBottomColor: activeTab === 'Property' ? '#059669' : ''}}>Property Engine</button>
          <button className={activeTab === 'Sinking' ? 'active' : ''} onClick={() => setActiveTab('Sinking')} style={{color: activeTab === 'Sinking' ? '#10b981' : '', borderBottomColor: activeTab === 'Sinking' ? '#10b981' : ''}}>Sinking & Liquidity</button>
        </div>
      </header>
      <main>
        {activeTab === 'Property' ? (
            <PropertyEngine items={data} sessionActor={sessionActor} isLocked={isLocked} />
        ) : activeTab === 'Sinking' ? (
            <SinkingFundEngine items={data} onUpdateItem={handleUpdateItem} isLocked={isLocked} />
        ) : (
            <ItemGrid 
              items={data.filter(item => isDemo ? (activeTab === 'Alex' ? item.owner === 'Alex' : item.owner === 'Jordan') : (item.owner === activeTab))} 
              baselines={baselines} 
              owner={isDemo ? (activeTab === 'Alex' ? 'Alex' : 'Jordan') : activeTab} 
              isLocked={isLocked}
              onUpdate={handleUpdateItem} 
              onRevert={handleRevert}
              onPromote={handlePromote} onApproveBaseline={handleApproveBaseline} onRejectBaseline={handleRejectBaseline}
              onCreate={handleCreateItem}
              onDelete={handleDeleteItem}
              onDeleteAuditLog={handleDeleteAuditLog}
              onClearAuditLogs={handleClearAuditLogs}
              sessionActor={sessionActor}
            />
        )}
      </main>
      <FloatingDock
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        sessionActor={sessionActor}
        onToggleActor={handleToggleActor}
        isLocked={isLocked}
        onToggleLock={() => setIsLocked(!isLocked)}
        onOpenHelp={() => setShowHelpModal(true)}
      />
      {showHelpModal && <HelpModal onClose={() => setShowHelpModal(false)} />}
    </div>
  );
}

export default App;
