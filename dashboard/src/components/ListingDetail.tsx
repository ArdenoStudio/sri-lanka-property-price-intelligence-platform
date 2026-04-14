import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink, MapPin, Calendar, TrendingDown, Share2, Bed, Bath, Maximize, Tag } from 'lucide-react';
import { getListingDetail, getListingSimilar, getListingPriceHistory } from '../api';
import type { ListingDetail as ListingDetailType, SimilarListing, PriceSnapshot } from '../api';

function formatNum(p: number): string {
  if (p >= 1_000_000) return `Rs ${(p / 1_000_000).toFixed(1)}M`;
  if (p >= 1_000) return `Rs ${(p / 1_000).toFixed(0)}K`;
  return `Rs ${p.toFixed(0)}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-LK', { year: 'numeric', month: 'short', day: 'numeric' });
}

function DealGauge({ score }: { score: number }) {
  // score: -100 (overpriced) to +100 (great deal)
  const clamped = Math.max(-50, Math.min(50, score));
  const pct = ((clamped + 50) / 100) * 100;
  const color = score >= 15 ? '#14b8a6' : score >= 5 ? '#47c29a' : score >= -5 ? '#f5a623' : '#e84545';
  const label = score >= 15 ? 'Great Deal' : score >= 5 ? 'Below Market' : score >= -5 ? 'Fair Price' : 'Above Market';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-[#737373]">Overpriced</span>
        <span className="font-semibold" style={{ color }}>{label}</span>
        <span className="text-[#737373]">Great Deal</span>
      </div>
      <div className="relative h-2 rounded-full bg-white/[0.06] overflow-hidden">
        <div className="absolute inset-0 rounded-full" style={{
          background: 'linear-gradient(to right, #e84545, #f5a623 40%, #47c29a 60%, #14b8a6)'
        }} />
        <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 shadow-lg transition-all duration-700"
          style={{ left: `calc(${pct}% - 6px)`, borderColor: color }} />
      </div>
    </div>
  );
}

function SimilarCard({ listing }: { listing: SimilarListing }) {
  return (
    <Link to={`/listing/${listing.id}`}
      className="block bg-[#111111] hover:bg-[#161616] transition-colors p-4 group no-underline">
      <p className="text-[10px] uppercase tracking-[0.12em] text-[#737373] mb-1">
        {[listing.property_type, listing.district].filter(Boolean).join(' · ')}
      </p>
      <p className="text-lg font-bold text-white num mb-1">
        {listing.price_lkr ? formatNum(listing.price_lkr) : 'Price N/A'}
      </p>
      <p className="text-[12px] text-[#a3a3a3] line-clamp-1">{listing.title}</p>
      {listing.deal_score !== null && listing.deal_score >= 5 && (
        <span className="inline-block mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 num">
          {listing.deal_score.toFixed(0)}% below market
        </span>
      )}
    </Link>
  );
}

export function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [listing, setListing] = useState<ListingDetailType | null>(null);
  const [similar, setSimilar] = useState<SimilarListing[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const numId = Number(id);
    setLoading(true);
    setError(null);

    Promise.all([
      getListingDetail(numId).catch(() => null),
      getListingSimilar(numId).catch(() => []),
      getListingPriceHistory(numId).catch(() => []),
    ]).then(([detail, sim, history]) => {
      if (!detail) {
        setError('Listing not found');
      } else {
        setListing(detail);
        document.title = `${detail.title || 'Property'} — PropertyLK`;
      }
      setSimilar(sim);
      setPriceHistory(history);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen relative">
        <div className="max-w-4xl mx-auto px-6 pt-24 pb-32">
          <div className="h-4 w-20 bg-white/[0.05] rounded mb-8" />
          <div className="h-10 w-2/3 bg-white/[0.05] rounded mb-4" />
          <div className="h-6 w-1/3 bg-white/[0.05] rounded mb-8" />
          <div className="grid grid-cols-2 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-24 bg-white/[0.05] rounded-2xl animate-pulse" />)}
          </div>
        </div>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#737373] text-lg mb-4">{error || 'Something went wrong'}</p>
          <button onClick={() => navigate('/')}
            className="text-[#14b8a6] hover:text-[#5eead4] transition-colors bg-transparent border-none cursor-pointer text-sm">
            ← Back to listings
          </button>
        </div>
      </div>
    );
  }

  const detailItems = [
    listing.size_perches && { icon: Maximize, label: 'Size', value: `${listing.size_perches} perches` },
    listing.size_sqft && { icon: Maximize, label: 'Size', value: `${listing.size_sqft.toLocaleString()} sqft` },
    listing.bedrooms && { icon: Bed, label: 'Bedrooms', value: `${listing.bedrooms}` },
    listing.bathrooms && { icon: Bath, label: 'Bathrooms', value: `${listing.bathrooms}` },
    listing.listing_type && { icon: Tag, label: 'Type', value: listing.listing_type === 'rent' ? 'For Rent' : 'For Sale' },
    listing.days_on_market !== null && { icon: Calendar, label: 'On Market', value: `${listing.days_on_market} days` },
  ].filter(Boolean) as { icon: React.ElementType; label: string; value: string }[];

  return (
    <div className="min-h-screen relative">
      <div className="max-w-4xl mx-auto px-6 lg:px-8 pt-24 pb-32">

        {/* Back + Share */}
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-[13px] text-[#737373] hover:text-white transition-colors bg-transparent border-none cursor-pointer p-0">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <button
            onClick={() => navigator.share?.({ title: listing.title || 'Property', url: window.location.href }) ?? navigator.clipboard.writeText(window.location.href)}
            className="flex items-center gap-1.5 text-[13px] text-[#737373] hover:text-white transition-colors bg-transparent border-none cursor-pointer p-0"
          >
            <Share2 className="w-4 h-4" /> Share
          </button>
        </div>

        {/* Hero */}
        <div className="mb-8">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#525252] mb-2">
            {[listing.property_type, listing.source].filter(Boolean).join(' · ')}
          </p>

          <div className="flex items-baseline gap-3 flex-wrap mb-2">
            <h1 className="text-4xl sm:text-5xl font-bold text-white num tracking-tight">
              {listing.price_lkr ? formatNum(listing.price_lkr) : listing.raw_price || 'Price N/A'}
            </h1>
            {listing.price_per_perch && (
              <span className="text-[13px] text-[#737373] num">{formatNum(listing.price_per_perch)}/perch</span>
            )}
          </div>

          {/* Price drop */}
          {listing.original_price_lkr && listing.price_drop_pct && listing.price_drop_pct > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[13px] text-amber-400 num">
                Reduced from {formatNum(listing.original_price_lkr)} (↓{listing.price_drop_pct.toFixed(0)}%)
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 text-[#a3a3a3] text-sm">
            <MapPin className="w-3.5 h-3.5" />
            <span>{[listing.city, listing.district].filter(Boolean).join(', ') || listing.raw_location || 'Location N/A'}</span>
          </div>

          {listing.title && (
            <p className="text-[15px] text-[#737373] mt-3 leading-relaxed">{listing.title}</p>
          )}
        </div>

        {/* Deal Score */}
        {listing.deal_score !== null && listing.market_median_lkr && (
          <div className="card p-6 mb-6">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#525252] mb-4">Market Position</p>
            <DealGauge score={listing.deal_score} />
            <div className="flex items-center justify-between mt-4 text-[12px]">
              <span className="text-[#525252]">Market median: <span className="text-[#a3a3a3] num">{formatNum(listing.market_median_lkr)}</span></span>
              <span className="font-semibold num" style={{
                color: listing.deal_score >= 5 ? '#14b8a6' : listing.deal_score >= -5 ? '#f5a623' : '#e84545'
              }}>
                {listing.deal_score > 0 ? `${listing.deal_score.toFixed(0)}% below` : listing.deal_score < 0 ? `${Math.abs(listing.deal_score).toFixed(0)}% above` : 'At market'}
              </span>
            </div>
          </div>
        )}

        {/* Details Grid */}
        {detailItems.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {detailItems.map((item, i) => (
              <div key={i} className="card p-4">
                <div className="flex items-center gap-2 text-[#525252] mb-1">
                  <item.icon className="w-3.5 h-3.5" />
                  <span className="text-[10px] uppercase tracking-widest">{item.label}</span>
                </div>
                <p className="text-lg font-semibold text-white num">{item.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Description */}
        {listing.description && (
          <div className="card p-6 mb-6">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#525252] mb-3">Description</p>
            <p className="text-[14px] text-[#a3a3a3] leading-relaxed whitespace-pre-line">{listing.description}</p>
          </div>
        )}

        {/* Price History */}
        {priceHistory.length > 1 && (
          <div className="card p-6 mb-6">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#525252] mb-4">Price History</p>
            <div className="space-y-2">
              {priceHistory.map((snap, i) => (
                <div key={i} className="flex items-center justify-between text-[13px] py-2 border-b border-white/[0.04] last:border-0">
                  <span className="text-[#737373]">{snap.date ? formatDate(snap.date) : '—'}</span>
                  <span className="text-white font-medium num">{snap.raw_price || '—'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Map */}
        {listing.lat && listing.lng && (
          <div className="card overflow-hidden mb-6" style={{ height: 240 }}>
            <iframe
              title="Property location"
              width="100%"
              height="100%"
              style={{ border: 0, filter: 'invert(1) hue-rotate(180deg) brightness(0.9) contrast(1.1)' }}
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${listing.lng - 0.01},${listing.lat - 0.008},${listing.lng + 0.01},${listing.lat + 0.008}&layer=mapnik&marker=${listing.lat},${listing.lng}`}
            />
          </div>
        )}

        {/* CTA */}
        <div className="flex gap-3 mb-12">
          {listing.url && (
            <a href={listing.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#14b8a6] text-black font-semibold text-sm hover:bg-[#5eead4] transition-colors no-underline">
              View on {listing.source} <ExternalLink className="w-4 h-4" />
            </a>
          )}
          <button onClick={() => navigate(`/?district=${listing.district || ''}&type=${listing.property_type || ''}`)}
            className="px-6 py-3 rounded-xl border border-white/[0.1] text-[#a3a3a3] text-sm hover:text-white hover:border-white/[0.2] transition-colors bg-transparent cursor-pointer">
            Browse similar
          </button>
        </div>

        {/* Similar Listings */}
        {similar.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#525252] mb-4">Similar Properties</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/[0.04]">
              {similar.map(s => <SimilarCard key={s.id} listing={s} />)}
            </div>
          </div>
        )}

        {/* Timeline footer */}
        <div className="mt-12 text-[11px] text-[#525252] flex items-center gap-4">
          {listing.first_seen_at && <span>First seen: {formatDate(listing.first_seen_at)}</span>}
          {listing.last_seen_at && <span>Last seen: {formatDate(listing.last_seen_at)}</span>}
          <span>Source: {listing.source}</span>
        </div>
      </div>
    </div>
  );
}
