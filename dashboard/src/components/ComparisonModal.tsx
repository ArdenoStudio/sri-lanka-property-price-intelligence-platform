import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, Scale, TrendingDown, Clock, BarChart2, MapPin, Home, Maximize } from 'lucide-react';
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
  winFn?: WinFn;    // index of "best" listing (lower = better unless invert)
  invert?: boolean; // higher = better
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
    label: 'Location',
    sub: 'district · city',
    render: (l) => ({
      display: [l.city, l.district].filter(Boolean).join(', ') || l.raw_location || 'N/A',
      raw: null,
    }),
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

export function ComparisonModal({ isOpen, onClose, listings }: Props) {
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Sheet */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="relative w-full max-w-4xl mx-4 mb-0 sm:mb-4 bg-[#0d0d1a] border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
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

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto">
              {/* Listing header cards */}
              <div className="grid grid-cols-[140px_repeat(3,1fr)] gap-px bg-border/30 border-b border-border/60">
                {/* spacer */}
                <div className="bg-[#0d0d1a] p-4" />
                {listings.map((l, i) => {
                  const col = SLOT_COLORS[i];
                  const Icon = l.property_type === 'land' ? Maximize : Home;
                  return (
                    <div key={l.id} className="bg-[#0d0d1a] p-4 relative overflow-hidden">
                      <div className={`absolute top-0 left-0 right-0 h-0.5 ${col.bar}`} />
                      <p className="text-xs font-semibold text-text-primary line-clamp-2 leading-snug mb-2 min-h-[2.5rem]">
                        {l.title || 'Untitled'}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${typeColor(l.property_type)}`}>
                          <Icon className="w-2.5 h-2.5" />
                          {l.property_type || 'property'}
                        </span>
                        <span className="text-[10px] text-text-muted uppercase font-bold">{l.source}</span>
                        {l.url && (
                          <a
                            href={l.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-auto text-text-muted hover:text-accent-light transition-colors"
                            aria-label="View listing"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
                {/* Empty slots */}
                {Array.from({ length: 3 - listings.length }).map((_, i) => (
                  <div key={i} className="bg-[#0d0d1a] p-4 flex items-center justify-center min-h-[80px]">
                    <p className="text-[10px] text-text-muted/30 uppercase tracking-widest font-bold">Empty</p>
                  </div>
                ))}
              </div>

              {/* Metric rows */}
              {ROWS.map((row, ri) => {
                const winnerIdx = row.winFn ? row.winFn(listings) : null;
                return (
                  <div
                    key={row.label}
                    className={`grid grid-cols-[140px_repeat(3,1fr)] gap-px bg-border/20 ${ri % 2 === 0 ? '' : 'bg-white/[0.015]'}`}
                  >
                    {/* Label */}
                    <div className="bg-[#0d0d1a] px-4 py-3.5 flex flex-col justify-center border-r border-border/40">
                      <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">{row.label}</p>
                      {row.sub && <p className="text-[9px] text-text-muted mt-0.5">{row.sub}</p>}
                    </div>

                    {/* Values */}
                    {listings.map((l, i) => {
                      const { display, raw } = row.render(l);
                      const isWinner = winnerIdx === i;
                      const isNA = display === 'N/A' || display === '—';
                      return (
                        <div
                          key={l.id}
                          className={`relative px-4 py-3.5 flex items-center transition-colors
                            ${isWinner ? 'bg-success/5' : 'bg-[#0d0d1a]'}
                          `}
                        >
                          {isWinner && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-3/4 rounded-r bg-success" />
                          )}
                          <span className={`text-sm font-semibold truncate ${
                            isNA
                              ? 'text-text-muted/40'
                              : isWinner
                              ? 'text-success'
                              : row.label === 'Total Price' || row.label === 'Price / Perch'
                              ? 'text-accent-light'
                              : row.label === 'Price Drop'
                              ? raw && raw > 0 ? 'text-warning' : 'text-text-muted/40'
                              : row.label === 'Deal Score'
                              ? raw !== null && raw > 0 ? 'text-success' : raw !== null && raw < 0 ? 'text-danger' : 'text-text-muted'
                              : 'text-text-primary'
                          }`}>
                            {display}
                          </span>
                          {isWinner && !isNA && (
                            <span className="ml-auto text-[9px] font-bold text-success uppercase tracking-wider opacity-70 pl-2">
                              Best
                            </span>
                          )}
                        </div>
                      );
                    })}

                    {/* Empty slot cells */}
                    {Array.from({ length: 3 - listings.length }).map((_, i) => (
                      <div key={i} className="bg-[#0d0d1a] px-4 py-3.5" />
                    ))}
                  </div>
                );
              })}

              {/* Signal badges row if any listing has signals */}
              {listings.some(l => l.deal_score !== null || l.price_drop_pct !== null) && (
                <div className="grid grid-cols-[140px_repeat(3,1fr)] gap-px bg-border/20 border-t border-border/40">
                  <div className="bg-[#0d0d1a] px-4 py-3.5 flex flex-col justify-center border-r border-border/40">
                    <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Signals</p>
                    <p className="text-[9px] text-text-muted mt-0.5">market indicators</p>
                  </div>
                  {listings.map((l) => (
                    <div key={l.id} className="bg-[#0d0d1a] px-3 py-3 flex flex-wrap gap-1.5 items-center">
                      {l.deal_score !== null && l.deal_score >= 5 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-success/15 text-success border border-success/25">
                          <BarChart2 className="w-2 h-2" />
                          {l.deal_score.toFixed(0)}% below market
                        </span>
                      )}
                      {l.price_drop_pct !== null && l.price_drop_pct > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-warning/15 text-warning border border-warning/25">
                          <TrendingDown className="w-2 h-2" />
                          {l.price_drop_pct.toFixed(0)}% drop
                        </span>
                      )}
                      {l.days_on_market !== null && l.days_on_market > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium text-text-muted border border-border/60">
                          <Clock className="w-2 h-2" />
                          {l.days_on_market}d
                        </span>
                      )}
                      {!l.deal_score && !l.price_drop_pct && (
                        <span className="text-[10px] text-text-muted/30">—</span>
                      )}
                    </div>
                  ))}
                  {Array.from({ length: 3 - listings.length }).map((_, i) => (
                    <div key={i} className="bg-[#0d0d1a] px-4 py-3" />
                  ))}
                </div>
              )}

              {/* Location row with map pin */}
              <div className="grid grid-cols-[140px_repeat(3,1fr)] gap-px bg-border/20 border-t border-border/40">
                <div className="bg-[#0d0d1a] px-4 py-3.5 flex flex-col justify-center border-r border-border/40">
                  <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">District</p>
                </div>
                {listings.map((l) => (
                  <div key={l.id} className="bg-[#0d0d1a] px-4 py-3.5 flex items-center gap-1.5">
                    <MapPin className="w-3 h-3 text-text-muted flex-shrink-0" />
                    <span className="text-xs text-text-secondary truncate">{l.district || '—'}</span>
                  </div>
                ))}
                {Array.from({ length: 3 - listings.length }).map((_, i) => (
                  <div key={i} className="bg-[#0d0d1a] px-4 py-3.5" />
                ))}
              </div>

              {/* View buttons */}
              <div className="grid grid-cols-[140px_repeat(3,1fr)] gap-px bg-border/20 border-t border-border/40">
                <div className="bg-[#0d0d1a] px-4 py-4" />
                {listings.map((l, i) => {
                  const col = SLOT_COLORS[i];
                  return (
                    <div key={l.id} className="bg-[#0d0d1a] px-3 py-4">
                      <a
                        href={l.url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all
                          ${col.badge} hover:opacity-80`}
                      >
                        View <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  );
                })}
                {Array.from({ length: 3 - listings.length }).map((_, i) => (
                  <div key={i} className="bg-[#0d0d1a] px-4 py-4" />
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-border/60 flex items-center justify-between">
              <p className="text-[10px] text-text-muted">
                <span className="text-success font-bold">Best</span> highlights the most favourable value per metric
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
