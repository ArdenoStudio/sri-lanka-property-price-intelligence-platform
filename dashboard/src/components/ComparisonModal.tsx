import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, Scale, MapPin, Home, Maximize } from 'lucide-react';
import type { Listing } from '../api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  listings: Listing[];
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `Rs ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `Rs ${(n / 1_000).toFixed(0)}K`;
  return `Rs ${n}`;
}

function typeColor(t: string | null) {
  if (t === 'land') return 'bg-success/20 text-success border-success/30';
  if (t === 'house') return 'bg-accent/20 text-accent-light border-accent/30';
  if (t === 'apartment') return 'bg-warning/20 text-warning border-warning/30';
  return 'bg-border text-text-muted border-border';
}

type WinFn = (listings: Listing[]) => number | null;

interface Row {
  label: string;
  sub?: string;
  render: (l: Listing) => { display: string; raw: number | null };
  winFn?: WinFn;
  invert?: boolean;
}

const ROWS: Row[] = [
  {
    label: 'Total Price',
    sub: 'advertised price',
    render: (l) => ({
      display: l.price_lkr ? fmt(l.price_lkr) : l.raw_price || 'N/A',
      raw: l.price_lkr,
    }),
    winFn: (ls) => {
      const vals = ls.map((l) => l.price_lkr);
      const valid = vals.filter((v): v is number => v !== null);
      if (!valid.length) return null;
      const min = Math.min(...valid);
      return vals.indexOf(min);
    },
  },
  {
    label: 'Price / Perch',
    sub: 'per unit of land',
    render: (l) => ({
      display: l.price_per_perch ? `${fmt(l.price_per_perch)} / perch` : 'N/A',
      raw: l.price_per_perch,
    }),
    winFn: (ls) => {
      const vals = ls.map((l) => l.price_per_perch);
      const valid = vals.filter((v): v is number => v !== null);
      if (!valid.length) return null;
      const min = Math.min(...valid);
      return vals.indexOf(min);
    },
  },
  {
    label: 'Deal Score',
    sub: 'vs market median',
    render: (l) => ({
      display:
        l.deal_score !== null
          ? `${l.deal_score > 0 ? '+' : ''}${l.deal_score.toFixed(1)}%`
          : 'N/A',
      raw: l.deal_score,
    }),
    winFn: (ls) => {
      const vals = ls.map((l) => l.deal_score);
      const valid = vals.filter((v): v is number => v !== null);
      if (!valid.length) return null;
      const max = Math.max(...valid);
      return vals.indexOf(max);
    },
    invert: true,
  },
  {
    label: 'Price Drop',
    sub: 'from original ask',
    render: (l) => ({
      display:
        l.price_drop_pct !== null && l.price_drop_pct > 0
          ? `↓ ${l.price_drop_pct.toFixed(1)}%`
          : '—',
      raw: l.price_drop_pct,
    }),
    winFn: (ls) => {
      const vals = ls.map((l) => l.price_drop_pct);
      const valid = vals.filter((v): v is number => v !== null && v > 0);
      if (!valid.length) return null;
      const max = Math.max(...valid);
      return ls.findIndex((l) => l.price_drop_pct === max);
    },
    invert: true,
  },
  {
    label: 'Size',
    sub: 'land area',
    render: (l) => ({
      display: l.size_perches ? `${l.size_perches} perches` : 'N/A',
      raw: l.size_perches,
    }),
  },
  {
    label: 'Days Listed',
    sub: 'time on market',
    render: (l) => ({
      display: l.days_on_market !== null ? `${l.days_on_market}d` : 'N/A',
      raw: l.days_on_market,
    }),
    winFn: (ls) => {
      const vals = ls.map((l) => l.days_on_market);
      const valid = vals.filter((v): v is number => v !== null);
      if (!valid.length) return null;
      const min = Math.min(...valid);
      return vals.indexOf(min);
    },
  },
  {
    label: 'Bedrooms',
    sub: 'rooms',
    render: (l) => ({
      display: l.bedrooms !== null ? String(l.bedrooms) : 'N/A',
      raw: l.bedrooms,
    }),
    winFn: (ls) => {
      const vals = ls.map((l) => l.bedrooms);
      const valid = vals.filter((v): v is number => v !== null);
      if (!valid.length) return null;
      const max = Math.max(...valid);
      return vals.indexOf(max);
    },
    invert: true,
  },
];

const SLOT_COLORS = [
  { bar: 'bg-accent', ring: 'ring-accent/40', badge: 'bg-accent/15 text-accent-light border-accent/25' },
  { bar: 'bg-success', ring: 'ring-success/40', badge: 'bg-success/15 text-success border-success/25' },
  { bar: 'bg-warning', ring: 'ring-warning/40', badge: 'bg-warning/15 text-warning border-warning/25' },
];

const GRID_COLS = 'grid-cols-[100px_repeat(3,1fr)] sm:grid-cols-[140px_repeat(3,1fr)]';

export function ComparisonModal({ isOpen, onClose, listings }: Props) {
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="relative w-full max-w-4xl mx-2 sm:mx-4 mb-0 sm:mb-4 bg-[#111111] border border-white/[0.1] rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/[0.07]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-accent/20 border border-accent/30 flex items-center justify-center">
                  <Scale className="w-4 h-4 text-accent-light" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-text-primary">Compare Listings</h2>
                  <p className="text-[10px] text-text-muted uppercase tracking-wider">
                    {listings.length} of 3 slots filled
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/10 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable content — horizontal scroll on mobile */}
            <div className="flex-1 overflow-y-auto overflow-x-auto">
              <div className="min-w-[460px]">
                {/* Listing header cards */}
                <div className={`grid ${GRID_COLS} gap-px bg-white/[0.04] border-b border-white/[0.07]`}>
                  <div className="bg-[#111111] p-3 sm:p-4 sticky left-0 z-10" />
                  {listings.map((l, i) => {
                    const col = SLOT_COLORS[i];
                    const Icon = l.property_type === 'land' ? Maximize : Home;
                    return (
                      <div key={l.id} className="bg-[#111111] p-3 sm:p-4 relative overflow-hidden">
                        <div className={`absolute top-0 left-0 right-0 h-0.5 ${col.bar}`} />
                        <p className="text-[11px] sm:text-xs font-semibold text-text-primary line-clamp-2 leading-snug mb-2 min-h-[2rem]">
                          {l.title || 'Untitled'}
                        </p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-semibold border ${typeColor(l.property_type)}`}>
                            <Icon className="w-2.5 h-2.5" />
                            {l.property_type || 'property'}
                          </span>
                          <span className="text-[9px] text-text-muted uppercase font-bold">{l.source}</span>
                          {l.url && (
                            <a href={l.url} target="_blank" rel="noopener noreferrer"
                              className="ml-auto text-text-muted hover:text-accent-light transition-colors"
                              aria-label="View listing">
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {Array.from({ length: 3 - listings.length }).map((_, i) => (
                    <div key={i} className="bg-[#111111] p-3 sm:p-4 flex items-center justify-center min-h-[60px]">
                      <p className="text-[10px] text-text-muted/30 uppercase tracking-widest font-bold">Empty</p>
                    </div>
                  ))}
                </div>

                {/* Metric rows */}
                {ROWS.map((row, ri) => {
                  const winnerIdx = row.winFn ? row.winFn(listings) : null;
                  return (
                    <div key={row.label} className={`grid ${GRID_COLS} gap-px bg-white/[0.03] ${ri % 2 === 0 ? '' : 'bg-white/[0.015]'}`}>
                      <div className="bg-[#111111] px-3 sm:px-4 py-3 flex flex-col justify-center border-r border-white/[0.06] sticky left-0 z-10">
                        <p className="text-[9px] sm:text-[10px] font-bold text-text-secondary uppercase tracking-wider">{row.label}</p>
                        {row.sub && <p className="text-[8px] sm:text-[9px] text-text-muted mt-0.5 hidden sm:block">{row.sub}</p>}
                      </div>
                      {listings.map((l, i) => {
                        const { display, raw } = row.render(l);
                        const isWinner = winnerIdx === i;
                        const isNA = display === 'N/A' || display === '—';
                        return (
                          <div key={l.id} className={`relative px-3 sm:px-4 py-3 flex items-center ${isWinner ? 'bg-teal-950/40' : 'bg-[#111111]'}`}>
                            {isWinner && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-3/4 rounded-r bg-success" />}
                            <span className={`text-xs sm:text-sm font-semibold truncate ${
                              isNA ? 'text-text-muted/40'
                                : isWinner ? 'text-success'
                                : (row.label === 'Total Price' || row.label === 'Price / Perch') ? 'text-accent-light'
                                : row.label === 'Price Drop' ? (raw && raw > 0 ? 'text-warning' : 'text-text-muted/40')
                                : row.label === 'Deal Score' ? (raw !== null && raw > 0 ? 'text-success' : raw !== null && raw < 0 ? 'text-danger' : 'text-text-muted')
                                : 'text-text-primary'
                            }`}>
                              {display}
                            </span>
                            {isWinner && !isNA && (
                              <span className="ml-auto text-[8px] sm:text-[9px] font-bold text-success uppercase tracking-wider opacity-70 pl-1">Best</span>
                            )}
                          </div>
                        );
                      })}
                      {Array.from({ length: 3 - listings.length }).map((_, i) => (
                        <div key={i} className="bg-[#111111] px-3 sm:px-4 py-3" />
                      ))}
                    </div>
                  );
                })}

                {/* District row */}
                <div className={`grid ${GRID_COLS} gap-px bg-white/[0.03] border-t border-white/[0.06]`}>
                  <div className="bg-[#111111] px-3 sm:px-4 py-3 flex flex-col justify-center border-r border-white/[0.06] sticky left-0 z-10">
                    <p className="text-[9px] sm:text-[10px] font-bold text-text-secondary uppercase tracking-wider">District</p>
                  </div>
                  {listings.map((l) => (
                    <div key={l.id} className="bg-[#111111] px-3 sm:px-4 py-3 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-text-muted flex-shrink-0" />
                      <span className="text-[11px] sm:text-xs text-text-secondary truncate">{l.district || '—'}</span>
                    </div>
                  ))}
                  {Array.from({ length: 3 - listings.length }).map((_, i) => (
                    <div key={i} className="bg-[#111111] px-3 sm:px-4 py-3" />
                  ))}
                </div>

                {/* View buttons */}
                <div className={`grid ${GRID_COLS} gap-px bg-white/[0.03] border-t border-white/[0.06]`}>
                  <div className="bg-[#111111] px-3 sm:px-4 py-3 sticky left-0 z-10" />
                  {listings.map((l, i) => {
                    const col = SLOT_COLORS[i];
                    return (
                      <div key={l.id} className="bg-[#111111] px-2 sm:px-3 py-3">
                        <a href={l.url || '#'} target="_blank" rel="noopener noreferrer"
                          className={`flex items-center justify-center gap-1 py-2 px-2 rounded-xl text-[9px] sm:text-[10px] font-bold uppercase tracking-wider border transition-all ${col.badge} hover:opacity-80`}>
                          View <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    );
                  })}
                  {Array.from({ length: 3 - listings.length }).map((_, i) => (
                    <div key={i} className="bg-[#111111] px-3 sm:px-4 py-3" />
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 sm:px-6 py-3 border-t border-white/[0.07] flex items-center justify-between gap-2">
              <p className="text-[9px] sm:text-[10px] text-text-muted">
                <span className="text-success font-bold">Best</span> = most favourable value
              </p>
              <button
                onClick={onClose}
                className="px-4 py-2 text-[11px] font-semibold text-text-secondary hover:text-text-primary bg-white/5 hover:bg-white/10 rounded-xl transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
