import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Calculator, ChevronLeft, TrendingUp, AlertCircle, FileText } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { getDistricts, getEstimate } from '../api';
import type { District, EstimateResult, SimilarListing } from '../api';
import { Header } from './Header';
import { Footer } from './Footer';
import { MobileNav } from './MobileNav';
import { MinimalSelect } from './ui/MinimalSelect';
import { useCurrency } from '../hooks/useCurrency';
import { EMITeaser } from './EMITeaser';
import { MortgageCalculator } from './MortgageCalculator';
import { tx } from '../lib/motion';
import { buildEstimateShareText, buildWhatsAppShareUrl } from '../lib/whatsappShare';

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
  high:   'text-white border-white/25',
  medium: 'text-[#a3a3a3] border-white/15',
  low:    'text-[#737373] border-white/10',
  none:   'text-[#525252] border-white/8',
};

const segBtn = (active: boolean) =>
  `relative px-4 py-2 rounded-lg text-[13px] font-medium cursor-pointer border transition-colors ${
    active
      ? 'bg-white text-black border-white'
      : 'bg-transparent text-[#737373] border-white/[0.1] hover:text-white hover:border-white/[0.2]'
  }`;

const fieldCls =
  'w-full bg-black/40 border border-white/[0.1] rounded-lg px-4 py-2.5 text-white text-[14px] placeholder-[#404040] focus:outline-none focus:border-white/30 transition-colors';

// ---------------------------------------------------------------------------
// Comparable row
// ---------------------------------------------------------------------------

function ComparableRow({ listing, formatConverted }: { listing: SimilarListing; formatConverted: (n: number | null | undefined) => string }) {
  const detailParts = [
    listing.size_perches ? `${listing.size_perches}p` : '',
    listing.size_sqft ? `${listing.size_sqft} sqft` : '',
    listing.bedrooms ? `${listing.bedrooms}BR` : '',
  ].filter(Boolean);

  return (
    <Link
      to={`/listing/${listing.id}`}
      className="flex items-baseline justify-between gap-4 py-3.5 border-b border-white/[0.06] hover:bg-white/[0.02] transition-colors no-underline group px-1 -mx-1"
    >
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-[#a3a3a3] truncate group-hover:text-white transition-colors">
          {listing.city || listing.raw_location || listing.district}
        </p>
        <p className="text-[11px] text-[#525252] mt-0.5">
          {[
            detailParts.join(' · '),
            listing.similarity_score != null ? `${listing.similarity_score.toFixed(0)}% match` : '',
            listing.deal_score != null && listing.deal_score > 0 ? `+${listing.deal_score.toFixed(0)}% deal` : '',
          ].filter(Boolean).join(' · ') || '—'}
        </p>
      </div>
      <p className="text-[15px] font-semibold text-white num shrink-0">
        {listing.price_lkr != null ? formatConverted(listing.price_lkr) : '—'}
      </p>
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
  const range = high - low;
  const medianPct = range > 0 ? ((median - low) / range) * 100 : 50;

  return (
    <div className="mb-8">
      <div className="relative h-px bg-white/[0.12] mx-1">
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white border border-black z-10"
          style={{ left: `calc(${medianPct}% - 4px)` }}
        />
      </div>
      <div className="flex justify-between mt-3 text-[10px] text-[#525252] num">
        <span>{formatConverted(low)}</span>
        <span className="text-white">{formatConverted(median)}</span>
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
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-[12px] text-[#525252] hover:text-white transition-colors cursor-pointer bg-transparent border-none p-0 mb-8 group"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back
        </button>

        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-white/[0.06] border border-white/[0.1] flex items-center justify-center">
              <Calculator className="w-4 h-4 text-white" />
            </div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-[#525252]">Property Intelligence</p>
          </div>
          <h1 className="font-display text-[clamp(1.75rem,4vw,2.75rem)] font-bold text-white tracking-tight leading-none">
            property.lk Price Estimator
          </h1>
          <p className="text-[14px] text-[#525252] mt-3">
            Get an estimated {estimateLabel} based on ranked comparable listings from across Sri Lanka.
          </p>
        </div>

        {/* Form plane */}
        <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-xl p-6 sm:p-8 mb-10">
          <div className="space-y-6">
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

            <div>
              <label className="block text-[11px] uppercase tracking-[0.15em] text-[#525252] mb-3">Property Type</label>
              <div className="flex flex-wrap gap-2">
                {PROPERTY_TYPES.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setPropertyType(opt.value)}
                    className={segBtn(propertyType === opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-[0.15em] text-[#525252] mb-3">Market Mode</label>
              <div className="grid grid-cols-2 gap-2">
                {LISTING_TYPES.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setListingType(opt.value)}
                    className={segBtn(listingType === opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

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
                    className={fieldCls}
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
                    className={fieldCls}
                  />
                </div>
              )}
            </div>

            {(propertyType === 'house' || propertyType === 'apartment') && (
              <div>
                <label className="block text-[11px] uppercase tracking-[0.15em] text-[#525252] mb-3">Bedrooms</label>
                <div className="flex flex-wrap gap-2">
                  {[null, 1, 2, 3, 4, 5].map(n => (
                    <button
                      key={String(n)}
                      onClick={() => setBedrooms(n)}
                      className={segBtn(bedrooms === n)}
                    >
                      {n == null ? 'Any' : `${n}+`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={!canSubmit || loading}
              className={`w-full py-3 rounded-lg text-[14px] font-bold transition-all cursor-pointer border-none ${
                canSubmit && !loading
                  ? 'bg-white hover:bg-[#e8e8e8] text-black'
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

        <AnimatePresence>
          {hasSubmitted && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              {error ? (
                <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-xl p-8 text-center mb-8 flex flex-col items-center gap-3">
                  <AlertCircle className="w-6 h-6 text-[#a3a3a3]" />
                  <p className="text-[14px] text-[#a3a3a3]">Something went wrong. Please try again.</p>
                </div>
              ) : !result || result.comparable_count === 0 ? (
                <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-xl p-8 text-center mb-8">
                  <p className="text-[#525252] text-[14px]">No comparable listings found for this combination.</p>
                  <p className="text-[11px] text-[#404040] mt-2">Try broadening your criteria or selecting a different district.</p>
                </div>
              ) : (
                <>
                  <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-xl p-6 sm:p-8 mb-8">
                    <div className="flex items-start justify-between gap-4 mb-8">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.2em] text-[#525252] mb-1">{resultLabel}</p>
                        <p className="text-[10px] text-[#404040]">
                          Based on {result.comparable_count} comparable listing{result.comparable_count !== 1 ? 's' : ''}
                          {!district ? ' across Sri Lanka' : ` in ${district}`}
                        </p>
                      </div>
                      <span className={`text-[11px] font-medium px-3 py-1 rounded-md border capitalize shrink-0 ${CONFIDENCE_STYLES[result.confidence]}`}>
                        {result.confidence} confidence
                      </span>
                    </div>

                    {/* Number hierarchy — median dominant */}
                    <div className="mb-2">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-[#525252] mb-2">Median</p>
                      <p className="font-display text-[clamp(2.25rem,6vw,3.5rem)] font-bold text-white num leading-none tracking-tight">
                        {formatConverted(result.estimated_median)}
                      </p>
                    </div>
                    <div className="flex items-baseline gap-8 mb-8 mt-5">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.15em] text-[#404040] mb-1">Low</p>
                        <p className="text-[1.05rem] font-medium text-[#737373] num">{formatConverted(result.estimated_low)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.15em] text-[#404040] mb-1">High</p>
                        <p className="text-[1.05rem] font-medium text-[#737373] num">{formatConverted(result.estimated_high)}</p>
                      </div>
                      {(result.median_price_per_perch || result.median_price_per_sqft) && (
                        <>
                          {result.median_price_per_perch && usesPerches && (
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.15em] text-[#404040] mb-1">Per perch</p>
                              <p className="text-[1.05rem] font-medium text-[#a3a3a3] num">{formatConverted(result.median_price_per_perch)}</p>
                            </div>
                          )}
                          {result.median_price_per_sqft && usesSqft && (
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.15em] text-[#404040] mb-1">Per sqft</p>
                              <p className="text-[1.05rem] font-medium text-[#a3a3a3] num">{formatConverted(result.median_price_per_sqft)}</p>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <PriceRangeBar
                      low={result.estimated_low}
                      median={result.estimated_median}
                      high={result.estimated_high}
                      formatConverted={formatConverted}
                    />

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 border-y border-white/[0.06] py-5">
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

                    {listingType === 'sale' && result.estimated_median != null && (
                      <div className="mt-2 mb-6 border-t border-white/[0.06] pt-6">
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

                    <div className="flex flex-col sm:flex-row gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => {
                          const text = buildEstimateShareText({
                            medianLabel: formatConverted(result.estimated_median),
                            lowLabel: formatConverted(result.estimated_low),
                            highLabel: formatConverted(result.estimated_high),
                            district,
                            propertyType,
                            confidence: result.confidence,
                            url: window.location.href,
                          });
                          window.open(buildWhatsAppShareUrl(text), '_blank', 'noopener,noreferrer');
                        }}
                        className="flex-1 py-2.5 rounded-lg border border-white/[0.12] bg-white/[0.04] text-[13px] text-white hover:bg-white/[0.08] transition-colors cursor-pointer font-medium"
                      >
                        Share on WhatsApp
                      </button>
                      <Link
                        to="/report"
                        className="flex-1 py-2.5 rounded-lg border border-white/[0.1] text-[13px] text-[#a3a3a3] hover:text-white hover:border-white/[0.2] transition-colors no-underline text-center font-medium flex items-center justify-center gap-2"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Open report
                      </Link>
                    </div>

                    <button
                      onClick={() => {
                        const p = new URLSearchParams();
                        if (district) p.set('district', district);
                        p.set('type', propertyType);
                        p.set('listing_type', listingType);
                        navigate(`/?${p.toString()}`);
                      }}
                      className="w-full py-2.5 rounded-lg border border-white/[0.1] text-[13px] text-[#a3a3a3] hover:text-white hover:border-white/[0.2] transition-colors cursor-pointer bg-transparent font-medium flex items-center justify-center gap-2"
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      Browse similar listings
                    </button>
                  </div>

                  {result.comparables.length > 0 && (
                    <div className="mb-6">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-[#525252] mb-1">Top Comparable Listings</p>
                      <div className="border-t border-white/[0.08]">
                        {result.comparables.map(c => (
                          <ComparableRow key={c.id} listing={c} formatConverted={formatConverted} />
                        ))}
                      </div>
                    </div>
                  )}

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
                    className="w-full py-3 rounded-lg border border-white/[0.12] bg-white text-black hover:bg-[#e8e8e8] transition-colors cursor-pointer text-[13px] font-semibold flex items-center justify-center gap-2"
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
