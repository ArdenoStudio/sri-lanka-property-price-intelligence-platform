import { useState, useRef, useEffect } from 'react';
import { Globe, Check } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCurrency } from '../hooks/useCurrency';
import type { CurrencyCode } from '../contexts/CurrencyContext';

const CURRENCIES: { code: CurrencyCode; label: string }[] = [
  { code: 'LKR', label: 'LKR — Sri Lankan Rupee' },
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'AUD', label: 'AUD — Australian Dollar' },
  { code: 'GBP', label: 'GBP — British Pound' },
  { code: 'CAD', label: 'CAD — Canadian Dollar' },
];

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return 'just now';
  if (diff < 60) return `${diff} min ago`;
  return `${Math.floor(diff / 60)}h ago`;
}

export function CurrencySwitcher() {
  const { currency, setCurrency, ratesUpdatedAt } = useCurrency();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-[13px] text-[#525252] hover:text-white transition-colors px-3 py-1 rounded-full hover:bg-white/[0.06] cursor-pointer bg-transparent border-none"
        aria-label="Switch currency"
      >
        <Globe className="w-3.5 h-3.5" />
        <span>{currency}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-full mt-2 w-64 z-50 max-sm:fixed max-sm:right-4 max-sm:bottom-[72px] max-sm:top-auto"
          >
            <div className="bg-[#111111] border border-white/[0.1] rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.8)] overflow-hidden">
              <div className="py-1.5">
                {CURRENCIES.map(({ code, label }) => (
                  <button
                    key={code}
                    onClick={() => { setCurrency(code); setOpen(false); }}
                    className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-white/[0.05] transition-colors cursor-pointer bg-transparent border-none"
                  >
                    <span className={`text-[13px] ${currency === code ? 'text-white font-medium' : 'text-[#a3a3a3]'}`}>
                      {label}
                    </span>
                    {currency === code && <Check className="w-3.5 h-3.5 text-[#14b8a6] shrink-0" />}
                  </button>
                ))}
              </div>

              <div className="border-t border-white/[0.06] px-4 py-3">
                <p className="text-[11px] font-semibold text-[#737373] mb-1">IIA — Inward Investment Account</p>
                <p className="text-[10px] text-[#525252] leading-relaxed">
                  Overseas Sri Lankans can repatriate property investment proceeds via an IIA at any licensed commercial bank (CBSL regulation).
                </p>
                {ratesUpdatedAt && (
                  <p className="text-[10px] text-[#404040] mt-2">
                    Rates updated {timeAgo(ratesUpdatedAt)}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
