import { useEffect, useRef, useState, forwardRef } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────
interface Pos { x: number; y: number }

// ─── Helpers ───────────────────────────────────────────────────────────────
function getCenter(el: HTMLElement, container: HTMLElement): Pos {
  const e = el.getBoundingClientRect();
  const c = container.getBoundingClientRect();
  return { x: e.left - c.left + e.width / 2, y: e.top - c.top + e.height / 2 };
}

function cubicPath(from: Pos, to: Pos, curvature = 0.5): string {
  const dx = to.x - from.x;
  const cx1 = from.x + dx * curvature;
  const cx2 = to.x  - dx * curvature;
  return `M ${from.x} ${from.y} C ${cx1} ${from.y} ${cx2} ${to.y} ${to.x} ${to.y}`;
}

// ─── Single animated beam ──────────────────────────────────────────────────
function Beam({
  from, to, id, duration = 2.4, delay = 0, reverse = false,
}: {
  from: Pos | null; to: Pos | null;
  id: string; duration?: number; delay?: number; reverse?: boolean;
}) {
  const pathRef = useRef<SVGPathElement>(null);
  const [len, setLen] = useState(0);

  useEffect(() => {
    if (pathRef.current) setLen(pathRef.current.getTotalLength());
  }, [from, to]);

  if (!from || !to) return null;
  const d = cubicPath(from, to);
  // 30% of path length, min 40px — visible without being too bulky
  const dashLen = Math.max(Math.min(len * 0.3, 100), 40);

  return (
    <g>
      {/* static track */}
      <path d={d} stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" fill="none" />
      {/* measure path */}
      <path ref={pathRef} d={d} fill="none" stroke="none" strokeWidth="0" />
      {/* animated beam — solid colour + glow so it's visible on any angle/length */}
      {len > 0 && (
        <path
          d={d}
          fill="none"
          stroke="rgba(129,140,248,0.9)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={`${dashLen} ${len}`}
          strokeDashoffset={reverse ? -len : len}
          filter="url(#beam-glow)"
        >
          <animate
            attributeName="stroke-dashoffset"
            from={reverse ? String(-len) : String(len)}
            to={reverse ? String(dashLen - len) : String(-dashLen)}
            dur={`${duration}s`}
            begin={`${delay}s`}
            repeatCount="indefinite"
            calcMode="linear"
          />
        </path>
      )}
    </g>
  );
}

// ─── Node circle ───────────────────────────────────────────────────────────
interface NodeProps {
  className?: string;
  children?: React.ReactNode;
  label: string;
  sub?: string;
  accent?: boolean;
}

const Node = forwardRef<HTMLDivElement, NodeProps>(
  ({ className = '', children, label, sub, accent }, ref) => (
    <div className="flex flex-col items-center gap-2">
      <div
        ref={ref}
        className={`z-10 flex items-center justify-center rounded-full border transition-all duration-300
          ${accent
            ? 'w-14 h-14 bg-[#0f0f1a] border-accent/60 shadow-[0_0_24px_rgba(99,102,241,0.35)]'
            : 'w-11 h-11 bg-bg-card border-border hover:border-border-hover'
          } ${className}`}
      >
        {children}
      </div>
      <div className="text-center">
        <p className={`text-[11px] font-bold leading-tight ${accent ? 'text-white' : 'text-text-secondary'}`}>
          {label}
        </p>
        {sub && (
          <p className="text-[9px] text-text-muted uppercase tracking-wider mt-0.5">{sub}</p>
        )}
      </div>
    </div>
  )
);
Node.displayName = 'Node';

// ─── SVG Icons ─────────────────────────────────────────────────────────────
const GlobeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="12" r="10"/>
    <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
);
const TerminalIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="4 17 10 11 4 5" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="12" y1="19" x2="20" y2="19" strokeLinecap="round"/>
  </svg>
);
const FilterIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const DatabaseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <ellipse cx="12" cy="5" rx="9" ry="3"/>
    <path d="M3 5v6c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>
    <path d="M3 11v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6"/>
  </svg>
);
const UserIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="8" r="4"/>
    <path d="M4 20c0-4 3.58-7 8-7s8 3 8 7" strokeLinecap="round"/>
  </svg>
);

// ─── Main export ───────────────────────────────────────────────────────────
export function DataFlowBeam() {
  const containerRef = useRef<HTMLDivElement>(null);
  const ikmanRef    = useRef<HTMLDivElement>(null);
  const lpwRef      = useRef<HTMLDivElement>(null);
  const houseLkRef  = useRef<HTMLDivElement>(null);
  const scraperRef  = useRef<HTMLDivElement>(null);
  const cleanerRef  = useRef<HTMLDivElement>(null);
  const dbRef       = useRef<HTMLDivElement>(null);
  const youRef      = useRef<HTMLDivElement>(null);

  const [positions, setPositions] = useState<Record<string, Pos | null>>({
    ikman: null, lpw: null, houseLk: null, scraper: null, cleaner: null, db: null, you: null,
  });
  const [svgSize, setSvgSize] = useState({ w: 0, h: 0 });

  const recalc = () => {
    const c = containerRef.current;
    if (!c) return;
    setSvgSize({ w: c.offsetWidth, h: c.offsetHeight });
    const get = (ref: React.RefObject<HTMLDivElement | null>) =>
      ref.current ? getCenter(ref.current, c) : null;
    setPositions({
      ikman:   get(ikmanRef),
      lpw:     get(lpwRef),
      houseLk: get(houseLkRef),
      scraper: get(scraperRef),
      cleaner: get(cleanerRef),
      db:      get(dbRef),
      you:     get(youRef),
    });
  };

  useEffect(() => {
    recalc();
    const ro = new ResizeObserver(recalc);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const p = positions;

  return (
    <div className="relative rounded-2xl overflow-hidden border border-border bg-bg-card">
      {/* ambient glow */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 70% at 50% 50%, rgba(99,102,241,0.08) 0%, transparent 70%)' }} />

      {/* header */}
      <div className="relative px-6 pt-5 pb-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted mb-1">Data Pipeline</p>
        <h4 className="text-base font-bold leading-tight">How your data gets here</h4>
      </div>

      {/* diagram container */}
      <div
        ref={containerRef}
        className="relative flex items-center justify-between px-8 py-8 gap-4"
        style={{ minHeight: 190 }}
      >
        {/* SVG beam layer */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width={svgSize.w} height={svgSize.h}
          style={{ overflow: 'visible' }}
        >
          <defs>
            <filter id="beam-glow" x="-50%" y="-200%" width="200%" height="500%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          {/*
            Relay wave: each segment fires as the previous one arrives.
            Sources take ~2s to reach scraper (travel time ≈ dur * 0.5).
            Each downstream segment starts ~1.0s after the previous fires.
            All durations kept equal so waves stay in phase across cycles.
          */}

          {/* Sources → Scraper (staggered so 3 beams are always in flight) */}
          <Beam id="ikman-scraper"   from={p.ikman}   to={p.scraper} duration={2.0} delay={0}   />
          <Beam id="lpw-scraper"     from={p.lpw}     to={p.scraper} duration={2.0} delay={0}   />
          <Beam id="houseLk-scraper" from={p.houseLk} to={p.scraper} duration={2.0} delay={0.5} />

          {/* Scraper → Cleaner: fires as source beams arrive (~1s into their 2s journey) */}
          <Beam id="scraper-cleaner" from={p.scraper} to={p.cleaner} duration={2.0} delay={1.0} />

          {/* Cleaner → DB: fires as scraper→cleaner arrives */}
          <Beam id="cleaner-db"      from={p.cleaner} to={p.db}      duration={2.0} delay={2.0} />

          {/* DB → You: fires as cleaner→db arrives */}
          <Beam id="db-you"          from={p.db}      to={p.you}     duration={2.0} delay={3.0} />
        </svg>

        {/* Left: sources stacked */}
        <div className="flex flex-col gap-4 z-10">
          <Node ref={ikmanRef} label="ikman.lk" sub="source 1">
            <span className="text-text-muted"><GlobeIcon /></span>
          </Node>
          <Node ref={lpwRef} label="LPW" sub="source 2">
            <span className="text-text-muted"><GlobeIcon /></span>
          </Node>
          <Node ref={houseLkRef} label="house.lk" sub="source 3">
            <span className="text-text-muted"><GlobeIcon /></span>
          </Node>
        </div>

        {/* Scraper — large center-left */}
        <div className="z-10">
          <Node ref={scraperRef} label="Scraper" sub="playwright" accent>
            <span className="text-accent-light"><TerminalIcon /></span>
          </Node>
        </div>

        {/* Cleaner */}
        <div className="z-10">
          <Node ref={cleanerRef} label="Cleaner" sub="normalise" accent>
            <span className="text-accent-light"><FilterIcon /></span>
          </Node>
        </div>

        {/* Database */}
        <div className="z-10">
          <Node ref={dbRef} label="Database" sub="postgresql" accent>
            <span className="text-accent-light"><DatabaseIcon /></span>
          </Node>
        </div>

        {/* You */}
        <div className="z-10">
          <Node ref={youRef} label="You" sub="live dashboard">
            <span className="text-text-muted"><UserIcon /></span>
          </Node>
        </div>
      </div>

      {/* footer badges */}
      <div className="relative flex flex-wrap gap-4 px-6 pb-5 pt-1 border-t border-border/50">
        <span className="flex items-center gap-1.5 text-[10px] text-text-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
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
          27,000+ listings
        </span>
      </div>
    </div>
  );
}
