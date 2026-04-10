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
  if (ratio > 0.72) return '#c4d7ff';
  if (ratio > 0.45) return '#8fb7ff';
  if (ratio > 0.22) return '#628fcf';
  return '#4f617f';
}

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
}

export function MapSection({ points, onDistrictSelect }: Props) {
  const maxCount = Math.max(...points.map((p) => p.count), 1);

  return (
    <section className="mt-4 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#525252] mb-1">Market Heatmap</p>
          <p className="text-xs text-[#525252]">
            Circle size = listing volume. Click a district to filter.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {([
            { label: 'Low',  color: '#4f617f' },
            { label: 'Med',  color: '#628fcf' },
            { label: 'High', color: '#8fb7ff' },
            { label: 'Hot',  color: '#c4d7ff' },
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

      <div className="card overflow-hidden" style={{ height: 420 }}>
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
                fillOpacity: getFillOpacity(pt.count, maxCount),
                color: getColor(pt.count, maxCount),
                weight: 1.5,
                opacity: 0.96,
              }}
              eventHandlers={{
                mouseover: (e) => {
                  (e.target as any).setStyle({
                    weight: 2.2,
                    fillOpacity: Math.min(0.92, getFillOpacity(pt.count, maxCount) + 0.1),
                  });
                  (e.target as any).openPopup();
                },
                mouseout: (e) => {
                  (e.target as any).setStyle({
                    weight: 1.5,
                    fillOpacity: getFillOpacity(pt.count, maxCount),
                  });
                  (e.target as any).closePopup();
                },
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
