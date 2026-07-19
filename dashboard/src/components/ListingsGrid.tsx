import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Listing } from '../api';
import { resolveListingPrice } from '../lib/pricing';
import { getDealScoreBand } from '../lib/dealScore';
import { PriceHistoryChart } from './PriceHistoryChart';
import { useCurrency } from '../hooks/useCurrency';
import { EMITeaser } from './EMITeaser';
import { DealScorePill } from './DealScore';
import { EmptyStatePanel } from './ui/EmptyStatePanel';

function PlusCheckIcon({ checked }: { checked: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      {checked ? (
        <>
          <line x1="3" y1="9.5" x2="6.5" y2="12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="6.5" y1="12" x2="12" y2="3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </>
      ) : (
        <>
          <line x1="3" y1="7" x2="11" y2="7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="7" y1="3" x2="7" y2="11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}


function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHrs = Math.floor(diffMs / 3_600_000);
  if (diffHrs < 1) return 'Just now';
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-LK', { month: 'short', day: 'numeric' });
}

interface Props {
  listings: Listing[];
  loading: boolean;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (p: number) => void;
  selectedForComparison: number[];
  onToggleComparison: (listing: Listing) => void;
  onClearFilters: () => void;
  error?: string | null;
}

export function ListingsGrid({
  listings,
  loading,
  page,
  pageSize,
  total,
  onPageChange,
  selectedForComparison,
  onToggleComparison,
  onClearFilters,
  error,
}: Props) {
  const totalPages = Math.ceil(total / pageSize);
  const topRef = useRef<HTMLDivElement>(null);
  const { currency, rates } = useCurrency();

  function handlePageChange(p: number) {
    onPageChange(p);
    setTimeout(() => {
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  if (loading) {
    return (
      <div className="listings-grid">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-[#111111] p-6 animate-pulse min-h-[160px] flex flex-col justify-between">
            <div>
              <div className="h-2 bg-white/[0.05] rounded w-1/3 mb-5" />
              <div className="h-8 bg-white/[0.05] rounded w-2/3 mb-3" />
              <div className="h-2.5 bg-white/[0.05] rounded w-1/2 mb-2" />
              <div className="h-2.5 bg-white/[0.05] rounded w-3/4" />
            </div>
            <div className="h-2 bg-white/[0.04] rounded w-1/4 mt-4" />
          </div>
        ))}
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <EmptyStatePanel
        eyebrow="Results"
        title="No listings for this filter set"
        body="The market has inventory, but not inside the constraints you set. Widen one or two filters to bring active listings back into view."
        ctaLabel="Clear filters"
        onCta={onClearFilters}
        className="p-16"
      />
    );
  }

  return (
    <div ref={topRef}>
      {error && (
        <div className="mb-4 border border-amber-500/20 bg-amber-500/[0.08] text-amber-200 rounded-xl px-4 py-3 text-[12px]">
          {error}
        </div>
      )}
      <div className="listings-grid">
        {listings.map((listing, idx) => {
          const priceDisplay = resolveListingPrice({
            priceLkr: listing.price_lkr,
            pricePerPerch: listing.price_per_perch,
            rawPrice: listing.raw_price,
            currency,
            rates,
            formatOptions: { variant: 'hero' },
            emptyText: 'Price N/A',
          });
          const isCompared = selectedForComparison.includes(listing.id);
          const hasPriceDrop = listing.price_drop_pct != null && listing.price_drop_pct > 0
            && listing.original_price_lkr != null && listing.price_lkr != null;
          const dealBand = listing.deal_score != null ? getDealScoreBand(listing.deal_score) : null;

          const detailParts = [
            listing.size_perches && `${listing.size_perches} perch`,
            listing.bedrooms && `${listing.bedrooms} BR`,
            listing.bathrooms && `${listing.bathrooms} BA`,
            listing.listing_type === 'rent' ? 'For Rent' : 'For Sale',
          ].filter(Boolean);

          return (
            <article
              key={listing.id}
              className="group relative bg-[#111111] hover:bg-[#161616] transition-colors duration-200 css-listing-fade-in"
              style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
            >
              <div
                className="absolute left-0 top-0 bottom-0 w-[2px] transition-colors duration-300"
                style={{ backgroundColor: dealBand?.tone.accent ?? 'transparent' }}
                aria-hidden="true"
              />

              {/* Hover indicator */}
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#14b8a6] text-[10px] opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                →
              </div>

              <button
                onClick={() => onToggleComparison(listing)}
                className={`absolute right-6 top-6 z-10 sm:opacity-0 sm:group-hover:opacity-100 transition-all text-[10px] font-semibold w-6 h-6 rounded-full flex items-center justify-center cursor-pointer border active:scale-90 ${
                  isCompared
                    ? 'bg-[#14b8a6] text-black border-[#14b8a6] sm:opacity-100'
                    : 'text-[#737373] border-white/[0.12] hover:text-white hover:border-white/25 bg-[#111111]'
                }`}
                aria-pressed={isCompared}
                aria-label={`${isCompared ? 'Remove from' : 'Add to'} comparison`}
              >
                <PlusCheckIcon checked={isCompared} />
              </button>

              {listing.url && (
                <a
                  href={listing.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute right-6 bottom-6 z-10 text-[#525252] hover:text-[#737373] transition-colors"
                  aria-label={`View on ${listing.source}`}
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}

              <Link
                to={`/listing/${listing.id}`}
                className="p-6 flex flex-col h-full no-underline cursor-pointer"
              >
                {/* Type + location */}
                <div className="mb-3 pr-9">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-[#737373] leading-none">
                    {[listing.property_type, listing.district].filter(Boolean).join(' · ') || 'Property'}
                  </p>
                </div>

                {/* PRICE — HERO */}
                <div className="mb-2">
                  <p className="text-[1.75rem] font-bold text-white tracking-tight leading-none num font-price-hero">
                    {priceDisplay.text}
                  </p>
                  {priceDisplay.suffix && (
                    <p className="text-[11px] text-[#737373] mt-1">{priceDisplay.suffix}</p>
                  )}
                </div>

                {/* Details */}
                {detailParts.length > 0 && (
                  <p className="text-[13px] text-[#a3a3a3] mb-2">
                    {detailParts.join(' · ')}
                  </p>
                )}

                {/* Title */}
                {listing.title && (
                  <p className="text-[13px] text-[#737373] line-clamp-1 mb-2">
                    {listing.title}
                  </p>
                )}

                {/* Deal signals */}
                {(listing.deal_score !== null ||
                  (listing.price_drop_pct !== null && listing.price_drop_pct > 0)) && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {listing.deal_score !== null && (
                      <DealScorePill score={listing.deal_score} />
                    )}
                    {listing.price_drop_pct !== null && listing.price_drop_pct > 0 && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-400 num">
                        ↓ {listing.price_drop_pct.toFixed(0)}% drop
                      </span>
                    )}
                  </div>
                )}

                {/* EMI teaser */}
                <EMITeaser priceLkr={listing.price_lkr} listingType={listing.listing_type} />

                {/* Price drop sparkline */}
                {hasPriceDrop && (
                  <div className="mb-2 opacity-70">
                    <PriceHistoryChart
                      size="sparkline"
                      data={[
                        { date: 'original', price: listing.original_price_lkr },
                        { date: 'current', price: listing.price_lkr },
                      ]}
                    />
                  </div>
                )}

                {/* Footer — meta + link */}
                <div className="mt-auto pt-3 pr-6 flex items-center justify-between">
                  <p className="text-[11px] text-[#525252] num">
                    {[formatDate(listing.first_seen_at), listing.source].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </Link>
            </article>
          );
        })}
      </div>

      {/* Minimal pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-10">
          <button
            onClick={() => handlePageChange(Math.max(0, page - 1))}
            disabled={page === 0}
            aria-label="Previous page"
            className="p-2 rounded-xl border border-white/[0.08] hover:border-white/[0.14] disabled:opacity-25 disabled:cursor-not-allowed transition-colors cursor-pointer text-[#a3a3a3] hover:text-white bg-transparent"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="text-[13px] text-[#737373] num">
            Page {page + 1} of {totalPages}
          </span>

          <button
            onClick={() => handlePageChange(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            aria-label="Next page"
            className="p-2 rounded-xl border border-white/[0.08] hover:border-white/[0.14] disabled:opacity-25 disabled:cursor-not-allowed transition-colors cursor-pointer text-[#a3a3a3] hover:text-white bg-transparent"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
