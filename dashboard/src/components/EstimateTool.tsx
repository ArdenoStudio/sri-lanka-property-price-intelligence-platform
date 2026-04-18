import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Calculator, ChevronLeft, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getDistricts, getEstimate } from '../api';
import type { District, EstimateResult, SimilarListing } from '../api';
import { Header } from './Header';
import { Footer } from './Footer';
import { MobileNav } from './MobileNav';
import { MinimalSelect } from './ui/MinimalSelect';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNum(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

function formatPrice(n: number | null): string {
  return n != null ? `Rs ${formatNum(n)}` : '—';
}

const PROPERTY_TYPES = [
  { value: 'land', label: 'Land' },
  { value: 'house', label: 'House' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'commercial', label: 'Commercial' },
];

const CONFIDENCE_STYLES: Record<string, string> = {
  high:   'bg-emerald-500/[0.12] text-emerald-400 border-emerald-500/20',
  medium: 'bg-amber-500/[0.12] text-amber-400 border-amber-500/20',
  low:    'bg-red-500/[0.12] text-red-400 border-red-500/20',
  none:   'bg-white/[0.05] text-[#525252] border-white/10',
};

// ---------------------------------------------------------------------------
// Comparable card (reuses SimilarCard aesthetic)
// ---------------------------------------------------------------------------

function ComparableCard({ listing }: { listing: SimilarListing }) {
  return (
    <Link
      to={`/listing/${listing.id}`}
      className="block bg-[#161616] border border-white/[0.06] rounded-2xl p-4 hover:border-white/[0.12] transition-colors no-underline group"
    >
      <p className="text-[16px] font-bold text-white num mb-1">
        {formatPrice(listing.price_lkr)}
      </p>
      <p className="text-[11px] text-[#525252] mb-2 line-clamp-1">
        {listing.city || listing.raw_location || listing.district}
      </p>
      {(listing.size_perches || listing.bedrooms) && (
        <p className="text-[11px] text-[#404040]">
          {listing.size_perches ? `${listing.size_perches}p` : ''}
          {listing.size_perches && listing.bedrooms ? ' · ' : ''}
          {listing.bedrooms ? `${listing.bedrooms}BR` : ''}
        </p>
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
// Main
// ---------------------------------------------------------------------------

export function EstimateTool() {
  const navigate = useNavigate();
  const [districts, setDistricts] = useState<District[]>([]);

  // Form state
  const [district, setDistrict] = useState('');
  const [propertyType, setPropertyType] = useState('house');
  const [sizePerches, setSizePerches] = useState('');
  const [sizeSqft, setSizeSqft] = useState('');
  const [bedrooms, setBedrooms] = useState<number | null>(null);

  // Result state
  const [result, setResult] = useState<EstimateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  useEffect(() => {
    getDistricts().then(setDistricts).catch(() => {});
  }, []);

  const districtOptions = [
    { value: '', label: 'All Districts' },
    ...districts.map(d => ({ value: d.district, label: `${d.district} (${d.count})` })),
  ];

  const usesPerches = propertyType === 'land' || propertyType === 'house';
  const usesSqft = propertyType === 'apartment' || propertyType === 'house';

  const canSubmit = !!district && !!propertyType;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setHasSubmitted(true);
    try {
      const params: Parameters<typeof getEstimate>[0] = {
        district,
        property_type: propertyType,
      };
      if (sizePerches && usesPerches) params.size_perches = Number(sizePerches);
      if (sizeSqft && usesSqft) params.size_sqft = Number(sizeSqft);
      if (bedrooms != null) params.bedrooms = bedrooms;

      const res = await getEstimate(params);
      setResult(res);
    } catch {
      setResult(null);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black">
      <Header />

      <main className="max-w-3xl mx-auto px-6 lg:px-8 pt-28 pb-32">
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
            Get an estimated market value based on real listing data from across Sri Lanka.
          </p>
        </div>

        {/* Form */}
        <div className="bg-[#111111] border border-white/[0.08] rounded-2xl p-6 mb-8">
          <div className="space-y-6">
            {/* District */}
            <div>
              <label className="block text-[11px] uppercase tracking-[0.15em] text-[#525252] mb-2">District</label>
              <MinimalSelect
                options={districtOptions}
                value={district}
                onChange={setDistrict}
              />
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
              {!result || result.comparable_count === 0 ? (
                <div className="bg-[#111111] border border-white/[0.08] rounded-2xl p-8 text-center mb-8">
                  <p className="text-[#525252] text-[14px]">No comparable listings found for this combination.</p>
                  <p className="text-[11px] text-[#404040] mt-2">Try broadening your criteria.</p>
                </div>
              ) : (
                <>
                  {/* Price range card */}
                  <div className="bg-[#111111] border border-white/[0.08] rounded-2xl p-6 mb-6">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.2em] text-[#525252] mb-1">Estimated Value</p>
                        <p className="text-[10px] text-[#404040]">
                          Based on {result.comparable_count} comparable listings
                        </p>
                      </div>
                      <span className={`text-[11px] font-medium px-3 py-1 rounded-full border capitalize ${CONFIDENCE_STYLES[result.confidence]}`}>
                        {result.confidence} confidence
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="text-center">
                        <p className="text-[10px] uppercase tracking-[0.15em] text-[#525252] mb-1">Low (p25)</p>
                        <p className="text-[1.4rem] font-bold text-white num">{formatPrice(result.estimated_low)}</p>
                      </div>
                      <div className="text-center border-x border-white/[0.06]">
                        <p className="text-[10px] uppercase tracking-[0.15em] text-[#14b8a6] mb-1">Median</p>
                        <p className="text-[1.8rem] font-bold text-white num">{formatPrice(result.estimated_median)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] uppercase tracking-[0.15em] text-[#525252] mb-1">High (p75)</p>
                        <p className="text-[1.4rem] font-bold text-white num">{formatPrice(result.estimated_high)}</p>
                      </div>
                    </div>

                    {/* Browse button */}
                    <button
                      onClick={() => navigate(`/?district=${encodeURIComponent(district)}&type=${encodeURIComponent(propertyType)}`)}
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
                          <ComparableCard key={c.id} listing={c} />
                        ))}
                      </div>
                    </div>
                  )}
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
