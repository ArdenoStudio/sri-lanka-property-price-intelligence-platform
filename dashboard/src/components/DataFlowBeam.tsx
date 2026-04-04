import { useEffect, useRef } from 'react';

/* ─── Animated beam along a path ─────────────────────────────────────── */
interface BeamProps {
  d: string;
  duration: number;
  delay?: number;
}

function Beam({ d, duration, delay = 0 }: BeamProps) {
  const ref = useRef<SVGPathElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const len = el.getTotalLength();
    const dash = Math.min(len * 0.25, 60);
    el.style.strokeDasharray = `${dash} ${len - dash}`;
    el.style.strokeDashoffset = `${len}`;
    el.style.animation = `beam-travel ${duration}s ${delay}s linear infinite`;
  }, [duration, delay]);

  return (
    <g>
      {/* dim track */}
      <path d={d} stroke="#1e1e24" strokeWidth="1.5" fill="none" />
      {/* glowing traveller */}
      <path
        ref={ref}
        d={d}
        stroke="url(#beamGrad)"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        filter="url(#softGlow)"
      />
    </g>
  );
}

/* ─── Node circle ─────────────────────────────────────────────────────── */
interface NodeProps {
  cx: number; cy: number; r: number;
  label: string; sub?: string;
  emoji: string;
  accent?: boolean;
  large?: boolean;
}

function Node({ cx, cy, r, label, sub, emoji, accent, large }: NodeProps) {
  const fs = large ? 18 : 14;
  return (
    <g>
      {/* outer glow ring */}
      {accent && (
        <circle cx={cx} cy={cy} r={r + 8} fill="rgba(99,102,241,0.07)" />
      )}
      {/* border ring */}
      <circle
        cx={cx} cy={cy} r={r}
        fill={accent ? '#0f0f1a' : '#141417'}
        stroke={accent ? '#6366f1' : '#2a2a30'}
        strokeWidth={accent ? 1.5 : 1}
      />
      {/* emoji icon */}
      <text
        x={cx} y={cy + fs * 0.38}
        textAnchor="middle"
        fontSize={fs}
        style={{ userSelect: 'none' }}
      >{emoji}</text>
      {/* label below */}
      <text
        x={cx} y={cy + r + 16}
        textAnchor="middle"
        fill={accent ? '#a5b4fc' : '#e4e4e7'}
        fontSize="10"
        fontWeight="600"
        fontFamily="Geist, sans-serif"
        letterSpacing="-0.3"
      >{label}</text>
      {sub && (
        <text
          x={cx} y={cy + r + 28}
          textAnchor="middle"
          fill="#4a4a4f"
          fontSize="8.5"
          fontFamily="Geist, sans-serif"
        >{sub}</text>
      )}
    </g>
  );
}

/* ─── Main component ──────────────────────────────────────────────────── */
export function DataFlowBeam() {
  return (
    <div className="relative rounded-2xl overflow-hidden border border-border bg-bg-card">
      <style>{`
        @keyframes beam-travel {
          0%   { stroke-dashoffset: var(--len, 300); opacity: 0   }
          8%   { opacity: 1 }
          92%  { opacity: 1 }
          100% { stroke-dashoffset: 0; opacity: 0 }
        }
      `}</style>

      {/* subtle radial glow backdrop */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(99,102,241,0.06) 0%, transparent 70%)',
        }}
      />

      {/* header */}
      <div className="relative px-7 pt-6 pb-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted mb-1">
          Data Pipeline
        </p>
        <h4 className="text-base font-bold leading-tight">
          How your data gets here
        </h4>
      </div>

      {/* diagram */}
      <svg
        viewBox="0 0 660 190"
        width="100%"
        height="190"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block' }}
      >
        <defs>
          {/* beam gradient travelling left→right */}
          <linearGradient id="beamGrad" x1="0%" y1="0%" x2="100%" y2="0%"
            gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="#6366f1" stopOpacity="0" />
            <stop offset="35%"  stopColor="#818cf8" stopOpacity="0.6" />
            <stop offset="65%"  stopColor="#a5b4fc" stopOpacity="1" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </linearGradient>

          {/* soft glow filter for beam */}
          <filter id="softGlow" x="-30%" y="-300%" width="160%" height="700%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* node accent glow */}
          <filter id="nodeGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ── Beams ─────────────────────────────────────────── */}
        {/* ikman → Scraper */}
        <Beam d="M 106 78  C 185 78  220 103 252 103" duration={2.2} delay={0}   />
        {/* LPW → Scraper */}
        <Beam d="M 106 138 C 185 138 220 103 252 103" duration={2.2} delay={1.1} />
        {/* Scraper → Database */}
        <Beam d="M 320 103 C 355 103 370 103 400 103" duration={1.5} delay={0.5} />
        {/* Database → You */}
        <Beam d="M 464 103 C 495 103 512 103 544 103" duration={1.5} delay={1.2} />

        {/* ── Nodes ─────────────────────────────────────────── */}
        <Node cx={72}  cy={78}  r={26} emoji="🏠" label="ikman.lk"  sub="source 1" />
        <Node cx={72}  cy={138} r={26} emoji="🌐" label="LPW"        sub="source 2" />
        <Node cx={286} cy={103} r={34} emoji="⚡" label="Scraper"    sub="playwright" accent large />
        <Node cx={432} cy={103} r={30} emoji="🗄️" label="Database"   sub="supabase"   accent />
        <Node cx={580} cy={103} r={26} emoji="✦"  label="You"        sub="live data" />

        {/* connector dot at merge point */}
        <circle cx={252} cy={103} r={3} fill="#6366f1" opacity="0.6" />
        <circle cx={320} cy={103} r={3} fill="#6366f1" opacity="0.6" />
      </svg>

      {/* footer badges */}
      <div className="relative flex flex-wrap gap-4 px-7 pb-5 pt-1">
        <span className="flex items-center gap-1.5 text-[10px] text-text-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-success" />
          Updated daily · 2AM UTC
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-text-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          Cleaned &amp; geocoded
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-text-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-warning" />
          Outlier detection
        </span>
      </div>
    </div>
  );
}
