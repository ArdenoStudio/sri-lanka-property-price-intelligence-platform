export const SUPPORTED_CURRENCIES = ['LKR', 'USD', 'AUD', 'GBP', 'CAD'] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  LKR: 'Rs ',
  USD: '$',
  AUD: 'A$',
  GBP: '£',
  CAD: 'C$',
};

export type PriceFormatVariant = 'default' | 'hero' | 'table' | 'axis';

export interface FormatPriceOptions {
  variant?: PriceFormatVariant;
  compact?: boolean;
  fallback?: string;
  showCurrency?: boolean;
  lkrLabel?: 'symbol' | 'code';
}

export interface ResolvedPriceDisplay {
  text: string;
  suffix: string;
  source: 'price_lkr' | 'price_per_perch' | 'raw' | 'missing';
}

interface Scale {
  divisor: number;
  suffix: string;
}

function trimTrailingZeros(value: string): string {
  return value.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
}

function getCompactScale(amount: number, currency: CurrencyCode): Scale | null {
  if (currency === 'LKR') {
    if (amount >= 1_000_000_000) return { divisor: 1_000_000_000, suffix: 'Bn' };
    if (amount >= 1_000_000) return { divisor: 1_000_000, suffix: 'Mn' };
  }

  if (amount >= 1_000_000_000) return { divisor: 1_000_000_000, suffix: 'B' };
  if (amount >= 1_000_000) return { divisor: 1_000_000, suffix: 'M' };
  if (amount >= 1_000) return { divisor: 1_000, suffix: 'K' };

  return null;
}

function getScaledPrecision(value: number, variant: PriceFormatVariant, suffix: string): number {
  if (suffix === 'K') {
    return value >= 100 ? 0 : 1;
  }

  if (variant === 'axis') {
    return value >= 10 ? 0 : 1;
  }

  if (value >= 100) return 0;
  if (value >= 10) return 1;

  return variant === 'hero' ? 1 : 2;
}

function getPrefix(currency: CurrencyCode, lkrLabel: 'symbol' | 'code'): string {
  if (currency === 'LKR') return lkrLabel === 'code' ? 'LKR ' : 'Rs ';
  return CURRENCY_SYMBOLS[currency];
}

export function formatCurrencyAmount(
  amount: number | null | undefined,
  currency: CurrencyCode,
  options: FormatPriceOptions = {}
): string {
  const {
    variant = 'default',
    compact = true,
    fallback = '—',
    showCurrency = true,
    lkrLabel = 'symbol',
  } = options;

  if (amount == null || Number.isNaN(amount)) return fallback;

  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  const prefix = showCurrency ? getPrefix(currency, lkrLabel) : '';

  if (compact) {
    const scale = getCompactScale(abs, currency);
    if (scale) {
      const scaled = abs / scale.divisor;
      const precision = getScaledPrecision(scaled, variant, scale.suffix);
      return `${sign}${prefix}${trimTrailingZeros(scaled.toFixed(precision))}${scale.suffix}`;
    }
  }

  const fractionDigits = currency === 'LKR' || abs >= 1 ? 0 : 2;
  return `${sign}${prefix}${abs.toLocaleString('en-LK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  })}`;
}

export function formatFromLkr(
  lkrAmount: number | null | undefined,
  currency: CurrencyCode,
  rates: Partial<Record<CurrencyCode, number>>,
  options: FormatPriceOptions = {}
): string {
  if (lkrAmount == null || Number.isNaN(lkrAmount)) return options.fallback ?? '—';

  const converted = currency === 'LKR'
    ? lkrAmount
    : lkrAmount * (rates[currency] ?? 1);

  return formatCurrencyAmount(converted, currency, options);
}

export function resolveListingPrice({
  priceLkr,
  pricePerPerch,
  rawPrice,
  currency,
  rates,
  formatOptions,
  emptyText = '—',
}: {
  priceLkr: number | null | undefined;
  pricePerPerch: number | null | undefined;
  rawPrice?: string | null;
  currency: CurrencyCode;
  rates: Partial<Record<CurrencyCode, number>>;
  formatOptions?: FormatPriceOptions;
  emptyText?: string;
}): ResolvedPriceDisplay {
  if (priceLkr != null) {
    return {
      text: formatFromLkr(priceLkr, currency, rates, formatOptions),
      suffix: '',
      source: 'price_lkr',
    };
  }

  if (pricePerPerch != null) {
    return {
      text: formatFromLkr(pricePerPerch, currency, rates, formatOptions),
      suffix: '/ perch',
      source: 'price_per_perch',
    };
  }

  if (rawPrice) {
    return {
      text: rawPrice,
      suffix: '',
      source: 'raw',
    };
  }

  return {
    text: emptyText,
    suffix: '',
    source: 'missing',
  };
}
