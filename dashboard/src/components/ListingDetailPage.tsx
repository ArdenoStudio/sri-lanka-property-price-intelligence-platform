import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Bath,
  BedDouble,
  Calendar,
  ChevronLeft,
  ExternalLink,
  Home,
  MapPin,
  Ruler,
  TrendingDown,
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
import { EMITeaser } from './EMITeaser';
import { useCurrency } from '../hooks/useCurrency';
import { getDealScoreMeta, isTypicalDealScore } from '../lib/dealScore';
import { DealScoreCard } from './DealScore';
import { enter } from '../lib/motion';

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

function daysColor(days: number | null | undefined): string {
  if (days == null || days < 7) return '#ffffff';
  if (days < 30) return '#a3a3a3';
  return '#737373';
}

function formatDaysListed(days: number | null | undefined, fallback: string | null | undefined): string | null {
  if (days === 0) return 'New today';
  if (days != null) return `${days} days`;
  return fallback ? formatTimeAgo(fallback) : null;
}

function extractAmenities(text: string | null | undefined): string[] {
  if (!text) return [];
  const matches = [
    ['pool', /\bpool\b|swimming pool/i],
    ['parking', /parking|garage|car park/i],
    ['air conditioning', /air\s*cond|aircon|a\/c/i],
    ['security', /security|cctv/i],
    ['garden', /garden|lawn|landscaped/i],
    ['furnished', /furnished/i],
    ['balcony', /balcon/i],
    ['elevator', /elevator|lift/i],
    ['gym', /gym/i],
    ['solar', /solar/i],
    ['hot water', /hot water|water heater/i],
    ['pantry', /pantry|kitchenette/i],
  ] as const;

  return matches.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
}

function SimilarCard({
  listing,
  formatConverted,
}: {
  listing: SimilarListing;
  formatConverted: (
    n: number | null | undefined,
    opts?: { variant?: 'hero' | 'table' | 'default' | 'axis' },
  ) => string;
}) {
  return (
    <Link
      to={`/listing/${listing.id}`}
      className="similar-rail__card group block no-underline snap-start"
    >
      <p className="text-[clamp(1.15rem,2.2vw,1.35rem)] font-bold text-white num font-price-hero mb-1.5 leading-none">
        {listing.price_lkr != null
          ? formatConverted(listing.price_lkr, { variant: 'hero' })
          : listing.raw_price || '—'}
      </p>
      <p className="text-[12px] text-[#737373] mb-2 line-clamp-1">
        {listing.city || listing.raw_location || listing.district}
      </p>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-[#525252] capitalize">{listing.property_type}</span>
        {listing.deal_score != null && listing.deal_score > 0 && (
          <span className="text-[11px] text-white num font-medium">
            +{listing.deal_score.toFixed(0)}%
          </span>
        )}
      </div>
      <p className="text-[10px] text-[#404040] mt-3 group-hover:text-[#a3a3a3] transition-colors">
        View details →
      </p>
    </Link>
  );
}

function Skeleton() {
  return (
    <div className="min-h-screen bg-black listing-detail-shell">
      <Header />
      <main className="relative max-w-5xl mx-auto px-6 lg:px-8 pt-28 pb-32">
        <div className="h-4 w-24 bg-white/[0.06] rounded animate-pulse mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 mb-12">
          <div className="lg:col-span-7 space-y-4">
            <div className="h-12 w-3/4 bg-white/[0.06] rounded animate-pulse" />
            <div className="h-6 w-1/3 bg-white/[0.06] rounded animate-pulse" />
            <div className="h-4 w-1/2 bg-white/[0.06] rounded animate-pulse" />
          </div>
          <div className="lg:col-span-5 h-40 bg-white/[0.04] rounded-2xl animate-pulse" />
        </div>
      </main>
      <MobileNav />
      <Footer />
    </div>
  );
}

function ErrorState({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-screen bg-black">
      <Header />
      <main className="max-w-5xl mx-auto px-6 pt-32 pb-32 text-center">
        <p className="text-[#525252] text-[13px] uppercase tracking-widest mb-4">Not Found</p>
        <h1 className="text-2xl font-bold text-white mb-6">This listing doesn't exist</h1>
        <button
          onClick={onBack}
          className="px-6 py-2.5 bg-white text-black text-[13px] font-bold rounded-xl cursor-pointer border-none hover:bg-[#d4d4d4] transition-colors"
        >
          Back to listings
        </button>
      </main>
      <MobileNav />
      <Footer />
    </div>
  );
}

export function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const { formatConverted } = useCurrency();
  const [detail, setDetail] = useState<ListingDetailType | null>(null);
  const [similar, setSimilar] = useState<SimilarListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [daysSinceLastSeen, setDaysSinceLastSeen] = useState<number | null>(null);

  const numId = id ? parseInt(id, 10) : NaN;
  const invalidId = Number.isNaN(numId);

  useEffect(() => {
    if (invalidId) return;

    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(false);
      try {
        const [d, s] = await Promise.all([getListingDetail(numId), getListingSimilar(numId)]);
        if (cancelled) return;
        setDetail(d);
        setSimilar(s);
        setDaysSinceLastSeen(
          d.last_seen_at
            ? Math.floor((Date.now() - new Date(d.last_seen_at).getTime()) / 86400000)
            : null,
        );
        document.title = `${d.title || 'Listing'} — property.lk`;
        document
          .querySelector('meta[property="og:title"]')
          ?.setAttribute('content', d.title || 'Property — property.lk');
        document
          .querySelector('meta[property="og:url"]')
          ?.setAttribute('content', window.location.href);
        if (d.price_lkr) {
          const dealSummary =
            d.deal_score != null && !isTypicalDealScore(d.deal_score)
              ? ` · ${getDealScoreMeta(d.deal_score).shortCopy.toLowerCase()}`
              : '';
          document.querySelector('meta[property="og:description"]')?.setAttribute(
            'content',
            `${d.property_type} in ${d.district} for ${formatConverted(d.price_lkr)}${dealSummary}`,
          );
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      document.title = 'property.lk — Sri Lanka Property Price Intelligence';
    };
  }, [formatConverted, invalidId, numId]);

  const amenities = useMemo(() => extractAmenities(detail?.description), [detail?.description]);
  const descTrimmed =
    detail?.description && detail.description.length > 300 && !descExpanded
      ? `${detail.description.slice(0, 300)}…`
      : detail?.description;
  const locationText = detail
    ? [detail.city, detail.district].filter(Boolean).join(', ') || detail.raw_location || null
    : null;
  const headlinePrice = detail
    ? {
        text:
          detail.price_lkr != null
            ? formatConverted(detail.price_lkr)
            : detail.raw_price ||
              (detail.price_per_perch ? formatConverted(detail.price_per_perch) : '—'),
        suffix: detail.price_per_perch && detail.property_type === 'land' ? '/ perch' : null,
      }
    : null;

  if (invalidId) return <ErrorState onBack={() => navigate('/')} />;
  if (loading) return <Skeleton />;
  if (error || !detail) return <ErrorState onBack={() => navigate('/')} />;

  const detailSpecs: { icon: LucideIcon; label: string; value: string | null; color?: string }[] = [
    {
      icon: BedDouble,
      label: 'Bedrooms',
      value: detail.bedrooms != null ? `${detail.bedrooms} BR` : null,
    },
    {
      icon: Bath,
      label: 'Bathrooms',
      value: detail.bathrooms != null ? `${detail.bathrooms} BA` : null,
    },
    {
      icon: Ruler,
      label: 'Size',
      value: detail.size_perches
        ? `${detail.size_perches} perches`
        : detail.size_sqft
          ? `${detail.size_sqft.toLocaleString()} sqft`
          : null,
    },
    {
      icon: Home,
      label: 'Price/Perch',
      value: detail.price_per_perch
        ? formatConverted(detail.price_per_perch, { variant: 'table' })
        : null,
    },
    {
      icon: Calendar,
      label: 'Listed',
      value: formatDaysListed(detail.days_on_market, detail.first_seen_at),
      color: daysColor(detail.days_on_market),
    },
  ];
  const visibleSpecs = detailSpecs.filter((spec) => spec.value != null);

  return (
    <div className="min-h-screen bg-black listing-detail-shell">
      <div className="listing-detail-atmosphere" aria-hidden="true" />
      <Header />
      <main className="relative max-w-5xl mx-auto px-6 lg:px-8 pt-28 pb-32">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-[12px] text-[#525252] hover:text-white transition-colors cursor-pointer bg-transparent border-none p-0 mb-8 group"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to listings
        </button>

        {daysSinceLastSeen != null && daysSinceLastSeen > 7 && (
          <div className="border border-white/15 bg-white/[0.04] rounded-2xl px-4 py-3 mb-8 flex items-center gap-3">
            <Calendar className="w-4 h-4 text-[#a3a3a3] shrink-0" />
            <p className="text-[13px] text-[#a3a3a3]">
              Last confirmed {daysSinceLastSeen} days ago — this listing may no longer be available.{' '}
              {detail.url && (
                <a
                  href={detail.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-white"
                >
                  Verify on source
                </a>
              )}
            </p>
          </div>
        )}

        {/* Hero: price + deal score as siblings (no card chrome on deal) */}
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 mb-14"
          {...enter(reduce)}
        >
          <div className="lg:col-span-7">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium border border-white/15 text-[#e5e5e5] capitalize">
                {detail.property_type}
              </span>
              {detail.listing_type && (
                <span className="text-[11px] text-[#737373] border border-white/[0.1] px-2.5 py-1 rounded-full capitalize">
                  For {detail.listing_type}
                </span>
              )}
            </div>

            <h1 className="text-[clamp(2rem,4.5vw,3.25rem)] font-bold text-white tracking-tight leading-[0.95] mb-4 num font-price-hero font-display">
              {headlinePrice?.text || '—'}
              {headlinePrice?.suffix && (
                <span className="text-[#525252] text-base font-normal ml-2 font-body">
                  {headlinePrice.suffix}
                </span>
              )}
            </h1>

            {detail.title && (
              <p className="text-[15px] text-[#a3a3a3] mb-3 leading-snug max-w-xl">{detail.title}</p>
            )}

            {detail.price_drop_pct != null && detail.price_drop_pct > 0 && (
              <div className="flex items-center gap-1.5 mb-3">
                <TrendingDown className="w-4 h-4 text-[#a3a3a3]" />
                <span className="text-[13px] text-[#a3a3a3] font-medium">
                  {detail.price_drop_pct.toFixed(1)}% price drop from{' '}
                  {detail.original_price_lkr
                    ? formatConverted(detail.original_price_lkr, { variant: 'table' })
                    : 'original'}
                </span>
              </div>
            )}

            <div className="flex items-center gap-1.5 text-[13px] text-[#737373] mb-8">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span>{locationText || '—'}</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {detail.url && (
                <a
                  href={detail.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-black text-[13px] font-bold rounded-xl hover:bg-[#d4d4d4] transition-colors no-underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View source
                </a>
              )}
              <ShareButton listing={detail} />
            </div>
          </div>

          <div className="lg:col-span-5 lg:pl-6 lg:border-l lg:border-white/[0.08]">
            {detail.deal_score != null ? (
              <DealScoreCard score={detail.deal_score} surface="dark" compact />
            ) : (
              <>
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#525252]">Deal score</p>
                <p className="mt-3 text-[2.25rem] text-white num">—</p>
                <p className="mt-2 text-[13px] text-[#737373] font-body">
                  Deal scoring is still being computed for this listing.
                </p>
              </>
            )}
          </div>
        </motion.div>

        {/* Hairline specs — not cards */}
        {visibleSpecs.length > 0 && (
          <motion.div
            className="listing-specs mb-14"
            {...enter(reduce)}
            transition={{ ...enter(reduce).transition, delay: reduce ? 0 : 0.06 }}
          >
            {visibleSpecs.map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="listing-specs__item">
                <Icon className="w-3.5 h-3.5 text-[#525252] mb-2" />
                <p className="text-[10px] uppercase tracking-[0.15em] text-[#525252] mb-1">{label}</p>
                <p
                  className="text-[15px] font-bold num font-numeric-table"
                  style={{ color: color ?? '#ffffff' }}
                >
                  {value}
                </p>
              </div>
            ))}
          </motion.div>
        )}

        {/* EMI below the fold of the hero — quieter presence */}
        {detail.price_lkr && detail.listing_type === 'sale' && (
          <div className="mb-14">
            <EMITeaser
              priceLkr={detail.price_lkr}
              listingType={detail.listing_type}
              variant="banner"
              label="Estimated monthly EMI"
            />
          </div>
        )}

        {detail.listing_type === 'sale' && detail.price_lkr && (
          <div className="mb-14">
            <MortgageCalculator
              listingPrice={detail.price_lkr}
              listingType={detail.listing_type}
              variant="detail"
            />
          </div>
        )}

        {amenities.length > 0 && (
          <div className="mb-14">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#525252] mb-4">Amenities</p>
            <div className="flex flex-wrap gap-2">
              {amenities.map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 border border-white/[0.1] rounded-full px-3 py-1.5 text-[12px] text-[#a3a3a3] capitalize"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mb-14">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#525252] mb-4">Description</p>
          {detail.description ? (
            <>
              <p className="text-[14px] text-[#a3a3a3] leading-relaxed whitespace-pre-line max-w-3xl">
                {descTrimmed}
              </p>
              {detail.description.length > 300 && (
                <button
                  onClick={() => setDescExpanded((v) => !v)}
                  className="text-[12px] text-[#f5f5f5] hover:text-[#e5e5e5] mt-3 cursor-pointer bg-transparent border-none p-0 transition-colors"
                >
                  {descExpanded ? 'Show less' : 'Read more'}
                </button>
              )}
            </>
          ) : (
            <p className="text-[13px] text-[#525252] italic">No description provided by source.</p>
          )}
        </div>

        {detail.price_history && detail.price_history.length > 0 && (
          <div className="mb-14">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#525252] mb-4">Price History</p>
            <div className="border border-white/[0.08] rounded-2xl p-6 bg-black/40">
              <PriceHistoryChart size="full" snapshots={detail.price_history} />
            </div>
          </div>
        )}

        {(detail.property_type === 'apartment' || detail.property_type === 'house') &&
          detail.listing_type === 'sale' &&
          detail.district && (
            <div className="mb-14">
              <RentalYieldPanel
                district={detail.district}
                propertyType={detail.property_type}
                listingType={detail.listing_type}
                bedrooms={detail.bedrooms}
                dealScore={detail.deal_score}
              />
            </div>
          )}

        <div className="mb-14">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#525252] mb-4">Location</p>
          {detail.lat && detail.lng ? (
            <>
              <div className="h-[400px] lg:h-[480px] rounded-2xl overflow-hidden border border-white/[0.08]">
                <iframe
                  title="Property location"
                  width="100%"
                  height="100%"
                  style={{
                    border: 0,
                    filter: 'invert(1) hue-rotate(180deg) brightness(0.9) contrast(1.1)',
                  }}
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${detail.lng - 0.01},${detail.lat - 0.008},${detail.lng + 0.01},${detail.lat + 0.008}&layer=mapnik&marker=${detail.lat},${detail.lng}`}
                />
              </div>
              <a
                href={`https://www.openstreetmap.org/?mlat=${detail.lat}&mlon=${detail.lng}#map=16/${detail.lat}/${detail.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-3 text-[12px] text-[#525252] hover:text-[#f5f5f5] transition-colors no-underline"
              >
                <ExternalLink className="w-3 h-3" />
                Open in OpenStreetMap
              </a>
            </>
          ) : (
            <div className="border border-white/[0.08] rounded-2xl p-6 flex items-center gap-3">
              <MapPin className="w-5 h-5 text-[#525252] shrink-0" />
              <div>
                <p className="text-[13px] text-white">{locationText || 'Location unavailable'}</p>
                <p className="text-[11px] text-[#525252] mt-0.5">
                  Exact coordinates not available for this listing.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="mb-14">
          <div className="flex items-end justify-between gap-4 mb-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#525252]">Similar Listings</p>
            {similar.length > 0 && (
              <p className="text-[11px] text-[#404040] hidden sm:block">Swipe or scroll →</p>
            )}
          </div>
          {similar.length > 0 ? (
            <div className="similar-rail no-scrollbar">
              {similar.map((listing) => (
                <SimilarCard key={listing.id} listing={listing} formatConverted={formatConverted} />
              ))}
            </div>
          ) : (
            <div className="border border-white/[0.08] rounded-2xl p-6 text-center">
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
