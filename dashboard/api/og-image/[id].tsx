import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

const API_BASE = (process.env.VITE_API_URL || process.env.API_URL || 'https://api.propertylk.com');

function formatPrice(n: number): string {
  if (n >= 1_000_000) return `Rs ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `Rs ${(n / 1_000).toFixed(0)}K`;
  return `Rs ${n}`;
}

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const id = url.pathname.split('/').pop();

  let title = 'Property Listing';
  let price = '';
  let district = 'Sri Lanka';
  let propertyType = 'Property';
  let dealScore: number | null = null;
  let source = '';

  try {
    const data = await fetch(`${API_BASE}/listings/${id}`).then(r => r.json());
    if (data?.title) title = data.title;
    if (data?.price_lkr) price = formatPrice(data.price_lkr);
    if (data?.district) district = data.district;
    if (data?.property_type) propertyType = data.property_type.charAt(0).toUpperCase() + data.property_type.slice(1);
    if (data?.deal_score != null) dealScore = data.deal_score;
    if (data?.source) source = data.source === 'lpw' ? 'LPW' : data.source === 'lamudi' ? 'house.lk' : data.source;
  } catch {
    // Use defaults
  }

  const dealLabel = dealScore != null && dealScore > 0
    ? `${dealScore.toFixed(0)}% below market`
    : dealScore != null && dealScore < 0
    ? `${Math.abs(dealScore).toFixed(0)}% above market`
    : null;
  const dealColor = dealScore != null && dealScore > 0 ? '#10b981' : '#ef4444';

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#0a0a0a',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Teal gradient top bar */}
      <div style={{
        height: '4px',
        background: 'linear-gradient(90deg, #14b8a6, #5eead4)',
        width: '100%',
      }} />

      {/* Background grid decoration */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '48px 56px',
        flex: 1,
        position: 'relative',
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '40px' }}>
          <div style={{
            width: '32px', height: '32px',
            borderRadius: '10px',
            background: 'rgba(20,184,166,0.15)',
            border: '1px solid rgba(20,184,166,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#14b8a6' }} />
          </div>
          <span style={{ color: '#a3a3a3', fontSize: '16px', fontWeight: 600, letterSpacing: '0.05em' }}>
            PropertyLK
          </span>
        </div>

        {/* Main content */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          {/* Property type + source */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '20px',
              padding: '4px 12px',
              fontSize: '13px',
              color: '#a3a3a3',
              textTransform: 'capitalize',
            }}>
              {propertyType}
            </span>
            {source && (
              <span style={{ color: '#525252', fontSize: '13px' }}>via {source}</span>
            )}
          </div>

          {/* Price */}
          {price && (
            <div style={{
              fontSize: '72px',
              fontWeight: 800,
              color: 'white',
              letterSpacing: '-0.03em',
              lineHeight: 1,
              marginBottom: '16px',
            }}>
              {price}
            </div>
          )}

          {/* Location */}
          <div style={{
            fontSize: '22px',
            color: '#525252',
            marginBottom: '24px',
          }}>
            {district}
          </div>

          {/* Deal score badge */}
          {dealLabel && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: `${dealColor}15`,
              border: `1px solid ${dealColor}30`,
              borderRadius: '20px',
              padding: '6px 16px',
              fontSize: '15px',
              fontWeight: 700,
              color: dealColor,
              width: 'fit-content',
            }}>
              {dealLabel}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '24px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          <span style={{ color: '#404040', fontSize: '14px' }}>propertylk.vercel.app</span>
          <span style={{ color: '#14b8a6', fontSize: '14px', fontWeight: 600 }}>View listing →</span>
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
    }
  );
}
