import { useState, useRef, useEffect } from 'react';
import { SlidersHorizontal, X, ChevronDown, Check } from 'lucide-react';
import type { District } from '../api';

// ---- Price range slider (log scale: 100K – 500M LKR) ----
const SLIDER_MAX = 1000;
const P_MIN = 100_000;
const P_MAX = 500_000_000;
const LOG_MIN = Math.log(P_MIN);
const LOG_MAX = Math.log(P_MAX);

function sliderToPrice(v: number): number {
  if (v <= 0) return 0;
  if (v >= SLIDER_MAX) return P_MAX;
  return Math.round(Math.exp(LOG_MIN + (v / SLIDER_MAX) * (LOG_MAX - LOG_MIN)));
}

function priceToSlider(p: number): number {
  if (!p || p < P_MIN) return 0;
  if (p >= P_MAX) return SLIDER_MAX;
  return Math.round(((Math.log(p) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * SLIDER_MAX);
}

function fmtPriceLabel(p: number): string {
  if (p >= 1_000_000) return `Rs ${(p / 1_000_000 % 1 === 0 ? (p / 1_000_000).toFixed(0) : (p / 1_000_000).toFixed(1))}M`;
  if (p >= 1_000) return `Rs ${(p / 1_000).toFixed(0)}K`;
  return `Rs ${p}`;
}

function PriceRangeSlider({ minPrice, maxPrice, onMinPriceChange, onMaxPriceChange }: {
  minPrice: number | '';
  maxPrice: number | '';
  onMinPriceChange: (p: number | '') => void;
  onMaxPriceChange: (p: number | '') => void;
}) {
  // Local state for immediate visual feedback while dragging
  const [localMin, setLocalMin] = useState(() => minPrice === '' ? 0 : priceToSlider(minPrice as number));
  const [localMax, setLocalMax] = useState(() => maxPrice === '' ? SLIDER_MAX : priceToSlider(maxPrice as number));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync when parent resets (e.g. "Clear filters")
  useEffect(() => { if (minPrice === '') setLocalMin(0); }, [minPrice]);
  useEffect(() => { if (maxPrice === '') setLocalMax(SLIDER_MAX); }, [maxPrice]);

  const commitMin = (v: number) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onMinPriceChange(v <= 0 ? '' : sliderToPrice(v)), 400);
  };
  const commitMax = (v: number) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onMaxPriceChange(v >= SLIDER_MAX ? '' : sliderToPrice(v)), 400);
  };

  const minPct = (localMin / SLIDER_MAX) * 100;
  const maxPct = (localMax / SLIDER_MAX) * 100;
  const isActive = minPrice !== '' || maxPrice !== '';
  const isDragging = (localMin !== (minPrice === '' ? 0 : priceToSlider(minPrice as number)))
                  || (localMax !== (maxPrice === '' ? SLIDER_MAX : priceToSlider(maxPrice as number)));

  const displayMin = localMin <= 0 ? 'Any' : fmtPriceLabel(sliderToPrice(localMin));
  const displayMax = localMax >= SLIDER_MAX ? 'Any' : fmtPriceLabel(sliderToPrice(localMax));

  return (
    <div className={`col-span-2 rounded-xl border px-3 py-2.5 transition-all flex items-center gap-3 ${
      isActive || isDragging ? 'border-accent/40 bg-accent/10' : 'border-border bg-bg-card'
    }`}>
      <span className={`text-sm font-medium whitespace-nowrap flex-shrink-0 ${isActive || isDragging ? 'text-accent-light' : 'text-text-secondary'}`}>
        {(isActive || isDragging) ? `${displayMin} — ${displayMax}` : 'Price Range'}
      </span>

      <div className="relative flex-1 h-5 flex items-center">
        {/* Background track */}
        <div className="absolute inset-x-0 h-[3px] rounded-full bg-border" />
        {/* Filled range */}
        <div
          className="absolute h-[3px] rounded-full bg-accent"
          style={{ left: `${minPct}%`, right: `${100 - maxPct}%` }}
        />
        {/* Min thumb */}
        <input
          type="range"
          min={0} max={SLIDER_MAX} step={1}
          value={localMin}
          onChange={e => {
            const v = Math.min(Number(e.target.value), localMax - 10);
            setLocalMin(v);
            commitMin(v);
          }}
          onPointerUp={e => (e.currentTarget as HTMLInputElement).blur()}
          onKeyUp={e => {
            if (e.key === 'Enter' || e.key === 'Escape') (e.currentTarget as HTMLInputElement).blur();
          }}
          className="price-range-input"
          style={{ zIndex: localMin > SLIDER_MAX - 50 ? 5 : 3 }}
        />
        {/* Max thumb */}
        <input
          type="range"
          min={0} max={SLIDER_MAX} step={1}
          value={localMax}
          onChange={e => {
            const v = Math.max(Number(e.target.value), localMin + 10);
            setLocalMax(v);
            commitMax(v);
          }}
          onPointerUp={e => (e.currentTarget as HTMLInputElement).blur()}
          onKeyUp={e => {
            if (e.key === 'Enter' || e.key === 'Escape') (e.currentTarget as HTMLInputElement).blur();
          }}
          className="price-range-input"
          style={{ zIndex: localMax < 50 ? 5 : 4 }}
        />
      </div>
    </div>
  );
}

const PROPERTY_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'land', label: 'Land' },
  { value: 'house', label: 'Houses' },
  { value: 'apartment', label: 'Apartments' },
  { value: 'commercial', label: 'Commercial' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'price_asc', label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
];

const LISTING_TYPES = [
  { value: '', label: 'Any Status' },
  { value: 'sale', label: 'For Sale' },
  { value: 'rent', label: 'For Rent' },
];

interface SelectOption { value: string; label: string }

function CustomSelect({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: SelectOption[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find(o => o.value === value);
  const label = selected?.value !== '' ? selected?.label : (placeholder ?? options[0]?.label);
  const isActive = selected && selected.value !== '';

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border transition-all cursor-pointer
          ${isActive
            ? 'bg-accent/10 border-accent/40 text-accent-light'
            : 'bg-bg-card border-border text-text-secondary hover:border-border-hover hover:text-text-primary'
          }`}
      >
        <span className="truncate">{label}</span>
        <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full min-w-[160px] bg-[#1a1a2e] border border-border rounded-xl shadow-2xl overflow-hidden">
          <div className="max-h-56 overflow-y-auto py-1">
            {options.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left transition-colors cursor-pointer
                  ${opt.value === value
                    ? 'text-accent-light bg-accent/10'
                    : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                  }`}
              >
                <span className="truncate">{opt.label}</span>
                {opt.value === value && opt.value !== '' && (
                  <Check className="w-3 h-3 flex-shrink-0 text-accent-light" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface Props {
  districts: District[];
  selectedDistrict: string;
  onDistrictChange: (d: string) => void;
  selectedType: string;
  onTypeChange: (t: string) => void;
  listingType: string;
  onListingTypeChange: (t: string) => void;
  minPrice: number | '';
  onMinPriceChange: (p: number | '') => void;
  maxPrice: number | '';
  onMaxPriceChange: (p: number | '') => void;
  sortBy: string;
  onSortChange: (s: string) => void;
  totalResults: number;
}

export function Filters({
  districts,
  selectedDistrict,
  onDistrictChange,
  selectedType,
  onTypeChange,
  listingType,
  onListingTypeChange,
  minPrice,
  onMinPriceChange,
  maxPrice,
  onMaxPriceChange,
  sortBy,
  onSortChange,
  totalResults,
}: Props) {
  const hasFilters = selectedDistrict || selectedType || listingType || minPrice !== '' || maxPrice !== '';

  const districtOptions: SelectOption[] = [
    { value: '', label: 'All Districts' },
    ...districts.map(d => ({ value: d.district, label: `${d.district} (${d.count})` })),
  ];

  return (
    <div className="mb-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-accent-light" />
          <h3 className="text-lg font-bold">Browse Listings</h3>
          <span className="text-xs text-text-muted ml-1">
            {totalResults.toLocaleString()} results
          </span>
        </div>
        {hasFilters && (
          <button
            onClick={() => {
              onDistrictChange('');
              onTypeChange('');
              onListingTypeChange('');
              onMinPriceChange('');
              onMaxPriceChange('');
            }}
            className="flex items-center gap-1 text-xs text-danger hover:text-danger/80 transition-colors bg-transparent border-none cursor-pointer"
          >
            <X className="w-3 h-3" /> Clear filters
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <CustomSelect options={districtOptions} value={selectedDistrict} onChange={onDistrictChange} placeholder="All Districts" />
        <CustomSelect options={PROPERTY_TYPES} value={selectedType} onChange={onTypeChange} placeholder="All Types" />
        <CustomSelect options={LISTING_TYPES} value={listingType} onChange={onListingTypeChange} placeholder="Any Status" />

        <PriceRangeSlider
          minPrice={minPrice}
          maxPrice={maxPrice}
          onMinPriceChange={onMinPriceChange}
          onMaxPriceChange={onMaxPriceChange}
        />

        <CustomSelect options={SORT_OPTIONS} value={sortBy} onChange={onSortChange} />
      </div>

      {hasFilters && (
        <div className="flex flex-wrap gap-2 mt-3">
          {selectedDistrict && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-accent/15 text-accent-light border border-accent/25">
              {selectedDistrict}
              <button onClick={() => onDistrictChange('')} className="hover:text-white ml-0.5 bg-transparent border-none cursor-pointer text-accent-light">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {selectedType && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-accent/15 text-accent-light border border-accent/25">
              {PROPERTY_TYPES.find(p => p.value === selectedType)?.label || selectedType}
              <button onClick={() => onTypeChange('')} className="hover:text-white ml-0.5 bg-transparent border-none cursor-pointer text-accent-light">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {listingType && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-accent/15 text-accent-light border border-accent/25">
              {LISTING_TYPES.find(p => p.value === listingType)?.label || listingType}
              <button onClick={() => onListingTypeChange('')} className="hover:text-white ml-0.5 bg-transparent border-none cursor-pointer text-accent-light">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {minPrice !== '' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-accent/15 text-accent-light border border-accent/25">
              Min: Rs {minPrice.toLocaleString()}
              <button onClick={() => onMinPriceChange('')} className="hover:text-white ml-0.5 bg-transparent border-none cursor-pointer text-accent-light">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {maxPrice !== '' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-accent/15 text-accent-light border border-accent/25">
              Max: Rs {maxPrice.toLocaleString()}
              <button onClick={() => onMaxPriceChange('')} className="hover:text-white ml-0.5 bg-transparent border-none cursor-pointer text-accent-light">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
