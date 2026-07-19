import '@fontsource/cal-sans';
import '@fontsource-variable/inter';
import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ExternalLink, MapPin, Scale, X } from 'lucide-react';
import type { Listing } from '../api';
import { formatCurrencyAmount } from '../lib/pricing';
import { DealScorePill } from './DealScore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  listings: Listing[];
  minCompare?: number;
}

type WinnerFn = (listings: Listing[]) => number | null;
type CellTone = 'neutral' | 'accent' | 'positive' | 'negative' | 'muted';

interface MetricRow {
  id: string;
  label: string;
  sublabel: string;
  render: (listing: Listing) => { display: string; tone: CellTone };
  winner?: WinnerFn;
  winnerLabel?: string;
}

const displayFontStyle = {
  fontFamily: "'Cal Sans', 'Inter Variable', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  letterSpacing: '-0.04em',
} as const;

function formatCompactLkr(value: number): string {
  return formatCurrencyAmount(value, 'LKR', { variant: 'table' });
}

function formatTotalPrice(listing: Listing): string {
  if (listing.price_lkr !== null) return formatCompactLkr(listing.price_lkr);
  return listing.raw_price || 'Price unavailable';
}

function getPricePerPerch(listing: Listing): number | null {
  if (listing.price_per_perch !== null) return listing.price_per_perch;
  if (listing.price_lkr !== null && listing.size_perches !== null && listing.size_perches > 0) {
    return listing.price_lkr / listing.size_perches;
  }
  return null;
}

function formatPricePerPerch(listing: Listing): string {
  const value = getPricePerPerch(listing);
  return value === null ? 'N/A' : `${formatCompactLkr(value)} / perch`;
}

function formatBeds(listing: Listing): string {
  if (listing.bedrooms === null) return 'N/A';
  return `${listing.bedrooms} bed${listing.bedrooms === 1 ? '' : 's'}`;
}

function formatSize(listing: Listing): string {
  if (listing.size_perches !== null) {
    return `${listing.size_perches} perch${listing.size_perches === 1 ? '' : 'es'}`;
  }
  if (listing.size_sqft !== null) {
    return `${listing.size_sqft.toLocaleString('en-LK')} sqft`;
  }
  return 'N/A';
}

function formatDealScore(score: number | null): string {
  if (score === null) return 'N/A';
  return `${score > 0 ? '+' : ''}${score.toFixed(1)}%`;
}

function listingPlace(listing: Listing): string {
  return listing.district || listing.city || listing.raw_location || 'Sri Lanka';
}

function bestLowest(listings: Listing[], getValue: (listing: Listing) => number | null): number | null {
  const values = listings.map(getValue);
  const valid = values.filter((value): value is number => value !== null);
  if (!valid.length) return null;
  const best = Math.min(...valid);
  return values.indexOf(best);
}

function bestHighest(listings: Listing[], getValue: (listing: Listing) => number | null): number | null {
  const values = listings.map(getValue);
  const valid = values.filter((value): value is number => value !== null);
  if (!valid.length) return null;
  const best = Math.max(...valid);
  return values.indexOf(best);
}

const METRIC_ROWS: MetricRow[] = [
  {
    id: 'price-per-perch',
    label: 'Price / perch',
    sublabel: 'Lower is better',
    render: (listing) => ({
      display: formatPricePerPerch(listing),
      tone: getPricePerPerch(listing) === null ? 'muted' : 'accent',
    }),
    winner: (listings) => bestLowest(listings, getPricePerPerch),
    winnerLabel: 'Best value',
  },
  {
    id: 'beds',
    label: 'Beds',
    sublabel: 'Bedroom count',
    render: (listing) => ({
      display: formatBeds(listing),
      tone: listing.bedrooms === null ? 'muted' : 'neutral',
    }),
  },
  {
    id: 'size',
    label: 'Size',
    sublabel: 'Perches or sqft',
    render: (listing) => ({
      display: formatSize(listing),
      tone: listing.size_perches === null && listing.size_sqft === null ? 'muted' : 'neutral',
    }),
  },
  {
    id: 'deal-score',
    label: 'Deal score',
    sublabel: 'Compared with similar listings',
    render: (listing) => ({
      display: formatDealScore(listing.deal_score),
      tone:
        listing.deal_score === null
          ? 'muted'
          : listing.deal_score > 0
            ? 'positive'
            : listing.deal_score < 0
              ? 'negative'
              : 'neutral',
    }),
    winner: (listings) => bestHighest(listings, (listing) => listing.deal_score),
    winnerLabel: 'Strongest deal',
  },
  {
    id: 'district',
    label: 'District',
    sublabel: 'Sri Lanka location',
    render: (listing) => ({
      display: listingPlace(listing),
      tone: 'neutral',
    }),
  },
];

const SLOT_ACCENTS = [
  {
    bar: 'bg-accent',
    badge: 'border-accent/25 bg-accent/10 text-accent-light',
    button: 'border-accent/20 bg-accent/10 text-accent-light hover:bg-accent/16',
  },
  {
    bar: 'bg-emerald-400',
    badge: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
    button: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/16',
  },
  {
    bar: 'bg-amber-400',
    badge: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
    button: 'border-amber-400/20 bg-amber-400/10 text-amber-300 hover:bg-amber-400/16',
  },
  {
    bar: 'bg-sky-400',
    badge: 'border-sky-400/25 bg-sky-400/10 text-sky-300',
    button: 'border-sky-400/20 bg-sky-400/10 text-sky-300 hover:bg-sky-400/16',
  },
];

function cellToneClass(tone: CellTone, emphasized: boolean): string {
  if (tone === 'muted') return 'text-text-muted/60';
  if (emphasized) return 'text-success';
  if (tone === 'accent') return 'text-accent-light';
  if (tone === 'positive') return 'text-success';
  if (tone === 'negative') return 'text-danger';
  return 'text-text-primary';
}

export function ComparisonModal({
  isOpen,
  onClose,
  listings,
  minCompare = 2,
}: Props) {
  useEffect(() => {
    if (!isOpen) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  const isReady = listings.length >= minCompare;
  const gridTemplateColumns = `minmax(128px, 128px) repeat(${listings.length}, minmax(220px, 1fr))`;

  return (
    <AnimatePresence>
      {isOpen && isReady && (
        <div className="fixed inset-0 z-[99999] flex items-end justify-center sm:items-center">
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            aria-label="Close comparison modal"
          />

          <motion.div
            initial={{ opacity: 0, y: 48 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 48 }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
            className="relative mb-0 flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-t-[32px] border border-white/[0.08] bg-[#0a0a0a] shadow-2xl sm:mx-4 sm:mb-4 sm:rounded-[32px]"
          >
            <div className="flex justify-center pt-2 sm:hidden">
              <div className="h-1.5 w-14 rounded-full bg-white/[0.12]" />
            </div>

            <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] px-4 py-4 sm:px-6">
              <div className="flex items-start gap-3 min-w-0">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10 text-accent-light">
                  <Scale className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-text-muted">Comparison sheet</p>
                  <h2
                    className="text-[1.3rem] leading-none text-text-primary sm:text-[1.55rem]"
                    style={displayFontStyle}
                  >
                    Compare {listings.length} shortlisted listings
                  </h2>
                  <p className="mt-1 text-[12px] sm:text-[13px] text-text-secondary">
                    Swipe across on mobile. Value callouts only highlight lowest price/perch and highest deal score.
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-text-muted transition-colors hover:border-white/[0.16] hover:text-text-primary cursor-pointer"
                aria-label="Close comparison"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 pb-3 pt-3 sm:px-6 sm:pb-6">
              <div className="mb-3 flex items-center justify-between gap-3 px-1">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                    Mobile-first table
                  </p>
                  <p className="mt-1 text-[12px] text-text-secondary">
                    Sticky metric labels on the left, listing cards as horizontal columns on the right.
                  </p>
                </div>
                <div className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[11px] font-semibold text-text-secondary num font-numeric-table">
                  {listings.length} columns
                </div>
              </div>

              <div className="overflow-x-auto">
                <div className="w-max min-w-full overflow-hidden rounded-[28px] border border-white/[0.06] bg-white/[0.02]">
                  <div
                    className="grid gap-px bg-white/[0.05]"
                    style={{ gridTemplateColumns }}
                  >
                    <div className="sticky left-0 z-30 bg-[#0f0f0f] p-3 sm:p-4">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Layout</p>
                      <p className="mt-2 text-[1rem] text-text-primary sm:text-[1.1rem]" style={displayFontStyle}>
                        Table columns
                      </p>
                      <p className="mt-1 text-[11px] leading-5 text-text-secondary">
                        Compare cards first, then scan rows beneath.
                      </p>
                    </div>

                    {listings.map((listing, index) => {
                      const accent = SLOT_ACCENTS[index] ?? SLOT_ACCENTS[0];
                      return (
                        <div key={listing.id} className="relative bg-[#0f0f0f] p-3 sm:p-4">
                          <div className={`absolute inset-x-0 top-0 h-0.5 ${accent.bar}`} />

                          <div className="flex items-start justify-between gap-2">
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${accent.badge}`}>
                              Listing {index + 1}
                            </span>
                            {listing.url && (
                              <a
                                href={listing.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-text-muted transition-colors hover:border-white/[0.16] hover:text-text-primary"
                                aria-label={`Open ${listing.title || 'listing'} in new tab`}
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>

                          <p className="mt-3 text-[10px] uppercase tracking-[0.16em] text-text-muted">
                            {[listing.source, listing.property_type].filter(Boolean).join(' · ') || 'Property'}
                          </p>
                          <p
                            className="mt-2 text-[1.5rem] leading-none text-text-primary num sm:text-[1.75rem]"
                            style={displayFontStyle}
                          >
                            {formatTotalPrice(listing)}
                          </p>
                          <p className="mt-1 text-[11px] text-text-secondary">Total asking price</p>

                          <p className="mt-4 line-clamp-2 text-[13px] font-semibold leading-5 text-text-primary">
                            {listing.title || 'Untitled listing'}
                          </p>
                          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-text-secondary">
                            <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-text-muted" />
                            <span className="truncate">{listingPlace(listing)}</span>
                          </div>

                          {listing.url && (
                            <a
                              href={listing.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`mt-4 inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-semibold transition-colors ${accent.button}`}
                            >
                              View source
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {METRIC_ROWS.map((row, rowIndex) => {
                    const winnerIndex = row.winner ? row.winner(listings) : null;
                    const rowSurface = rowIndex % 2 === 0 ? 'bg-[#111111]' : 'bg-[#0f0f0f]';

                    return (
                      <div
                        key={row.id}
                        className="grid gap-px bg-white/[0.05]"
                        style={{ gridTemplateColumns }}
                      >
                        <div className={`sticky left-0 z-20 border-r border-white/[0.04] px-3 py-3.5 sm:px-4 ${rowSurface}`}>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
                            {row.label}
                          </p>
                          <p className="mt-1 text-[11px] leading-5 text-text-muted">
                            {row.sublabel}
                          </p>
                        </div>

                        {listings.map((listing, index) => {
                          const cell = row.render(listing);
                          const isWinner = winnerIndex === index && cell.display !== 'N/A';
                          const showDealScorePill = row.id === 'deal-score' && listing.deal_score !== null;

                          return (
                            <div
                              key={`${row.id}-${listing.id}`}
                              className={`relative flex items-center px-3 py-3.5 sm:px-4 ${rowSurface}`}
                            >
                              {isWinner && (
                                <span className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-success" />
                              )}

                              <div className="flex w-full items-center justify-between gap-3">
                                {showDealScorePill ? (
                                  <DealScorePill score={listing.deal_score} variant="compare" />
                                ) : (
                                  <span className={`text-[13px] font-semibold leading-5 sm:text-[14px] num font-numeric-table ${cellToneClass(cell.tone, isWinner)}`}>
                                    {cell.display}
                                  </span>
                                )}
                                {isWinner && row.winnerLabel && (
                                  <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300">
                                    {row.winnerLabel}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-white/[0.07] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <p className="text-[12px] text-text-secondary">
                  Interaction flow: select listings in the tray, unlock at 2 items, compare in a swipeable 2-4 column sheet.
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-text-muted">
                  Edit selection in the tray to swap columns
                </p>
              </div>

              <button
                onClick={onClose}
                className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-[12px] font-semibold text-text-secondary transition-colors hover:border-white/[0.16] hover:text-text-primary cursor-pointer"
              >
                Close comparison
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
