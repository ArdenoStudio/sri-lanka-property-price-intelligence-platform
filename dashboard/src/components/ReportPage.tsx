import '@fontsource/cal-sans';
import '@fontsource-variable/source-serif-4';
import { useEffect, useId, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, Copy, Download, Share2 } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import { getEstimate } from '../api';
import type { EstimateResult, SimilarListing } from '../api';
import { formatCurrencyAmount } from '../lib/pricing';

function formatLKR(n: number | null | undefined): string {
  return formatCurrencyAmount(n, 'LKR', { variant: 'hero', lkrLabel: 'code' });
}

function formatAxisPrice(n: number): string {
  return formatCurrencyAmount(n, 'LKR', { variant: 'axis', showCurrency: false });
}

const REPORT_TITLE_FONT = '"Cal Sans", "Source Serif 4 Variable", Georgia, serif';
const REPORT_BODY_FONT = '"Source Serif 4 Variable", Georgia, "Times New Roman", serif';

function titleCase(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getLocationLabel(listing: SimilarListing): string {
  return listing.city || listing.raw_location || listing.district || 'Unknown locality';
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
  }
  return sorted[middle];
}

function ReportStat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="border border-black/20 px-4 py-3">
      <p className="mb-2 text-[10px] uppercase tracking-[0.22em] text-black/45">{label}</p>
      <p
        className="text-[1.1rem] leading-none text-black"
        style={{ fontFamily: REPORT_TITLE_FONT }}
      >
        {value}
      </p>
      {note ? <p className="mt-2 text-[11px] leading-5 text-black/55">{note}</p> : null}
    </div>
  );
}

export function ReportPage() {
  const [params] = useSearchParams();
  const hasReportParameters = ['district', 'type', 'listing_type', 'size_perches', 'size_sqft', 'bedrooms']
    .some((key) => params.has(key));
  const [result, setResult] = useState<EstimateResult | null>(null);
  const [loading, setLoading] = useState(hasReportParameters);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  const district = params.get('district') || '';
  const propertyType = params.get('type') || 'house';
  const listingType = (params.get('listing_type') || 'sale') as 'sale' | 'rent';
  const sizePerches = params.get('size_perches') ? Number(params.get('size_perches')) : undefined;
  const sizeSqft = params.get('size_sqft') ? Number(params.get('size_sqft')) : undefined;
  const bedrooms = params.get('bedrooms') ? Number(params.get('bedrooms')) : undefined;

  const reportId = useId();
  const refId = `PMI-${reportId.replace(/:/g, '').toUpperCase().slice(-6)}`;
  const today = useMemo(
    () => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()),
    [],
  );

  const propertyLabel = titleCase(propertyType);
  const districtLabel = district ? `${district} District` : 'Sri Lanka';
  const reportTitle = hasReportParameters
    ? `${propertyLabel} ${listingType === 'sale' ? 'market report' : 'rental report'} — ${districtLabel}`
    : 'property.lk Report Studio';
  const shareTitle = `${propertyLabel} intelligence report — ${districtLabel}`;
  const shareText = `Market-reference report for a ${propertyLabel.toLowerCase()} ${listingType === 'sale' ? 'purchase' : 'rental'} in ${districtLabel}.`;
  const hasNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    document.title = reportTitle;
  }, [reportTitle]);

  useEffect(() => {
    if (!hasReportParameters) return;
    let cancelled = false;

    getEstimate({
      district: district || undefined,
      property_type: propertyType,
      listing_type: listingType,
      size_perches: sizePerches,
      size_sqft: sizeSqft,
      bedrooms,
    })
      .then(res => {
        if (cancelled) return;
        setError(false);
        setResult(res);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [bedrooms, district, hasReportParameters, listingType, propertyType, sizePerches, sizeSqft]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const shareReport = async () => {
    if (!hasNativeShare) {
      await copyLink();
      return;
    }

    try {
      await navigator.share({
        title: shareTitle,
        text: shareText,
        url: window.location.href,
      });
    } catch {
      // Ignore cancelled shares.
    }
  };

  if (!hasReportParameters) {
    return (
      <div className="min-h-screen bg-[#0b0b0b] text-white">
        <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16 lg:px-8">
          <Link
            to="/"
            className="w-fit text-left no-underline"
            aria-label="Back to property.lk home"
          >
            <span className="brand-wordmark block text-[2rem] leading-none text-white">property.lk</span>
            <span className="mt-1 block text-[11px] uppercase tracking-[0.24em] text-[#737373]">
              Report Studio
            </span>
          </Link>

          <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.9fr)] lg:items-end">
            <div>
              <p className="mb-4 text-[11px] uppercase tracking-[0.28em] text-[#a3a3a3]">
                Printable market reference
              </p>
              <h1
                className="max-w-3xl text-[clamp(2.4rem,6vw,4.8rem)] leading-[0.95] text-white"
                style={{ fontFamily: REPORT_TITLE_FONT }}
              >
                Generate a polished property report from a live property.lk estimate.
              </h1>
              <p className="mt-5 max-w-2xl text-[15px] leading-7 text-[#8a8a8a]">
                Reports are built from the estimate workflow so district, size, and bedroom filters can
                tailor the comparable set before export.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/estimate"
                  className="inline-flex items-center justify-center rounded-none bg-white px-6 py-3 text-[14px] font-medium text-black no-underline transition-colors hover:bg-[#e8e8e8]"
                >
                  Start with an estimate
                </Link>
                <a
                  href="/#about"
                  className="inline-flex items-center justify-center rounded-none border border-white/[0.12] bg-white/[0.03] px-6 py-3 text-[14px] font-medium text-white no-underline transition-colors hover:bg-white/[0.06]"
                >
                  Learn about property.lk
                </a>
              </div>
            </div>

            <div className="border border-white/[0.12] bg-[#111111] p-6">
              <p className="text-[11px] uppercase tracking-[0.24em] text-[#737373]">Inside the report</p>
              <div className="mt-5 space-y-3">
                {[
                  'Median, low, and high price ranges from matched listings.',
                  'Comparable property snapshots and confidence context.',
                  'A clean PDF-ready format for sharing with clients or partners.',
                ].map((detail, index) => (
                  <div
                    key={detail}
                    className="flex items-start gap-3 border border-white/[0.08] bg-white/[0.02] px-4 py-4"
                  >
                    <span className="brand-wordmark mt-0.5 text-[1.15rem] leading-none text-white">
                      0{index + 1}
                    </span>
                    <p className="text-[13px] leading-6 text-[#c9c9c9]">{detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="border border-black/15 px-8 py-7 text-center">
          <p className="text-[10px] uppercase tracking-[0.32em] text-black/45 mb-3">Preparing report</p>
          <p
            className="text-[1.8rem] text-black"
            style={{ fontFamily: REPORT_TITLE_FONT }}
          >
            Generating market reference...
          </p>
        </div>
      </div>
    );
  }

  if (error || !result || result.comparable_count === 0) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="max-w-lg border border-black/15 px-8 py-8 text-center">
          <p className="mb-3 text-[10px] uppercase tracking-[0.32em] text-black/45">Report unavailable</p>
          <p
            className="mb-3 text-[1.8rem] leading-tight text-black"
            style={{ fontFamily: REPORT_TITLE_FONT }}
          >
            No strong comparable set was found for these parameters.
          </p>
          <p className="mb-6 text-[14px] leading-6 text-black/55">
            Try broadening the district or removing one of the tighter property filters before generating the report again.
          </p>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 border border-black bg-black px-5 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-black/85 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to estimate
          </button>
        </div>
      </div>
    );
  }

  const subjectParts = [
    `${propertyLabel} ${listingType === 'sale' ? 'for sale' : 'for rent'}`,
    district ? `in ${districtLabel}` : 'across Sri Lanka',
    sizePerches ? `${sizePerches} perches` : '',
    sizeSqft ? `${sizeSqft.toLocaleString()} sqft` : '',
    bedrooms ? `${bedrooms} bedroom${bedrooms !== 1 ? 's' : ''}` : '',
  ].filter(Boolean);

  const visibleComparables = result.comparables.slice(0, 6);
  const uniqueLocalities = new Set(result.comparables.map(getLocationLabel)).size;
  const averageMatch =
    result.average_similarity_score ??
    (result.comparables
      .map(listing => listing.similarity_score)
      .filter((score): score is number => score != null)
      .reduce((sum, score, _index, scores) => sum + score / scores.length, 0) || null);
  const medianDaysListed = median(
    result.comparables
      .map(listing => listing.days_on_market)
      .filter((days): days is number => days != null),
  );
  const priceSpread =
    result.estimated_low != null && result.estimated_high != null
      ? result.estimated_high - result.estimated_low
      : null;
  const unitRate =
    sizePerches && result.median_price_per_perch
      ? { label: 'Typical asking rate', value: formatLKR(result.median_price_per_perch), note: 'Per perch in the matched district set' }
      : sizeSqft && result.median_price_per_sqft
        ? { label: 'Typical asking rate', value: formatLKR(result.median_price_per_sqft), note: 'Per sqft in the matched district set' }
        : result.median_price_per_perch
          ? { label: 'Typical asking rate', value: formatLKR(result.median_price_per_perch), note: 'Per perch in the matched district set' }
          : result.median_price_per_sqft
            ? { label: 'Typical asking rate', value: formatLKR(result.median_price_per_sqft), note: 'Per sqft in the matched district set' }
            : null;

  const chartData = visibleComparables
    .filter(listing => listing.price_lkr != null)
    .map((listing, index) => ({
      id: listing.id,
      label: `${index + 1}. ${getLocationLabel(listing)}`,
      price: listing.price_lkr as number,
      similarity: listing.similarity_score,
    }));

  return (
    <>
      <style>{`
        @page {
          size: A4;
          margin: 12mm 11mm;
        }

        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

          html, body {
            background: #ffffff !important;
            color: #000000 !important;
          }

          .print-hide {
            display: none !important;
          }

          .report-stage {
            background: #ffffff !important;
            padding: 0 !important;
          }

          .report-sheet {
            margin: 0 !important;
            max-width: none !important;
            border: 0 !important;
            box-shadow: none !important;
            background: #ffffff !important;
            color: #000000 !important;
          }

          .print-ink {
            color: #000000 !important;
            border-color: #000000 !important;
            background: #ffffff !important;
          }

          .print-break-inside-avoid {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .report-table-row {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          a {
            color: #000000 !important;
            text-decoration: none !important;
          }
        }
      `}</style>

      <div
        className="report-stage min-h-screen bg-[#f3f3f3] px-4 py-6 sm:px-6 sm:py-8"
        style={{ fontFamily: REPORT_BODY_FONT }}
      >
        <div className="print-hide fixed right-4 top-4 z-50 flex flex-wrap justify-end gap-2 sm:right-6 sm:top-6">
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 border border-black/20 bg-white px-4 py-2 text-[12px] font-medium text-black cursor-pointer transition-colors hover:bg-black/[0.04]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
          <button
            onClick={copyLink}
            className="inline-flex items-center gap-2 border border-black/20 bg-white px-4 py-2 text-[12px] font-medium text-black cursor-pointer transition-colors hover:bg-black/[0.04]"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy link'}
          </button>
          <button
            onClick={shareReport}
            className="inline-flex items-center gap-2 border border-black/20 bg-white px-4 py-2 text-[12px] font-medium text-black cursor-pointer transition-colors hover:bg-black/[0.04]"
          >
            <Share2 className="h-3.5 w-3.5" />
            {hasNativeShare ? 'Share' : 'Shareable link'}
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 border border-black bg-black px-4 py-2 text-[12px] font-medium text-white cursor-pointer transition-colors hover:bg-black/85"
          >
            <Download className="h-3.5 w-3.5" />
            Save PDF
          </button>
        </div>

        <article className="report-sheet print-ink mx-auto max-w-[920px] border border-black/15 bg-white px-6 py-7 text-black sm:px-10 sm:py-10">
          <header className="print-break-inside-avoid mb-8 border-b border-black pb-8">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="brand-wordmark mb-3 text-[1.65rem] leading-none text-black">property.lk</p>
                <p className="mb-2 text-[10px] uppercase tracking-[0.28em] text-black/45">
                  Shareable market reference · B&amp;W print
                </p>
                <h1
                  className="max-w-3xl text-[2.1rem] leading-[1.05] text-black sm:text-[2.85rem]"
                  style={{ fontFamily: REPORT_TITLE_FONT }}
                >
                  Property Market Intelligence Report
                </h1>
              </div>
              <div className="border border-black px-4 py-3 text-right">
                <p className="text-[10px] uppercase tracking-[0.22em] text-black/45">Reference</p>
                <p className="mt-1 text-[13px] font-semibold text-black">{refId}</p>
                <p className="mt-2 text-[11px] text-black/55">{today}</p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <p className="mb-3 text-[11px] uppercase tracking-[0.22em] text-black/45">Subject brief</p>
                <p className="max-w-2xl text-[15px] leading-7 text-black/80">
                  {subjectParts.join(' · ')}
                </p>
                <p className="mt-4 max-w-2xl text-[14px] leading-7 text-black/60">
                  Designed for early-stage conveyancing and diaspora purchase conversations: concise enough to share, specific enough to anchor a professional discussion, and clearly bounded as a market-reference document rather than a statutory valuation.
                </p>
              </div>

              <div className="border border-black px-5 py-5">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-black/45">
                      {listingType === 'rent' ? 'Estimated monthly rent' : 'Estimated asking range'}
                    </p>
                    <p className="mt-2 text-[12px] leading-6 text-black/55">
                      Based on {result.comparable_count} matched listing{result.comparable_count !== 1 ? 's' : ''} in {districtLabel}.
                    </p>
                  </div>
                  <span className="border border-black px-3 py-1 text-[11px] font-semibold capitalize text-black">
                    {result.confidence} confidence
                  </span>
                </div>

                <p
                  className="mt-6 text-[2.2rem] leading-none text-black sm:text-[2.7rem]"
                  style={{ fontFamily: REPORT_TITLE_FONT }}
                >
                  {formatLKR(result.estimated_median)}
                </p>
                <p className="mt-2 text-[13px] leading-6 text-black/60">
                  Working midpoint, framed by a reference band from {formatLKR(result.estimated_low)} to {formatLKR(result.estimated_high)}.
                </p>
                {result.confidence_reason ? (
                  <p className="mt-5 border-t border-black/20 pt-4 text-[12px] leading-6 text-black/60">
                    {result.confidence_reason}
                  </p>
                ) : null}
              </div>
            </div>
          </header>

          <section className="print-break-inside-avoid mb-8 grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
            <div className="border border-black/20 px-5 py-5">
              <p className="mb-2 text-[10px] uppercase tracking-[0.24em] text-black/45">District snapshot</p>
              <h2
                className="text-[1.7rem] leading-tight text-black"
                style={{ fontFamily: REPORT_TITLE_FONT }}
              >
                What the matched district set is signalling
              </h2>
              <p className="mt-3 text-[13px] leading-6 text-black/60">
                A quick scan of the local market context behind the estimate, derived from the comparable set used for this report.
              </p>

              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <ReportStat
                  label="Listings matched"
                  value={String(result.comparable_count)}
                  note={`Sample coverage across ${uniqueLocalities} localit${uniqueLocalities === 1 ? 'y' : 'ies'}`}
                />
                <ReportStat
                  label="Typical exposure"
                  value={medianDaysListed != null ? `${medianDaysListed} days` : '—'}
                  note="Median time on market among the displayed comparables"
                />
                <ReportStat
                  label="Average match"
                  value={averageMatch != null ? `${averageMatch.toFixed(0)}%` : '—'}
                  note="Similarity score for the ranked comparable set"
                />
                <ReportStat
                  label={unitRate?.label || 'Price spread'}
                  value={unitRate?.value || formatLKR(priceSpread)}
                  note={unitRate?.note || 'Difference between lower and upper estimate bounds'}
                />
              </div>

              <div className="mt-6 border border-black/20 px-4 py-4">
                <p className="text-[10px] uppercase tracking-[0.22em] text-black/45">Recommended use</p>
                <p className="mt-2 text-[12px] leading-6 text-black/60">
                  Best used to orient price expectations, inform client conversations, and decide whether a formal valuation or further due diligence should follow.
                </p>
              </div>
            </div>

            <div className="print-break-inside-avoid border border-black/20 px-5 py-5">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="mb-2 text-[10px] uppercase tracking-[0.24em] text-black/45">Chart</p>
                  <h2
                    className="text-[1.7rem] leading-tight text-black"
                    style={{ fontFamily: REPORT_TITLE_FONT }}
                  >
                    Comparable price position
                  </h2>
                </div>
                <p className="max-w-xs text-right text-[11px] leading-5 text-black/50">
                  Shaded band = estimated range. Solid guide = midpoint.
                </p>
              </div>

              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid stroke="#d4d4d4" strokeDasharray="3 3" horizontal={false} />
                    <ReferenceArea
                      x1={result.estimated_low ?? 0}
                      x2={result.estimated_high ?? 0}
                      fill="#bdbdbd"
                      fillOpacity={0.35}
                    />
                    <ReferenceLine
                      x={result.estimated_median ?? 0}
                      stroke="#000000"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                    />
                    <XAxis
                      type="number"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#525252', fontSize: 11 }}
                      tickFormatter={formatAxisPrice}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      width={108}
                      tick={{ fill: '#171717', fontSize: 11 }}
                    />
                    <Bar dataKey="price" radius={[0, 0, 0, 0]} isAnimationActive={false}>
                      {chartData.map((entry, index) => (
                        <Cell
                          key={entry.id}
                          fill={index === 0 ? '#111111' : index === 1 ? '#525252' : '#a3a3a3'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {[
                  { label: 'Lower band', value: formatLKR(result.estimated_low), strong: false },
                  { label: 'Midpoint', value: formatLKR(result.estimated_median), strong: true },
                  { label: 'Upper band', value: formatLKR(result.estimated_high), strong: false },
                ].map(band => (
                  <div
                    key={band.label}
                    className={`px-4 py-3 ${band.strong ? 'border-2 border-black' : 'border border-black/20'}`}
                  >
                    <p className="text-[10px] uppercase tracking-[0.2em] text-black/45">{band.label}</p>
                    <p
                      className={`mt-2 text-black ${band.strong ? 'text-[1.25rem]' : 'text-[1.1rem]'}`}
                      style={{ fontFamily: REPORT_TITLE_FONT }}
                    >
                      {band.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="print-break-inside-avoid mb-8 border border-black/20 px-5 py-5">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="mb-2 text-[10px] uppercase tracking-[0.24em] text-black/45">Comparables</p>
                <h2
                  className="text-[1.7rem] leading-tight text-black"
                  style={{ fontFamily: REPORT_TITLE_FONT }}
                >
                  Representative listings behind the estimate
                </h2>
              </div>
              <p className="max-w-sm text-[11px] leading-5 text-black/50">
                Showing the first {visibleComparables.length} ranked comparables used to anchor the report. Asking prices are current or recently active listing prices.
              </p>
            </div>

            <div className="overflow-hidden border border-black/20">
              <table className="w-full border-collapse text-left">
                <thead className="bg-black text-white">
                  <tr>
                    {['Location', 'Price', 'Size', 'Beds', 'Days', 'Match'].map((heading, index) => (
                      <th
                        key={heading}
                        className={`px-4 py-3 text-[10px] uppercase tracking-[0.2em] ${
                          index === 0 ? 'text-left' : 'text-right'
                        }`}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleComparables.map((listing, index) => (
                    <tr
                      key={listing.id}
                      className={`report-table-row border-t border-black/15 ${index % 2 === 0 ? 'bg-white' : 'bg-black/[0.03]'}`}
                    >
                      <td className="px-4 py-3 text-[13px] text-black">{getLocationLabel(listing)}</td>
                      <td className="px-4 py-3 text-right text-[13px] font-semibold text-black num font-numeric-table">{formatLKR(listing.price_lkr)}</td>
                      <td className="px-4 py-3 text-right text-[12px] text-black/60 num font-numeric-table">
                        {listing.size_perches != null
                          ? `${listing.size_perches}p`
                          : listing.size_sqft != null
                            ? `${listing.size_sqft} sqft`
                            : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-[12px] text-black/60 num font-numeric-table">{listing.bedrooms ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-[12px] text-black/60 num font-numeric-table">
                        {listing.days_on_market != null ? `${listing.days_on_market}d` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-[12px] text-black/60 num font-numeric-table">
                        {listing.similarity_score != null ? `${listing.similarity_score.toFixed(0)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mb-8 grid gap-6 lg:grid-cols-2">
            <div className="print-break-inside-avoid border border-black/20 px-5 py-5">
              <p className="mb-2 text-[10px] uppercase tracking-[0.24em] text-black/45">Methodology</p>
              <h2
                className="text-[1.5rem] leading-tight text-black"
                style={{ fontFamily: REPORT_TITLE_FONT }}
              >
                How the estimate is formed
              </h2>
              <p className="mt-3 text-[13px] leading-7 text-black/60">
                The estimate is derived from ranked comparable listings sourced from OnlineProperty.lk, Ikman.lk, and Lamudi.lk. Listings are filtered by property type, district, size, and bedroom count where available, then scored for relevance. The range reflects the 25th percentile, midpoint, and 75th percentile of the matched asking-price set.
              </p>
            </div>

            <div className="print-break-inside-avoid border border-black px-5 py-5">
              <p className="mb-2 text-[10px] uppercase tracking-[0.24em] text-black/45">Legal use note</p>
              <h2
                className="text-[1.5rem] leading-tight text-black"
                style={{ fontFamily: REPORT_TITLE_FONT }}
              >
                Intended as market reference only
              </h2>
              <p className="mt-3 text-[13px] leading-7 text-black/60">
                This document is not a formal valuation under Sri Lankan law and should not replace advice from a registered valuer or on-the-ground due diligence. It is best used as an early decision-support layer when discussing pricing, feasibility, or whether further professional checks should be commissioned.
              </p>
            </div>
          </section>

          <footer className="border-t border-black pt-6 text-[12px] text-black/55 sm:flex sm:items-end sm:justify-between">
            <div>
              <p
                className="text-[1rem] text-black"
                style={{ fontFamily: REPORT_TITLE_FONT }}
              >
                property.lk
              </p>
              <p className="mt-1">Market intelligence report · Shareable URL preserves filters</p>
            </div>
            <div className="mt-4 sm:mt-0 sm:text-right">
              <p>{today}</p>
              <p>{refId}</p>
            </div>
          </footer>
        </article>
      </div>
    </>
  );
}
