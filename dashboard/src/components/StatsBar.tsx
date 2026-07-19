import type { Stats } from '../api';
import { formatCurrencyAmount } from '../lib/pricing';

function formatPrice(price: number | null): string {
  return formatCurrencyAmount(price, 'LKR', { variant: 'hero' });
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
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

interface Props {
  stats: Stats | null;
}

/** Post-hero trust strip — type only, no cards, no second headline. */
export function StatsBar({ stats }: Props) {
  const avg = stats?.avg_price_lkr ?? null;
  const total = stats?.total_listings ?? null;
  const districts = stats?.districts_covered ?? null;
  const updated = formatDate(stats?.last_updated ?? null);

  return (
    <section aria-label="Market coverage" className="border-b border-white/[0.08] pb-8">
      <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        <div>
          <dt className="text-[11px] uppercase tracking-[0.18em] text-[#737373]">Avg asking</dt>
          <dd className="mt-1 font-display text-[1.35rem] tabular-nums text-white">
            {avg != null ? formatPrice(avg) : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.18em] text-[#737373]">Listings</dt>
          <dd className="mt-1 font-display text-[1.35rem] tabular-nums text-white">
            {total != null ? total.toLocaleString() : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.18em] text-[#737373]">Districts</dt>
          <dd className="mt-1 font-display text-[1.35rem] tabular-nums text-white">
            {districts != null ? districts : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.18em] text-[#737373]">Updated</dt>
          <dd className="mt-1 font-display text-[1.35rem] text-white">{updated}</dd>
        </div>
      </dl>
    </section>
  );
}
