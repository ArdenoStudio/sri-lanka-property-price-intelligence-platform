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

// Color = avg price — grayscale only (white → gray by ratio)
function getColorByPrice(price: number | null, minPrice: number, maxPrice: number): string {
  if (!price || maxPrice === minPrice) return '#a3a3a3';
  const ratio = (price - minPrice) / (maxPrice - minPrice);
  if (ratio > 0.72) return '#f5f5f5'; // Hot  — near white
  if (ratio > 0.45) return '#d4d4d4'; // High — light gray
  if (ratio > 0.22) return '#a3a3a3'; // Med  — mid gray
  return '#737373';                   // Low  — darker gray
}

// Size = listing volume
function getRadius(count: number, maxCount: number): number {
  const ratio = count / maxCount;
  return Math.max(7, Math.min(27, ratio * 30 + 7));
}

function getFillOpacity(count: number, maxCount: number): number {
  const ratio = count / maxCount;
  if (ratio > 0.72) return 0.84;
  if (ratio > 0.45) return 0.74;
  if (ratio > 0.22) return 0.66;
  return 0.58;
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
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#525252] mb-1">Market Heatmap</p>
          <p className="text-xs text-[#525252]">
            Color = avg price &middot; Size = volume. Click a district to filter.
          </p>
        </div>
        {points.length > 0 && (
          <div className="flex items-center gap-1.5">
            {([
              { label: 'Low',  color: '#737373' },
              { label: 'Med',  color: '#a3a3a3' },
              { label: 'High', color: '#d4d4d4' },
              { label: 'Hot',  color: '#f5f5f5' },
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
                    color: isSelected ? '#ffffff' : color,
                    weight: isSelected ? 3 : 1.5,
                    opacity: 0.96,
                  }}
                  eventHandlers={{
                    mouseover: (e) => {
                      (e.target as any).setStyle({
                        weight: isSelected ? 3 : 2.2,
                        fillOpacity: Math.min(0.92, fillOpacity + 0.1),
                      });
                      (e.target as any).openPopup();
                    },
                    mouseout: (e) => {
                      (e.target as any).setStyle({
                        weight: isSelected ? 3 : 1.5,
                        fillOpacity,
                      });
                      (e.target as any).closePopup();
                    },
                    click: () => onDistrictSelect(pt.district),
                  }}
                >
                  <Tooltip permanent direction="top" offset={[0, -(radius + 4)]} className="map-district-label">
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
