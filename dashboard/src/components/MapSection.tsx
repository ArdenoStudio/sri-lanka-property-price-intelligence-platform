import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { useEffect } from 'react';
import type { HeatmapPoint } from '../api';

// Sri Lanka bounds
const SL_CENTER: [number, number] = [7.8731, 80.7718];
const SL_ZOOM = 7.5;

function MapController() {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
  }, [map]);
  return null;
}

function formatPrice(price: number | null): string {
  if (!price) return 'N/A';
  if (price >= 1_000_000) return `Rs ${(price / 1_000_000).toFixed(1)}M`;
  if (price >= 1_000) return `Rs ${(price / 1_000).toFixed(0)}K`;
  return `Rs ${price.toFixed(0)}`;
}

function getColor(count: number, maxCount: number): string {
  const ratio = count / maxCount;
  if (ratio > 0.7) return '#e17055';
  if (ratio > 0.4) return '#fdcb6e';
  if (ratio > 0.2) return '#6c5ce7';
  return '#a29bfe';
}

function getRadius(count: number, maxCount: number): number {
  const ratio = count / maxCount;
  return Math.max(8, Math.min(35, ratio * 40 + 8));
}

interface Props {
  points: HeatmapPoint[];
  onDistrictSelect: (district: string) => void;
}

export function MapSection({ points, onDistrictSelect }: Props) {
  const maxCount = Math.max(...points.map((p) => p.count), 1);

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold">Market Heatmap</h3>
          <p className="text-xs text-text-secondary mt-0.5">
            Circle size = listing volume. Click a district to filter.
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-text-muted">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#a29bfe]" /> Low
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#6c5ce7]" /> Med
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#fdcb6e]" /> High
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#e17055]" /> Hot
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-border overflow-hidden" style={{ height: 420 }}>
        <MapContainer
          center={SL_CENTER}
          zoom={SL_ZOOM}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
        >
          <MapController />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {points.map((pt) => (
            <CircleMarker
              key={pt.district}
              center={[pt.lat, pt.lng]}
              radius={getRadius(pt.count, maxCount)}
              pathOptions={{
                fillColor: getColor(pt.count, maxCount),
                fillOpacity: 0.7,
                color: getColor(pt.count, maxCount),
                weight: 2,
                opacity: 0.9,
              }}
              eventHandlers={{
                click: () => onDistrictSelect(pt.district),
              }}
            >
              <Popup>
                <div className="text-sm min-w-[140px]">
                  <p className="font-bold text-base mb-1">{pt.district}</p>
                  <p className="text-text-secondary">
                    <span className="font-semibold text-text-primary">{pt.count}</span> listings
                  </p>
                  {pt.avg_price && (
                    <p className="text-text-secondary">
                      Avg: <span className="font-semibold text-accent-light">{formatPrice(pt.avg_price)}</span>
                    </p>
                  )}
                  <button
                    className="mt-2 text-xs text-accent-light hover:underline cursor-pointer bg-transparent border-none p-0"
                    onClick={() => onDistrictSelect(pt.district)}
                  >
                    View listings &rarr;
                  </button>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </section>
  );
}
