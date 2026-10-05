import { useState, useEffect } from 'react';
import type { ProspectiveProperty, PropertyStatus } from '../types';
import { parsePropertySnippet, calculateRentalYield, formatPropertyAddress } from '../utils/propertyMath';
import { formatCurrency } from '../utils/financeMath';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  Sparkles,
  ExternalLink,
  Star,
  Check,
  X,
  Clock,
  Bed,
  Bath,
  Car,
  AlertCircle
} from 'lucide-react';

interface PropertyIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (property: Partial<ProspectiveProperty>) => Promise<boolean>;
  initialData?: ProspectiveProperty | null;
  sessionActor: string | null;
}

const STATUS_OPTIONS: { value: PropertyStatus; label: string; color: string }[] = [
  { value: 'Priority', label: 'Priority Shortlist', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  { value: 'Inspect', label: 'Open Home / Inspect', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  { value: 'Watching', label: 'Watching & Reviewing', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  { value: 'Pass', label: 'Passed / Ruled Out', color: 'bg-muted text-muted-foreground border-border' },
];

export default function PropertyIntakeModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  sessionActor,
}: PropertyIntakeModalProps) {
  const [pasteSnippet, setPasteSnippet] = useState('');
  const [address, setAddress] = useState('');
  const [url, setUrl] = useState('');
  const [guidePrice, setGuidePrice] = useState<string>('');
  const [rentWeekly, setRentWeekly] = useState<string>('');
  const [bedrooms, setBedrooms] = useState<string>('');
  const [bathrooms, setBathrooms] = useState<string>('');
  const [carSpaces, setCarSpaces] = useState<string>('');
  const [status, setStatus] = useState<PropertyStatus>('Priority');
  const [ratingAlex, setRatingAlex] = useState<number>(0);
  const [ratingJordan, setRatingJordan] = useState<number>(0);
  const [notes, setNotes] = useState('');
  
  const [extractSuccess, setExtractSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync state when editing or opening
  useEffect(() => {
    if (initialData) {
      setAddress(initialData.address || '');
      setUrl(initialData.url || '');
      setGuidePrice(initialData.guide_price ? initialData.guide_price.toString() : '');
      setRentWeekly(initialData.estimated_rent_weekly ? initialData.estimated_rent_weekly.toString() : '');
      setBedrooms(initialData.bedrooms ? initialData.bedrooms.toString() : '');
      setBathrooms(initialData.bathrooms ? initialData.bathrooms.toString() : '');
      setCarSpaces(initialData.car_spaces ? initialData.car_spaces.toString() : '');
      setStatus(initialData.status || 'Watching');
      setRatingAlex(initialData.rating_alex || 0);
      setRatingJordan(initialData.rating_jordan || 0);
      setNotes(initialData.notes || '');
      setPasteSnippet(initialData.source_snippet || '');
    } else {
      // Default reset
      setAddress('');
      setUrl('');
      setGuidePrice('');
      setRentWeekly('');
      setBedrooms('');
      setBathrooms('');
      setCarSpaces('');
      setStatus('Priority');
      setRatingAlex(0);
      setRatingJordan(0);
      setNotes('');
      setPasteSnippet('');
    }
    setExtractSuccess(null);
    setErrorMessage(null);
  }, [initialData, isOpen]);

  // Handle keyboard shortcuts (Esc dismiss, Ctrl+Enter submit)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        handleSubmit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, address, guidePrice, rentWeekly, bedrooms, bathrooms, carSpaces, status, ratingAlex, ratingJordan, notes]);

  const handleParseSnippet = (textToParse?: string) => {
    const raw = textToParse !== undefined ? textToParse : pasteSnippet;
    if (!raw.trim()) {
      setErrorMessage('Please paste WhatsApp text or a listing URL into the box first.');
      return;
    }

    const parsed = parsePropertySnippet(raw);
    const extractedItems: string[] = [];

    if (parsed.address) {
      setAddress(parsed.address);
      extractedItems.push('Address');
    }
    if (parsed.guide_price) {
      setGuidePrice(parsed.guide_price.toString());
      extractedItems.push(`Price (${formatCurrency(parsed.guide_price)})`);
    }
    if (parsed.url) {
      setUrl(parsed.url);
      extractedItems.push('Listing Link');
    }
    if (parsed.estimated_rent_weekly) {
      setRentWeekly(parsed.estimated_rent_weekly.toString());
      extractedItems.push(`Rent ($${parsed.estimated_rent_weekly}/wk)`);
    }
    if (parsed.bedrooms) {
      setBedrooms(parsed.bedrooms.toString());
      extractedItems.push(`${parsed.bedrooms} Bed`);
    }
    if (parsed.bathrooms) {
      setBathrooms(parsed.bathrooms.toString());
      extractedItems.push(`${parsed.bathrooms} Bath`);
    }
    if (parsed.car_spaces) {
      setCarSpaces(parsed.car_spaces.toString());
      extractedItems.push(`${parsed.car_spaces} Car`);
    }

    // Default actor rating to 4 stars on intake if none set
    if (sessionActor === 'Jordan' && ratingJordan === 0) {
      setRatingJordan(4);
    } else if (sessionActor === 'Alex' && ratingAlex === 0) {
      setRatingAlex(4);
    }

    if (extractedItems.length > 0) {
      setExtractSuccess(`Smart Extractor captured: ${extractedItems.join(' • ')}`);
      setErrorMessage(null);
    } else {
      setErrorMessage('Could not extract structured data automatically. Please review manually.');
    }
  };

  const handlePasteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setPasteSnippet(text);
    // Auto-parse on paste if significant length
    if (text.length > 25 && (!address || !guidePrice)) {
      handleParseSnippet(text);
    }
  };

  const handleSubmit = async () => {
    if (!address.trim()) {
      setErrorMessage('Please enter an address or property headline.');
      return;
    }

    const priceNum = parseFloat(guidePrice.replace(/[^0-9.]/g, ''));
    if (isNaN(priceNum) || priceNum <= 0) {
      setErrorMessage('Please specify a valid guide price (e.g. 1150000).');
      return;
    }

    const rentNum = rentWeekly ? parseFloat(rentWeekly.replace(/[^0-9.]/g, '')) : undefined;
    const bedsNum = bedrooms ? parseInt(bedrooms, 10) : undefined;
    const bathsNum = bathrooms ? parseInt(bathrooms, 10) : undefined;
    const carsNum = carSpaces ? parseInt(carSpaces, 10) : undefined;

    const payload: Partial<ProspectiveProperty> = {
      address: address.trim(),
      url: url.trim() || undefined,
      guide_price: priceNum,
      estimated_rent_weekly: rentNum && !isNaN(rentNum) ? rentNum : undefined,
      bedrooms: bedsNum && !isNaN(bedsNum) ? bedsNum : undefined,
      bathrooms: bathsNum && !isNaN(bathsNum) ? bathsNum : undefined,
      car_spaces: carsNum && !isNaN(carsNum) ? carsNum : undefined,
      status,
      rating_alex: ratingAlex,
      rating_jordan: ratingJordan,
      notes: notes.trim() || undefined,
      source_snippet: pasteSnippet.trim() || undefined,
    };

    if (initialData?.id) {
      payload.id = initialData.id;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const success = await onSave(payload);
      if (success) {
        onClose();
      } else {
        setErrorMessage('Failed to save property to server. Please try again.');
      }
    } catch (err) {
      setErrorMessage('Network or server error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const parsedPrice = parseFloat(guidePrice.replace(/[^0-9.]/g, '')) || 0;
  const parsedRent = parseFloat(rentWeekly.replace(/[^0-9.]/g, '')) || 0;
  const grossYield = calculateRentalYield(parsedPrice, parsedRent);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-card border border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[92vh] text-card-foreground ring-1 ring-border/50"
        role="dialog"
        aria-modal="true"
        aria-labelledby="intake-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 dark:text-emerald-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 id="intake-title" className="text-base font-bold text-foreground flex items-center gap-2">
                {initialData ? 'Edit Prospective Property' : 'WhatsApp & Listing Fast-Capture Intake'}
                {sessionActor && (
                  <Badge variant="outline" className="text-[10px] font-medium border-border text-muted-foreground">
                    Actor: {sessionActor}
                  </Badge>
                )}
              </h3>
              <p className="text-xs text-muted-foreground">
                Triage homes from WhatsApp or listing links into your persistent vault.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Quick-Paste Dropzone */}
          <div className="p-4 rounded-xl bg-muted/40 border border-border/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                1-Click Quick-Paste Dropzone (WhatsApp message or Listing link)
              </label>
              {pasteSnippet && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleParseSnippet()}
                  className="h-6 text-[11px] px-2 text-emerald-500 dark:text-emerald-400 hover:text-emerald-600 hover:bg-emerald-500/10 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 mr-1" /> Re-parse
                </Button>
              )}
            </div>
            
            <textarea
              value={pasteSnippet}
              onChange={handlePasteChange}
              placeholder="Paste raw WhatsApp text or listing URL here...
Example: 'Hey babe check this out: https://www.realestate.com.au/... 14 Oceanic Vista, Mermaid Waters. Guide $1.25m, 4 bed 2 bath 2 car. Rent ~$1050/wk. Inspection Sat 10am'"
              rows={2}
              className="w-full text-xs font-sans p-2.5 rounded-lg bg-background border border-border focus:outline-hidden focus:ring-2 focus:ring-emerald-500/40 text-foreground placeholder:text-muted-foreground resize-none transition-all"
            />

            {extractSuccess && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 font-mono">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{extractSuccess}</span>
              </div>
            )}
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            {/* Address */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Property Address / Suburb Headline <span className="text-rose-500">*</span>
                </label>
                {address && (
                  <span className="text-[11px] font-mono text-emerald-500 dark:text-emerald-400">
                    Target: <strong>{formatPropertyAddress(address).suburb}</strong>
                  </span>
                )}
              </div>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 14 Oceanic Vista, Mermaid Waters"
                className="bg-background border-border text-foreground text-sm font-medium"
              />
              {address && formatPropertyAddress(address).street && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Card Headline: <strong className="text-foreground">{formatPropertyAddress(address).suburb}</strong> • Street: {formatPropertyAddress(address).street}
                </p>
              )}
            </div>

            {/* Price & Rent Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1.5">
                  Guide Price ($ AUD) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    value={guidePrice}
                    onChange={(e) => setGuidePrice(e.target.value)}
                    placeholder="e.g. 1250000"
                    className="bg-background border-border text-foreground font-mono"
                  />
                  {parsedPrice > 0 && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-emerald-500 dark:text-emerald-400 font-semibold pointer-events-none">
                      {formatCurrency(parsedPrice)}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-foreground block">
                    Estimated Rent ($ / week)
                  </label>
                  {grossYield !== null && (
                    <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-500 dark:text-emerald-400 bg-emerald-500/10">
                      {grossYield.toFixed(2)}% Gross Yield
                    </Badge>
                  )}
                </div>
                <Input
                  type="number"
                  value={rentWeekly}
                  onChange={(e) => setRentWeekly(e.target.value)}
                  placeholder="e.g. 1050"
                  className="bg-background border-border text-foreground font-mono"
                />
              </div>
            </div>

            {/* Listing URL */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-foreground block">
                  Listing Link (RealEstate.com.au / Domain / etc.)
                </label>
                {url && (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-blue-500 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium"
                  >
                    Test Link <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.realestate.com.au/property-..."
                className="bg-background border-border text-foreground text-xs font-mono"
              />
            </div>

            {/* Property Specs (Beds, Baths, Cars) */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1 flex items-center gap-1">
                  <Bed className="w-3.5 h-3.5" /> Bedrooms
                </label>
                <Input
                  type="number"
                  min="0"
                  max="20"
                  value={bedrooms}
                  onChange={(e) => setBedrooms(e.target.value)}
                  placeholder="e.g. 4"
                  className="bg-background border-border text-foreground font-mono text-center"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1 flex items-center gap-1">
                  <Bath className="w-3.5 h-3.5" /> Bathrooms
                </label>
                <Input
                  type="number"
                  min="0"
                  max="10"
                  value={bathrooms}
                  onChange={(e) => setBathrooms(e.target.value)}
                  placeholder="e.g. 2"
                  className="bg-background border-border text-foreground font-mono text-center"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1 flex items-center gap-1">
                  <Car className="w-3.5 h-3.5" /> Car Spaces
                </label>
                <Input
                  type="number"
                  min="0"
                  max="10"
                  value={carSpaces}
                  onChange={(e) => setCarSpaces(e.target.value)}
                  placeholder="e.g. 2"
                  className="bg-background border-border text-foreground font-mono text-center"
                />
              </div>
            </div>

            {/* Status Selection */}
            <div>
              <label className="text-xs font-semibold text-foreground block mb-2">
                Triage Status
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStatus(opt.value)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer ${
                      status === opt.value
                        ? `${opt.color} ring-2 ring-primary/30 shadow-xs font-semibold`
                        : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Ratings: Alex & Jordan */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 rounded-xl bg-muted/30 border border-border">
              {/* Alex Rating */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Alex's Rating
                  </span>
                  <span className="text-xs font-mono font-bold text-foreground">
                    {ratingAlex > 0 ? `${ratingAlex} / 5` : 'Unrated'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRatingAlex(ratingAlex === star ? 0 : star)}
                      className="p-1 text-muted-foreground hover:text-amber-400 transition-colors cursor-pointer"
                      title={`${star} Star`}
                    >
                      <Star
                        className={`w-5 h-5 ${
                          star <= ratingAlex
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-muted-foreground/40'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Jordan Rating */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    Jordan's Rating
                  </span>
                  <span className="text-xs font-mono font-bold text-foreground">
                    {ratingJordan > 0 ? `${ratingJordan} / 5` : 'Unrated'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRatingJordan(ratingJordan === star ? 0 : star)}
                      className="p-1 text-muted-foreground hover:text-rose-400 transition-colors cursor-pointer"
                      title={`${star} Star`}
                    >
                      <Star
                        className={`w-5 h-5 ${
                          star <= ratingJordan
                            ? 'text-rose-400 fill-rose-400'
                            : 'text-muted-foreground/40'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Notes & Inspection Schedule */}
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                Notes, Inspection Time & Pros/Cons
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Open Home Saturday 10:00 AM. Great block size, kitchen renovated, close to transport..."
                rows={2}
                className="w-full text-xs font-sans p-2.5 rounded-lg bg-background border border-border focus:outline-hidden focus:ring-2 focus:ring-emerald-500/40 text-foreground placeholder:text-muted-foreground resize-none"
              />
            </div>
          </div>

          {errorMessage && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/30">
          <span className="text-[11px] text-muted-foreground hidden sm:inline">
            Tip: Press <kbd className="px-1.5 py-0.5 rounded-md bg-muted border border-border font-mono text-[10px]">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 rounded-md bg-muted border border-border font-mono text-[10px]">Enter</kbd> to save
          </span>
          <div className="flex items-center gap-2.5 ml-auto">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md shadow-emerald-500/20 cursor-pointer"
            >
              {isSubmitting ? 'Saving...' : initialData ? 'Update Property' : 'Save to Vault'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
