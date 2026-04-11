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
  const dy = to.y - from.y;
  // if mostly vertical, use vertical control points instead
  const isVertical = Math.abs(dy) > Math.abs(dx);
  let cx1, cy1, cx2, cy2;
  if (isVertical) {
    cy1 = from.y + dy * curvature;
    cy2 = to.y  - dy * curvature;
    cx1 = from.x; cx2 = to.x;
  } else {
    cx1 = from.x + dx * curvature;
    cx2 = to.x  - dx * curvature;
    cy1 = from.y; cy2 = to.y;
  }
  const yOffset = Math.abs(from.y - to.y) < 0.1 ? 0.1 : 0;
  return `M ${from.x} ${from.y} C ${cx1} ${cy1} ${cx2} ${cy2} ${to.x} ${to.y + yOffset}`;
}

// ─── Single animated beam ──────────────────────────────────────────────────
function Beam({
  from, to, duration = 2.4, delay = 0, color = "rgba(129,140,248,0.9)"
}: {
  from: Pos | null; to: Pos | null;
  duration?: number; delay?: number; color?: string;
}) {
  const pathRef = useRef<SVGPathElement>(null);
  const [len, setLen] = useState(0);

  useEffect(() => {
    if (pathRef.current) setLen(pathRef.current.getTotalLength());
  }, [from, to]);

  if (!from || !to) return null;
  const d = cubicPath(from, to);
  const dashLen = Math.max(Math.min(len * 0.3, 100), 40);

  return (
    <g>
      <path d={d} stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" fill="none" />
      <path ref={pathRef} d={d} fill="none" stroke="none" strokeWidth="0" />
      {len > 0 && (
        <path
          d={d} fill="none" stroke={color}
          strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray={`${dashLen} ${len}`}
          strokeDashoffset={len}
          filter="url(#beam-glow)"
        >
          <animate
            attributeName="stroke-dashoffset"
            from={String(len)} to={String(-dashLen)}
            dur={`${duration}s`} begin={`${delay}s`}
            repeatCount="indefinite" calcMode="linear"
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
  tone?: 'success';
}

const Node = forwardRef<HTMLDivElement, NodeProps>(
  ({ className = '', children, label, sub, accent, tone }, ref) => (
    <div className="flex flex-col items-center gap-1.5 sm:gap-2">
      <div
        ref={ref}
        className={`z-10 flex items-center justify-center rounded-full border transition-all duration-300
          ${tone === 'success'
            ? 'w-10 h-10 sm:w-12 sm:h-12 bg-[#0f0f1a] border-emerald-400/50 shadow-[0_0_24px_rgba(16,185,129,0.35)]'
            : accent
              ? 'w-11 h-11 sm:w-14 sm:h-14 bg-[#0f0f1a] border-accent/60 shadow-[0_0_24px_rgba(99,102,241,0.35)]'
              : 'w-9 h-9 sm:w-11 sm:h-11 bg-bg-card border-border hover:border-border-hover'
          } ${className}`}
      >
        {children}
      </div>
      <div className="text-center">
        <p className={`text-[10px] sm:text-[11px] font-bold leading-tight ${
          tone === 'success' ? 'text-emerald-200' : (accent ? 'text-white' : 'text-text-secondary')
        }`}>
          {label}
        </p>
        {sub && (
          <p className={`text-[8px] sm:text-[9px] uppercase tracking-wider mt-0.5 ${
            tone === 'success' ? 'text-emerald-400/70' : 'text-text-muted'
          }`}>{sub}</p>
        )}
      </div>
    </div>
  )
);
Node.displayName = 'Node';

// ─── SVG Icons ─────────────────────────────────────────────────────────────
const GlobeIcon    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>;
const TerminalIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 17 10 11 4 5" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="19" x2="20" y2="19" strokeLinecap="round"/></svg>;
const FilterIcon   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const DatabaseIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v6c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/><path d="M3 11v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6"/></svg>;
const UserIcon     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.58-7 8-7s8 3 8 7" strokeLinecap="round"/></svg>;

// ─── Main export ───────────────────────────────────────────────────────────
export function DataFlowBeam() {
  const containerRef = useRef<HTMLDivElement>(null);
  const ikmanRef     = useRef<HTMLDivElement>(null);
  const lpwRef       = useRef<HTMLDivElement>(null);
  const houseLkRef   = useRef<HTMLDivElement>(null);
  const scraperRef   = useRef<HTMLDivElement>(null);
  const cleanerRef   = useRef<HTMLDivElement>(null);
  const dbRef        = useRef<HTMLDivElement>(null);
  const youRef       = useRef<HTMLDivElement>(null);

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
      <div className="relative px-5 sm:px-6 pt-5 pb-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted mb-1">Data Pipeline</p>
        <h4 className="text-base font-bold leading-tight">How your data gets here</h4>
      </div>

      {/* ── diagram container ───────────────────────────────────────────── */}
      {/*
        Mobile  (< sm): two rows — sources across top, pipeline across bottom
        Desktop (≥ sm): single row — sources column left, pipeline right
      */}
      <div
        ref={containerRef}
        className="relative flex flex-col sm:flex-row items-center sm:justify-between
                   px-4 sm:px-8 py-6 sm:py-8 gap-6 sm:gap-4"
      >
        {/* SVG beam layer — covers full container on any size */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width={svgSize.w} height={svgSize.h}
          style={{ overflow: 'visible' }}
        >
          <defs>
            <filter id="beam-glow" filterUnits="userSpaceOnUse" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          {/* Sources → Scraper */}
          <Beam from={p.ikman}   to={p.scraper} duration={2.0} delay={0}    color="rgba(129,140,248,0.9)" />
          <Beam from={p.lpw}     to={p.scraper} duration={2.0} delay={0.25} color="rgba(129,140,248,0.9)" />
          <Beam from={p.houseLk} to={p.scraper} duration={2.0} delay={0.5}  color="rgba(129,140,248,0.9)" />
          {/* Scraper → Cleaner */}
          <Beam from={p.scraper} to={p.cleaner} duration={2.0} delay={1.0}  color="rgba(167,139,250,0.9)" />
          {/* Cleaner → DB */}
          <Beam from={p.cleaner} to={p.db}      duration={2.0} delay={2.0}  color="rgba(244,114,182,0.9)" />
          {/* DB → You */}
          <Beam from={p.db}      to={p.you}     duration={2.0} delay={3.0}  color="rgba(52,211,153,0.9)"  />
        </svg>

        {/* ── Sources ────────────────────────────────────────────────────
            Mobile:  flex-row spread across full width
            Desktop: flex-col stacked on the left                        */}
        <div className="flex flex-row sm:flex-col justify-around sm:justify-start
                        gap-2 sm:gap-4 z-10 w-full sm:w-auto">
          <Node ref={ikmanRef}   label="ikman.lk" sub="source 1"><span className="text-text-muted"><GlobeIcon /></span></Node>
          <Node ref={lpwRef}     label="LPW"      sub="source 2"><span className="text-text-muted"><GlobeIcon /></span></Node>
          <Node ref={houseLkRef} label="house.lk" sub="source 3"><span className="text-text-muted"><GlobeIcon /></span></Node>
        </div>

        {/* ── Pipeline nodes ─────────────────────────────────────────────
            Mobile:  flex-row spread across full width  (wrapper visible)
            Desktop: sm:contents — wrapper disappears, children join the
                     parent flex-row as direct siblings                  */}
        <div className="flex sm:contents flex-row justify-around w-full sm:w-auto gap-2 sm:gap-0">
          <div className="z-10">
            <Node ref={scraperRef} label="Scraper"  sub="playwright" accent><span className="text-accent-light"><TerminalIcon /></span></Node>
          </div>
          <div className="z-10">
            <Node ref={cleanerRef} label="Cleaner"  sub="normalise"  accent><span className="text-accent-light"><FilterIcon /></span></Node>
          </div>
          <div className="z-10">
            <Node ref={dbRef}      label="Database" sub="postgresql" accent><span className="text-accent-light"><DatabaseIcon /></span></Node>
          </div>
          <div className="z-10">
            <Node ref={youRef}     label="You"      sub="live dashboard" tone="success"><span className="text-emerald-300"><UserIcon /></span></Node>
          </div>
        </div>
      </div>

      {/* footer badges */}
      <div className="relative flex flex-wrap gap-3 sm:gap-4 px-5 sm:px-6 pb-5 pt-1 border-t border-border/50">
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
          35,000+ listings
        </span>
      </div>
    </div>
  );
}
