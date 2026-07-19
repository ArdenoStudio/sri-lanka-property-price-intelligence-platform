export interface BankRate {
  bank: string;
  shortName: string;
  minRate: number;
  maxRate: number;
  defaultRate: number;
}

export const SL_BANK_RATES: BankRate[] = [
  { bank: 'Hatton National Bank (HNB)',   shortName: 'HNB',      minRate: 11.5, maxRate: 14.5, defaultRate: 12.5 },
  { bank: 'Sampath Bank',                  shortName: 'Sampath',  minRate: 11.0, maxRate: 14.0, defaultRate: 12.0 },
  { bank: 'Commercial Bank of Ceylon',     shortName: 'ComBank',  minRate: 11.5, maxRate: 14.5, defaultRate: 12.5 },
  { bank: 'Bank of Ceylon',                shortName: 'BOC',      minRate: 10.5, maxRate: 13.5, defaultRate: 11.5 },
  { bank: "People's Bank",                 shortName: "People's", minRate: 10.5, maxRate: 13.5, defaultRate: 11.5 },
  { bank: 'DFCC Bank',                     shortName: 'DFCC',     minRate: 12.0, maxRate: 15.0, defaultRate: 13.0 },
  { bank: 'NDB Bank',                      shortName: 'NDB',      minRate: 12.5, maxRate: 15.5, defaultRate: 13.5 },
];

export const TENURE_OPTIONS = [5, 10, 15, 20, 25, 30];
export const DOWN_PAYMENT_PRESETS = [10, 15, 20, 25, 30];
export const NILAM_DEFAULT_DOWN_PAYMENT_PCT = 20;
export const NILAM_DEFAULT_TENURE_YEARS = 20;

// Last manually verified: 2026-04 (update when CBSL rate changes significantly)
export const RATES_LAST_UPDATED = '2026-04';

export const FEATURED_BANK_RATE = SL_BANK_RATES.reduce((best, current) =>
  current.defaultRate < best.defaultRate ? current : best
);

export function getBankRate(shortName: string | null | undefined): BankRate {
  return SL_BANK_RATES.find(bank => bank.shortName === shortName) ?? FEATURED_BANK_RATE;
}

export function getLoanPrincipal(priceLkr: number, downPaymentPct: number): number {
  return priceLkr * (1 - downPaymentPct / 100);
}

export function getDownPaymentAmount(priceLkr: number, downPaymentPct: number): number {
  return priceLkr * (downPaymentPct / 100);
}

export function calculateEMI(principal: number, annualRatePct: number, tenureYears: number): number {
  const r = annualRatePct / 100 / 12;
  const n = tenureYears * 12;
  if (r === 0) return principal / n;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

export function getMortgageSnapshot(
  priceLkr: number,
  {
    downPaymentPct = NILAM_DEFAULT_DOWN_PAYMENT_PCT,
    annualRatePct = FEATURED_BANK_RATE.defaultRate,
    tenureYears = NILAM_DEFAULT_TENURE_YEARS,
  }: {
    downPaymentPct?: number;
    annualRatePct?: number;
    tenureYears?: number;
  } = {}
) {
  const principal = getLoanPrincipal(priceLkr, downPaymentPct);
  const downPayment = getDownPaymentAmount(priceLkr, downPaymentPct);
  const emi = calculateEMI(principal, annualRatePct, tenureYears);
  const totalPayment = emi * tenureYears * 12;
  const totalInterest = totalPayment - principal;

  return {
    principal,
    downPayment,
    emi,
    totalPayment,
    totalInterest,
  };
}
