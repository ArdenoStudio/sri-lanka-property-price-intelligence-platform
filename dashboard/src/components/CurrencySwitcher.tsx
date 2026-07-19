import { useEffect, useId, useRef, useState } from 'react';
import { Globe, Check } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCurrency } from '../hooks/useCurrency';
import type { CurrencyCode } from '../lib/pricing';

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

interface CurrencySwitcherProps {
  variant?: 'header' | 'toolbar';
}

export function CurrencySwitcher({ variant = 'header' }: CurrencySwitcherProps) {
  const { currency, setCurrency, ratesUpdatedAt } = useCurrency();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const isHeader = variant === 'header';

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const triggerClassName = open
    ? `inline-flex items-center gap-1.5 ${isHeader ? 'rounded-md' : 'rounded-full'} border border-white bg-white px-3 py-1.5 text-[12px] text-black transition-colors`
    : `inline-flex items-center gap-1.5 ${isHeader ? 'rounded-md' : 'rounded-full'} border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[12px] text-[#a3a3a3] transition-colors hover:bg-white/[0.06] hover:text-white`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`${triggerClassName} cursor-pointer`}
        aria-label="Switch currency"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
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
            <div
              id={menuId}
              role="menu"
              aria-label="Currency options"
              className="bg-[#111111] border border-white/[0.1] rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.8)] overflow-hidden"
            >
              <div className="py-1.5">
                {CURRENCIES.map(({ code, label }) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => { setCurrency(code); setOpen(false); }}
                    className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-white/[0.05] transition-colors cursor-pointer bg-transparent border-none"
                  >
                    <span className={`text-[13px] ${currency === code ? 'text-white font-medium' : 'text-[#a3a3a3]'}`}>
                      {label}
                    </span>
                    {currency === code && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                  </button>
                ))}
              </div>

              <div className="border-t border-white/[0.06] px-4 py-3">
                <p className="text-[11px] font-semibold text-[#737373] mb-1">IIA — Inward Investment Account</p>
                <p className="text-[10px] text-[#525252] leading-relaxed">
                  Overseas Sri Lankans can repatriate property investment proceeds via an IIA at any licensed commercial bank (CBSL regulation).
                </p>
                <p className="text-[10px] text-[#404040] mt-2">
                  {ratesUpdatedAt
                    ? `Rates updated ${timeAgo(ratesUpdatedAt)}`
                    : 'Using estimated rates'}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
