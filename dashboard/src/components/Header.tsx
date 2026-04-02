import { MapPin, ExternalLink } from 'lucide-react';

export function Header() {
  return (
    <header className="border-b border-border bg-bg-secondary/50 backdrop-blur-xl sticky top-0 z-[1000]">
      {/* Beta banner */}
      <div className="bg-accent/10 border-b border-accent/20 py-1.5 px-4 text-center">
        <span className="text-xs text-accent-light font-medium tracking-wide">
          Sri Lanka Property Data Platform — Free & Open — Feedback Welcome
        </span>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center">
            <MapPin className="w-5 h-5 text-accent-light" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight leading-none">
              PropertyLK
            </h1>
            <p className="text-[10px] text-text-muted font-medium uppercase tracking-widest mt-0.5">
              By Ardeno Studio
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="hidden sm:flex items-center gap-1.5 text-xs text-success font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-dot" />
            Live Data
          </span>
          <span className="px-2.5 py-1 text-[10px] font-semibold text-accent-light bg-accent/15 border border-accent/25 rounded-full uppercase tracking-wider">
            Beta
          </span>
          <a
            href="https://github.com/ArdenoStudio/sri-lanka-property-price-intelligence-platform"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1 text-xs text-text-secondary hover:text-accent-light transition-colors"
          >
            GitHub <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </header>
  );
}
