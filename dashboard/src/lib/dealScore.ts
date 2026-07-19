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
  border: '#64748b24',
  shadow: '0 12px 36px rgba(15, 23, 42, 0.08)',
} as const;

export const DEAL_SCORE_BANDS: DealScoreBand[] = [
  {
    id: 'much-higher',
    min: -100,
    max: -35,
    legendLabel: 'Much higher than similar homes',
    detailLabel: 'Much higher than similar homes',
    description: 'The asking price is well above the usual range for comparable listings.',
    tone: {
      accent: '#c65a43',
      fgDark: '#fdc5b6',
      bgDark: 'rgba(198, 90, 67, 0.14)',
      borderDark: 'rgba(198, 90, 67, 0.28)',
      fgLight: '#8d321d',
      bgLight: '#c65a431c',
      borderLight: '#8d321d2e',
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
      accent: '#c98928',
      fgDark: '#f8d48a',
      bgDark: 'rgba(201, 137, 40, 0.14)',
      borderDark: 'rgba(201, 137, 40, 0.28)',
      fgLight: '#86520e',
      bgLight: '#c989281f',
      borderLight: '#86520e2e',
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
      accent: '#7c8ca3',
      fgDark: '#d8e1ed',
      bgDark: 'rgba(124, 140, 163, 0.12)',
      borderDark: 'rgba(124, 140, 163, 0.24)',
      fgLight: '#526173',
      bgLight: '#7c8ca31c',
      borderLight: '#52617329',
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
      accent: '#168b96',
      fgDark: '#a8edf3',
      bgDark: 'rgba(22, 139, 150, 0.14)',
      borderDark: 'rgba(22, 139, 150, 0.28)',
      fgLight: '#0d5f67',
      bgLight: '#168b961c',
      borderLight: '#0d5f672b',
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
      accent: '#178661',
      fgDark: '#b4f2d8',
      bgDark: 'rgba(23, 134, 97, 0.14)',
      borderDark: 'rgba(23, 134, 97, 0.28)',
      fgLight: '#0f5f43',
      bgLight: '#1786611c',
      borderLight: '#0f5f432b',
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
        accent: band.tone.accent,
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
