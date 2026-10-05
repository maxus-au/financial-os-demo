import React, { useState, useEffect } from 'react';
import type { FinancialItem } from '../types';
import type { Cadence } from '../utils/financeMath';
import { calculateMetrics, formatCurrency } from '../utils/financeMath';
import CreateItemModal from './CreateItemModal';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  History, Trash2, X, ArrowRight, Clock, RotateCcw, CheckCircle2,
  Search, Plus, AlertTriangle, ShieldAlert, HeartPulse, PiggyBank, Sparkles, Wallet
} from 'lucide-react';

interface Props {
  items: FinancialItem[];
  baselines?: FinancialItem[];
  owner: string;
  isLocked: boolean;
  onUpdate: (item: FinancialItem, reason?: string) => Promise<{success: boolean, error?: string}>;
  onRevert: (id: string) => Promise<{success: boolean, error?: string}>;
  onPromote: (id: string, reason: string) => Promise<{success: boolean, error?: string}>;
  onApproveBaseline: (id: string) => Promise<{success: boolean, error?: string}>;
  onRejectBaseline: (id: string) => Promise<{success: boolean, error?: string}>;
  onCreate: (item: Partial<FinancialItem>) => Promise<{success: boolean, error?: string}>;
  onDelete: (id: string) => Promise<{success: boolean, error?: string}>;
  onDeleteAuditLog?: (itemId: string, logIndex: number) => Promise<{success: boolean, error?: string}>;
  onClearAuditLogs?: (itemId: string) => Promise<{success: boolean, error?: string}>;
  sessionActor: string | null;
}

const MASTER_CATEGORIES = [
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

const MASTER_ROUTES = [
  'ING • Everyday',
  'ING • Direct Debit',
  'ING • Savings',
  'MQ • Joint Household',
  'MQ • Joint Savings',
  'MQ • Jordan Personal',
  'MQ • Jordan Savings',
  'MQ • Alex Personal',
  'BOQ • Home Offset',
  'UBank • High Interest',
  'New Mortgage • Offset'
];

export default function ItemGrid({ items, baselines = [], owner, isLocked, onUpdate, onRevert, onPromote, onApproveBaseline, onRejectBaseline, onCreate, onDelete, onDeleteAuditLog, onClearAuditLogs, sessionActor }: Props) {
  const [globalCadence, setGlobalCadence] = useState<Cadence>(owner === 'Jordan' ? 'Fortnightly' : 'Weekly');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<FinancialItem>>({});
  const [editReason, setEditReason] = useState<string>('');
  
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAttention, setFilterAttention] = useState(false);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
      const initial: Record<string, boolean> = {};
      items.forEach(i => {
          initial[`${owner}:${i.category}`] = true;
      });
      return initial;
  });
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [confirmClearHistoryId, setConfirmClearHistoryId] = useState<string | null>(null);
  const [confirmRevertId, setConfirmRevertId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  const [promoteId, setPromoteId] = useState<string | null>(null);
  const [promoteReason, setPromoteReason] = useState<string>('');

  // Lock dismissal: when dashboard locks, dismiss any active drawer or confirm dialogs
  useEffect(() => {
    if (isLocked) {
      setEditingId(null);
      setConfirmRevertId(null);
      setPromoteId(null);
      setDeleteConfirmId(null);
      setConfirmClearHistoryId(null);
    }
  }, [isLocked]);

  // Escape key listener: quickly dismiss active drawers and prompts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEditingId(null);
        setConfirmRevertId(null);
        setPromoteId(null);
        setDeleteConfirmId(null);
        setHistoryId(null);
        setConfirmClearHistoryId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const allCategories = Array.from(new Set([...MASTER_CATEGORIES, ...items.map(i => i.category)]));
  const allRoutes = Array.from(new Set([...MASTER_ROUTES, ...items.map(i => i.account_route).filter(Boolean)]));

  const handleInlineUpdate = async (item: FinancialItem, field: string, value: string) => {
      // @ts-ignore
      if (item[field] === value) return;
      const updated = { ...item, [field]: value };
      const res = await onUpdate(updated as FinancialItem, `Inline update: ${field}`);
      if (!res.success) setErrorMsg(res.error || `Failed to update ${field}`);
  };

  const handleEditClick = (item: FinancialItem) => {
    if (editingId === item.id) {
      setEditingId(null);
      setEditForm({} as any);
      setEditReason('');
      setErrorMsg(null);
      return;
    }
    setEditingId(item.id);
    setEditForm({ ...item } as any);
    setEditReason('');
    setErrorMsg(null);
    setHistoryId(null);
    setPromoteId(null);
  };

  const handleSave = async (originalItem: FinancialItem) => {
    setErrorMsg(null);
    if (editForm.native_amount === undefined || isNaN(Number(editForm.native_amount))) {
        setErrorMsg('Invalid amount');
        return;
    }
    
    setSaving(true);
    
    const updated = { ...originalItem, ...editForm, native_amount: Number(editForm.native_amount) };

    const res = await onUpdate(updated as FinancialItem, editReason);
    
    if (!res.success) {
        setErrorMsg(res.error || 'Failed to save');
        setSaving(false);
    } else {
        setSaving(false);
        setEditingId(null);
    }
  };

  const executePromote = async (id: string) => {
      if (!promoteReason.trim()) {
          setErrorMsg('Audit note is strictly required for baseline promotion.');
          return;
      }
      const res = await onPromote(id, promoteReason);
      if (!res.success) setErrorMsg(res.error || 'Failed to promote');
      else {
          setPromoteId(null);
          setPromoteReason('');
          setErrorMsg(null);
      }
  };

  const executeRevert = async (id: string) => {
      const res = await onRevert(id);
      if (!res.success) setErrorMsg(res.error || 'Failed to revert');
      else {
          setConfirmRevertId(null);
          setEditingId(null);
      }
  };

  const executeDelete = async (id: string) => {
      const res = await onDelete(id);
      if (!res.success) setErrorMsg(res.error || 'Failed to delete');
      else setDeleteConfirmId(null);
  };
  const getStatusColor = (status: string) => {
      const lower = (status || '').toLowerCase();
      if (lower.includes('paid off') || lower.includes('archived')) {
          return { bg: 'bg-emerald-500/15', text: 'text-emerald-400 font-semibold', border: 'border-emerald-500/30', label: '🎉 Paid Off', icon: '🎉' };
      }
      if (!status || lower.startsWith('verified')) {
          return { bg: 'bg-muted/40', text: 'text-muted-foreground/80', border: 'border-border/40', label: '✓ ' + (status || 'Verified'), icon: '✓' };
      }
      if (lower.includes('jordan')) {
          return { bg: 'bg-rose-500/10', text: 'text-rose-400 dark:text-rose-300', border: 'border-rose-500/25', label: '⚠️ Needs Jordan', icon: '⚠️' };
      }
      if (lower.includes('alex')) {
          return { bg: 'bg-yellow-500/10', text: 'text-yellow-200 dark:text-yellow-200', border: 'border-yellow-500/25', label: '⚠️ Needs Alex', icon: '⚠️' };
      }
      return { bg: 'bg-yellow-500/10', text: 'text-yellow-200 dark:text-yellow-200', border: 'border-yellow-500/25', label: '⚠️ Unverified', icon: '⚠️' };
  };

  const getCategoryStyle = (cat: string) => {
      const lower = (cat || '').toLowerCase();
      if (lower.includes('income')) return { bg: 'bg-emerald-500/10', text: 'text-emerald-500 dark:text-emerald-400', border: 'border-emerald-500/20', emoji: '💰' };
      if (lower.includes('housing')) return { bg: 'bg-sky-500/10', text: 'text-sky-500 dark:text-sky-400', border: 'border-sky-500/20', emoji: '🏠' };
      if (lower.includes('food')) return { bg: 'bg-orange-500/10', text: 'text-orange-500 dark:text-orange-400', border: 'border-orange-500/20', emoji: '🍔' };
      if (lower.includes('utilities')) return { bg: 'bg-cyan-500/10', text: 'text-cyan-500 dark:text-cyan-400', border: 'border-cyan-500/20', emoji: '⚡' };
      if (lower.includes('insurances') || lower.includes('insurance')) return { bg: 'bg-indigo-500/10', text: 'text-indigo-500 dark:text-indigo-400', border: 'border-indigo-500/20', emoji: '🛡️' };
      if (lower.includes('health')) return { bg: 'bg-pink-500/10', text: 'text-pink-500 dark:text-pink-400', border: 'border-pink-500/20', emoji: '⚕️' };
      if (lower.includes('grooming')) return { bg: 'bg-fuchsia-500/10', text: 'text-fuchsia-500 dark:text-fuchsia-400', border: 'border-fuchsia-500/20', emoji: '✂️' };
      if (lower.includes('debt')) return { bg: 'bg-rose-500/10', text: 'text-rose-500 dark:text-rose-400', border: 'border-rose-500/20', emoji: '💳' };
      if (lower.includes('personal')) return { bg: 'bg-purple-500/10', text: 'text-purple-500 dark:text-purple-400', border: 'border-purple-500/20', emoji: '🛍️' };
      if (lower.includes('lifestyle')) return { bg: 'bg-teal-500/10', text: 'text-teal-500 dark:text-teal-400', border: 'border-teal-500/20', emoji: '🥂' };
      if (lower.includes('living')) return { bg: 'bg-teal-500/10', text: 'text-teal-500 dark:text-teal-400', border: 'border-teal-500/20', emoji: '🛒' };
      if (lower.includes('transport')) return { bg: 'bg-muted/40', text: 'text-muted-foreground', border: 'border-border/40', emoji: '🚗' };
      if (lower.includes('subscription')) return { bg: 'bg-muted/40', text: 'text-muted-foreground', border: 'border-border/40', emoji: '📺' };
      if (lower.includes('pet')) return { bg: 'bg-orange-500/10', text: 'text-orange-500 dark:text-orange-400', border: 'border-orange-500/20', emoji: '🐶' };
      if (lower.includes('transfer') || lower.includes('savings')) return { bg: 'bg-blue-500/10', text: 'text-blue-500 dark:text-blue-400', border: 'border-blue-500/20', emoji: '🏦' };
      return { bg: 'bg-muted/40', text: 'text-muted-foreground', border: 'border-border/40', emoji: '📁' };
  };

  const getRouteMeta = (route: string, isIncome: boolean = false) => {
      if (!route) {
          return {
              bankName: 'None',
              pipColor: 'bg-muted-foreground/30',
              arrow: '',
              arrowColor: '',
              bg: 'bg-muted/30',
              text: 'text-muted-foreground',
              border: 'border-border/40',
              tooltip: 'No route assigned'
          };
      }
      const lower = route.toLowerCase();
      let bankName = route;
      let pipColor = 'bg-zinc-400';
      let arrow = isIncome ? '↓' : '↑';
      let arrowColor = isIncome ? 'text-emerald-400' : 'text-rose-400';
      let tooltip = route;

      const isTransfer = lower.includes('transfer') || lower.includes('sinking') || lower.includes('save') || lower.includes('savings') || lower.includes('offset');
      if (isTransfer && !isIncome) {
          arrow = '⇄';
          arrowColor = 'text-sky-400';
      }

      if (lower.includes('mq joint') || lower.includes('household')) {
          bankName = 'MQ • Joint';
          pipColor = 'bg-zinc-300 ring-1 ring-zinc-500';
          tooltip = 'Macquarie Joint Household Account';
      } else if (lower.includes('joint savings') || lower.includes('mq save')) {
          bankName = 'MQ • Joint Savings';
          pipColor = 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]';
          tooltip = 'Macquarie Joint Savings & Sinking Fund';
      } else if (lower.includes('jordan savings')) {
          bankName = 'MQ • Jordan Savings';
          pipColor = 'bg-fuchsia-400 ring-1 ring-fuchsia-300 shadow-[0_0_6px_rgba(232,121,249,0.6)]';
          tooltip = 'Macquarie Jordan Personal Savings';
      } else if (lower.includes('jordan') && lower.includes('mq')) {
          bankName = 'MQ • Jordan';
          pipColor = 'bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.6)]';
          tooltip = 'Macquarie Jordan Personal Transaction';
      } else if (lower.includes('alex') && lower.includes('mq')) {
          bankName = 'MQ • Alex';
          pipColor = 'bg-slate-400 ring-1 ring-slate-300';
          tooltip = 'Macquarie Alex Personal Account';
      } else if (lower.includes('ing')) {
          if (lower.includes('direct debit')) {
              bankName = 'ING • Direct Debit';
              pipColor = 'bg-[#ff6200] ring-1 ring-orange-300 shadow-[0_0_6px_rgba(255,98,0,0.6)]';
              tooltip = 'ING Orange Everyday (Automated Direct Debit)';
          } else if (lower.includes('save') || lower.includes('sinking')) {
              bankName = 'ING • Savings';
              pipColor = 'bg-[#ff6200] ring-2 ring-emerald-400 shadow-[0_0_6px_rgba(255,98,0,0.6)]';
              tooltip = 'ING Savings Maximiser (Sinking Reserves)';
          } else {
              bankName = 'ING • Everyday';
              pipColor = 'bg-[#ff6200] shadow-[0_0_6px_rgba(255,98,0,0.6)]';
              tooltip = 'ING Orange Everyday (Primary Spend)';
          }
      } else if (lower.includes('boq')) {
          bankName = 'BOQ • Offset';
          pipColor = 'bg-[#0066b2] shadow-[0_0_6px_rgba(0,102,178,0.6)]';
          tooltip = 'Bank of Queensland Home Mortgage Offset';
      } else if (lower.includes('ubank')) {
          bankName = 'UBank • Savings';
          pipColor = 'bg-purple-500 shadow-[0_0_6px_rgba(168,85,247,0.6)]';
          tooltip = 'UBank High-Interest Savings Account';
      } else if (lower.includes('mortgage') || lower.includes('new bank')) {
          bankName = 'New Bank • Offset';
          pipColor = 'bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.6)]';
          tooltip = 'Future Property Purchase Mortgage Account';
      } else if (lower.includes('revolut')) {
          bankName = 'Revolut';
          pipColor = 'bg-[#8b5cf6] shadow-[0_0_6px_rgba(139,92,246,0.6)]';
          tooltip = 'Revolut Multi-Currency / Virtual Card';
      } else if (lower.includes('paypal')) {
          bankName = 'PayPal';
          pipColor = 'bg-[#0079c1] shadow-[0_0_6px_rgba(0,121,193,0.6)]';
          tooltip = 'PayPal Checkout Bridge';
      }

      return {
          bankName,
          pipColor,
          arrow,
          arrowColor,
          bg: 'bg-card dark:bg-zinc-900',
          text: 'text-foreground',
          border: 'border-border',
          tooltip
      };
  };

  const renderRow = (item: FinancialItem) => {
      const metrics = calculateMetrics(item.native_amount, item.cadence);
      const isNewItem = !baselines.some(b => b.id === item.id);
      const baselineItem = baselines.find(b => b.id === item.id) || item;
      const baselineAnnual = calculateMetrics(baselineItem.native_amount, baselineItem.cadence).annual;

      const isDrifted = baselineItem && (baselineItem.native_amount !== item.native_amount || baselineItem.cadence !== item.cadence || baselineItem.category !== item.category || baselineItem.description !== item.description || baselineItem.verification_status !== item.verification_status || baselineItem.account_route !== item.account_route);
      const isCategoryDirty = baselineItem && item.category !== baselineItem.category;
      const isStatusDirty = baselineItem && item.verification_status !== baselineItem.verification_status;
      const isRouteDirty = baselineItem && item.account_route !== baselineItem.account_route;
      const isMathDirty = baselineItem && (item.native_amount !== baselineItem.native_amount || item.cadence !== baselineItem.cadence);
      
      const revertDiffs: { label: string; from: string; to: string }[] = [];
      if (baselineItem) {
          if (Number(item.native_amount) !== Number(baselineItem.native_amount) || item.cadence !== baselineItem.cadence) {
              revertDiffs.push({
                  label: 'Amount',
                  from: `${formatCurrency(item.native_amount)} / ${item.cadence}`,
                  to: `${formatCurrency(baselineItem.native_amount)} / ${baselineItem.cadence}`
              });
          }
          if (item.verification_status !== baselineItem.verification_status) {
              revertDiffs.push({
                  label: 'Status',
                  from: item.verification_status || '(empty)',
                  to: baselineItem.verification_status || '(empty)'
              });
          }
          if (item.account_route !== baselineItem.account_route) {
              revertDiffs.push({
                  label: 'Route',
                  from: item.account_route || '(empty)',
                  to: baselineItem.account_route || '(empty)'
              });
          }
          if (item.category !== baselineItem.category) {
              revertDiffs.push({
                  label: 'Category',
                  from: item.category || '(empty)',
                  to: baselineItem.category || '(empty)'
              });
          }
          if (item.description !== baselineItem.description) {
              revertDiffs.push({
                  label: 'Description',
                  from: item.description || '(empty)',
                  to: baselineItem.description || '(empty)'
              });
          }
      }

      // @ts-ignore
      const auditTrail = [...(item.audit_trail || [])].reverse();

      const statusColors = getStatusColor(item.verification_status || '');
      const catStyle = getCategoryStyle(item.category || '');
      const isIncome = (item.category || '').toLowerCase().includes('income');
      const routeMeta = getRouteMeta(item.account_route || '', isIncome);

      let editDrawer = null;
      if (editingId === item.id) {
          const proposedAnnual = calculateMetrics(Number(editForm.native_amount) || 0, (editForm.cadence || 'Weekly') as Cadence).annual;
          const deltaAnnual = proposedAnnual - baselineAnnual;
          const percentChange = baselineAnnual === 0 ? (deltaAnnual > 0 ? 100 : 0) : (deltaAnnual / baselineAnnual) * 100;
          const isAnomaly = Math.abs(percentChange) >= 15 && Math.abs(deltaAnnual) >= 120;
          
          editDrawer = (
              <TableRow key={`edit-${item.id}`} className="relative z-10 border-b-0 hover:bg-transparent">
                  <TableCell colSpan={7} className="p-0 px-6 pb-6 pt-2">
                      <div className="bg-muted/50 rounded-b-xl border border-t-0 border-border shadow-lg overflow-hidden">
                          <div className="p-6 pb-0">
                            <div className="flex gap-3 items-center mb-6">
                                <span className="bg-accent text-foreground px-2 py-1 rounded text-xs font-mono font-bold">#{item.id}</span>
                                <select 
                                    value={editForm.category || ''} 
                                    onChange={e => setEditForm({...editForm, category: e.target.value})} 
                                    className="w-48 p-2 border border-border rounded-md font-semibold text-sm bg-card"
                                >
                                    {allCategories.map(c => <option key={c as string} value={c as string}>{c as string}</option>)}
                                </select>
                                <Input 
                                    type="text" 
                                    value={editForm.description || ''} 
                                    onChange={e => setEditForm({...editForm, description: e.target.value})} 
                                    className="flex-1 font-semibold text-base" 
                                    placeholder="Item Description" 
                                />
                            </div>
                            
                            <div className="flex gap-4 mb-6">
                                <div className="bg-card border border-border p-4 rounded-lg flex-1">
                                    <div className="text-xs text-muted-foreground font-bold uppercase mb-2">Baseline Source</div>
                                    <div className="text-xl font-bold text-foreground">{formatCurrency(baselineItem.native_amount)} <span className="text-sm text-muted-foreground font-medium">/ {baselineItem.cadence}</span></div>
                                    <div className="text-sm text-muted-foreground mt-1">({formatCurrency(baselineAnnual)} / year)</div>
                                </div>
                                
                                <div className="bg-primary/10 border border-primary/20 p-4 rounded-lg flex-[1.5]">
                                    <div className="text-xs text-primary font-bold uppercase mb-2">Proposed Input</div>
                                    <div className="flex gap-2 items-center">
                                        <span className="text-xl font-bold text-foreground">$</span>
                                        <Input type="number" value={editForm.native_amount || 0} onChange={e => setEditForm({...editForm, native_amount: parseFloat(e.target.value) || 0})} className="w-32 text-lg font-semibold border-blue-500/30" />
                                        <select value={editForm.cadence} onChange={e => setEditForm({...editForm, cadence: e.target.value as Cadence})} className="p-2 text-lg font-semibold border border-primary/30 rounded-md bg-card">
                                            {['Weekly', 'Fortnightly', 'Monthly', 'Quarterly', 'Semi-Annual', 'Annual'].map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                </div>
                                
                                <div className="bg-card border border-border p-4 rounded-lg flex-1 flex flex-col justify-center">
                                    <div className="text-xs text-muted-foreground font-bold uppercase mb-2">Variance</div>
                                    <div className={"font-extrabold text-xl " + (isAnomaly ? 'text-rose-600' : 'text-emerald-600')}>
                                        {deltaAnnual > 0 ? '+' : ''}{percentChange.toFixed(1)}% 
                                    </div>
                                    <div className="text-sm text-muted-foreground mt-1">({deltaAnnual > 0 ? '+' : ''}{formatCurrency(deltaAnnual)} / yr)</div>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4 mb-6">
                                <div>
                                    <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase">Verification</label>
                                    <select value={editForm.verification_status || ''} onChange={e => setEditForm({...editForm, verification_status: e.target.value})} className="w-full p-2 border border-border rounded-md font-semibold text-sm bg-card">
                                        <option value="Verified">Verified</option>
                                        <option value="Archived / Paid Off">🎉 Archived / Paid Off</option>
                                        <option value="Needs Verification with Jordan">Needs Verification with Jordan</option>
                                        <option value="Needs Verification with Alex">Needs Verification with Alex</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase">Account Route</label>
                                    <select value={editForm.account_route || ''} onChange={e => setEditForm({...editForm, account_route: e.target.value})} className="w-full p-2 border border-border rounded-md font-semibold text-sm bg-card">
                                        <option value="">None</option>
                                        {allRoutes.map(r => <option key={r as string} value={r as string}>{r as string}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase">Source Authority</label>
                                    <Input type="text" value={editForm.source_authority || ''} onChange={e => setEditForm({...editForm, source_authority: e.target.value})} placeholder="e.g., Bank Statement" className="w-full" />
                                </div>
                            </div>
                            
                            <div className="mb-6">
                                <textarea value={editForm.notes || ''} onChange={e => setEditForm({...editForm, notes: e.target.value})} className="w-full p-3 min-h-[60px] border border-border rounded-md font-sans text-sm" placeholder="General context or notes about this item..." />
                            </div>

                          {isAnomaly && <div className="text-rose-600 text-sm mb-2 font-semibold">⚠️ Anomaly detected (≥15% & ≥$120/yr). Audit note strictly required.</div>}
                          <Input 
                              type="text" 
                              placeholder={isAnomaly ? "Mandatory Audit Note (Why did this amount change?)..." : "Optional Audit Note..."} 
                              value={editReason} 
                              onChange={e => setEditReason(e.target.value)} 
                              className={"w-full p-3 text-base " + (isAnomaly && !editReason.trim() ? 'border-2 border-rose-600' : 'border border-input')} 
                          />
                      </div>

                      {errorMsg && <div className="text-rose-600 mb-4 p-3 bg-rose-500/10 rounded-md border border-rose-500/20 mx-6 mt-4">{errorMsg}</div>}

                      <div className="flex gap-3 justify-between bg-transparent p-4 px-6 mt-4 border-t border-border items-center">
                          <div className="flex gap-3 items-center">
                              <Button onClick={() => handleSave(item)} disabled={saving} >
                                  {saving ? 'Saving...' : 'Save to JSON'}
                              </Button>
                              <Button variant="outline" onClick={() => setEditingId(null)} className="font-semibold text-muted-foreground">Cancel</Button>
                              
                              {!isNewItem && (
                                  isDrifted ? (
                                      confirmRevertId === item.id ? (
                                          <div className="flex flex-col gap-2 ml-3 p-3 rounded-lg bg-zinc-950/90 border border-zinc-800 text-left shadow-lg">
                                              <div className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                                                  <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                                                  <span>Revert to Baseline? Restoring:</span>
                                              </div>
                                              <div className="space-y-1">
                                                  {revertDiffs.map((d, i) => (
                                                      <div key={i} className="text-[11px] font-mono bg-zinc-900/90 p-1 px-2 rounded border border-zinc-800 flex items-center justify-between gap-2">
                                                          <span className="text-zinc-400 font-sans">{d.label}:</span>
                                                          <div className="flex items-center gap-1.5">
                                                              <span className="text-rose-400/80 line-through text-[10px]">{d.from}</span>
                                                              <span className="text-zinc-500 text-[10px]">➔</span>
                                                              <span className="text-emerald-400 font-semibold text-[10px]">{d.to}</span>
                                                          </div>
                                                      </div>
                                                  ))}
                                              </div>
                                              <div className="flex items-center gap-2 mt-1">
                                                  <Button size="sm" onClick={() => executeRevert(item.id)} className="h-6 px-3 text-xs bg-cyan-600 hover:bg-cyan-500 text-white font-semibold shadow-xs">
                                                      Confirm Revert
                                                  </Button>
                                                  <Button size="sm" variant="ghost" onClick={() => setConfirmRevertId(null)} className="h-6 px-2 text-xs text-zinc-400 hover:text-zinc-200">
                                                      Cancel
                                                  </Button>
                                              </div>
                                          </div>
                                      ) : (
                                          <Button 
                                              variant="outline" 
                                              onClick={() => setConfirmRevertId(item.id)} 
                                              className="ml-3 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/10 font-semibold gap-1.5 text-xs"
                                          >
                                              <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                                              Revert to Baseline ({formatCurrency(baselineItem.native_amount)} / {baselineItem.cadence})
                                          </Button>
                                      )
                                  ) : (
                                      <div className="ml-3 px-2.5 py-1 rounded-md bg-zinc-900/80 border border-zinc-800 text-[11px] font-mono text-zinc-400 flex items-center gap-1.5">
                                          <span className="text-emerald-400">✓</span>
                                          Aligned with Baseline ({formatCurrency(baselineItem.native_amount)} / {baselineItem.cadence})
                                      </div>
                                  )
                              )}
                          </div>
                          <div>
                              {deleteConfirmId === item.id ? (
                                  <div className="flex gap-2 items-center bg-rose-500/10 p-1.5 px-3 rounded-md border border-rose-500/20">
                                      <span className="text-rose-600 text-sm font-semibold">Are you sure?</span>
                                      <Button size="sm" variant="destructive" onClick={() => executeDelete(item.id)} className="h-7 px-3">Yes, Delete</Button>
                                      <Button size="sm" variant="ghost" onClick={() => setDeleteConfirmId(null)} className="text-rose-600 dark:text-rose-400 font-semibold h-7 px-2 hover:bg-rose-500/20">Cancel</Button>
                                  </div>
                              ) : (
                                  <Button variant="outline" onClick={() => setDeleteConfirmId(item.id)} className="text-rose-600 border-rose-500/20 font-semibold hover:bg-rose-500/10">🗑️ Delete Item</Button>
                              )}
                          </div>
                      </div>
                      </div>
                  </TableCell>
              </TableRow>
          );
      }
      const isArchived = (item.verification_status || '').toLowerCase().includes('paid off') || (item.verification_status || '').toLowerCase().includes('archived');
      return (
        <React.Fragment key={item.id}>
        <TableRow className={
          (item.pending_baseline_promotion ? 'bg-muted/50 border-l-4 border-l-blue-500' : isDrifted ? 'border-l-2 border-l-primary/70 bg-primary/[0.02]' : '') +
          (isArchived && editingId !== item.id ? ' opacity-70 bg-muted/20' : '') +
          (editingId === item.id ? ' bg-muted/40 border-l-2 border-l-emerald-500 relative z-20 shadow-sm' : editingId !== null ? ' opacity-35 transition-opacity duration-200' : ' hover:bg-muted/50 transition-colors')
        }>
          <TableCell className="font-medium max-w-[300px]">
              <div className="mb-1.5 flex items-center gap-2">
                  <span className={`text-sm font-semibold ${isArchived ? 'text-muted-foreground' : 'text-foreground'}`}>{item.description}</span>
                  {isArchived && <span className="text-[10px] font-mono text-emerald-400 font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">PAID OFF</span>}
              </div>
              <div className="flex gap-1.5 items-center flex-wrap">
                  {/* Category Pill */}
                  <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${catStyle.bg} ${catStyle.text} ${catStyle.border} ${isCategoryDirty ? 'ring-1 ring-sky-400/80 shadow-[0_0_8px_rgba(56,189,248,0.25)]' : ''} relative`}>
                      <span>{catStyle.emoji}</span>
                      <span>{item.category || 'Unknown'}</span>
                      {isCategoryDirty && <span className="text-[9px] font-mono text-sky-400 font-bold ml-0.5">● Draft</span>}
                      {!isLocked && (
                          <select 
                              value={item.category || ''} 
                              onChange={(e) => handleInlineUpdate(item, 'category', e.target.value)}
                              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                              title="Click to change category"
                          >
                              <option disabled value="">-- Category --</option>
                              {allCategories.map(c => <option key={c as string} value={c as string}>{c as string}</option>)}
                          </select>
                      )}
                  </div>

                  {/* Verification Status Pill */}
                  <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusColors.bg} ${statusColors.text} ${statusColors.border} ${isStatusDirty ? 'ring-1 ring-yellow-400/80 shadow-[0_0_8px_rgba(250,204,21,0.25)]' : ''} relative cursor-pointer`}>
                      <span>{statusColors.label}</span>
                      {isStatusDirty && <span className="text-[8px] font-mono text-yellow-200 font-bold ml-0.5">● Draft</span>}
                      {!isLocked && (
                          <select 
                              value={item.verification_status || ''} 
                              onChange={(e) => handleInlineUpdate(item, 'verification_status', e.target.value)}
                              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                              title="Click to change verification status"
                          >
                              <option value="Verified">Verified</option>
                              <option value="Archived / Paid Off">🎉 Archived / Paid Off</option>
                              <option value="Needs Verification with Jordan">Needs Verification with Jordan</option>
                              <option value="Needs Verification with Alex">Needs Verification with Alex</option>
                          </select>
                      )}
                  </div>
              </div>
              {(item.source_authority || item.notes) && (
                  <div className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                      {item.source_authority && <div><strong>Source:</strong> {item.source_authority}</div>}
                      {item.notes && <div><strong>Note:</strong> {item.notes}</div>}
                  </div>
              )}
          </TableCell>
          <TableCell className="relative">
              <div className="flex items-center gap-1.5">
                  <span className={`font-mono font-bold text-sm ${isMathDirty ? 'text-emerald-400 font-extrabold' : 'text-foreground'}`}>
                      {formatCurrency(item.native_amount)}
                  </span>
                  <span className="text-xs text-muted-foreground font-normal">{item.cadence}</span>
                  {isMathDirty && (
                      <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-emerald-500/15 text-emerald-400 font-semibold" title="Amount/cadence modified from baseline">
                          ● Draft
                      </span>
                  )}
              </div>
              <div className="mt-1.5 flex items-center">
                  {item.account_route ? (
                      <div 
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-card/90 dark:bg-zinc-900 border border-border text-foreground text-[10px] font-mono shadow-xs ${isRouteDirty ? 'ring-1 ring-emerald-400/80 shadow-[0_0_8px_rgba(52,211,153,0.25)]' : ''} relative group cursor-pointer hover:border-primary/50 transition-colors`}
                          title={isLocked ? item.account_route : 'Click to change route'}
                      >
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${routeMeta.pipColor}`} />
                          <span className="font-medium text-foreground/90">{routeMeta.bankName}</span>
                          <span className={`font-bold text-[10px] ${routeMeta.arrowColor}`}>{routeMeta.arrow}</span>
                          {isRouteDirty && <span className="text-[8px] font-mono text-emerald-400 font-bold">● Draft</span>}
                          {!isLocked && (
                              <select 
                                  value={item.account_route || ''} 
                                  onChange={(e) => handleInlineUpdate(item, 'account_route', e.target.value)}
                                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                  title="Change route"
                              >
                                  <option value="">Set Route...</option>
                                  {allRoutes.map(r => <option key={r as string} value={r as string}>{r as string}</option>)}
                              </select>
                          )}
                      </div>
                  ) : (
                      !isLocked ? (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/40 border border-dashed border-border text-muted-foreground text-[10px] relative cursor-pointer hover:bg-muted/80">
                              <span>+ Route</span>
                              <select 
                                  value="" 
                                  onChange={(e) => handleInlineUpdate(item, 'account_route', e.target.value)}
                                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                              >
                                  <option value="">Set Route...</option>
                                  {allRoutes.map(r => <option key={r as string} value={r as string}>{r as string}</option>)}
                              </select>
                          </div>
                      ) : null
                  )}
              </div>
          </TableCell>
          <TableCell className={`w-[90px] text-right font-mono text-sm ${isArchived ? 'text-muted-foreground/50 line-through' : ''}`}>{formatCurrency(metrics.weekly)}</TableCell>
          <TableCell className={`w-[90px] text-right font-mono text-sm ${isArchived ? 'text-muted-foreground/50 line-through' : ''}`}>{formatCurrency(metrics.fortnightly)}</TableCell>
          <TableCell className={`w-[90px] text-right font-mono text-sm ${isArchived ? 'text-muted-foreground/50 line-through' : ''}`}>{formatCurrency(metrics.monthly)}</TableCell>
          <TableCell className={`w-[90px] text-right font-mono text-sm font-semibold ${isArchived ? 'text-muted-foreground/50 line-through' : ''}`}>{formatCurrency(metrics.annual)}</TableCell>
          <TableCell className="w-[140px]">
              <div className="flex flex-col gap-1.5 items-center justify-center">
                  {!isLocked ? (
                      /* UNLOCKED / EDIT MODE ACTIONS */
                      <>
                          {editingId === item.id ? (
                              <Button 
                                  size="sm" 
                                  variant="secondary" 
                                  onClick={() => setEditingId(null)} 
                                  className="h-6 px-2.5 text-xs font-semibold text-rose-400 hover:text-rose-300 border border-rose-500/30 hover:bg-rose-500/10 cursor-pointer"
                              >
                                  ✕ Close Edit
                              </Button>
                          ) : (
                              <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={() => handleEditClick(item)} 
                                  className="h-6 px-3 text-xs font-semibold text-foreground hover:bg-emerald-500/15 hover:text-emerald-400 hover:border-emerald-500/40 cursor-pointer shadow-xs"
                              >
                                  ✏️ Edit
                              </Button>
                          )}

                          {isDrifted && (
                              <div className="flex flex-wrap gap-1 justify-center relative">
                                  {confirmRevertId === item.id ? (
                                      <div className="absolute right-0 top-full mt-2 z-50 w-72 p-3 rounded-xl bg-zinc-950/95 border border-zinc-800 shadow-2xl backdrop-blur-md text-left">
                                          <div className="text-xs font-semibold text-zinc-200 mb-1 flex items-center gap-1.5">
                                              <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                                              <span>Revert to Baseline?</span>
                                          </div>
                                          <div className="text-[11px] text-zinc-400 mb-2">
                                              Restoring baseline target:
                                          </div>
                                          <div className="space-y-1 mb-3">
                                              {revertDiffs.map((d, i) => (
                                                  <div key={i} className="text-[11px] font-mono bg-zinc-900/90 p-1.5 px-2 rounded border border-zinc-800 flex items-center justify-between gap-2">
                                                      <span className="text-zinc-400 font-sans">{d.label}:</span>
                                                      <div className="flex items-center gap-1.5 truncate max-w-[170px]">
                                                          <span className="text-rose-400/80 line-through text-[10px]">{d.from}</span>
                                                          <span className="text-zinc-500 text-[10px]">➔</span>
                                                          <span className="text-emerald-400 font-semibold text-[10px]">{d.to}</span>
                                                      </div>
                                                  </div>
                                              ))}
                                          </div>
                                          <div className="flex items-center gap-2 justify-end">
                                              <Button size="sm" variant="ghost" onClick={() => setConfirmRevertId(null)} className="h-6 px-2 text-xs text-zinc-400 hover:text-zinc-200">
                                                  Cancel
                                              </Button>
                                              <Button size="sm" onClick={() => executeRevert(item.id)} className="h-6 px-3 text-xs bg-cyan-600 hover:bg-cyan-500 text-white font-semibold shadow-xs">
                                                  Confirm Revert
                                              </Button>
                                          </div>
                                      </div>
                                  ) : (
                                      <Button size="sm" variant="outline" onClick={() => { setConfirmRevertId(item.id); setPromoteId(null); setHistoryId(null); }} title={`Revert to baseline (${formatCurrency(baselineItem.native_amount)}/${baselineItem.cadence})`} className="text-[11px] h-5 px-1.5 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/10">⏪ Revert</Button>
                                  )}

                                  {item.pending_baseline_promotion ? (
                                      <div className="flex flex-col gap-1">
                                          {sessionActor !== item.pending_baseline_promotion.requested_by && sessionActor !== 'Test' ? (
                                              <>
                                                  <Button size="sm" onClick={() => onApproveBaseline(item.id)} className="h-5 px-2 text-[10px]">Approve</Button>
                                                  <Button size="sm" variant="destructive" onClick={() => onRejectBaseline(item.id)} className="h-5 px-2 text-[10px]">Reject</Button>
                                              </>
                                          ) : (
                                              <span className="text-[10px] text-muted-foreground font-semibold">Awaiting Approval</span>
                                          )}
                                      </div>
                                  ) : (
                                      <Button size="sm" variant="outline" onClick={() => { setPromoteId(promoteId === item.id ? null : item.id); setConfirmRevertId(null); setHistoryId(null); }} title="Update Master Baseline" className="text-[11px] h-5 px-1.5 text-blue-400 border-blue-500/30 hover:bg-blue-500/10">⬆️ Baseline</Button>
                                  )}
                              </div>
                          )}
                      </>
                  ) : (
                      /* LOCKED / READ-ONLY STATUS */
                      <>
                          {!isDrifted ? (() => {
                              const amountLogs = auditTrail.filter((l: any) => l.from_amount !== undefined || l.field === 'native_amount' || l.field === 'baseline_promotion');
                              let dateStr = "Original";
                              if (amountLogs.length > 0) {
                                  const lastLog = amountLogs[amountLogs.length - 1];
                                  dateStr = new Date(lastLog.timestamp).toLocaleDateString();
                              }
                              return (
                                  <div className="text-[11px] text-emerald-500 font-mono leading-tight text-center">
                                      <span>✓ Aligned</span>
                                      <span className="block text-[9px] text-muted-foreground/70 font-sans">({dateStr})</span>
                                  </div>
                              );
                          })() : (
                              <div className="text-[10px] text-yellow-300 font-mono leading-tight text-center px-1.5 py-0.5 rounded bg-yellow-500/10 border border-yellow-500/20">
                                  <span>● Modified</span>
                              </div>
                          )}
                      </>
                  )}
                  
                  {auditTrail.length > 0 && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => { setHistoryId(historyId === item.id ? null : item.id); setPromoteId(null); setConfirmRevertId(null); setConfirmClearHistoryId(null); }} 
                        className={`text-[10px] h-5 px-1.5 gap-1 font-mono transition-colors ${
                          historyId === item.id 
                            ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' 
                            : 'bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300'
                        }`}
                      >
                          <History className="w-2.5 h-2.5" />
                          {historyId === item.id ? 'Hide Log' : `Log (${auditTrail.length})`}
                      </Button>
                  )}
              </div>
          </TableCell>
        </TableRow>
        
        {/* Inline Promote Row */}
        {promoteId === item.id && !isLocked && (
            <TableRow className="bg-emerald-500/10 hover:bg-emerald-500/20">
                <TableCell colSpan={7} className="p-6">
                    <strong className="text-emerald-600 dark:text-emerald-400">Updating Master Baseline</strong>
                    <div className="text-sm text-emerald-600 mb-3">This will permanently update the master baseline with these new figures.</div>
                    <div className="flex gap-3">
                        <Input type="text" placeholder="Mandatory Audit Note (Why is this permanent?)" value={promoteReason} onChange={e => setPromoteReason(e.target.value)} className="flex-grow bg-card" />
                        <Button onClick={() => executePromote(item.id)} >Confirm Update</Button>
                        <Button variant="outline" onClick={() => setPromoteId(null)}>Cancel</Button>
                    </div>
                    {errorMsg && <div className="text-rose-600 mt-2 text-sm font-semibold">{errorMsg}</div>}
                </TableCell>
            </TableRow>
        )}

        {/* Inline History Drawer */}
        {historyId === item.id && auditTrail.length > 0 && (
            <TableRow className="border-b-0 hover:bg-transparent">
                <TableCell colSpan={7} className="p-0 px-6 pb-6 pt-2">
                    <div className="bg-zinc-950/95 border border-zinc-800 rounded-xl p-5 shadow-2xl backdrop-blur-md">
                        {/* Drawer Header */}
                        <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
                            <div className="flex items-center gap-2.5">
                                <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                                    <History className="w-4 h-4" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h4 className="text-sm font-semibold text-zinc-100 tracking-wide">Forensic Audit Trail</h4>
                                        <Badge variant="outline" className="text-[10px] font-mono border-zinc-800 text-zinc-400 bg-zinc-900/80">
                                            {auditTrail.length} revision{auditTrail.length === 1 ? '' : 's'} (Max 15 retained)
                                        </Badge>
                                    </div>
                                    <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                                        Item #{item.id} • {item.description}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {confirmClearHistoryId === item.id ? (
                                    <div className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 px-2 py-1 rounded-lg">
                                        <span className="text-[11px] text-rose-400 font-medium">Clear all logs?</span>
                                        <Button 
                                            size="sm" 
                                            variant="destructive" 
                                            onClick={async () => {
                                                if (onClearAuditLogs) await onClearAuditLogs(item.id);
                                                setConfirmClearHistoryId(null);
                                                setHistoryId(null);
                                            }}
                                            className="h-5 px-2 text-[10px]"
                                        >
                                            Confirm Clear
                                        </Button>
                                        <Button 
                                            size="sm" 
                                            variant="ghost" 
                                            onClick={() => setConfirmClearHistoryId(null)}
                                            className="h-5 px-1.5 text-[10px] text-zinc-400 hover:text-zinc-200"
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                ) : (
                                    <Button 
                                        size="sm" 
                                        variant="outline" 
                                        onClick={() => setConfirmClearHistoryId(item.id)}
                                        className="h-6 px-2 text-[11px] gap-1 text-zinc-400 border-zinc-800 hover:text-rose-300 hover:border-rose-500/30 hover:bg-rose-500/10"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                        Clear History
                                    </Button>
                                )}

                                <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    onClick={() => { setHistoryId(null); setConfirmClearHistoryId(null); }}
                                    className="h-6 w-6 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80"
                                    title="Close Audit Drawer (Esc)"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </Button>
                            </div>
                        </div>

                        {/* Timeline List */}
                        <div className="mt-4 space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                            {((item.audit_trail || []) as any[])
                                .map((log: any, originalIndex: number) => ({ log, originalIndex }))
                                .reverse()
                                .map(({ log, originalIndex }) => {
                                    const actorLower = (log.actor || '').toLowerCase();
                                    const isAlex = actorLower.includes('alex');
                                    const isJordan = actorLower.includes('jordan');
                                    
                                    let actionBadge = null;
                                    if (log.action === 'revert') {
                                        actionBadge = (
                                            <Badge className="bg-cyan-500/15 text-cyan-300 border-cyan-500/30 text-[10px] font-mono gap-1">
                                                <RotateCcw className="w-2.5 h-2.5" /> Reverted
                                            </Badge>
                                        );
                                    } else if (log.field === 'baseline_promotion') {
                                        actionBadge = (
                                            <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[10px] font-mono gap-1">
                                                <CheckCircle2 className="w-2.5 h-2.5" /> Baseline Promoted
                                            </Badge>
                                        );
                                    }

                                    return (
                                        <div 
                                            key={originalIndex} 
                                            className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700/80 transition-colors"
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-mono text-[10px] text-zinc-500 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">
                                                        Rev #{originalIndex + 1}
                                                    </span>
                                                    {isAlex ? (
                                                        <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[10px] font-mono">
                                                            Alex
                                                        </Badge>
                                                    ) : isJordan ? (
                                                        <Badge className="bg-rose-500/15 text-rose-300 border-rose-500/30 text-[10px] font-mono">
                                                            Jordan
                                                        </Badge>
                                                    ) : (
                                                        <Badge className="bg-zinc-800 text-zinc-300 border-zinc-700 text-[10px] font-mono">
                                                            {log.actor || 'System'}
                                                        </Badge>
                                                    )}
                                                    {actionBadge}
                                                    <span className="text-xs text-zinc-200 font-medium">
                                                        {log.reason || 'Configuration update'}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className="text-[11px] font-mono text-zinc-400 flex items-center gap-1">
                                                        <Clock className="w-3 h-3 text-zinc-500" />
                                                        {new Date(log.timestamp).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                                                    </span>
                                                    <Button 
                                                        size="icon" 
                                                        variant="ghost" 
                                                        onClick={async () => {
                                                            if (onDeleteAuditLog) {
                                                                await onDeleteAuditLog(item.id, originalIndex);
                                                                if (((item.audit_trail || []).length) <= 1) {
                                                                    setHistoryId(null);
                                                                }
                                                            }
                                                        }}
                                                        title="Delete this revision log"
                                                        className="h-5 w-5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Baseline target indicator for reverts */}
                                            {log.reverted_to && (
                                                <div className="mt-2 p-1.5 px-2.5 rounded-md bg-zinc-950/80 border border-cyan-500/25 text-[11px] font-mono text-zinc-300 w-fit flex items-center gap-2 flex-wrap">
                                                    <span className="text-cyan-400 font-sans font-medium flex items-center gap-1">
                                                        <RotateCcw className="w-3 h-3" /> Baseline Target:
                                                    </span>
                                                    <span className="text-emerald-400 font-semibold">
                                                        {formatCurrency(log.reverted_to.native_amount || log.reverted_to.amount)} / {log.reverted_to.cadence}
                                                    </span>
                                                    <span className="text-zinc-600">•</span>
                                                    <span className="text-zinc-300">{log.reverted_to.verification_status || log.reverted_to.status}</span>
                                                    {log.reverted_to.account_route && (
                                                        <>
                                                            <span className="text-zinc-600">•</span>
                                                            <span className="text-zinc-400">{log.reverted_to.account_route}</span>
                                                        </>
                                                    )}
                                                </div>
                                            )}

                                            {/* Diffs */}
                                            {Array.isArray(log.changes) && log.changes.length > 0 && (
                                                <div className="mt-2.5 grid grid-cols-1 md:grid-cols-2 gap-1.5 text-xs">
                                                    {log.changes.map((c: any, cIdx: number) => {
                                                        const fieldLabel = (c.field || '').replace(/_/g, ' ');
                                                        const isAmt = (c.field || '').includes('amount');
                                                        const fromDisplay = isAmt && typeof c.from === 'number' 
                                                            ? formatCurrency(c.from) 
                                                            : (c.from === undefined || c.from === null || c.from === '' ? '(empty)' : String(c.from));
                                                        const toDisplay = isAmt && typeof c.to === 'number' 
                                                            ? formatCurrency(c.to) 
                                                            : (c.to === undefined || c.to === null || c.to === '' ? '(empty)' : String(c.to));
                                                        return (
                                                            <div key={cIdx} className="flex items-center gap-2 p-1.5 px-2.5 rounded-md bg-zinc-950/80 border border-zinc-800/80 font-mono text-[11px]">
                                                                <span className="text-zinc-400 capitalize font-sans">{fieldLabel}:</span>
                                                                <span className="text-rose-400/80 line-through truncate max-w-[140px]">{fromDisplay}</span>
                                                                <ArrowRight className="w-3 h-3 text-zinc-600 shrink-0" />
                                                                <span className="text-emerald-400 font-semibold truncate max-w-[160px]">{toDisplay}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {log.from_amount !== undefined && log.to_amount !== undefined && Number(log.from_amount) !== Number(log.to_amount) && (!log.changes || !log.changes.some((c: any) => c.field === 'native_amount' || c.field === 'amount')) && (
                                                <div className="mt-2 flex items-center gap-2 p-1.5 px-2.5 rounded-md bg-zinc-950/80 border border-zinc-800/80 font-mono text-[11px] w-fit">
                                                    <span className="text-zinc-400 font-sans">Amount:</span>
                                                    <span className="text-rose-400/80 line-through">{formatCurrency(log.from_amount)}</span>
                                                    <ArrowRight className="w-3 h-3 text-zinc-600 shrink-0" />
                                                    <span className="text-emerald-400 font-semibold">{formatCurrency(log.to_amount)}</span>
                                                </div>
                                            )}

                                            {(log.from !== undefined || log.to !== undefined) && log.from !== log.to && (!log.changes || log.changes.length === 0) && (
                                                <div className="mt-2 flex items-center gap-2 p-1.5 px-2.5 rounded-md bg-zinc-950/80 border border-zinc-800/80 font-mono text-[11px] w-fit">
                                                    <span className="text-zinc-400 capitalize font-sans">{(log.field || 'Field').replace(/_/g, ' ')}:</span>
                                                    <span className="text-rose-400/80 line-through">{log.from === undefined ? '(empty)' : String(log.from)}</span>
                                                    <ArrowRight className="w-3 h-3 text-zinc-600 shrink-0" />
                                                    <span className="text-emerald-400 font-semibold">{log.to === undefined ? '(empty)' : String(log.to)}</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                </TableCell>
            </TableRow>
        )}
                  
        {editDrawer}
        </React.Fragment>
      );
  };
  const getTier = (cat: string) => {
      const lower = (cat || '').toLowerCase();
      if (lower.includes('income')) return '1. Income';
      if (lower.includes('housing') || lower.includes('utilities') || lower.includes('debt') || lower.includes('food') || lower.includes('grocer') || lower.includes('household')) return '2. Core Survival & Fixed';
      if (lower.includes('health') || lower.includes('insurance') || lower.includes('pet') || lower.includes('transport')) return '3. Health & Maintenance';
      if (lower.includes('saving') || lower.includes('transfer')) return '4. Savings & Goals';
      return '5. Lifestyle & Discretionary';
  };

  let totalIncome = 0;
  let totalSurvival = 0;
  let totalHealth = 0;
  let totalSavings = 0;
  let totalLifestyle = 0;

  items.forEach(item => {
      const metrics = calculateMetrics(item.native_amount, item.cadence);
      const tier = getTier(item.category);
      if (tier === '1. Income') totalIncome += metrics.weekly;
      else if (tier === '2. Core Survival & Fixed') totalSurvival += metrics.weekly;
      else if (tier === '3. Health & Maintenance') totalHealth += metrics.weekly;
      else if (tier === '4. Savings & Goals') totalSavings += metrics.weekly;
      else if (tier === '5. Lifestyle & Discretionary') totalLifestyle += metrics.weekly;
  });

  const totalCore = totalSurvival + totalHealth;

  let displayMultiplier = 1;
  if (globalCadence === 'Weekly') displayMultiplier = 1;
  if (globalCadence === 'Fortnightly') displayMultiplier = 2;
  if (globalCadence === 'Monthly') displayMultiplier = 52 / 12;
  if (globalCadence === 'Quarterly') displayMultiplier = 13;
  if (globalCadence === 'Semi-Annual') displayMultiplier = 26;
  if (globalCadence === 'Annual') displayMultiplier = 52;
  
  const unallocatedSurplus = totalIncome - totalCore - totalSavings - totalLifestyle;
  const incVal = totalIncome > 0 ? totalIncome : 1;
  const corePct = ((totalCore / incVal) * 100).toFixed(0);
  const savingsPct = ((totalSavings / incVal) * 100).toFixed(0);
  const lifestylePct = ((totalLifestyle / incVal) * 100).toFixed(0);
  const unallocatedPct = ((unallocatedSurplus / incVal) * 100).toFixed(0);
  
  const unverifiedCount = items.filter(i => {
      const status = (i.verification_status || '').toLowerCase();
      return !status.includes('paid off') && !status.includes('archived') && status !== 'verified';
  }).length;

  const filteredItems = items.filter(item => {
      if (filterAttention) {
          const status = (item.verification_status || '').toLowerCase();
          const isPaidOff = status.includes('paid off') || status.includes('archived');
          const isVerified = status === 'verified';
          if (isPaidOff || isVerified) return false;
      }
      if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const desc = (item.description || '').toLowerCase();
          const cat = (item.category || '').toLowerCase();
          const route = (item.account_route || '').toLowerCase();
          const notes = (item.notes || '').toLowerCase();
          const auth = (item.source_authority || '').toLowerCase();
          if (!desc.includes(q) && !cat.includes(q) && !route.includes(q) && !notes.includes(q) && !auth.includes(q)) {
              return false;
          }
      }
      return true;
  });

  const allOwnerCategories = [...new Set(filteredItems.map(i => i.category))];
  const areAllExpanded = allOwnerCategories.every(cat => expandedGroups[`${owner}:${cat}`] !== false);

  const toggleAllGroups = () => {
      const nextState = !areAllExpanded;
      setExpandedGroups(prev => {
          const updated = { ...prev };
          allOwnerCategories.forEach(cat => {
              updated[`${owner}:${cat}`] = nextState;
          });
          return updated;
      });
  };

  const toggleGroup = (groupKey: string) => {
      const key = `${owner}:${groupKey}`;
      const currentState = expandedGroups[key] ?? true;
      setExpandedGroups(prev => ({ ...prev, [key]: !currentState }));
  };

  const renderCategoryGroup = (groupTitle: string, groupItems: FinancialItem[]) => {
      if (groupItems.length === 0) return null;
      const isExpanded = expandedGroups[`${owner}:${groupTitle}`] ?? true;
      const { emoji } = getCategoryStyle(groupTitle);
      const title = groupTitle.toLowerCase() === 'pet' ? 'Lola (Pet)' : groupTitle;

      const tWk = groupItems.reduce((acc, i) => acc + calculateMetrics(i.native_amount, i.cadence).weekly, 0);
      const tFn = groupItems.reduce((acc, i) => acc + calculateMetrics(i.native_amount, i.cadence).fortnightly, 0);
      const tMo = groupItems.reduce((acc, i) => acc + calculateMetrics(i.native_amount, i.cadence).monthly, 0);
      const tYr = groupItems.reduce((acc, i) => acc + calculateMetrics(i.native_amount, i.cadence).annual, 0);

      return (
          <React.Fragment key={groupTitle}>
              <TableRow onClick={() => toggleGroup(groupTitle)} className="cursor-pointer bg-muted/60 border-t-2 border-b border-border/80 hover:bg-muted/90 transition-colors">
                  <TableCell className="py-3 px-6 text-foreground">
                      <div className="flex items-center gap-2.5">
                          <span className="text-primary text-xs font-bold w-4 inline-block">{isExpanded ? '▼' : '▶'}</span>
                          <span className="text-xl">{emoji}</span> 
                          <span className="text-sm font-bold uppercase tracking-wider text-foreground">{title}</span>
                          <span className="ml-2 bg-background/80 text-muted-foreground px-2 py-0.5 rounded-full text-xs font-mono border border-border">{groupItems.length} item{groupItems.length !== 1 && 's'}</span>
                      </div>
                  </TableCell>
                  <TableCell className="text-right pr-6 text-muted-foreground text-xs font-semibold"></TableCell>
                  <TableCell className="bg-muted/40 font-mono font-bold text-right text-sm text-foreground/90 px-4">{formatCurrency(tWk)}</TableCell>
                  <TableCell className="bg-muted/40 font-mono font-bold text-right text-sm text-foreground/90 px-4">{formatCurrency(tFn)}</TableCell>
                  <TableCell className="bg-muted/40 font-mono font-bold text-right text-sm text-foreground/90 px-4">{formatCurrency(tMo)}</TableCell>
                  <TableCell className="bg-muted/40 font-mono font-bold text-right text-sm text-foreground/90 px-4">{formatCurrency(tYr)}</TableCell>
                  <TableCell className="bg-muted/40 text-center" />
              </TableRow>
              {isExpanded && groupItems.map(renderRow)}
          </React.Fragment>
      );
  };
  return (
      <div className="w-full max-w-7xl mx-auto px-4 py-6 font-sans">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
          {/* Left: Search & Attention Filter */}
          <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input 
                      type="text" 
                      placeholder="Search expenses, routes, notes..." 
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="h-9 pl-8.5 pr-7 text-xs bg-card border-border shadow-2xs"
                  />
                  {searchQuery && (
                      <button 
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                          title="Clear search"
                      >
                          <X className="w-3 h-3" />
                      </button>
                  )}
              </div>
              
              <Button
                  type="button"
                  variant={filterAttention ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterAttention(!filterAttention)}
                  className={`h-9 px-3 text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-all shadow-2xs shrink-0 ${
                      filterAttention 
                          ? "bg-amber-500 text-black hover:bg-amber-400 font-bold border-amber-600" 
                          : "text-muted-foreground hover:text-foreground border-border bg-card"
                  }`}
                  title="Filter items requiring verification or attention"
              >
                  <AlertTriangle className={`w-3.5 h-3.5 ${filterAttention ? "text-black" : "text-amber-500"}`} />
                  Needs Attention
                  {unverifiedCount > 0 && (
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                          filterAttention ? "bg-black/20 text-black font-bold" : "bg-amber-500/20 text-amber-500 dark:text-amber-400 font-semibold"
                      }`}>
                          {unverifiedCount}
                      </span>
                  )}
              </Button>
          </div>

          {/* Right: Add Expense (when unlocked), Collapse/Expand, Cadence Dropdown */}
          <div className="flex items-center justify-end gap-2 shrink-0">
              {!isLocked && (
                  <Button 
                      type="button"
                      size="sm"
                      onClick={() => setIsCreating(true)}
                      className="h-9 px-3.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xs cursor-pointer flex items-center gap-1.5 transition-all"
                  >
                      <Plus className="w-3.5 h-3.5" />
                      Add Expense
                  </Button>
              )}
              <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={toggleAllGroups} 
                  className="h-9 px-3 text-xs font-semibold text-muted-foreground hover:text-foreground border-border bg-card shadow-2xs cursor-pointer"
              >
                  {areAllExpanded ? '▾ Collapse All' : '▸ Expand All'}
              </Button>
              <select 
                  value={globalCadence} 
                  onChange={e => setGlobalCadence(e.target.value as Cadence)} 
                  className="h-9 px-3 rounded-lg border border-border font-semibold text-xs text-foreground bg-card cursor-pointer outline-none focus:ring-2 focus:ring-ring shadow-2xs"
              >
                  <option value="Weekly">Weekly View</option>
                  <option value="Fortnightly">Fortnightly View</option>
                  <option value="Monthly">Monthly View</option>
                  <option value="Annual">Annual View</option>
              </select>
          </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 mb-6">
          {/* Card 1: Total Income */}
          <Card className="border border-border/80 bg-card shadow-xs rounded-xl p-3.5 flex flex-col justify-between">
              <div>
                  <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Total Income</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 font-semibold">100% Inflow</span>
                  </div>
                  <p className="text-xl font-bold font-mono tracking-tight text-emerald-500 dark:text-emerald-400">{formatCurrency(totalIncome * displayMultiplier)}</p>
              </div>
              <div className="mt-2 pt-2 border-t border-border/40 space-y-0.5">
                  <div className="text-[10.5px] font-mono text-muted-foreground leading-tight">Net verified salary & inflows</div>
                  <div className="text-[9.5px] text-muted-foreground/70 leading-tight">
                      {owner === 'Jordan' ? 'Nursing Salary + SmartSalary + Alex Rent ($150/wk)' : 'Primary: ING Net Salary ($1,489.08/wk)'}
                  </div>
              </div>
          </Card>
          
          {/* Card 2: Core & Fixed */}
          <Card className="border border-border/80 bg-card shadow-xs rounded-xl p-3.5 flex flex-col justify-between">
              <div>
                  <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Core & Fixed</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500 dark:text-rose-400 font-semibold">{corePct}% Net</span>
                  </div>
                  <p className="text-xl font-bold font-mono tracking-tight text-rose-500 dark:text-rose-400">{formatCurrency(totalCore * displayMultiplier)}</p>
              </div>
              <div className="mt-2 pt-2 border-t border-border/40 space-y-0.5">
                  <div className="text-[10.5px] font-mono text-muted-foreground leading-tight">
                      Core: <strong className="text-foreground">{formatCurrency(totalSurvival * displayMultiplier)}</strong> • Health: <strong className="text-foreground">{formatCurrency(totalHealth * displayMultiplier)}</strong>
                  </div>
                  <div className="text-[9.5px] text-muted-foreground/70 leading-tight truncate" title="Debt, Housing, Food, Utils, Health, Insurance, Pets, etc.">
                      Debt, Housing, Food, Utils, Health, Pets
                  </div>
              </div>
          </Card>
          
          {/* Card 3: Savings & Goals */}
          <Card className="border border-border/80 bg-card shadow-xs rounded-xl p-3.5 flex flex-col justify-between">
              <div>
                  <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Savings & Goals</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-500 dark:text-sky-400 font-semibold">{savingsPct}% Net</span>
                  </div>
                  <p className="text-xl font-bold font-mono tracking-tight text-sky-500 dark:text-sky-400">{formatCurrency(totalSavings * displayMultiplier)}</p>
              </div>
              <div className="mt-2 pt-2 border-t border-border/40 space-y-0.5">
                  <div className="text-[10.5px] font-mono text-muted-foreground leading-tight">Sinking funds & cash reserves</div>
                  <div className="text-[9.5px] text-muted-foreground/70 leading-tight">MQ Save, Sinking & Buffers</div>
              </div>
          </Card>
          
          {/* Card 4: Lifestyle */}
          <Card className="border border-border/80 bg-card shadow-xs rounded-xl p-3.5 flex flex-col justify-between">
              <div>
                  <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Lifestyle</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-500 dark:text-purple-400 font-semibold">{lifestylePct}% Net</span>
                  </div>
                  <p className="text-xl font-bold font-mono tracking-tight text-purple-500 dark:text-purple-400">{formatCurrency(totalLifestyle * displayMultiplier)}</p>
              </div>
              <div className="mt-2 pt-2 border-t border-border/40 space-y-0.5">
                  <div className="text-[10.5px] font-mono text-muted-foreground leading-tight">Discretionary living & recreation</div>
                  <div className="text-[9.5px] text-muted-foreground/70 leading-tight">Dining, Subscriptions, Leisure</div>
              </div>
          </Card>
          
          {/* Card 5: Unallocated */}
          <Card className={`border shadow-xs rounded-xl p-3.5 flex flex-col justify-between ${unallocatedSurplus >= 0 ? 'border-emerald-500/30 bg-emerald-500/[0.04]' : 'border-rose-500/30 bg-rose-500/[0.04]'}`}>
              <div>
                  <div className="flex items-center justify-between mb-1">
                      <span className={`text-[11px] font-bold uppercase tracking-wider ${unallocatedSurplus >= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>Unallocated</span>
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold ${unallocatedSurplus >= 0 ? 'bg-emerald-500/15 text-emerald-500 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-500 dark:text-rose-400'}`}>
                          {unallocatedPct}% Net
                      </span>
                  </div>
                  <p className={`text-xl font-bold font-mono tracking-tight ${unallocatedSurplus >= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                      {formatCurrency(unallocatedSurplus * displayMultiplier)}
                  </p>
              </div>
              <div className="mt-2 pt-2 border-t border-border/40 space-y-0.5">
                  <div className="text-[10.5px] font-mono text-muted-foreground leading-tight">Unallocated free cash flow</div>
                  <div className="text-[9.5px] text-muted-foreground/70 leading-tight">Discretionary weekly buffer</div>
              </div>
          </Card>
      </div>

      <div>
          <datalist id="routes-list">
              {allRoutes.map(r => <option key={r as string} value={r as string} />)}
          </datalist>
          
          {(() => {
                  const allTiers = [
                      {
                          name: '1. Income',
                          title: '1. Inbound Income & Salary',
                          subtitle: 'Net Salary, Household Inflows & Rent Contributions',
                          icon: Wallet,
                          badgeClass: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                      },
                      {
                          name: '2. Core Survival & Fixed',
                          title: '2. Core Survival & Fixed',
                          subtitle: 'Housing, Debt, Groceries, Utilities & Baseline Living',
                          icon: ShieldAlert,
                          badgeClass: 'bg-rose-500/15 border-rose-500/30 text-rose-500 dark:text-rose-400'
                      },
                      {
                          name: '3. Health & Maintenance',
                          title: '3. Health & Maintenance',
                          subtitle: 'Allied Health, Insurance, Pets, Vehicle Maintenance',
                          icon: HeartPulse,
                          badgeClass: 'bg-teal-500/15 border-teal-500/30 text-teal-600 dark:text-teal-400'
                      },
                      {
                          name: '4. Savings & Goals',
                          title: '4. Savings & Goals',
                          subtitle: 'Sinking Funds, Emergency Buffers & Mortgage Offset Accumulation',
                          icon: PiggyBank,
                          badgeClass: 'bg-sky-500/15 border-sky-500/30 text-sky-500 dark:text-sky-400'
                      },
                      {
                          name: '5. Lifestyle & Discretionary',
                          title: '5. Lifestyle & Discretionary',
                          subtitle: 'Personal Discretionary, Dining, Subscriptions & Leisure',
                          icon: Sparkles,
                          badgeClass: 'bg-purple-500/15 border-purple-500/30 text-purple-500 dark:text-purple-400'
                      }
                  ];
                  
                  return allTiers.map(tier => {
                      const tierItems = filteredItems.filter(i => getTier(i.category) === tier.name);
                      if (tierItems.length === 0) return null;
                      
                      const cats = [...new Set(tierItems.map(i => i.category))].sort((a,b) => a.localeCompare(b));

                      const tierTotalWk = tierItems.reduce((acc, i) => acc + calculateMetrics(i.native_amount, i.cadence).weekly, 0);
                      const tierTotalFn = tierItems.reduce((acc, i) => acc + calculateMetrics(i.native_amount, i.cadence).fortnightly, 0);
                      const tierTotalMo = tierItems.reduce((acc, i) => acc + calculateMetrics(i.native_amount, i.cadence).monthly, 0);
                      const tierTotalYr = tierItems.reduce((acc, i) => acc + calculateMetrics(i.native_amount, i.cadence).annual, 0);
                      const TierIcon = tier.icon;
                      
                      return (
                          <React.Fragment key={tier.name}>
                              {tier.name === '2. Core Survival & Fixed' && (
                                  <div className="my-8 flex items-center gap-3">
                                      <div className="h-px bg-border flex-1" />
                                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                          Outbound Living Expenses & Allocations Ledger
                                      </span>
                                      <div className="h-px bg-border flex-1" />
                                  </div>
                              )}
                              <div className="mb-8 bg-card text-card-foreground rounded-xl shadow-md border border-border">
                              <Table className="table-fixed w-full">
                                  <colgroup>
                                      <col className="w-[32%]" />
                                      <col className="w-[16%]" />
                                      <col className="w-[9%]" />
                                      <col className="w-[9%]" />
                                      <col className="w-[9%]" />
                                      <col className="w-[11%]" />
                                      <col className="w-[14%]" />
                                  </colgroup>
                                  <TableHeader className="sticky top-0 z-30 shadow-md">
                                      {/* Row 1: Section Title & Exact Column-Aligned Totals */}
                                      <TableRow className="bg-card border-b border-border hover:bg-card">
                                          <TableHead colSpan={2} className="py-3 px-6">
                                              <div className="flex items-center gap-2.5">
                                                  <TierIcon className="w-4 h-4 text-foreground/80 shrink-0" />
                                                  <div className="flex flex-col">
                                                      <div className="flex items-center gap-2">
                                                          <h2 className="m-0 text-base font-bold text-foreground tracking-wider uppercase">{tier.title}</h2>
                                                          <span className="text-xs px-2 py-0.5 rounded-full bg-muted border border-border text-muted-foreground font-mono font-normal">
                                                              {tierItems.length} item{tierItems.length !== 1 ? 's' : ''}
                                                          </span>
                                                          <span className={`text-[11px] px-2 py-0.5 rounded border font-mono font-semibold ${tier.badgeClass}`}>
                                                              ∑ TOTAL
                                                          </span>
                                                      </div>
                                                      <span className="text-[11px] text-muted-foreground font-normal tracking-normal font-sans">
                                                          {tier.subtitle}
                                                      </span>
                                                  </div>
                                              </div>
                                          </TableHead>
                                          <TableHead className="py-2.5 px-4 text-right align-top">
                                              <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-sans font-medium block leading-none mb-1">Weekly</span>
                                              <span className="font-mono font-bold text-foreground text-sm leading-tight block">{formatCurrency(tierTotalWk)}</span>
                                          </TableHead>
                                          <TableHead className="py-2.5 px-4 text-right align-top">
                                              <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-sans font-medium block leading-none mb-1">Fortnightly</span>
                                              <span className="font-mono font-bold text-foreground text-sm leading-tight block">{formatCurrency(tierTotalFn)}</span>
                                          </TableHead>
                                          <TableHead className="py-2.5 px-4 text-right align-top">
                                              <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-sans font-medium block leading-none mb-1">Monthly</span>
                                              <span className="font-mono font-bold text-foreground text-sm leading-tight block">{formatCurrency(tierTotalMo)}</span>
                                          </TableHead>
                                          <TableHead className="py-2.5 px-4 text-right align-top">
                                              <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-sans font-medium block leading-none mb-1">Annual</span>
                                              <span className="font-mono font-bold text-foreground text-sm leading-tight block">{formatCurrency(tierTotalYr)}</span>
                                          </TableHead>
                                          <TableHead className="py-3 px-4 text-center text-muted-foreground text-xs font-mono align-top">—</TableHead>
                                      </TableRow>
                                      {/* Row 2: Standard Column Headers */}
                                      <TableRow className="bg-muted border-b border-border hover:bg-muted text-xs uppercase font-semibold text-muted-foreground">
                                          <TableHead className="py-2.5 px-6 text-left">Category / Item</TableHead>
                                          <TableHead className="py-2.5 px-4 text-left">Native Amount</TableHead>
                                          <TableHead className="py-2.5 px-4 text-right">Wk</TableHead>
                                          <TableHead className="py-2.5 px-4 text-right">Fn</TableHead>
                                          <TableHead className="py-2.5 px-4 text-right">Mo</TableHead>
                                          <TableHead className="py-2.5 px-4 text-right">Yr</TableHead>
                                          <TableHead className="py-2.5 px-4 text-center">Actions</TableHead>
                                      </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                      {cats.map(cat => {
                                          const catItems = tierItems.filter(i => i.category === cat).sort((a, b) => calculateMetrics(b.native_amount, b.cadence).annual - calculateMetrics(a.native_amount, a.cadence).annual);
                                          return renderCategoryGroup(cat, catItems);
                                      })}
                                  </TableBody>
                              </Table>
                          </div>
                      </React.Fragment>
                      );
                  });
              })()}

          {filteredItems.length === 0 && (
              <div className="p-12 text-center rounded-xl border border-dashed border-border bg-card">
                  <Search className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-foreground">No matching expenses found</p>
                  <p className="text-xs text-muted-foreground mt-1">Try adjusting your search query or attention filter</p>
                  <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => { setSearchQuery(''); setFilterAttention(false); }} 
                      className="mt-3 h-8 text-xs"
                  >
                      Reset Filters
                  </Button>
              </div>
          )}
          {isCreating && <CreateItemModal owner={owner} allCategories={allCategories} allRoutes={allRoutes} onClose={() => setIsCreating(false)} onCreate={onCreate} />}
      </div>
    </div>
  );
}
