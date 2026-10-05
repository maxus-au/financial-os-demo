export type Cadence = 'Weekly' | 'Fortnightly' | 'Monthly' | 'Quarterly' | 'Semi-Annual' | 'Annual';

export interface DerivedMetrics {
    weekly: number;
    fortnightly: number;
    monthly: number;
    annual: number;
}

/**
 * Calculates derived temporal metrics from a native amount and its source cadence.
 * Employs strict Australian banking formulas to eliminate compounding rounding errors.
 */
export function calculateMetrics(amount: number, cadence: Cadence | string): DerivedMetrics {
    let weekly = 0;
    
    switch (cadence as Cadence) {
        case 'Weekly': 
            weekly = amount; 
            break;
        case 'Fortnightly': 
            weekly = amount / 2; 
            break;
        case 'Monthly': 
            weekly = (amount * 12) / 52; 
            break;
        case 'Quarterly': 
            weekly = (amount * 4) / 52; 
            break;
        case 'Semi-Annual': 
            weekly = (amount * 2) / 52; 
            break;
        case 'Annual': 
            weekly = amount / 52; 
            break;
        default: 
            weekly = 0;
    }

    return {
        weekly: weekly,
        fortnightly: weekly * 2,
        annual: weekly * 52,
        monthly: (weekly * 52) / 12
    };
}

/**
 * Standard AUD Currency Formatter
 */
export function formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD'
    }).format(value);
}
