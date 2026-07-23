import {
  DEAL_SCORE_LIGHT_SURFACE_TOKENS,
  DEAL_SCORE_BANDS,
  formatBandRange,
  formatSignedScore,
  getDealScoreAriaLabel,
  getDealScoreBand,
  getDealScoreMeta,
  getReadableDelta,
  getSurfaceTone,
  isTypicalDealScore,
  type DealScoreListingType,
  type DealScoreSurface,
} from '../lib/dealScore';

export function DealScorePill({
  score,
  listingType,
  surface = 'dark',
  variant = 'list',
}: {
  score: number | null | undefined;
  listingType?: DealScoreListingType;
  surface?: DealScoreSurface;
  variant?: 'list' | 'compare';
}) {
  if (score == null) return null;

  const meta = getDealScoreMeta(score, listingType);
  const tone = getSurfaceTone(meta.band, surface);
  const isCompare = variant === 'compare';
  const hairline = surface === 'light' ? 'rgba(10, 10, 10, 0.2)' : 'rgba(255, 255, 255, 0.22)';

  return (
    <span
      className={`inline-flex items-center rounded-full border ${
        isCompare
          ? 'gap-1.5 px-2 py-1 text-[10px] font-semibold'
          : 'gap-1.5 px-2.5 py-1 text-[10px] font-semibold'
      }`}
      style={{
        color: tone.fg,
        backgroundColor: 'transparent',
        borderColor: hairline,
        borderWidth: 1,
        fontWeight: 600,
      }}
      aria-label={getDealScoreAriaLabel(score, listingType)}
      title={meta.sentence}
    >
      {isCompare ? (
        <>
          <span className="num">{formatSignedScore(meta.score)}%</span>
          <span>{isTypicalDealScore(meta.score) ? 'Typical' : meta.score > 0 ? 'below' : 'above'}</span>
        </>
      ) : (
        <span className="num">{getReadableDelta(meta.score, listingType)}</span>
      )}
    </span>
  );
}

export function DealScoreMeter({
  score,
  surface = 'dark',
}: {
  score: number;
  surface?: DealScoreSurface;
}) {
  const meta = getDealScoreMeta(score);
  const tone = getSurfaceTone(meta.band, surface);
  const position = ((meta.score + 100) / 200) * 100;
  const labelColor = surface === 'light' ? '#525252' : 'rgba(255, 255, 255, 0.45)';
  const tickIdle = surface === 'light' ? 'rgba(10, 10, 10, 0.1)' : 'rgba(255, 255, 255, 0.12)';
  const tickActive = surface === 'light' ? 'rgba(10, 10, 10, 0.55)' : 'rgba(255, 255, 255, 0.72)';
  const centerLine = surface === 'light' ? 'rgba(10, 10, 10, 0.14)' : 'rgba(255, 255, 255, 0.14)';
  const markerBorder = surface === 'light' ? '#ffffff' : '#0a0a0a';
  const markerFill = surface === 'light' ? '#0a0a0a' : '#ffffff';

  return (
    <div>
      <div className="relative">
        {/* 5-tick mono bar */}
        <div className="grid grid-cols-5 gap-1" aria-hidden="true">
          {DEAL_SCORE_BANDS.map((band) => {
            const isActive = band.id === meta.band.id;
            return (
              <div
                key={band.id}
                className="h-2 rounded-sm border"
                style={{
                  backgroundColor: isActive ? tickActive : 'transparent',
                  borderColor: isActive ? tickActive : tickIdle,
                  borderWidth: 1,
                  opacity: isActive ? 1 : 0.85,
                }}
              />
            );
          })}
        </div>
        <div
          className="absolute top-1/2 h-5 w-px -translate-y-1/2"
          style={{ left: '50%', backgroundColor: centerLine }}
          aria-hidden="true"
        />
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${position}%` }}
          aria-hidden="true"
        >
          <div
            className="h-3 w-3 rounded-full border"
            style={{
              backgroundColor: markerFill,
              borderColor: markerBorder,
              borderWidth: 1,
              boxShadow: `0 0 0 3px ${tone.bg}`,
            }}
          />
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px]" style={{ color: labelColor }}>
        <span>Higher</span>
        <span>Typical</span>
        <span>Lower</span>
      </div>
    </div>
  );
}

export function DealScoreLegend({
  score,
  surface = 'dark',
}: {
  score: number | null | undefined;
  surface?: DealScoreSurface;
}) {
  const activeBand = score != null ? getDealScoreBand(score) : null;
  const headingColor = surface === 'light' ? '#171717' : 'rgba(255, 255, 255, 0.88)';
  const bodyColor = surface === 'light' ? '#525252' : 'rgba(255, 255, 255, 0.45)';
  const defaultBorder = surface === 'light' ? DEAL_SCORE_LIGHT_SURFACE_TOKENS.border : 'rgba(255, 255, 255, 0.1)';
  const defaultBg = 'transparent';
  const activeBorder = surface === 'light' ? 'rgba(10, 10, 10, 0.35)' : 'rgba(255, 255, 255, 0.32)';
  const activeBg = surface === 'light' ? 'rgba(10, 10, 10, 0.03)' : 'rgba(255, 255, 255, 0.04)';

  return (
    <div className="mt-5">
      <p className="text-[11px] uppercase tracking-[0.16em] mb-2" style={{ color: bodyColor }}>
        How to read it
      </p>
      <p className="text-[12px] leading-relaxed" style={{ color: bodyColor }}>
        Positive scores mean the asking price is lower than similar listings. Negative scores mean it is higher. Zero means it is close to the typical range.
      </p>
      <div className="mt-3 space-y-2">
        {DEAL_SCORE_BANDS.map((band) => {
          const tone = getSurfaceTone(band, surface);
          const isActive = activeBand?.id === band.id;
          return (
            <div
              key={band.id}
              className="rounded-xl border px-3 py-2"
              style={{
                borderColor: isActive ? activeBorder : defaultBorder,
                backgroundColor: isActive ? activeBg : defaultBg,
                borderWidth: 1,
              }}
            >
              <div className="flex items-center gap-2">
                <p
                  className="text-[11px]"
                  style={{
                    color: isActive ? tone.fg : headingColor,
                    fontWeight: isActive ? 700 : 500,
                  }}
                >
                  {band.legendLabel}
                </p>
                <span className="ml-auto text-[10px] num" style={{ color: bodyColor, fontWeight: isActive ? 600 : 400 }}>
                  {formatBandRange(band.min, band.max)}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed" style={{ color: bodyColor }}>
                {band.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DealScoreCard({
  score,
  listingType,
  surface = 'dark',
  compact = false,
}: {
  score: number | null | undefined;
  listingType?: DealScoreListingType;
  surface?: DealScoreSurface;
  /** Hero sibling: score + meter + one sentence — legend behind disclosure */
  compact?: boolean;
}) {
  if (score == null) return null;

  const meta = getDealScoreMeta(score, listingType);
  const tone = getSurfaceTone(meta.band, surface);
  const eyebrowColor = surface === 'light' ? '#525252' : 'rgba(255, 255, 255, 0.45)';
  const copyColor = surface === 'light' ? '#404040' : 'rgba(255, 255, 255, 0.55)';

  return (
    <div aria-label={getDealScoreAriaLabel(score, listingType)}>
      <p className="text-[11px] uppercase tracking-[0.16em] mb-3" style={{ color: eyebrowColor }}>
        Deal score
      </p>
      <div className="flex items-end gap-3 flex-wrap mb-2">
        <p
          className={`leading-none font-bold num font-display ${compact ? 'text-[2.75rem]' : 'text-[2.5rem]'}`}
          style={{ color: tone.fg }}
        >
          {formatSignedScore(meta.score)}
          <span className="text-[1rem] align-top">%</span>
        </p>
        <p className="text-[15px] font-semibold pb-1" style={{ color: tone.fg }}>
          {meta.band.detailLabel}
        </p>
      </div>
      <p className="text-[13px] leading-relaxed mb-4 font-body" style={{ color: copyColor }}>
        {meta.sentence}
      </p>
      <DealScoreMeter score={meta.score} surface={surface} />
      {compact ? (
        <details className="mt-5 group">
          <summary className="cursor-pointer list-none text-[11px] uppercase tracking-[0.16em] text-[#737373] hover:text-[#a3a3a3] transition-colors [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-1.5">
              How to read it
              <span className="text-[10px] opacity-60 group-open:rotate-90 transition-transform">›</span>
            </span>
          </summary>
          <DealScoreLegend score={meta.score} surface={surface} />
        </details>
      ) : (
        <DealScoreLegend score={meta.score} surface={surface} />
      )}
    </div>
  );
}
