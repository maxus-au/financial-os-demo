import { useState, useEffect, useMemo, useRef } from 'react';
import type { FinancialItem, ProspectiveProperty, PropertyStatus } from '../types';
import { calculateMetrics, formatCurrency } from '../utils/financeMath';
import {
  calculateQLDClosingCosts,
  calculateLMI,
  calculateRentalYield,
  calculateMortgageRepayments,
  calculateSettlementReadiness,
  estimateHoldingBurn,
  formatPropertyAddress,
} from '../utils/propertyMath';
import PropertyIntakeModal from './PropertyIntakeModal';
import ClosingCostsModal from './ClosingCostsModal';
import { isDemoMode, getDemoProperties, saveDemoProperty, deleteDemoProperty } from '../utils/demoStorageAdapter';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Building2,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ExternalLink,
  Star,
  Plus,
  Search,
  Bed,
  Bath,
  Car,
  Clock,
  Trash2,
  Edit2,
  Layers,
  ArrowUpDown,
  Home,
  ShieldCheck,
  Calendar,
} from 'lucide-react';

interface Props {
  items: FinancialItem[];
  sessionActor?: string | null;
  isLocked?: boolean;
}

// Initial cash reserve from game plan
const INITIAL_CASH = 225000;

// Standard Bank Benchmarks
const STANDARD_BENCHMARKS = [
  { label: '$1.00M Baseline', price: 1000000 },
  { label: '$1.15M Mid-Tier', price: 1150000 },
  { label: '$1.30M Stretch Target', price: 1300000 },
];

export default function PropertyEngine({ items, sessionActor, isLocked }: Props) {
  // Properties State
  const [properties, setProperties] = useState<ProspectiveProperty[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<ProspectiveProperty | null>(null);

  // Closing Costs Inspection Modal State
  const [closingCostsModalData, setClosingCostsModalData] = useState<{
    isOpen: boolean;
    price: number;
    address?: string;
  }>({
    isOpen: false,
    price: 0,
  });

  // Mortgage Repayment Cadence Selector
  const [repaymentCadence, setRepaymentCadence] = useState<'weekly' | 'fortnightly' | 'monthly'>('weekly');

  // Filters & Sorting
  const [statusFilter, setStatusFilter] = useState<'ALL' | PropertyStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'rating' | 'price-desc' | 'price-asc' | 'newest'>('rating');

  // Active Modeled Property in Purchasing Matrix
  const [activeModeledId, setActiveModeledId] = useState<string | null>(null);
  const matrixSectionRef = useRef<HTMLDivElement>(null);

  // 1. Calculate True Verified Inflows & Outflows from master.json
  let alexInflowW = 0, alexOutflowW = 0;
  let jordanInflowW = 0, jordanOutflowW = 0;

  items.forEach(item => {
    const metrics = calculateMetrics(item.native_amount, item.cadence);
    const isIncome = (item.category || '').toLowerCase().includes('income');
    
    if (item.owner === 'Alex') {
      if (isIncome) alexInflowW += metrics.weekly;
      else alexOutflowW += metrics.weekly;
    } else if (item.owner === 'Jordan') {
      if (isIncome) jordanInflowW += metrics.weekly;
      else jordanOutflowW += metrics.weekly;
    }
  });

  const alexSurplusW = alexInflowW - alexOutflowW;
  const jordanSurplusW = jordanInflowW - jordanOutflowW;
  const combinedSurplusW = alexSurplusW + jordanSurplusW;
  
  // Note: The email assumed ~$700/wk savings. Our engine uses the strict JSON reality.
  const varianceFromEmail = combinedSurplusW - 700;

  const isDemo = isDemoMode();

  // 2. Fetch Prospective Properties from API
  const fetchProperties = async () => {
    if (isDemo) {
      setLoadingProperties(true);
      setProperties(getDemoProperties());
      setLoadingProperties(false);
      return;
    }
    try {
      setLoadingProperties(true);
      const res = await fetch('/api/properties');
      if (res.ok) {
        const json = await res.json();
        setProperties(json.properties || []);
      }
    } catch (e) {
      console.warn('Backend unavailable, falling back to demo properties');
      setProperties(getDemoProperties());
    } finally {
      setLoadingProperties(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, []);

  // Save / Update Property
  const handleSaveProperty = async (payload: Partial<ProspectiveProperty>): Promise<boolean> => {
    if (isDemo) {
      saveDemoProperty(payload);
      setProperties(getDemoProperties());
      return true;
    }
    try {
      const isEdit = Boolean(payload.id);
      const url = isEdit ? `/api/properties/${payload.id}` : '/api/properties';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) return false;
      const json = await res.json();
      if (json.properties) {
        setProperties(json.properties);
      } else {
        await fetchProperties();
      }
      return true;
    } catch (e) {
      console.error('Save property failed', e);
      return false;
    }
  };

  // Delete Property
  const handleDeleteProperty = async (id: string, address: string) => {
    if (isLocked) {
      alert('Engine is currently locked. Click Unlock in the bottom dock to make changes.');
      return;
    }
    const confirmDelete = window.confirm(`Remove "${address}" from prospective triage vault?`);
    if (!confirmDelete) return;

    if (isDemo) {
      deleteDemoProperty(id);
      setProperties(getDemoProperties());
      if (activeModeledId === id) setActiveModeledId(null);
      return;
    }

    try {
      const res = await fetch(`/api/properties/${id}`, { method: 'DELETE' });
      if (res.ok) {
        const json = await res.json();
        if (json.properties) setProperties(json.properties);
        else await fetchProperties();
        if (activeModeledId === id) setActiveModeledId(null);
      }
    } catch (e) {
      console.error('Failed to delete property', e);
    }
  };

  // Quick Star Rating Toggle directly on card
  const handleQuickRating = async (prop: ProspectiveProperty, targetActor: 'Alex' | 'Jordan', newRating: number) => {
    if (isLocked) return;
    const key = targetActor === 'Alex' ? 'rating_alex' : 'rating_jordan';
    const currentVal = targetActor === 'Alex' ? prop.rating_alex : prop.rating_jordan;
    const finalVal = currentVal === newRating ? 0 : newRating;

    if (isDemo) {
      saveDemoProperty({ id: prop.id, [key]: finalVal });
      setProperties(getDemoProperties());
      return;
    }

    try {
      const res = await fetch(`/api/properties/${prop.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: finalVal })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.properties) setProperties(json.properties);
        else await fetchProperties();
      }
    } catch (e) {
      console.error('Quick rating failed', e);
    }
  };

  // Model in Matrix action
  const handleModelInMatrix = (propId: string) => {
    setActiveModeledId(propId === activeModeledId ? null : propId);
    if (matrixSectionRef.current) {
      matrixSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Filtered & Sorted Properties
  const filteredProperties = useMemo(() => {
    return properties
      .filter((p) => {
        // Status filter
        if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchAddress = p.address.toLowerCase().includes(q);
          const matchNotes = (p.notes || '').toLowerCase().includes(q);
          const matchSnippet = (p.source_snippet || '').toLowerCase().includes(q);
          if (!matchAddress && !matchNotes && !matchSnippet) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'rating') {
          const totalA = (a.rating_alex || 0) + (a.rating_jordan || 0);
          const totalB = (b.rating_alex || 0) + (b.rating_jordan || 0);
          return totalB - totalA;
        }
        if (sortBy === 'price-asc') return a.guide_price - b.guide_price;
        if (sortBy === 'price-desc') return b.guide_price - a.guide_price;
        if (sortBy === 'newest') {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        return 0;
      });
  }, [properties, statusFilter, searchQuery, sortBy]);

  // Aggregate Vault Stats
  const vaultStats = useMemo(() => {
    const total = properties.length;
    const priorityCount = properties.filter(p => p.status === 'Priority').length;
    const inspectCount = properties.filter(p => p.status === 'Inspect').length;
    const watchingCount = properties.filter(p => p.status === 'Watching').length;
    const passCount = properties.filter(p => p.status === 'Pass').length;

    const avgPrice = total > 0 ? properties.reduce((acc, p) => acc + p.guide_price, 0) / total : 0;
    
    const yields = properties
      .map(p => calculateRentalYield(p.guide_price, p.estimated_rent_weekly))
      .filter((y): y is number => y !== null);
    const avgYield = yields.length > 0 ? yields.reduce((a, b) => a + b, 0) / yields.length : 0;

    return { total, priorityCount, inspectCount, watchingCount, passCount, avgPrice, avgYield };
  }, [properties]);

  // Selected Active Property for Matrix
  const activeProperty = useMemo(() => {
    if (!activeModeledId) return null;
    return properties.find(p => p.id === activeModeledId) || null;
  }, [properties, activeModeledId]);

  // Purchasing Scenarios to display in the Matrix:
  const matrixScenarios = useMemo(() => {
    if (activeProperty) {
      return [
        {
          label: `⚡ Modeled: ${activeProperty.address}`,
          price: activeProperty.guide_price,
          closingCosts: calculateQLDClosingCosts(activeProperty.guide_price),
          lmi15: calculateLMI(activeProperty.guide_price, 0.15),
          isCustom: true,
          property: activeProperty,
        },
        ...STANDARD_BENCHMARKS.map(b => ({
          label: b.label,
          price: b.price,
          closingCosts: calculateQLDClosingCosts(b.price),
          lmi15: calculateLMI(b.price, 0.15),
          isCustom: false,
          property: null,
        }))
      ];
    }

    return STANDARD_BENCHMARKS.map(b => ({
      label: b.label,
      price: b.price,
      closingCosts: calculateQLDClosingCosts(b.price),
      lmi15: calculateLMI(b.price, 0.15),
      isCustom: false,
      property: null,
    }));
  }, [activeProperty]);

  return (
    <div className="space-y-8 pb-20">
      {/* Engine Main Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 dark:text-emerald-400">
              <Building2 className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">Phase 3: The Property Engine & Triage Vault</h2>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground ml-9.5">
            Fast capture intake for WhatsApp links & live borrowing simulation calibrated against verified surplus.
          </p>
        </div>

        {/* Action Button: Fast Capture WhatsApp Listing */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            onClick={() => {
              setEditingProperty(null);
              setIsModalOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md shadow-emerald-500/20 cursor-pointer h-9 px-3.5 rounded-xl flex items-center gap-1.5 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>+ Triage WhatsApp Listing</span>
          </Button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION 1: PROSPECTIVE PROPERTY TRIAGE VAULT             */}
      {/* ======================================================== */}
      <div className="space-y-4">
        {/* Triage Vault Header Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Home className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            <h3 className="text-sm font-semibold tracking-wide text-foreground">
              WhatsApp & Domain Shortlist Vault
            </h3>
            <Badge variant="outline" className="text-[10px] font-mono border-border text-muted-foreground bg-muted/40">
              {vaultStats.total} {vaultStats.total === 1 ? 'Home' : 'Homes'} Shortlisted
            </Badge>
          </div>

          <span className="text-xs text-muted-foreground">
            Paste links from WhatsApp or Domain anytime using the button above.
          </span>
        </div>

        {/* Vault Summary KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-card border border-border text-center shadow-xs">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Priority Shortlist
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-500 dark:text-emerald-400">
              {vaultStats.priorityCount}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Top Prospective Homes</div>
          </div>

          <div className="p-3.5 rounded-xl bg-card border border-border text-center shadow-xs">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Open Home / Inspect
            </div>
            <div className="text-2xl font-bold font-mono text-amber-500 dark:text-amber-400">
              {vaultStats.inspectCount}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Scheduled or Planned</div>
          </div>

          <div className="p-3.5 rounded-xl bg-card border border-border text-center shadow-xs">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Avg Guide Price
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-foreground">
              {vaultStats.avgPrice > 0 ? formatCurrency(vaultStats.avgPrice) : '$0'}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Across Shortlisted Homes</div>
          </div>

          <div className="p-3.5 rounded-xl bg-card border border-border text-center shadow-xs">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Avg Rental Yield
            </div>
            <div className="text-2xl font-bold font-mono text-blue-500 dark:text-blue-400">
              {vaultStats.avgYield > 0 ? `${vaultStats.avgYield.toFixed(2)}%` : '—'}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Gross Investment Return</div>
          </div>
        </div>

        {/* Search, Filter Tabs & Sort Controls */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-2.5 rounded-xl bg-card border border-border">
          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
            {(
              [
                { id: 'ALL', label: `All (${vaultStats.total})` },
                { id: 'Priority', label: `Priority (${vaultStats.priorityCount})` },
                { id: 'Inspect', label: `Inspect (${vaultStats.inspectCount})` },
                { id: 'Watching', label: `Watching (${vaultStats.watchingCount})` },
                { id: 'Pass', label: `Pass (${vaultStats.passCount})` },
              ] as const
            ).map((tab) => {
              const isActive = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer shrink-0 ${
                    isActive
                      ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Search & Sort */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 md:w-56">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search suburb, street or notes..."
                className="h-8 pl-8 text-xs bg-background border-border text-foreground"
              />
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground hidden sm:inline" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="h-8 px-2 rounded-lg text-xs font-medium bg-background border border-border text-foreground focus:outline-hidden cursor-pointer"
              >
                <option value="rating">Highest Rating</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="newest">Newest Added</option>
              </select>
            </div>
          </div>
        </div>

        {/* Property Cards Grid */}
        {loadingProperties ? (
          <div className="p-8 text-center text-xs text-muted-foreground">Loading prospective properties...</div>
        ) : filteredProperties.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-card border border-dashed border-border space-y-3">
            <div className="w-10 h-10 mx-auto rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="text-sm font-semibold text-foreground">No prospective properties found</div>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              {searchQuery || statusFilter !== 'ALL'
                ? 'Try clearing your search query or status filter to see all shortlisted homes.'
                : 'Frictionlessly triage homes shared by Jordan via WhatsApp by clicking "+ Triage WhatsApp Listing" above.'}
            </p>
            <Button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
                setIsModalOpen(true);
              }}
              variant="outline"
              size="sm"
              className="text-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Add First Listing
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredProperties.map((prop) => {
              const grossYield = calculateRentalYield(prop.guide_price, prop.estimated_rent_weekly);
              const isModeled = activeModeledId === prop.id;
              const { suburb, street } = formatPropertyAddress(prop.address);

              return (
                <Card
                  key={prop.id}
                  className={`bg-card border transition-all duration-200 overflow-hidden shadow-sm hover:shadow-md ${
                    isModeled
                      ? 'border-emerald-500/60 ring-2 ring-emerald-500/20 bg-card'
                      : 'border-border hover:border-border/80'
                  }`}
                >
                  <CardHeader className="p-4 pb-3 border-b border-border bg-muted/20">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {/* Status Badge */}
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-semibold uppercase tracking-wider ${
                              prop.status === 'Priority'
                                ? 'bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 border-emerald-500/30'
                                : prop.status === 'Inspect'
                                ? 'bg-amber-500/15 text-amber-500 dark:text-amber-400 border-amber-500/30'
                                : prop.status === 'Watching'
                                ? 'bg-blue-500/15 text-blue-500 dark:text-blue-400 border-blue-500/30'
                                : 'bg-muted text-muted-foreground border-border'
                            }`}
                          >
                            {prop.status}
                          </Badge>

                          {isModeled && (
                            <Badge className="bg-emerald-600 text-white text-[10px] font-mono flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5" /> Modeled in Matrix
                            </Badge>
                          )}
                        </div>

                        {/* Title: Suburb First (Prominent & Larger), Street Underneath */}
                        <div className="pt-0.5">
                          <h4 className="text-base sm:text-lg font-black text-foreground tracking-tight leading-snug">
                            {suburb}
                          </h4>
                          {street ? (
                            <p className="text-xs text-muted-foreground font-medium mt-0.5 truncate">
                              {street}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      {/* External Link */}
                      {prop.url && (
                        <a
                          href={prop.url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-blue-500 hover:bg-muted transition-colors cursor-pointer shrink-0"
                          title="Open listing link in new tab"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 space-y-3.5">
                    {/* Price & Yield Row */}
                    <div className="flex items-baseline justify-between">
                      <div>
                        <div className="text-xs text-muted-foreground font-medium">Guide Price</div>
                        <div className="text-2xl font-extrabold font-mono text-foreground">
                          {formatCurrency(prop.guide_price)}
                        </div>
                      </div>

                      <div className="text-right">
                        {prop.estimated_rent_weekly ? (
                          <>
                            <div className="text-xs text-muted-foreground font-medium">
                              Rent: <span className="font-mono text-foreground">${prop.estimated_rent_weekly}/wk</span>
                            </div>
                            {grossYield !== null && (
                              <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 mt-0.5">
                                {grossYield.toFixed(2)}% Gross Yield
                              </Badge>
                            )}
                          </>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">Rent unmodeled</span>
                        )}
                      </div>
                    </div>

                    {/* Specs Pills (Beds, Baths, Cars) */}
                    {(prop.bedrooms || prop.bathrooms || prop.car_spaces) && (
                      <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium border-t border-b border-border/60 py-2">
                        {prop.bedrooms ? (
                          <span className="flex items-center gap-1">
                            <Bed className="w-3.5 h-3.5 text-foreground" /> {prop.bedrooms} Bed
                          </span>
                        ) : null}
                        {prop.bathrooms ? (
                          <span className="flex items-center gap-1">
                            <Bath className="w-3.5 h-3.5 text-foreground" /> {prop.bathrooms} Bath
                          </span>
                        ) : null}
                        {prop.car_spaces ? (
                          <span className="flex items-center gap-1">
                            <Car className="w-3.5 h-3.5 text-foreground" /> {prop.car_spaces} Car
                          </span>
                        ) : null}
                      </div>
                    )}

                    {/* Dual Star Ratings: Alex & Jordan */}
                    <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-muted/30 border border-border/80">
                      {/* Alex Stars */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Alex
                          </span>
                          <span className="font-mono text-foreground font-semibold">
                            {prop.rating_alex || 0}/5
                          </span>
                        </div>
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => handleQuickRating(prop, 'Alex', star)}
                              disabled={isLocked}
                              className={`p-0.5 transition-colors ${isLocked ? 'cursor-default' : 'cursor-pointer hover:text-amber-400'}`}
                              title={`Set Alex's rating to ${star} stars`}
                            >
                              <Star
                                className={`w-3.5 h-3.5 ${
                                   star <= (prop.rating_alex || 0)
                                    ? 'text-amber-400 fill-amber-400'
                                    : 'text-muted-foreground/30'
                                }`}
                              />
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Jordan Stars */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            Jordan
                          </span>
                          <span className="font-mono text-foreground font-semibold">
                            {prop.rating_jordan || 0}/5
                          </span>
                        </div>
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => handleQuickRating(prop, 'Jordan', star)}
                              disabled={isLocked}
                              className={`p-0.5 transition-colors ${isLocked ? 'cursor-default' : 'cursor-pointer hover:text-rose-400'}`}
                              title={`Set Jordan's rating to ${star} stars`}
                            >
                              <Star
                                className={`w-3.5 h-3.5 ${
                                  star <= (prop.rating_jordan || 0)
                                    ? 'text-rose-400 fill-rose-400'
                                    : 'text-muted-foreground/30'
                                }`}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Notes & Inspection time preview */}
                    {prop.notes && (
                      <div className="p-2.5 rounded-xl bg-muted/20 border border-border/60 text-xs text-muted-foreground space-y-1">
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-foreground">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span>Inspection & Notes:</span>
                        </div>
                        <p className="line-clamp-2 text-[11px] text-muted-foreground leading-relaxed">
                          {prop.notes}
                        </p>
                      </div>
                    )}

                    {/* Action Bar */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/80">
                      <Button
                        variant={isModeled ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleModelInMatrix(prop.id)}
                        className={`h-7 text-xs font-semibold px-2.5 cursor-pointer ${
                          isModeled
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            : 'text-emerald-500 dark:text-emerald-400 hover:text-emerald-600 hover:bg-emerald-500/10 border-emerald-500/30'
                        }`}
                      >
                        <Sparkles className="w-3 h-3 mr-1" />
                        {isModeled ? 'Modeled in Matrix' : 'Model in Matrix'}
                      </Button>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingProperty(prop);
                            setIsModalOpen(true);
                          }}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                          title="Edit Property"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteProperty(prop.id, prop.address)}
                          disabled={isLocked}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive cursor-pointer disabled:opacity-40"
                          title={isLocked ? 'Unlock engine to delete' : 'Delete Property'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* SECTION 2: CASH FLOW REALITY CHECK                       */}
      {/* ======================================================== */}
      <Card className="bg-card border-border shadow-md">
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              <CardTitle className="text-sm font-semibold tracking-wide text-foreground">
                Reality Check: JSON Baseline vs Email Assumptions
              </CardTitle>
            </div>
            <Badge variant="outline" className="text-[10px] font-mono border-border text-muted-foreground bg-muted/40">
              Target Benchmark: $700.00 / wk
            </Badge>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            Strict verified cash flow surplus comparison against the initial property game plan.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-muted/30 border border-border text-center">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Alex True Surplus
              </div>
              <div className="text-2xl font-bold font-mono text-foreground">
                {formatCurrency(alexSurplusW)} <span className="text-xs font-sans text-muted-foreground font-normal">/ wk</span>
              </div>
              <div className="text-[11px] font-mono text-muted-foreground/80 mt-1">
                ({formatCurrency(alexSurplusW * 52)} / yr)
              </div>
            </div>

            <div className="p-4 rounded-xl bg-muted/30 border border-border text-center">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Jordan True Surplus
              </div>
              <div className="text-2xl font-bold font-mono text-foreground">
                {formatCurrency(jordanSurplusW)} <span className="text-xs font-sans text-muted-foreground font-normal">/ wk</span>
              </div>
              <div className="text-[11px] font-mono text-muted-foreground/80 mt-1">
                ({formatCurrency(jordanSurplusW * 52)} / yr)
              </div>
            </div>

            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center">
              <div className="text-xs font-semibold uppercase tracking-wider text-emerald-500 dark:text-emerald-400 mb-1">
                Combined Verified Savings Rate
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-300">
                {formatCurrency(combinedSurplusW)} <span className="text-xs font-sans text-emerald-500 dark:text-emerald-400 font-normal">/ wk</span>
              </div>
              <div className="text-xs font-medium mt-1 font-mono">
                {varianceFromEmail < 0 ? (
                  <span className="text-rose-500 dark:text-rose-400">
                    {formatCurrency(Math.abs(varianceFromEmail))} short of $700/wk email assumption
                  </span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    +{formatCurrency(varianceFromEmail)} over $700/wk email assumption
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ======================================================== */}
      {/* SECTION 3: CASH POOL TRAJECTORY (RIGHT NOW + HORIZONS)    */}
      {/* ======================================================== */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold tracking-wide text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-500 dark:text-blue-400" />
              Cash Pool Trajectory & Accumulation
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Starting Base: <strong className="text-foreground font-mono">{formatCurrency(INITIAL_CASH)}</strong> (Alex Offset Capital) • Growth: <strong className="text-emerald-500 font-mono">+{formatCurrency(combinedSurplusW)}/wk</strong>
            </p>
          </div>
          <Badge variant="outline" className="text-[10px] font-mono border-blue-500/30 text-blue-500 dark:text-blue-400 bg-blue-500/10 self-start sm:self-auto">
            Right Now Assessment + Compounding
          </Badge>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { weeks: 0, label: 'Right Now (Today)', tag: 'Current Cash Ready' },
            { weeks: 13, label: '3 Months (13 wks)', tag: 'Q1 Projected Cash' },
            { weeks: 26, label: '6 Months (26 wks)', tag: 'H1 Projected Cash' },
            { weeks: 52, label: '12 Months (52 wks)', tag: '1-Year Projected Cash' },
          ].map(({ weeks, label, tag }) => {
            const totalSaved = combinedSurplusW * weeks;
            const totalCash = INITIAL_CASH + totalSaved;
            const isToday = weeks === 0;

            return (
              <Card
                key={weeks}
                className={`bg-card border shadow-xs transition-all ${
                  isToday ? 'border-blue-500/50 bg-blue-500/5 ring-1 ring-blue-500/20' : 'border-border'
                }`}
              >
                <CardContent className="p-3.5 text-center">
                  <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center justify-center gap-1">
                    {isToday && <Calendar className="w-3 h-3 text-blue-500" />}
                    <span>{label}</span>
                  </div>

                  <div className="text-xs font-semibold font-mono mb-1.5">
                    {isToday ? (
                      <span className="text-blue-500 dark:text-blue-400">Baseline Capital</span>
                    ) : (
                      <span className="text-emerald-500 dark:text-emerald-400">+{formatCurrency(totalSaved)} surplus</span>
                    )}
                  </div>

                  <div className="text-2xl sm:text-3xl font-extrabold font-mono text-foreground">
                    {formatCurrency(totalCash)}
                  </div>

                  <div className="text-[10px] text-muted-foreground mt-1">
                    {tag}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION 4: PURCHASING MATRIX (15% vs 20% DEPOSIT)        */}
      {/* ======================================================== */}
      <div ref={matrixSectionRef} className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold tracking-wide text-foreground flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              Purchasing Matrix & Readiness Simulation
            </h3>
            <p className="text-xs text-muted-foreground">
              Evaluates statutory QLD stamp duty, capitalized LMI, loan repayments, and earliest settlement dates.
            </p>
          </div>

          {/* Repayment Cadence Switcher + Reset Modeled Button */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border">
              <span className="text-[10px] font-medium text-muted-foreground px-1.5 hidden sm:inline">Repayments:</span>
              {(['weekly', 'fortnightly', 'monthly'] as const).map((cad) => (
                <button
                  key={cad}
                  onClick={() => setRepaymentCadence(cad)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg capitalize cursor-pointer transition-all ${
                    repaymentCadence === cad
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {cad === 'weekly' ? 'Wk' : cad === 'fortnightly' ? 'Fn' : 'Mo'}
                </button>
              ))}
            </div>

            {activeProperty && (
              <div className="flex items-center gap-1.5">
                <Badge className="bg-emerald-600 text-white text-xs font-mono">
                  Modeled: {formatPropertyAddress(activeProperty.address).suburb}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveModeledId(null)}
                  className="h-7 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer px-2"
                >
                  Reset
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          {matrixScenarios.map((prop) => {
            const holdingBurn = estimateHoldingBurn(prop.price);
            
            // 20% Deposit scenario numbers
            const deposit20 = prop.price * 0.20;
            const cashNeeded20 = deposit20 + prop.closingCosts;
            const loan20 = prop.price * 0.80;
            const rep20 = calculateMortgageRepayments(loan20);
            const settleReady20 = calculateSettlementReadiness(INITIAL_CASH, cashNeeded20, combinedSurplusW);

            // 15% Deposit scenario numbers
            const deposit15 = prop.price * 0.15;
            const cashNeeded15 = deposit15 + prop.closingCosts;
            const loan15 = (prop.price * 0.85) + prop.lmi15;
            const rep15 = calculateMortgageRepayments(loan15);
            const settleReady15 = calculateSettlementReadiness(INITIAL_CASH, cashNeeded15, combinedSurplusW);

            const displayRep20 = repaymentCadence === 'weekly' ? rep20.weekly : repaymentCadence === 'fortnightly' ? rep20.fortnightly : rep20.monthly;
            const displayRep15 = repaymentCadence === 'weekly' ? rep15.weekly : repaymentCadence === 'fortnightly' ? rep15.fortnightly : rep15.monthly;
            const cadenceSuffix = repaymentCadence === 'weekly' ? '/wk' : repaymentCadence === 'fortnightly' ? '/fn' : '/mo';

            // Helper: Render Expected Equity or Shortfall Solution Pathways
            const renderEquitySection = (
              scenarioType: '20%' | '15%',
              cashNeeded: number
            ) => {
              const buffer = INITIAL_CASH - cashNeeded;
              const isReadyToday = buffer >= 0;

              if (isReadyToday) {
                return (
                  <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Expected Equity: 60% Alex / 40% Jordan</span>
                      </div>
                      <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-mono">
                        Fully Funded Today
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      Standard condition met: Alex funds 100% of upfront cash ({formatCurrency(cashNeeded)}) from BOQ offset reserves with a +{formatCurrency(buffer)} surplus cushion remaining.
                    </p>
                  </div>
                );
              }

              // Capital readiness timeline is NOT ready today -> Show tailored solution pathways
              const shortfall = Math.abs(buffer);
              const weeksToSave = combinedSurplusW > 0 ? Math.ceil(shortfall / combinedSurplusW) : 0;

              return (
                <div className="p-3.5 rounded-xl bg-muted/40 border border-border text-xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-foreground">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                      <span>Expected Equity: Solution Pathways</span>
                    </div>
                    <Badge variant="outline" className="border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10 font-mono text-[10px]">
                      Shortfall: {formatCurrency(shortfall)}
                    </Badge>
                  </div>

                  <div className="p-2 rounded-lg bg-background/80 border border-border text-[11px] space-y-0.5">
                    <div className="text-muted-foreground leading-relaxed">
                      To buy today at <strong className="text-foreground">{scenarioType} deposit</strong>, you need an extra{' '}
                      <strong className="text-amber-600 dark:text-amber-400 font-mono">{formatCurrency(shortfall)}</strong> above your {formatCurrency(INITIAL_CASH)} offset capital:
                    </div>
                  </div>

                  <div className="space-y-2 text-[11px] text-muted-foreground leading-relaxed">
                    {shortfall <= 25000 && (
                      <>
                        <div className="flex items-start gap-1.5">
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">🪙 Crypto Exchange Crypto Injection:</span>
                          <span>
                            Deploy Alex's liquid Crypto Exchange crypto holdings (~$20k–$25k AUD) to immediately bridge the {formatCurrency(shortfall)} gap today, preserving the agreed <strong>60% Alex / 40% Jordan</strong> ownership with zero external debt.
                          </span>
                        </div>
                        <div className="flex items-start gap-1.5">
                          <span className="font-semibold text-foreground shrink-0">⏳ Organic Savings:</span>
                          <span>
                            Save organically for ~<strong>{weeksToSave} weeks</strong> at {formatCurrency(combinedSurplusW)}/wk to bridge the gap without touching crypto reserves.
                          </span>
                        </div>
                      </>
                    )}

                    {shortfall > 25000 && shortfall < 50000 && (
                      <>
                        <div className="flex items-start gap-1.5">
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">🪙 Crypto Exchange + Cash Flow:</span>
                          <span>
                            Deploy $20,000 from Crypto Exchange crypto, leaving only {formatCurrency(shortfall - 20000)} to save organically in ~{Math.ceil((shortfall - 20000) / combinedSurplusW)} weeks.
                          </span>
                        </div>
                        <div className="flex items-start gap-1.5">
                          <span className="font-semibold text-blue-600 dark:text-blue-400 shrink-0">🏦 Jordan Equity Facility:</span>
                          <span>
                            Jordan accesses existing property equity / refinancing line to contribute {formatCurrency(shortfall)}, adjusting equity proportionally or agreeing to an initial capital credit.
                          </span>
                        </div>
                      </>
                    )}

                    {shortfall >= 50000 && (
                      <>
                        <div className="flex items-start gap-1.5">
                          <span className="font-semibold text-purple-600 dark:text-purple-400 shrink-0">🏦 Jordan Equity Release:</span>
                          <span>
                            Draw $50k+ from Jordan's existing property equity or loan redraw to fund the {formatCurrency(shortfall)} deposit balance.
                          </span>
                        </div>
                        <div className="flex items-start gap-1.5">
                          <span className="font-semibold text-foreground shrink-0">🤝 Proportional Split:</span>
                          <span>
                            Recalibrate ownership (e.g. <strong>50/50</strong> or <strong>55/45</strong> with capital protection agreement) reflecting Jordan's significant upfront deposit contribution.
                          </span>
                        </div>
                        <div className="flex items-start gap-1.5">
                          <span className="font-semibold text-foreground shrink-0">⏳ Extended Timeline:</span>
                          <span>
                            Save organically for ~<strong>{weeksToSave} weeks</strong> (~{Math.round(weeksToSave / 4.33)} months) at {formatCurrency(combinedSurplusW)}/wk.
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            };

            return (
              <Card
                key={prop.label}
                className={`bg-card border shadow-md overflow-hidden ${
                  prop.isCustom ? 'border-emerald-500/70 ring-2 ring-emerald-500/20' : 'border-border'
                }`}
              >
                {/* Header Banner */}
                <div className="bg-muted/40 border-b border-border px-5 py-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <h4 className="text-base sm:text-lg font-bold text-foreground font-mono">
                      {formatCurrency(prop.price)} Home
                    </h4>
                    <span className="text-xs text-muted-foreground">
                      ({prop.label})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Itemized Closing Costs Inspection Trigger */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setClosingCostsModalData({
                          isOpen: true,
                          price: prop.price,
                          address: prop.property?.address,
                        })
                      }
                      className="h-7 text-xs font-mono border-border text-foreground hover:bg-muted cursor-pointer flex items-center gap-1.5"
                      title="Click to view itemized statutory transfer duty and settlement fees"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                      <span>QLD Closing Costs: {formatCurrency(prop.closingCosts)}</span>
                      <span className="text-[10px] text-emerald-500 dark:text-emerald-400 font-sans font-semibold underline ml-0.5">
                        Inspect
                      </span>
                    </Button>
                  </div>
                </div>

                <CardContent className="p-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
                    {/* ======================================================== */}
                    {/* Scenario 1: 20% Deposit (Clean Equity)                   */}
                    {/* ======================================================== */}
                    <div className="p-5 space-y-4">
                      <div className="flex items-center justify-between pb-2 border-b border-border/80">
                        <div>
                          <h5 className="text-sm font-semibold text-foreground">20% Deposit (Zero LMI)</h5>
                          <span className="text-[11px] text-muted-foreground">Clean equity standard</span>
                        </div>
                        <Badge className="bg-emerald-500/15 text-emerald-500 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-mono">
                          Clean Equity
                        </Badge>
                      </div>

                      {/* Financial Metrics Table */}
                      <div className="space-y-1.5 text-xs font-mono">
                        <div className="flex justify-between text-muted-foreground">
                          <span className="font-sans">Deposit Required (20%):</span>
                          <strong className="text-foreground">{formatCurrency(deposit20)}</strong>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span className="font-sans">Closing Costs (Duty + Fees):</span>
                          <button
                            type="button"
                            onClick={() => setClosingCostsModalData({ isOpen: true, price: prop.price, address: prop.property?.address })}
                            className="text-foreground hover:text-emerald-500 underline decoration-dotted cursor-pointer"
                          >
                            {formatCurrency(prop.closingCosts)}
                          </button>
                        </div>
                        <div className="flex justify-between text-foreground font-semibold pt-1.5 border-t border-border/80 text-sm">
                          <span className="font-sans">Total Cash Needed:</span>
                          <strong className="text-emerald-500 dark:text-emerald-400 font-mono">
                            {formatCurrency(cashNeeded20)}
                          </strong>
                        </div>

                        {/* Loan & Repayments Tier */}
                        <div className="pt-2 border-t border-border/60 space-y-1.5">
                          <div className="flex justify-between text-muted-foreground">
                            <span className="font-sans">Total Loan Amount (80%):</span>
                            <strong className="text-foreground">{formatCurrency(loan20)}</strong>
                          </div>
                          <div className="flex justify-between items-baseline text-foreground">
                            <span className="font-sans text-xs">
                              Est. Repayments ({repaymentCadence}):
                            </span>
                            <div className="text-right">
                              <span className="text-base font-extrabold font-mono text-emerald-500 dark:text-emerald-400">
                                {formatCurrency(displayRep20)}
                              </span>
                              <span className="text-xs text-muted-foreground font-sans ml-1">{cadenceSuffix}</span>
                            </div>
                          </div>
                          <div className="text-[10px] text-muted-foreground flex justify-between">
                            <span>P&I @ 6.15% p.a. (30yr):</span>
                            <span>{formatCurrency(rep20.weekly)}/wk • {formatCurrency(rep20.fortnightly)}/fn • {formatCurrency(rep20.monthly)}/mo</span>
                          </div>
                        </div>

                        {/* Estimated Ongoing Holding Burn */}
                        <div className="pt-2 border-t border-border/60 flex justify-between items-center text-[11px] text-muted-foreground">
                          <span className="font-sans">Future Holding Burn (Rates, Water, Ins):</span>
                          <span className="font-mono text-foreground font-medium">
                            ~{formatCurrency(holdingBurn.totalWeeklyBurn)}/wk (~{formatCurrency(holdingBurn.totalAnnualBurn)}/yr)
                          </span>
                        </div>
                      </div>

                      {/* Expected Equity: Clean Status if ready, Tailored Shortfall Pathways if not */}
                      {renderEquitySection('20%', cashNeeded20)}

                      {/* Timeline Readiness Matrix (Right Now, 3M, 6M, 12M) */}
                      <div className="space-y-1.5 pt-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Capital Readiness Timeline
                        </div>

                        {[
                          { weeks: 0, label: 'Right Now (Today)' },
                          { weeks: 13, label: '3 Months (13 wks)' },
                          { weeks: 26, label: '6 Months (26 wks)' },
                          { weeks: 52, label: '12 Months (52 wks)' },
                        ].map(({ weeks, label }) => {
                          const cashAvailable = INITIAL_CASH + (combinedSurplusW * weeks);
                          const buffer = cashAvailable - cashNeeded20;
                          const isPass = buffer >= 0;

                          return (
                            <div 
                              key={weeks} 
                              className={`flex items-center justify-between p-2 rounded-lg text-xs font-mono border ${
                                isPass 
                                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-300' 
                                  : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-300'
                              }`}
                            >
                              <span className="font-sans font-medium flex items-center gap-1.5">
                                {isPass ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                                {label}:
                              </span>
                              <strong>
                                {isPass ? `Ready (+${formatCurrency(buffer)})` : `Short (${formatCurrency(buffer)})`}
                              </strong>
                            </div>
                          );
                        })}
                      </div>

                      {/* Earliest Technical Settlement Assessment */}
                      <div className="p-2.5 rounded-xl bg-muted/40 border border-border text-[11px] space-y-1">
                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Earliest Contract Settlement:</span>
                        </div>
                        <p className="text-muted-foreground leading-relaxed">
                          {settleReady20.readinessSummary}
                        </p>
                      </div>
                    </div>

                    {/* ======================================================== */}
                    {/* Scenario 2: 15% Deposit (+ Capitalized LMI)              */}
                    {/* ======================================================== */}
                    <div className="p-5 space-y-4 bg-muted/10">
                      <div className="flex items-center justify-between pb-2 border-b border-border/80">
                        <div>
                          <h5 className="text-sm font-semibold text-foreground">15% Deposit (+ Capitalized LMI)</h5>
                          <span className="text-[11px] text-muted-foreground">Accelerated entry option</span>
                        </div>
                        <Badge className="bg-blue-500/15 text-blue-500 dark:text-blue-300 border-blue-500/30 text-[10px] font-mono">
                          Accelerated Entry
                        </Badge>
                      </div>

                      {/* Financial Metrics Table */}
                      <div className="space-y-1.5 text-xs font-mono">
                        <div className="flex justify-between text-muted-foreground">
                          <span className="font-sans">Deposit Required (15%):</span>
                          <strong className="text-foreground">{formatCurrency(deposit15)}</strong>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span className="font-sans">Closing Costs (Duty + Fees):</span>
                          <button
                            type="button"
                            onClick={() => setClosingCostsModalData({ isOpen: true, price: prop.price, address: prop.property?.address })}
                            className="text-foreground hover:text-blue-500 underline decoration-dotted cursor-pointer"
                          >
                            {formatCurrency(prop.closingCosts)}
                          </button>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span className="font-sans">Est. LMI (Capitalized):</span>
                          <strong className="text-foreground">{formatCurrency(prop.lmi15)}</strong>
                        </div>
                        <div className="flex justify-between text-foreground font-semibold pt-1.5 border-t border-border/80 text-sm">
                          <span className="font-sans">Total Cash Needed:</span>
                          <strong className="text-blue-500 dark:text-blue-400 font-mono">
                            {formatCurrency(cashNeeded15)}
                          </strong>
                        </div>

                        {/* Loan & Repayments Tier */}
                        <div className="pt-2 border-t border-border/60 space-y-1.5">
                          <div className="flex justify-between text-muted-foreground">
                            <span className="font-sans">Total Loan Amount (85% + LMI):</span>
                            <strong className="text-foreground">{formatCurrency(loan15)}</strong>
                          </div>
                          <div className="flex justify-between items-baseline text-foreground">
                            <span className="font-sans text-xs">
                              Est. Repayments ({repaymentCadence}):
                            </span>
                            <div className="text-right">
                              <span className="text-base font-extrabold font-mono text-blue-500 dark:text-blue-400">
                                {formatCurrency(displayRep15)}
                              </span>
                              <span className="text-xs text-muted-foreground font-sans ml-1">{cadenceSuffix}</span>
                            </div>
                          </div>
                          <div className="text-[10px] text-muted-foreground flex justify-between">
                            <span>P&I @ 6.15% p.a. (30yr):</span>
                            <span>{formatCurrency(rep15.weekly)}/wk • {formatCurrency(rep15.fortnightly)}/fn • {formatCurrency(rep15.monthly)}/mo</span>
                          </div>
                        </div>

                        {/* Estimated Ongoing Holding Burn */}
                        <div className="pt-2 border-t border-border/60 flex justify-between items-center text-[11px] text-muted-foreground">
                          <span className="font-sans">Future Holding Burn (Rates, Water, Ins):</span>
                          <span className="font-mono text-foreground font-medium">
                            ~{formatCurrency(holdingBurn.totalWeeklyBurn)}/wk (~{formatCurrency(holdingBurn.totalAnnualBurn)}/yr)
                          </span>
                        </div>
                      </div>

                      {/* Expected Equity: Clean Status if ready, Tailored Shortfall Pathways if not */}
                      {renderEquitySection('15%', cashNeeded15)}

                      {/* Timeline Readiness Matrix (Right Now, 3M, 6M, 12M) */}
                      <div className="space-y-1.5 pt-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Capital Readiness Timeline
                        </div>

                        {[
                          { weeks: 0, label: 'Right Now (Today)' },
                          { weeks: 13, label: '3 Months (13 wks)' },
                          { weeks: 26, label: '6 Months (26 wks)' },
                          { weeks: 52, label: '12 Months (52 wks)' },
                        ].map(({ weeks, label }) => {
                          const cashAvailable = INITIAL_CASH + (combinedSurplusW * weeks);
                          const buffer = cashAvailable - cashNeeded15;
                          const isPass = buffer >= 0;

                          return (
                            <div 
                              key={weeks} 
                              className={`flex items-center justify-between p-2 rounded-lg text-xs font-mono border ${
                                isPass 
                                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-300' 
                                  : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-300'
                              }`}
                            >
                              <span className="font-sans font-medium flex items-center gap-1.5">
                                {isPass ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                                {label}:
                              </span>
                              <strong>
                                {isPass ? `Ready (+${formatCurrency(buffer)})` : `Short (${formatCurrency(buffer)})`}
                              </strong>
                            </div>
                          );
                        })}
                      </div>

                      {/* Earliest Technical Settlement Assessment */}
                      <div className="p-2.5 rounded-xl bg-muted/40 border border-border text-[11px] space-y-1">
                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-blue-500" />
                          <span>Earliest Contract Settlement:</span>
                        </div>
                        <p className="text-muted-foreground leading-relaxed">
                          {settleReady15.readinessSummary}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Intake / Edit Modal */}
      <PropertyIntakeModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingProperty(null);
        }}
        onSave={handleSaveProperty}
        initialData={editingProperty}
        sessionActor={sessionActor || null}
      />

      {/* Itemized QLD Closing Costs Inspection Modal */}
      <ClosingCostsModal
        isOpen={closingCostsModalData.isOpen}
        onClose={() => setClosingCostsModalData({ isOpen: false, price: 0 })}
        price={closingCostsModalData.price}
        propertyAddress={closingCostsModalData.address}
      />
    </div>
  );
}
