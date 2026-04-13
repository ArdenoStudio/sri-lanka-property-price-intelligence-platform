import { AnimatePresence, motion } from 'framer-motion';
import { X, ArrowRight, Table, Layers, Trash2 } from 'lucide-react';
import type { Listing } from '../api';

interface Props {
  selected: Listing[];
  onRemove: (id: number) => void;
  onClear: () => void;
  onCompare: () => void;
}

export function ComparisonTray({ selected, onRemove, onClear, onCompare }: Props) {
  // Keep AnimatePresence for the tray enter/exit — this is materially important UX
  // But simplify individual item animations to CSS transitions

  return (
    <AnimatePresence>
      {selected.length > 0 && (
        <motion.div
          initial={{ y: 40, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 40, opacity: 0, scale: 0.98, transition: { duration: 0.18, ease: 'easeIn' } }}
          transition={{ type: 'spring', stiffness: 260, damping: 26, mass: 0.7 }}
          className="fixed bottom-0 max-sm:bottom-[72px] left-0 right-0 z-40 px-4 pb-4 pointer-events-none"
        >
          <div className="max-w-4xl mx-auto bg-[#111111] border-t border-white/[0.1] rounded-2xl shadow-2xl p-4 flex flex-col sm:flex-row items-center gap-4 pointer-events-auto">
            <div className="flex items-center gap-2 pr-4 border-b sm:border-b-0 sm:border-r border-border w-full sm:w-auto pb-2 sm:pb-0">
              <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center text-accent-light border border-accent/20">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-text-primary whitespace-nowrap">Compare Mode</h4>
                <p className="text-[10px] text-text-muted uppercase font-bold">{selected.length} properties selected</p>
              </div>
            </div>

            <div className="flex-1 flex items-center gap-2 overflow-x-auto overflow-y-visible py-3 scrollbar-hide no-scrollbar w-full sm:w-auto">
              {selected.map((item) => (
                <div
                  key={item.id}
                  className="flex-shrink-0 w-32 relative group overflow-visible css-tray-item-in"
                >
                  <div className="h-16 bg-bg-card-hover border border-border rounded-lg p-2 flex flex-col justify-center">
                    <p className="text-[10px] font-bold text-text-primary truncate mb-1">{item.title}</p>
                    <p className="text-[10px] text-accent-light font-bold">
                      {item.price_lkr ? `Rs ${(item.price_lkr / 1_000_000).toFixed(1)}M` : 'N/A'}
                    </p>
                  </div>
                  <button
                    onClick={() => onRemove(item.id)}
                    aria-label={`Remove ${item.title || 'listing'} from comparison`}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-danger text-white rounded-full flex items-center justify-center shadow-lg border-2 border-bg-card cursor-pointer sm:opacity-0 sm:group-hover:opacity-100 transition-all hover:scale-110 active:scale-95"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}

              {selected.length < 3 && (
                <div className="flex-shrink-0 w-32 border border-dashed border-border rounded-lg h-16 flex items-center justify-center text-[10px] text-text-muted italic text-center p-2">
                  Select {3 - selected.length} more to compare
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={onClear}
                className="flex-1 sm:flex-none h-10 sm:w-10 sm:h-10 rounded-xl border border-border text-text-muted hover:text-danger hover:border-danger/30 transition-all cursor-pointer bg-transparent flex items-center justify-center hover:rotate-[-12deg] active:scale-95"
                aria-label="Clear all from comparison"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={onCompare}
                disabled={selected.length < 2}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#14b8a6] hover:bg-[#5eead4] disabled:bg-white/[0.08] disabled:text-white/30 text-black rounded-xl px-6 py-2.5 text-sm font-semibold transition-all border-none cursor-pointer`}
              >
                <Table className="w-4 h-4" />
                Compare Now
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
