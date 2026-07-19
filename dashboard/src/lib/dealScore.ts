export type DealScoreSurface = 'dark' | 'light';

export type DealScoreBandId =
  | 'much-higher'
  | 'higher'
  | 'typical'
  | 'lower'
  | 'much-lower';

export interface DealScoreTone {
  accent: string;
  fgDark: string;
  bgDark: string;
  borderDark: string;
  fgLight: string;
  bgLight: string;
  borderLight: string;
}

export interface DealScoreBand {
  id: DealScoreBandId;
  min: number;
  max: number;
  legendLabel: string;
  detailLabel: string;
  description: string;
  tone: DealScoreTone;
}

export const DEAL_SCORE_LIGHT_SURFACE_TOKENS = {
  bg: '#ffffffb8',
  border: '#0a0a0a18',
  shadow: '0 12px 36px rgba(0, 0, 0, 0.08)',
} as const;

/** Strict B&W band inks: much-lower = brightest, typical = mid, much-higher = muted. */
export const DEAL_SCORE_BANDS: DealScoreBand[] = [
  {
    id: 'much-higher',
    min: -100,
    max: -35,
    legendLabel: 'Much higher than similar homes',
    detailLabel: 'Much higher than similar homes',
    description: 'The asking price is well above the usual range for comparable listings.',
    tone: {
      accent: 'rgba(255, 255, 255, 0.38)',
      fgDark: 'rgba(255, 255, 255, 0.42)',
      bgDark: 'rgba(255, 255, 255, 0.03)',
      borderDark: 'rgba(255, 255, 255, 0.12)',
      fgLight: '#737373',
      bgLight: 'rgba(10, 10, 10, 0.03)',
      borderLight: 'rgba(10, 10, 10, 0.12)',
    },
  },
  {
    id: 'higher',
    min: -34,
    max: -10,
    legendLabel: 'A bit higher than similar homes',
    detailLabel: 'A bit higher than similar homes',
    description: 'The asking price is above comparable listings, but not dramatically so.',
    tone: {
      accent: 'rgba(255, 255, 255, 0.52)',
      fgDark: 'rgba(255, 255, 255, 0.58)',
      bgDark: 'rgba(255, 255, 255, 0.045)',
      borderDark: 'rgba(255, 255, 255, 0.16)',
      fgLight: '#525252',
      bgLight: 'rgba(10, 10, 10, 0.04)',
      borderLight: 'rgba(10, 10, 10, 0.16)',
    },
  },
  {
    id: 'typical',
    min: -9,
    max: 9,
    legendLabel: 'Close to the usual range',
    detailLabel: 'Close to the usual range',
    description: 'The asking price is roughly in line with similar listings.',
    tone: {
      accent: 'rgba(255, 255, 255, 0.68)',
      fgDark: 'rgba(255, 255, 255, 0.72)',
      bgDark: 'rgba(255, 255, 255, 0.06)',
      borderDark: 'rgba(255, 255, 255, 0.2)',
      fgLight: '#404040',
      bgLight: 'rgba(10, 10, 10, 0.05)',
      borderLight: 'rgba(10, 10, 10, 0.2)',
    },
  },
  {
    id: 'lower',
    min: 10,
    max: 34,
    legendLabel: 'A bit lower than similar homes',
    detailLabel: 'A bit lower than similar homes',
    description: 'The asking price is below comparable listings without being unusually low.',
    tone: {
      accent: 'rgba(255, 255, 255, 0.84)',
      fgDark: 'rgba(255, 255, 255, 0.88)',
      bgDark: 'rgba(255, 255, 255, 0.08)',
      borderDark: 'rgba(255, 255, 255, 0.28)',
      fgLight: '#262626',
      bgLight: 'rgba(10, 10, 10, 0.06)',
      borderLight: 'rgba(10, 10, 10, 0.28)',
    },
  },
  {
    id: 'much-lower',
    min: 35,
    max: 100,
    legendLabel: 'Much lower than similar homes',
    detailLabel: 'Much lower than similar homes',
    description: 'The asking price is well below the usual range for comparable listings.',
    tone: {
      accent: '#ffffff',
      fgDark: '#ffffff',
      bgDark: 'rgba(255, 255, 255, 0.1)',
      borderDark: 'rgba(255, 255, 255, 0.36)',
      fgLight: '#0a0a0a',
      bgLight: 'rgba(10, 10, 10, 0.07)',
      borderLight: 'rgba(10, 10, 10, 0.36)',
    },
  },
];

export function clampDealScore(score: number): number {
  return Math.max(-100, Math.min(100, score));
}

export function formatSignedScore(score: number): string {
  const rounded = Math.round(clampDealScore(score));
  return `${rounded > 0 ? '+' : ''}${rounded}`;
}

export function formatBandRange(min: number, max: number): string {
  const start = `${min > 0 ? '+' : ''}${min}`;
  const end = `${max > 0 ? '+' : ''}${max}`;
  return `${start} to ${end}`;
}

export function isTypicalDealScore(score: number): boolean {
  return getDealScoreBand(score).id === 'typical';
}

export function getReadableDelta(score: number): string {
  const rounded = Math.abs(Math.round(clampDealScore(score)));
  if (isTypicalDealScore(score)) return 'Typical range';
  return score > 0 ? `${rounded}% below similar` : `${rounded}% above similar`;
}

export function getDetailSentence(score: number): string {
  const rounded = Math.abs(Math.round(clampDealScore(score)));
  if (isTypicalDealScore(score)) {
    return 'This asking price is close to the usual range for similar property.lk listings.';
  }
  return score > 0
    ? `This asking price is about ${rounded}% below similar property.lk listings.`
    : `This asking price is about ${rounded}% above similar property.lk listings.`;
}

export function getSurfaceTone(band: DealScoreBand, surface: DealScoreSurface) {
  return surface === 'light'
    ? {
        accent: band.tone.fgLight,
        fg: band.tone.fgLight,
        bg: band.tone.bgLight,
        border: band.tone.borderLight,
      }
    : {
        accent: band.tone.accent,
        fg: band.tone.fgDark,
        bg: band.tone.bgDark,
        border: band.tone.borderDark,
      };
}

export function getDealScoreBand(score: number): DealScoreBand {
  const clamped = clampDealScore(score);
  return DEAL_SCORE_BANDS.find((band) => clamped >= band.min && clamped <= band.max) ?? DEAL_SCORE_BANDS[2];
}

export function getDealScoreAriaLabel(score: number): string {
  const band = getDealScoreBand(score);
  return `Deal score ${formatSignedScore(score)}. ${band.detailLabel}. ${getDetailSentence(score)}`;
}

export function getDealScoreMeta(score: number) {
  const clamped = clampDealScore(score);
  const band = getDealScoreBand(clamped);
  return {
    score: clamped,
    band,
    shortCopy: getReadableDelta(clamped),
    sentence: getDetailSentence(clamped),
  };
}
