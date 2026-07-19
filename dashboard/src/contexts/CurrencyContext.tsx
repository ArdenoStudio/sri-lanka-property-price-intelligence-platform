import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { getExchangeRates } from '../api';
import {
  CURRENCY_SYMBOLS,
  formatFromLkr,
  type CurrencyCode,
  type FormatPriceOptions,
} from '../lib/pricing';

const FALLBACK_RATES: Record<CurrencyCode, number> = {
  LKR: 1.0,
  USD: 0.00306,
  AUD: 0.00471,
  GBP: 0.00242,
  CAD: 0.00417,
};

interface CurrencyContextValue {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  rates: Record<CurrencyCode, number>;
  ratesUpdatedAt: string | null;
  isLoading: boolean;
  convertFromLKR: (lkr: number | null | undefined) => number | null;
  formatConverted: (lkr: number | null | undefined, opts?: FormatPriceOptions) => string;
  symbol: string;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: 'LKR',
  setCurrency: () => {},
  rates: FALLBACK_RATES,
  ratesUpdatedAt: null,
  isLoading: false,
  convertFromLKR: () => null,
  formatConverted: () => '—',
  symbol: 'Rs ',
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>(() => {
    const saved = localStorage.getItem('propertylk_currency');
    return (saved as CurrencyCode) || 'LKR';
  });
  const [rates, setRates] = useState<Record<CurrencyCode, number>>(FALLBACK_RATES);
  const [ratesUpdatedAt, setRatesUpdatedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getExchangeRates()
      .then(data => {
        const r = data.rates as Record<CurrencyCode, number>;
        setRates({
          LKR: 1.0,
          USD: r.USD ?? FALLBACK_RATES.USD,
          AUD: r.AUD ?? FALLBACK_RATES.AUD,
          GBP: r.GBP ?? FALLBACK_RATES.GBP,
          CAD: r.CAD ?? FALLBACK_RATES.CAD,
        });
        setRatesUpdatedAt(data.updated_at);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const setCurrency = useCallback((c: CurrencyCode) => {
    setCurrencyState(c);
    localStorage.setItem('propertylk_currency', c);
  }, []);

  const convertFromLKR = useCallback((lkr: number | null | undefined): number | null => {
    if (lkr == null) return null;
    return lkr * rates[currency];
  }, [rates, currency]);

  const formatConverted = useCallback((
    lkr: number | null | undefined,
    opts?: FormatPriceOptions
  ): string => formatFromLkr(lkr, currency, rates, opts), [rates, currency]);

  const symbol = CURRENCY_SYMBOLS[currency];

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, rates, ratesUpdatedAt, isLoading, convertFromLKR, formatConverted, symbol }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export const useCurrencyContext = () => useContext(CurrencyContext);
