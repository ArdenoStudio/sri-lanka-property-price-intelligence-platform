import { motion } from 'framer-motion';
import { X, ExternalLink, Sparkles, Scale, Info, Layers } from 'lucide-react';
import type { Listing } from '../api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  listings: Listing[];
}

export function ComparisonModal({ isOpen, onClose, listings }: Props) {
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 sm:px-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-5xl bg-bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between bg-bg-card-hover/30">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center text-white shadow-lg shadow-accent/20">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-text-primary uppercase tracking-tight">Comparison Analysis</h2>
              <p className="text-xs text-text-muted font-bold uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
                <Sparkles className="w-3.5 h-3.5 text-accent-light" />
                Side-by-side Market Intelligence
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-border/20 rounded-xl transition-colors cursor-pointer text-text-muted hover:text-text-primary border-none"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-x-auto p-6 scrollbar-hide">
          <div className="min-w-[800px]">
            <div className="grid grid-cols-[200px_repeat(3,1fr)] gap-6">
              {/* Labels Column */}
              <div className="pt-24 space-y-12">
                {compareRows.map((row) => (
                  <div key={row.label} className="h-12 flex items-center">
                    <span className="text-xs font-bold text-text-muted uppercase tracking-widest border-l-2 border-accent pl-3">
                      {row.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Data Columns */}
              {listings.map((listing) => (
                <div key={listing.id} className="space-y-6">
                  {/* Card Header */}
                  <div className="h-20 flex flex-col justify-end">
                    <h3 className="text-sm font-bold text-text-primary line-clamp-2 mb-2 leading-tight">
                      {listing.title}
                    </h3>
                    <div className={`p-1.5 px-3 rounded-lg bg-bg-card-hover border border-border flex items-center gap-2 group hover:border-accent transition-colors`}>
                      <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{listing.source}</span>
                      <a href={listing.url || '#'} target="_blank" className="text-accent-light hover:text-white transition-colors">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  {/* Feature Rows */}
                  <div className="space-y-12 pt-4">
                    {compareRows.map((row) => (
                      <div key={row.label} className="h-12 flex items-center">
                        <div className="w-full p-4 bg-bg-card-hover/50 border border-border/50 rounded-2xl group hover:border-accent/40 transition-all duration-300">
                          <p className={`text-sm font-bold truncate ${row.key === 'price_lkr' || row.key === 'price_per_perch' ? 'text-accent-light' : 'text-text-primary'}`}>
                            {formatValue(listing, row.key)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Footer Action */}
                  <div className="pt-4">
                    <a 
                      href={listing.url || '#'} 
                      target="_blank" 
                      className="w-full flex items-center justify-center gap-2 py-3 bg-accent/10 border border-accent/20 text-accent-light rounded-2xl text-xs font-bold hover:bg-accent text-white transition-all shadow-lg hover:shadow-accent/20"
                    >
                      View Original Listing
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              ))}
              
              {/* Empty state columns */}
              {Array.from({ length: 3 - listings.length }).map((_, i) => (
                <div key={i} className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-3xl opacity-20 mt-20">
                  <Layers className="w-12 h-12 text-text-muted mb-4" />
                  <p className="text-xs font-bold uppercase tracking-widest text-text-muted">Empty slot</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className="p-6 border-t border-border bg-bg-card-hover/20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-text-muted text-[10px] font-bold uppercase tracking-widest">
            <Info className="w-4 h-4 text-accent" />
            Comparison limited to 3 items for optimal visualization
          </div>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-8 py-3 bg-bg-card border border-border text-text-primary rounded-2xl text-xs font-bold hover:bg-bg-card-hover transition-all cursor-pointer"
          >
            Close Comparison
          </button>
        </div>
      </motion.div>
    </div>
  );
}
