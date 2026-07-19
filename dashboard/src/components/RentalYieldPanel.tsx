import { useEffect, useState } from 'react';
import { CircleAlert, TrendingUp } from 'lucide-react';
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
  high:   'bg-white/[0.08] text-white border-white/20',
  medium: 'bg-white/[0.06] text-[#a3a3a3] border-white/15',
  low:    'bg-white/[0.04] text-[#737373] border-white/10',
};

const CONFIDENCE_COPY: Record<string, string> = {
  high: 'Healthy rent and sale sample sizes for this district make this a stronger directional signal.',
  medium: 'Useful as a market read, but the comp set is still limited enough that the estimate can move around.',
  low: 'Thin comp coverage - treat this as a rough prompt for further checking, not a pricing decision on its own.',
};

const PROPERTY_LABELS: Record<string, string> = {
  apartment: 'apartment',
  house: 'house',
  villa: 'villa',
};

function getYieldTone(yieldPct: number) {
  if (yieldPct >= 7) {
    return {
      value: 'text-white',
      panel: 'border-white/20 bg-white/[0.08]',
      bar: 'bg-white',
      label: 'Higher gross yield',
    };
  }

  if (yieldPct >= 4) {
    return {
      value: 'text-[#a3a3a3]',
      panel: 'border-white/15 bg-white/[0.06]',
      bar: 'bg-white/60',
      label: 'Mid-range gross yield',
    };
  }

  return {
    value: 'text-[#a3a3a3]',
    panel: 'border-white/15 bg-white/[0.06]',
    bar: 'bg-white/30',
    label: 'Lower gross yield',
  };
}

function formatYieldEstimate(yieldPct: number) {
  if (yieldPct < 1) return '<1';
  return `${Math.round(yieldPct)}`;
}

function formatCompCount(count: number | undefined, label: string) {
  const value = count ?? 0;
  return `${value} ${label}${value === 1 ? '' : 's'}`;
}

function describeSubject(propertyType: string, bedrooms: number | null) {
  const label = PROPERTY_LABELS[propertyType] ?? propertyType;
  return bedrooms ? `${bedrooms}-bed ${label}` : label;
}

export function RentalYieldPanel({ district, propertyType, listingType, bedrooms, dealScore }: Props) {
  const shouldRender =
    listingType === 'sale' &&
    (propertyType === 'apartment' || propertyType === 'house') &&
    Boolean(district);

  const { formatConverted } = useCurrency();
  const [data, setData] = useState<RentalYieldResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shouldRender || !district || !propertyType) return;
    const safeDistrict: string = district;
    const safePropertyType: string = propertyType;

    let cancelled = false;

    async function loadYield() {
      setLoading(true);

      try {
        const result = await getRentalYield({
          district: safeDistrict,
          property_type: safePropertyType,
          bedrooms,
          deal_score: dealScore,
        });

        if (!cancelled) setData(result);
      } catch {
        if (!cancelled) setData({ available: false, reason: 'Could not load rental data' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadYield();
    return () => {
      cancelled = true;
    };
  }, [district, propertyType, bedrooms, dealScore, shouldRender]);

  if (!shouldRender) return null;

  if (loading) {
    return (
      <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-xl bg-[#f5f5f5]/[0.1] border border-[#f5f5f5]/20 flex items-center justify-center shrink-0 animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-44 bg-white/[0.05] rounded animate-pulse" />
            <div className="h-3 w-64 bg-white/[0.04] rounded animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] gap-4">
          <div className="h-72 bg-white/[0.04] rounded-[24px] animate-pulse" />
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => <div key={i} className="h-28 bg-white/[0.04] rounded-[24px] animate-pulse" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!data || !data.available) {
    return (
      <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-xl bg-[#f5f5f5]/[0.1] border border-[#f5f5f5]/20 flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4 text-[#f5f5f5]" />
          </div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#525252]">Rental Yield Estimate</p>
        </div>
        <p className="text-[13px] text-[#525252] mt-2 leading-relaxed">
          {data?.reason || 'Rental yield data unavailable for this area.'} We need enough separate long-term rent and sale
          comparables before showing a directional estimate.
        </p>
      </div>
    );
  }

  const conf = data.data_confidence || 'low';
  const tone = getYieldTone(data.rental_yield_pct ?? 0);
  const subjectLabel = describeSubject(propertyType!, bedrooms);
  const contextScore = Math.max(0, Math.min(100, data.investment_score ?? 0));

  return (
    <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-6">
      <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#f5f5f5]/[0.1] border border-[#f5f5f5]/20 flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4 text-[#f5f5f5]" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#525252]">Rental Yield Estimate</p>
            <p className="text-[15px] text-white mt-1">Separate rent and sale comps, one gross yield read</p>
            <p className="text-[12px] text-[#737373] mt-1 leading-relaxed max-w-[44rem]">
              Where sources such as ikman split rent and sale categories cleanly, that separation is preserved in the estimate.
            </p>
          </div>
        </div>
        <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full border capitalize self-start ${CONFIDENCE_STYLES[conf]}`}>
          {conf} confidence
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
        <section className={`rounded-[24px] border p-5 sm:p-6 ${tone.panel}`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-[#737373]">Estimated gross yield</p>
              <div className="mt-3 flex items-start gap-1">
                <span className={`font-display num text-[clamp(3.25rem,9vw,5.75rem)] leading-none ${tone.value}`}>
                  ~{formatYieldEstimate(data.rental_yield_pct ?? 0)}
                </span>
                <span className={`font-display text-[1.9rem] leading-none mt-2 ${tone.value}`}>%</span>
              </div>
              <p className="mt-2 text-[12px] uppercase tracking-[0.16em] text-[#8a8a8a]">{tone.label}</p>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-black/20 px-3 py-2 text-left sm:text-right">
              <p className="text-[10px] uppercase tracking-[0.16em] text-[#737373]">Annualized rent</p>
              <p className="text-[16px] font-semibold text-white num mt-1">
                {data.annual_rent_estimate != null ? formatConverted(data.annual_rent_estimate) : '—'}
              </p>
            </div>
          </div>

          <p className="mt-4 text-[13px] leading-relaxed text-[#cfcfcf] max-w-[42rem]">
            Gross annual yield from median asking rent divided by median asking sale price for {subjectLabel} listings in {district}.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-[#737373]">Rent side of the estimate</p>
              <p className="mt-2 text-[20px] font-semibold text-white num">
                {data.monthly_rent_estimate != null ? formatConverted(data.monthly_rent_estimate) : '—'}
              </p>
              <p className="mt-1 text-[11px] text-[#8a8a8a]">
                Median monthly asking rent from {formatCompCount(data.rent_sample_count, 'rent comp')}.
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-[#737373]">Sale side of the estimate</p>
              <p className="mt-2 text-[20px] font-semibold text-white num">
                {data.sale_price_median != null ? formatConverted(data.sale_price_median) : '—'}
              </p>
              <p className="mt-1 text-[11px] text-[#8a8a8a]">
                Median asking sale price from {formatCompCount(data.sale_sample_count, 'sale comp')}.
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-white/[0.08] bg-black/20 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-[#737373]">Context score</p>
                <p className="mt-1 text-[12px] text-[#8a8a8a] leading-relaxed">
                  Secondary signal blending yield, deal score, days on market, and recent price trend.
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[24px] font-semibold text-white num">{contextScore}</p>
                <p className="text-[10px] uppercase tracking-[0.14em] text-[#737373]">/100</p>
              </div>
            </div>
            <div className="mt-3 h-2 rounded-full bg-white/[0.08] overflow-hidden">
              <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${contextScore}%` }} />
            </div>
          </div>
        </section>

        <div className="grid gap-4">
          <section className="rounded-[24px] border border-white/[0.08] bg-[#151515] p-5">
            <p className="text-[10px] uppercase tracking-[0.16em] text-[#737373]">How to read the split</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-white/[0.06] bg-[#111111] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-[#8a8a8a]">Long-term rental comps</p>
                    <p className="text-[15px] text-white font-medium mt-1">
                      {formatCompCount(data.rent_sample_count, 'listing')}
                    </p>
                  </div>
                  <span className="text-[10px] uppercase tracking-[0.14em] text-[#525252]">Numerator</span>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-[#8a8a8a]">
                  Used to estimate monthly rent. Short-term and holiday lets should be excluded where they are flagged.
                </p>
              </div>

              <div className="rounded-2xl border border-white/[0.06] bg-[#111111] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-[#8a8a8a]">For-sale comps</p>
                    <p className="text-[15px] text-white font-medium mt-1">
                      {formatCompCount(data.sale_sample_count, 'listing')}
                    </p>
                  </div>
                  <span className="text-[10px] uppercase tracking-[0.14em] text-[#525252]">Denominator</span>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-[#8a8a8a]">
                  Used as the asking-price base. This is not the same thing as a closed sale or bank valuation.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[24px] border border-white/[0.08] bg-[#151515] p-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0">
                <CircleAlert className="w-4 h-4 text-[#a3a3a3]" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-[#737373]">Caveats</p>
                <p className="text-[15px] text-white mt-1">Treat this as an estimate, not a precise yield quote</p>
              </div>
            </div>

            <ul className="mt-4 space-y-3 text-[11px] leading-relaxed text-[#a3a3a3]">
              <li>Gross yield only: it does not deduct vacancy, maintenance, taxes, agency fees, or financing costs.</li>
              <li>Built from active listing medians, not signed leases, closed sale prices, or verified operating income.</li>
              <li>Small comp sets, broad bedroom matching, or unusually priced listings can move the estimate materially.</li>
            </ul>
          </section>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-2">
        <p className="text-[11px] text-[#737373] leading-relaxed">{CONFIDENCE_COPY[conf]}</p>
        <p className="text-[10px] text-[#525252] leading-relaxed">
          Separate comp pools in {district}: {formatCompCount(data.rent_sample_count, 'rent listing')} and{' '}
          {formatCompCount(data.sale_sample_count, 'sale listing')}. This panel is a market-reference tool, not a formal valuation or underwriting model.
        </p>
      </div>
    </div>
  );
}
