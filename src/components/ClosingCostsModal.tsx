import { useEffect } from 'react';
import { formatCurrency } from '../utils/financeMath';
import { getDetailedClosingCosts, formatPropertyAddress } from '../utils/propertyMath';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  X,
  ShieldCheck,
  Building,
  Scale,
  Search,
  Droplets,
  CheckCircle2
} from 'lucide-react';

interface ClosingCostsModalProps {
  isOpen: boolean;
  onClose: () => void;
  price: number;
  propertyAddress?: string;
}

export default function ClosingCostsModal({
  isOpen,
  onClose,
  price,
  propertyAddress,
}: ClosingCostsModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const costs = getDetailedClosingCosts(price);
  const addressInfo = propertyAddress ? formatPropertyAddress(propertyAddress) : null;

  const items = [
    {
      title: 'QLD Government Transfer Duty (Stamp Duty)',
      amount: costs.qldTransferDuty,
      icon: <Scale className="w-4 h-4 text-emerald-500" />,
      category: 'Statutory Tax',
      badgeClass: 'bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 border-emerald-500/30',
      description: 'Statutory Queensland home transfer duty calculated against the standard residential tier schedule for primary owner-occupiers.',
    },
    {
      title: 'Professional Legal & Conveyancing',
      amount: costs.conveyancingLegal,
      icon: <FileText className="w-4 h-4 text-blue-500" />,
      category: 'Legal Representation',
      badgeClass: 'bg-blue-500/15 text-blue-500 dark:text-blue-400 border-blue-500/30',
      description: 'Comprehensive contract legal review, title searches, settlement booking via PEXA, trust accounting, and vendor check.',
    },
    {
      title: 'Pre-Purchase Building & Pest Inspection',
      amount: costs.buildingAndPest,
      icon: <Search className="w-4 h-4 text-amber-500" />,
      category: 'Due Diligence',
      badgeClass: 'bg-amber-500/15 text-amber-500 dark:text-amber-400 border-amber-500/30',
      description: 'Licensed professional building inspector report with thermal imaging, moisture meter check, structural defects, and termite inspection.',
    },
    {
      title: 'Land Titles Registry & Mortgage Lodgement',
      amount: costs.statutoryRegistration,
      icon: <Building className="w-4 h-4 text-indigo-500" />,
      category: 'Statutory Registry',
      badgeClass: 'bg-indigo-500/15 text-indigo-500 dark:text-indigo-400 border-indigo-500/30',
      description: 'Statutory QLD Titles Registry fee for lodging the property title transfer plus bank mortgage registration deed.',
    },
    {
      title: 'Council Rates & Water Settlement Adjustments',
      amount: costs.settlementAdjustments,
      icon: <Droplets className="w-4 h-4 text-cyan-500" />,
      category: 'Pro-Rata Adjustment',
      badgeClass: 'bg-cyan-500/15 text-cyan-500 dark:text-cyan-400 border-cyan-500/30',
      description: 'Standard pro-rata adjustments payable to vendor for pre-paid Metro City City Council rates and bulk water access at settlement day.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Strip */}
        <div className="p-5 border-b border-border bg-muted/30 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 dark:text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-foreground">
                Itemized QLD Closing Costs Breakdown
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
              {addressInfo ? (
                <>
                  <span className="font-semibold text-foreground">
                    {addressInfo.suburb}
                  </span>
                  {addressInfo.street && <span>• {addressInfo.street}</span>}
                  <span>•</span>
                </>
              ) : null}
              <span>Purchase Price:</span>
              <strong className="text-foreground font-mono text-xs">{formatCurrency(price)}</strong>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Hero Total Card */}
          <div className="p-4 rounded-xl bg-muted/40 border border-border flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Total Statutory & Closing Cash Needed
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold font-mono text-foreground mt-0.5">
                {formatCurrency(costs.totalClosingCosts)}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Must be funded in liquid cash on or before settlement day.
              </div>
            </div>

            <Badge variant="outline" className="border-emerald-500/30 text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 font-mono text-xs py-1 px-2.5">
              {((costs.totalClosingCosts / price) * 100).toFixed(2)}% of purchase price
            </Badge>
          </div>

          {/* Itemized Line Items List */}
          <div className="space-y-2.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1">
              Statutory Fees & Due Diligence Schedule
            </div>

            {items.map((item, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-card border border-border/80 hover:border-border transition-colors space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {item.icon}
                    <span className="font-semibold text-foreground text-xs">
                      {item.title}
                    </span>
                    <Badge variant="outline" className={`text-[10px] font-mono py-0 px-1.5 ${item.badgeClass}`}>
                      {item.category}
                    </Badge>
                  </div>

                  <span className="font-mono font-bold text-sm text-foreground">
                    {formatCurrency(item.amount)}
                  </span>
                </div>

                <p className="text-[11px] text-muted-foreground leading-relaxed pl-6">
                  {item.description}
                </p>
              </div>
            ))}
          </div>

          {/* Transparent Explanatory Notice */}
          <div className="p-3.5 rounded-xl bg-muted/20 border border-border/60 text-muted-foreground space-y-1.5 text-[11px]">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Calibrated Settlement Standards</span>
            </div>
            <p className="leading-relaxed">
              • <strong>QLD Residential Transfer Duty</strong> is non-negotiable statutory tax payable before title registration.<br />
              • Bank mortgage application fees and loan settlement fees are assumed waived on standard residential packages.<br />
              • Physical removalist and moving costs are excluded and should be absorbed by personal reserves.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            Press <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono text-[10px] border border-border">Esc</kbd> to close
          </span>
          <Button
            onClick={onClose}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold h-8 px-4 rounded-xl cursor-pointer"
          >
            Got It
          </Button>
        </div>
      </div>
    </div>
  );
}
