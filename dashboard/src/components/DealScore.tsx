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
  type DealScoreSurface,
} from '../lib/dealScore';

export function DealScorePill({
  score,
  surface = 'dark',
  variant = 'list',
}: {
  score: number | null | undefined;
  surface?: DealScoreSurface;
  variant?: 'list' | 'compare';
}) {
  if (score == null) return null;

  const meta = getDealScoreMeta(score);
  const tone = getSurfaceTone(meta.band, surface);
  const isCompare = variant === 'compare';

  return (
    <span
      className={`inline-flex items-center rounded-full border ${
        isCompare
          ? 'gap-1.5 px-2 py-1 text-[10px] font-semibold'
          : 'gap-1.5 px-2.5 py-1 text-[10px] font-semibold'
      }`}
      style={{
        color: tone.fg,
        backgroundColor: tone.bg,
        borderColor: tone.border,
      }}
      aria-label={getDealScoreAriaLabel(score)}
      title={meta.sentence}
    >
      <span
        className="h-1.5 w-1.5 rounded-full shrink-0"
        style={{ backgroundColor: tone.accent }}
        aria-hidden="true"
      />
      {isCompare ? (
        <>
          <span className="num">{formatSignedScore(meta.score)}%</span>
          <span>{isTypicalDealScore(meta.score) ? 'Typical' : meta.score > 0 ? 'below' : 'above'}</span>
        </>
      ) : (
        <span className="num">{getReadableDelta(meta.score)}</span>
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
  const labelColor = surface === 'light' ? '#64748b' : '#737373';
  const markerBorder = surface === 'light' ? 'rgba(255, 255, 255, 0.96)' : '#111111';

  return (
    <div>
      <div className="relative">
        <div className="grid grid-cols-5 gap-1">
          {DEAL_SCORE_BANDS.map((band) => {
            const bandTone = getSurfaceTone(band, surface);
            const isActive = band.id === meta.band.id;
            return (
              <div
                key={band.id}
                className="h-2 rounded-full"
                style={{
                  backgroundColor: bandTone.bg,
                  boxShadow: isActive ? `inset 0 0 0 1px ${bandTone.border}` : undefined,
                }}
              />
            );
          })}
        </div>
        <div
          className="absolute top-1/2 h-5 w-px -translate-y-1/2"
          style={{ left: '50%', backgroundColor: surface === 'light' ? 'rgba(82, 97, 115, 0.18)' : 'rgba(255, 255, 255, 0.12)' }}
          aria-hidden="true"
        />
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${position}%` }}
          aria-hidden="true"
        >
          <div
            className="h-3.5 w-3.5 rounded-full border-2"
            style={{
              backgroundColor: tone.accent,
              borderColor: markerBorder,
              boxShadow: `0 0 0 4px ${tone.bg}`,
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
  const headingColor = surface === 'light' ? '#334155' : '#f5f5f5';
  const bodyColor = surface === 'light' ? '#64748b' : '#737373';
  const defaultBorder = surface === 'light' ? DEAL_SCORE_LIGHT_SURFACE_TOKENS.border : 'rgba(255, 255, 255, 0.08)';
  const defaultBg = surface === 'light' ? DEAL_SCORE_LIGHT_SURFACE_TOKENS.bg : 'rgba(255, 255, 255, 0.02)';

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
                borderColor: isActive ? tone.border : defaultBorder,
                backgroundColor: isActive ? tone.bg : defaultBg,
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: tone.accent }}
                  aria-hidden="true"
                />
                <p className="text-[11px] font-semibold" style={{ color: isActive ? tone.fg : headingColor }}>
                  {band.legendLabel}
                </p>
                <span className="ml-auto text-[10px] num" style={{ color: bodyColor }}>
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
  surface = 'dark',
}: {
  score: number | null | undefined;
  surface?: DealScoreSurface;
}) {
  if (score == null) return null;

  const meta = getDealScoreMeta(score);
  const tone = getSurfaceTone(meta.band, surface);
  const eyebrowColor = surface === 'light' ? '#64748b' : '#737373';
  const copyColor = surface === 'light' ? '#475569' : '#a3a3a3';

  return (
    <div aria-label={getDealScoreAriaLabel(score)}>
      <p className="text-[11px] uppercase tracking-[0.16em] mb-3" style={{ color: eyebrowColor }}>
        Deal score
      </p>
      <div className="flex items-end gap-3 flex-wrap mb-2">
        <p className="text-[2.5rem] leading-none font-bold num" style={{ color: tone.fg }}>
          {formatSignedScore(meta.score)}
          <span className="text-[1rem] align-top">%</span>
        </p>
        <p className="text-[15px] font-semibold" style={{ color: tone.fg }}>
          {meta.band.detailLabel}
        </p>
      </div>
      <p className="text-[13px] leading-relaxed mb-4" style={{ color: copyColor }}>
        {meta.sentence}
      </p>
      <DealScoreMeter score={meta.score} surface={surface} />
      <DealScoreLegend score={meta.score} surface={surface} />
    </div>
  );
}
