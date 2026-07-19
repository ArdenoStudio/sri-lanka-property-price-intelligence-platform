import '@fontsource/cal-sans';
import '@fontsource-variable/inter';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, MapPin, Table, Trash2, X } from 'lucide-react';
import type { Listing } from '../api';
import { formatCurrencyAmount } from '../lib/pricing';
import { DealScorePill } from './DealScore';

interface Props {
  selected: Listing[];
  maxSlots?: number;
  minCompare?: number;
  onRemove: (id: number) => void;
  onClear: () => void;
  onCompare: () => void;
}

function formatCompactLkr(value: number | null): string {
  if (value === null) return 'N/A';
  return formatCurrencyAmount(value, 'LKR', { variant: 'table' });
}

function listingPlaceLabel(listing: Listing): string {
  return listing.district || listing.city || listing.raw_location || 'Sri Lanka';
}

const displayFontStyle = {
  fontFamily: "'Cal Sans', 'Inter Variable', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  letterSpacing: '-0.04em',
} as const;

export function ComparisonTray({
  selected,
  maxSlots = 4,
  minCompare = 2,
  onRemove,
  onClear,
  onCompare,
}: Props) {
  const remainingToCompare = Math.max(minCompare - selected.length, 0);
  const remainingSlots = Math.max(maxSlots - selected.length, 0);

  return (
    <AnimatePresence>
      {selected.length > 0 && (
        <motion.div
          initial={{ y: 40, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 40, opacity: 0, scale: 0.98, transition: { duration: 0.18, ease: 'easeIn' } }}
          transition={{ type: 'spring', stiffness: 260, damping: 26, mass: 0.7 }}
          className="fixed bottom-0 max-sm:bottom-[72px] left-0 right-0 z-40 px-3 pb-3 sm:px-4 sm:pb-4 pointer-events-none"
        >
          <div className="pointer-events-auto max-w-6xl mx-auto rounded-[28px] border border-white/[0.08] bg-[#0b0b0b]/95 shadow-2xl backdrop-blur-xl">
            <div className="flex flex-col gap-4 p-3 sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-accent/15 border border-accent/20 flex items-center justify-center text-accent-light flex-shrink-0">
                    <Table className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-text-muted">Comparison tray</p>
                    <h4
                      className="text-[1.05rem] sm:text-[1.2rem] leading-none text-text-primary"
                      style={displayFontStyle}
                    >
                      Compare 2-4 Sri Lanka listings
                    </h4>
                    <p className="mt-1 text-[12px] sm:text-[13px] text-text-secondary">
                      Price/perch, beds, size, deal score, and district in one mobile-first table.
                    </p>
                  </div>
                </div>

                <div className="flex-shrink-0 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[11px] font-semibold text-text-secondary num font-numeric-table">
                  {selected.length}/{maxSlots}
                </div>
              </div>

              <div className="flex gap-3 overflow-x-auto md:grid md:grid-cols-4 md:overflow-visible">
                {selected.map((item, index) => (
                  <div
                    key={item.id}
                    className="relative min-w-[220px] flex-1 rounded-2xl border border-white/[0.08] bg-[#111111] p-3"
                  >
                    <button
                      onClick={() => onRemove(item.id)}
                      aria-label={`Remove ${item.title || 'listing'} from comparison`}
                      className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.08] bg-black/60 text-text-muted transition-colors hover:text-white hover:border-white/[0.16] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>

                    <div className="pr-8">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="rounded-full border border-accent/20 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-light">
                          Listing {index + 1}
                        </span>
                        <span className="text-[10px] uppercase tracking-[0.18em] text-text-muted">
                          {item.source}
                        </span>
                      </div>

                      <p className="line-clamp-2 min-h-[2.5rem] text-[13px] font-semibold leading-5 text-text-primary">
                        {item.title || 'Untitled listing'}
                      </p>

                      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-text-secondary">
                        <MapPin className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                        <span className="truncate">{listingPlaceLabel(item)}</span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
                          <p className="text-[9px] uppercase tracking-[0.18em] text-text-muted">Price / perch</p>
                          <p className="mt-1 text-[12px] font-semibold text-accent-light num font-numeric-table">
                            {item.price_per_perch ? `${formatCompactLkr(item.price_per_perch)}` : 'N/A'}
                          </p>
                        </div>
                        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
                          <p className="text-[9px] uppercase tracking-[0.18em] text-text-muted">Deal score</p>
                          <div className="mt-1">
                            {item.deal_score !== null ? (
                              <DealScorePill score={item.deal_score} variant="compare" />
                            ) : (
                              <p className="text-[12px] font-semibold text-text-secondary num font-numeric-table">Deal N/A</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {Array.from({ length: remainingSlots }).map((_, index) => (
                  <div
                    key={`empty-slot-${index}`}
                    className="min-w-[220px] flex-1 rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] p-3"
                  >
                    <div className="flex h-full min-h-[152px] flex-col justify-between">
                      <span className="w-fit rounded-full border border-white/[0.06] bg-black/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                        Slot {selected.length + index + 1}
                      </span>
                      <div>
                        <p className="text-[1rem] text-text-primary" style={displayFontStyle}>
                          Add another listing
                        </p>
                        <p className="mt-1 text-[12px] leading-5 text-text-secondary">
                          Build a 2-4 column comparison before opening the table view.
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-3 border-t border-white/[0.06] pt-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[12px] text-text-secondary">
                    {selected.length >= minCompare
                      ? 'Ready to compare. Open the table to scan value, size, and district side by side.'
                      : `Select ${remainingToCompare} more listing${remainingToCompare === 1 ? '' : 's'} to unlock comparison.`}
                  </p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-text-muted">
                    {remainingSlots === 0
                      ? 'Tray full - remove one listing to swap.'
                      : `${remainingSlots} slot${remainingSlots === 1 ? '' : 's'} left`}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={onClear}
                    className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] text-text-muted transition-colors hover:text-danger hover:border-danger/25 cursor-pointer"
                    aria-label="Clear all from comparison"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={onCompare}
                    disabled={selected.length < minCompare}
                    className="flex min-w-[176px] items-center justify-center gap-2 rounded-2xl bg-[#14b8a6] px-5 py-3 text-[13px] font-semibold text-black transition-all hover:bg-[#5eead4] disabled:bg-white/[0.08] disabled:text-white/30 disabled:hover:bg-white/[0.08] cursor-pointer disabled:cursor-not-allowed"
                  >
                    <span>{selected.length >= minCompare ? `Compare ${selected.length} listings` : 'Select 2 to compare'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
