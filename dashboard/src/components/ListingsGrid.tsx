import { Home, MapPin, Maximize, ExternalLink, ChevronLeft, ChevronRight, Bed, Bath, Plus, Check } from 'lucide-react';
import type { Listing } from '../api';

function formatNum(p: number): string {
  if (p >= 1_000_000) return `Rs ${(p / 1_000_000).toFixed(1)}M`;
  if (p >= 1_000) return `Rs ${(p / 1_000).toFixed(0)}K`;
  return `Rs ${p.toFixed(0)}`;
}

function formatPrice(listing: Listing): { text: string; suffix: string } {
  if (listing.price_lkr) {
    return { text: formatNum(listing.price_lkr), suffix: '' };
  }
  if (listing.price_per_perch) {
    return { text: formatNum(listing.price_per_perch), suffix: '/ perch' };
  }
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

function typeIcon(type: string | null) {
  return type === 'land' ? Maximize : Home;
}

function typeColor(type: string | null): string {
  switch (type) {
    case 'land': return 'bg-success/15 text-success border-success/25';
    case 'house': return 'bg-accent/15 text-accent-light border-accent/25';
    case 'apartment': return 'bg-warning/15 text-warning border-warning/25';
    case 'commercial': return 'bg-danger/15 text-danger border-danger/25';
    default: return 'bg-bg-card text-text-secondary border-border';
  }
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

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-bg-card border border-border p-4 animate-pulse">
            <div className="h-4 bg-bg-card-hover rounded w-3/4 mb-3" />
            <div className="h-6 bg-bg-card-hover rounded w-1/2 mb-2" />
            <div className="h-3 bg-bg-card-hover rounded w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="text-center py-16">
        <Home className="w-12 h-12 text-text-muted mx-auto mb-4" />
        <p className="text-text-secondary text-lg font-medium">No listings found</p>
        <p className="text-text-muted text-sm mt-1">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {listings.map((listing) => {
          const Icon = typeIcon(listing.property_type);
          return (
            <div
              key={listing.id}
              className="group rounded-xl bg-bg-card border border-border hover:border-border-hover transition-all duration-200 overflow-hidden hover:shadow-lg hover:shadow-accent-glow/5"
            >
              {/* Color bar */}
              <div className={`h-1 ${listing.property_type === 'land' ? 'bg-success' : listing.property_type === 'house' ? 'bg-accent' : listing.property_type === 'apartment' ? 'bg-warning' : 'bg-danger'}`} />

              <div className="p-4">
                {/* Type badge + date */}
                <div className="flex items-center justify-between mb-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${typeColor(listing.property_type)}`}>
                    <Icon className="w-3 h-3" />
                    {listing.property_type || 'property'}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        onCompareToggle(listing);
                      }}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                        selectedForComparison.includes(listing.id)
                          ? 'bg-accent text-white border-accent'
                          : 'bg-bg-card text-text-muted border-border hover:border-accent hover:text-accent-light'
                      }`}
                    >
                      {selectedForComparison.includes(listing.id) ? (
                        <>
                          <Check className="w-2.5 h-2.5" />
                          Added
                        </>
                      ) : (
                        <>
                          <Plus className="w-2.5 h-2.5" />
                          Compare
                        </>
                      )}
                    </button>
                    <span className="text-[10px] text-text-muted">
                      {formatDate(listing.first_seen_at)}
                    </span>
                  </div>
                </div>

                {/* Title */}
                <h4 className="text-sm font-semibold text-text-primary leading-snug mb-2 line-clamp-2 min-h-[2.5rem]">
                  {listing.title || 'Untitled Listing'}
                </h4>

                {/* Price */}
                {(() => {
                  const { text, suffix } = formatPrice(listing);
                  return (
                    <p className="text-xl font-bold text-accent-light mb-3">
                      {text}
                      {suffix && (
                        <span className="text-xs font-normal text-text-muted ml-1.5">
                          {suffix}
                        </span>
                      )}
                    </p>
                  );
                })()}

                {/* Location */}
                <div className="flex items-center gap-1.5 text-xs text-text-secondary mb-2">
                  <MapPin className="w-3 h-3 text-text-muted flex-shrink-0" />
                  <span className="truncate">
                    {listing.district
                      ? `${listing.city ? listing.city + ', ' : ''}${listing.district}`
                      : listing.raw_location || 'Sri Lanka'}
                  </span>
                </div>

                {/* Details row */}
                <div className="flex items-center gap-3 text-xs text-text-muted">
                  {listing.size_perches && (
                    <span className="flex items-center gap-1">
                      <Maximize className="w-3 h-3" />
                      {listing.size_perches} perches
                    </span>
                  )}
                  {listing.bedrooms && (
                    <span className="flex items-center gap-1">
                      <Bed className="w-3 h-3" />
                      {listing.bedrooms}
                    </span>
                  )}
                  {listing.bathrooms && (
                    <span className="flex items-center gap-1">
                      <Bath className="w-3 h-3" />
                      {listing.bathrooms}
                    </span>
                  )}
                </div>

                {/* Source link */}
                {listing.url && (
                  <a
                    href={listing.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs text-accent-light/70 hover:text-accent-light transition-colors no-underline"
                  >
                    View on {listing.source} <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            onClick={() => onPageChange(Math.max(0, page - 1))}
            disabled={page === 0}
            className="p-2 rounded-lg bg-bg-card border border-border hover:border-border-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer text-text-primary"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i;
              } else if (page < 3) {
                pageNum = i;
              } else if (page > totalPages - 4) {
                pageNum = totalPages - 5 + i;
              } else {
                pageNum = page - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                    page === pageNum
                      ? 'bg-accent text-white border-accent'
                      : 'bg-bg-card text-text-secondary border-border hover:border-border-hover'
                  }`}
                >
                  {pageNum + 1}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className="p-2 rounded-lg bg-bg-card border border-border hover:border-border-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer text-text-primary"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <span className="text-xs text-text-muted ml-2">
            Page {page + 1} of {totalPages}
          </span>
        </div>
      )}
    </div>
  );
}
