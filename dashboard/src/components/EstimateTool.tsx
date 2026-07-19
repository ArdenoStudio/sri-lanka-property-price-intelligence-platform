import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Calculator, ChevronLeft, TrendingUp, AlertCircle, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getDistricts, getEstimate } from '../api';
import type { District, EstimateResult, SimilarListing } from '../api';
import { Header } from './Header';
import { Footer } from './Footer';
import { MobileNav } from './MobileNav';
import { MinimalSelect } from './ui/MinimalSelect';
import { useCurrency } from '../hooks/useCurrency';
import { EMITeaser } from './EMITeaser';
import { MortgageCalculator } from './MortgageCalculator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

const CONFIDENCE_STYLES: Record<string, string> = {
  high:   'bg-emerald-500/[0.12] text-emerald-400 border-emerald-500/20',
  medium: 'bg-amber-500/[0.12] text-amber-400 border-amber-500/20',
  low:    'bg-red-500/[0.12] text-red-400 border-red-500/20',
  none:   'bg-white/[0.05] text-[#525252] border-white/10',
};

// ---------------------------------------------------------------------------
// Comparable card
// ---------------------------------------------------------------------------

function ComparableCard({ listing, formatConverted }: { listing: SimilarListing; formatConverted: (n: number | null | undefined) => string }) {
  const detailParts = [
    listing.size_perches ? `${listing.size_perches}p` : '',
    listing.size_sqft ? `${listing.size_sqft} sqft` : '',
    listing.bedrooms ? `${listing.bedrooms}BR` : '',
  ].filter(Boolean);

  return (
    <Link
      to={`/listing/${listing.id}`}
      className="block bg-[#161616] border border-white/[0.06] rounded-2xl p-4 hover:border-white/[0.12] transition-colors no-underline group"
    >
      <p className="text-[16px] font-bold text-white num mb-1">
        {listing.price_lkr != null ? formatConverted(listing.price_lkr) : '—'}
      </p>
      <p className="text-[11px] text-[#525252] mb-2 line-clamp-1">
        {listing.city || listing.raw_location || listing.district}
      </p>
      {detailParts.length > 0 && (
        <p className="text-[11px] text-[#404040]">
          {detailParts.join(' · ')}
        </p>
      )}
      {listing.similarity_score != null && (
        <p className="text-[10px] text-[#14b8a6] mt-2 font-semibold">
          {listing.similarity_score.toFixed(0)}% match
        </p>
      )}
      {listing.match_reasons && listing.match_reasons.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {listing.match_reasons.slice(0, 3).map(reason => (
            <span key={reason} className="text-[9px] text-[#737373] bg-white/[0.04] border border-white/[0.06] rounded-full px-2 py-0.5">
              {reason}
            </span>
          ))}
        </div>
      )}
      {listing.deal_score != null && listing.deal_score > 0 && (
        <span className="inline-flex mt-2 text-[10px] text-emerald-400 bg-emerald-400/[0.08] px-2 py-0.5 rounded-full border border-emerald-400/20">
          +{listing.deal_score.toFixed(0)}% deal
        </span>
      )}
      <p className="text-[10px] text-[#525252] mt-2 group-hover:text-[#a3a3a3] transition-colors">View →</p>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Price range bar
// ---------------------------------------------------------------------------

function PriceRangeBar({
  low, median, high, formatConverted,
}: {
  low: number | null;
  median: number | null;
  high: number | null;
  formatConverted: (n: number | null | undefined) => string;
}) {
  if (low == null || median == null || high == null) return null;
  // Position median as a % between low and high
  const range = high - low;
  const medianPct = range > 0 ? ((median - low) / range) * 100 : 50;

  return (
    <div className="mb-6">
      {/* Track */}
      <div className="relative h-2 rounded-full bg-white/[0.06] overflow-visible mx-1">
        {/* Filled segment low→high */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-white/[0.08] via-[#14b8a6]/40 to-white/[0.08]" />
        {/* Median marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#14b8a6] border-2 border-black shadow-[0_0_8px_rgba(20,184,166,0.6)] z-10"
          style={{ left: `calc(${medianPct}% - 6px)` }}
        />
      </div>
      {/* Labels */}
      <div className="flex justify-between mt-3 text-[10px] text-[#525252]">
        <span>{formatConverted(low)}</span>
        <span className="text-[#14b8a6]">{formatConverted(median)}</span>
        <span>{formatConverted(high)}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function EstimateTool() {
  const navigate = useNavigate();
  const { formatConverted } = useCurrency();
  const [districts, setDistricts] = useState<District[]>([]);

  // Form state
  const [district, setDistrict] = useState('');
  const [propertyType, setPropertyType] = useState('house');
  const [listingType, setListingType] = useState<'sale' | 'rent' | ''>('');
  const [sizePerches, setSizePerches] = useState('');
  const [sizeSqft, setSizeSqft] = useState('');
  const [bedrooms, setBedrooms] = useState<number | null>(null);

  // Result state
  const [result, setResult] = useState<EstimateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    getDistricts().then(setDistricts).catch(() => {});
  }, []);

  const districtOptions = [
    { value: '', label: 'All Districts' },
    ...districts.map(d => ({ value: d.district, label: `${d.district} (${d.count})` })),
  ];

  const usesPerches = propertyType === 'land' || propertyType === 'house';
  const usesSqft = propertyType === 'apartment' || propertyType === 'house';
  const hasPositivePerchSize = usesPerches && Number(sizePerches) > 0;
  const hasPositiveSqftSize = usesSqft && Number(sizeSqft) > 0;
  const hasEstimateAnchor = !!district || hasPositivePerchSize || hasPositiveSqftSize;
  const estimateLabel = listingType === 'rent'
    ? 'monthly rent'
    : listingType === 'sale'
      ? 'asking value'
      : 'asking value or monthly rent';
  const resultLabel = listingType === 'rent' ? 'Estimated Monthly Rent' : 'Estimated Asking Value';

  const canSubmit = !!propertyType && !!listingType && hasEstimateAnchor;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (!listingType) return;
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

      const res = await getEstimate(params);
      setResult(res);
    } catch {
      setResult(null);
      setError(true);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black">
      <Header />

      <main
        id="main-content"
        className="max-w-3xl mx-auto px-6 pt-10 pb-32 md:pt-12 lg:px-8"
      >
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-[12px] text-[#525252] hover:text-white transition-colors cursor-pointer bg-transparent border-none p-0 mb-8 group"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back
        </button>

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-2xl bg-[#14b8a6]/[0.1] border border-[#14b8a6]/20 flex items-center justify-center">
              <Calculator className="w-4 h-4 text-[#14b8a6]" />
            </div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-[#525252]">Property Intelligence</p>
          </div>
          <h1 className="text-[clamp(1.75rem,4vw,2.75rem)] font-bold text-white tracking-tight leading-none">
            Price Estimator
          </h1>
          <p className="text-[14px] text-[#525252] mt-3">
            Get an estimated {estimateLabel} based on ranked comparable listings from across Sri Lanka.
          </p>
        </div>

        {/* Form */}
        <div className="bg-[#111111] border border-white/[0.08] rounded-2xl p-6 mb-8">
          <div className="space-y-6">
            {/* District */}
            <div>
              <label className="block text-[11px] uppercase tracking-[0.15em] text-[#525252] mb-2">
                District
                <span className="ml-2 normal-case tracking-normal text-[#404040] lowercase">— optional</span>
              </label>
              <MinimalSelect
                options={districtOptions}
                value={district}
                onChange={setDistrict}
              />
              {!district && (
                <p className="text-[10px] text-[#404040] mt-1.5">Leave as "All Districts" for a nationwide estimate.</p>
              )}
            </div>

            {/* Property type pills */}
            <div>
              <label className="block text-[11px] uppercase tracking-[0.15em] text-[#525252] mb-3">Property Type</label>
              <div className="flex flex-wrap gap-2">
                {PROPERTY_TYPES.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setPropertyType(opt.value)}
                    className={`relative px-4 py-2 rounded-full text-[13px] font-medium cursor-pointer border-none transition-colors ${
                      propertyType === opt.value ? 'text-black' : 'bg-transparent text-[#525252] hover:text-white border border-white/[0.08] hover:border-white/[0.14]'
                    }`}
                  >
                    {propertyType === opt.value && (
                      <motion.span
                        layoutId="est-type-pill"
                        className="absolute inset-0 bg-white rounded-full"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Listing type pills */}
            <div>
              <label className="block text-[11px] uppercase tracking-[0.15em] text-[#525252] mb-3">Market Mode</label>
              <div className="grid grid-cols-2 gap-2">
                {LISTING_TYPES.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setListingType(opt.value)}
                    className={`relative py-2 rounded-xl text-[13px] font-semibold cursor-pointer border transition-colors ${
                      listingType === opt.value
                        ? 'bg-[#14b8a6] text-black border-[#14b8a6]'
                        : 'bg-transparent text-[#737373] border-white/[0.08] hover:text-white hover:border-white/[0.14]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Size input */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {usesPerches && (
                <div>
                  <label className="block text-[11px] uppercase tracking-[0.15em] text-[#525252] mb-2">
                    Size (Perches)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 10"
                    value={sizePerches}
                    onChange={e => setSizePerches(e.target.value)}
                    className="w-full bg-[#161616] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white text-[14px] placeholder-[#404040] focus:outline-none focus:border-[#14b8a6]/40 transition-colors"
                  />
                </div>
              )}
              {usesSqft && (
                <div>
                  <label className="block text-[11px] uppercase tracking-[0.15em] text-[#525252] mb-2">
                    Size (Sqft)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 1200"
                    value={sizeSqft}
                    onChange={e => setSizeSqft(e.target.value)}
                    className="w-full bg-[#161616] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white text-[14px] placeholder-[#404040] focus:outline-none focus:border-[#14b8a6]/40 transition-colors"
                  />
                </div>
              )}
            </div>

            {/* Bedrooms */}
            {(propertyType === 'house' || propertyType === 'apartment') && (
              <div>
                <label className="block text-[11px] uppercase tracking-[0.15em] text-[#525252] mb-3">Bedrooms</label>
                <div className="flex flex-wrap gap-2">
                  {[null, 1, 2, 3, 4, 5].map(n => (
                    <button
                      key={String(n)}
                      onClick={() => setBedrooms(n)}
                      className={`px-4 py-1.5 rounded-full text-[13px] font-medium cursor-pointer border transition-colors ${
                        bedrooms === n
                          ? 'bg-[#14b8a6] text-black border-[#14b8a6]'
                          : 'bg-transparent text-[#525252] border-white/[0.08] hover:text-white hover:border-white/[0.14]'
                      }`}
                    >
                      {n == null ? 'Any' : `${n}+`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || loading}
              className={`w-full py-3 rounded-xl text-[14px] font-bold transition-all cursor-pointer border-none ${
                canSubmit && !loading
                  ? 'bg-[#14b8a6] hover:bg-[#0d9488] text-black'
                  : 'bg-white/[0.06] text-[#525252] cursor-not-allowed'
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Estimating…
                </span>
              ) : 'Get Estimate'}
            </button>
            {!canSubmit && (
              <p className="text-[11px] text-[#525252] text-center">
                Choose sale or rent, then add a district or property size to anchor the estimate.
              </p>
            )}
          </div>
        </div>

        {/* Results */}
        <AnimatePresence>
          {hasSubmitted && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              {error ? (
                <div className="bg-[#111111] border border-red-500/20 rounded-2xl p-8 text-center mb-8 flex flex-col items-center gap-3">
                  <AlertCircle className="w-6 h-6 text-red-400" />
                  <p className="text-[14px] text-[#a3a3a3]">Something went wrong. Please try again.</p>
                </div>
              ) : !result || result.comparable_count === 0 ? (
                <div className="bg-[#111111] border border-white/[0.08] rounded-2xl p-8 text-center mb-8">
                  <p className="text-[#525252] text-[14px]">No comparable listings found for this combination.</p>
                  <p className="text-[11px] text-[#404040] mt-2">Try broadening your criteria or selecting a different district.</p>
                </div>
              ) : (
                <>
                  {/* Price range card */}
                  <div className="bg-[#111111] border border-white/[0.08] rounded-2xl p-6 mb-6">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.2em] text-[#525252] mb-1">{resultLabel}</p>
                        <p className="text-[10px] text-[#404040]">
                          Based on {result.comparable_count} comparable listing{result.comparable_count !== 1 ? 's' : ''}
                          {!district ? ' across Sri Lanka' : ` in ${district}`}
                        </p>
                      </div>
                      <span className={`text-[11px] font-medium px-3 py-1 rounded-full border capitalize ${CONFIDENCE_STYLES[result.confidence]}`}>
                        {result.confidence} confidence
                      </span>
                    </div>

                    {/* Why this estimate */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 border-y border-white/[0.06] py-4">
                      <div>
                        <p className="text-[9px] uppercase tracking-[0.15em] text-[#404040] mb-1">Mode</p>
                        <p className="text-[12px] text-white font-semibold capitalize">{result.matched_criteria?.listing_type || listingType}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-[0.15em] text-[#404040] mb-1">Scope</p>
                        <p className="text-[12px] text-white font-semibold capitalize">{result.matched_criteria?.city_scope || (district ? 'district' : 'market')}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-[0.15em] text-[#404040] mb-1">Match</p>
                        <p className="text-[12px] text-white font-semibold">
                          {result.average_similarity_score != null ? `${result.average_similarity_score.toFixed(0)}%` : 'Pending'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-[0.15em] text-[#404040] mb-1">Tier</p>
                        <p className="text-[12px] text-white font-semibold line-clamp-1">{result.match_tier || 'Comparable set'}</p>
                      </div>
                      <p className="col-span-2 sm:col-span-4 text-[11px] text-[#737373] leading-relaxed">
                        {result.confidence_reason || 'Ranked comparable metadata will appear after the API is updated.'}
                      </p>
                    </div>

                    {/* Visual bar */}
                    <PriceRangeBar
                      low={result.estimated_low}
                      median={result.estimated_median}
                      high={result.estimated_high}
                      formatConverted={formatConverted}
                    />

                    {/* Numbers */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="text-center">
                        <p className="text-[10px] uppercase tracking-[0.15em] text-[#525252] mb-1">Low (p25)</p>
                        <p className="text-[1.4rem] font-bold text-white num">{formatConverted(result.estimated_low)}</p>
                      </div>
                      <div className="text-center border-x border-white/[0.06]">
                        <p className="text-[10px] uppercase tracking-[0.15em] text-[#14b8a6] mb-1">Median</p>
                        <p className="text-[1.8rem] font-bold text-white num">{formatConverted(result.estimated_median)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] uppercase tracking-[0.15em] text-[#525252] mb-1">High (p75)</p>
                        <p className="text-[1.4rem] font-bold text-white num">{formatConverted(result.estimated_high)}</p>
                      </div>
                    </div>

                    {/* Per-unit rate */}
                    {(result.median_price_per_perch || result.median_price_per_sqft) && (
                      <div className="flex items-center justify-center gap-6 py-3 mb-4 border-t border-b border-white/[0.06]">
                        {result.median_price_per_perch && (usesPerches) && (
                          <div className="text-center">
                            <p className="text-[10px] uppercase tracking-[0.15em] text-[#525252] mb-0.5">Per Perch</p>
                            <p className="text-[1rem] font-bold text-[#14b8a6] num">{formatConverted(result.median_price_per_perch)}</p>
                          </div>
                        )}
                        {result.median_price_per_sqft && (usesSqft) && (
                          <div className="text-center">
                            <p className="text-[10px] uppercase tracking-[0.15em] text-[#525252] mb-0.5">Per Sqft</p>
                            <p className="text-[1rem] font-bold text-[#14b8a6] num">{formatConverted(result.median_price_per_sqft)}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {listingType === 'sale' && result.estimated_median != null && (
                      <div className="mt-6 border-t border-white/[0.06] pt-6">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-[#525252] mb-2">Financing</p>
                        <p className="text-[13px] text-[#737373] leading-relaxed mb-4 font-assumptions">
                          Keep pricing and affordability as separate steps: review the median estimate first, then test the monthly payment.
                        </p>
                        <EMITeaser
                          priceLkr={result.estimated_median}
                          listingType={listingType}
                          variant="banner"
                          label="Indicative monthly EMI at the median estimate"
                        />
                        <div className="mt-4">
                          <MortgageCalculator
                            listingPrice={result.estimated_median}
                            listingType={listingType}
                            variant="estimate"
                          />
                        </div>
                      </div>
                    )}

                    {/* Browse button */}
                    <button
                      onClick={() => {
                        const p = new URLSearchParams();
                        if (district) p.set('district', district);
                        p.set('type', propertyType);
                        p.set('listing_type', listingType);
                        navigate(`/?${p.toString()}`);
                      }}
                      className="w-full py-2.5 rounded-xl border border-white/[0.08] text-[13px] text-[#a3a3a3] hover:text-white hover:border-white/[0.16] transition-colors cursor-pointer bg-transparent font-medium flex items-center justify-center gap-2"
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      Browse similar listings
                    </button>
                  </div>

                  {/* Comparable listings */}
                  {result.comparables.length > 0 && (
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-[#525252] mb-4">Top Comparable Listings</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {result.comparables.map(c => (
                          <ComparableCard key={c.id} listing={c} formatConverted={formatConverted} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Download report */}
                  <button
                    onClick={() => {
                      const p = new URLSearchParams();
                      if (district) p.set('district', district);
                      p.set('type', propertyType);
                      if (listingType) p.set('listing_type', listingType);
                      if (hasPositivePerchSize) p.set('size_perches', sizePerches);
                      if (hasPositiveSqftSize) p.set('size_sqft', sizeSqft);
                      if (bedrooms != null) p.set('bedrooms', String(bedrooms));
                      window.open(`/report?${p.toString()}`, '_blank');
                    }}
                    className="mt-4 w-full py-3 rounded-xl border border-[#14b8a6]/30 bg-[#14b8a6]/[0.05] text-[#14b8a6] hover:bg-[#14b8a6]/[0.1] hover:border-[#14b8a6]/50 transition-colors cursor-pointer text-[13px] font-semibold flex items-center justify-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    Download Report (PDF)
                  </button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <MobileNav />
      <Footer />
    </div>
  );
}
