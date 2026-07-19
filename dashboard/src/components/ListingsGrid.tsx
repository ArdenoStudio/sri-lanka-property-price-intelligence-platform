import { Fragment, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Listing } from '../api';
import { resolveListingPrice } from '../lib/pricing';
import { useCurrency } from '../hooks/useCurrency';
import { DealScorePill } from './DealScore';
import { EmptyStatePanel } from './ui/EmptyStatePanel';

const MOBILE_FACT_LIMIT = 4;
const DESKTOP_FACT_LIMIT = 6;

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

function formatLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatSourceLabel(source: string): string {
  const normalized = source.trim().toLowerCase();
  if (normalized === 'lpw') return 'LPW';
  if (normalized === 'onlineproperty') return 'OnlineProperty';
  return formatLabel(source) ?? source;
}

function formatLocality(listing: Listing, mode: 'mobile' | 'desktop'): string | null {
  const primary = listing.city || listing.district || listing.raw_location;
  if (mode === 'mobile') return primary;

  const full = [listing.city, listing.district].filter(Boolean).join(', ');
  return full || primary;
}

function formatSizeLabel(listing: Listing): string | null {
  if (listing.size_perches != null) {
    return `${listing.size_perches} perch${listing.size_perches === 1 ? '' : 'es'}`;
  }

  if (listing.size_sqft != null) {
    return `${listing.size_sqft.toLocaleString('en-LK')} sqft`;
  }

  return null;
}

function formatListingTypeLabel(listingType: string | null): string | null {
  if (!listingType) return null;
  return listingType === 'rent' ? 'For rent' : 'For sale';
}

function formatDaysLabel(days: number | null, fallback: string | null): string | null {
  if (days === 0) return 'New today';
  if (days != null) return `${days}d on market`;
  const seen = formatDate(fallback);
  return seen ? `Seen ${seen}` : null;
}

function getDaysTone(days: number | null): 'neutral' | 'muted' {
  if (days == null || days < 7) return 'neutral';
  return 'muted';
}

function MetaPill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'muted' | 'warning' | 'success';
}) {
  const toneClass = {
    neutral: 'text-[#d4d4d4]',
    muted: 'text-[#8a8a8a]',
    warning: 'text-[#a3a3a3]',
    success: 'text-[#d4d4d4]',
  }[tone];

  return (
    <span className={`inline-flex items-center text-[11px] font-medium ${toneClass}`}>
      {children}
    </span>
  );
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
  const { currency, rates, formatConverted } = useCurrency();

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
          <div
            key={i}
            className="animate-pulse flex flex-col gap-3 px-1 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
          >
            <div className="min-w-0 flex-1">
              <div className="h-2 bg-white/[0.05] rounded w-1/4 mb-3" />
              <div className="h-7 bg-white/[0.05] rounded w-2/5 mb-2" />
              <div className="h-2.5 bg-white/[0.04] rounded w-3/5" />
            </div>
            <div className="flex gap-4 sm:w-48">
              <div className="h-2.5 bg-white/[0.04] rounded w-12" />
              <div className="h-2.5 bg-white/[0.04] rounded w-16" />
              <div className="h-2.5 bg-white/[0.04] rounded w-14" />
            </div>
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
        <div className="mb-4 border border-white/[0.12] bg-white/[0.03] text-[#d4d4d4] px-4 py-3 text-[12px]">
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
          const isLand = listing.property_type?.toLowerCase() === 'land';
          const propertyLabel = formatLabel(listing.property_type) ?? 'Property';
          const mobileLocality = formatLocality(listing, 'mobile');
          const desktopLocality = formatLocality(listing, 'desktop');
          const sizeLabel = formatSizeLabel(listing);
          const pricePerPerchLabel = listing.price_per_perch != null
            ? `${formatConverted(listing.price_per_perch, { variant: 'table' })}/perch`
            : null;
          const daysLabel = formatDaysLabel(listing.days_on_market, listing.first_seen_at);
          const footerMeta = [
            listing.days_on_market === 0
              ? 'New today'
              : listing.days_on_market != null
                ? `${listing.days_on_market}d on market`
                : formatDate(listing.first_seen_at),
            formatSourceLabel(listing.source),
          ].filter(Boolean);

          const orderedFacts = [
            listing.deal_score != null
              ? {
                  key: 'deal-score',
                  node: <DealScorePill score={listing.deal_score} />,
                }
              : null,
            listing.price_drop_pct != null && listing.price_drop_pct > 0
              ? {
                  key: 'price-drop',
                  node: <MetaPill tone="warning">↓ {listing.price_drop_pct.toFixed(0)}% drop</MetaPill>,
                }
              : null,
            !isLand && listing.bedrooms != null
              ? {
                  key: 'bedrooms',
                  node: <MetaPill>{listing.bedrooms} BR</MetaPill>,
                }
              : null,
            !isLand && listing.bathrooms != null
              ? {
                  key: 'bathrooms',
                  node: <MetaPill>{listing.bathrooms} BA</MetaPill>,
                }
              : null,
            sizeLabel
              ? {
                  key: 'size',
                  node: <MetaPill>{sizeLabel}</MetaPill>,
                }
              : null,
            pricePerPerchLabel && priceDisplay.source !== 'price_per_perch'
              ? {
                  key: 'price-per-perch',
                  node: <MetaPill>{pricePerPerchLabel}</MetaPill>,
                }
              : null,
            daysLabel
              ? {
                  key: 'days',
                  node: <MetaPill tone={getDaysTone(listing.days_on_market)}>{daysLabel}</MetaPill>,
                }
              : null,
            formatListingTypeLabel(listing.listing_type)
              ? {
                  key: 'listing-type',
                  node: <MetaPill tone="muted">{formatListingTypeLabel(listing.listing_type)!}</MetaPill>,
                }
              : null,
          ].filter(Boolean) as Array<{ key: string; node: ReactNode }>;

          const mobileFacts = orderedFacts.slice(0, MOBILE_FACT_LIMIT);
          const desktopFacts = orderedFacts.slice(0, DESKTOP_FACT_LIMIT);

          return (
            <article
              key={listing.id}
              className="group relative border-b border-white/[0.08] last:border-b-0 css-listing-fade-in"
              style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
            >
              <div className="flex items-start gap-3 py-5 sm:items-center sm:gap-6">
                <Link
                  to={`/listing/${listing.id}`}
                  className="min-w-0 flex-1 no-underline cursor-pointer"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-8">
                    <div className="min-w-0 sm:w-[42%] sm:shrink-0">
                      <p className="text-[11px] uppercase tracking-[0.12em] text-[#737373] leading-none mb-2 sm:hidden">
                        {[propertyLabel, mobileLocality].filter(Boolean).join(' · ')}
                      </p>
                      <p className="hidden text-[11px] uppercase tracking-[0.12em] text-[#737373] leading-none mb-2 sm:block">
                        {[propertyLabel, desktopLocality].filter(Boolean).join(' · ')}
                      </p>

                      <p className="text-[1.45rem] font-bold text-white tracking-tight leading-none num font-price-hero sm:text-[1.6rem]">
                        {priceDisplay.text}
                      </p>
                      {priceDisplay.suffix && (
                        <p className="text-[11px] text-[#737373] mt-1">{priceDisplay.suffix}</p>
                      )}

                      {listing.title && (
                        <p className="mt-2 text-[13px] leading-snug text-[#a3a3a3] line-clamp-1 sm:line-clamp-2">
                          {listing.title}
                        </p>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      {mobileFacts.length > 0 && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:hidden">
                          {mobileFacts.map((fact, factIdx) => (
                            <Fragment key={fact.key}>
                              {factIdx > 0 && (
                                <span className="text-[#404040]" aria-hidden="true">·</span>
                              )}
                              {fact.node}
                            </Fragment>
                          ))}
                        </div>
                      )}
                      {desktopFacts.length > 0 && (
                        <div className="hidden flex-wrap items-center gap-x-3 gap-y-1.5 sm:flex">
                          {desktopFacts.map((fact, factIdx) => (
                            <Fragment key={fact.key}>
                              {factIdx > 0 && (
                                <span className="text-[#404040]" aria-hidden="true">·</span>
                              )}
                              {fact.node}
                            </Fragment>
                          ))}
                        </div>
                      )}

                      <p className="mt-2 text-[11px] text-[#525252] num">
                        {footerMeta.join(' · ')}
                      </p>
                    </div>
                  </div>
                </Link>

                <div className="flex shrink-0 items-center gap-2 pt-0.5 sm:pt-0">
                  {listing.url && (
                    <a
                      href={listing.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#525252] hover:text-white transition-colors p-1.5"
                      aria-label={`View on ${listing.source}`}
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}

                  <button
                    onClick={() => onToggleComparison(listing)}
                    className={`text-[10px] font-semibold w-7 h-7 flex items-center justify-center cursor-pointer border transition-colors active:scale-90 ${
                      isCompared
                        ? 'bg-white text-black border-white'
                        : 'text-[#737373] border-white/[0.14] hover:text-white hover:border-white/30 bg-transparent'
                    }`}
                    aria-pressed={isCompared}
                    aria-label={`${isCompared ? 'Remove from' : 'Add to'} comparison`}
                  >
                    <PlusCheckIcon checked={isCompared} />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-10">
          <button
            onClick={() => handlePageChange(Math.max(0, page - 1))}
            disabled={page === 0}
            aria-label="Previous page"
            className="p-2 border border-white/[0.08] hover:border-white/[0.14] disabled:opacity-25 disabled:cursor-not-allowed transition-colors cursor-pointer text-[#a3a3a3] hover:text-white bg-transparent"
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
            className="p-2 border border-white/[0.08] hover:border-white/[0.14] disabled:opacity-25 disabled:cursor-not-allowed transition-colors cursor-pointer text-[#a3a3a3] hover:text-white bg-transparent"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
