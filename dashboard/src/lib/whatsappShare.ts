/** Build WhatsApp share URLs for Nilam estimate / deal-score cards. */

export function buildWhatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function buildEstimateShareText(opts: {
  medianLabel: string;
  lowLabel?: string;
  highLabel?: string;
  district?: string | null;
  propertyType?: string;
  confidence?: string;
  url: string;
}): string {
  const where = opts.district ? ` in ${opts.district}` : ' across Sri Lanka';
  const range =
    opts.lowLabel && opts.highLabel
      ? `Range: ${opts.lowLabel} – ${opts.highLabel}`
      : null;
  const conf = opts.confidence ? `Confidence: ${opts.confidence}` : null;

  return [
    `Nilam estimate${where}`,
    opts.propertyType ? `Type: ${opts.propertyType}` : null,
    `Median: ${opts.medianLabel}`,
    range,
    conf,
    'Indicative only — not a formal valuation.',
    opts.url,
  ]
    .filter(Boolean)
    .join('\n');
}
