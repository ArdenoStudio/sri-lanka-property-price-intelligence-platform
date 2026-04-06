import React from 'react';
import { Building2, MapPin, TrendingUp, TrendingDown, Clock, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Stats } from '../api';

function formatPrice(price: number | null): string {
  if (!price) return 'N/A';
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

interface Props {
  stats: Stats | null;
}

export function StatsBar({ stats }: Props) {
  const cards: { icon: React.ElementType; label: string; value: string; sub: string; accent: boolean; changePct?: number | null }[] = [
    {
      icon: Building2,
      label: 'Total Listings',
      value: stats?.total_listings?.toLocaleString() ?? '—',
      sub: `${stats?.listings_last_7_days ?? 0} this week`,
      accent: false,
    },
    {
      icon: TrendingUp,
      label: 'Avg. Price',
      value: formatPrice(stats?.avg_price_lkr ?? null),
      sub: stats?.data_source === 'raw' ? 'Processing...' : 'Across all types',
      accent: true,
      changePct: stats?.price_change_pct ?? null,
    },
    {
      icon: MapPin,
      label: 'Districts',
      value: stats?.districts_covered?.toString() ?? '—',
      sub: 'Across Sri Lanka',
      accent: false,
    },
    {
      icon: Clock,
      label: 'Last Updated',
      value: formatDate(stats?.last_updated ?? null),
      sub: 'Auto-scraped daily',
      accent: false,
    },
  ];

  return (
    <section className="pt-8 pb-6">
      {/* Hero text */}
      <div className="text-center mb-12">
        <motion.h2 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="text-4xl sm:text-6xl font-black tracking-tighter mb-4 text-white leading-[1.1]"
        >
          Sri Lanka <span className="text-accent-light">Property</span>
          <br className="hidden sm:block" /> Intelligence
        </motion.h2>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-text-secondary text-sm sm:text-lg max-w-2xl mx-auto font-medium"
        >
          Real-time property prices, market trends, and district analytics.
          Powered by daily automated scraping of 5,000+ listings.
        </motion.p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, idx) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * idx }}
            whileHover={{ y: -5, transition: { duration: 0.1 } }}
            className={`
              rounded-2xl p-5 border transition-all duration-300
              ${card.accent
                ? 'bg-accent/10 border-accent/30 shadow-xl shadow-accent-glow backdrop-blur-sm'
                : 'bg-bg-card border-border hover:border-border-hover hover:bg-bg-card-hover'
              }
            `}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${card.accent ? 'bg-accent/20' : 'bg-bg-card-hover border border-border'}`}>
                <card.icon className={`w-4 h-4 ${card.accent ? 'text-accent-light' : 'text-text-muted'}`} />
              </div>
              <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                {card.label}
              </span>
            </div>
            <p className={`text-2xl sm:text-3xl font-black tracking-tight ${card.accent ? 'text-accent-light' : 'text-text-primary'}`}>
              {card.value}
            </p>
            <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{card.sub}</p>
              {card.changePct != null && (
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                  card.changePct >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {card.changePct >= 0
                    ? <TrendingUp className="w-3 h-3" />
                    : <TrendingDown className="w-3 h-3" />
                  }
                  {card.changePct >= 0 ? '+' : ''}{card.changePct}% vs last month
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Property type breakdown */}
      {stats?.listings_by_type && (
        <div className="flex flex-wrap justify-center gap-3 mt-5 mb-2">
          {Object.entries(stats.listings_by_type)
            .sort(([, a], [, b]) => b - a)
            .map(([type, count]) => (
              <span
                key={type}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-bg-card border border-border"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-accent-light" />
                {type}: {count.toLocaleString()}
              </span>
            ))}
        </div>
      )}
    </section>
  );
}
