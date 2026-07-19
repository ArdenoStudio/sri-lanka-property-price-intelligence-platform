import { useMemo, useState } from 'react';
import { Calculator } from 'lucide-react';
import {
  FEATURED_BANK_RATE,
  SL_BANK_RATES,
  TENURE_OPTIONS,
  DOWN_PAYMENT_PRESETS,
  NILAM_DEFAULT_DOWN_PAYMENT_PCT,
  NILAM_DEFAULT_TENURE_YEARS,
  getBankRate,
  getMortgageSnapshot,
  RATES_LAST_UPDATED,
} from '../data/bankRates';
import { useCurrency } from '../hooks/useCurrency';

interface Props {
  listingPrice: number | null;
  listingType: string | null;
  variant?: 'detail' | 'estimate';
}

const SECTION_LABELS = {
  detail: 'Financing',
  estimate: 'Estimate financing',
} as const;

const SECTION_TITLES = {
  detail: 'What monthly financing could look like',
  estimate: 'What financing could look like at the median estimate',
} as const;

const SECTION_DESCRIPTIONS = {
  detail: 'property.lk uses indicative Sri Lankan bank rates so you can compare payment scenarios before speaking to a lender.',
  estimate: 'Use the estimated asking value as your base and compare how the monthly payment changes by bank, tenure, and down payment.',
} as const;

function StatTile({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'accent' | 'warning';
}) {
  const valueClass =
    tone === 'accent'
      ? 'text-[#e5e5e5]'
      : tone === 'warning'
        ? 'text-[#a3a3a3]'
        : 'text-white';

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0d0d0d] px-4 py-4">
      <p className="text-[10px] uppercase tracking-[0.16em] text-[#525252] font-assumptions">{label}</p>
      <p className={`mt-2 text-[1rem] sm:text-[1.1rem] leading-tight num font-assumptions font-semibold ${valueClass}`}>{value}</p>
    </div>
  );
}

export function MortgageCalculator({
  listingPrice,
  listingType,
  variant = 'detail',
}: Props) {
  const { formatConverted } = useCurrency();
  const safeListingPrice = listingPrice ?? 0;

  const [downPct, setDownPct] = useState(NILAM_DEFAULT_DOWN_PAYMENT_PCT);
  const [selectedBank, setSelectedBank] = useState(FEATURED_BANK_RATE.shortName);
  const [customRate, setCustomRate] = useState(FEATURED_BANK_RATE.defaultRate);
  const [tenure, setTenure] = useState(NILAM_DEFAULT_TENURE_YEARS);

  const bank = getBankRate(selectedBank);

  const { principal, downPayment, emi, totalPayment, totalInterest } = useMemo(() => {
    return getMortgageSnapshot(safeListingPrice, {
      downPaymentPct: downPct,
      annualRatePct: customRate,
      tenureYears: tenure,
    });
  }, [safeListingPrice, downPct, customRate, tenure]);

  if (!listingPrice || listingType !== 'sale') return null;

  function handleBankChange(shortName: string) {
    setSelectedBank(shortName);
    const nextBank = getBankRate(shortName);
    setCustomRate(nextBank.defaultRate);
  }

  return (
    <div className="bg-[#111111] border border-white/[0.08] rounded-[28px] overflow-hidden">
      <div className="p-6 sm:p-7 border-b border-white/[0.06]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-2xl bg-[#f5f5f5]/[0.1] border border-[#f5f5f5]/20 flex items-center justify-center shrink-0">
                <Calculator className="w-4 h-4 text-[#f5f5f5]" />
              </div>
              <p className="text-[10px] uppercase tracking-[0.24em] text-[#525252] font-assumptions">
                {SECTION_LABELS[variant]}
              </p>
            </div>
            <h3 className="text-[clamp(1.4rem,2.8vw,2rem)] font-semibold text-white tracking-tight">
              {SECTION_TITLES[variant]}
            </h3>
            <p className="text-[14px] text-[#737373] mt-3 leading-relaxed font-assumptions">
              {SECTION_DESCRIPTIONS[variant]}
            </p>
          </div>
          <div className="rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 self-start">
            <p className="text-[11px] text-[#737373] font-assumptions">Rates updated {RATES_LAST_UPDATED}</p>
          </div>
        </div>
        <div className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.95fr)] gap-6 mt-8">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#525252] font-assumptions">Estimated monthly EMI</p>
            <p className="mt-3 text-[clamp(2.75rem,6vw,4.75rem)] text-white leading-[0.92] num font-emi">
              ~{formatConverted(emi)}
              <span className="ml-2 text-[0.28em] text-[#737373] align-middle font-assumptions">/ month</span>
            </p>
            <p className="text-[14px] text-[#a3a3a3] mt-4 leading-relaxed font-assumptions">
              Based on a loan of {formatConverted(principal)} with {bank.bank} at {customRate.toFixed(1)}% over {tenure} years.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatTile label="Property price" value={formatConverted(safeListingPrice)} />
            <StatTile label="Down payment" value={formatConverted(downPayment)} />
            <StatTile label="Total interest" value={formatConverted(totalInterest)} tone="warning" />
            <StatTile label="Total repaid" value={formatConverted(totalPayment)} tone="accent" />
          </div>
        </div>
      </div>

      <div className="p-6 sm:p-7 border-b border-white/[0.06]">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#525252] font-assumptions">Section 01</p>
            <h4 className="text-[1.1rem] font-semibold text-white mt-2">Choose a bank rate</h4>
          </div>
          <p className="text-[12px] text-[#737373] font-assumptions">
            One indicative rate per bank keeps the comparison fast, while the rate range shows where adjustments can move.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 mt-5">
          {SL_BANK_RATES.map(option => {
            const isSelected = selectedBank === option.shortName;
            return (
              <button
                key={option.shortName}
                onClick={() => handleBankChange(option.shortName)}
                className={`rounded-2xl border p-4 text-left transition-colors cursor-pointer ${
                  isSelected
                    ? 'border-white bg-white text-black'
                    : 'border-white/[0.08] bg-[#0d0d0d] hover:border-white/[0.16]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={`text-[13px] font-semibold ${isSelected ? 'text-black' : 'text-white'}`}>{option.shortName}</p>
                    <p className={`text-[11px] mt-1 leading-relaxed font-assumptions ${isSelected ? 'text-black/60' : 'text-[#737373]'}`}>{option.bank}</p>
                  </div>
                  <span className={`text-[11px] rounded-full px-2.5 py-1 border font-assumptions ${
                    isSelected
                      ? 'border-black/20 bg-black/10 text-black'
                      : 'border-white/[0.08] bg-white/[0.04] text-[#a3a3a3]'
                  }`}>
                    {option.defaultRate.toFixed(1)}%
                  </span>
                </div>
                <p className={`text-[11px] mt-4 font-assumptions ${isSelected ? 'text-black/50' : 'text-[#525252]'}`}>
                  Range {option.minRate.toFixed(1)}% – {option.maxRate.toFixed(1)}%
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-6 sm:p-7 border-b border-white/[0.06]">
        <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)] gap-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#525252] font-assumptions">Section 02</p>
            <h4 className="text-[1.1rem] font-semibold text-white mt-2">Set your loan assumptions</h4>

            <div className="mt-5">
              <p className="text-[11px] uppercase tracking-[0.15em] text-[#525252] mb-3 font-assumptions">
                Down payment
              </p>
              <div className="flex flex-wrap gap-2">
                {DOWN_PAYMENT_PRESETS.map(preset => (
                  <button
                    key={preset}
                    onClick={() => setDownPct(preset)}
                    className={`px-4 py-2 rounded-full text-[13px] cursor-pointer border transition-colors ${
                      downPct === preset
                        ? 'bg-white text-black border-white'
                        : 'bg-transparent text-[#737373] border-white/[0.08] hover:text-white hover:border-white/[0.16]'
                    }`}
                  >
                    {preset}%
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <p className="text-[11px] uppercase tracking-[0.15em] text-[#525252] mb-3 font-assumptions">
                Loan tenure
              </p>
              <div className="flex flex-wrap gap-2">
                {TENURE_OPTIONS.map(option => (
                  <button
                    key={option}
                    onClick={() => setTenure(option)}
                    className={`px-4 py-2 rounded-full text-[13px] cursor-pointer border transition-colors ${
                      tenure === option
                        ? 'bg-white text-black border-white'
                        : 'bg-transparent text-[#737373] border-white/[0.08] hover:text-white hover:border-white/[0.16]'
                    }`}
                  >
                    {option} years
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/[0.08] bg-[#0d0d0d] p-5">
            <p className="text-[11px] uppercase tracking-[0.15em] text-[#525252] font-assumptions">
              Rate adjustment
            </p>
            <p className="text-[13px] text-[#a3a3a3] mt-2 leading-relaxed font-assumptions">
              Fine-tune the selected bank inside its indicative band to reflect promos, relationship pricing, or a stricter quote.
            </p>

            <div className="mt-5">
              <label className="block text-[11px] uppercase tracking-[0.15em] text-[#525252] mb-2 font-assumptions">
                {bank.shortName} range: {bank.minRate.toFixed(1)}% – {bank.maxRate.toFixed(1)}%
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={bank.minRate}
                  max={bank.maxRate}
                  step={0.1}
                  value={customRate}
                  onChange={e => setCustomRate(Number(e.target.value))}
                  className="w-32 bg-[#161616] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-[15px] focus:outline-none focus:border-[#f5f5f5]/40 transition-colors num font-assumptions"
                />
                <span className="text-[13px] text-[#737373] font-assumptions">% per annum</span>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <StatTile label="Selected bank" value={bank.shortName} />
              <StatTile label="Loan amount" value={formatConverted(principal)} />
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 sm:p-7">
        <p className="text-[10px] uppercase tracking-[0.18em] text-[#525252] font-assumptions">Section 03</p>
        <h4 className="text-[1.1rem] font-semibold text-white mt-2">Assumptions to carry forward</h4>

        <div className="grid sm:grid-cols-3 gap-3 mt-5">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
            <p className="text-[11px] text-[#a3a3a3] font-assumptions">Indicative rate source</p>
            <p className="text-[13px] text-white mt-2 leading-relaxed font-assumptions">
              Manual property.lk bank-rate table, last refreshed {RATES_LAST_UPDATED}.
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
            <p className="text-[11px] text-[#a3a3a3] font-assumptions">What is included</p>
            <p className="text-[13px] text-white mt-2 leading-relaxed font-assumptions">
              Principal and interest only for a standard monthly amortized loan.
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
            <p className="text-[11px] text-[#a3a3a3] font-assumptions">What is not included</p>
            <p className="text-[13px] text-white mt-2 leading-relaxed font-assumptions">
              Legal fees, valuation costs, insurance, taxes, and final approval conditions.
            </p>
          </div>
        </div>

        <p className="text-[12px] text-[#737373] mt-5 leading-relaxed font-assumptions">
          These figures are directional only. Actual bank offers can shift with salary routing, promotional windows,
          collateral profile, and credit review.
        </p>
      </div>
    </div>
  );
}
