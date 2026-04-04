import { useState } from 'react';
import { MapPin, Star } from 'lucide-react';

export function Header() {
  const [tooltipVisible, setTooltipVisible] = useState(false);

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
          <div
            className="hidden sm:block relative"
            onMouseEnter={() => setTooltipVisible(true)}
            onMouseLeave={() => setTooltipVisible(false)}
          >
            <a
              href="https://github.com/ArdenoStudio/sri-lanka-property-price-intelligence-platform"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center text-text-secondary hover:text-accent-light transition-colors"
              aria-label="View on GitHub"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
            </a>

            {/* Tooltip */}
            <div className={`absolute right-0 top-full mt-3 w-56 transition-all duration-200 pointer-events-none ${
              tooltipVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'
            }`}>
              {/* Arrow */}
              <div className="absolute -top-1.5 right-1.5 w-3 h-3 bg-bg-card border-l border-t border-border rotate-45" />
              <div className="bg-bg-card border border-border rounded-xl p-3.5 shadow-2xl">
                <p className="text-xs font-bold text-text-primary mb-1">Open Source</p>
                <p className="text-[11px] text-text-secondary leading-relaxed mb-3">
                  This project is fully open source. Star it on GitHub if you find it useful!
                </p>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-accent-light">
                  <Star className="w-3 h-3 fill-accent-light" />
                  Star the repo
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
