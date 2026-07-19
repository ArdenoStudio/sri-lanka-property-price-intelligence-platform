import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Calculator, ChevronLeft, FileText, TrendingUp } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { getDistricts, getEstimate } from '../api';
import type { District, EstimateResult, SimilarListing } from '../api';
import { useCurrency } from '../hooks/useCurrency';
import { Footer } from './Footer';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { DealScorePill } from './DealScore';
import { EmptyStatePanel } from './ui/EmptyStatePanel';
import { MinimalSelect } from './ui/MinimalSelect';

const PROPERTY_TYPES = [
  { value: 'land', label: 'Land' },
  { value: 'house', label: 'House' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'commercial', label: 'Commercial' },
];

const LISTING_TYPES = [
  { value: 'sale' as const, label: 'Sale' },
  { value: 'rent' as const, label: 'Rent' },
];

const CONFIDENCE_STYLES: Record<EstimateResult['confidence'], string> = {
  high: 'bg-emerald-500/[0.12] text-emerald-300 border-emerald-500/25',
  medium: 'bg-amber-500/[0.12] text-amber-300 border-amber-500/25',
  low: 'bg-rose-500/[0.12] text-rose-300 border-rose-500/25',
  none: 'bg-white/[0.05] text-[#8a8a8a] border-white/[0.08]',
};

const CONFIDENCE_COPY: Record<EstimateResult['confidence'], string> = {
  high: 'Tight local signal',
  medium: 'Good local signal',
  low: 'Directional benchmark',
  none: 'No estimate yet',
};

function formatScopeLabel(scope?: string) {
  if (scope === 'district') return 'District scope';
  if (scope === 'national') return 'All Sri Lanka';
  return 'Market scope';
}

function formatListingTypeLabel(listingType: 'sale' | 'rent' | '') {
  if (listingType === 'sale') return 'Sale market';
  if (listingType === 'rent') return 'Rent market';
  return 'Choose market mode';
}

function sizeChipLabel(unit: 'perches' | 'sqft', value: string) {
  return unit === 'perches' ? `${value} perches` : `${value} sqft`;
}

function buildListingDetails(listing: SimilarListing) {
  return [
    listing.size_perches ? `${listing.size_perches} perches` : null,
    listing.size_sqft ? `${listing.size_sqft} sqft` : null,
    listing.bedrooms ? `${listing.bedrooms} BR` : null,
  ].filter(Boolean) as string[];
}

function ResultMetric({
  label,
  value,
  hint,
  emphasize = false,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasize?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-[0.16em] text-[#525252]">{label}</dt>
      <dd className={`mt-2 text-[1rem] font-semibold num ${emphasize ? 'text-[#14b8a6]' : 'text-white'}`}>
        {value}
      </dd>
      {hint && <p className="mt-1 text-[12px] leading-5 text-[#6d6d6d] font-body">{hint}</p>}
    </div>
  );
}

function ComparableRow({
  listing,
  formatConverted,
}: {
  listing: SimilarListing;
  formatConverted: (n: number | null | undefined) => string;
}) {
  const detailParts = buildListingDetails(listing);
  const location = listing.city || listing.raw_location || listing.district || 'Sri Lanka';

  return (
    <Link
      to={`/listing/${listing.id}`}
      className="group grid gap-3 py-4 no-underline transition-colors sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-[15px] font-semibold text-white">
            {listing.title || location}
          </p>
          {listing.similarity_score != null && (
            <span className="rounded-full border border-[#14b8a6]/20 bg-[#14b8a6]/10 px-2 py-0.5 text-[10px] font-semibold text-[#75efe2]">
              {listing.similarity_score.toFixed(0)}% match
            </span>
          )}
        </div>
        <p className="mt-1 text-[12px] text-[#737373] font-body">{location}</p>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[#8a8a8a]">
          {detailParts.slice(0, 3).map(part => (
            <span key={part}>{part}</span>
          ))}
          {listing.match_reasons?.slice(0, 2).map(reason => (
            <span key={reason} className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2 py-0.5">
              {reason}
            </span>
          ))}
        </div>
      </div>

      <div className="sm:text-right">
        <p className="text-[1.05rem] font-semibold text-white num">
          {listing.price_lkr != null ? formatConverted(listing.price_lkr) : '-'}
        </p>
        {listing.deal_score != null ? (
          <div className="mt-1 inline-flex sm:justify-end">
            <DealScorePill score={listing.deal_score} variant="compare" />
          </div>
        ) : (
          <p className="mt-1 text-[11px] text-[#525252] group-hover:text-[#8a8a8a]">View details</p>
        )}
      </div>
    </Link>
  );
}

function PriceRangeBar({
  low,
  median,
  high,
  formatConverted,
}: {
  low: number | null;
  median: number | null;
  high: number | null;
  formatConverted: (n: number | null | undefined) => string;
}) {
  if (low == null || median == null || high == null) return null;

  const range = high - low;
  const medianPct = range > 0 ? ((median - low) / range) * 100 : 50;

  return (
    <div>
      <div className="relative h-2 overflow-visible rounded-full bg-white/[0.06]">
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-white/[0.08] via-[#14b8a6]/40 to-white/[0.08]" />
        <div
          className="absolute top-1/2 z-10 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-black bg-[#14b8a6] shadow-[0_0_10px_rgba(20,184,166,0.55)]"
          style={{ left: `calc(${medianPct}% - 6px)` }}
        />
      </div>
      <div className="mt-3 flex justify-between text-[10px] text-[#5f5f5f]">
        <span>{formatConverted(low)}</span>
        <span className="text-[#75efe2]">{formatConverted(median)}</span>
        <span>{formatConverted(high)}</span>
      </div>
    </div>
  );
}

export function EstimateTool() {
  const navigate = useNavigate();
  const { formatConverted } = useCurrency();
  const inputsRef = useRef<HTMLElement>(null);

  const [districts, setDistricts] = useState<District[]>([]);
  const [district, setDistrict] = useState('');
  const [propertyType, setPropertyType] = useState('house');
  const [listingType, setListingType] = useState<'sale' | 'rent' | ''>('');
  const [sizePerches, setSizePerches] = useState('');
  const [sizeSqft, setSizeSqft] = useState('');
  const [bedrooms, setBedrooms] = useState<number | null>(null);

  const [result, setResult] = useState<EstimateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    getDistricts(propertyType).then(setDistricts).catch(() => {});
  }, [propertyType]);

  const districtOptions = [
    { value: '', label: 'All Sri Lanka', triggerLabel: 'All Sri Lanka' },
    ...districts.map(item => ({
      value: item.district,
      label: `${item.district} (${item.count})`,
      triggerLabel: item.district,
    })),
  ];

  const usesPerches = propertyType === 'land' || propertyType === 'house';
  const usesSqft = propertyType === 'apartment' || propertyType === 'house';
  const usesBedrooms = propertyType === 'house' || propertyType === 'apartment';
  const hasPositivePerchSize = usesPerches && Number(sizePerches) > 0;
  const hasPositiveSqftSize = usesSqft && Number(sizeSqft) > 0;
  const hasEstimateAnchor = !!district || hasPositivePerchSize || hasPositiveSqftSize;
  const resultLabel = listingType === 'rent' ? 'Estimated Monthly Rent' : 'Estimated Asking Value';
  const canSubmit = !!propertyType && !!listingType && hasEstimateAnchor;
  const hasResult = !!result && result.comparable_count > 0;

  const activeInputChips = [
    PROPERTY_TYPES.find(option => option.value === propertyType)?.label ?? 'Property',
    formatListingTypeLabel(listingType),
    district || 'All Sri Lanka',
    hasPositivePerchSize ? sizeChipLabel('perches', sizePerches) : null,
    hasPositiveSqftSize ? sizeChipLabel('sqft', sizeSqft) : null,
    usesBedrooms && bedrooms != null ? `${bedrooms} bedrooms` : null,
  ].filter(Boolean) as string[];

  const openListings = () => {
    if (!listingType) return;

    const params = new URLSearchParams();
    if (district) params.set('district', district);
    params.set('type', propertyType);
    params.set('listing_type', listingType);
    navigate(`/?${params.toString()}`);
  };

  const openReport = () => {
    const params = new URLSearchParams();
    if (district) params.set('district', district);
    params.set('type', propertyType);
    if (listingType) params.set('listing_type', listingType);
    if (hasPositivePerchSize) params.set('size_perches', sizePerches);
    if (hasPositiveSqftSize) params.set('size_sqft', sizeSqft);
    if (bedrooms != null) params.set('bedrooms', String(bedrooms));
    window.open(`/report?${params.toString()}`, '_blank');
  };

  const broadenEstimateScope = () => {
    if (district) setDistrict('');
    if (bedrooms != null) setBedrooms(null);
    if (usesPerches && usesSqft && hasPositivePerchSize && hasPositiveSqftSize) {
      setSizeSqft('');
    }
    setHasSubmitted(false);
    setError(false);
    requestAnimationFrame(() => {
      inputsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const handleSubmit = async () => {
    if (!canSubmit || !listingType) return;

    setLoading(true);
    setHasSubmitted(true);
    setError(false);

    try {
      const params: Parameters<typeof getEstimate>[0] = {
        district: district || undefined,
        property_type: propertyType,
        listing_type: listingType,
      };

      if (hasPositivePerchSize) params.size_perches = Number(sizePerches);
      if (hasPositiveSqftSize) params.size_sqft = Number(sizeSqft);
      if (bedrooms != null) params.bedrooms = bedrooms;

      const response = await getEstimate(params);
      setResult(response);
    } catch {
      setResult(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const panelState = loading
    ? 'loading'
    : error
      ? 'error'
      : hasSubmitted
        ? hasResult
          ? 'result'
          : 'no-results'
        : 'idle';

  return (
    <div className="min-h-screen bg-black">
      <Header />

      <main
        id="main-content"
        className="mx-auto max-w-6xl px-6 pt-10 pb-32 md:pt-12 lg:px-8"
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="group mb-8 flex items-center gap-1.5 border-none bg-transparent p-0 text-[12px] text-[#525252] transition-colors hover:text-white"
        >
          <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          Back
        </button>

        <div className="mb-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-[#14b8a6]/20 bg-[#14b8a6]/10">
                <Calculator className="h-4 w-4 text-[#14b8a6]" />
              </div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-[#525252]">Nilam Estimate</p>
            </div>
            <h1 className="text-[clamp(2rem,4.8vw,4.5rem)] font-display leading-none text-white">
              One clear estimate, backed by better comparables.
            </h1>
            <p className="mt-4 max-w-3xl text-[15px] leading-7 text-[#8a8a8a] font-body">
              Nilam now benefits more from tier-1 matches when district, size, and bedrooms line up.
              Enter the best anchors you have and the result panel will emphasize the median, the comparable set,
              and how much confidence to place in it.
            </p>
          </div>

          <div className="rounded-[28px] border border-white/[0.08] bg-white/[0.03] p-5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#5f5f5f]">Best result inputs</p>
            <p className="mt-3 text-[1.1rem] font-semibold text-white">District + size + bedrooms</p>
            <p className="mt-2 text-[13px] leading-6 text-[#7b7b7b] font-body">
              Nilam checks strict same-district matches first, then broadens carefully if the sample is too small.
            </p>
          </div>
        </div>

        <section
          ref={inputsRef}
          className="overflow-hidden rounded-[32px] border border-white/[0.08] bg-[#0c0c0c] shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
        >
          <div className="grid lg:grid-cols-[360px_minmax(0,1fr)]">
            <aside className="border-b border-white/[0.06] bg-[#111111] p-6 sm:p-8 lg:border-r lg:border-b-0">
              <div className="mb-8">
                <p className="text-[10px] uppercase tracking-[0.18em] text-[#525252]">Estimate inputs</p>
                <h2 className="mt-2 text-[1.5rem] font-semibold text-white">Shape the comparable pool.</h2>
                <p className="mt-3 text-[13px] leading-6 text-[#737373] font-body">
                  Add the anchors you know. District or size is required, and bedrooms help houses and apartments hit tighter tier-1 matches.
                </p>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="mb-2 block text-[11px] uppercase tracking-[0.15em] text-[#525252]">
                    District
                    <span className="ml-2 normal-case tracking-normal text-[#404040]">optional</span>
                  </label>
                  <MinimalSelect options={districtOptions} value={district} onChange={setDistrict} />
                  <p className="mt-2 text-[11px] text-[#4f4f4f] font-body">
                    {district ? 'Using a district keeps Nilam focused on local comps.' : 'Leave this broad to let Nilam search across Sri Lanka.'}
                  </p>
                </div>

                <div>
                  <label className="mb-3 block text-[11px] uppercase tracking-[0.15em] text-[#525252]">Property type</label>
                  <div className="flex flex-wrap gap-2">
                    {PROPERTY_TYPES.map(option => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setPropertyType(option.value)}
                        className={`relative rounded-full px-4 py-2 text-[13px] font-medium transition-colors ${
                          propertyType === option.value
                            ? 'text-black'
                            : 'border border-white/[0.08] bg-transparent text-[#737373] hover:border-white/[0.14] hover:text-white'
                        }`}
                      >
                        {propertyType === option.value && (
                          <motion.span
                            layoutId="estimate-property-type"
                            className="absolute inset-0 rounded-full bg-white"
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                          />
                        )}
                        <span className="relative z-10">{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-3 block text-[11px] uppercase tracking-[0.15em] text-[#525252]">Market mode</label>
                  <div className="grid grid-cols-2 gap-2">
                    {LISTING_TYPES.map(option => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setListingType(option.value)}
                        className={`rounded-2xl border py-2.5 text-[13px] font-semibold transition-colors ${
                          listingType === option.value
                            ? 'border-[#14b8a6] bg-[#14b8a6] text-black'
                            : 'border-white/[0.08] bg-transparent text-[#737373] hover:border-white/[0.14] hover:text-white'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  {usesPerches && (
                    <div>
                      <label className="mb-2 block text-[11px] uppercase tracking-[0.15em] text-[#525252]">
                        Size (perches)
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="e.g. 10"
                        value={sizePerches}
                        onChange={(event) => setSizePerches(event.target.value)}
                        className="w-full rounded-2xl border border-white/[0.08] bg-[#161616] px-4 py-3 text-[14px] text-white placeholder-[#404040] transition-colors focus:border-[#14b8a6]/40 focus:outline-none"
                      />
                    </div>
                  )}

                  {usesSqft && (
                    <div>
                      <label className="mb-2 block text-[11px] uppercase tracking-[0.15em] text-[#525252]">
                        Size (sqft)
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="e.g. 1200"
                        value={sizeSqft}
                        onChange={(event) => setSizeSqft(event.target.value)}
                        className="w-full rounded-2xl border border-white/[0.08] bg-[#161616] px-4 py-3 text-[14px] text-white placeholder-[#404040] transition-colors focus:border-[#14b8a6]/40 focus:outline-none"
                      />
                    </div>
                  )}
                </div>

                {usesBedrooms && (
                  <div>
                    <label className="mb-3 block text-[11px] uppercase tracking-[0.15em] text-[#525252]">Bedrooms</label>
                    <div className="flex flex-wrap gap-2">
                      {[null, 1, 2, 3, 4, 5].map((value) => (
                        <button
                          key={String(value)}
                          type="button"
                          onClick={() => setBedrooms(value)}
                          className={`rounded-full border px-4 py-1.5 text-[13px] font-medium transition-colors ${
                            bedrooms === value
                              ? 'border-[#14b8a6] bg-[#14b8a6] text-black'
                              : 'border-white/[0.08] bg-transparent text-[#737373] hover:border-white/[0.14] hover:text-white'
                          }`}
                        >
                          {value == null ? 'Any' : `${value} BR`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-3 border-t border-white/[0.06] pt-6">
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!canSubmit || loading}
                    className={`w-full rounded-2xl py-3 text-[14px] font-bold transition-colors ${
                      canSubmit && !loading
                        ? 'bg-[#14b8a6] text-black hover:bg-[#0d9488]'
                        : 'cursor-not-allowed bg-white/[0.06] text-[#525252]'
                    }`}
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Estimating...
                      </span>
                    ) : 'Get estimate'}
                  </button>

                  {!canSubmit && (
                    <p className="text-[11px] leading-5 text-[#525252] font-body">
                      Choose sale or rent, then add a district or size to anchor the estimate.
                    </p>
                  )}
                </div>
              </div>
            </aside>

            <section className="min-h-[640px] p-6 sm:p-8" aria-live="polite">
              <AnimatePresence mode="wait">
                <motion.div
                  key={panelState}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                  className="flex h-full flex-col"
                >
                  {panelState === 'idle' && (
                    <>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.2em] text-[#525252]">Result preview</p>
                        <h2 className="mt-3 text-[clamp(1.8rem,3vw,2.8rem)] font-semibold leading-tight text-white">
                          A single estimate with the signal around it.
                        </h2>
                        <p className="mt-4 max-w-2xl text-[15px] leading-7 text-[#8a8a8a] font-body">
                          Nilam highlights the median first, then explains the confidence and shows only the strongest comparable listings.
                          No stacked cards, no noisy summary blocks.
                        </p>
                      </div>

                      <div className="mt-10 flex-1 rounded-[28px] border border-dashed border-white/[0.1] bg-white/[0.02] p-6 sm:p-8">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-[#4f4f4f]">Wireframe</p>
                        <p className="mt-4 text-[12px] text-[#5d5d5d] font-body">Median estimate</p>
                        <p className="mt-2 text-[clamp(3rem,7vw,5.5rem)] leading-none text-white/25 font-display num">
                          LKR --
                        </p>
                        <div className="mt-6 h-2 rounded-full bg-white/[0.05]" />
                        <div className="mt-3 flex justify-between text-[10px] text-[#4f4f4f]">
                          <span>Low</span>
                          <span>Median</span>
                          <span>High</span>
                        </div>
                        <div className="mt-8 grid gap-4 border-y border-white/[0.06] py-6 sm:grid-cols-3">
                          <ResultMetric label="Confidence" value="Awaiting inputs" hint="Starts with strict tier-1 district matching." />
                          <ResultMetric label="Comparable set" value="0 listings" hint="Top matches will appear here." />
                          <ResultMetric label="Why it matters" value="District + size + bedrooms" hint="Best path to tighter local comps." />
                        </div>
                        <div className="mt-8">
                          <p className="text-[10px] uppercase tracking-[0.16em] text-[#4f4f4f]">Current inputs</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {activeInputChips.map(chip => (
                              <span
                                key={chip}
                                className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[11px] text-[#7b7b7b]"
                              >
                                {chip}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {panelState === 'loading' && (
                    <>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.2em] text-[#525252]">Loading estimate</p>
                        <h2 className="mt-3 text-[clamp(1.8rem,3vw,2.8rem)] font-semibold leading-tight text-white">
                          Searching the strongest comparable set first.
                        </h2>
                        <p className="mt-4 max-w-2xl text-[15px] leading-7 text-[#8a8a8a] font-body">
                          Nilam checks strict district, size, and bedroom matches before relaxing the criteria, so the first number you see has better context behind it.
                        </p>
                      </div>

                      <div className="mt-10 flex-1 rounded-[28px] border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8">
                        <div className="animate-pulse">
                          <div className="h-3 w-24 rounded-full bg-white/[0.06]" />
                          <div className="mt-5 h-14 w-[70%] rounded-full bg-white/[0.06]" />
                          <div className="mt-6 h-2 rounded-full bg-white/[0.06]" />
                          <div className="mt-10 grid gap-4 sm:grid-cols-3">
                            <div className="h-20 rounded-2xl bg-white/[0.05]" />
                            <div className="h-20 rounded-2xl bg-white/[0.05]" />
                            <div className="h-20 rounded-2xl bg-white/[0.05]" />
                          </div>
                          <div className="mt-10 space-y-3">
                            <div className="h-12 rounded-2xl bg-white/[0.05]" />
                            <div className="h-12 rounded-2xl bg-white/[0.05]" />
                            <div className="h-12 rounded-2xl bg-white/[0.05]" />
                          </div>
                        </div>
                      </div>

                      <p className="mt-4 text-[12px] text-[#5f5f5f] font-body">
                        Query: {activeInputChips.join(' | ')}
                      </p>
                    </>
                  )}

                  {panelState === 'error' && (
                    <>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.2em] text-[#525252]">Error state</p>
                        <div className="mt-4 flex items-start gap-4">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/[0.08]">
                            <AlertCircle className="h-5 w-5 text-rose-300" />
                          </div>
                          <div>
                            <h2 className="text-[clamp(1.8rem,3vw,2.8rem)] font-semibold leading-tight text-white">
                              The estimate could not be loaded.
                            </h2>
                            <p className="mt-4 max-w-2xl text-[15px] leading-7 text-[#8a8a8a] font-body">
                              Retry the request. If this keeps happening, broaden the district or remove one of the size inputs so Nilam has a wider pool to work with.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                        <button
                          type="button"
                          onClick={handleSubmit}
                          className="rounded-2xl bg-[#14b8a6] px-5 py-3 text-[14px] font-bold text-black transition-colors hover:bg-[#0d9488]"
                        >
                          Try again
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setError(false);
                            setHasSubmitted(false);
                          }}
                          className="rounded-2xl border border-white/[0.08] px-5 py-3 text-[14px] font-medium text-[#a3a3a3] transition-colors hover:border-white/[0.16] hover:text-white"
                        >
                          Edit inputs
                        </button>
                      </div>

                      <div className="mt-10 rounded-[28px] border border-white/[0.08] bg-white/[0.02] p-6">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-[#4f4f4f]">Last attempted query</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {activeInputChips.map(chip => (
                            <span
                              key={chip}
                              className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[11px] text-[#7b7b7b]"
                            >
                              {chip}
                            </span>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {panelState === 'no-results' && (
                    <EmptyStatePanel
                      eyebrow="Estimate"
                      title="Estimate needs a broader comp set"
                      body="There are not enough comparable listings in this slice to support a reliable estimate yet. Expand the scope and run it again."
                      ctaLabel="Broaden estimate scope"
                      onCta={broadenEstimateScope}
                      className="min-h-[320px]"
                    />
                  )}

                  {panelState === 'result' && result && (
                    <>
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.2em] text-[#525252]">{resultLabel}</p>
                          <p className="mt-2 text-[13px] text-[#6d6d6d] font-body">
                            Based on {result.comparable_count} comparable listing{result.comparable_count !== 1 ? 's' : ''}
                            {district ? ` in ${district}` : ' across Sri Lanka'}
                          </p>
                        </div>
                        <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${CONFIDENCE_STYLES[result.confidence]}`}>
                          {CONFIDENCE_COPY[result.confidence]}
                        </span>
                      </div>

                      <div className="mt-8">
                        <p className="text-[12px] text-[#5f5f5f] font-body">Median estimate</p>
                        <p className="mt-2 text-[clamp(3.4rem,7vw,6rem)] leading-[0.92] text-white font-display num">
                          {formatConverted(result.estimated_median)}
                        </p>
                        <p className="mt-4 max-w-2xl text-[15px] leading-7 text-[#b1b1b1] font-body">
                          {result.confidence_reason}
                          {result.match_tier ? ` Comparable pool: ${result.match_tier}.` : ''}
                        </p>
                      </div>

                      <div className="mt-6 flex flex-wrap gap-2">
                        {activeInputChips.map(chip => (
                          <span
                            key={chip}
                            className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[11px] text-[#8a8a8a]"
                          >
                            {chip}
                          </span>
                        ))}
                      </div>

                      <div className="mt-8 border-y border-white/[0.06] py-6">
                        <PriceRangeBar
                          low={result.estimated_low}
                          median={result.estimated_median}
                          high={result.estimated_high}
                          formatConverted={formatConverted}
                        />

                        <dl className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                          <ResultMetric
                            label="Low / high"
                            value={`${formatConverted(result.estimated_low)} - ${formatConverted(result.estimated_high)}`}
                            hint="Interquartile range from the comparable set."
                          />
                          <ResultMetric
                            label="Comparable set"
                            value={`${result.comparable_count} listings`}
                            hint="The ranked pool used for the estimate."
                          />
                          <ResultMetric
                            label="Average match"
                            value={result.average_similarity_score != null ? `${result.average_similarity_score.toFixed(0)}%` : 'Pending'}
                            hint={result.match_tier || 'Comparable tier'}
                            emphasize
                          />
                          <ResultMetric
                            label="Scope"
                            value={formatScopeLabel(result.matched_criteria?.city_scope)}
                            hint={result.matched_criteria?.district || 'Broader market fallback if needed.'}
                          />
                        </dl>

                        {(result.median_price_per_perch || result.median_price_per_sqft) && (
                          <dl className="mt-8 grid gap-5 border-t border-white/[0.06] pt-6 sm:grid-cols-2">
                            {result.median_price_per_perch && usesPerches && (
                              <ResultMetric
                                label="Median per perch"
                                value={formatConverted(result.median_price_per_perch)}
                                hint="Useful when land size is the anchor."
                                emphasize
                              />
                            )}
                            {result.median_price_per_sqft && usesSqft && (
                              <ResultMetric
                                label="Median per sqft"
                                value={formatConverted(result.median_price_per_sqft)}
                                hint="Useful when built area is the anchor."
                                emphasize
                              />
                            )}
                          </dl>
                        )}
                      </div>

                      <div className="mt-8">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.2em] text-[#525252]">Comparable listings</p>
                            <p className="mt-2 text-[13px] leading-6 text-[#737373] font-body">
                              Showing the strongest ranked matches rather than a stack of standalone cards.
                            </p>
                          </div>
                        </div>

                        {result.comparables.length > 0 && (
                          <div className="mt-4 divide-y divide-white/[0.06] border-y border-white/[0.06]">
                            {result.comparables.map(comparable => (
                              <ComparableRow
                                key={comparable.id}
                                listing={comparable}
                                formatConverted={formatConverted}
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="mt-6 grid gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={openListings}
                          className="flex items-center justify-center gap-2 rounded-2xl border border-white/[0.08] py-3 text-[13px] font-medium text-[#a3a3a3] transition-colors hover:border-white/[0.16] hover:text-white"
                        >
                          <TrendingUp className="h-3.5 w-3.5" />
                          Browse similar listings
                        </button>
                        <button
                          type="button"
                          onClick={openReport}
                          className="flex items-center justify-center gap-2 rounded-2xl border border-[#14b8a6]/30 bg-[#14b8a6]/5 py-3 text-[13px] font-semibold text-[#14b8a6] transition-colors hover:border-[#14b8a6]/50 hover:bg-[#14b8a6]/10"
                        >
                          <FileText className="h-4 w-4" />
                          Download report (PDF)
                        </button>
                      </div>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </section>
          </div>
        </section>
      </main>

      <MobileNav />
      <Footer />
    </div>
  );
}
