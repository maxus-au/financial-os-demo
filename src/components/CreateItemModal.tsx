import { useState, useEffect } from 'react';
import type { FinancialItem } from '../types';
import type { Cadence } from '../utils/financeMath';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Props {
  owner: string;
  allCategories: string[];
  allRoutes: string[];
  onClose: () => void;
  onCreate: (item: Partial<FinancialItem>) => Promise<{success: boolean, error?: string}>;
}

const DEFAULT_CATEGORIES = [
  'Income',
  'Housing',
  'Food',
  'Utilities',
  'Debt',
  'Health',
  'Insurances',
  'Pet',
  'Transport',
  'Savings',
  'Lifestyle',
  'Subscriptions',
  'Grooming',
  'Personal'
];

export default function CreateItemModal({ owner, allCategories = [], allRoutes = [], onClose, onCreate }: Props) {
  const categories = Array.from(new Set([...DEFAULT_CATEGORIES, ...allCategories]));

  const [createForm, setCreateForm] = useState<Partial<FinancialItem>>({ 
    owner, 
    direction: 'Outflow', 
    cadence: 'Weekly', 
    category: 'Food', 
    verification_status: 'Verified', 
    native_amount: undefined,
    account_route: allRoutes[0] || ''
  });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleCategoryChange = (cat: string) => {
    let direction: 'Inflow' | 'Outflow' | 'Transfer' = 'Outflow';
    const lower = cat.toLowerCase();
    if (lower.includes('income')) direction = 'Inflow';
    else if (lower.includes('saving') || lower.includes('transfer')) direction = 'Transfer';
    
    setCreateForm(prev => ({
      ...prev,
      category: cat,
      direction
    }));
  };

  const handleCreateSave = async () => {
    setErrorMsg(null);
    const amt = Number(createForm.native_amount);
    if (createForm.native_amount === undefined || String(createForm.native_amount) === '' || isNaN(amt) || amt <= 0) {
      setErrorMsg('Please enter a valid positive amount.');
      return;
    }
    if (!createForm.description?.trim()) {
      setErrorMsg('Item description is mandatory.');
      return;
    }
    if (!createForm.category) {
      setErrorMsg('Category is mandatory.');
      return;
    }
    if (!createForm.account_route) {
      setErrorMsg('Account route is mandatory.');
      return;
    }
    
    setSaving(true);
    
    const payload = { 
      ...createForm, 
      description: createForm.description.trim(),
      native_amount: amt 
    };

    const res = await onCreate(payload);
    
    if (!res.success) {
      setErrorMsg(res.error || 'Failed to create item');
      setSaving(false);
    } else {
      setSaving(false);
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <Card className="w-full max-w-lg bg-card border-border shadow-2xl rounded-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        <CardHeader className="pb-4 border-b border-border/80 bg-muted/20">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold text-foreground">Add New Financial Item</CardTitle>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
              {owner}
            </span>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            Item will be placed into the appropriate tier and registered with a baseline snapshot.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="p-6 space-y-4">
          {/* Description */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Description</label>
            <Input 
              type="text" 
              placeholder="e.g. Woolworths Groceries, Rent, Netflix" 
              value={createForm.description || ''} 
              onChange={e => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
              autoFocus
              className="text-sm font-medium"
            />
          </div>
          
          {/* Category & Direction */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Category</label>
              <select 
                value={createForm.category || ''} 
                onChange={e => handleCategoryChange(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-input bg-card text-foreground text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-ring"
              >
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Direction</label>
              <select 
                value={createForm.direction || 'Outflow'} 
                onChange={e => setCreateForm(prev => ({ ...prev, direction: e.target.value as any }))}
                className="w-full h-9 px-3 rounded-md border border-input bg-card text-foreground text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-ring"
              >
                <option value="Inflow">↓ Inflow (Income)</option>
                <option value="Outflow">↑ Outflow (Expense)</option>
                <option value="Transfer">⇄ Transfer (Account-to-Account)</option>
              </select>
            </div>
          </div>

          {/* Amount & Cadence */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Native Amount</label>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-muted-foreground font-mono font-bold text-sm">$</span>
                <Input 
                  type="number" 
                  step="0.01"
                  min="0"
                  placeholder="0.00" 
                  value={createForm.native_amount === undefined ? '' : createForm.native_amount} 
                  onChange={e => setCreateForm(prev => ({ ...prev, native_amount: e.target.value as any }))} 
                  className="pl-7 font-mono font-bold text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Cadence</label>
              <select 
                value={createForm.cadence || 'Weekly'} 
                onChange={e => setCreateForm(prev => ({ ...prev, cadence: e.target.value as Cadence }))}
                className="w-full h-9 px-3 rounded-md border border-input bg-card text-foreground text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-ring"
              >
                {['Weekly', 'Fortnightly', 'Monthly', 'Quarterly', 'Semi-Annual', 'Annual'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Account Route & Verification */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Account Route</label>
              <select 
                value={createForm.account_route || ''} 
                onChange={e => setCreateForm(prev => ({ ...prev, account_route: e.target.value }))}
                className="w-full h-9 px-3 rounded-md border border-input bg-card text-foreground text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-ring"
              >
                <option value="" disabled>Select Route...</option>
                {allRoutes.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Verification Status</label>
              <select 
                value={createForm.verification_status || 'Verified'} 
                onChange={e => setCreateForm(prev => ({ ...prev, verification_status: e.target.value }))}
                className="w-full h-9 px-3 rounded-md border border-input bg-card text-foreground text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-ring"
              >
                <option value="Verified">✓ Verified</option>
                <option value="Archived / Paid Off">🎉 Archived / Paid Off</option>
                <option value="Needs Verification with Jordan">⚠️ Needs Jordan</option>
                <option value="Needs Verification with Alex">⚠️ Needs Alex</option>
              </select>
            </div>
          </div>

          {/* Source Authority */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Source Authority (Optional)</label>
            <Input 
              type="text" 
              placeholder="e.g. Bank Statement, GCCC Rates, Agreed Option 1" 
              value={createForm.source_authority || ''} 
              onChange={e => setCreateForm(prev => ({ ...prev, source_authority: e.target.value }))}
              className="text-sm"
            />
          </div>
          
          {/* Notes */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Context & Notes (Optional)</label>
            <textarea 
              placeholder="General context or notes about this item..." 
              value={createForm.notes || ''} 
              onChange={e => setCreateForm(prev => ({ ...prev, notes: e.target.value }))} 
              className="w-full min-h-[64px] p-2.5 rounded-md border border-input bg-card text-foreground text-xs leading-relaxed focus:outline-hidden focus:ring-2 focus:ring-ring"
            />
          </div>

          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs font-semibold">
              {errorMsg}
            </div>
          )}
        </CardContent>

        <CardFooter className="p-4 px-6 bg-muted/20 border-t border-border flex justify-end gap-2.5">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving} className="cursor-pointer">
            Cancel
          </Button>
          <Button size="sm" onClick={handleCreateSave} disabled={saving} className="cursor-pointer font-semibold shadow-xs">
            {saving ? 'Creating...' : '+ Create Item'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
