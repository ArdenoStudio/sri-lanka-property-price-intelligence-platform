import { X, Bookmark, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSavedSearches } from '../hooks/useSavedSearches';
import type { FilterState } from '../hooks/useSavedSearches';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentFilters: FilterState;
  onApplySearch: (f: FilterState) => void;
}

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

export function SavedSearches({ isOpen, onClose, currentFilters, onApplySearch }: Props) {
  const { searches, save, remove, hasFilters } = useSavedSearches();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[900] bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Slide-over panel */}
          <motion.div
            className="fixed right-0 top-0 bottom-0 z-[901] w-full max-w-sm bg-[#111111] border-l border-white/[0.08] shadow-[−16px_0_64px_rgba(0,0,0,0.7)] flex flex-col"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/[0.06] flex-shrink-0">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#525252] mb-1">Filter Library</p>
                <h2 className="text-[17px] font-bold text-white leading-none">Saved Searches</h2>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center transition-colors cursor-pointer border-none"
              >
                <X className="w-4 h-4 text-[#a3a3a3]" />
              </button>
            </div>

            {/* Save current search */}
            <div className="px-6 py-4 border-b border-white/[0.06] flex-shrink-0">
              <button
                onClick={() => save(currentFilters)}
                disabled={!hasFilters(currentFilters)}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-medium transition-all cursor-pointer border-none ${
                  hasFilters(currentFilters)
                    ? 'bg-[#14b8a6]/[0.12] hover:bg-[#14b8a6]/[0.2] text-[#14b8a6] border border-[#14b8a6]/30'
                    : 'bg-white/[0.04] text-[#525252] cursor-not-allowed'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                {hasFilters(currentFilters) ? 'Save current search' : 'No active filters to save'}
              </button>
            </div>

            {/* Saved search list */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {searches.length === 0 ? (
                <div className="text-center py-12">
                  <Bookmark className="w-8 h-8 text-[#2e2e2e] mx-auto mb-3" />
                  <p className="text-[13px] text-[#525252]">No saved searches yet.</p>
                  <p className="text-[11px] text-[#404040] mt-1">Apply some filters and save them here.</p>
                </div>
              ) : (
                searches.map(search => (
                  <div
                    key={search.id}
                    className="group bg-[#161616] border border-white/[0.06] rounded-2xl p-4 hover:border-white/[0.1] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-white leading-snug truncate">{search.name}</p>
                        <p className="text-[10px] text-[#525252] mt-0.5">{formatDate(search.savedAt)}</p>
                      </div>
                      <button
                        onClick={() => remove(search.id)}
                        className="flex-shrink-0 w-6 h-6 rounded-full bg-white/[0.04] hover:bg-red-500/[0.15] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer border-none"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3 text-[#525252] hover:text-red-400" />
                      </button>
                    </div>
                    <button
                      onClick={() => { onApplySearch(search.filters); onClose(); }}
                      className="w-full text-[12px] font-medium py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-[#a3a3a3] hover:text-white transition-colors cursor-pointer border-none"
                    >
                      Apply search
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Mobile bottom padding */}
            <div className="h-safe-bottom flex-shrink-0 pb-6" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
