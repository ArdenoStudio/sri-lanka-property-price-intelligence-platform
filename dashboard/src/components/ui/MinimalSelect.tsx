import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export interface SelectOption { value: string; label: string }

export function MinimalSelect({ options, value, onChange, prefix }: {
  options: SelectOption[]; value: string; onChange: (v: string) => void; prefix?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find(o => o.value === value);
  const isActive = selected && selected.value !== '';
  const displayLabel = prefix
    ? `${prefix}${isActive ? ` ${selected?.label}` : ''}`
    : (selected?.label ?? options[0]?.label);

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1 text-[13px] font-medium transition-colors cursor-pointer bg-transparent border-none p-0 ${
          isActive ? 'text-white' : 'text-[#525252] hover:text-[#a3a3a3]'
        }`}>
        {displayLabel}
        <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }} transition={{ duration: 0.13, ease: [0.22, 1, 0.36, 1] }}
            className="absolute z-50 top-full mt-2 left-0 min-w-[160px] max-sm:fixed max-sm:left-4 max-sm:right-4 max-sm:w-auto max-sm:min-w-0 max-sm:bottom-[72px] max-sm:top-auto bg-[#111111] border border-white/[0.1] rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.55)] overflow-hidden">
            {options.map(opt => (
              <button key={opt.value} type="button" onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`relative w-full flex items-center justify-between gap-2 px-4 py-2.5 text-[13px] text-left transition-colors cursor-pointer bg-transparent border-none ${
                  opt.value === value ? 'text-[#14b8a6]' : 'text-[#525252] hover:text-white hover:bg-white/[0.04]'
                }`}>
                <span>{opt.label}</span>
                {opt.value === value && opt.value !== '' && (
                  <svg viewBox="0 0 12 12" className="w-3 h-3 flex-shrink-0 text-[#14b8a6]" fill="none">
                    <polyline points="2,6.5 5,9.5 10,3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
