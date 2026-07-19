import { useEffect, useMemo, useState } from 'react';
import { Bell, BellOff, Bookmark, Check, Sparkles, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { getFilterFingerprint, useSavedSearches } from '../hooks/useSavedSearches';
import type { FilterState } from '../hooks/useSavedSearches';
import { formatCurrencyAmount } from '../lib/pricing';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentFilters: FilterState;
  currentResultCount: number;
  onApplySearch: (f: FilterState) => void;
}

const DISPLAY_FONT = "'Cal Sans', 'Inter Variable', sans-serif";
const BODY_FONT = "'Inter Variable', 'Inter', sans-serif";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-LK', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function formatPrice(value: number): string {
  return formatCurrencyAmount(value, 'LKR', { variant: 'table' });
}

function formatBudget(filters: FilterState): string | null {
  const { minPrice, maxPrice } = filters;
  if (minPrice === '' && maxPrice === '') return null;
  if (minPrice !== '' && maxPrice !== '') return `${formatPrice(minPrice)} - ${formatPrice(maxPrice)}`;
  if (minPrice !== '') return `${formatPrice(minPrice)}+`;
  return `Up to ${formatPrice(maxPrice as number)}`;
}

function formatSize(filters: FilterState): string | null {
  const usingSqft = filters.minSizeSqft !== '' || filters.maxSizeSqft !== '';
  const min = usingSqft ? filters.minSizeSqft : filters.minSizePerches;
  const max = usingSqft ? filters.maxSizeSqft : filters.maxSizePerches;
  const unit = usingSqft ? 'sqft' : 'P';

  if (min === '' && max === '') return null;
  if (min !== '' && max !== '') return `${min}-${max}${unit}`;
  if (min !== '') return `${min}${unit}+`;
  return `Up to ${max}${unit}`;
}

function formatType(type: string): string | null {
  if (!type) return null;
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function formatListingType(listingType: string): string | null {
  if (!listingType) return null;
  return listingType === 'sale' ? 'For sale' : 'For rent';
}

function formatSource(source: string): string | null {
  if (!source) return null;
  if (source === 'ikman') return 'ikman.lk';
  if (source === 'lpw') return 'LPW';
  if (source === 'lamudi') return 'house.lk';
  return source;
}

function formatSort(sortBy: string): string | null {
  if (!sortBy || sortBy === 'newest') return null;
  if (sortBy === 'price_asc') return 'Price low-high';
  if (sortBy === 'price_desc') return 'Price high-low';
  return sortBy;
}

function getSecondaryTags(filters: FilterState): string[] {
  return [
    formatType(filters.type),
    formatListingType(filters.listingType),
    formatBudget(filters),
    filters.minBaths > 0 ? `${filters.minBaths}+ baths` : null,
    formatSize(filters),
    formatSource(filters.source),
    formatSort(filters.sortBy),
  ].filter(Boolean) as string[];
}

function DimensionTile({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`rounded-2xl border px-3 py-3 ${muted ? 'border-white/[0.05] bg-white/[0.02]' : 'border-white/[0.08] bg-black/30'}`}>
      <p className="text-[10px] uppercase tracking-[0.18em] text-[#525252]">{label}</p>
      <p className={`mt-1 text-[13px] ${muted ? 'text-[#737373]' : 'text-white'}`}>{value}</p>
    </div>
  );
}

export function SavedSearches({
  isOpen,
  onClose,
  currentFilters,
  currentResultCount,
  onApplySearch,
}: Props) {
  const {
    searches,
    save,
    remove,
    toggleNotifications,
    markSeen,
    hasFilters,
    getMatchingSearch,
  } = useSavedSearches();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const canSave = hasFilters(currentFilters);
  const currentFingerprint = useMemo(() => getFilterFingerprint(currentFilters), [currentFilters]);
  const existingCurrentSearch = getMatchingSearch(currentFilters);
  const previewTags = getSecondaryTags(currentFilters);

  useEffect(() => {
    if (!statusMessage) return undefined;
    const timeout = window.setTimeout(() => setStatusMessage(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [statusMessage]);

  const handleSave = () => {
    if (!canSave) return;
    const alreadySaved = Boolean(existingCurrentSearch);
    save(currentFilters, currentResultCount);
    setStatusMessage(alreadySaved ? 'Updated this saved search in your browser.' : 'Saved search to this browser.');
  };

  const handleRemove = (id: string) => {
    remove(id);
    setStatusMessage('Removed saved search from this browser.');
  };

  const handleToggleNotifications = (id: string) => {
    const enabled = toggleNotifications(id);
    setStatusMessage(
      enabled
        ? 'Tracking new matches on this device for this search.'
        : 'Turned off local new-match tracking.'
    );
  };

  const currentDealConcept = existingCurrentSearch?.notificationsEnabled ? '5%+ watch' : 'Not set';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-[900] bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          <motion.div
            className="fixed right-0 top-0 bottom-0 z-[901] w-full max-w-md bg-[#111111] border-l border-white/[0.08] shadow-[-16px_0_64px_rgba(0,0,0,0.7)] flex flex-col"
            style={{ fontFamily: BODY_FONT }}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="px-6 pt-6 pb-5 border-b border-white/[0.06] flex-shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-[#737373]">
                      Saved locally
                    </span>
                    <span className="text-[11px] text-[#525252]">{searches.length} stored</span>
                  </div>
                  <h2 className="text-[24px] text-white leading-none" style={{ fontFamily: DISPLAY_FONT }}>
                    Saved Searches
                  </h2>
                  <p className="mt-2 text-[12px] text-[#737373] max-w-xs">
                    Reuse dense filter sets quickly. Searches live in localStorage on this browser only.
                  </p>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Close saved searches"
                  className="w-9 h-9 rounded-full bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center transition-colors cursor-pointer border-none flex-shrink-0"
                >
                  <X className="w-4 h-4 text-[#a3a3a3]" />
                </button>
              </div>

              {statusMessage && (
                <div className="mt-4 rounded-2xl border border-white/15 bg-white/[0.06] px-3.5 py-3 text-[12px] text-[#e5e5e5]">
                  {statusMessage}
                </div>
              )}
            </div>

            <div className="px-6 py-5 border-b border-white/[0.06] flex-shrink-0">
              <div className="rounded-[24px] border border-white/[0.08] bg-[#161616] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[#525252]">Current filters</p>
                    <h3 className="mt-1 text-[20px] text-white" style={{ fontFamily: DISPLAY_FONT }}>
                      {canSave ? (existingCurrentSearch ? 'Update current search' : 'Save current search') : 'Nothing to save yet'}
                    </h3>
                    <p className="mt-1 text-[12px] text-[#737373]">
                      {canSave
                        ? `${currentResultCount.toLocaleString()} live matches on this device.`
                        : 'Apply district, beds, price, or other filters to create a saved search.'}
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-black/30 px-2.5 py-1 text-[11px] text-[#a3a3a3]">
                    <Bookmark className="w-3 h-3" />
                    Browser only
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <DimensionTile label="District" value={currentFilters.district || 'All districts'} muted={!currentFilters.district} />
                  <DimensionTile label="Beds" value={currentFilters.minBeds > 0 ? `${currentFilters.minBeds}+ beds` : 'Any'} muted={currentFilters.minBeds === 0} />
                  <DimensionTile label="Deal score" value={currentDealConcept} muted={currentDealConcept === 'Not set'} />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {previewTags.length > 0 ? (
                    previewTags.map(tag => (
                      <span
                        key={tag}
                        className="rounded-full border border-white/[0.08] bg-black/20 px-2.5 py-1 text-[11px] text-[#a3a3a3]"
                      >
                        {tag}
                      </span>
                    ))
                  ) : (
                    <p className="text-[11px] text-[#525252]">
                      Saved cards will summarize extra filters like property type, price, baths, size, source, and sort.
                    </p>
                  )}
                </div>

                <button
                  onClick={handleSave}
                  disabled={!canSave}
                  className={`mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-[13px] font-medium transition-all cursor-pointer border-none ${
                    canSave
                      ? 'bg-white hover:bg-[#e5e5e5] text-black'
                      : 'bg-white/[0.04] text-[#525252] cursor-not-allowed'
                  }`}
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  {canSave ? (existingCurrentSearch ? 'Update saved search' : 'Save to this browser') : 'No active filters to save'}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {searches.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-white/[0.1] bg-[#161616] px-5 py-10 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.08] bg-black/30">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-[22px] text-white" style={{ fontFamily: DISPLAY_FONT }}>
                    Start a compact watchlist
                  </h3>
                  <p className="mt-2 text-[13px] text-[#737373] max-w-[260px] mx-auto">
                    Save filters like district, beds, budget, and source here. Later, turn on local new-match tracking for the searches you care about most.
                  </p>
                  <div className="mt-5 grid grid-cols-1 gap-2 text-left">
                    {[
                      '1. Apply a focused set of filters on the listings view.',
                      '2. Save that search to this browser.',
                      '3. Re-open it anytime and track new matches locally.',
                    ].map(step => (
                      <div key={step} className="rounded-2xl border border-white/[0.06] bg-black/20 px-3.5 py-3 text-[12px] text-[#a3a3a3]">
                        {step}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                searches.map(search => {
                  const isCurrent = getFilterFingerprint(search.filters) === currentFingerprint;
                  const tags = getSecondaryTags(search.filters);
                  const newMatches =
                    isCurrent && search.notificationsEnabled && typeof search.lastResultCount === 'number'
                      ? Math.max(currentResultCount - search.lastResultCount, 0)
                      : 0;

                  const notificationLabel = !search.notificationsEnabled
                    ? 'Local watch is off.'
                    : !isCurrent
                      ? 'Apply this search to check for new matches on this device.'
                      : newMatches > 0
                        ? `${newMatches.toLocaleString()} new matches since the last check.`
                        : 'No new matches since the last check.';

                  const baselineLabel =
                    typeof search.lastResultCount === 'number'
                      ? `${search.lastResultCount.toLocaleString()} matches at last check`
                      : 'No baseline captured yet';

                  return (
                    <div
                      key={search.id}
                      className="group rounded-[24px] border border-white/[0.06] bg-[#161616] p-4 hover:border-white/[0.1] transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-[20px] text-white leading-none truncate" style={{ fontFamily: DISPLAY_FONT }}>
                              {search.name}
                            </h3>
                            {isCurrent && (
                              <span className="rounded-full border border-white/20 bg-white/[0.08] px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-white">
                                Live
                              </span>
                            )}
                          </div>
                          <p className="mt-2 text-[11px] text-[#737373]">
                            Saved {formatDate(search.savedAt)} · {baselineLabel}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRemove(search.id)}
                          aria-label={`Delete saved search ${search.name}`}
                          className="flex-shrink-0 w-8 h-8 rounded-full bg-white/[0.04] hover:bg-red-500/[0.15] flex items-center justify-center transition-all cursor-pointer border-none"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-[#737373] hover:text-[#a3a3a3]" />
                        </button>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-2">
                        <DimensionTile label="District" value={search.filters.district || 'All districts'} muted={!search.filters.district} />
                        <DimensionTile label="Beds" value={search.filters.minBeds > 0 ? `${search.filters.minBeds}+ beds` : 'Any'} muted={search.filters.minBeds === 0} />
                        <DimensionTile
                          label="Deal score"
                          value={search.notificationsEnabled ? '5%+ watch' : 'Any'}
                          muted={!search.notificationsEnabled}
                        />
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {tags.length > 0 ? (
                          tags.map(tag => (
                            <span
                              key={`${search.id}-${tag}`}
                              className="rounded-full border border-white/[0.08] bg-black/20 px-2.5 py-1 text-[11px] text-[#a3a3a3]"
                            >
                              {tag}
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] text-[#525252]">No extra filter dimensions</span>
                        )}
                      </div>

                      <div className="mt-4 rounded-2xl border border-white/[0.06] bg-black/30 p-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-[#525252]">New matches</p>
                            <p className="mt-1 text-[13px] text-white">{notificationLabel}</p>
                            <p className="mt-1 text-[11px] text-[#737373]">
                              Local-only concept. This compares the current result count on this device when the saved search is active.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleToggleNotifications(search.id)}
                            className={`flex h-9 min-w-9 items-center justify-center rounded-full border transition-colors cursor-pointer ${
                              search.notificationsEnabled
                                ? 'border-white/25 bg-white/[0.1] text-white'
                                : 'border-white/[0.08] bg-white/[0.03] text-[#737373] hover:text-white'
                            }`}
                            aria-label={search.notificationsEnabled ? 'Disable local match tracking' : 'Enable local match tracking'}
                            title={search.notificationsEnabled ? 'Disable local match tracking' : 'Enable local match tracking'}
                          >
                            {search.notificationsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => {
                            onApplySearch(search.filters);
                            setStatusMessage(`Applied ${search.name}.`);
                          }}
                          className="flex-1 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] px-3 py-2.5 text-[12px] font-medium text-[#d4d4d4] hover:text-white transition-colors cursor-pointer border-none"
                        >
                          Apply search
                        </button>
                        {search.notificationsEnabled && isCurrent && (
                          <button
                            onClick={() => {
                              markSeen(search.id, currentResultCount);
                              setStatusMessage('Marked current matches as seen.');
                            }}
                            className="rounded-2xl border border-white/[0.08] bg-transparent hover:bg-white/[0.04] px-3 py-2.5 text-[12px] font-medium text-[#a3a3a3] hover:text-white transition-colors cursor-pointer"
                          >
                            <span className="inline-flex items-center gap-1.5">
                              <Check className="w-3.5 h-3.5" />
                              Mark seen
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="h-safe-bottom flex-shrink-0 pb-6" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
