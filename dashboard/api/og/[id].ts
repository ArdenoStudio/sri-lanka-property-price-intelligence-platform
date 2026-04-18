import type { VercelRequest, VercelResponse } from '@vercel/node';

const API_BASE = process.env.VITE_API_URL || process.env.API_URL || 'https://api.propertylk.com';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatPrice(n: number): string {
  if (n >= 1_000_000) return `Rs ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `Rs ${(n / 1_000).toFixed(0)}K`;
  return `Rs ${n}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;

  let title = 'Property Listing — PropertyLK';
  let description = 'View this property on PropertyLK';
  let imageUrl = 'https://propertylk.vercel.app/og-image.png';

  try {
    const data = await fetch(`${API_BASE}/listings/${id}`).then(r => r.json());
    if (data?.title) {
      title = escapeHtml(`${data.title} — PropertyLK`);
    }
    const parts = [
      data?.property_type ? data.property_type.charAt(0).toUpperCase() + data.property_type.slice(1) : '',
      data?.district ? `in ${data.district}` : '',
      data?.price_lkr ? formatPrice(data.price_lkr) : '',
      data?.deal_score > 0 ? `· ${data.deal_score.toFixed(0)}% below market` : '',
    ].filter(Boolean);
    description = escapeHtml(parts.join(' ') || description);
    imageUrl = `https://propertylk.vercel.app/api/og-image/${id}`;
  } catch {
    // Use defaults on error
  }

  const canonical = `https://propertylk.vercel.app/listing/${id}`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${imageUrl}" />
  <meta http-equiv="refresh" content="0;url=${canonical}" />
</head>
<body>
  <a href="${canonical}">View listing on PropertyLK</a>
</body>
</html>`);
}
