import { isDemoMode } from '../utils/demoStorageAdapter';

export type NavTab = 'Alex' | 'Jordan' | 'Property' | 'Sinking';

interface FloatingDockProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  sessionActor: string | null;
  onToggleActor: () => void;
  isLocked: boolean;
  onToggleLock: () => void;
  onOpenHelp: () => void;
}

export default function FloatingDock({
  activeTab,
  onSelectTab,
  sessionActor,
  onToggleActor,
  isLocked,
  onToggleLock,
  onOpenHelp,
}: FloatingDockProps) {
  const isDemo = isDemoMode();
  const tabs: { id: NavTab; label: string }[] = [
    { id: 'Alex', label: isDemo ? 'Alex' : 'Alex' },
    { id: 'Jordan', label: isDemo ? 'Jordan' : 'Jordan' },
    { id: 'Sinking', label: 'Sinking & Liquidity' },
    { id: 'Property', label: 'Property' },
  ];

  return (
    <aside
      aria-label="Floating Controls Dock"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 p-1.5 px-3 rounded-full bg-card/95 backdrop-blur-md border border-border/80 shadow-2xl ring-1 ring-border/50 transition-all select-none max-w-[96vw] overflow-x-auto"
    >
      {/* Page Navigation Tabs */}
      <nav className="flex items-center gap-1 shrink-0" aria-label="Quick Page Switcher">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`h-8 px-3 rounded-full text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                isActive
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
              }`}
              title={`Switch to ${tab.label}`}
            >
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="h-4 w-px bg-border/80 shrink-0 mx-0.5" />

      {/* Lock / Unlock Mode Toggle */}
      <button
        onClick={onToggleLock}
        className={`h-8 px-3 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
          isLocked
            ? 'bg-muted/70 text-muted-foreground hover:text-foreground hover:bg-muted border border-border/60'
            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
        }`}
        title={isLocked ? 'Click to unlock edit mode' : 'Click to lock engine (read-only)'}
      >
        <span>{isLocked ? '🔒' : '🔓'}</span>
        <span className="hidden sm:inline">{isLocked ? 'Locked' : 'Edit Mode'}</span>
      </button>

      <div className="h-4 w-px bg-border/80 shrink-0 mx-0.5" />

      {/* Interactive Session Actor Switcher */}
      <button
        onClick={onToggleActor}
        className="h-8 px-2.5 rounded-full text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all flex items-center gap-1.5 cursor-pointer group shrink-0"
        title={`Active session: ${sessionActor || 'User'}. Click to switch to ${sessionActor === 'Alex' ? 'Jordan' : 'Alex'}`}
      >
        <span
          className={`w-2 h-2 rounded-full transition-transform group-hover:scale-125 ${
            sessionActor === 'Jordan' ? 'bg-rose-500 shadow-rose-500/50' : 'bg-emerald-500 shadow-emerald-500/50'
          } shadow-xs`}
        />
        <span className="hidden sm:inline">{sessionActor || 'User'}</span>
        <span className="text-[11px] text-muted-foreground/60 group-hover:text-foreground transition-transform group-hover:translate-x-0.5">
          ⇄
        </span>
      </button>

      <div className="h-4 w-px bg-border/80 shrink-0 mx-0.5" />

      {/* Quick Scroll to Top */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer shrink-0"
        title="Scroll to top"
      >
        ↑
      </button>

      {/* Operations Manual Help Button */}
      <button
        onClick={onOpenHelp}
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer shrink-0"
        title="Open Engine Operations Manual & SOP (Help)"
      >
        ?
      </button>
    </aside>
  );
}
