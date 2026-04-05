import { useEffect, useRef } from 'react';

/* ─── Animated SVG connector line ────────────────────────────────────── */
function AnimatedLine({ delay = 0 }: { delay?: number }) {
  const ref = useRef<SVGLineElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.strokeDasharray = '4 4';
    el.style.strokeDashoffset = '24';
    el.style.animation = `dfb-dash ${1.6}s ${delay}s linear infinite`;
  }, [delay]);

  return (
    <svg width="40" height="2" viewBox="0 0 40 2" fill="none"
      className="flex-shrink-0 self-center mx-1"
      style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={`lg-${delay}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#6366f1" stopOpacity="0.2" />
          <stop offset="50%"  stopColor="#818cf8" stopOpacity="1" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      {/* static track */}
      <line x1="0" y1="1" x2="40" y2="1" stroke="#27272a" strokeWidth="1.5" />
      {/* travelling pulse */}
      <line ref={ref} x1="0" y1="1" x2="40" y2="1"
        stroke={`url(#lg-${delay})`} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/* ─── Node card ───────────────────────────────────────────────────────── */
interface NodeCardProps {
  icon: React.ReactNode;
  label: string;
  sub: string;
  accent?: boolean;
  animDelay?: number;
}

function NodeCard({ icon, label, sub, accent, animDelay = 0 }: NodeCardProps) {
  return (
    <div
      className="flex flex-col items-center gap-2"
      style={{ animation: `dfb-fadein 0.5s ${animDelay}s both` }}
    >
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
        accent
          ? 'bg-accent/15 border-2 border-accent/50 shadow-lg shadow-accent/20'
          : 'bg-bg-card-hover border border-border'
      }`}>
        <div className={accent ? 'text-accent-light' : 'text-text-muted'}>
          {icon}
        </div>
      </div>
      <div className="text-center">
        <p className={`text-[11px] font-bold leading-tight ${accent ? 'text-white' : 'text-text-primary'}`}>
          {label}
        </p>
        <p className="text-[9px] text-text-muted mt-0.5 uppercase tracking-wider font-medium">
          {sub}
        </p>
      </div>
    </div>
  );
}

/* ─── Source stacked pair ─────────────────────────────────────────────── */
function SourcePair() {
  return (
    <div className="flex flex-col gap-3" style={{ animation: 'dfb-fadein 0.5s 0s both' }}>
      {[
        { label: 'ikman.lk', sub: 'source 1' },
        { label: 'LPW',      sub: 'source 2' },
      ].map(({ label, sub }) => (
        <div key={label} className="flex flex-col items-center gap-1.5">
          <div className="w-10 h-10 rounded-xl bg-bg-card-hover border border-border flex items-center justify-center text-text-muted">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8"/>
              <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke="currentColor" strokeWidth="1.8"/>
            </svg>
          </div>
          <p className="text-[10px] font-bold text-text-secondary">{label}</p>
          <p className="text-[9px] text-text-muted uppercase tracking-wide">{sub}</p>
        </div>
      ))}
    </div>
  );
}

/* ─── Fork connector (two lines merging into one) ─────────────────────── */
function ForkConnector() {
  const r1 = useRef<SVGPathElement>(null);
  const r2 = useRef<SVGPathElement>(null);

  useEffect(() => {
    [r1, r2].forEach((ref, i) => {
      const el = ref.current;
      if (!el) return;
      const len = el.getTotalLength();
      el.style.strokeDasharray = `${len * 0.3} ${len}`;
      el.style.strokeDashoffset = `${len}`;
      el.style.animation = `dfb-beam 2s ${i * 0.9}s linear infinite`;
    });
  }, []);

  return (
    <svg width="48" height="80" viewBox="0 0 48 80" fill="none"
      className="flex-shrink-0 self-center" style={{ overflow: 'visible' }}>
      {/* static tracks */}
      <path d="M0 20 C24 20 24 40 48 40" stroke="#27272a" strokeWidth="1.5" fill="none" />
      <path d="M0 60 C24 60 24 40 48 40" stroke="#27272a" strokeWidth="1.5" fill="none" />
      {/* animated beams */}
      <path ref={r1} d="M0 20 C24 20 24 40 48 40" stroke="#818cf8" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path ref={r2} d="M0 60 C24 60 24 40 48 40" stroke="#818cf8" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <circle cx="48" cy="40" r="2.5" fill="#6366f1" opacity="0.7" />
    </svg>
  );
}

/* ─── Main export ─────────────────────────────────────────────────────── */
export function DataFlowBeam() {
  return (
    <div className="relative rounded-2xl overflow-hidden border border-border bg-bg-card">
      <style>{`
        @keyframes dfb-dash {
          to { stroke-dashoffset: 0; }
        }
        @keyframes dfb-beam {
          0%   { stroke-dashoffset: 300; opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { stroke-dashoffset: 0;   opacity: 0; }
        }
        @keyframes dfb-fadein {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes dfb-pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50%      { opacity: 1;   transform: scale(1.15); }
        }
      `}</style>

      {/* ambient glow */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 55% 60% at 50% 50%, rgba(99,102,241,0.07) 0%, transparent 70%)' }} />

      {/* header */}
      <div className="relative px-6 pt-5 pb-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted mb-1">Data Pipeline</p>
        <h4 className="text-base font-bold leading-tight">How your data gets here</h4>
      </div>

      {/* flow diagram */}
      <div className="relative flex items-center justify-center gap-0 px-6 pb-6 overflow-x-auto">
        <div className="flex items-center gap-0 min-w-max">

          {/* Sources */}
          <SourcePair />

          {/* Fork merge */}
          <ForkConnector />

          {/* Scraper */}
          <NodeCard
            accent
            animDelay={0.1}
            label="Scraper"
            sub="playwright"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <polyline points="4 17 10 11 4 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="12" y1="19" x2="20" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            }
          />

          <AnimatedLine delay={0.3} />

          {/* Cleaner */}
          <NodeCard
            accent
            animDelay={0.2}
            label="Cleaner"
            sub="normalise · geocode"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            }
          />

          <AnimatedLine delay={0.6} />

          {/* Database */}
          <NodeCard
            accent
            animDelay={0.3}
            label="Database"
            sub="postgresql"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <ellipse cx="12" cy="5" rx="9" ry="3" stroke="currentColor" strokeWidth="2"/>
                <path d="M3 5v6c0 1.66 4.03 3 9 3s9-1.34 9-3V5" stroke="currentColor" strokeWidth="2"/>
                <path d="M3 11v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6" stroke="currentColor" strokeWidth="2"/>
              </svg>
            }
          />

          <AnimatedLine delay={0.9} />

          {/* You */}
          <NodeCard
            animDelay={0.4}
            label="You"
            sub="live dashboard"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2"/>
                <path d="M4 20c0-4 3.58-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            }
          />
        </div>
      </div>

      {/* footer badges */}
      <div className="relative flex flex-wrap gap-4 px-6 pb-5 pt-1 border-t border-border/50">
        <span className="flex items-center gap-1.5 text-[10px] text-text-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-success" style={{ animation: 'dfb-pulse 2s ease-in-out infinite' }} />
          Updated daily · 2AM UTC
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-text-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-light" />
          Cleaned &amp; geocoded
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-text-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-warning" />
          Outlier detection
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-text-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-success/60" />
          5,000+ listings
        </span>
      </div>
    </div>
  );
}
