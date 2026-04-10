import { useState, useRef, useEffect } from 'react';
import { X, ChevronDown, Check } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
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
  const [localMin, setLocalMin] = useState(() => minPrice === '' ? 0 : priceToSlider(minPrice as number));
  const [localMax, setLocalMax] = useState(() => maxPrice === '' ? SLIDER_MAX : priceToSlider(maxPrice as number));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  return (
    <div className="px-1 py-2">
      <div className="flex items-center justify-between mb-4 text-[11px] text-[#a3a3a3]">
        <span>{localMin <= 0 ? 'Any' : fmtPriceLabel(sliderToPrice(localMin))}</span>
        <span className="text-[#525252]">—</span>
        <span>{localMax >= SLIDER_MAX ? 'Any' : fmtPriceLabel(sliderToPrice(localMax))}</span>
      </div>
      <div className="relative h-5 flex items-center">
        <div className="absolute inset-x-0 h-[2px] rounded-full bg-white/[0.08]" />
        <div
          className="absolute h-[2px] rounded-full bg-[#14b8a6]"
          style={{ left: `${minPct}%`, right: `${100 - maxPct}%` }}
        />
        <input type="range" min={0} max={SLIDER_MAX} step={1} value={localMin}
          onChange={e => { const v = Math.min(Number(e.target.value), localMax - 10); setLocalMin(v); commitMin(v); }}
          onPointerUp={e => (e.currentTarget as HTMLInputElement).blur()}
          className="price-range-input" style={{ zIndex: localMin > SLIDER_MAX - 50 ? 5 : 3 }} />
        <input type="range" min={0} max={SLIDER_MAX} step={1} value={localMax}
          onChange={e => { const v = Math.max(Number(e.target.value), localMin + 10); setLocalMax(v); commitMax(v); }}
          onPointerUp={e => (e.currentTarget as HTMLInputElement).blur()}
          className="price-range-input" style={{ zIndex: localMax < 50 ? 5 : 4 }} />
      </div>
    </div>
  );
}

const PROPERTY_TYPES = [
  { value: '', label: 'All' },
  { value: 'land', label: 'Land' },
  { value: 'house', label: 'Houses' },
  { value: 'apartment', label: 'Apartments' },
  { value: 'commercial', label: 'Commercial' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
];

const LISTING_TYPES = [
  { value: '', label: 'Any' },
  { value: 'sale', label: 'Sale' },
  { value: 'rent', label: 'Rent' },
];

interface SelectOption { value: string; label: string }

function MinimalSelect({
  options, value, onChange, prefix,
}: {
  options: SelectOption[];
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
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
  const isActive = selected && selected.value !== '';
  const displayLabel = prefix
    ? `${prefix}${isActive ? ` ${selected?.label}` : ''}`
    : (selected?.label ?? options[0]?.label);

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1 text-[13px] font-medium transition-colors cursor-pointer bg-transparent border-none p-0 ${
          isActive ? 'text-white' : 'text-[#525252] hover:text-[#a3a3a3]'
        }`}
      >
        {displayLabel}
        <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.13, ease: [0.22, 1, 0.36, 1] }}
            className="absolute z-50 mt-2 left-0 min-w-[160px] bg-[#111111] border border-white/[0.1] rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.55)] overflow-hidden"
          >
            {options.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`relative w-full flex items-center justify-between gap-2 px-4 py-2.5 text-[13px] text-left transition-colors cursor-pointer bg-transparent border-none ${
                  opt.value === value
                    ? 'text-[#14b8a6]'
                    : 'text-[#525252] hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <span>{opt.label}</span>
                {opt.value === value && opt.value !== '' && (
                  <Check className="w-3 h-3 flex-shrink-0 text-[#14b8a6]" />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PriceDropdown({ minPrice, maxPrice, onMinPriceChange, onMaxPriceChange }: {
  minPrice: number | '';
  maxPrice: number | '';
  onMinPriceChange: (p: number | '') => void;
  onMaxPriceChange: (p: number | '') => void;
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

  const isActive = minPrice !== '' || maxPrice !== '';
  const label = isActive
    ? `${minPrice !== '' ? fmtPriceLabel(minPrice as number) : 'Any'} — ${maxPrice !== '' ? fmtPriceLabel(maxPrice as number) : 'Any'}`
    : 'Price';

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1 text-[13px] font-medium transition-colors cursor-pointer bg-transparent border-none p-0 ${
          isActive ? 'text-white' : 'text-[#525252] hover:text-[#a3a3a3]'
        }`}
      >
        {label}
        <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.13, ease: [0.22, 1, 0.36, 1] }}
            className="absolute z-50 mt-2 left-0 w-64 bg-[#111111] border border-white/[0.1] rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.55)] p-4"
          >
            <PriceRangeSlider
              minPrice={minPrice}
              maxPrice={maxPrice}
              onMinPriceChange={onMinPriceChange}
              onMaxPriceChange={onMaxPriceChange}
            />
          </motion.div>
        )}
      </AnimatePresence>
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
  districts, selectedDistrict, onDistrictChange,
  selectedType, onTypeChange, listingType, onListingTypeChange,
  minPrice, onMinPriceChange, maxPrice, onMaxPriceChange,
  sortBy, onSortChange, totalResults,
}: Props) {
  const hasFilters = selectedDistrict || selectedType || listingType || minPrice !== '' || maxPrice !== '';

  const districtOptions: SelectOption[] = [
    { value: '', label: 'All Districts' },
    ...districts.map(d => ({ value: d.district, label: `${d.district} (${d.count})` })),
  ];

  const clearAll = () => {
    onDistrictChange(''); onTypeChange(''); onListingTypeChange('');
    onMinPriceChange(''); onMaxPriceChange('');
  };

  return (
    <div className="mb-8">
      {/* ---- Horizontal filter bar ---- */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 flex-wrap sm:flex-nowrap">

        {/* Type pills */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {PROPERTY_TYPES.map(opt => (
            <button
              key={opt.value}
              onClick={() => onTypeChange(opt.value)}
              className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors cursor-pointer border-none ${
                selectedType === opt.value
                  ? 'bg-white text-black'
                  : 'bg-transparent text-[#525252] hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Separator */}
        <div className="w-px h-4 bg-white/[0.1] flex-shrink-0 mx-1" />

        {/* Listing type toggle */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {LISTING_TYPES.filter(t => t.value !== '').map(opt => (
            <button
              key={opt.value}
              onClick={() => onListingTypeChange(listingType === opt.value ? '' : opt.value)}
              className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors cursor-pointer border-none ${
                listingType === opt.value
                  ? 'bg-white text-black'
                  : 'bg-transparent text-[#525252] hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Separator */}
        <div className="w-px h-4 bg-white/[0.1] flex-shrink-0 mx-1" />

        {/* District dropdown */}
        <MinimalSelect
          options={districtOptions}
          value={selectedDistrict}
          onChange={onDistrictChange}
          prefix="District"
        />

        {/* Price range */}
        <PriceDropdown
          minPrice={minPrice}
          maxPrice={maxPrice}
          onMinPriceChange={onMinPriceChange}
          onMaxPriceChange={onMaxPriceChange}
        />

        {/* Sort */}
        <MinimalSelect
          options={SORT_OPTIONS}
          value={sortBy}
          onChange={onSortChange}
        />

        {/* Separator */}
        <div className="w-px h-4 bg-white/[0.1] flex-shrink-0 mx-1" />

        {/* Results count */}
        <span className="text-[11px] text-[#525252] whitespace-nowrap flex-shrink-0 num">
          {totalResults.toLocaleString()} listings
        </span>

        {/* Clear */}
        {hasFilters && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1 text-[11px] text-[#14b8a6] whitespace-nowrap flex-shrink-0 cursor-pointer bg-transparent border-none p-0 hover:text-[#5eead4] transition-colors"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>
    </div>
  );
}
