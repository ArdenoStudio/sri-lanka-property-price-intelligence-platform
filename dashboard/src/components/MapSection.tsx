import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip, useMap } from 'react-leaflet';
import { useEffect } from 'react';
import type { HeatmapPoint } from '../api';
import { formatCurrencyAmount } from '../lib/pricing';
import { EmptyStatePanel } from './ui/EmptyStatePanel';

// Sri Lanka tight bounds
const SL_BOUNDS: [[number, number], [number, number]] = [[5.9, 79.5], [9.9, 81.9]];
const SL_CENTER: [number, number] = [7.8731, 80.7718];
const SL_ZOOM = 7.5;

function MapController() {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    map.fitBounds(SL_BOUNDS, { padding: [16, 16] });
  }, [map]);
  return null;
}

function formatPrice(price: number | null): string {
  if (!price) return 'N/A';
  return formatCurrencyAmount(price, 'LKR', { variant: 'table' });
}

// Color = avg price — high-contrast ink on dark basemap (Hot = bright white)
function getColorByPrice(price: number | null, minPrice: number, maxPrice: number): string {
  if (!price || maxPrice === minPrice) return '#d4d4d4';
  const ratio = (price - minPrice) / (maxPrice - minPrice);
  if (ratio > 0.72) return '#ffffff'; // Hot
  if (ratio > 0.45) return '#e8e8e8'; // High
  if (ratio > 0.22) return '#c4c4c4'; // Med
  return '#9a9a9a';                   // Low — lighter so markers don't vanish
}

// Size = listing volume
function getRadius(count: number, maxCount: number): number {
  const ratio = count / maxCount;
  return Math.max(10, Math.min(32, ratio * 34 + 10));
}

function getFillOpacity(count: number, maxCount: number): number {
  const ratio = count / maxCount;
  if (ratio > 0.72) return 0.92;
  if (ratio > 0.45) return 0.86;
  if (ratio > 0.22) return 0.8;
  return 0.78;
}

interface Props {
  points: HeatmapPoint[];
  onDistrictSelect: (district: string) => void;
  onBrowseListings: () => void;
  selectedDistrict?: string;
}

export function MapSection({ points, onDistrictSelect, onBrowseListings, selectedDistrict }: Props) {
  const maxCount = Math.max(...points.map((p) => p.count), 1);
  const prices = points.map((p) => p.avg_price).filter((p): p is number => p != null);
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const maxPrice = prices.length ? Math.max(...prices) : 1;

  return (
    <section className="mt-4 mb-8">
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#a3a3a3] mb-1">Market Heatmap</p>
          <p className="text-xs text-[#d4d4d4]">
            Color = avg price &middot; Size = volume. Click a district to filter.
          </p>
        </div>
        {points.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {([
              { label: 'Low',  color: '#9a9a9a' },
              { label: 'Med',  color: '#c4c4c4' },
              { label: 'High', color: '#e8e8e8' },
              { label: 'Hot',  color: '#ffffff' },
            ] as { label: string; color: string }[]).map(({ label, color }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border border-white/20 bg-white/[0.06] text-[#f5f5f5]"
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0 ring-1 ring-white/40"
                  style={{ backgroundColor: color }}
                />
                {label}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="card overflow-hidden h-[260px] md:h-[420px]">
        {points.length === 0 ? (
          <EmptyStatePanel
            eyebrow="Market Heatmap"
            title="No mapped inventory for this view"
            body="This market slice does not have enough geo-resolved listings to render a district map right now. The listings feed may still carry live inventory."
            ctaLabel="Open listings"
            onCta={onBrowseListings}
            className="h-full rounded-none border-0"
          />
        ) : (
          <MapContainer
            center={SL_CENTER}
            zoom={SL_ZOOM}
            scrollWheelZoom={false}
            style={{ height: '100%', width: '100%' }}
            zoomControl={true}
          >
            <MapController />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            {points.map((pt) => {
              const radius = getRadius(pt.count, maxCount);
              const color = getColorByPrice(pt.avg_price, minPrice, maxPrice);
              const fillOpacity = getFillOpacity(pt.count, maxCount);
              const isSelected = selectedDistrict === pt.district;

              return (
                <CircleMarker
                  key={pt.district}
                  center={[pt.lat, pt.lng]}
                  radius={isSelected ? radius + 4 : radius}
                  pathOptions={{
                    fillColor: color,
                    fillOpacity,
                    // White stroke keeps mid/low markers readable on dark tiles
                    color: isSelected ? '#ffffff' : 'rgba(255,255,255,0.85)',
                    weight: isSelected ? 3 : 1.75,
                    opacity: 1,
                  }}
                  eventHandlers={{
                    mouseover: (e) => {
                      (e.target as any).setStyle({
                        weight: isSelected ? 3.5 : 2.5,
                        fillOpacity: Math.min(0.95, fillOpacity + 0.08),
                      });
                      (e.target as any).openPopup();
                    },
                    mouseout: (e) => {
                      (e.target as any).setStyle({
                        weight: isSelected ? 3 : 1.75,
                        fillOpacity,
                      });
                      (e.target as any).closePopup();
                    },
                    click: () => onDistrictSelect(pt.district),
                  }}
                >
                  <Tooltip permanent direction="top" offset={[0, -(radius + 6)]} className="map-district-label">
                    {pt.district}
                  </Tooltip>
                  <Popup>
                    <div className="text-sm min-w-[140px]">
                      <p className="font-bold text-base mb-1">{pt.district}</p>
                      <p className="text-text-secondary">
                        <span className="font-semibold text-text-primary">{pt.count}</span> listings
                      </p>
                      {pt.avg_price && (
                        <p className="text-text-secondary">
                          Avg: <span className="font-semibold text-white">{formatPrice(pt.avg_price)}</span>
                        </p>
                      )}
                      <button
                        className="mt-2 text-xs text-white hover:underline cursor-pointer bg-transparent border-none p-0"
                        onClick={() => onDistrictSelect(pt.district)}
                      >
                        View listings &rarr;
                      </button>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        )}
      </div>
    </section>
  );
}
