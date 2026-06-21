import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getEstimate } from '../api';
import type { EstimateResult } from '../api';

function formatLKR(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `LKR ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `LKR ${(n / 1_000).toFixed(0)}K`;
  return `LKR ${n.toLocaleString()}`;
}

export function ReportPage() {
  const [params] = useSearchParams();
  const [result, setResult] = useState<EstimateResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const district = params.get('district') || '';
  const propertyType = params.get('type') || 'house';
  const listingType = (params.get('listing_type') || 'sale') as 'sale' | 'rent';
  const sizePerches = params.get('size_perches') ? Number(params.get('size_perches')) : undefined;
  const sizeSqft = params.get('size_sqft') ? Number(params.get('size_sqft')) : undefined;
  const bedrooms = params.get('bedrooms') ? Number(params.get('bedrooms')) : undefined;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const refId = useMemo(() => `PI-${Date.now().toString(36).toUpperCase().slice(-6)}`, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const today = useMemo(() => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), []);

  useEffect(() => {
    getEstimate({
      district: district || undefined,
      property_type: propertyType,
      listing_type: listingType,
      size_perches: sizePerches,
      size_sqft: sizeSqft,
      bedrooms,
    })
      .then(res => { setResult(res); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-500 text-sm">Generating report…</p>
      </div>
    );
  }

  if (error || !result || result.comparable_count === 0) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-3">
        <p className="text-red-500 text-sm">No comparable listings found for these parameters.</p>
        <button onClick={() => window.history.back()} className="text-sm text-gray-500 underline cursor-pointer bg-transparent border-none">
          ← Go back
        </button>
      </div>
    );
  }

  const subjectParts = [
    propertyType.charAt(0).toUpperCase() + propertyType.slice(1),
    listingType === 'sale' ? 'for Sale' : 'for Rent',
    district ? `— ${district} District` : '— All Districts',
    sizePerches ? `· ${sizePerches} perches` : '',
    sizeSqft ? `· ${sizeSqft.toLocaleString()} sqft` : '',
    bedrooms ? `· ${bedrooms} bedroom${bedrooms !== 1 ? 's' : ''}` : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      <style>{`
        @media print {
          .print-hide { display: none !important; }
        }
        @page { size: A4; margin: 18mm 15mm; }
      `}</style>

      <div className="min-h-screen bg-white font-sans">
        {/* Toolbar — hidden when printing */}
        <div className="print-hide fixed top-4 right-4 flex gap-2 z-50">
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors cursor-pointer border-none"
          >
            ← Back
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors cursor-pointer border-none"
          >
            Save as PDF
          </button>
        </div>

        {/* A4-width report */}
        <div className="max-w-[720px] mx-auto px-10 py-12 text-gray-900">

          {/* Header */}
          <header className="flex items-start justify-between mb-10 pb-6 border-b-2 border-gray-900">
            <div>
              <p className="text-[10px] font-bold tracking-[0.3em] uppercase text-gray-400 mb-1">Ardeno Studio</p>
              <h1 className="text-[22px] font-bold leading-tight text-gray-900">Property Market Intelligence Report</h1>
            </div>
            <div className="text-right shrink-0 ml-8">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest">Ref</p>
              <p className="text-sm font-mono font-bold text-gray-700">{refId}</p>
              <p className="text-[11px] text-gray-400 mt-1">{today}</p>
            </div>
          </header>

          {/* Subject property */}
          <section className="mb-8">
            <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-gray-400 mb-2">Subject Property</p>
            <p className="text-[15px] text-gray-800 font-medium">{subjectParts}</p>
          </section>

          {/* Market value estimate */}
          <section className="mb-8 rounded-xl border border-gray-200 bg-gray-50 p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-gray-400 mb-1">
                  {listingType === 'rent' ? 'Estimated Monthly Rent' : 'Estimated Asking Value'}
                </p>
                <p className="text-[11px] text-gray-500">
                  Based on {result.comparable_count} comparable listing{result.comparable_count !== 1 ? 's' : ''}
                  {district ? ` in ${district} District` : ' across Sri Lanka'}
                </p>
              </div>
              <span className={`text-[11px] font-semibold px-3 py-1 rounded-full capitalize ${
                result.confidence === 'high'   ? 'bg-green-100 text-green-700' :
                result.confidence === 'medium' ? 'bg-amber-100 text-amber-700' :
                                                 'bg-red-100 text-red-700'
              }`}>
                {result.confidence} confidence
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              {([
                { label: 'Low (P25)',    value: result.estimated_low,    accent: false },
                { label: 'Median (P50)', value: result.estimated_median, accent: true  },
                { label: 'High (P75)',   value: result.estimated_high,   accent: false },
              ] as const).map(({ label, value, accent }) => (
                <div
                  key={label}
                  className={`text-center p-4 rounded-lg bg-white border ${accent ? 'border-gray-900' : 'border-gray-200'}`}
                >
                  <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">{label}</p>
                  <p className={`font-bold ${accent ? 'text-[20px]' : 'text-[16px]'} text-gray-900`}>
                    {formatLKR(value)}
                  </p>
                </div>
              ))}
            </div>

            {(result.median_price_per_perch || result.median_price_per_sqft) && (
              <div className="flex gap-8 text-[12px] text-gray-600 pt-3 border-t border-gray-200">
                {result.median_price_per_perch && (
                  <p>Per perch: <span className="font-semibold text-gray-900">{formatLKR(result.median_price_per_perch)}</span></p>
                )}
                {result.median_price_per_sqft && (
                  <p>Per sqft: <span className="font-semibold text-gray-900">{formatLKR(result.median_price_per_sqft)}</span></p>
                )}
              </div>
            )}

            {result.confidence_reason && (
              <p className="text-[11px] text-gray-500 mt-3 pt-3 border-t border-gray-200 leading-relaxed">
                {result.confidence_reason}
              </p>
            )}
          </section>

          {/* Comparable listings */}
          {result.comparables.length > 0 && (
            <section className="mb-8">
              <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-gray-400 mb-3">
                Comparable Listings
              </p>
              <table className="w-full text-[12px] border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-900">
                    {['Location', 'Price', 'Size', 'Beds', 'Days Listed', 'Match'].map(h => (
                      <th
                        key={h}
                        className={`py-2 text-[10px] uppercase tracking-widest text-gray-500 font-semibold ${
                          h === 'Location' ? 'text-left pr-4' : 'text-right pr-2'
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.comparables.map((c, i) => (
                    <tr key={c.id} className={i % 2 !== 0 ? 'bg-gray-50' : ''}>
                      <td className="py-2.5 pr-4 text-gray-700">{c.city || c.raw_location || c.district || '—'}</td>
                      <td className="py-2.5 pr-2 text-right font-semibold text-gray-900">{formatLKR(c.price_lkr)}</td>
                      <td className="py-2.5 pr-2 text-right text-gray-600">
                        {c.size_perches != null ? `${c.size_perches}p` : c.size_sqft != null ? `${c.size_sqft} sqft` : '—'}
                      </td>
                      <td className="py-2.5 pr-2 text-right text-gray-600">{c.bedrooms ?? '—'}</td>
                      <td className="py-2.5 pr-2 text-right text-gray-600">
                        {c.days_on_market != null ? `${c.days_on_market}d` : '—'}
                      </td>
                      <td className="py-2.5 text-right text-gray-600">
                        {c.similarity_score != null ? `${c.similarity_score.toFixed(0)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* Methodology */}
          <section className="mb-5 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-gray-400 mb-2">Methodology</p>
            <p className="text-[11px] text-gray-600 leading-relaxed">
              Price ranges are derived from ranked comparable listings sourced from OnlineProperty.lk, Ikman.lk, and Lamudi.lk.
              Comparables are filtered by property type, district, and size, then scored by similarity. P25, P50, and P75
              represent the 25th percentile, median, and 75th percentile of asking prices in the matched set.
              All prices reflect current or recently active market listings, not transacted sale prices.
            </p>
          </section>

          {/* Disclaimer */}
          <section className="mb-10 p-4 border border-gray-200 rounded-lg">
            <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-gray-400 mb-2">Disclaimer</p>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              This report is produced from publicly available listing data and is intended as a market reference tool only.
              It does not constitute a formal valuation under Sri Lankan law and should not be used as a substitute for a
              valuation by a registered member of the Institute of Valuers of Sri Lanka. Ardeno Studio accepts no liability
              for decisions made on the basis of this report. Asking prices may differ materially from transacted values.
            </p>
          </section>

          {/* Footer */}
          <footer className="border-t border-gray-200 pt-5 flex items-start justify-between">
            <div>
              <p className="text-[12px] font-bold text-gray-800">Ardeno Studio</p>
              <p className="text-[11px] text-gray-400">ardeno-studio-website.vercel.app</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-gray-500">karunaratneovindu@gmail.com</p>
              <p className="text-[11px] text-gray-500">076 248 5456</p>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}
