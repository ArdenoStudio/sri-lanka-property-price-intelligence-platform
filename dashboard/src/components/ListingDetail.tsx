import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ChevronLeft, ExternalLink, MapPin, Home, BedDouble, Bath, Ruler, Calendar, TrendingDown,
  Waves, Car, Wind, Shield, Trees, Sofa, Building2, ArrowUpDown, Dumbbell, Sun, Droplet,
  Refrigerator, Flame, Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getListingDetail, getListingSimilar } from '../api';
import type { ListingDetail as ListingDetailType, SimilarListing } from '../api';
import { Header } from './Header';
import { Footer } from './Footer';
import { MobileNav } from './MobileNav';
import { PriceHistoryChart } from './PriceHistoryChart';
import { ShareButton } from './ShareButton';
import { MortgageCalculator } from './MortgageCalculator';
import { RentalYieldPanel } from './RentalYieldPanel';
import { useCurrency } from '../hooks/useCurrency';

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

function formatTimeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / 86400000);
    if (days < 1) return 'today';
    if (days === 1) return '1 day ago';
    if (days < 30) return `${days} days ago`;
    if (days < 365) return `${Math.floor(days / 30)} mo ago`;
    return `${Math.floor(days / 365)}yr ago`;
  } catch {
    return iso;
  }
}

const TYPE_COLORS: Record<string, string> = {
  land:       'bg-amber-500/[0.12] text-amber-400 border-amber-500/20',
  house:      'bg-blue-500/[0.12] text-blue-400 border-blue-500/20',
  apartment:  'bg-purple-500/[0.12] text-purple-400 border-purple-500/20',
  commercial: 'bg-orange-500/[0.12] text-orange-400 border-orange-500/20',
  villa:      'bg-emerald-500/[0.12] text-emerald-400 border-emerald-500/20',
};

// ---------------------------------------------------------------------------
// Deal Score Gauge
// ---------------------------------------------------------------------------

function DealScoreGauge({ score }: { score: number | null | undefined }) {
  if (score == null) return null;
  const clamped = Math.max(-100, Math.min(100, score));
  const cx = 60, cy = 60, r = 44;
  const progress = (clamped + 100) / 200;           // 0..1, left → right
  const rad = -Math.PI + progress * Math.PI;        // -π..0 (top-half arc, screen coords)
  const nx = cx + r * Math.cos(rad);
  const ny = cy + r * Math.sin(rad);

  const isGood = clamped >= 0;
  const color = clamped >= 20 ? '#10b981' : clamped >= 0 ? '#14b8a6' : clamped >= -20 ? '#f59e0b' : '#ef4444';
  const label = clamped >= 20 ? 'Great deal' : clamped >= 0 ? 'Fair price' : clamped >= -20 ? 'Slightly high' : 'Overpriced';

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width="120" height="70" viewBox="0 0 120 70" className="overflow-visible">
        <path
          d="M 16 60 A 44 44 0 0 1 104 60"
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        {clamped !== -100 && (
          <path
            d={`M 16 60 A 44 44 0 0 1 ${nx.toFixed(1)} ${ny.toFixed(1)}`}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            opacity="0.8"
          />
        )}
        <circle cx={nx.toFixed(1)} cy={ny.toFixed(1)} r="5" fill={color} />
      </svg>
      <div className="text-center">
        <p className="text-[11px] uppercase tracking-[0.15em] text-[#525252]">Deal Score</p>
        <p className="text-[22px] font-bold num" style={{ color }}>
          {isGood ? '+' : ''}{clamped.toFixed(0)}
        </p>
        <p className="text-[10px]" style={{ color }}>{label}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Amenities extractor
// ---------------------------------------------------------------------------

const AMENITY_RULES: { pattern: RegExp; label: string; icon: LucideIcon }[] = [
  { pattern: /\bswimming pool|\bpool\b/i, label: 'Pool', icon: Waves },
  { pattern: /\b(car\s*park|parking|garage)\b/i, label: 'Parking', icon: Car },
  { pattern: /\b(air\s*cond(ition(ing|ed)?)?|a\/c|a\.c\.?|aircon)\b/i, label: 'Air Conditioning', icon: Wind },
  { pattern: /\b(cctv|24\s*hr\s*security|24\/7\s*security|security)\b/i, label: 'Security', icon: Shield },
  { pattern: /\b(garden|lawn|landscaped)\b/i, label: 'Garden', icon: Trees },
  { pattern: /\bfully\s*furnished|\bfurnished\b(?!\s*un)/i, label: 'Furnished', icon: Sofa },
  { pattern: /\bsemi[-\s]*furnished\b/i, label: 'Semi-furnished', icon: Sofa },
  { pattern: /\bunfurnished\b/i, label: 'Unfurnished', icon: Sofa },
  { pattern: /\bbalcon(y|ies)\b/i, label: 'Balcony', icon: Building2 },
  { pattern: /\b(lift|elevator)\b/i, label: 'Elevator', icon: ArrowUpDown },
  { pattern: /\bgym(nasium)?\b/i, label: 'Gym', icon: Dumbbell },
  { pattern: /\bsolar\b/i, label: 'Solar', icon: Sun },
  { pattern: /\b(hot\s*water|water\s*heater)\b/i, label: 'Hot water', icon: Flame },
  { pattern: /\b(well\s*water|tube\s*well|water\s*supply)\b/i, label: 'Water supply', icon: Droplet },
  { pattern: /\b(servant|maid|servant'?s\s*room|maid'?s\s*room)\b/i, label: 'Servant room', icon: BedDouble },
  { pattern: /\b(pantry|modern\s*kitchen|kitchenette)\b/i, label: 'Pantry', icon: Refrigerator },
  { pattern: /\b(rooftop|roof\s*top|sky\s*deck)\b/i, label: 'Rooftop', icon: Building2 },
  { pattern: /\bbrand\s*new\b|\bnewly\s*built\b/i, label: 'Brand new', icon: Sparkles },
];

function extractAmenities(text: string | null | undefined): { label: string; icon: LucideIcon }[] {
  if (!text) return [];
  const found = new Map<string, LucideIcon>();
  for (const { pattern, label, icon } of AMENITY_RULES) {
    if (pattern.test(text) && !found.has(label)) found.set(label, icon);
    if (found.size >= 12) break;
  }
  return Array.from(found, ([label, icon]) => ({ label, icon }));
}

// ---------------------------------------------------------------------------
// Similar listing card
// ---------------------------------------------------------------------------

function SimilarCard({ listing }: { listing: SimilarListing }) {
  const typeClass = TYPE_COLORS[listing.property_type || ''] || 'bg-white/[0.05] text-[#a3a3a3] border-white/10';
  return (
    <Link
      to={`/listing/${listing.id}`}
      className="block bg-[#111111] border border-white/[0.08] rounded-2xl p-4 hover:border-white/[0.16] transition-colors no-underline group"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${typeClass} capitalize`}>
          {listing.property_type}
        </span>
        {listing.deal_score != null && listing.deal_score > 0 && (
          <span className="text-[10px] text-emerald-400 font-medium bg-emerald-400/[0.08] px-2 py-0.5 rounded-full border border-emerald-400/20">
            +{listing.deal_score.toFixed(0)}% deal
          </span>
        )}
      </div>
      <p className="text-[18px] font-bold text-white num mb-1">
        {listing.price_lkr != null ? `Rs ${formatNum(listing.price_lkr)}` : listing.raw_price || '—'}
      </p>
      <p className="text-[12px] text-[#525252] mb-2 line-clamp-1">
        {listing.city || listing.raw_location || listing.district}
      </p>
      {(listing.size_perches || listing.bedrooms) && (
        <p className="text-[11px] text-[#404040]">
          {listing.size_perches ? `${listing.size_perches}p` : ''}
          {listing.size_perches && listing.bedrooms ? ' · ' : ''}
          {listing.bedrooms ? `${listing.bedrooms}BR` : ''}
          {listing.days_on_market != null ? ` · ${listing.days_on_market}d` : ''}
        </p>
      )}
      <p className="text-[10px] text-[#525252] mt-2 group-hover:text-[#a3a3a3] transition-colors">
        View details →
      </p>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function Skeleton() {
  return (
    <div className="min-h-screen bg-black">
      <Header />
      <main className="max-w-5xl mx-auto px-6 lg:px-8 pt-28 pb-32">
        <div className="h-4 w-24 bg-white/[0.06] rounded animate-pulse mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          <div className="lg:col-span-2 space-y-4">
            <div className="h-12 w-3/4 bg-white/[0.06] rounded animate-pulse" />
            <div className="h-6 w-1/3 bg-white/[0.06] rounded animate-pulse" />
            <div className="h-4 w-1/2 bg-white/[0.06] rounded animate-pulse" />
          </div>
          <div className="h-32 bg-white/[0.06] rounded-2xl animate-pulse" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-white/[0.04] rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="h-[200px] bg-white/[0.04] rounded-2xl animate-pulse mb-12" />
      </main>
      <MobileNav />
      <Footer />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<ListingDetailType | null>(null);
  const [similar, setSimilar] = useState<SimilarListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const reqRef = useRef(0);

  const numId = id ? parseInt(id, 10) : NaN;

  useEffect(() => {
    if (isNaN(numId)) { setError(true); setLoading(false); return; }
    const reqId = ++reqRef.current;
    setLoading(true);
    setError(false);

    Promise.all([
      getListingDetail(numId),
      getListingSimilar(numId),
    ])
      .then(([d, s]) => {
        if (reqRef.current !== reqId) return;
        setDetail(d);
        setSimilar(s);
        setLoading(false);
        document.title = `${d.title || 'Listing'} — PropertyLK`;
        document.querySelector('meta[property="og:title"]')?.setAttribute('content', d.title || 'Property — PropertyLK');
        document.querySelector('meta[property="og:url"]')?.setAttribute('content', window.location.href);
        if (d.price_lkr) {
          document.querySelector('meta[property="og:description"]')?.setAttribute(
            'content',
            `${d.property_type} in ${d.district} for Rs ${formatNum(d.price_lkr)}${d.deal_score && d.deal_score > 0 ? ` · ${d.deal_score.toFixed(0)}% below market` : ''}`
          );
        }
        document.querySelector('meta[property="og:image"]')?.setAttribute(
          'content', `/api/og-image/${d.id}`
        );
      })
      .catch(() => {
        if (reqRef.current !== reqId) return;
        setError(true);
        setLoading(false);
      });

    return () => {
      document.title = 'PropertyLK — Sri Lanka Property Price Intelligence';
    };
  }, [numId]);

  if (loading) return <Skeleton />;

  if (error || !detail) {
    return (
      <div className="min-h-screen bg-black">
        <Header />
        <main className="max-w-5xl mx-auto px-6 pt-32 pb-32 text-center">
          <p className="text-[#525252] text-[13px] uppercase tracking-widest mb-4">Not Found</p>
          <h1 className="text-2xl font-bold text-white mb-6">This listing doesn't exist</h1>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2.5 bg-[#14b8a6] text-black text-[13px] font-bold rounded-xl cursor-pointer border-none hover:bg-[#0d9488] transition-colors"
          >
            Back to listings
          </button>
        </main>
        <MobileNav />
        <Footer />
      </div>
    );
  }

  const { formatConverted } = useCurrency();
  const typeClass = TYPE_COLORS[detail.property_type || ''] || 'bg-white/[0.05] text-[#a3a3a3] border-white/10';
  const descTrimmed = detail.description && detail.description.length > 300 && !descExpanded
    ? detail.description.slice(0, 300) + '…'
    : detail.description;
  const amenities = extractAmenities(detail.description);
  const locationText = [detail.city, detail.district].filter(Boolean).join(', ') || detail.raw_location || null;

  return (
    <div className="min-h-screen bg-black">
      <Header />

      <main className="max-w-5xl mx-auto px-6 lg:px-8 pt-28 pb-32">
        {/* Back navigation */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-[12px] text-[#525252] hover:text-white transition-colors cursor-pointer bg-transparent border-none p-0 mb-8 group"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to listings
        </button>

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium border capitalize ${typeClass}`}>
                {detail.property_type}
              </span>
              {detail.listing_type && (
                <span className="text-[11px] text-[#525252] border border-white/[0.08] px-2.5 py-1 rounded-full capitalize">
                  For {detail.listing_type}
                </span>
              )}
            </div>

            <h1 className="text-[clamp(1.5rem,3vw,2.5rem)] font-bold text-white tracking-tight leading-tight mb-3">
              {detail.price_lkr != null
                ? formatConverted(detail.price_lkr)
                : detail.raw_price || '—'}
              {detail.price_per_perch && detail.property_type === 'land' && (
                <span className="text-[#525252] text-base font-normal ml-2">/ perch</span>
              )}
            </h1>

            {detail.price_drop_pct != null && detail.price_drop_pct > 0 && (
              <div className="flex items-center gap-1.5 mb-3">
                <TrendingDown className="w-4 h-4 text-amber-400" />
                <span className="text-[13px] text-amber-400 font-medium">
                  {detail.price_drop_pct.toFixed(1)}% price drop from{' '}
                  {detail.original_price_lkr ? formatConverted(detail.original_price_lkr) : 'original'}
                </span>
              </div>
            )}

            <div className="flex items-center gap-1.5 text-[13px] text-[#525252] mb-6">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span>{[detail.city, detail.district].filter(Boolean).join(', ') || detail.raw_location || '—'}</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {detail.url && (
                <a
                  href={detail.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#14b8a6] text-black text-[13px] font-bold rounded-xl hover:bg-[#0d9488] transition-colors no-underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View on {detail.source === 'lpw' ? 'LPW' : detail.source === 'lamudi' ? 'house.lk' : detail.source}
                </a>
              )}
              <ShareButton listing={detail} />
            </div>
          </div>

          {/* Deal score gauge */}
          <div className="bg-[#111111] border border-white/[0.08] rounded-2xl p-6 flex items-center justify-center">
            <DealScoreGauge score={detail.deal_score} />
          </div>
        </div>

        {/* ── Details Grid ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-12">
          {[
            { icon: BedDouble, label: 'Bedrooms', value: detail.bedrooms != null ? `${detail.bedrooms} BR` : null },
            { icon: Bath, label: 'Bathrooms', value: detail.bathrooms != null ? `${detail.bathrooms} BA` : null },
            { icon: Ruler, label: 'Size', value: detail.size_perches ? `${detail.size_perches} perches` : detail.size_sqft ? `${detail.size_sqft?.toLocaleString()} sqft` : null },
            { icon: Home, label: 'Price/Perch', value: detail.price_per_perch ? formatConverted(detail.price_per_perch) : null },
            { icon: Calendar, label: 'Listed', value: detail.days_on_market != null ? `${detail.days_on_market} days` : detail.first_seen_at ? formatTimeAgo(detail.first_seen_at) : null },
          ].filter(d => d.value != null).map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-[#111111] border border-white/[0.06] rounded-2xl p-4">
              <Icon className="w-4 h-4 text-[#525252] mb-2" />
              <p className="text-[10px] uppercase tracking-[0.15em] text-[#525252] mb-0.5">{label}</p>
              <p className="text-[14px] font-bold text-white num">{value}</p>
            </div>
          ))}
          {detail.market_median_lkr && (
            <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-4">
              <TrendingDown className="w-4 h-4 text-[#525252] mb-2" />
              <p className="text-[10px] uppercase tracking-[0.15em] text-[#525252] mb-0.5">Market Median</p>
              <p className="text-[14px] font-bold text-white num">{formatConverted(detail.market_median_lkr)}</p>
            </div>
          )}
        </div>

        {/* ── Amenities ────────────────────────────────────────────────── */}
        {amenities.length > 0 && (
          <div className="mb-12">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#525252] mb-4">Amenities</p>
            <div className="flex flex-wrap gap-2">
              {amenities.map(({ label, icon: Icon }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 bg-[#111111] border border-white/[0.08] rounded-full px-3 py-1.5 text-[12px] text-[#a3a3a3]"
                >
                  <Icon className="w-3.5 h-3.5 text-[#14b8a6]" />
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Description ─────────────────────────────────────────────── */}
        <div className="mb-12">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#525252] mb-4">Description</p>
          {detail.description ? (
            <>
              <p className="text-[14px] text-[#a3a3a3] leading-relaxed whitespace-pre-line">{descTrimmed}</p>
              {detail.description.length > 300 && (
                <button
                  onClick={() => setDescExpanded(e => !e)}
                  className="text-[12px] text-[#14b8a6] hover:text-[#5eead4] mt-3 cursor-pointer bg-transparent border-none p-0 transition-colors"
                >
                  {descExpanded ? 'Show less' : 'Read more'}
                </button>
              )}
            </>
          ) : (
            <p className="text-[13px] text-[#525252] italic">No description provided by source.</p>
          )}
        </div>

        {/* ── Price History Chart ──────────────────────────────────────── */}
        {detail.price_history && detail.price_history.length > 0 && (
          <div className="mb-12">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#525252] mb-4">Price History</p>
            <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-6">
              <PriceHistoryChart size="full" snapshots={detail.price_history} />
            </div>
          </div>
        )}

        {/* ── Rental Yield & Investment Analysis ───────────────────────── */}
        {(detail.property_type === 'apartment' || detail.property_type === 'house') &&
          detail.listing_type === 'sale' && detail.district && (
          <div className="mb-12">
            <RentalYieldPanel
              district={detail.district}
              propertyType={detail.property_type}
              listingType={detail.listing_type}
              bedrooms={detail.bedrooms}
              dealScore={detail.deal_score}
            />
          </div>
        )}

        {/* ── Mortgage Calculator ───────────────────────────────────────── */}
        {detail.listing_type !== 'rent' && detail.price_lkr && (
          <div className="mb-12">
            <MortgageCalculator listingPrice={detail.price_lkr} listingType={detail.listing_type} />
          </div>
        )}

        {/* ── Map ──────────────────────────────────────────────────────── */}
        <div className="mb-12">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#525252] mb-4">Location</p>
          {detail.lat && detail.lng ? (
            <>
              <div className="h-[400px] lg:h-[480px] rounded-2xl overflow-hidden border border-white/[0.06]">
                <iframe
                  title="Property location"
                  width="100%"
                  height="100%"
                  style={{ border: 0, filter: 'invert(1) hue-rotate(180deg) brightness(0.9) contrast(1.1)' }}
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${detail.lng - 0.01},${detail.lat - 0.008},${detail.lng + 0.01},${detail.lat + 0.008}&layer=mapnik&marker=${detail.lat},${detail.lng}`}
                />
              </div>
              <a
                href={`https://www.openstreetmap.org/?mlat=${detail.lat}&mlon=${detail.lng}#map=16/${detail.lat}/${detail.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-3 text-[12px] text-[#525252] hover:text-[#14b8a6] transition-colors no-underline"
              >
                <ExternalLink className="w-3 h-3" />
                Open in OpenStreetMap
              </a>
            </>
          ) : (
            <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-6 flex items-center gap-3">
              <MapPin className="w-5 h-5 text-[#525252] shrink-0" />
              <div>
                <p className="text-[13px] text-white">{locationText || 'Location unavailable'}</p>
                <p className="text-[11px] text-[#525252] mt-0.5">Exact coordinates not available for this listing.</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Similar Listings ─────────────────────────────────────────── */}
        <div className="mb-12">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#525252] mb-4">Similar Listings</p>
          {similar.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {similar.map(s => <SimilarCard key={s.id} listing={s} />)}
            </div>
          ) : (
            <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-6 text-center">
              <p className="text-[13px] text-[#525252]">No similar listings yet — check back soon.</p>
            </div>
          )}
        </div>
      </main>

      <MobileNav />
      <Footer />
    </div>
  );
}
