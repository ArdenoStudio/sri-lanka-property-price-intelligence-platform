import { useState, useMemo } from 'react';
import { Calculator, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SL_BANK_RATES,
  TENURE_OPTIONS,
  DOWN_PAYMENT_PRESETS,
  calculateEMI,
  RATES_LAST_UPDATED,
} from '../data/bankRates';
import { useCurrency } from '../hooks/useCurrency';
import { MinimalSelect } from './ui/MinimalSelect';

interface Props {
  listingPrice: number | null;
  listingType: string | null;
}

export function MortgageCalculator({ listingPrice, listingType }: Props) {
  if (!listingPrice || listingType === 'rent') return null;

  const { formatConverted } = useCurrency();

  const [downPct, setDownPct] = useState(20);
  const [selectedBank, setSelectedBank] = useState(SL_BANK_RATES[0].shortName);
  const [customRate, setCustomRate] = useState(SL_BANK_RATES[0].defaultRate);
  const [tenure, setTenure] = useState(20);
  const [expanded, setExpanded] = useState(false);

  const bank = SL_BANK_RATES.find(b => b.shortName === selectedBank) || SL_BANK_RATES[0];

  const { principal, emi, totalPayment, totalInterest } = useMemo(() => {
    const principal = listingPrice * (1 - downPct / 100);
    const emi = calculateEMI(principal, customRate, tenure);
    const totalPayment = emi * tenure * 12;
    const totalInterest = totalPayment - principal;
    return { principal, emi, totalPayment, totalInterest };
  }, [listingPrice, downPct, customRate, tenure]);

  const bankOptions = SL_BANK_RATES.map(b => ({ value: b.shortName, label: b.shortName }));

  function handleBankChange(shortName: string) {
    setSelectedBank(shortName);
    const b = SL_BANK_RATES.find(r => r.shortName === shortName);
    if (b) setCustomRate(b.defaultRate);
  }

  return (
    <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-xl bg-[#14b8a6]/[0.1] border border-[#14b8a6]/20 flex items-center justify-center shrink-0">
          <Calculator className="w-4 h-4 text-[#14b8a6]" />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#525252]">Mortgage Calculator</p>
          <p className="text-[10px] text-[#404040]">Rates as of {RATES_LAST_UPDATED}</p>
        </div>
      </div>

      {/* EMI hero */}
      <div className="mb-5">
        <p className="text-[2.2rem] font-bold text-[#14b8a6] tracking-tight leading-none num">
          ~{formatConverted(emi)}<span className="text-[1rem] text-[#525252] font-normal">/mo</span>
        </p>
        <p className="text-[12px] text-[#525252] mt-1">
          Over {tenure}yr at {customRate.toFixed(1)}% p.a. · {bank.bank}
        </p>
      </div>

      {/* Collapsible parameters */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-1.5 text-[12px] text-[#737373] hover:text-white transition-colors cursor-pointer bg-transparent border-none p-0 mb-3"
      >
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        {expanded ? 'Hide parameters' : 'Adjust parameters'}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-5 pb-2">
              {/* Down payment */}
              <div>
                <label className="block text-[10px] uppercase tracking-[0.15em] text-[#525252] mb-2">
                  Down Payment — Loan: {formatConverted(principal)}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {DOWN_PAYMENT_PRESETS.map(p => (
                    <button
                      key={p}
                      onClick={() => setDownPct(p)}
                      className={`px-3 py-1 rounded-full text-[12px] font-medium cursor-pointer border transition-colors ${
                        downPct === p
                          ? 'bg-[#14b8a6] text-black border-[#14b8a6]'
                          : 'bg-transparent text-[#525252] border-white/[0.08] hover:text-white hover:border-white/[0.14]'
                      }`}
                    >
                      {p}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Bank */}
              <div>
                <label className="block text-[10px] uppercase tracking-[0.15em] text-[#525252] mb-2">Bank</label>
                <MinimalSelect options={bankOptions} value={selectedBank} onChange={handleBankChange} />
              </div>

              {/* Rate */}
              <div>
                <label className="block text-[10px] uppercase tracking-[0.15em] text-[#525252] mb-2">
                  Interest Rate — {bank.shortName} range: {bank.minRate}–{bank.maxRate}% p.a.
                </label>
                <input
                  type="number"
                  min={bank.minRate}
                  max={bank.maxRate}
                  step={0.1}
                  value={customRate}
                  onChange={e => setCustomRate(Number(e.target.value))}
                  className="w-32 bg-[#161616] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-[14px] focus:outline-none focus:border-[#14b8a6]/40 transition-colors num"
                />
                <span className="text-[12px] text-[#525252] ml-2">% p.a.</span>
              </div>

              {/* Tenure */}
              <div>
                <label className="block text-[10px] uppercase tracking-[0.15em] text-[#525252] mb-2">Loan Tenure</label>
                <div className="flex flex-wrap gap-1.5">
                  {TENURE_OPTIONS.map(t => (
                    <button
                      key={t}
                      onClick={() => setTenure(t)}
                      className={`px-3 py-1 rounded-full text-[12px] font-medium cursor-pointer border transition-colors ${
                        tenure === t
                          ? 'bg-[#14b8a6] text-black border-[#14b8a6]'
                          : 'bg-transparent text-[#525252] border-white/[0.08] hover:text-white hover:border-white/[0.14]'
                      }`}
                    >
                      {t}yr
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary row */}
      <div className="flex items-center gap-6 pt-4 border-t border-white/[0.06] mt-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.12em] text-[#525252]">Total Payment</p>
          <p className="text-[13px] font-bold text-white num">{formatConverted(totalPayment)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.12em] text-[#525252]">Total Interest</p>
          <p className="text-[13px] font-bold text-amber-400 num">{formatConverted(totalInterest)}</p>
        </div>
      </div>

      <p className="text-[10px] text-[#404040] mt-3">
        Estimates only. Contact your bank for actual loan approval and terms.
      </p>
    </div>
  );
}
