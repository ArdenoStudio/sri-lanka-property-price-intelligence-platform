import { useState, useRef, useEffect } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { District } from '../api';

// ─────────────────────────────────────────────────────────────────────────────
// Price slider  (log scale: 100K – 500M LKR)
// ─────────────────────────────────────────────────────────────────────────────
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
  if (p >= 1_000_000) return `Rs ${p / 1_000_000 % 1 === 0 ? (p / 1_000_000).toFixed(0) : (p / 1_000_000).toFixed(1)}M`;
  if (p >= 1_000) return `Rs ${(p / 1_000).toFixed(0)}K`;
  return `Rs ${p}`;
}

function PriceRangeSlider({ minPrice, maxPrice, onMinPriceChange, onMaxPriceChange }: {
  minPrice: number | ''; maxPrice: number | '';
  onMinPriceChange: (p: number | '') => void; onMaxPriceChange: (p: number | '') => void;
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
        <span className="text-[#737373]">—</span>
        <span>{localMax >= SLIDER_MAX ? 'Any' : fmtPriceLabel(sliderToPrice(localMax))}</span>
      </div>
      <div className="relative h-8 flex items-center">
        <div className="absolute inset-x-0 h-[2px] rounded-full bg-white/[0.08]" />
        <div className="absolute h-[2px] rounded-full bg-[#14b8a6]"
          style={{ left: `${minPct}%`, right: `${100 - maxPct}%` }} />
        <input type="range" min={0} max={SLIDER_MAX} step={1} value={localMin}
          aria-label="Minimum price"
          onChange={e => { const v = Math.min(Number(e.target.value), localMax - 10); setLocalMin(v); commitMin(v); }}
          onPointerUp={e => (e.currentTarget as HTMLInputElement).blur()}
          className="price-range-input" style={{ zIndex: localMin > SLIDER_MAX - 50 ? 5 : 3 }} />
        <input type="range" min={0} max={SLIDER_MAX} step={1} value={localMax}
          aria-label="Maximum price"
          onChange={e => { const v = Math.max(Number(e.target.value), localMin + 10); setLocalMax(v); commitMax(v); }}
          onPointerUp={e => (e.currentTarget as HTMLInputElement).blur()}
          className="price-range-input" style={{ zIndex: localMax < 50 ? 5 : 4 }} />
      </div>
    </div>
  );
}

function PriceDropdown({ minPrice, maxPrice, onMinPriceChange, onMaxPriceChange }: {
  minPrice: number | ''; maxPrice: number | '';
  onMinPriceChange: (p: number | '') => void; onMaxPriceChange: (p: number | '') => void;
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
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1 text-[13px] font-medium transition-colors cursor-pointer bg-transparent border-none p-0 ${
          isActive ? 'text-white' : 'text-[#525252] hover:text-[#a3a3a3]'
        }`}>
        {label}
        <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }} transition={{ duration: 0.13, ease: [0.22, 1, 0.36, 1] }}
            className="absolute z-50 mt-2 left-0 w-64 bg-[#111111] border border-white/[0.1] rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.55)] p-4">
            <PriceRangeSlider minPrice={minPrice} maxPrice={maxPrice}
              onMinPriceChange={onMinPriceChange} onMaxPriceChange={onMaxPriceChange} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Size slider  (perches 0–200  |  sqft 0–10 000)
// ─────────────────────────────────────────────────────────────────────────────
const PERCHES_MAX = 200;
const SQFT_MAX    = 10_000;
const SQFT_STEP   = 100;

function fmtPerches(v: number): string {
  if (v >= PERCHES_MAX) return `${PERCHES_MAX}P+`;
  return `${v}P`;
}
function fmtSqft(v: number): string {
  if (v >= SQFT_MAX) return '10k+';
  if (v >= 1000) return `${+(v / 1000).toFixed(1)}k`;
  return `${v}`;
}

function SizeRangeSlider({ min, max, onMinChange, onMaxChange, unit }: {
  min: number | ''; max: number | '';
  onMinChange: (v: number | '') => void; onMaxChange: (v: number | '') => void;
  unit: 'perches' | 'sqft';
}) {
  const MAX  = unit === 'perches' ? PERCHES_MAX : SQFT_MAX;
  const STEP = unit === 'perches' ? 1 : SQFT_STEP;
  const fmt  = unit === 'perches' ? fmtPerches : fmtSqft;

  const [localMin, setLocalMin] = useState(0);
  const [localMax, setLocalMax] = useState(MAX);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setLocalMin(min === '' ? 0 : min as number); }, [min]);
  useEffect(() => { setLocalMax(max === '' ? MAX : max as number); }, [max, MAX]);

  const commitMin = (v: number) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onMinChange(v <= 0 ? '' : v), 400);
  };
  const commitMax = (v: number) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onMaxChange(v >= MAX ? '' : v), 400);
  };

  const minPct = (localMin / MAX) * 100;
  const maxPct = (localMax / MAX) * 100;

  return (
    <div className="px-1 py-2">
      <div className="flex items-center justify-between mb-4 text-[11px] text-[#a3a3a3]">
        <span>{localMin <= 0 ? 'Any' : fmt(localMin)}</span>
        <span className="text-[9px] uppercase tracking-widest text-[#737373]">
          {unit === 'perches' ? 'Perches' : 'Sq ft'}
        </span>
        <span>{localMax >= MAX ? 'Any' : fmt(localMax)}</span>
      </div>
      <div className="relative h-8 flex items-center">
        <div className="absolute inset-x-0 h-[2px] rounded-full bg-white/[0.08]" />
        <div className="absolute h-[2px] rounded-full bg-[#14b8a6]"
          style={{ left: `${minPct}%`, right: `${100 - maxPct}%` }} />
        <input type="range" min={0} max={MAX} step={STEP} value={localMin}
          aria-label={`Minimum size in ${unit}`}
          onChange={e => { const v = Math.min(Number(e.target.value), localMax - STEP); setLocalMin(v); commitMin(v); }}
          onPointerUp={e => (e.currentTarget as HTMLInputElement).blur()}
          className="price-range-input" style={{ zIndex: localMin > MAX * 0.95 ? 5 : 3 }} />
        <input type="range" min={0} max={MAX} step={STEP} value={localMax}
          aria-label={`Maximum size in ${unit}`}
          onChange={e => { const v = Math.max(Number(e.target.value), localMin + STEP); setLocalMax(v); commitMax(v); }}
          onPointerUp={e => (e.currentTarget as HTMLInputElement).blur()}
          className="price-range-input" style={{ zIndex: localMax < MAX * 0.05 ? 5 : 4 }} />
      </div>
    </div>
  );
}

function SizeDropdown({
  selectedType,
  minSizePerches, maxSizePerches, onMinSizePerchesChange, onMaxSizePerchesChange,
  minSizeSqft,   maxSizeSqft,   onMinSizeSqftChange,   onMaxSizeSqftChange,
}: {
  selectedType: string;
  minSizePerches: number | ''; maxSizePerches: number | '';
  onMinSizePerchesChange: (v: number | '') => void; onMaxSizePerchesChange: (v: number | '') => void;
  minSizeSqft: number | '';   maxSizeSqft: number | '';
  onMinSizeSqftChange: (v: number | '') => void;   onMaxSizeSqftChange: (v: number | '') => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const useSqft = selectedType === 'house' || selectedType === 'apartment';
  const unit    = useSqft ? 'sqft' : 'perches';
  const fmt     = useSqft ? fmtSqft : fmtPerches;
  const minVal  = useSqft ? minSizeSqft    : minSizePerches;
  const maxVal  = useSqft ? maxSizeSqft    : maxSizePerches;
  const onMin   = useSqft ? onMinSizeSqftChange   : onMinSizePerchesChange;
  const onMax   = useSqft ? onMaxSizeSqftChange   : onMaxSizePerchesChange;

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isActive = minVal !== '' || maxVal !== '';
  const parts = [
    minVal !== '' ? fmt(minVal as number) : '',
    maxVal !== '' ? fmt(maxVal as number) : '',
  ].filter(Boolean);
  const label = isActive
    ? parts.join(' — ') + (useSqft ? ' sqft' : '')
    : 'Size';

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1 text-[13px] font-medium transition-colors cursor-pointer bg-transparent border-none p-0 ${
          isActive ? 'text-white' : 'text-[#525252] hover:text-[#a3a3a3]'
        }`}>
        {label}
        <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }} transition={{ duration: 0.13, ease: [0.22, 1, 0.36, 1] }}
            className="absolute z-50 mt-2 left-0 w-64 bg-[#111111] border border-white/[0.1] rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.55)] p-4">
            <SizeRangeSlider
              key={unit}
              min={minVal} max={maxVal}
              onMinChange={onMin} onMaxChange={onMax}
              unit={unit as 'perches' | 'sqft'}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Rooms dropdown  (Beds + Baths combined)
// ─────────────────────────────────────────────────────────────────────────────
const BED_OPTIONS  = [0, 1, 2, 3, 4, 5];
const BATH_OPTIONS = [0, 1, 2, 3];

function RoomsDropdown({ minBeds, onMinBedsChange, minBaths, onMinBathsChange }: {
  minBeds: number; onMinBedsChange: (v: number) => void;
  minBaths: number; onMinBathsChange: (v: number) => void;
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

  const isActive = minBeds > 0 || minBaths > 0;
  const parts = [
    minBeds  > 0 && `${minBeds}+ bd`,
    minBaths > 0 && `${minBaths}+ ba`,
  ].filter(Boolean) as string[];
  const label = parts.length > 0 ? parts.join(' · ') : 'Rooms';

  const pillCls = (active: boolean) =>
    `px-2.5 py-1 rounded-full text-[12px] font-medium transition-colors border cursor-pointer ${
      active
        ? 'bg-[#14b8a6] border-[#14b8a6] text-black'
        : 'bg-transparent border-white/[0.1] text-[#525252] hover:text-white hover:border-white/[0.25]'
    }`;

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1 text-[13px] font-medium transition-colors cursor-pointer bg-transparent border-none p-0 ${
          isActive ? 'text-white' : 'text-[#525252] hover:text-[#a3a3a3]'
        }`}>
        {label}
        <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }} transition={{ duration: 0.13, ease: [0.22, 1, 0.36, 1] }}
            className="absolute z-50 mt-2 left-0 w-60 bg-[#111111] border border-white/[0.1] rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.55)] p-4">

            <p className="text-[10px] uppercase tracking-widest text-[#525252] mb-2.5">Bedrooms</p>
            <div className="flex gap-1.5 flex-wrap mb-4">
              {BED_OPTIONS.map(v => (
                <button key={v} type="button" onClick={() => onMinBedsChange(v)} className={pillCls(minBeds === v)}>
                  {v === 0 ? 'Any' : `${v}+`}
                </button>
              ))}
            </div>

            <p className="text-[10px] uppercase tracking-widest text-[#525252] mb-2.5">Bathrooms</p>
            <div className="flex gap-1.5 flex-wrap">
              {BATH_OPTIONS.map(v => (
                <button key={v} type="button" onClick={() => onMinBathsChange(v)} className={pillCls(minBaths === v)}>
                  {v === 0 ? 'Any' : `${v}+`}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Minimal select  (District / Sort)
// ─────────────────────────────────────────────────────────────────────────────
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

function MinimalSelect({ options, value, onChange, prefix }: {
  options: SelectOption[]; value: string; onChange: (v: string) => void; prefix?: string;
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
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1 text-[13px] font-medium transition-colors cursor-pointer bg-transparent border-none p-0 ${
          isActive ? 'text-white' : 'text-[#525252] hover:text-[#a3a3a3]'
        }`}>
        {displayLabel}
        <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }} transition={{ duration: 0.13, ease: [0.22, 1, 0.36, 1] }}
            className="absolute z-50 mt-2 left-0 min-w-[160px] bg-[#111111] border border-white/[0.1] rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.55)] overflow-hidden">
            {options.map(opt => (
              <button key={opt.value} type="button" onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`relative w-full flex items-center justify-between gap-2 px-4 py-2.5 text-[13px] text-left transition-colors cursor-pointer bg-transparent border-none ${
                  opt.value === value ? 'text-[#14b8a6]' : 'text-[#525252] hover:text-white hover:bg-white/[0.04]'
                }`}>
                <span>{opt.label}</span>
                {opt.value === value && opt.value !== '' && (
                  <svg viewBox="0 0 12 12" className="w-3 h-3 flex-shrink-0 text-[#14b8a6]" fill="none">
                    <polyline points="2,6.5 5,9.5 10,3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Filters component
// ─────────────────────────────────────────────────────────────────────────────
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
  minBeds: number;
  onMinBedsChange: (v: number) => void;
  minBaths: number;
  onMinBathsChange: (v: number) => void;
  minSizePerches: number | '';
  maxSizePerches: number | '';
  onMinSizePerchesChange: (v: number | '') => void;
  onMaxSizePerchesChange: (v: number | '') => void;
  minSizeSqft: number | '';
  maxSizeSqft: number | '';
  onMinSizeSqftChange: (v: number | '') => void;
  onMaxSizeSqftChange: (v: number | '') => void;
  sortBy: string;
  onSortChange: (s: string) => void;
  selectedSource: string;
  onSourceChange: (s: string) => void;
  totalResults: number;
}

const SOURCES = [
  { value: '',        label: 'All Sources' },
  { value: 'ikman',  label: 'ikman.lk' },
  { value: 'lpw',    label: 'LPW' },
  { value: 'lamudi', label: 'house.lk' },
];

export function Filters({
  districts, selectedDistrict, onDistrictChange,
  selectedType, onTypeChange, listingType, onListingTypeChange,
  minPrice, onMinPriceChange, maxPrice, onMaxPriceChange,
  minBeds, onMinBedsChange, minBaths, onMinBathsChange,
  minSizePerches, maxSizePerches, onMinSizePerchesChange, onMaxSizePerchesChange,
  minSizeSqft, maxSizeSqft, onMinSizeSqftChange, onMaxSizeSqftChange,
  sortBy, onSortChange, selectedSource, onSourceChange, totalResults,
}: Props) {
  const hasFilters = !!(
    selectedDistrict || selectedType || listingType || selectedSource ||
    minPrice !== '' || maxPrice !== '' ||
    minBeds > 0 || minBaths > 0 ||
    minSizePerches !== '' || maxSizePerches !== '' ||
    minSizeSqft !== '' || maxSizeSqft !== ''
  );

  const districtOptions: SelectOption[] = [
    { value: '', label: 'All Districts' },
    ...districts.map(d => ({ value: d.district, label: `${d.district} (${d.count})` })),
  ];

  const clearAll = () => {
    onDistrictChange(''); onTypeChange(''); onListingTypeChange(''); onSourceChange('');
    onMinPriceChange(''); onMaxPriceChange('');
    onMinBedsChange(0);   onMinBathsChange(0);
    onMinSizePerchesChange(''); onMaxSizePerchesChange('');
    onMinSizeSqftChange('');   onMaxSizeSqftChange('');
  };

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 pb-1 flex-wrap sm:flex-nowrap">

        {/* ── Property type + listing type pills ── */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-shrink-0">
          <div className="flex items-center gap-1 flex-shrink-0">
            {PROPERTY_TYPES.map(opt => (
              <button key={opt.value} onClick={() => onTypeChange(opt.value)}
                className={`relative px-3.5 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap cursor-pointer border-none transition-colors ${
                  selectedType === opt.value ? 'text-black' : 'bg-transparent text-[#525252] hover:text-white'
                }`}>
                {selectedType === opt.value && (
                  <motion.span layoutId="active-type-pill"
                    className="absolute inset-0 bg-white rounded-full"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                )}
                <span className="relative z-10">{opt.label}</span>
              </button>
            ))}
          </div>

          <div className="w-px h-4 bg-white/[0.1] flex-shrink-0 mx-1" />

          <div className="flex items-center gap-1 flex-shrink-0">
            {LISTING_TYPES.filter(t => t.value !== '').map(opt => (
              <button key={opt.value}
                onClick={() => onListingTypeChange(listingType === opt.value ? '' : opt.value)}
                className={`relative px-3.5 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap cursor-pointer border-none transition-colors ${
                  listingType === opt.value ? 'text-black' : 'bg-transparent text-[#525252] hover:text-white'
                }`}>
                {listingType === opt.value && (
                  <motion.span layoutId="active-listing-pill"
                    className="absolute inset-0 bg-white rounded-full"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                )}
                <span className="relative z-10">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="w-px h-4 bg-white/[0.1] flex-shrink-0 mx-1" />

        {/* ── Dropdowns ── */}
        <MinimalSelect options={districtOptions} value={selectedDistrict}
          onChange={onDistrictChange} prefix="District" />

        <MinimalSelect options={SOURCES} value={selectedSource}
          onChange={onSourceChange} prefix="Source" />

        <PriceDropdown minPrice={minPrice} maxPrice={maxPrice}
          onMinPriceChange={onMinPriceChange} onMaxPriceChange={onMaxPriceChange} />

        <SizeDropdown
          selectedType={selectedType}
          minSizePerches={minSizePerches} maxSizePerches={maxSizePerches}
          onMinSizePerchesChange={onMinSizePerchesChange} onMaxSizePerchesChange={onMaxSizePerchesChange}
          minSizeSqft={minSizeSqft} maxSizeSqft={maxSizeSqft}
          onMinSizeSqftChange={onMinSizeSqftChange} onMaxSizeSqftChange={onMaxSizeSqftChange}
        />

        <RoomsDropdown
          minBeds={minBeds}   onMinBedsChange={onMinBedsChange}
          minBaths={minBaths} onMinBathsChange={onMinBathsChange}
        />

        <MinimalSelect options={SORT_OPTIONS} value={sortBy} onChange={onSortChange} />

        <div className="w-px h-4 bg-white/[0.1] flex-shrink-0 mx-1" />

        <span className="text-[11px] text-[#525252] whitespace-nowrap flex-shrink-0 num">
          {totalResults.toLocaleString()} listings
        </span>

        {hasFilters && (
          <button onClick={clearAll}
            className="flex items-center gap-1 text-[11px] text-[#14b8a6] whitespace-nowrap flex-shrink-0 cursor-pointer bg-transparent border-none p-0 hover:text-[#5eead4] transition-colors">
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>
    </div>
  );
}
