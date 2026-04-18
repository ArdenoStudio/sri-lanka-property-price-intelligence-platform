import { useState, useEffect } from 'react';
import { TrendingUp } from 'lucide-react';
import { getRentalYield } from '../api';
import type { RentalYieldResult } from '../api';
import { useCurrency } from '../hooks/useCurrency';

interface Props {
  district: string | null;
  propertyType: string | null;
  listingType: string | null;
  bedrooms: number | null;
  dealScore: number | null;
}

const CONFIDENCE_STYLES: Record<string, string> = {
  high:   'bg-emerald-500/[0.12] text-emerald-400 border-emerald-500/20',
  medium: 'bg-amber-500/[0.12] text-amber-400 border-amber-500/20',
  low:    'bg-red-500/[0.12] text-red-400 border-red-500/20',
};

function InvestmentGauge({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const cx = 60, cy = 60, r = 44;
  const progress = clamped / 100;
  const rad = -Math.PI + progress * Math.PI;
  const nx = cx + r * Math.cos(rad);
  const ny = cy + r * Math.sin(rad);

  const color = clamped >= 65 ? '#10b981' : clamped >= 40 ? '#f59e0b' : '#ef4444';
  const label = clamped >= 65 ? 'Strong Buy' : clamped >= 40 ? 'Moderate' : 'High Risk';

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="120" height="70" viewBox="0 0 120 70" className="overflow-visible">
        <path d="M 16 60 A 44 44 0 0 1 104 60" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" strokeLinecap="round" />
        {clamped > 0 && (
          <path
            d={`M 16 60 A 44 44 0 0 1 ${nx.toFixed(1)} ${ny.toFixed(1)}`}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            opacity="0.8"
          />
        )}
        <circle cx={nx.toFixed(1)} cy={ny.toFixed(1)} r="5" fill={color} />
      </svg>
      <div className="text-center">
        <p className="text-[11px] uppercase tracking-[0.15em] text-[#525252]">Investment Score</p>
        <p className="text-[22px] font-bold num" style={{ color }}>{clamped}</p>
        <p className="text-[10px]" style={{ color }}>{label}</p>
      </div>
    </div>
  );
}

export function RentalYieldPanel({ district, propertyType, listingType, bedrooms, dealScore }: Props) {
  if (
    listingType !== 'sale' ||
    (propertyType !== 'apartment' && propertyType !== 'house') ||
    !district
  ) return null;

  const { formatConverted } = useCurrency();
  const [data, setData] = useState<RentalYieldResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getRentalYield({
      district,
      property_type: propertyType!,
      bedrooms,
      deal_score: dealScore,
    })
      .then(setData)
      .catch(() => setData({ available: false, reason: 'Could not load rental data' }))
      .finally(() => setLoading(false));
  }, [district, propertyType, bedrooms, dealScore]);

  const yieldColor = (yld: number) =>
    yld >= 7 ? 'text-emerald-400' : yld >= 4 ? 'text-amber-400' : 'text-red-400';

  if (loading) {
    return (
      <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-xl bg-[#14b8a6]/[0.1] border border-[#14b8a6]/20 flex items-center justify-center shrink-0 animate-pulse" />
          <div className="h-4 w-40 bg-white/[0.05] rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="h-32 bg-white/[0.04] rounded-2xl animate-pulse" />
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-white/[0.04] rounded-xl animate-pulse" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!data || !data.available) {
    return (
      <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-xl bg-[#14b8a6]/[0.1] border border-[#14b8a6]/20 flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4 text-[#14b8a6]" />
          </div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#525252]">Investment Analysis</p>
        </div>
        <p className="text-[13px] text-[#525252] mt-2">
          Rental yield data unavailable for this area — insufficient comparable listings.
        </p>
      </div>
    );
  }

  const conf = data.data_confidence || 'low';

  return (
    <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded-xl bg-[#14b8a6]/[0.1] border border-[#14b8a6]/20 flex items-center justify-center shrink-0">
          <TrendingUp className="w-4 h-4 text-[#14b8a6]" />
        </div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-[#525252]">Investment Analysis</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Investment score gauge */}
        <div className="flex items-center justify-center">
          <InvestmentGauge score={data.investment_score ?? 0} />
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-2 gap-3">
          {data.rental_yield_pct != null && (
            <div className="bg-[#161616] rounded-xl p-3 col-span-2">
              <p className="text-[10px] uppercase tracking-[0.12em] text-[#525252] mb-1">Rental Yield</p>
              <p className={`text-[1.4rem] font-bold num ${yieldColor(data.rental_yield_pct)}`}>
                {data.rental_yield_pct.toFixed(1)}% p.a.
              </p>
            </div>
          )}
          <div className="bg-[#161616] rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-[#525252] mb-1">Monthly Rent</p>
            <p className="text-[13px] font-bold text-white num">{formatConverted(data.monthly_rent_estimate)}</p>
          </div>
          <div className="bg-[#161616] rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-[#525252] mb-1">Annual Rent</p>
            <p className="text-[13px] font-bold text-white num">{formatConverted(data.annual_rent_estimate)}</p>
          </div>
          <div className="bg-[#161616] rounded-xl p-3 col-span-2 flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.12em] text-[#525252]">Data Confidence</p>
            <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border capitalize ${CONFIDENCE_STYLES[conf]}`}>
              {conf}
            </span>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-[#404040] mt-4">
        Based on {data.rent_sample_count} rental + {data.sale_sample_count} sale comparables in {district}.
        Estimates only — actual yields vary with vacancy and maintenance.
      </p>
    </div>
  );
}
