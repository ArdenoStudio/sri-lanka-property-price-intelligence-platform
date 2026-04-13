import { useEffect, useRef, useState } from 'react';
import type { Stats } from '../api';

// ---- Formatters ----
function formatPrice(price: number | null): string {
  if (!price) return '—';
  if (price >= 1_000_000) return `Rs ${(price / 1_000_000).toFixed(1)}M`;
  if (price >= 1_000) return `Rs ${(price / 1_000).toFixed(0)}K`;
  return `Rs ${price.toFixed(0)}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHrs = Math.floor(diffMs / 3_600_000);
  if (diffHrs < 1) return 'Just now';
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-LK', { month: 'short', day: 'numeric' });
}

// ---- Counter animation ----
function useCountUp(target: number, duration = 1200): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef(0);
  const prevTarget = useRef(0);

  useEffect(() => {
    if (!target || target === prevTarget.current) return;
    prevTarget.current = target;
    const start = Date.now();
    const from = value;

    const tick = () => {
      const t = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
}

interface Props {
  stats: Stats | null;
}

export function StatsBar({ stats }: Props) {
  const avgRaw = useCountUp(stats?.avg_price_lkr ?? 0, 1400);
  const totalRaw = useCountUp(stats?.total_listings ?? 0, 1200);
  const districtsRaw = useCountUp(stats?.districts_covered ?? 0, 1000);

  const changePct = stats?.price_change_pct ?? null;
  const weeklyNew = stats?.listings_last_7_days ?? 0;

  // Subline: listing type breakdown
  const typeBreakdown = stats?.listings_by_type
    ? Object.entries(stats.listings_by_type)
        .sort(([, a], [, b]) => b - a)
        .map(([t]) => t.charAt(0).toUpperCase() + t.slice(1))
        .join(' · ')
    : 'Land · House · Apartment · Commercial';

  return (
    <section className="pt-4 pb-10">
      {/* ---- Hero editorial headline ---- */}
      {/* Replaced motion.div with CSS transition for simple mount animation */}
      <div
        className="mb-16 text-center flex flex-col items-center css-fade-in"
      >
        <p className="text-[11px] uppercase tracking-[0.22em] text-[#737373] mb-5">
          Sri Lanka · Property Intelligence
        </p>
        <h1 className="text-[clamp(3rem,8vw,7rem)] font-bold tracking-[-0.04em] leading-[0.92] text-white">
          Market<br />
          <span className="text-[#737373]">Intelligence</span>
        </h1>
        <p className="mt-7 text-[#a3a3a3] text-[15px] leading-relaxed text-center sm:whitespace-nowrap">
          Real-time property data across Sri Lanka. Updated daily from 5,000+ listings.
        </p>
      </div>

      {/* ---- Bento stats grid ---- */}
      {/* Replaced motion.div with CSS transition */}
      <div className="css-fade-in css-fade-in-delay">
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 rounded-3xl overflow-hidden"
          style={{
            gap: '1px',
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          {/* ---- Hero card: Avg Price (span 2 on lg) ---- */}
          <div className="relative bg-[#111111] p-8 lg:col-span-2 flex flex-col justify-between min-h-[180px] transition-colors duration-200 hover:bg-[#161616] overflow-hidden">
            {/* Teal top accent stripe */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#14b8a6] to-[#0d9488]" />
            {/* Subtle radial teal glow — hero card only */}
            <div
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
              style={{ background: 'radial-gradient(ellipse 60% 50% at 20% 0%, rgba(20,184,166,0.07) 0%, transparent 70%)' }}
            />
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-[#737373] mb-3">
                Average Price
              </p>
              <p className="text-[clamp(2.5rem,5vw,4rem)] font-bold text-white tracking-[-0.04em] leading-none num">
                {formatPrice(avgRaw || null)}
              </p>
              {changePct !== null && (
                <span
                  className={`mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full num ${
                    changePct >= 0
                      ? 'bg-emerald-950 text-emerald-400'
                      : 'bg-red-950 text-red-400'
                  }`}
                >
                  <span className="text-[14px] leading-none" aria-hidden="true">
                    {changePct >= 0 ? '▲' : '▼'}
                  </span>
                  {changePct >= 0 ? '+' : ''}{changePct}% vs last month
                </span>
              )}
            </div>
          </div>

          {/* ---- Total Listings ---- */}
          <div className="relative bg-[#111111] p-8 flex flex-col justify-between min-h-[140px] transition-colors duration-200 hover:bg-[#161616] overflow-hidden">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-[#737373] mb-3">
                Listings
              </p>
              <p className="text-[clamp(1.5rem,3vw,2.25rem)] font-bold text-white tracking-[-0.03em] leading-none num">
                {totalRaw.toLocaleString()}
              </p>
              <p className="text-[11px] text-[#737373] mt-3">
                +{weeklyNew.toLocaleString()} this week
              </p>
            </div>
          </div>

          {/* ---- Districts ---- */}
          <div className="relative bg-[#111111] p-8 flex flex-col justify-between min-h-[140px] transition-colors duration-200 hover:bg-[#161616] overflow-hidden">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-[#737373] mb-3">
                Districts
              </p>
              <p className="text-[clamp(1.5rem,3vw,2.25rem)] font-bold text-white tracking-[-0.03em] leading-none num">
                {districtsRaw}
              </p>
              <p className="text-[11px] text-[#737373] mt-3">
                Across Sri Lanka
              </p>
            </div>
          </div>
        </div>

        {/* Subline */}
        <p className="text-[#737373] text-[11px] mt-4 leading-relaxed flex items-center gap-2 flex-wrap">
          {stats?.total_listings?.toLocaleString() ?? '...'} listings across {typeBreakdown}
          {stats?.last_updated && (
            <>
              <span className="text-[#737373]"> · Updated {formatDate(stats.last_updated)}</span>
              <span className="inline-flex items-center gap-1.5 shrink-0">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-live-dot shrink-0"
                  aria-label="Live data"
                />
              </span>
            </>
          )}
        </p>
      </div>
    </section>
  );
}
