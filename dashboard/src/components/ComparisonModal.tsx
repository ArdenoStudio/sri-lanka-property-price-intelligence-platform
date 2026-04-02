import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, ExternalLink, Sparkles, Scale, Info, Layers } from 'lucide-react';
import type { Listing } from '../api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  listings: Listing[];
}

export function ComparisonModal({ isOpen, onClose, listings }: Props) {
  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const compareRows = [
    { label: 'Price', key: 'price_lkr', color: 'accent' },
    { label: 'Price per Perch', key: 'price_per_perch', color: 'success' },
    { label: 'Total Size', key: 'size_perches', color: 'warning' },
    { label: 'Property Type', key: 'property_type', color: 'info' },
    { label: 'Location', key: 'city', color: 'secondary' },
    { label: 'Source', key: 'source', color: 'muted' },
  ];

  const formatValue = (listing: any, key: string) => {
    const val = listing[key];
    if (val === null || val === undefined) return 'N/A';
    
    if (key === 'price_lkr') {
      if (val >= 1_000_000) return `Rs ${(val / 1_000_000).toFixed(1)}M`;
      if (val >= 1_000) return `Rs ${(val / 1_000).toFixed(0)}K`;
      return `Rs ${val}`;
    }
    
    if (key === 'price_per_perch') {
      if (val >= 1_000_000) return `Rs ${(val / 1_000_000).toFixed(1)}M / perch`;
      return `Rs ${val.toLocaleString()} / perch`;
    }
    
    if (key === 'size_perches') return `${val} perches`;
    
    return val.toString();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4 sm:px-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/85 backdrop-blur-md"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 30 }}
        className="relative w-full max-w-5xl bg-bg-card border border-border rounded-[32px] shadow-[0_32px_120px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="p-8 border-b border-border flex items-center justify-between bg-bg-card-hover/20">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center text-white shadow-xl shadow-accent/20">
              <Scale className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-text-primary uppercase tracking-tight leading-none">Comparison Analysis</h2>
              <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest flex items-center gap-2 mt-2">
                <Sparkles className="w-3.5 h-3.5 text-accent-light" />
                Side-by-side Market Intelligence
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-3 hover:bg-border/30 rounded-2xl transition-all cursor-pointer text-text-muted hover:text-text-primary border border-border group"
          >
            <X className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-x-auto p-8 scrollbar-hide">
          <div className="min-w-[850px]">
            <div className="grid grid-cols-[220px_repeat(3,1fr)] gap-8">
              {/* Labels Column */}
              <div className="pt-24 space-y-12">
                {compareRows.map((row) => (
                  <div key={row.label} className="h-14 flex items-center">
                    <span className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] border-l-3 border-accent pl-4">
                      {row.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Data Columns */}
              {listings.map((listing) => (
                <div key={listing.id} className="space-y-8">
                  {/* Card Header */}
                  <div className="h-20 flex flex-col justify-end">
                    <h3 className="text-base font-bold text-text-primary line-clamp-2 mb-3 leading-snug">
                      {listing.title}
                    </h3>
                    <div className={`p-2 px-4 rounded-xl bg-bg-card-hover border border-border flex items-center gap-2.5 group hover:border-accent transition-all duration-300`}>
                      <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">{listing.source}</span>
                      <a href={listing.url || '#'} target="_blank" className="text-accent-light hover:text-white transition-colors ml-auto">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>

                  {/* Feature Rows */}
                  <div className="space-y-12 pt-4">
                    {compareRows.map((row) => (
                      <div key={row.label} className="h-14 flex items-center">
                        <div className="w-full p-5 bg-bg-card-hover/40 border border-border/40 rounded-2xl group hover:border-accent/40 hover:bg-accent/5 transition-all duration-300">
                          <p className={`text-base font-black truncate ${row.key === 'price_lkr' || row.key === 'price_per_perch' ? 'text-accent-light' : 'text-text-primary'}`}>
                            {formatValue(listing, row.key)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Footer Action */}
                  <div className="pt-6">
                    <a 
                      href={listing.url || '#'} 
                      target="_blank" 
                      className="w-full flex items-center justify-center gap-3 py-4 bg-accent/5 border border-accent/20 text-accent-light rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-accent hover:text-white transition-all shadow-lg hover:shadow-accent/40"
                    >
                      View Original
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              ))}
              
              {/* Empty state columns */}
              {Array.from({ length: 3 - listings.length }).map((_, i) => (
                <div key={i} className="flex flex-col items-center justify-center border-2 border-dashed border-border/40 rounded-[32px] opacity-20 mt-20 min-h-[400px]">
                  <Layers className="w-14 h-14 text-text-muted mb-6" />
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-text-muted">Empty Slot</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className="p-8 border-t border-border bg-bg-card-hover/30 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3 text-text-muted text-[10px] font-black uppercase tracking-widest">
            <Info className="w-5 h-5 text-accent" />
            Comparison limited to 3 items for optimal visualization
          </div>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-10 py-4 bg-bg-card border border-border text-text-primary rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all cursor-pointer shadow-lg active:scale-95"
          >
            Close Comparison
          </button>
        </div>
      </motion.div>
    </div>
  );
}
