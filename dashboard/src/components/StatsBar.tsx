import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
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
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="mb-16"
      >
        <p className="text-[11px] uppercase tracking-[0.22em] text-[#525252] mb-5">
          Sri Lanka · Property Intelligence
        </p>
        <h1 className="text-[clamp(3rem,8vw,7rem)] font-bold tracking-[-0.04em] leading-[0.92] text-white">
          Market<br />
          <span className="text-[#525252]">Intelligence</span>
        </h1>
        <p className="mt-7 text-[#a3a3a3] text-[15px] max-w-md leading-relaxed">
          Real-time property data across Sri Lanka.
          Updated daily from 5,000+ listings.
        </p>
      </motion.div>

      {/* ---- Bento stats grid ---- */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
      >
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 rounded-3xl overflow-hidden"
          style={{
            gap: '1px',
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          {/* ---- Hero card: Avg Price (span 2 on lg) ---- */}
          <div className="bg-[#111111] p-8 lg:col-span-2 flex flex-col justify-between min-h-[180px]">
            <div className="w-16 h-px bg-[#14b8a6] mb-8" />
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-[#525252] mb-3">
                Average Price
              </p>
              <p className="text-[clamp(2.5rem,5vw,4rem)] font-bold text-white tracking-[-0.04em] leading-none num">
                {formatPrice(avgRaw || null)}
              </p>
              {changePct !== null && (
                <span
                  className={`mt-4 inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full num ${
                    changePct >= 0
                      ? 'bg-emerald-950 text-emerald-400'
                      : 'bg-red-950 text-red-400'
                  }`}
                >
                  {changePct >= 0 ? '+' : ''}{changePct}% vs last month
                </span>
              )}
            </div>
          </div>

          {/* ---- Total Listings ---- */}
          <div className="bg-[#111111] p-8 flex flex-col justify-between min-h-[140px]">
            <div className="w-8 h-px bg-white/[0.15] mb-8" />
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-[#525252] mb-3">
                Listings
              </p>
              <p className="text-[clamp(1.5rem,3vw,2.25rem)] font-bold text-white tracking-[-0.03em] leading-none num">
                {totalRaw.toLocaleString()}
              </p>
              <p className="text-[11px] text-[#525252] mt-3">
                +{weeklyNew.toLocaleString()} this week
              </p>
            </div>
          </div>

          {/* ---- Districts ---- */}
          <div className="bg-[#111111] p-8 flex flex-col justify-between min-h-[140px]">
            <div className="w-8 h-px bg-white/[0.15] mb-8" />
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-[#525252] mb-3">
                Districts
              </p>
              <p className="text-[clamp(1.5rem,3vw,2.25rem)] font-bold text-white tracking-[-0.03em] leading-none num">
                {districtsRaw}
              </p>
              <p className="text-[11px] text-[#525252] mt-3">
                Across Sri Lanka
              </p>
            </div>
          </div>
        </div>

        {/* Subline */}
        <p className="text-[#2e2e2e] text-[11px] mt-4 leading-relaxed">
          {stats?.total_listings?.toLocaleString() ?? '...'} listings across {typeBreakdown}
          {stats?.last_updated && ` · Updated ${formatDate(stats.last_updated)}`}
        </p>
      </motion.div>
    </section>
  );
}
