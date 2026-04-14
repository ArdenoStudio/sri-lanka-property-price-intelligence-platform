import { useRef } from 'react';
import { ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Listing } from '../api';

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

function formatNum(p: number): string {
  if (p >= 1_000_000) return `Rs ${(p / 1_000_000).toFixed(1)}M`;
  if (p >= 1_000) return `Rs ${(p / 1_000).toFixed(0)}K`;
  return `Rs ${p.toFixed(0)}`;
}

function formatPrice(listing: Listing): { text: string; suffix: string } {
  if (listing.price_lkr) return { text: formatNum(listing.price_lkr), suffix: '' };
  if (listing.price_per_perch) return { text: formatNum(listing.price_per_perch), suffix: '/ perch' };
  return { text: listing.raw_price || 'Price N/A', suffix: '' };
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
  onCompareToggle: (listing: Listing) => void;
  selectedForComparison: number[];
}

export function ListingsGrid({ listings, loading, page, pageSize, total, onPageChange, onCompareToggle, selectedForComparison }: Props) {
  const totalPages = Math.ceil(total / pageSize);
  const topRef = useRef<HTMLDivElement>(null);

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
      <div className="card p-16 text-center">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[#2e2e2e] mb-4">Results</p>
        <p className="text-[#737373] text-[15px]">No listings match your filters</p>
        <p className="text-[11px] text-[#2e2e2e] mt-2">Try broadening your search</p>
      </div>
    );
  }

  return (
    <div ref={topRef}>
      <div className="listings-grid">
        {listings.map((listing, idx) => {
          const { text, suffix } = formatPrice(listing);
          const isCompared = selectedForComparison.includes(listing.id);

          const detailParts = [
            listing.size_perches && `${listing.size_perches} perch`,
            listing.bedrooms && `${listing.bedrooms} BR`,
            listing.bathrooms && `${listing.bathrooms} BA`,
            listing.listing_type === 'rent' ? 'For Rent' : 'For Sale',
          ].filter(Boolean);

          return (
            <div
              key={listing.id}
              className="group relative bg-[#111111] hover:bg-[#161616] transition-colors duration-200 css-listing-fade-in"
              style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
            >
              {/* Left accent line — teal on hover */}
              <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-transparent group-hover:bg-[#14b8a6]/50 transition-colors duration-300" />

              <div className="p-6 flex flex-col h-full">
                {/* Type + location + compare button */}
                <div className="flex items-start justify-between mb-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-[#737373] leading-none">
                    {[listing.property_type, listing.district].filter(Boolean).join(' · ') || 'Property'}
                  </p>
                  <button
                    onClick={(e) => { e.preventDefault(); onCompareToggle(listing); }}
                    className={`sm:opacity-0 sm:group-hover:opacity-100 transition-all text-[10px] font-semibold w-6 h-6 rounded-full flex items-center justify-center cursor-pointer border active:scale-90 ${
                      isCompared
                        ? 'bg-[#14b8a6] text-black border-[#14b8a6] sm:opacity-100'
                        : 'text-[#737373] border-white/[0.12] hover:text-white hover:border-white/25 bg-transparent'
                    }`}
                    aria-label={isCompared ? 'Remove from comparison' : 'Add to comparison'}
                  >
                    <PlusCheckIcon checked={isCompared} />
                  </button>
                </div>

                {/* PRICE — HERO */}
                <div className="mb-2">
                  <p className="text-[1.75rem] font-bold text-white tracking-tight leading-none num">
                    {text}
                  </p>
                  {suffix && (
                    <p className="text-[11px] text-[#737373] mt-1">{suffix}</p>
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

                {/* Signal badges — only below market + price drop */}
                {((listing.deal_score !== null && listing.deal_score >= 5) ||
                  (listing.price_drop_pct !== null && listing.price_drop_pct > 0)) && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {listing.deal_score !== null && listing.deal_score >= 5 && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 num">
                        {listing.deal_score.toFixed(0)}% below market
                      </span>
                    )}
                    {listing.price_drop_pct !== null && listing.price_drop_pct > 0 && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-400 num">
                        ↓ {listing.price_drop_pct.toFixed(0)}% drop
                      </span>
                    )}
                  </div>
                )}

                {/* Footer — meta + link */}
                <div className="mt-auto pt-3 flex items-center justify-between">
                  <p className="text-[11px] text-[#525252] num">
                    {[formatDate(listing.first_seen_at), listing.source].filter(Boolean).join(' · ')}
                  </p>
                  {listing.url && (
                    <a
                      href={listing.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#525252] hover:text-[#737373] transition-colors"
                      aria-label={`View on ${listing.source}`}
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
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
