import { useCurrency } from '../hooks/useCurrency';
import {
  FEATURED_BANK_RATE,
  NILAM_DEFAULT_DOWN_PAYMENT_PCT,
  NILAM_DEFAULT_TENURE_YEARS,
  getMortgageSnapshot,
} from '../data/bankRates';

interface Props {
  priceLkr: number | null;
  listingType: string | null;
  variant?: 'card' | 'hero' | 'banner';
  label?: string;
}

export function EMITeaser({
  priceLkr,
  listingType,
  variant = 'card',
  label,
}: Props) {
  const { formatConverted } = useCurrency();

  if (!priceLkr || listingType !== 'sale') return null;
  if (variant === 'card' && priceLkr <= 1_000_000) return null;

  const bank = FEATURED_BANK_RATE;
  const { emi } = getMortgageSnapshot(priceLkr, {
    downPaymentPct: NILAM_DEFAULT_DOWN_PAYMENT_PCT,
    annualRatePct: bank.defaultRate,
    tenureYears: NILAM_DEFAULT_TENURE_YEARS,
  });

  if (variant === 'hero') {
    return (
      <div className="inline-flex flex-col gap-1.5 rounded-2xl border border-white/[0.08] bg-[#111111] px-4 py-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-[#525252] font-assumptions">
          {label ?? 'Estimated EMI'}
        </p>
        <p className="text-[clamp(1.8rem,3.5vw,2.5rem)] text-white leading-none num font-emi">
          ~{formatConverted(emi)}
          <span className="ml-2 text-[0.34em] text-[#737373] align-middle font-assumptions">/mo</span>
        </p>
        <p className="text-[12px] text-[#737373] font-assumptions">
          {NILAM_DEFAULT_DOWN_PAYMENT_PCT}% down · {NILAM_DEFAULT_TENURE_YEARS}y · {bank.shortName} at {bank.defaultRate.toFixed(1)}%
        </p>
      </div>
    );
  }

  if (variant === 'banner') {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-[#0d0d0d] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#525252] font-assumptions">
              {label ?? 'Indicative financing'}
            </p>
            <p className="mt-2 text-[clamp(1.9rem,4vw,2.75rem)] text-white leading-none num font-emi">
              ~{formatConverted(emi)}
              <span className="ml-2 text-[0.34em] text-[#737373] align-middle font-assumptions">/mo</span>
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-[12px] text-[#a3a3a3] font-assumptions">
              {NILAM_DEFAULT_DOWN_PAYMENT_PCT}% down over {NILAM_DEFAULT_TENURE_YEARS} years
            </p>
            <p className="text-[12px] text-[#737373] mt-1 font-assumptions">
              Using {bank.bank} at {bank.defaultRate.toFixed(1)}% p.a.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-[0.16em] text-[#404040] font-assumptions">
        {label ?? `From ${bank.shortName}`}
      </p>
      <p className="mt-1 text-[1.05rem] text-white leading-none num font-emi">
        ~{formatConverted(emi)}
        <span className="ml-1.5 text-[0.6em] text-[#737373] font-assumptions">/mo</span>
      </p>
      <p className="mt-1 text-[11px] text-[#737373] font-assumptions">
        {NILAM_DEFAULT_DOWN_PAYMENT_PCT}% down · {NILAM_DEFAULT_TENURE_YEARS}y · {bank.defaultRate.toFixed(1)}%
      </p>
    </div>
  );
}
