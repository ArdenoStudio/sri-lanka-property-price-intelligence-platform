import { useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Listing } from '../api';
import { resolveListingPrice } from '../lib/pricing';
import { getDealScoreBand } from '../lib/dealScore';
import { useCurrency } from '../hooks/useCurrency';
import { DealScorePill } from './DealScore';
import { EmptyStatePanel } from './ui/EmptyStatePanel';

const MOBILE_FACT_LIMIT = 3;
const DESKTOP_FACT_LIMIT = 4;

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

function MetaPill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'muted' | 'warning' | 'success';
}) {
  const toneClass = {
    neutral: 'border-white/[0.08] bg-white/[0.03] text-[#d4d4d4]',
    muted: 'border-white/[0.06] bg-white/[0.02] text-[#8a8a8a]',
    warning: 'border-white/15 bg-white/10 text-[#a3a3a3]',
    success: 'border-white/20 bg-white/10 text-white',
  }[tone];

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-medium ${toneClass}`}>
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
        <div className="mb-4 border border-white/15 bg-white/[0.06] text-[#a3a3a3] rounded-xl px-4 py-3 text-[12px]">
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
          const dealBand = listing.deal_score != null ? getDealScoreBand(listing.deal_score) : null;
          const isLand = listing.property_type?.toLowerCase() === 'land';
          const propertyLabel = formatLabel(listing.property_type) ?? 'Property';
          const mobileLocality = formatLocality(listing, 'mobile');
          const desktopLocality = formatLocality(listing, 'desktop');
          const sizeLabel = formatSizeLabel(listing);
          const pricePerPerchLabel = listing.price_per_perch != null
            ? `${formatConverted(listing.price_per_perch, { variant: 'table' })}/perch`
            : null;
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
            // days + listing type live in the footer — keep the face scannable
          ].filter(Boolean) as Array<{ key: string; node: ReactNode }>;

          // Price-first face: deal + a few facts only (HyperUI / DaisyUI density).
          const mobileFacts = orderedFacts.slice(0, MOBILE_FACT_LIMIT);
          const desktopFacts = orderedFacts.slice(0, DESKTOP_FACT_LIMIT);

          return (
            <article
              key={listing.id}
              className="group relative bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-elevated)] border border-transparent hover:border-white/[0.1] transition-[transform,background-color,border-color] duration-200 ease-[var(--ease-out)] hover:-translate-y-px css-listing-fade-in"
              style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
            >
              <div
                className="absolute left-0 top-0 bottom-0 w-[2px] transition-opacity duration-300"
                style={{
                  backgroundColor: dealBand?.tone.accent ?? 'rgba(255,255,255,0.12)',
                  opacity: dealBand ? 1 : 0.35,
                }}
                aria-hidden="true"
              />

              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#f5f5f5] text-[10px] opacity-0 group-hover:opacity-100 transition-opacity font-medium tracking-wide">
                →
              </div>

              <button
                onClick={() => onToggleComparison(listing)}
                className={`absolute right-6 top-6 z-10 sm:opacity-0 sm:group-hover:opacity-100 transition-all text-[10px] font-semibold w-6 h-6 rounded-full flex items-center justify-center cursor-pointer border ${
                  isCompared
                    ? 'bg-[#f5f5f5] text-black border-[#f5f5f5] sm:opacity-100'
                    : 'text-[#737373] border-white/[0.12] hover:text-white hover:border-white/25 bg-[var(--color-bg-card)]'
                }`}
                aria-pressed={isCompared}
                aria-label={`${isCompared ? 'Remove from' : 'Add to'} comparison`}
              >
                <PlusCheckIcon checked={isCompared} />
              </button>

              <Link
                to={`/listing/${listing.id}`}
                className="flex h-full flex-col p-5 pr-12 no-underline cursor-pointer sm:p-6 sm:pr-14"
              >
                <div className="mb-3 pr-6">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-[#737373] leading-none sm:hidden">
                    {[propertyLabel, mobileLocality].filter(Boolean).join(' · ')}
                  </p>
                  <p className="hidden text-[11px] uppercase tracking-[0.12em] text-[#737373] leading-none sm:block">
                    {[propertyLabel, desktopLocality].filter(Boolean).join(' · ')}
                  </p>
                </div>

                <div className="mb-2">
                  <p className="text-[1.55rem] font-bold text-white tracking-tight leading-none num font-price-hero sm:text-[1.75rem]">
                    {priceDisplay.text}
                  </p>
                  {priceDisplay.suffix && (
                    <p className="text-[11px] text-[#737373] mt-1">{priceDisplay.suffix}</p>
                  )}
                </div>

                {listing.title && (
                  <p className="mb-3 text-[13px] leading-relaxed text-[#a3a3a3] line-clamp-2">
                    {listing.title}
                  </p>
                )}

                {mobileFacts.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-1.5 sm:hidden">
                    {mobileFacts.map((fact) => (
                      <div key={fact.key}>{fact.node}</div>
                    ))}
                  </div>
                )}
                {desktopFacts.length > 0 && (
                  <div className="mb-4 hidden flex-wrap gap-1.5 sm:flex">
                    {desktopFacts.map((fact) => (
                      <div key={fact.key}>{fact.node}</div>
                    ))}
                  </div>
                )}

                <div className="mt-auto pt-2 pr-2 flex items-center justify-between">
                  <p className="text-[11px] text-[#525252] num">
                    {footerMeta.join(' · ')}
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
