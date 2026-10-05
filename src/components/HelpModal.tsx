import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Props {
  onClose: () => void;
}

export default function HelpModal({ onClose }: Props) {
  const [activeSection, setActiveSection] = useState<'workflows' | 'baselines' | 'routes' | 'sinking' | 'property' | 'shortcuts'>('workflows');

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <Card className="w-full max-w-2xl bg-zinc-950 border-zinc-800 shadow-2xl text-zinc-100 overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <CardHeader className="p-5 pb-3 border-b border-zinc-800 bg-zinc-900/60 flex flex-row items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">📖</span>
              <CardTitle className="text-base font-bold text-zinc-100">Engine Operations Manual</CardTitle>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold">
                SOP v1.1
              </span>
            </div>
            <CardDescription className="text-xs text-zinc-400 mt-0.5">
              Standard operating procedures, persistence rules, and system mechanics
            </CardDescription>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose} 
            className="h-8 w-8 p-0 rounded-full text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 cursor-pointer"
          >
            ✕
          </Button>
        </CardHeader>

        {/* Section Navigation Tabs */}
        <div className="flex border-b border-zinc-800 bg-zinc-900/40 px-5 gap-2 text-xs font-medium overflow-x-auto">
          <button
            onClick={() => setActiveSection('workflows')}
            className={`py-2.5 px-3 border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeSection === 'workflows'
                ? 'border-emerald-500 text-emerald-400 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            ✏️ Edit Workflows
          </button>
          <button
            onClick={() => setActiveSection('baselines')}
            className={`py-2.5 px-3 border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeSection === 'baselines'
                ? 'border-emerald-500 text-emerald-400 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            🛡️ Baseline & Revert
          </button>
          <button
            onClick={() => setActiveSection('routes')}
            className={`py-2.5 px-3 border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeSection === 'routes'
                ? 'border-emerald-500 text-emerald-400 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            🏦 Banking Routes
          </button>
          <button
            onClick={() => setActiveSection('sinking')}
            className={`py-2.5 px-3 border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeSection === 'sinking'
                ? 'border-emerald-500 text-emerald-400 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            🛟 Sinking & Liquidity
          </button>
          <button
            onClick={() => setActiveSection('property')}
            className={`py-2.5 px-3 border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeSection === 'property'
                ? 'border-emerald-500 text-emerald-400 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            🏡 Property & Triage
          </button>
          <button
            onClick={() => setActiveSection('shortcuts')}
            className={`py-2.5 px-3 border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeSection === 'shortcuts'
                ? 'border-emerald-500 text-emerald-400 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            ⚡ Dock & Shortcuts
          </button>
        </div>

        {/* Content Body */}
        <CardContent className="p-5 overflow-y-auto space-y-4 text-xs leading-relaxed text-zinc-300">
          {activeSection === 'workflows' && (
            <div className="space-y-3.5">
              <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-1.5">
                <div className="font-semibold text-zinc-100 flex items-center gap-1.5">
                  <span>🎯</span> Active Row Spotlight & Drawer
                </div>
                <p className="text-zinc-400">
                  Clicking <strong className="text-zinc-200">✏️ Edit</strong> enters spotlight mode: all other rows dim to 35% opacity, and the active row glows with an emerald border. The drawer allows multi-field edits (Amount, Cadence, Route, Notes).
                </p>
              </div>

              <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-1.5">
                <div className="font-semibold text-zinc-100 flex items-center gap-1.5">
                  <span>⚡</span> Inline Pill Quick-Edits
                </div>
                <p className="text-zinc-400">
                  When the engine is unlocked (🔓), click directly on <strong className="text-zinc-200">Category</strong> or <strong className="text-zinc-200">Status</strong> pills to change values immediately. Edits show a <code className="text-sky-400 font-mono text-[10px]">● Draft</code> indicator and commit atomically.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-1.5">
                <div className="font-semibold text-zinc-100 flex items-center gap-1.5">
                  <span>🗑️</span> Synchronized Deletions
                </div>
                <p className="text-zinc-400">
                  Deleting an item from the expanded drawer atomically cleans up both <code className="text-zinc-200 font-mono">master.json</code> and <code className="text-zinc-200 font-mono">baseline.json</code>, preventing orphan ghost baselines.
                </p>
              </div>
            </div>
          )}

          {activeSection === 'baselines' && (
            <div className="space-y-3.5">
              <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-1.5">
                <div className="font-semibold text-zinc-100 flex items-center gap-1.5">
                  <span>⚖️</span> Master vs. Baseline
                </div>
                <p className="text-zinc-400">
                  <strong className="text-zinc-200">Master</strong> is your live working scenario. <strong className="text-zinc-200">Baseline</strong> is the locked, agreed-upon financial truth. If Master differs from Baseline, rows show a cyan drift indicator.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-1.5">
                <div className="font-semibold text-zinc-100 flex items-center gap-1.5">
                  <span>🚀</span> Promoting to Baseline
                </div>
                <p className="text-zinc-400">
                  When a working figure becomes permanent, use <strong className="text-zinc-200">Promote to Baseline</strong> in the drawer. Providing a mandatory rationale permanently writes the figures into <code className="text-zinc-200 font-mono">baseline.json</code> with an audit log.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-1.5">
                <div className="font-semibold text-zinc-100 flex items-center gap-1.5">
                  <span>🔄</span> Safe Revert with Pre-Inspection
                </div>
                <p className="text-zinc-400">
                  Clicking <strong className="text-zinc-200">Revert to Baseline</strong> opens a pre-confirmation popover showing exact target amounts and diffs before restoring approved baseline values.
                </p>
              </div>
            </div>
          )}

          {activeSection === 'routes' && (
            <div className="space-y-3">
              <p className="text-zinc-400">
                Accounts are standardized with visual color micro-pips for rapid scanning:
              </p>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 rounded bg-zinc-900/80 border border-zinc-800 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                  <div>
                    <div className="font-semibold text-zinc-200">ING Everyday / Direct Debit</div>
                    <div className="text-zinc-500 text-[10px]">Living expenses & auto-debits</div>
                  </div>
                </div>
                <div className="p-2 rounded bg-zinc-900/80 border border-zinc-800 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-1 ring-emerald-400 shrink-0" />
                  <div>
                    <div className="font-semibold text-zinc-200">ING Savings</div>
                    <div className="text-zinc-500 text-[10px]">High-interest overflow & emergency</div>
                  </div>
                </div>
                <div className="p-2 rounded bg-zinc-900/80 border border-zinc-800 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-zinc-300 shrink-0" />
                  <div>
                    <div className="font-semibold text-zinc-200">MQ Joint Household</div>
                    <div className="text-zinc-500 text-[10px]">Shared bills, groceries, housing</div>
                  </div>
                </div>
                <div className="p-2 rounded bg-zinc-900/80 border border-zinc-800 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                  <div>
                    <div className="font-semibold text-zinc-200">MQ Joint Savings</div>
                    <div className="text-zinc-500 text-[10px]">Sinking funds & joint reserves</div>
                  </div>
                </div>
                <div className="p-2 rounded bg-zinc-900/80 border border-zinc-800 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400 shrink-0" />
                  <div>
                    <div className="font-semibold text-zinc-200">MQ Shae Personal / Savings</div>
                    <div className="text-zinc-500 text-[10px]">Shae discretionary & buffer</div>
                  </div>
                </div>
                <div className="p-2 rounded bg-zinc-900/80 border border-zinc-800 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0" />
                  <div>
                    <div className="font-semibold text-zinc-200">BOQ Offset</div>
                    <div className="text-zinc-500 text-[10px]">Mortgage offset facility</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'sinking' && (
            <div className="space-y-3.5">
              <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-1.5">
                <div className="font-semibold text-zinc-100 flex items-center gap-1.5">
                  <span className="text-emerald-400">1.</span> The Sinking Fund Timing Paradox
                </div>
                <p className="text-zinc-400 leading-relaxed text-[11px]">
                  Weekly allocations (e.g. BMW Rego \$21/wk = \$1,092/yr) only maintain liquidity in steady state. If a \$1,092 lump-sum debit hits in month 2 before 52 weeks have accumulated, the account drops into negative cash (overdraft) unless seeded with a buffer.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-1.5">
                <div className="font-semibold text-zinc-100 flex items-center gap-1.5">
                  <span className="text-emerald-400">2.</span> Minimum Projected Balance & Stress Test ($0)
                </div>
                <p className="text-zinc-400 leading-relaxed text-[11px]">
                  <strong>Minimum Projected Balance (Card 2)</strong> displays your real-world projected cash trough taking into account your calibrated bank balance. The trajectory chart displays a clean single balance line by default, with an optional <strong>Stress Test ($0)</strong> button to inspect theoretical zero-start drawdown troughs on demand.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-1.5">
                <div className="font-semibold text-zinc-100 flex items-center gap-1.5">
                  <span className="text-emerald-400">3.</span> BOQ Home Offset Mortgage Shield Modeling
                </div>
                <p className="text-zinc-400 leading-relaxed text-[11px]">
                  Models the full household mortgage reality: pairs Stephen's rent transfers with Shae's planned mortgage offset contribution to fully fund the $1,240.79/fn loan repayment. The offset balance acts as an interest-saving shield without artificial overdraft drift.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-1.5">
                <div className="font-semibold text-zinc-100 flex items-center gap-1.5">
                  <span className="text-emerald-400">4.</span> Isolated Reference Points & Added Dates
                </div>
                <p className="text-zinc-400 leading-relaxed text-[11px]">
                  Each account route maintains its own reference balance and exact <strong className="text-zinc-200">"Added" date</strong>. Swapping accounts never contaminates input fields. The last entered value is preserved until changed, and "All Sinking Routes" automatically sums all calibrated balances.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-1.5">
                <div className="font-semibold text-zinc-100 flex items-center gap-1.5">
                  <span className="text-emerald-400">5.</span> ING Everyday (Salary Hub) Modeling
                </div>
                <p className="text-zinc-400 leading-relaxed text-[11px]">
                  Simulates Stephen's master salary account: tracks $1,489.08/wk salary inflow against automated transfers departing to joint accounts, savings, and BOQ (-$760.73/wk), plus everyday direct debits and card spend. Visualizes weekly unallocated operational surplus (~+$320.17/wk).
                </p>
              </div>
            </div>
          )}

          {activeSection === 'property' && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-1.5">
                <div className="font-semibold text-zinc-100 flex items-center gap-1.5">
                  <span className="text-emerald-400">1.</span> 1-Click WhatsApp Quick-Capture & Smart Extraction
                </div>
                <p className="text-zinc-400 leading-relaxed text-[11px]">
                  Paste any WhatsApp message snippet, Domain link, or RealEstate.com.au URL into the dropzone. The built-in regex extractor automatically detects the listing link, guide price (e.g. <code>$1.25m</code>), weekly rent appraisal, bedroom/bathroom counts, and suburb address in one click.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-1.5">
                <div className="font-semibold text-zinc-100 flex items-center gap-1.5">
                  <span className="text-emerald-400">2.</span> Dual Independent Star Ratings (Stephen & Shae)
                </div>
                <p className="text-zinc-400 leading-relaxed text-[11px]">
                  Both Stephen and Shae have independent 5-star rating controls on each shortlisted property. Stars can be tapped directly on the property card or edited in the intake modal, with real-time persistence to <code>data/properties.json</code>.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-1.5">
                <div className="font-semibold text-zinc-100 flex items-center gap-1.5">
                  <span className="text-emerald-400">3.</span> 1-Click "Model in Matrix" Dynamic Simulation
                </div>
                <p className="text-zinc-400 leading-relaxed text-[11px]">
                  Clicking <strong className="text-emerald-400">⚡ Model in Matrix</strong> on any shortlisted property feeds that exact home price into the Purchasing Matrix below. It dynamically calculates QLD Transfer Duty, registration fees, 85% LVR capitalized LMI, and deposit readiness against your live verified savings rate.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-1.5">
                <div className="font-semibold text-zinc-100 flex items-center gap-1.5">
                  <span className="text-emerald-400">4.</span> Triage Status Pipeline & Atomic Vault Storage
                </div>
                <p className="text-zinc-400 leading-relaxed text-[11px]">
                  Tag homes across four clear operational states: <code className="text-emerald-400 font-mono text-[10px]">Priority Shortlist</code>, <code className="text-amber-400 font-mono text-[10px]">Open Home / Inspect</code>, <code className="text-blue-400 font-mono text-[10px]">Watching & Reviewing</code>, or <code className="text-zinc-400 font-mono text-[10px]">Passed / Ruled Out</code>. Entries are atomically backed up with timestamps.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-1.5">
                <div className="font-semibold text-zinc-100 flex items-center gap-1.5">
                  <span className="text-emerald-400">5.</span> Right Now Assessment, Repayments & Closing Costs Drawer
                </div>
                <p className="text-zinc-400 leading-relaxed text-[11px]">
                  Assesses liquid capital readiness <strong>Right Now (Today)</strong> at $225,000 alongside 3, 6, and 12-month compounding horizons, and computes earliest technical settlement dates. Toggle between Weekly, Fortnightly, and Monthly loan repayments, and click <strong>Inspect</strong> to review an itemized breakdown of QLD transfer duty, conveyancing, B&P inspection, and registry fees.
                </p>
              </div>
            </div>
          )}

          {activeSection === 'shortcuts' && (
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-1">
                  <div className="font-semibold text-zinc-200 flex items-center justify-between">
                    <span>Dismiss Overlays</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px] font-mono">Esc</kbd>
                  </div>
                  <p className="text-zinc-400 text-[11px]">Instantly closes active drawers, modals, or help overlays.</p>
                </div>
                <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-1">
                  <div className="font-semibold text-zinc-200 flex items-center justify-between">
                    <span>Toggle Actor</span>
                    <span className="text-[10px] font-mono text-emerald-400">1-Click Dock</span>
                  </div>
                  <p className="text-zinc-400 text-[11px]">Clicking the dock actor pill swaps between Stephen and Shae.</p>
                </div>
                <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-1">
                  <div className="font-semibold text-zinc-200 flex items-center justify-between">
                    <span>Lock Engine</span>
                    <span className="text-[10px] font-mono text-zinc-400">🔒 Dock / Top</span>
                  </div>
                  <p className="text-zinc-400 text-[11px]">Locks all rows into read-only mode and auto-dismisses open drawers.</p>
                </div>
                <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-1">
                  <div className="font-semibold text-zinc-200 flex items-center justify-between">
                    <span>Scroll to Top</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px] font-mono">↑</kbd>
                  </div>
                  <p className="text-zinc-400 text-[11px]">Smoothly scrolls to top KPI metrics cards.</p>
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-800 text-[11px] text-zinc-400 flex items-center justify-between">
                <span>Full detailed SOP document available in workspace root:</span>
                <code className="text-emerald-400 font-mono text-[10px]">OPERATIONS.md</code>
              </div>
            </div>
          )}
        </CardContent>

        {/* Footer */}
        <CardFooter className="p-3.5 px-5 bg-zinc-900/60 border-t border-zinc-800 flex justify-between items-center text-xs text-zinc-500">
          <span>Press <kbd className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-[10px] text-zinc-300">Esc</kbd> anytime to exit</span>
          <Button size="sm" variant="outline" onClick={onClose} className="h-7 px-3 text-xs border-zinc-700 cursor-pointer">
            Got it
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
