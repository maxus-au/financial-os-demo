import { useState, useMemo, useEffect } from 'react';
import type { FinancialItem } from '../types';
import { calculateMetrics, formatCurrency } from '../utils/financeMath';
import { simulateSinkingTrajectory, getDefaultDueMonth, getBillingCycleMonthsLabel, type WeekPoint } from '../utils/sinkingMath';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  ShieldCheck, 
  TrendingDown, 
  Calendar, 
  Clock, 
  Wallet,
  Layers,
  RotateCcw,
  ArrowRight,
  ZoomIn,
  ZoomOut,
  Pencil,
  Check,
  Sparkles
} from 'lucide-react';

interface Props {
  items: FinancialItem[];
  onUpdateItem?: (item: FinancialItem, reason?: string) => Promise<{ success: boolean; error?: string }>;
  isLocked?: boolean;
}

interface StoredRouteBalance {
  balance: number;
  updatedAt: string; // ISO 8601 string
}

type RouteBalancesMap = Record<string, StoredRouteBalance>;

const STORAGE_KEY = 'maxwell_sinking_route_balances';

function getStoredBalances(): RouteBalancesMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error loading stored route balances:', e);
  }
  return {};
}

function formatTimestamp(isoStr?: string): string {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '';
  }
}

const SINKING_ROUTES = [
  { id: 'ING • Everyday', name: 'ING • Everyday (Salary Hub)', desc: 'Stephen Primary Salary ($1,489/wk), Dispersals & Card Spend' },
  { id: 'ING • Savings', name: 'ING • Savings', desc: 'Stephen Vehicle (Rego/Tyres) & Personal Savings' },
  { id: 'MQ • Joint Savings', name: 'MQ • Joint Savings', desc: 'Council Rates, Water, Strata & House Deposit' },
  { id: 'MQ • Joint Household', name: 'MQ • Joint Household', desc: 'Living, Groceries, Electricity & Internet' },
  { id: 'MQ • Shae Savings', name: 'MQ • Shae Savings', desc: 'Shae Personal Emergency & Sinking Fund' },
  { id: 'BOQ • Home Offset', name: 'BOQ • Home Offset', desc: 'Pure Mortgage Offset Facility (Shae & Stephen Rent)' },
  { id: 'ALL', name: 'All Sinking Routes', desc: 'Combined Overview across all Reserve Accounts' }
];

const MONTH_OPTIONS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' }
];

export default function SinkingFundEngine({ items, onUpdateItem, isLocked = false }: Props) {
  const [selectedRoute, setSelectedRoute] = useState<string>('ING • Everyday');
  const [routeBalances, setRouteBalances] = useState<RouteBalancesMap>(getStoredBalances);
  const [balanceInput, setBalanceInput] = useState<string>('');
  const [isEditingBalance, setIsEditingBalance] = useState<boolean>(false);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [hoveredWeek, setHoveredWeek] = useState<WeekPoint | null>(null);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [showStressTest, setShowStressTest] = useState<boolean>(false);

  // Sum of individually calibrated reserve accounts (excluding ALL and Everyday transaction hub)
  const aggregateIndividualBalance = useMemo(() => {
    return SINKING_ROUTES.filter(r => r.id !== 'ALL' && r.id !== 'ING • Everyday').reduce((sum, r) => {
      return sum + (routeBalances[r.id]?.balance || 0);
    }, 0);
  }, [routeBalances]);

  const calibratedCount = useMemo(() => {
    return SINKING_ROUTES.filter(r => r.id !== 'ALL' && r.id !== 'ING • Everyday' && routeBalances[r.id] && routeBalances[r.id].balance > 0).length;
  }, [routeBalances]);

  // Determine the active record and balance
  const currentRecord = routeBalances[selectedRoute];
  const effectiveBalance = useMemo(() => {
    if (selectedRoute === 'ALL') {
      return currentRecord ? currentRecord.balance : aggregateIndividualBalance;
    }
    return currentRecord ? currentRecord.balance : 0;
  }, [selectedRoute, currentRecord, aggregateIndividualBalance]);

  // Sync input string when switching route or when aggregate changes
  useEffect(() => {
    setIsEditingBalance(false);
    if (selectedRoute === 'ALL') {
      if (currentRecord && currentRecord.balance > 0) {
        setBalanceInput(String(currentRecord.balance));
      } else if (aggregateIndividualBalance > 0) {
        setBalanceInput(String(aggregateIndividualBalance));
      } else {
        setBalanceInput('');
      }
    } else {
      if (currentRecord && currentRecord.balance > 0) {
        setBalanceInput(String(currentRecord.balance));
      } else {
        setBalanceInput('');
      }
    }
  }, [selectedRoute, currentRecord, aggregateIndividualBalance]);

  const handleBalanceChange = (rawVal: string) => {
    setBalanceInput(rawVal);
    const parsed = parseFloat(rawVal);
    const validNum = isNaN(parsed) || parsed < 0 ? 0 : parsed;

    const updated: RouteBalancesMap = {
      ...routeBalances,
      [selectedRoute]: {
        balance: validNum,
        updatedAt: new Date().toISOString()
      }
    };
    setRouteBalances(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save route balance:', e);
    }
  };

  const handleBalanceCommit = () => {
    setIsEditingBalance(false);
  };

  const handleClearBalance = () => {
    const updated = { ...routeBalances };
    delete updated[selectedRoute];
    setRouteBalances(updated);
    setBalanceInput('');
    setIsEditingBalance(false);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to clear route balance:', e);
    }
  };

  // Run simulation based on current items, selected route, and effective stored balance
  const simulation = useMemo(() => {
    return simulateSinkingTrajectory(items, selectedRoute, effectiveBalance);
  }, [items, selectedRoute, effectiveBalance]);

  // Master Salary & Outbound Dispersal Breakdown (only for ING • Everyday)
  const everydayWaterfall = useMemo(() => {
    if (selectedRoute !== 'ING • Everyday') return null;

    const salaryItem = items.find(i => i.id === 'S-01' && i.verification_status !== 'Archived / Paid Off');
    const salaryWeekly = salaryItem ? calculateMetrics(salaryItem.native_amount, salaryItem.cadence).weekly : 1489.08;

    const dispersals = [
      {
        target: 'BOQ • Home Offset',
        purpose: 'Rent to Shae (Offset Shield)',
        amount: 0,
        color: 'text-blue-400',
        borderColor: 'border-blue-500/20',
        bgColor: 'bg-blue-500/5',
        dotColor: 'bg-blue-500',
        items: [] as string[]
      },
      {
        target: 'MQ • Joint Savings',
        purpose: 'House Deposit ($175) & Sinking ($75)',
        amount: 0,
        color: 'text-emerald-400',
        borderColor: 'border-emerald-500/20',
        bgColor: 'bg-emerald-500/5',
        dotColor: 'bg-emerald-500',
        items: [] as string[]
      },
      {
        target: 'MQ • Joint Household',
        purpose: 'Groceries, Utilities, Internet & Gym',
        amount: 0,
        color: 'text-zinc-200',
        borderColor: 'border-zinc-700/40',
        bgColor: 'bg-zinc-800/20',
        dotColor: 'bg-zinc-300',
        items: [] as string[]
      },
      {
        target: 'ING • Savings',
        purpose: 'Vehicle Rego, Tyres & Allowance',
        amount: 0,
        color: 'text-amber-400',
        borderColor: 'border-amber-500/20',
        bgColor: 'bg-amber-500/5',
        dotColor: 'bg-amber-500',
        items: [] as string[]
      }
    ];

    let directDebitsWeekly = 0;
    let everydayCardWeekly = 0;
    let dispersalsTotal = 0;

    items.forEach(i => {
      if (i.owner !== 'Stephen' || i.verification_status === 'Archived / Paid Off' || i.id === 'S-01') return;
      const m = calculateMetrics(i.native_amount, i.cadence).weekly;
      if (m <= 0) return;

      if (i.account_route === 'BOQ • Home Offset' && i.direction === 'Transfer') {
        dispersals[0].amount += m;
        dispersals[0].items.push(i.description);
        dispersalsTotal += m;
      } else if (i.account_route === 'MQ • Joint Savings' && i.direction === 'Transfer') {
        dispersals[1].amount += m;
        dispersals[1].items.push(i.description);
        dispersalsTotal += m;
      } else if (i.account_route === 'MQ • Joint Household' && i.direction === 'Transfer') {
        dispersals[2].amount += m;
        dispersals[2].items.push(i.description);
        dispersalsTotal += m;
      } else if (i.account_route === 'ING • Savings') {
        dispersals[3].amount += m;
        dispersals[3].items.push(i.description);
        dispersalsTotal += m;
      } else if (i.account_route === 'ING • Direct Debit') {
        directDebitsWeekly += m;
      } else if (i.account_route === 'ING • Everyday' && i.direction === 'Outflow') {
        everydayCardWeekly += m;
      }
    });

    const totalOutflows = dispersalsTotal + directDebitsWeekly + everydayCardWeekly;
    const netWeeklySurplus = salaryWeekly - totalOutflows;

    return {
      salaryWeekly,
      dispersalsTotal,
      dispersals,
      directDebitsWeekly,
      everydayCardWeekly,
      totalOutflows,
      netWeeklySurplus
    };
  }, [items, selectedRoute]);

  // Master Household Living & Outgoings Summary (only for MQ • Joint Household)
  const jointHouseholdSummary = useMemo(() => {
    if (selectedRoute !== 'MQ • Joint Household') return null;

    const jhItems = items.filter(i => 
      i.verification_status !== 'Archived / Paid Off' && 
      i.account_route === 'MQ • Joint Household'
    );

    let stephenInflow = 0;
    let shaeInflow = 0;

    const getJhTiming = (name: string) => {
      if (/Fitness/i.test(name)) return 'Fortnightly, Fri ($68 notice)';
      if (/Electricity/i.test(name)) return 'Monthly, 1st of month (~$122 debit)';
      if (/Internet/i.test(name)) return 'Monthly, ~14th–27th ($79.95 debit)';
      if (/Groceries/i.test(name)) return 'Weekly card spend (~$450/wk float)';
      if (/Gas/i.test(name)) return 'Billed per bottle delivery';
      return 'Regular schedule';
    };

    const expenseMap = new Map<string, {
      name: string;
      category: string;
      weekly: number;
      annual: number;
      cadenceLabel: string;
      deductionTiming: string;
    }>();

    jhItems.forEach(i => {
      const m = calculateMetrics(i.native_amount, i.cadence);
      if (i.owner === 'Stephen') stephenInflow += m.weekly;
      if (i.owner === 'Shae') shaeInflow += m.weekly;

      const rootName = i.description
        .replace(/\s*\(Stephen\s*Share\)/i, '')
        .replace(/\s*\(Shae\s*Share\)/i, '')
        .replace(/\s*\(Joint\s*Share\)/i, '')
        .trim();

      const existing = expenseMap.get(rootName);
      if (existing) {
        existing.weekly += m.weekly;
        existing.annual += m.annual;
      } else {
        expenseMap.set(rootName, {
          name: rootName,
          category: i.category,
          weekly: m.weekly,
          annual: m.annual,
          cadenceLabel: i.cadence === 'Weekly' ? `${formatCurrency(i.native_amount * 2)}/wk` : i.cadence === 'Fortnightly' ? `${formatCurrency(i.native_amount * 2)}/fn` : `${formatCurrency(i.native_amount)}/mo`,
          deductionTiming: getJhTiming(rootName)
        });
      }
    });

    const expenses = Array.from(expenseMap.values()).sort((a, b) => b.annual - a.annual);
    const totalWeeklyOutflow = expenses.reduce((sum, e) => sum + e.weekly, 0);
    const totalWeeklyInflow = stephenInflow + shaeInflow;

    return {
      stephenInflow,
      shaeInflow,
      totalWeeklyInflow,
      totalAnnualInflow: totalWeeklyInflow * 52,
      expenses,
      totalWeeklyOutflow,
      totalAnnualOutflow: totalWeeklyOutflow * 52,
      netWeekly: totalWeeklyInflow - totalWeeklyOutflow
    };
  }, [items, selectedRoute]);

  // Filter items assigned to this route for the schedule editor
  const routeItems = useMemo(() => {
    return items.filter(item => {
      if (item.verification_status === 'Archived / Paid Off') return false;
      if (selectedRoute === 'ALL') {
        return (
          item.account_route.includes('Savings') ||
          item.account_route.includes('Household') ||
          item.account_route === 'BOQ • Home Offset'
        );
      }
      if (selectedRoute === 'ING • Everyday') {
        return item.owner === 'Stephen' && (
          item.account_route === 'ING • Everyday' || 
          item.account_route === 'ING • Direct Debit' ||
          item.direction === 'Transfer'
        );
      }
      return item.account_route === selectedRoute;
    }).sort((a, b) => {
      const order: Record<string, number> = { 'Inflow': 0, 'Outflow': 1, 'Transfer': 2 };
      const aOrd = order[a.direction || 'Outflow'] ?? 1;
      const bOrd = order[b.direction || 'Outflow'] ?? 1;
      if (aOrd !== bOrd) return aOrd - bOrd;
      return calculateMetrics(b.native_amount, b.cadence).annual - calculateMetrics(a.native_amount, a.cadence).annual;
    });
  }, [items, selectedRoute]);

  const handleMonthChange = async (item: FinancialItem, newMonth: number) => {
    if (!onUpdateItem || isLocked) return;
    setUpdatingItemId(item.id);
    const updated: FinancialItem = {
      ...item,
      due_month: newMonth
    };
    const monthName = MONTH_OPTIONS.find(m => m.value === newMonth)?.label || `Month ${newMonth}`;
    await onUpdateItem(updated, `Updated billing anchor month to ${monthName}`);
    setUpdatingItemId(null);
  };

  // Time-Horizon Zoom State: '3m' (Quarter / 13 wks), '6m' (Half-Year / 26 wks), '1y' (Full Year / 52 wks)
  type ZoomRange = '3m' | '6m' | '1y';
  const [zoomRange, setZoomRange] = useState<ZoomRange>('1y');

  // Filter visible weeks based on zoom
  const visibleWeeks = useMemo(() => {
    if (zoomRange === '3m') return simulation.weeks.slice(0, 13);
    if (zoomRange === '6m') return simulation.weeks.slice(0, 26);
    return simulation.weeks;
  }, [simulation.weeks, zoomRange]);

  const totalVisible = visibleWeeks.length;

  // Compute high-value metric for Card 3: Annual Retained Capital & Wealth Growth
  const retainedMetric = useMemo(() => {
    if (selectedRoute === 'ING • Everyday') {
      const surplusAnnual = (everydayWaterfall?.netWeeklySurplus || 0) * 52;
      return {
        title: 'Annual Operating Surplus',
        amount: surplusAnnual,
        subLabel: `+${formatCurrency(everydayWaterfall?.netWeeklySurplus || 0)}/wk`,
        desc: 'Unallocated cash flow retained after all dispersals, debits & living spend.',
        highlight: 'text-emerald-400'
      };
    }
    if (selectedRoute === 'MQ • Joint Savings') {
      const depositItems = items.filter(i => 
        i.verification_status !== 'Archived / Paid Off' &&
        i.account_route === 'MQ • Joint Savings' &&
        (i.description.toLowerCase().includes('house deposit core') || i.description.toLowerCase().includes('joint savings core'))
      );
      const totalAnnual = depositItems.reduce((sum, it) => sum + calculateMetrics(it.native_amount, it.cadence).annual, 0);
      return {
        title: 'Annual Retained Deposit',
        amount: totalAnnual,
        subLabel: `+${formatCurrency(totalAnnual / 52)}/wk`,
        desc: 'Dedicated home equity & wealth capital permanently accumulated.',
        highlight: 'text-emerald-400'
      };
    }
    if (selectedRoute === 'BOQ • Home Offset') {
      const offsetRent = items.filter(i => 
        i.verification_status !== 'Archived / Paid Off' &&
        i.account_route === 'BOQ • Home Offset' &&
        i.direction !== 'Outflow'
      ).reduce((sum, it) => sum + calculateMetrics(it.native_amount, it.cadence).annual, 0);
      return {
        title: 'Mortgage Shield Inflow',
        amount: offsetRent,
        subLabel: `+${formatCurrency(offsetRent / 52)}/wk`,
        desc: 'Capital actively reducing mortgage balance and 6.14% interest burn.',
        highlight: 'text-blue-400'
      };
    }
    if (selectedRoute === 'MQ • Joint Household') {
      const annualBurn = jointHouseholdSummary?.totalAnnualOutflow || 20903;
      const weeklyBurn = jointHouseholdSummary?.totalWeeklyOutflow || (20903 / 52);
      return {
        title: 'Household Living Outflows',
        amount: annualBurn,
        subLabel: `-${formatCurrency(weeklyBurn)}/wk`,
        desc: '100% funded living expenses for Groceries, Power, Gas, Internet & Gym.',
        highlight: 'text-amber-400'
      };
    }
    if (selectedRoute === 'ING • Savings') {
      const retainedAnnual = simulation.netAnnualDelta;
      return {
        title: 'Annual Retained Savings',
        amount: retainedAnnual,
        subLabel: `+${formatCurrency(retainedAnnual / 52)}/wk`,
        desc: 'Personal discretionary savings accumulated over 52 weeks after vehicle bills.',
        highlight: 'text-emerald-400'
      };
    }
    // General sinking reserve accounts
    const retainedAnnual = simulation.netAnnualDelta;
    return {
      title: 'Annual Retained Reserve',
      amount: retainedAnnual,
      subLabel: retainedAnnual >= 0 ? `+${formatCurrency(retainedAnnual / 52)}/wk` : `${formatCurrency(retainedAnnual / 52)}/wk`,
      desc: retainedAnnual >= 0 
        ? 'Surplus cushion staying in account over 52 weeks above all bill drops.'
        : 'Timing gap over 52 weeks requiring seed cushion to bridge.',
      highlight: retainedAnnual >= 0 ? 'text-emerald-400' : 'text-amber-400'
    };
  }, [selectedRoute, everydayWaterfall, items, simulation.netAnnualDelta]);

  // SVG Chart Dimensions & Computations (Spacious 1000x380, completely symmetrical padding)
  const chartHeight = 380;
  const chartWidth = 1000;
  const padLeft = 65;
  const padRight = 65; // Completely symmetrical padding!
  const padTop = 45;
  const padBottom = 48;
  const innerWidth = chartWidth - padLeft - padRight;
  const innerHeight = chartHeight - padTop - padBottom;

  // Scale balances dynamically for the visible zoom range
  const allBalances = visibleWeeks.flatMap(w => 
    showStressTest ? [w.runningBalanceZeroBase, w.runningBalanceWithSeed] : [w.runningBalanceWithSeed]
  );
  const minVal = Math.min(0, ...allBalances);
  const maxVal = Math.max(100, ...allBalances);
  const valRange = maxVal - minVal || 1;

  const getY = (val: number) => padTop + innerHeight - ((val - minVal) / valRange) * innerHeight;
  const getX = (visibleIndex: number) => padLeft + (visibleIndex / Math.max(1, totalVisible - 1)) * innerWidth;
  const zeroY = getY(0);

  // Generate SVG path points for visible range
  const zeroBasePoints = visibleWeeks.map((w, i) => `${getX(i)},${getY(w.runningBalanceZeroBase)}`).join(' ');
  const seededPoints = visibleWeeks.map((w, i) => `${getX(i)},${getY(w.runningBalanceWithSeed)}`).join(' ');

  // Intermediate horizontal grid lines (Y-axis steps)
  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    if (minVal < 0) {
      ticks.push(minVal);
      if (minVal < -500) ticks.push(Math.round(minVal / 2 / 100) * 100);
    }
    ticks.push(0);
    if (maxVal > 200) {
      ticks.push(Math.round((maxVal / 2) / 100) * 100);
    }
    ticks.push(maxVal);
    return Array.from(new Set(ticks)).sort((a, b) => a - b);
  }, [minVal, maxVal]);

  // Generate month markers across the visible weeks, including short year (e.g. Oct '26, Jan '27)
  const monthMarkers = useMemo(() => {
    const markers: Array<{ index: number; label: string }> = [];
    let lastMonth = -1;
    visibleWeeks.forEach((w, idx) => {
      if (w.monthIndex !== lastMonth) {
        const yearShort = String(w.date.getFullYear()).slice(-2);
        markers.push({
          index: idx,
          label: `${w.monthName.substring(0, 3)} '${yearShort}`
        });
        lastMonth = w.monthIndex;
      }
    });
    return markers;
  }, [visibleWeeks]);

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (ctm) {
      const svgPt = pt.matrixTransform(ctm.inverse());
      const clampedX = Math.max(padLeft, Math.min(chartWidth - padRight, svgPt.x));
      const weekIdx = Math.round(((clampedX - padLeft) / innerWidth) * (totalVisible - 1));
      const validIdx = Math.max(0, Math.min(totalVisible - 1, weekIdx));
      const w = visibleWeeks[validIdx];
      if (w) setHoveredWeek(w);
    }
  };

  const handleSvgMouseLeave = () => {
    setHoveredWeek(null);
  };

  return (
    <div className="space-y-8 pb-16 text-zinc-100">
      {/* Engine Header */}
      <div className="flex flex-col gap-2 border-b border-zinc-800 pb-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-zinc-100">Sinking Funds & Bill Timing</h2>
              <p className="text-sm text-zinc-400">
                52-Week Cash Flow Trajectory & Overdraft Safety Buffer
              </p>
            </div>
          </div>
          <Badge variant="outline" className="bg-zinc-900 border-zinc-800 text-zinc-300 text-sm px-3 py-1.5 font-mono">
            <Clock className="w-4 h-4 mr-1.5 text-emerald-400" />
            Anchor: 5 Oct 2026 – 4 Oct 2027
          </Badge>
        </div>

        {/* Route Selector Pills */}
        <div className="flex flex-wrap gap-2.5 pt-3">
          {SINKING_ROUTES.map(route => {
            const isSelected = selectedRoute === route.id;
            return (
              <button
                key={route.id}
                onClick={() => setSelectedRoute(route.id)}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer flex items-center gap-2 border ${
                  isSelected
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.15)] font-semibold'
                    : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 hover:bg-zinc-800/50'
                }`}
              >
                <span>{route.name}</span>
                {isSelected && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Top 4 KPI Cards Strip (Human Language & Accessible Typography) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Starting Safety Cushion */}
        <Card className="bg-zinc-950/70 border-zinc-800/90 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-zinc-300 text-sm font-semibold flex items-center justify-between">
              <span>Starting Safety Cushion</span>
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </CardDescription>
            <CardTitle className="text-3xl font-extrabold text-emerald-400 font-mono tracking-tight">
              {formatCurrency(simulation.recommendedSeedFloat)}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-2">
            <p className="text-sm text-zinc-300 leading-normal">
              Money needed on Day 1 so this account never drops to <strong className="text-white font-semibold">$0</strong> when big bills hit.
            </p>
            <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
              <span>Includes safety buffer:</span>
              <span className="font-mono text-zinc-200 font-semibold text-sm">{formatCurrency(simulation.safetyCushion)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Minimum Projected Balance */}
        <Card className="bg-zinc-950/70 border-zinc-800/90 shadow-sm relative overflow-hidden">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-zinc-300 text-sm font-semibold flex items-center justify-between">
              <span>Minimum Projected Balance</span>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className={`text-[11px] px-2 py-0 font-mono ${
                  simulation.lowestBalanceWithSeed >= 0 
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                }`}>
                  {simulation.lowestBalanceWithSeed >= 0 ? 'Safe & Funded' : 'Overdraft Risk'}
                </Badge>
                <TrendingDown className={`w-4 h-4 ${simulation.lowestBalanceWithSeed >= 0 ? 'text-emerald-400' : 'text-rose-400'}`} />
              </div>
            </CardDescription>
            <CardTitle className={`text-3xl font-extrabold font-mono tracking-tight ${
              simulation.lowestBalanceWithSeed >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {formatCurrency(simulation.lowestBalanceWithSeed)}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-2">
            <p className="text-sm text-zinc-300 leading-normal">
              {effectiveBalance > 0 ? (
                <>Lowest account trough over 52 weeks occurs in <strong className="text-zinc-100 font-semibold">Week {simulation.peakDrawdownWeek}</strong> ({simulation.peakDrawdownDate}).</>
              ) : (
                <>Lowest point over 52 weeks if starting from $0 occurs in <strong className="text-zinc-100 font-semibold">Week {simulation.peakDrawdownWeek}</strong> ({simulation.peakDrawdownDate}).</>
              )}
            </p>
            <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
              <span>Theoretical Day 1 timing draw:</span>
              <span className="font-mono text-zinc-300 font-semibold text-sm">
                {simulation.peakDrawdown > 0 ? `-${formatCurrency(simulation.peakDrawdown)}` : '$0.00'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Annual Retained Capital & Wealth Growth */}
        <Card className="bg-zinc-950/70 border-zinc-800/90 shadow-sm relative overflow-hidden">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-zinc-300 text-sm font-semibold flex items-center justify-between">
              <span>{retainedMetric.title}</span>
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </CardDescription>
            <CardTitle className="text-3xl font-extrabold font-mono tracking-tight flex items-baseline gap-2">
              <span className={retainedMetric.highlight}>{formatCurrency(retainedMetric.amount)}</span>
              <span className="text-xs font-normal text-zinc-400 font-mono">/ yr</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-2">
            <p className="text-sm text-zinc-300 leading-normal">
              {retainedMetric.desc}
            </p>
            <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
              <span>Weekly retention rate:</span>
              <span className={`font-mono font-semibold text-sm ${retainedMetric.highlight}`}>
                {retainedMetric.subLabel}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Current Account Balance (Hero Display with Quick Inline Edit) */}
        <Card className="bg-zinc-950/70 border-zinc-800/90 shadow-sm relative overflow-hidden group">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-zinc-300 text-sm font-semibold flex items-center justify-between">
              <span>Your Current Balance</span>
              <div className="flex items-center gap-1.5">
                {!isEditingBalance && (
                  <button
                    type="button"
                    onClick={() => setIsEditingBalance(true)}
                    className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
                    title="Click to edit balance"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
                <Wallet className="w-4 h-4 text-emerald-400" />
              </div>
            </CardDescription>

            {/* Prominent Hero Number Display vs Inline Input */}
            {isEditingBalance ? (
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-sm text-zinc-400 font-semibold">$</span>
                <Input
                  autoFocus
                  type="number"
                  min="0"
                  step="50"
                  value={balanceInput}
                  onChange={e => handleBalanceChange(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleBalanceCommit();
                    if (e.key === 'Escape') setIsEditingBalance(false);
                  }}
                  placeholder={selectedRoute === 'ALL' && aggregateIndividualBalance > 0 ? String(aggregateIndividualBalance) : '0.00'}
                  className="h-10 bg-zinc-900 border-zinc-700/80 text-zinc-100 font-mono text-lg font-bold px-3 focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleBalanceCommit}
                  title="Confirm balance"
                  className="p-2 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                </button>
                {(currentRecord || (selectedRoute === 'ALL' && balanceInput !== '')) && (
                  <button
                    type="button"
                    onClick={handleClearBalance}
                    title="Reset reference balance"
                    className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : (
              <div 
                onClick={() => setIsEditingBalance(true)}
                className="mt-0.5 cursor-pointer flex items-baseline justify-between group/hero"
                title="Click to edit balance"
              >
                <div className="text-3xl font-extrabold text-emerald-400 font-mono tracking-tight flex items-baseline gap-1.5">
                  <span>{formatCurrency(effectiveBalance)}</span>
                </div>
                <span className="text-xs text-zinc-500 group-hover/hero:text-zinc-300 flex items-center gap-1 font-sans transition-colors">
                  <Pencil className="w-3 h-3" /> Edit
                </span>
              </div>
            )}

            {/* Added / Reference Date Reference Stamp */}
            <div className="mt-2 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-zinc-400 truncate">
                <Clock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                {currentRecord?.updatedAt ? (
                  <span className="truncate">
                    Saved: <strong className="text-zinc-200 font-mono">{formatTimestamp(currentRecord.updatedAt)}</strong>
                  </span>
                ) : selectedRoute === 'ALL' && calibratedCount > 0 ? (
                  <span className="text-emerald-400 font-medium">
                    Sum of {calibratedCount} accounts
                  </span>
                ) : (
                  <span className="text-zinc-500 italic">No balance entered yet</span>
                )}
              </div>
              {currentRecord && (
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[10px] uppercase tracking-wider font-semibold">
                  Saved
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-2">
            <div className="flex items-center justify-between">
              <Badge 
                variant="outline" 
                className={`text-xs px-2.5 py-1 font-medium ${
                  simulation.isSafeWithStartingBalance 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                }`}
              >
                {simulation.isSafeWithStartingBalance ? '✓ Account Safe' : '⚠ Overdraft Risk'}
              </Badge>
              <span className="text-xs font-mono font-medium text-zinc-300">
                {simulation.safetyMargin >= 0 ? `+${formatCurrency(simulation.safetyMargin)} buffer` : `${formatCurrency(simulation.safetyMargin)} short`}
              </span>
            </div>
            <p className="text-xs text-zinc-400 pt-1">
              Lowest point with this balance: <strong className="text-zinc-200 font-mono text-sm">{formatCurrency(simulation.lowestBalanceWithSeed)}</strong>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Master Salary Inflow & Outbound Dispersal Waterfall (Only for ING • Everyday) */}
      {everydayWaterfall && (
        <Card className="bg-zinc-950/80 border-zinc-800 shadow-sm relative overflow-hidden">
          <CardHeader className="p-5 pb-3 border-b border-zinc-800/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-semibold text-zinc-100 flex items-center gap-2.5">
                  <Wallet className="w-5 h-5 text-emerald-400" />
                  <span>Master Salary Inflow & Outbound Dispersal Engine</span>
                </CardTitle>
                <CardDescription className="text-sm text-zinc-400 mt-1">
                  How Stephen's weekly salary disperses across reserve accounts, joint bills, direct debits, and everyday card spend.
                </CardDescription>
              </div>
              <Badge variant="outline" className="bg-emerald-500/10 border-emerald-500/30 text-emerald-300 font-mono text-sm px-3 py-1.5 w-fit font-semibold">
                Net Liquid Surplus: +{formatCurrency(everydayWaterfall.netWeeklySurplus)}/wk
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-5">
            {/* Top Level Summary Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
              <div className="p-3.5 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1">
                <span className="text-zinc-400 block text-xs font-semibold uppercase tracking-wider">1. Net Salary Inflow</span>
                <span className="text-2xl font-bold font-mono text-emerald-400 block">+{formatCurrency(everydayWaterfall.salaryWeekly)}</span>
                <span className="text-xs text-zinc-400 block">/wk (${formatCurrency(everydayWaterfall.salaryWeekly * 52)}/yr)</span>
              </div>
              <div className="p-3.5 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1">
                <span className="text-zinc-400 block text-xs font-semibold uppercase tracking-wider">2. Outbound Transfers</span>
                <span className="text-2xl font-bold font-mono text-indigo-400 block">-{formatCurrency(everydayWaterfall.dispersalsTotal)}</span>
                <span className="text-xs text-zinc-400 block">/wk to Offset, Joint & Savings</span>
              </div>
              <div className="p-3.5 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1">
                <span className="text-zinc-400 block text-xs font-semibold uppercase tracking-wider">3. Debits & Living Spend</span>
                <span className="text-2xl font-bold font-mono text-amber-400 block">-{formatCurrency(everydayWaterfall.directDebitsWeekly + everydayWaterfall.everydayCardWeekly)}</span>
                <span className="text-xs text-zinc-400 block">/wk (Debits: {formatCurrency(everydayWaterfall.directDebitsWeekly)} + Card: {formatCurrency(everydayWaterfall.everydayCardWeekly)})</span>
              </div>
              <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 space-y-1">
                <span className="text-emerald-400 block text-xs font-semibold uppercase tracking-wider">4. Operating Surplus</span>
                <span className="text-2xl font-bold font-mono text-emerald-300 block">+{formatCurrency(everydayWaterfall.netWeeklySurplus)}</span>
                <span className="text-xs text-emerald-400/90 block">/wk (+${formatCurrency(everydayWaterfall.netWeeklySurplus * 52)}/yr unspent float)</span>
              </div>
            </div>

            {/* Outbound Transfers Dispersal Grid */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-sm text-zinc-300 font-medium">
                <span className="flex items-center gap-2">
                  <ArrowRight className="w-4 h-4 text-indigo-400" />
                  <span>Scheduled Outbound Dispersals Departing Everyday Hub</span>
                </span>
                <span className="font-mono text-zinc-300 text-xs">Total: -{formatCurrency(everydayWaterfall.dispersalsTotal)}/wk</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {everydayWaterfall.dispersals.map((disp, idx) => (
                  <div key={idx} className={`p-3.5 rounded-lg border ${disp.borderColor} ${disp.bgColor} flex flex-col justify-between`}>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${disp.dotColor}`} />
                        <span className="font-semibold text-zinc-100 text-sm truncate">{disp.target}</span>
                      </div>
                      <p className="text-xs text-zinc-300 leading-snug">{disp.purpose}</p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-sm font-mono">
                      <span className="text-xs text-zinc-400">Allocation:</span>
                      <span className={`font-bold ${disp.color}`}>-{formatCurrency(disp.amount)}/wk</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Master Household Living & Outgoings Engine (Only for MQ • Joint Household) */}
      {jointHouseholdSummary && (
        <Card className="bg-zinc-950/80 border-zinc-800 shadow-sm relative overflow-hidden">
          <CardHeader className="p-5 pb-3 border-b border-zinc-800/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-semibold text-zinc-100 flex items-center gap-2.5">
                  <Layers className="w-5 h-5 text-sky-400" />
                  <span>MQ • Joint Household Living & Outgoings Engine</span>
                </CardTitle>
                <CardDescription className="text-sm text-zinc-400 mt-1">
                  How shared household living costs (groceries, power, gas, internet, gym) are funded 50/50 and debited.
                </CardDescription>
              </div>
              <Badge variant="outline" className="bg-sky-500/10 border-sky-500/30 text-sky-300 font-mono text-sm px-3 py-1.5 w-fit font-semibold">
                Balanced Living Account: $0.00/wk Net Drag
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-5">
            {/* Top Level Summary Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
              <div className="p-3.5 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1">
                <span className="text-zinc-400 block text-xs font-semibold uppercase tracking-wider">1. Stephen Funding Share</span>
                <span className="text-2xl font-bold font-mono text-emerald-400 block">+{formatCurrency(jointHouseholdSummary.stephenInflow)}</span>
                <span className="text-xs text-zinc-400 block">/wk (${formatCurrency(jointHouseholdSummary.stephenInflow * 52)}/yr)</span>
              </div>
              <div className="p-3.5 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1">
                <span className="text-zinc-400 block text-xs font-semibold uppercase tracking-wider">2. Shae Funding Share</span>
                <span className="text-2xl font-bold font-mono text-rose-400 block">+{formatCurrency(jointHouseholdSummary.shaeInflow)}</span>
                <span className="text-xs text-zinc-400 block">/wk (${formatCurrency(jointHouseholdSummary.shaeInflow * 52)}/yr)</span>
              </div>
              <div className="p-3.5 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1">
                <span className="text-zinc-400 block text-xs font-semibold uppercase tracking-wider">3. Total Living Outflows</span>
                <span className="text-2xl font-bold font-mono text-amber-400 block">-{formatCurrency(jointHouseholdSummary.totalWeeklyOutflow)}</span>
                <span className="text-xs text-zinc-400 block">/wk (${formatCurrency(jointHouseholdSummary.totalAnnualOutflow)}/yr total burn)</span>
              </div>
              <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 space-y-1">
                <span className="text-emerald-400 block text-xs font-semibold uppercase tracking-wider">4. Operating Balance</span>
                <span className="text-2xl font-bold font-mono text-emerald-300 block">{formatCurrency(jointHouseholdSummary.netWeekly)}</span>
                <span className="text-xs text-emerald-400/90 block">/wk (100% matched funding)</span>
              </div>
            </div>

            {/* Outgoing Living Expenses Breakdown Grid */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-sm text-zinc-300 font-medium">
                <span className="flex items-center gap-2">
                  <ArrowRight className="w-4 h-4 text-sky-400" />
                  <span>Itemized Household Living Outgoings Exiting MQ • Joint Household</span>
                </span>
                <span className="font-mono text-zinc-300 text-xs">Total: -{formatCurrency(jointHouseholdSummary.totalWeeklyOutflow)}/wk</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {jointHouseholdSummary.expenses.map((exp, idx) => (
                  <div key={idx} className="p-3.5 rounded-lg border border-zinc-800/80 bg-zinc-900/50 flex flex-col justify-between">
                    <div className="space-y-1">
                      <span className="font-semibold text-zinc-100 text-sm truncate block">{exp.name}</span>
                      <span className="text-xs text-zinc-400 block">{exp.category}</span>
                    </div>
                    <div className="mt-3 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-sm font-mono">
                      <span className="text-xs text-zinc-400">Burn:</span>
                      <span className="font-bold text-rose-400">-{formatCurrency(exp.weekly)}/wk</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 2/3 + 1/3 Balanced Screen Layout: Trajectory Simulation Chart + Live Diagnostics Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left 2/3 Column: 52-Week Trajectory Simulation Chart */}
        <Card className="bg-zinc-950/80 border-zinc-800 lg:col-span-2">
          <CardHeader className="p-5 pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-bold text-zinc-100 flex items-center gap-2.5">
                  <span>52-Week Cash Flow Trajectory</span>
                  <span className="text-sm font-normal text-zinc-400">({selectedRoute})</span>
                </CardTitle>
                <CardDescription className="text-xs text-zinc-400 mt-1">
                  {showStressTest ? (
                    <>Weekly balance path: <span className="text-emerald-400 font-semibold">Emerald = Projected Balance</span> vs <span className="text-rose-400 font-semibold">Red/Dashed = Theoretical Stress Test ($0)</span>.</>
                  ) : (
                    <>Projected weekly balance path over 52 weeks based on scheduled transfers, paydays, and bills.</>
                  )}
                </CardDescription>
              </div>
              
              {/* Header Controls: Stress Test Toggle, Time-Horizon Zoom Buttons & Clean Legend */}
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                {/* Stress Test Toggle Button */}
                <button
                  type="button"
                  onClick={() => setShowStressTest(prev => !prev)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono transition-colors cursor-pointer ${
                    showStressTest
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-300 font-semibold'
                      : 'bg-zinc-900/90 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                  }`}
                  title="Toggle theoretical zero-base stress test curve ($0 start)"
                >
                  <span className={`w-2.5 h-0.5 inline-block ${showStressTest ? 'bg-rose-400' : 'bg-zinc-500'}`} />
                  <span>Stress Test ($0)</span>
                </button>

                {/* Zoom Buttons */}
                <div className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-lg border border-zinc-800 text-xs">
                  <span className="text-zinc-500 text-[11px] px-1 font-mono">Zoom:</span>
                  <button
                    type="button"
                    title="Zoom Out"
                    onClick={() => {
                      if (zoomRange === '3m') setZoomRange('6m');
                      else if (zoomRange === '6m') setZoomRange('1y');
                    }}
                    disabled={zoomRange === '1y'}
                    className="p-1 rounded text-xs font-mono transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 cursor-pointer"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  {[
                    { id: '3m' as ZoomRange, label: '3M' },
                    { id: '6m' as ZoomRange, label: '6M' },
                    { id: '1y' as ZoomRange, label: '1Y' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setZoomRange(opt.id)}
                      className={`px-2 py-0.5 rounded text-xs font-mono transition-colors cursor-pointer ${
                        zoomRange === opt.id
                          ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/40'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    title="Zoom In"
                    onClick={() => {
                      if (zoomRange === '1y') setZoomRange('6m');
                      else if (zoomRange === '6m') setZoomRange('3m');
                    }}
                    disabled={zoomRange === '3m'}
                    className="p-1 rounded text-xs font-mono transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 cursor-pointer"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Stable Static Legend Strip */}
                <div className="flex items-center gap-2.5 text-xs bg-zinc-900/90 px-2.5 py-1 rounded-lg border border-zinc-800">
                  {showStressTest && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 bg-rose-400/80 inline-block border-b border-dashed border-rose-400" />
                      <span className="text-zinc-400 text-[11px]">Start $0</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 bg-emerald-400 inline-block" />
                    <span className="text-zinc-200 text-[11px]">Projected</span>
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-2">
            {/* Subtle Interaction Guide Bar */}
            <div className="flex items-center justify-between text-xs text-zinc-400 px-1 py-1">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                Hover along curve to inspect weekly balances • Dashed vertical lines denote 1st of month
              </span>
              <span className="font-mono text-zinc-400 text-xs font-medium">
                {totalVisible} / 52 wks
              </span>
            </div>

            <div className="w-full overflow-x-auto rounded-lg border border-zinc-800/60 bg-zinc-950/50">
              <svg 
                viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
                className="w-full select-none cursor-crosshair h-[380px]"
                style={{ minWidth: '650px' }}
                onMouseMove={handleSvgMouseMove}
                onMouseLeave={handleSvgMouseLeave}
              >
                {/* 1st of the Month Subtle Vertical Grid Lines */}
                {monthMarkers.map(m => {
                  const mx = getX(m.index);
                  return (
                    <g key={`v-grid-${m.index}`}>
                      <line
                        x1={mx}
                        y1={padTop}
                        x2={mx}
                        y2={padTop + innerHeight}
                        stroke="#27272a"
                        strokeDasharray="3 3"
                        strokeWidth="1"
                      />
                    </g>
                  );
                })}

                {/* Intermediate Horizontal Reference Grid Lines (Y-Axis) */}
                {yTicks.map(tVal => {
                  const ty = getY(tVal);
                  const isZero = tVal === 0;
                  return (
                    <g key={`h-grid-${tVal}`}>
                      <line 
                        x1={padLeft} 
                        y1={ty} 
                        x2={chartWidth - padRight} 
                        y2={ty} 
                        stroke={isZero ? '#3f3f46' : '#27272a'} 
                        strokeDasharray={isZero ? '4 3' : '2 2'} 
                        strokeWidth={isZero ? '1.2' : '0.8'} 
                      />
                      <text 
                        x={padLeft - 10} 
                        y={ty + 4} 
                        textAnchor="end" 
                        fill={isZero ? '#a1a1aa' : tVal < 0 ? '#f43f5e' : '#71717a'} 
                        fontSize="11" 
                        fontWeight={isZero ? '600' : 'normal'} 
                        fontFamily="monospace"
                      >
                        {formatCurrency(tVal).split('.')[0]}
                      </text>
                    </g>
                  );
                })}

                {/* Trajectory 1: Zero-Base Curve (Rose / Dashed) - Rendered when Stress Test is enabled */}
                {showStressTest && (
                  <polyline
                    fill="none"
                    stroke="#f43f5e"
                    strokeWidth="2.2"
                    strokeDasharray="4 3"
                    opacity="0.85"
                    points={zeroBasePoints}
                  />
                )}

                {/* Trajectory 2: Seeded / Current Balance Curve (Emerald) */}
                <polyline
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.8"
                  points={seededPoints}
                />

                {/* Peak Drawdown Highlight Pin (Only if Stress Test is enabled and within visible zoom range) */}
                {showStressTest && simulation.peakDrawdown > 0 && simulation.peakDrawdownWeek <= totalVisible && (
                  <g>
                    <circle
                      cx={getX(simulation.peakDrawdownWeek - 1)}
                      cy={getY(simulation.lowestBalanceZeroBase)}
                      r="5"
                      fill="#f43f5e"
                      className="animate-pulse"
                    />
                    <line
                      x1={getX(simulation.peakDrawdownWeek - 1)}
                      y1={getY(simulation.lowestBalanceZeroBase)}
                      x2={getX(simulation.peakDrawdownWeek - 1)}
                      y2={zeroY}
                      stroke="#f43f5e"
                      strokeWidth="1.5"
                      strokeDasharray="2 2"
                    />
                    <text
                      x={getX(simulation.peakDrawdownWeek - 1)}
                      y={getY(simulation.lowestBalanceZeroBase) + 16}
                      textAnchor="middle"
                      fill="#f43f5e"
                      fontSize="12"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      Dip: -{formatCurrency(simulation.peakDrawdown).split('.')[0]}
                    </text>
                  </g>
                )}

                {/* Scheduled Lump-Sum Bill Drop Callout Markers (Clean Sleek Pins) */}
                {visibleWeeks.filter(w => w.events.length > 0).map(w => {
                  const vIdx = visibleWeeks.findIndex(v => v.weekNumber === w.weekNumber);
                  if (vIdx === -1) return null;
                  const x = getX(vIdx);
                  const yFunded = getY(w.runningBalanceWithSeed);
                  const totalOut = w.events.reduce((sum: number, ev) => sum + ev.amount, 0);
                  return (
                    <g 
                      key={w.weekIndex} 
                      className="cursor-pointer group"
                      onClick={() => setSelectedWeek(w.weekNumber)}
                    >
                      <line x1={x} y1={yFunded} x2={x} y2={padTop + innerHeight} stroke="#f43f5e" strokeDasharray="2 2" strokeWidth="1" opacity="0.4" />
                      <circle cx={x} cy={yFunded} r="4.5" fill="#f43f5e" stroke="#18181b" strokeWidth="2" />
                      <text 
                        x={x} 
                        y={Math.max(16, yFunded - 8)} 
                        textAnchor="middle" 
                        fill="#f43f5e" 
                        fontSize="11" 
                        fontWeight="bold" 
                        fontFamily="monospace"
                      >
                        -{formatCurrency(totalOut).split('.')[0]}
                      </text>
                    </g>
                  );
                })}

                {/* Month Markers along X Axis directly aligned with vertical 1st of month grid */}
                {monthMarkers.map(m => (
                  <text
                    key={m.index}
                    x={getX(m.index)}
                    y={chartHeight - 14}
                    textAnchor="middle"
                    fill="#a1a1aa"
                    fontSize="12"
                    fontWeight="600"
                  >
                    {m.label}
                  </text>
                ))}

                {/* Dynamic In-SVG Floating Tooltip (Accurately sized, snug container, zero clipping) */}
                {hoveredWeek && (() => {
                  const vIdx = visibleWeeks.findIndex(w => w.weekNumber === hoveredWeek.weekNumber);
                  if (vIdx === -1) return null;
                  const dotX = getX(vIdx);
                  const dotY = getY(hoveredWeek.runningBalanceWithSeed);
                  
                  // Dynamically measure required width based on event text (Consolidated single lines)
                  let maxDescLen = 14;
                  hoveredWeek.events.forEach(ev => {
                    const str = `${ev.description} (-${formatCurrency(ev.amount)})`;
                    if (str.length > maxDescLen) maxDescLen = str.length;
                  });

                  // Snug tooltip width: minimum 210px, scales with max character count + 28px padding
                  const tooltipWidth = Math.max(215, Math.min(340, Math.round(maxDescLen * 7.2) + 32));
                  const eventLineHeight = 18;
                  const tooltipHeight = 72 + (hoveredWeek.events.length * eventLineHeight);

                  // Position tooltip clamped within symmetrical chart margins
                  const tipX = Math.max(padLeft + 8, Math.min(chartWidth - padRight - tooltipWidth - 8, dotX - tooltipWidth / 2));
                  
                  // Decide whether to show tooltip above or below the dot
                  const showAbove = (dotY - tooltipHeight - 16) >= padTop;
                  const tipY = showAbove ? dotY - tooltipHeight - 14 : dotY + 16;

                  return (
                    <g pointerEvents="none" className="transition-all duration-75">
                      {/* Vertical crosshair guide */}
                      <line
                        x1={dotX}
                        y1={padTop}
                        x2={dotX}
                        y2={padTop + innerHeight}
                        stroke="#71717a"
                        strokeDasharray="2 2"
                        strokeWidth="1"
                        opacity="0.6"
                      />

                      {/* Guide line connecting dot to tooltip */}
                      <line
                        x1={dotX}
                        y1={dotY}
                        x2={dotX}
                        y2={showAbove ? tipY + tooltipHeight : tipY}
                        stroke="#10b981"
                        strokeDasharray="2 2"
                        strokeWidth="1.2"
                        opacity="0.8"
                      />

                      {/* Hover dot on curve */}
                      <circle
                        cx={dotX}
                        cy={dotY}
                        r="10"
                        fill="#10b981"
                        opacity="0.2"
                      />
                      <circle
                        cx={dotX}
                        cy={dotY}
                        r="5.5"
                        fill="#10b981"
                        stroke="#09090b"
                        strokeWidth="2"
                      />

                      {/* Floating Tooltip Card */}
                      <rect
                        x={tipX}
                        y={tipY}
                        width={tooltipWidth}
                        height={tooltipHeight}
                        rx="8"
                        fill="#09090b"
                        stroke="#3f3f46"
                        strokeWidth="1.5"
                        opacity="0.98"
                      />

                      {/* Tooltip Content */}
                      <text
                        x={tipX + 12}
                        y={tipY + 18}
                        fill="#a1a1aa"
                        fontSize="12"
                        fontWeight="600"
                      >
                        Week {hoveredWeek.weekNumber} • {hoveredWeek.dateLabel}
                      </text>

                      <text
                        x={tipX + 12}
                        y={tipY + 38}
                        fill="#e4e4e7"
                        fontSize="13"
                        fontWeight="bold"
                        fontFamily="monospace"
                      >
                        Bal: <tspan fill={hoveredWeek.runningBalanceWithSeed >= 0 ? '#34d399' : '#f87171'}>
                          {formatCurrency(hoveredWeek.runningBalanceWithSeed)}
                        </tspan>
                      </text>

                      <text
                        x={tipX + 12}
                        y={tipY + 54}
                        fill="#a1a1aa"
                        fontSize="11"
                        fontFamily="monospace"
                      >
                        <tspan fill="#34d399">+{formatCurrency(hoveredWeek.inflows)}</tspan> in  •  <tspan fill="#f87171">-{formatCurrency(hoveredWeek.outflows)}</tspan> out
                      </text>

                      {hoveredWeek.events.map((ev, eIdx) => {
                        const rawText = `⚡ ${ev.description} (-${formatCurrency(ev.amount)})`;
                        return (
                          <text
                            key={eIdx}
                            x={tipX + 12}
                            y={tipY + 72 + eIdx * eventLineHeight}
                            fill="#fbbf24"
                            fontSize="11"
                            fontWeight="600"
                          >
                            {rawText}
                          </text>
                        );
                      })}
                    </g>
                  );
                })()}
              </svg>
            </div>

            {/* Interactive Week Inspector Strip */}
            <div className="mt-4 pt-3.5 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2.5">
                <span className="text-zinc-300 font-semibold text-sm">Inspect Week:</span>
                <select
                  value={selectedWeek ?? simulation.peakDrawdownWeek}
                  onChange={e => setSelectedWeek(parseInt(e.target.value))}
                  className="bg-zinc-900 border border-zinc-700/80 rounded-md px-3 py-1.5 text-zinc-100 text-sm font-mono focus:border-emerald-500"
                >
                  {simulation.weeks.map(w => (
                    <option key={w.weekNumber} value={w.weekNumber}>
                      Week {w.weekNumber} ({w.dateLabel}) {w.events.length > 0 ? `• [${w.events.map(e => e.description).join(', ')}]` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selected Week Detail Card */}
              {(() => {
                const activeW = simulation.weeks.find(w => w.weekNumber === (selectedWeek ?? simulation.peakDrawdownWeek)) || simulation.weeks[0];
                return (
                  <div className="flex items-center gap-4 text-sm font-mono bg-zinc-900/80 px-3.5 py-1.5 rounded-lg border border-zinc-800">
                    <span className="text-zinc-400">Date: <strong className="text-zinc-100 font-semibold">{activeW.dateLabel}</strong></span>
                    <span className="text-emerald-400 font-semibold">+{formatCurrency(activeW.inflows)} in</span>
                    <span className="text-rose-400 font-semibold">-{formatCurrency(activeW.outflows)} out</span>
                    <span className="text-zinc-300">Balance: <strong className={`font-bold ${activeW.runningBalanceWithSeed >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(activeW.runningBalanceWithSeed)}</strong></span>
                  </div>
                );
              })()}
            </div>
          </CardContent>
        </Card>

        {/* Right 1/3 Column: Upcoming Bills & Active Outgoings Radar */}
        <Card className="bg-zinc-950/80 border-zinc-800 lg:col-span-1 flex flex-col h-full">
          <CardHeader className="p-4 pb-2.5 border-b border-zinc-800/80 shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span>
                  {selectedRoute === 'MQ • Joint Household'
                    ? 'Household Outgoings Radar'
                    : selectedRoute === 'ING • Everyday'
                    ? 'Direct Debits & Bill Radar'
                    : 'Upcoming Bill Radar'}
                </span>
              </CardTitle>
              <Badge variant="outline" className="text-[11px] font-mono px-2 py-0 bg-zinc-900 border-zinc-800 text-zinc-300">
                {simulation.upcomingLumpSums.length > 0
                  ? `${simulation.upcomingLumpSums.length} bills`
                  : selectedRoute === 'MQ • Joint Household'
                  ? `${jointHouseholdSummary?.expenses.length || 5} outgoings`
                  : selectedRoute === 'ING • Everyday'
                  ? `${routeItems.filter(i => i.direction === 'Outflow' || i.direction === 'Transfer' || i.verification_status === 'Pending Review').length} outgoings`
                  : '0 periodic'}
              </Badge>
            </div>
            <CardDescription className="text-xs text-zinc-400 mt-0.5">
              {selectedRoute === 'MQ • Joint Household'
                ? 'All recurring shared living expenses debited from MQ Joint.'
                : selectedRoute === 'ING • Everyday'
                ? 'Direct debits, recurring subscriptions & routine expenses.'
                : 'Scheduled lump-sum debits in calendar order of invoice date.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 divide-y divide-zinc-800/60 overflow-y-auto max-h-[500px]">
            {simulation.upcomingLumpSums.length > 0 ? (
              simulation.upcomingLumpSums.map((bill, idx) => (
                <div key={`${bill.id}-${idx}`} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between text-sm">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-zinc-100">{bill.description}</span>
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <span>Due: {bill.dueDateLabel}</span>
                      <span>•</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-zinc-900 border-zinc-800 text-zinc-300">
                        {bill.cadence}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-base text-rose-400">-{formatCurrency(bill.amount)}</span>
                    <p className="text-xs text-zinc-400 font-medium">In {bill.weeksAway} wks</p>
                  </div>
                </div>
              ))
            ) : selectedRoute === 'MQ • Joint Household' && jointHouseholdSummary ? (
              <div className="space-y-3">
                <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-400 leading-relaxed">
                  Active shared expenses exiting this account every pay cycle:
                </div>
                {jointHouseholdSummary.expenses.map((exp, idx) => (
                  <div key={idx} className="py-2.5 border-b border-zinc-800/60 last:border-0 flex items-center justify-between text-sm">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-zinc-100">{exp.name}</span>
                      <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
                        <span>{exp.cadenceLabel}</span>
                        <span>•</span>
                        <span className="text-emerald-400 font-medium">{exp.deductionTiming}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-sm text-rose-400">-{formatCurrency(exp.weekly)}/wk</span>
                      <p className="text-xs text-zinc-500 font-mono">-{formatCurrency(exp.annual)}/yr</p>
                    </div>
                  </div>
                ))}
                <div className="pt-2 border-t border-zinc-800 flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-400 font-semibold">Total Living Outgoings:</span>
                  <span className="text-rose-400 font-bold text-sm">-{formatCurrency(jointHouseholdSummary.totalWeeklyOutflow)}/wk</span>
                </div>
              </div>
            ) : selectedRoute === 'ING • Everyday' ? (
              <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                {/* 1. Fixed Direct Debits */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-zinc-300 px-1">
                    <span className="flex items-center gap-1.5 text-sky-400">
                      <Clock className="w-3.5 h-3.5" />
                      Fixed Direct Debits
                    </span>
                    <span className="text-[11px] text-zinc-500 font-mono">
                      {routeItems.filter(i => i.account_route === 'ING • Direct Debit').length} active
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {routeItems.filter(i => i.account_route === 'ING • Direct Debit').map(i => {
                      const m = calculateMetrics(i.native_amount, i.cadence);
                      return (
                        <div key={i.id} className="p-2 rounded-lg bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between text-xs">
                          <div className="truncate mr-2">
                            <span className="font-semibold text-zinc-200 block truncate">{i.description}</span>
                            <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-mono mt-0.5">
                              <span className="text-emerald-400 font-medium">{i.deduction_day || i.cadence}</span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-mono font-bold text-rose-400">-{formatCurrency(i.native_amount)}</span>
                            <span className="text-[10px] text-zinc-500 block font-mono">-{formatCurrency(m.weekly)}/wk</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Scheduled Outbound Transfers */}
                <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                  <div className="flex items-center justify-between text-xs font-semibold text-zinc-300 px-1">
                    <span className="flex items-center gap-1.5 text-indigo-400">
                      <ArrowRight className="w-3.5 h-3.5" />
                      Scheduled Auto-Transfers
                    </span>
                    <span className="text-[11px] text-zinc-500 font-mono">
                      {routeItems.filter(i => i.direction === 'Transfer' || i.verification_status === 'Pending Review').length} auto
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {routeItems.filter(i => i.direction === 'Transfer' || i.verification_status === 'Pending Review').map(i => {
                      const m = calculateMetrics(i.native_amount, i.cadence);
                      return (
                        <div key={i.id} className="p-2 rounded-lg bg-zinc-900/40 border border-zinc-800/60 flex items-center justify-between text-xs">
                          <div className="truncate mr-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-zinc-200 truncate">{i.description}</span>
                              {i.verification_status === 'Pending Review' && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 bg-amber-500/10 border-amber-500/30 text-amber-400 shrink-0">
                                  Pending Setup
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-mono mt-0.5">
                              <span className="text-sky-400 font-medium">{i.deduction_day || i.cadence}</span>
                              <span>•</span>
                              <span>{i.account_route}</span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-mono font-bold text-indigo-300">-{formatCurrency(i.native_amount)}</span>
                            <span className="text-[10px] text-zinc-500 block font-mono">-{formatCurrency(m.weekly)}/wk</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Routine Card Outgoings & Living Expenses */}
                <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                  <div className="flex items-center justify-between text-xs font-semibold text-zinc-300 px-1">
                    <span className="flex items-center gap-1.5 text-rose-400">
                      <Wallet className="w-3.5 h-3.5" />
                      Weekly & Routine Card Outgoings
                    </span>
                    <span className="text-[11px] text-zinc-500 font-mono">
                      {routeItems.filter(i => i.account_route === 'ING • Everyday' && i.direction === 'Outflow').length} expenses
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {routeItems.filter(i => i.account_route === 'ING • Everyday' && i.direction === 'Outflow').map(i => {
                      const m = calculateMetrics(i.native_amount, i.cadence);
                      return (
                        <div key={i.id} className="p-2 rounded-lg bg-zinc-900/40 border border-zinc-800/60 flex items-center justify-between text-xs">
                          <div className="truncate mr-2">
                            <span className="font-semibold text-zinc-200 block truncate">{i.description}</span>
                            <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-mono mt-0.5">
                              <span className="text-zinc-300">{i.category}</span>
                              <span>•</span>
                              <span>{i.cadence}</span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-mono font-bold text-rose-400">-{formatCurrency(i.native_amount)}</span>
                            <span className="text-[10px] text-zinc-500 block font-mono">-{formatCurrency(m.weekly)}/wk</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center space-y-1.5">
                <ShieldCheck className="w-8 h-8 text-emerald-400/60 mx-auto" />
                <p className="text-sm font-medium text-zinc-300">No Periodic Lump Sums</p>
                <p className="text-xs text-zinc-500">Expenses in this route flow smoothly on regular weekly/fortnightly intervals.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Paycheck Deposits & Scheduled Bills Table */}
      <Card className="bg-zinc-950/80 border-zinc-800">
        <CardHeader className="p-4 pb-2.5 border-b border-zinc-800/80">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-400" />
                <span>
                  {selectedRoute === 'ING • Everyday' 
                    ? 'Active Income, Outgoing Bills & Direct Debits' 
                    : selectedRoute === 'MQ • Joint Household'
                    ? 'Joint Living Expenses & Partner Funding Ledger'
                    : selectedRoute === 'MQ • Joint Savings' || selectedRoute === 'ING • Savings'
                    ? 'Paycheck Sinking Allocations & Periodic Bills'
                    : 'Scheduled Cash Flow & Billing Ledger'}
                </span>
              </CardTitle>
              <CardDescription className="text-xs text-zinc-400 mt-0.5">
                {selectedRoute === 'ING • Everyday'
                  ? "Stephen's salary inflow, automated direct debits, regular card spend, and outbound transfers."
                  : selectedRoute === 'MQ • Joint Household'
                  ? 'Household living costs (groceries, electricity, gas, internet, gym) and partner funding shares.'
                  : selectedRoute === 'MQ • Joint Savings' || selectedRoute === 'ING • Savings'
                  ? 'How much pay you put away each paycheck, and when the actual bills drop.'
                  : 'Overview of scheduled cash flows, allocations, and bill debits across accounts.'}
              </CardDescription>
            </div>
            {isLocked && (
              <Badge variant="outline" className="bg-zinc-900 border-zinc-800 text-zinc-400 text-xs">
                🔒 Engine Locked
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800/80 bg-zinc-900/50 text-zinc-300 font-semibold text-xs uppercase tracking-wider">
                  <th className="p-3.5 pl-4">Item & Owner</th>
                  <th className="p-3.5">Cash Flow (In / Out)</th>
                  <th className="p-3.5">1-Year Annual Impact</th>
                  <th className="p-3.5 pr-4">Debit Frequency / Due Timing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {selectedRoute === 'MQ • Joint Household' && jointHouseholdSummary ? (
                  <>
                    {/* Section 1: Active Living Outgoings & Bill Debits */}
                    <tr className="bg-zinc-900/90 border-y border-zinc-800 text-xs font-semibold text-rose-300">
                      <td colSpan={4} className="py-2.5 px-4">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <TrendingDown className="w-4 h-4 text-rose-400" />
                            <span>1. Shared Living Outgoings & Bill Debits (Money Out)</span>
                          </span>
                          <span className="font-mono text-rose-400 font-bold">
                            Total: -{formatCurrency(jointHouseholdSummary.totalWeeklyOutflow)}/wk (-{formatCurrency(jointHouseholdSummary.totalAnnualOutflow)}/yr)
                          </span>
                        </div>
                      </td>
                    </tr>
                    {jointHouseholdSummary.expenses.map((exp, idx) => (
                      <tr key={`jh-exp-${idx}`} className="hover:bg-zinc-900/40 transition-colors">
                        <td className="p-3.5 pl-4">
                          <div className="font-semibold text-zinc-100 flex items-center gap-2">
                            <span>{exp.name}</span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-rose-500/10 border-rose-500/30 text-rose-400 font-mono">
                              ↑ Household Outflow
                            </Badge>
                          </div>
                          <div className="text-xs text-zinc-400 flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-zinc-500">Bill #{idx + 1}</span>
                            <span>•</span>
                            <span className="text-zinc-300 font-medium">{exp.category}</span>
                            <span>•</span>
                            <span className="font-mono text-zinc-400">MQ • Joint Household</span>
                          </div>
                        </td>
                        <td className="p-3.5">
                          <div className="flex items-baseline gap-1.5">
                            <span className="font-mono font-bold text-sm text-rose-400">
                              -{formatCurrency(exp.weekly)}/wk
                            </span>
                            <span className="text-xs text-zinc-400 font-mono">({exp.cadenceLabel})</span>
                          </div>
                          <div className="text-xs text-zinc-400 font-mono mt-0.5">
                            Shared living expense
                          </div>
                        </td>
                        <td className="p-3.5">
                          <div className="font-mono font-bold text-sm text-zinc-200">
                            -{formatCurrency(exp.annual)}/yr
                          </div>
                          <div className="text-xs text-zinc-400 font-mono mt-0.5">
                            Annual household burn
                          </div>
                        </td>
                        <td className="p-3.5 pr-4">
                          <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-emerald-400">
                            <Clock className="w-3.5 h-3.5 shrink-0" />
                            <span>{exp.deductionTiming}</span>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {/* Section 2: Inbound Partner Funding Allocations */}
                    <tr className="bg-zinc-900/90 border-y border-zinc-800 text-xs font-semibold text-sky-300">
                      <td colSpan={4} className="py-2.5 px-4">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <ArrowRight className="w-4 h-4 text-sky-400" />
                            <span>2. Inbound Partner Funding Allocations (Money In)</span>
                          </span>
                          <span className="font-mono text-sky-400 font-bold">
                            Total: +{formatCurrency(jointHouseholdSummary.totalWeeklyInflow)}/wk (+{formatCurrency(jointHouseholdSummary.totalAnnualInflow)}/yr)
                          </span>
                        </div>
                      </td>
                    </tr>
                    {routeItems.map(item => {
                      const metrics = calculateMetrics(item.native_amount, item.cadence);
                      return (
                        <tr key={item.id} className="hover:bg-zinc-900/40 transition-colors">
                          <td className="p-3.5 pl-4">
                            <div className="font-semibold text-zinc-100 flex items-center gap-2">
                              <span>{item.description}</span>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-sky-500/10 border-sky-500/30 text-sky-400 font-mono">
                                ↓ Partner Funding
                              </Badge>
                            </div>
                            <div className="text-xs text-zinc-400 flex items-center gap-2 mt-0.5">
                              <span className="font-mono text-zinc-500">{item.id}</span>
                              <span>•</span>
                              <span className={item.owner === 'Stephen' ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}>{item.owner}</span>
                              <span>•</span>
                              <span>{item.category}</span>
                            </div>
                          </td>
                          <td className="p-3.5">
                            <div className="flex items-baseline gap-1.5">
                              <span className="font-mono font-bold text-sm text-sky-400">
                                +{formatCurrency(item.native_amount)}
                              </span>
                              <span className="text-xs text-zinc-400 font-mono">({item.cadence})</span>
                            </div>
                            <div className="text-xs text-zinc-400 font-mono mt-0.5">
                              +{formatCurrency(metrics.weekly)}/wk funded
                            </div>
                          </td>
                          <td className="p-3.5">
                            <div className="font-mono font-bold text-sm text-zinc-100">
                              +{formatCurrency(metrics.annual)}/yr
                            </div>
                            <div className="text-xs text-zinc-400 font-mono mt-0.5">
                              Annual partner contribution
                            </div>
                          </td>
                          <td className="p-3.5 pr-4">
                            <span className="text-zinc-200 text-xs font-mono font-medium flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                              <span>{item.deduction_day || `Transferred ${item.cadence}`}</span>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </>
                ) : (
                  routeItems.map(item => {
                    const metrics = calculateMetrics(item.native_amount, item.cadence);
                    const currentDueMonth = getDefaultDueMonth(item);
                    const isUpdating = updatingItemId === item.id;
                    const isLump = ['Quarterly', 'Semi-Annual', 'Annual'].includes(item.cadence);

                    const isInflow = item.direction === 'Inflow';
                    const isOutflow = item.direction === 'Outflow';
                    const isTransfer = item.direction === 'Transfer';
                    const isEverydayTransferOut = selectedRoute === 'ING • Everyday' && isTransfer;
                    const isRetainedSavings = (selectedRoute === 'ING • Savings' && (item.id === 'S-38' || item.description.toLowerCase().includes('discretionary allowance'))) ||
                                              (selectedRoute === 'MQ • Shae Savings' && (item.id === 'H-32' || item.description.toLowerCase().includes('personal savings')));
                    const isReserveFunding = (!isEverydayTransferOut && isTransfer) || isRetainedSavings;

                    return (
                    <tr key={item.id} className="hover:bg-zinc-900/40 transition-colors">
                      <td className="p-3.5 pl-4">
                        <div className="font-semibold text-zinc-100 flex items-center gap-2">
                          <span>{item.description}</span>
                          {isInflow && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-mono">
                              ↓ Inflow
                            </Badge>
                          )}
                          {isRetainedSavings && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-mono">
                              ↓ Retained Savings
                            </Badge>
                          )}
                          {isOutflow && !isRetainedSavings && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-rose-500/10 border-rose-500/30 text-rose-400 font-mono">
                              ↑ Outflow / Debit
                            </Badge>
                          )}
                          {isEverydayTransferOut && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-indigo-500/10 border-indigo-500/30 text-indigo-400 font-mono">
                              ⇄ Outbound Transfer
                            </Badge>
                          )}
                          {isReserveFunding && !isRetainedSavings && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-sky-500/10 border-sky-500/30 text-sky-400 font-mono">
                              ↓ Funding Float
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-zinc-400 flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-zinc-500">{item.id}</span>
                          <span>•</span>
                          <span className={item.owner === 'Stephen' ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}>{item.owner}</span>
                          <span>•</span>
                          <span>{item.category}</span>
                          <span>•</span>
                          <span className="font-mono text-zinc-400">{item.account_route}</span>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-baseline gap-1.5">
                          <span className={`font-mono font-bold text-sm ${
                            isInflow ? 'text-emerald-400' :
                            isRetainedSavings ? 'text-emerald-400' :
                            isOutflow ? 'text-rose-400' :
                            isEverydayTransferOut ? 'text-indigo-400' :
                            'text-sky-400'
                          }`}>
                            {isInflow ? `+${formatCurrency(item.native_amount)}` :
                             isRetainedSavings ? `+${formatCurrency(item.native_amount)}` :
                             isOutflow ? `-${formatCurrency(item.native_amount)}` :
                             isEverydayTransferOut ? `-${formatCurrency(item.native_amount)}` :
                             `+${formatCurrency(item.native_amount)}`}
                          </span>
                          <span className="text-xs text-zinc-400">({item.cadence})</span>
                        </div>
                        <div className="text-xs text-zinc-400 font-mono mt-0.5">
                          {isInflow ? `+${formatCurrency(metrics.weekly)}/wk income` :
                           isRetainedSavings ? `+${formatCurrency(metrics.weekly)}/wk saved` :
                           isOutflow ? `-${formatCurrency(metrics.weekly)}/wk outgoing` :
                           isEverydayTransferOut ? `-${formatCurrency(metrics.weekly)}/wk transfer` :
                           `+${formatCurrency(metrics.weekly)}/wk saved float`}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <div className={`font-mono font-bold text-sm ${
                          isInflow ? 'text-emerald-400' :
                          isRetainedSavings ? 'text-emerald-400' :
                          isOutflow ? 'text-zinc-200' :
                          isEverydayTransferOut ? 'text-zinc-300' :
                          'text-zinc-100'
                        }`}>
                          {isInflow ? `+${formatCurrency(metrics.annual)}/yr` :
                           isRetainedSavings ? `+${formatCurrency(metrics.annual)}/yr` :
                           isOutflow ? `-${formatCurrency(metrics.annual)}/yr` :
                           isEverydayTransferOut ? `-${formatCurrency(metrics.annual)}/yr` :
                           `+${formatCurrency(metrics.annual)}/yr`}
                        </div>
                        <div className="text-xs text-zinc-400 font-mono mt-0.5">
                          {isInflow ? 'Annual gross inflow' :
                           isRetainedSavings ? '52-week personal savings growth' :
                           isOutflow ? 'Annual expense burn' :
                           isEverydayTransferOut ? 'Annual scheduled transfer' :
                           '52-week reserve accumulation'}
                        </div>
                      </td>
                      <td className="p-3.5 pr-4">
                        {isLump ? (
                          <div className="flex flex-col gap-1">
                            <select
                              disabled={isLocked || isUpdating}
                              value={currentDueMonth}
                              onChange={e => handleMonthChange(item, parseInt(e.target.value))}
                              className="bg-zinc-900 border border-zinc-700/80 rounded-md px-3 py-1.5 text-sm text-zinc-100 font-medium focus:border-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                              {MONTH_OPTIONS.map(m => (
                                <option key={m.value} value={m.value}>
                                  {m.label}
                                </option>
                              ))}
                            </select>
                            <span className="text-xs text-zinc-400 font-mono">
                              Bills drop in: {getBillingCycleMonthsLabel(item.cadence, currentDueMonth)}
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {item.deduction_day ? (
                              <span className="text-zinc-200 text-xs font-mono font-medium flex items-center gap-1.5">
                                <Clock className="w-3 h-3 text-sky-400 shrink-0" />
                                <span>{item.deduction_day}</span>
                              </span>
                            ) : (
                              <span className="text-zinc-300 text-xs font-mono">
                                {isInflow ? `Received ${item.cadence}` :
                                 isOutflow ? `Debited ${item.cadence}` :
                                 `Transferred ${item.cadence}`}
                              </span>
                            )}
                            {item.verification_status === 'Pending Review' && (
                              <Badge variant="outline" className="text-[10px] w-fit px-1.5 py-0 bg-amber-500/10 border-amber-500/30 text-amber-400 font-mono">
                                Pending Setup (Next Tue)
                              </Badge>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                }))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
