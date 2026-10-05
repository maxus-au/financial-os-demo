import type { Cadence } from './utils/financeMath';

export interface AuditChange {
  field: string;
  from?: any;
  to?: any;
}

export interface AuditLogEntry {
  timestamp: string;
  actor: string;
  reason?: string;
  action?: string;
  field?: string;
  from?: any;
  to?: any;
  from_amount?: number;
  to_amount?: number;
  changes?: AuditChange[];
}

export interface FinancialItem {
  id: string;
  owner: string;
  direction: 'Inflow' | 'Outflow' | 'Transfer';
  category: string;
  description: string;
  native_amount: number;
  cadence: Cadence;
  account_route: string;
  source_authority: string;
  verification_status: string;
  notes: string;
  due_month?: number;
  due_day?: number;
  deduction_day?: string;
  pending_baseline_promotion?: { requested_by: string; reason: string; };
  audit_trail?: AuditLogEntry[];
  history?: any[];
}

export type PropertyStatus = 'Priority' | 'Inspect' | 'Watching' | 'Pass' | 'Modeled';

export interface ProspectiveProperty {
  id: string;
  address: string;
  url?: string;
  guide_price: number;
  estimated_rent_weekly?: number;
  bedrooms?: number;
  bathrooms?: number;
  car_spaces?: number;
  status: PropertyStatus;
  rating_alex: number; // 0-5
  rating_jordan: number; // 0-5
  notes?: string;
  source_snippet?: string;
  created_at: string;
  updated_at: string;
}

