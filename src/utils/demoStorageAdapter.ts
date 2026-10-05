import type { FinancialItem, ProspectiveProperty } from '../types';
import dummyMasterData from '../data/dummyMaster.json';
import dummyBaselineData from '../data/dummyBaseline.json';
import dummyPropertiesData from '../data/dummyProperties.json';

const STORAGE_KEY_ITEMS = 'financial_os_demo_items';
const STORAGE_KEY_BASELINES = 'financial_os_demo_baselines';
const STORAGE_KEY_PROPERTIES = 'financial_os_demo_properties';

// Determine if demo mode is enabled
export const isDemoMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  // If explicitly hosted on Vercel, Netlify, GitHub Pages, or Vite env flag is true
  if (import.meta.env.VITE_DEMO_MODE === 'true') return true;
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') return true;
  return localStorage.getItem('force_demo_mode') === 'true';
};

// Seed or retrieve demo financial items
export const getDemoData = (): { items: FinancialItem[]; baselines: FinancialItem[] } => {
  try {
    const storedItems = localStorage.getItem(STORAGE_KEY_ITEMS);
    const storedBaselines = localStorage.getItem(STORAGE_KEY_BASELINES);

    const items = storedItems ? JSON.parse(storedItems) : (dummyMasterData as unknown as FinancialItem[]);
    const baselines = storedBaselines ? JSON.parse(storedBaselines) : (dummyBaselineData as unknown as FinancialItem[]);

    if (!storedItems) localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(items));
    if (!storedBaselines) localStorage.setItem(STORAGE_KEY_BASELINES, JSON.stringify(baselines));

    return { items, baselines };
  } catch (e) {
    console.error('Error accessing demo storage:', e);
    return {
      items: dummyMasterData as unknown as FinancialItem[],
      baselines: dummyBaselineData as unknown as FinancialItem[],
    };
  }
};

// Seed or retrieve demo properties
export const getDemoProperties = (): ProspectiveProperty[] => {
  try {
    const storedProps = localStorage.getItem(STORAGE_KEY_PROPERTIES);
    if (storedProps) return JSON.parse(storedProps);
    const props = dummyPropertiesData as unknown as ProspectiveProperty[];
    localStorage.setItem(STORAGE_KEY_PROPERTIES, JSON.stringify(props));
    return props;
  } catch (e) {
    console.error('Error accessing demo properties storage:', e);
    return dummyPropertiesData as unknown as ProspectiveProperty[];
  }
};

// Update an item in demo mode
export const updateDemoItem = (updatedItem: FinancialItem, reason?: string, actor?: string): boolean => {
  try {
    const { items } = getDemoData();
    const idx = items.findIndex((i) => i.id === updatedItem.id);
    if (idx === -1) return false;

    const previousItem = items[idx];
    const changes: { field: string; from: any; to: any }[] = [];

    (['description', 'native_amount', 'cadence', 'category', 'account_route', 'verification_status', 'notes', 'direction', 'due_month', 'deduction_day'] as const).forEach(
      (field) => {
        if (updatedItem[field] !== previousItem[field]) {
          changes.push({
            field,
            from: previousItem[field],
            to: updatedItem[field],
          });
        }
      }
    );

    const auditEntry = {
      timestamp: new Date().toISOString(),
      actor: actor || 'Demo User',
      reason: reason || 'Demo inline update',
      changes: changes.length > 0 ? changes : undefined,
    };

    const newAuditTrail = [auditEntry, ...(previousItem.audit_trail || [])].slice(0, 15);
    items[idx] = {
      ...updatedItem,
      audit_trail: newAuditTrail,
    };

    localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(items));
    return true;
  } catch (e) {
    console.error('Error updating demo item:', e);
    return false;
  }
};

// Create a new item in demo mode
export const createDemoItem = (newItem: Partial<FinancialItem>, actor?: string): { success: boolean; item?: FinancialItem } => {
  try {
    const { items } = getDemoData();
    const owner = newItem.owner || 'Alex';
    const prefix = owner === 'Jordan' ? 'H' : 'S';
    
    // Find next available ID
    const existingIds = items
      .filter((i) => i.id.startsWith(`${prefix}-`))
      .map((i) => parseInt(i.id.replace(`${prefix}-`, ''), 10))
      .filter((n) => !isNaN(n));
    const nextNum = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
    const generatedId = `${prefix}-${String(nextNum).padStart(2, '0')}`;

    const completeItem: FinancialItem = {
      id: generatedId,
      owner,
      category: newItem.category || 'Lifestyle',
      description: newItem.description || 'New Demo Expense',
      native_amount: Number(newItem.native_amount) || 0,
      cadence: newItem.cadence || 'Weekly',
      account_route: newItem.account_route || 'ING • Everyday',
      source_authority: newItem.source_authority || 'Manual Demo Entry',
      verification_status: newItem.verification_status || 'Draft',
      notes: newItem.notes || '',
      direction: newItem.direction || 'Outflow',
      audit_trail: [
        {
          timestamp: new Date().toISOString(),
          actor: actor || 'Demo User',
          reason: 'Created new expense item in demo mode',
        },
      ],
    };

    const nextItems = [completeItem, ...items];
    localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(nextItems));
    return { success: true, item: completeItem };
  } catch (e) {
    console.error('Error creating demo item:', e);
    return { success: false };
  }
};

// Delete item in demo mode
export const deleteDemoItem = (id: string): boolean => {
  try {
    const { items, baselines } = getDemoData();
    const filteredItems = items.filter((i) => i.id !== id);
    const filteredBaselines = baselines.filter((i) => i.id !== id);
    localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(filteredItems));
    localStorage.setItem(STORAGE_KEY_BASELINES, JSON.stringify(filteredBaselines));
    return true;
  } catch (e) {
    console.error('Error deleting demo item:', e);
    return false;
  }
};

// Revert item to baseline in demo mode
export const revertDemoItem = (id: string, actor?: string): boolean => {
  try {
    const { items, baselines } = getDemoData();
    const baseline = baselines.find((b) => b.id === id);
    const currentIdx = items.findIndex((i) => i.id === id);
    if (!baseline || currentIdx === -1) return false;

    const currentItem = items[currentIdx];
    const auditEntry = {
      timestamp: new Date().toISOString(),
      actor: actor || 'Demo User',
      reason: 'Reverted to baseline in demo mode',
    };

    items[currentIdx] = {
      ...baseline,
      audit_trail: [auditEntry, ...(currentItem.audit_trail || [])].slice(0, 15),
    };

    localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(items));
    return true;
  } catch (e) {
    console.error('Error reverting demo item:', e);
    return false;
  }
};

// Promote to baseline in demo mode
export const promoteDemoItem = (id: string, reason?: string, actor?: string): boolean => {
  try {
    const { items, baselines } = getDemoData();
    const currentItem = items.find((i) => i.id === id);
    if (!currentItem) return false;

    const bIdx = baselines.findIndex((b) => b.id === id);
    const updatedBaseline = {
      ...currentItem,
      audit_trail: [
        {
          timestamp: new Date().toISOString(),
          actor: actor || 'Demo User',
          reason: reason || 'Promoted to baseline in demo mode',
        },
        ...(currentItem.audit_trail || []),
      ].slice(0, 15),
    };

    if (bIdx >= 0) baselines[bIdx] = updatedBaseline;
    else baselines.push(updatedBaseline);

    localStorage.setItem(STORAGE_KEY_BASELINES, JSON.stringify(baselines));
    return true;
  } catch (e) {
    console.error('Error promoting demo item:', e);
    return false;
  }
};

// Delete single audit log entry in demo mode
export const deleteDemoAuditLog = (id: string, logIndex: number): boolean => {
  try {
    const { items } = getDemoData();
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) return false;
    const item = items[idx];
    if (!item.audit_trail || !item.audit_trail[logIndex]) return false;
    item.audit_trail.splice(logIndex, 1);
    localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(items));
    return true;
  } catch (e) {
    console.error('Error deleting audit log:', e);
    return false;
  }
};

// Clear all audit logs in demo mode
export const clearDemoAuditLogs = (id: string): boolean => {
  try {
    const { items } = getDemoData();
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) return false;
    items[idx].audit_trail = [];
    localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(items));
    return true;
  } catch (e) {
    console.error('Error clearing audit logs:', e);
    return false;
  }
};

// Save property in demo mode
export const saveDemoProperty = (payload: Partial<ProspectiveProperty>): ProspectiveProperty => {
  const props = getDemoProperties();
  const isEdit = Boolean(payload.id);

  if (isEdit) {
    const idx = props.findIndex((p) => p.id === payload.id);
    if (idx >= 0) {
      props[idx] = {
        ...props[idx],
        ...payload,
        updated_at: new Date().toISOString(),
      } as ProspectiveProperty;
      localStorage.setItem(STORAGE_KEY_PROPERTIES, JSON.stringify(props));
      return props[idx];
    }
  }

  const newProp: ProspectiveProperty = {
    id: `PROP-${String(props.length + 1).padStart(2, '0')}`,
    address: payload.address || 'New Demo Property, Brisbane, Qld',
    url: payload.url || '',
    guide_price: payload.guide_price || 1200000,
    bedrooms: payload.bedrooms || 4,
    bathrooms: payload.bathrooms || 2,
    car_spaces: payload.car_spaces || 2,
    status: payload.status || 'Priority',
    rating_alex: payload.rating_alex || 0,
    rating_jordan: payload.rating_jordan || 0,
    notes: payload.notes || 'Demo added property',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const nextProps = [newProp, ...props];
  localStorage.setItem(STORAGE_KEY_PROPERTIES, JSON.stringify(nextProps));
  return newProp;
};

// Delete property in demo mode
export const deleteDemoProperty = (id: string): boolean => {
  try {
    const props = getDemoProperties();
    const filtered = props.filter((p) => p.id !== id);
    localStorage.setItem(STORAGE_KEY_PROPERTIES, JSON.stringify(filtered));
    return true;
  } catch (e) {
    console.error('Error deleting demo property:', e);
    return false;
  }
};

// Reset demo dataset to initial dummy defaults
export const resetDemoStorage = (): void => {
  localStorage.removeItem(STORAGE_KEY_ITEMS);
  localStorage.removeItem(STORAGE_KEY_BASELINES);
  localStorage.removeItem(STORAGE_KEY_PROPERTIES);
  getDemoData();
  getDemoProperties();
};
