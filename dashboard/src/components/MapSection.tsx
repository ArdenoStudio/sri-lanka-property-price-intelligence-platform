import { useMemo, useState } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import type { HeatmapPoint } from '../api';

const GEO_URL = '/lk-districts.geojson';

// Thermal gradient: blue (cheap) → teal → amber → red (expensive)
function getColorByPrice(price: number | null, minPrice: number, maxPrice: number): string {
  if (!price || maxPrice === minPrice) return '#2a3a4a';
  const ratio = (price - minPrice) / (maxPrice - minPrice);
  if (ratio > 0.72) return '#e84545';
  if (ratio > 0.45) return '#f5a623';
  if (ratio > 0.22) return '#47c29a';
  return '#4f8ef7';
}

function formatPrice(price: number | null): string {
  if (!price) return 'N/A';
  if (price >= 1_000_000) return `Rs ${(price / 1_000_000).toFixed(1)}M`;
  if (price >= 1_000) return `Rs ${(price / 1_000).toFixed(0)}K`;
  return `Rs ${price.toFixed(0)}`;
}

interface TooltipState {
  x: number;
  y: number;
  district: string;
  count: number;
  avg_price: number | null;
}

interface Props {
  points: HeatmapPoint[];
  onDistrictSelect: (district: string) => void;
  selectedDistrict?: string;
}

export function MapSection({ points, onDistrictSelect, selectedDistrict }: Props) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const { pointByDistrict, minPrice, maxPrice } = useMemo(() => {
    const map: Record<string, HeatmapPoint> = {};
    for (const p of points) map[p.district] = p;
    const prices = points.map((p) => p.avg_price).filter((p): p is number => p != null);
    return {
      pointByDistrict: map,
      minPrice: prices.length ? Math.min(...prices) : 0,
      maxPrice: prices.length ? Math.max(...prices) : 1,
    };
  }, [points]);

  return (
    <section className="mt-4 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#525252] mb-1">Market Heatmap</p>
          <p className="text-xs text-[#525252]">
            Color = avg price. Click a district to filter.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {([
            { label: 'Low',  color: '#4f8ef7' },
            { label: 'Med',  color: '#47c29a' },
            { label: 'High', color: '#f5a623' },
            { label: 'Hot',  color: '#e84545' },
          ] as { label: string; color: string }[]).map(({ label, color }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold border border-white/[0.08] text-[#525252]"
            >
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden relative" style={{ height: 460 }}>
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ center: [80.7, 7.87], scale: 6200 }}
          style={{ width: '100%', height: '100%' }}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const name = (geo.properties.shapeName as string).replace(' District', '');
                const pt = pointByDistrict[name];
                const isSelected = selectedDistrict === name;
                const fill = getColorByPrice(pt?.avg_price ?? null, minPrice, maxPrice);

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onClick={() => pt && onDistrictSelect(name)}
                    onMouseEnter={(e) => {
                      if (!pt) return;
                      const rect = (e.target as SVGElement)
                        .closest('svg')!
                        .getBoundingClientRect();
                      setTooltip({
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top,
                        district: name,
                        count: pt.count,
                        avg_price: pt.avg_price,
                      });
                    }}
                    onMouseMove={(e) => {
                      if (!pt) return;
                      const rect = (e.target as SVGElement)
                        .closest('svg')!
                        .getBoundingClientRect();
                      setTooltip((prev) =>
                        prev ? { ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top } : prev
                      );
                    }}
                    onMouseLeave={() => setTooltip(null)}
                    style={{
                      default: {
                        fill,
                        stroke: isSelected ? '#ffffff' : '#0d0d0d',
                        strokeWidth: isSelected ? 1.5 : 0.5,
                        outline: 'none',
                      },
                      hover: {
                        fill,
                        stroke: '#ffffff',
                        strokeWidth: 1.2,
                        outline: 'none',
                        cursor: pt ? 'pointer' : 'default',
                      },
                      pressed: {
                        fill,
                        stroke: '#ffffff',
                        strokeWidth: 1.5,
                        outline: 'none',
                      },
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ComposableMap>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="pointer-events-none absolute z-10 rounded-xl border border-white/[0.08] px-3 py-2 text-xs shadow-xl"
            style={{
              left: tooltip.x + 12,
              top: tooltip.y - 10,
              background: '#161616',
              color: '#f5f5f5',
              minWidth: 140,
              transform: tooltip.x > 900 ? 'translateX(-110%)' : undefined,
            }}
          >
            <p className="font-bold text-sm mb-1">{tooltip.district}</p>
            <p className="text-[#888]">
              <span className="font-semibold text-white">{tooltip.count}</span> listings
            </p>
            <p className="text-[#888]">
              Avg: <span className="font-semibold" style={{ color: getColorByPrice(tooltip.avg_price, minPrice, maxPrice) }}>
                {formatPrice(tooltip.avg_price)}
              </span>
            </p>
            <button
              className="mt-1.5 text-[10px] text-[#aaa] hover:text-white pointer-events-auto"
              onClick={() => onDistrictSelect(tooltip.district)}
            >
              View listings →
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
