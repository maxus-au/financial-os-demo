import type { FinancialItem } from '../types';
import { calculateMetrics } from './financeMath';

export interface WeekPoint {
  weekIndex: number; // 0 to 51
  weekNumber: number; // 1 to 52
  date: Date;
  dateLabel: string;
  monthIndex: number; // 0 to 11
  monthName: string;
  inflows: number;
  outflows: number;
  net: number;
  runningBalanceZeroBase: number;
  runningBalanceWithSeed: number;
  isPeakDrawdown: boolean;
  events: Array<{
    id: string;
    description: string;
    amount: number;
    direction: 'inflow' | 'outflow';
    cadence: string;
  }>;
}

export interface SinkingSimulationResult {
  accountRoute: string;
  weeks: WeekPoint[];
  totalAnnualInflow: number;
  totalAnnualOutflow: number;
  netAnnualDelta: number;
  peakDrawdown: number; // Positive number representing the maximum deficit below $0
  peakDrawdownWeek: number; // 1-52
  peakDrawdownDate: string;
  recommendedSeedFloat: number; // peakDrawdown + safety cushion
  safetyCushion: number;
  lowestBalanceZeroBase: number;
  lowestBalanceWithSeed: number;
  startingBalance: number;
  isSafeWithStartingBalance: boolean;
  safetyMargin: number; // startingBalance - peakDrawdown
  upcomingLumpSums: Array<{
    id: string;
    description: string;
    amount: number;
    cadence: string;
    dueDateLabel: string;
    weeksAway: number;
  }>;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Returns default anchor month (1-12) based on item attributes.
 */
export function getDefaultDueMonth(item: FinancialItem): number {
  if (item.due_month && item.due_month >= 1 && item.due_month <= 12) {
    return item.due_month;
  }

  const desc = (item.description || '').toLowerCase();
  const notes = (item.notes || '').toLowerCase();
  const combined = `${desc} ${notes}`;

  if (combined.includes('rate')) return 2; // February (and August)
  if (combined.includes('water')) return 11; // November (Nov, Feb, May, Aug)
  if (combined.includes('body corporate') || combined.includes('body corp')) return 11; // November (Nov, Feb, May, Aug)
  if (combined.includes('rego') || combined.includes('registration')) return 5; // May
  if (combined.includes('tyre')) return 11; // November
  if (combined.includes('prime')) return 11; // November
  if (combined.includes('simparica')) return 5; // May (and Nov)
  if (combined.includes('food') && combined.includes('dry')) return 1; // Jan, Apr, Jul, Oct
  if (combined.includes('grooming')) return 2; // Feb, May, Aug, Nov
  if (combined.includes('debridio')) return 12; // December
  if (combined.includes('hair') || combined.includes('salon')) return 3; // March (quarterly)
  if (combined.includes('accor vacation') || combined.includes('avc')) return 1; // Jan, Apr, Jul, Oct
  if (combined.includes('accor plus')) return 8; // August
  if (combined.includes('electricity') || combined.includes('power')) return 1; // Quarterly
  if (combined.includes('gas')) return 2; // Bi-monthly / quarterly

  return 1; // Default to January
}

/**
 * Returns human-readable recurring months label based on cadence and anchor month.
 */
export function getBillingCycleMonthsLabel(cadence: string, anchorMonth: number): string {
  const m = anchorMonth - 1; // 0-indexed
  if (cadence === 'Annual') {
    return MONTH_NAMES[m];
  }
  if (cadence === 'Semi-Annual') {
    const m2 = (m + 6) % 12;
    return `${MONTH_NAMES[m]} & ${MONTH_NAMES[m2]}`;
  }
  if (cadence === 'Quarterly') {
    const m2 = (m + 3) % 12;
    const m3 = (m + 6) % 12;
    const m4 = (m + 9) % 12;
    return `${MONTH_NAMES[m]}, ${MONTH_NAMES[m2]}, ${MONTH_NAMES[m3]}, ${MONTH_NAMES[m4]}`;
  }
  if (cadence === 'Monthly') {
    return 'Every Month';
  }
  if (cadence === 'Fortnightly') {
    return 'Every 2 Weeks';
  }
  if (cadence === 'Weekly') {
    return 'Every Week';
  }
  return cadence;
}

/**
 * Helper to identify if an item is a sinking fund for a periodic bill.
 */
function isPeriodicSinkingBill(item: FinancialItem): { isSinking: boolean; effectiveCadence: string; lumpSumAmount: number; isJointHouseholdBill?: boolean } {
  const desc = (item.description || '').toLowerCase();
  const notes = (item.notes || '').toLowerCase();
  const combined = `${desc} ${notes}`;
  const metrics = calculateMetrics(item.native_amount, item.cadence);

  // BMW Rego
  if (combined.includes('rego') || combined.includes('registration')) {
    return { isSinking: true, effectiveCadence: 'Annual', lumpSumAmount: metrics.annual || 1092 };
  }
  // BMW Tyres
  if (combined.includes('tyre')) {
    return { isSinking: true, effectiveCadence: 'Annual', lumpSumAmount: metrics.annual || 728 };
  }
  // BMW Servicing
  if (combined.includes('servicing')) {
    return { isSinking: true, effectiveCadence: 'Annual', lumpSumAmount: metrics.annual || 0 };
  }
  // Council Rates - Real household notice is $1,141.75 half-yearly
  if (combined.includes('rates') || combined.includes('council')) {
    return { isSinking: true, effectiveCadence: 'Semi-Annual', lumpSumAmount: 1141.75, isJointHouseholdBill: true };
  }
  // Water & Sewerage - Real household notice is $400.00 quarterly
  if (combined.includes('water')) {
    return { isSinking: true, effectiveCadence: 'Quarterly', lumpSumAmount: 400.00, isJointHouseholdBill: true };
  }
  // Body Corporate / Strata - Real household notice is $910.00 quarterly
  if (combined.includes('body corporate') || combined.includes('body corp')) {
    return { isSinking: true, effectiveCadence: 'Quarterly', lumpSumAmount: 910.00, isJointHouseholdBill: true };
  }
  // Standard non-weekly cadences
  if (item.cadence === 'Annual') {
    return { isSinking: true, effectiveCadence: 'Annual', lumpSumAmount: item.native_amount };
  }
  if (item.cadence === 'Semi-Annual') {
    return { isSinking: true, effectiveCadence: 'Semi-Annual', lumpSumAmount: item.native_amount };
  }
  if (item.cadence === 'Quarterly') {
    return { isSinking: true, effectiveCadence: 'Quarterly', lumpSumAmount: item.native_amount };
  }

  return { isSinking: false, effectiveCadence: item.cadence, lumpSumAmount: item.native_amount };
}

/**
 * Simulates 52 weeks of cash flow for a specific account route or all sinking funds.
 */
export function simulateSinkingTrajectory(
  items: FinancialItem[],
  selectedRoute: string,
  startingBalance: number = 0,
  startDate: Date = new Date(2026, 9, 5) // Monday 5 Oct 2026
): SinkingSimulationResult {
  const isAll = selectedRoute === 'ALL';
  const isEveryday = selectedRoute === 'ING • Everyday';
  const relevantItems = items.filter(item => {
    if (item.verification_status === 'Archived / Paid Off') return false;
    if (isAll) {
      return (
        item.account_route.includes('Savings') ||
        item.account_route.includes('Household') ||
        item.account_route === 'BOQ • Home Offset'
      );
    }
    if (isEveryday) {
      if (item.owner !== 'Stephen') return false;
      // Primary Salary Inflow
      if (item.id === 'S-01' || (item.direction === 'Inflow' && item.account_route === 'ING • Everyday')) return true;
      // Scheduled automated transfers departing Everyday to other joint/offset facilities
      if (item.direction === 'Transfer') return true;
      // Allocations transferred into ING Savings
      if (item.account_route === 'ING • Savings') return true;
      // Direct debits funded from Everyday
      if (item.account_route === 'ING • Direct Debit') return true;
      // Card and direct spending from Everyday
      if (item.account_route === 'ING • Everyday' && item.direction === 'Outflow') return true;
      return false;
    }
    return item.account_route === selectedRoute;
  });

  const weeks: WeekPoint[] = [];

  // Precompute calendar dates for 52 weeks
  for (let w = 0; w < 52; w++) {
    const wDate = new Date(startDate.getTime() + w * 7 * 24 * 60 * 60 * 1000);
    const day = wDate.getDate();
    const month = wDate.getMonth();
    const year = wDate.getFullYear();
    const dateLabel = `${day} ${MONTH_NAMES[month].substring(0, 3)} ${year}`;

    weeks.push({
      weekIndex: w,
      weekNumber: w + 1,
      date: wDate,
      dateLabel,
      monthIndex: month,
      monthName: MONTH_NAMES[month],
      inflows: 0,
      outflows: 0,
      net: 0,
      runningBalanceZeroBase: 0,
      runningBalanceWithSeed: 0,
      isPeakDrawdown: false,
      events: []
    });
  }

  // 1. INFLOW STREAM:
  // For any sinking or holding route, every active item allocated to this account represents regular funding
  // transferred into the account from paychecks (or direct salary deposit).
  // Note: For BOQ Offset, salary inflows are explicit Inflow items. For Sinking/Household accounts,
  // the items themselves define the weekly/fortnightly transfer budget arriving into that account.
  relevantItems.forEach(item => {
    const metrics = calculateMetrics(item.native_amount, item.cadence);
    if (metrics.weekly <= 0) return;

    // For ING Everyday, Stephen salary is the master inflow!
    if (isEveryday) {
      if (item.id === 'S-01' || (item.direction === 'Inflow' && item.account_route === 'ING • Everyday')) {
        for (let w = 0; w < 52; w++) {
          weeks[w].inflows += item.native_amount;
        }
      }
      return;
    }

    // For BOQ Offset, only Inflow / Rent items are inflows into the offset
    if (item.account_route === 'BOQ • Home Offset') {
      if (item.direction === 'Inflow' || item.direction === 'Transfer') {
        // Deduplicate Stephen rent if both S-02 (transfer) and H-03 (inflow) exist in relevantItems
        if (item.id === 'H-03' && relevantItems.some(i => i.id === 'S-02')) {
          return;
        }
        const offset = item.owner === 'Shae' ? 0 : 1;
        if (item.cadence === 'Weekly') {
          for (let w = 0; w < 52; w++) weeks[w].inflows += item.native_amount;
        } else if (item.cadence === 'Fortnightly') {
          for (let w = 0; w < 52; w++) {
            if (w % 2 === offset) weeks[w].inflows += item.native_amount;
          }
        }
      }
      return;
    }

    // For all dedicated reserve routes (ING Savings, MQ Joint Savings, MQ Joint Household, ING Direct Debit, etc.):
    // All items assigned to this route represent regular paycheck allocations feeding into this account!
    // Stephen feeds weekly, Shae feeds fortnightly.
    if (item.owner === 'Shae' && item.cadence === 'Fortnightly') {
      for (let w = 0; w < 52; w++) {
        if (w % 2 === 0) weeks[w].inflows += item.native_amount;
      }
    } else {
      // Weekly or monthly normalized allocation entering account
      for (let w = 0; w < 52; w++) {
        weeks[w].inflows += metrics.weekly;
      }
    }
  });

  // For BOQ Home Offset (or ALL reserve aggregate), model Shae's planned mortgage contribution.
  // Stephen's rent funds his agreed portion, and Shae funds the remaining balance of the
  // contractual P&I mortgage repayment ($1,240.79/fn) from her salary so the offset facility does not hemorrhage cash.
  if (selectedRoute === 'BOQ • Home Offset' || isAll) {
    const boqMortgage = relevantItems.find(i => 
      i.account_route === 'BOQ • Home Offset' && 
      i.direction === 'Outflow' && 
      i.description.toLowerCase().includes('mortgage')
    );
    if (boqMortgage) {
      const stephenRentItem = relevantItems.find(i => 
        i.account_route === 'BOQ • Home Offset' && 
        (i.id === 'S-02' || (i.owner === 'Stephen' && (i.direction === 'Transfer' || i.direction === 'Inflow')))
      );
      const stephenWeeklyRent = stephenRentItem 
        ? calculateMetrics(stephenRentItem.native_amount, stephenRentItem.cadence).weekly 
        : 150;
      const stephenFortnightlyRent = stephenWeeklyRent * 2;
      const shaeMortgageShare = Math.max(0, boqMortgage.native_amount - stephenFortnightlyRent);

      if (shaeMortgageShare > 0) {
        for (let w = 0; w < 52; w++) {
          if (w % 2 === 0) { // Shae's fortnightly pay cycle
            weeks[w].inflows += shaeMortgageShare;
          }
        }
      }
    }
  }

  // 2. OUTFLOW DEBITS:
  // Model actual bill drops, transfers, and living debits exiting the account.
  const processedJointBills = new Set<string>();

  relevantItems.forEach(item => {
    // Inflows never debit
    if (item.direction === 'Inflow') return;

    const descLower = (item.description || '').toLowerCase();

    // Check if this is a joint household bill (Rates, Water, Body Corp) on Joint Savings or ALL
    const isJointBill = (selectedRoute === 'MQ • Joint Savings' || isAll) && 
      (descLower.includes('rates') || descLower.includes('council') || descLower.includes('water') || descLower.includes('body corporate') || descLower.includes('body corp'));

    // Check if this is a vehicle sinking bill (Rego, Tyres) on ING Savings or ALL
    const isVehicleSinkingBill = (selectedRoute === 'ING • Savings' || isAll) &&
      (descLower.includes('rego') || descLower.includes('registration') || descLower.includes('tyre'));

    // For reserve, joint, and offset accounts, Transfer items represent incoming funding allocations,
    // NOT debits exiting the account! (Only for ING Everyday do transfers depart the account,
    // and for MQ Joint Household, both partners' allocations fund living expenses that debit the account,
    // and for periodic sinking bills like Rates, Water, Strata, Rego, Tyres, the actual bill debits when due).
    const isJointHouseholdItem = item.account_route === 'MQ • Joint Household';
    if (!isEveryday && !isJointBill && !isVehicleSinkingBill && !isJointHouseholdItem && item.direction === 'Transfer') return;

    const metrics = calculateMetrics(item.native_amount, item.cadence);
    if (metrics.weekly <= 0) return;

    // If an item is pure long-term savings retention (e.g. House Deposit Core S-06 / H-08, Shae Personal Savings H-32, Stephen Discretionary Allowance S-38),
    // it stays in the account and does NOT debit as a bill outflow, UNLESS this is ING Everyday where transfers depart the account!
    if (!isEveryday && (
      descLower.includes('house deposit core') || 
      descLower.includes('joint savings core') || 
      descLower.includes('personal savings') ||
      descLower.includes('discretionary allowance') ||
      item.id === 'S-38'
    )) {
      return;
    }

    // For ING Everyday, outbound transfers to joint accounts, offset, or savings are steady automated weekly transfers,
    // NOT periodic lump-sum debits! They must debit steadily on their native cadence, not as sinking lump sums.
    const isOutboundTransfer = isEveryday && (item.direction === 'Transfer' || item.account_route === 'ING • Savings');
    const sinkingInfo = isOutboundTransfer 
      ? { isSinking: false, effectiveCadence: item.cadence, lumpSumAmount: item.native_amount }
      : isPeriodicSinkingBill(item);

    // If this is a joint household bill on Joint Savings or ALL, ensure each unique bill is processed once as the unified invoice
    if (sinkingInfo.isJointHouseholdBill) {
      const rootKey = item.description
        .replace(/\s*\(Stephen\s*Share\)/i, '')
        .replace(/\s*\(Shae\s*Share\)/i, '')
        .replace(/\s*\(Joint\s*Share\)/i, '')
        .toLowerCase()
        .trim();
      if (processedJointBills.has(rootKey)) return;
      processedJointBills.add(rootKey);
    }

    const anchorMonth = getDefaultDueMonth(item);

    // Helper to add event to week, consolidating split shares (e.g. Stephen Share + Shae Share) into a single invoice entry
    const recordEvent = (wIndex: number, cadence: string, amount: number) => {
      weeks[wIndex].outflows += amount;
      const rootDesc = item.description
        .replace(/\s*\(Stephen\s*Share\)/i, '')
        .replace(/\s*\(Shae\s*Share\)/i, '')
        .replace(/\s*\(Joint\s*Share\)/i, '')
        .trim();
      
      const existingEv = weeks[wIndex].events.find(e => {
        const existingRoot = e.description
          .replace(/\s*\(Stephen\s*Share\)/i, '')
          .replace(/\s*\(Shae\s*Share\)/i, '')
          .replace(/\s*\(Joint\s*Share\)/i, '')
          .trim();
        return existingRoot.toLowerCase() === rootDesc.toLowerCase();
      });

      if (existingEv) {
        existingEv.amount += amount;
        existingEv.description = rootDesc; // unified name
      } else {
        weeks[wIndex].events.push({
          id: item.id,
          description: rootDesc,
          amount: amount,
          direction: 'outflow',
          cadence
        });
      }
    };

    if (sinkingInfo.isSinking) {
      const lumpAmount = sinkingInfo.lumpSumAmount;
      if (lumpAmount <= 0) return;

      if (sinkingInfo.effectiveCadence === 'Annual') {
        // Debits once per year in target anchor month
        const targetMonth = (anchorMonth - 1) % 12;
        let triggered = false;
        for (let w = 0; w < 52; w++) {
          if (!triggered && weeks[w].monthIndex === targetMonth && weeks[w].date.getDate() >= 12) {
            triggered = true;
            recordEvent(w, 'Annual', lumpAmount);
          }
        }
      } else if (sinkingInfo.effectiveCadence === 'Semi-Annual') {
        // Debits twice per year
        const activeMonths = [(anchorMonth - 1) % 12, (anchorMonth - 1 + 6) % 12];
        const triggered = new Set<string>();
        for (let w = 0; w < 52; w++) {
          const m = weeks[w].monthIndex;
          const y = weeks[w].date.getFullYear();
          const key = `${y}-${m}`;
          if (activeMonths.includes(m) && !triggered.has(key) && weeks[w].date.getDate() >= 12) {
            triggered.add(key);
            recordEvent(w, 'Semi-Annual', lumpAmount);
          }
        }
      } else if (sinkingInfo.effectiveCadence === 'Quarterly') {
        // Debits 4 times per year
        const activeMonths = [
          (anchorMonth - 1) % 12,
          (anchorMonth - 1 + 3) % 12,
          (anchorMonth - 1 + 6) % 12,
          (anchorMonth - 1 + 9) % 12
        ];
        const triggered = new Set<string>();
        for (let w = 0; w < 52; w++) {
          const m = weeks[w].monthIndex;
          const y = weeks[w].date.getFullYear();
          const key = `${y}-${m}`;
          if (activeMonths.includes(m) && !triggered.has(key) && weeks[w].date.getDate() >= 12) {
            triggered.add(key);
            recordEvent(w, 'Quarterly', lumpAmount);
          }
        }
      }
    } else {
      // Routine recurring expenses (e.g. Allowance $125/wk, Groceries $300/wk, Mortgages, Fortnightly Insurances)
      if (item.cadence === 'Weekly') {
        for (let w = 0; w < 52; w++) weeks[w].outflows += item.native_amount;
      } else if (item.cadence === 'Fortnightly') {
        const offset = item.owner === 'Shae' ? 0 : 1;
        for (let w = 0; w < 52; w++) {
          if (w % 2 === offset) weeks[w].outflows += item.native_amount;
        }
      } else if (item.cadence === 'Monthly') {
        const monthsHit = new Set<number>();
        for (let w = 0; w < 52; w++) {
          const m = weeks[w].monthIndex;
          if (!monthsHit.has(m) && weeks[w].date.getDate() >= 10) {
            monthsHit.add(m);
            weeks[w].outflows += item.native_amount;
          }
        }
      }
    }
  });

  // 3. Compute running balance, peak drawdown, and equilibrium metrics
  let runningZeroBase = 0;
  let runningWithSeed = startingBalance;
  let lowestZeroBase = 0;
  let peakDrawdownIndex = 0;
  let totalInflow = 0;
  let totalOutflow = 0;

  for (let w = 0; w < 52; w++) {
    const net = weeks[w].inflows - weeks[w].outflows;
    runningZeroBase += net;
    runningWithSeed += net;

    weeks[w].net = net;
    weeks[w].runningBalanceZeroBase = runningZeroBase;
    weeks[w].runningBalanceWithSeed = runningWithSeed;

    totalInflow += weeks[w].inflows;
    totalOutflow += weeks[w].outflows;

    if (runningZeroBase < lowestZeroBase) {
      lowestZeroBase = runningZeroBase;
      peakDrawdownIndex = w;
    }
  }

  // Mark peak drawdown week
  if (lowestZeroBase < 0) {
    weeks[peakDrawdownIndex].isPeakDrawdown = true;
  }

  const peakDrawdown = Math.abs(lowestZeroBase);
  const safetyCushion = peakDrawdown > 0 ? Math.max(100, Math.ceil((peakDrawdown * 0.10) / 25) * 25) : 150;
  const recommendedSeedFloat = peakDrawdown > 0 ? Math.ceil((peakDrawdown + safetyCushion) / 50) * 50 : 200;

  // Helper to extract clean bill title without split share suffixes
  const getRootBillName = (desc: string): string => {
    return desc
      .replace(/\s*\(Stephen\s*Share\)/i, '')
      .replace(/\s*\(Shae\s*Share\)/i, '')
      .replace(/\s*\(Joint\s*Share\)/i, '')
      .trim();
  };

  // Upcoming lump sums list with consolidated joint bills
  const upcomingLumpSums: SinkingSimulationResult['upcomingLumpSums'] = [];
  for (let w = 0; w < 52; w++) {
    const weekGroups = new Map<string, {
      id: string;
      description: string;
      amount: number;
      cadence: string;
    }>();

    weeks[w].events.forEach(ev => {
      const root = getRootBillName(ev.description);
      const isShare = ev.description.toLowerCase().includes('share');
      const cleanDesc = isShare ? root : ev.description;

      if (weekGroups.has(root)) {
        const existing = weekGroups.get(root)!;
        existing.amount += ev.amount;
      } else {
        weekGroups.set(root, {
          id: ev.id,
          description: cleanDesc,
          amount: ev.amount,
          cadence: ev.cadence
        });
      }
    });

    weekGroups.forEach(grp => {
      upcomingLumpSums.push({
        id: grp.id,
        description: grp.description,
        amount: grp.amount,
        cadence: grp.cadence,
        dueDateLabel: weeks[w].dateLabel,
        weeksAway: w + 1
      });
    });
  }

  return {
    accountRoute: selectedRoute,
    weeks,
    totalAnnualInflow: totalInflow,
    totalAnnualOutflow: totalOutflow,
    netAnnualDelta: totalInflow - totalOutflow,
    peakDrawdown,
    peakDrawdownWeek: weeks[peakDrawdownIndex].weekNumber,
    peakDrawdownDate: weeks[peakDrawdownIndex].dateLabel,
    recommendedSeedFloat,
    safetyCushion,
    lowestBalanceZeroBase: lowestZeroBase,
    lowestBalanceWithSeed: startingBalance + lowestZeroBase,
    startingBalance,
    isSafeWithStartingBalance: (startingBalance + lowestZeroBase) >= 0,
    safetyMargin: (startingBalance + lowestZeroBase),
    upcomingLumpSums: upcomingLumpSums.slice(0, 8)
  };
}
