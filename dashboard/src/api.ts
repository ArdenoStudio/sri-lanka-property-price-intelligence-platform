const API_BASE = import.meta.env.VITE_API_URL || '/api';

// ---------- Types ----------

export interface Stats {
  total_listings: number;
  listings_last_7_days: number;
  avg_price_lkr: number | null;
  price_change_pct: number | null;
  districts_covered: number;
  listings_by_type: Record<string, number>;
  last_updated: string | null;
  data_source: string;
}

export interface District {
  district: string;
  count: number;
  avg_price: number | null;
}

export interface HeatmapPoint {
  district: string;
  lat: number;
  lng: number;
  count: number;
  avg_price: number | null;
}

export interface HeatmapResponse {
  points: HeatmapPoint[];
  total_districts: number;
}

export interface Listing {
  id: number;
  source: string;
  title: string | null;
  price_lkr: number | null;
  original_price_lkr: number | null;
  price_drop_pct: number | null;
  deal_score: number | null;
  market_median_lkr: number | null;
  days_on_market: number | null;
  price_per_perch: number | null;
  raw_price?: string | null;
  district: string | null;
  city: string | null;
  raw_location: string | null;
  property_type: string | null;
  listing_type: string | null;
  size_perches: number | null;
  size_sqft: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  url: string | null;
  first_seen_at: string | null;
  lat: number | null;
  lng: number | null;
}

export interface ListingsResponse {
  total: number;
  limit: number;
  offset: number;
  listings: Listing[];
  data_source?: string;
}

export interface PriceHistory {
  year: number;
  month: number;
  median_price_lkr: number | null;
  median_price_per_perch: number | null;
  avg_price_lkr: number | null;
  count: number;
}

export interface PipelineJobStatus {
  name: string;
  status: 'ok' | 'delayed' | 'running';
  last_success: string | null;
  last_run: string | null;
  expected_hours: number;
}

export interface PipelineStatusResponse {
  generated_at: string;
  overall_status: 'ok' | 'delayed' | 'running';
  jobs: PipelineJobStatus[];
}

// ---------- API calls ----------

export const getStats = () => fetchJSON<Stats>('/stats');

export const getDistricts = (propertyType?: string) =>
  fetchJSON<District[]>('/districts', { property_type: propertyType });

export const getHeatmap = (propertyType?: string, listingType?: string) =>
  fetchJSON<HeatmapResponse>('/heatmap', {
    property_type: propertyType,
    listing_type: listingType,
  });

export const getListings = (params: {
  district?: string;
  property_type?: string;
  listing_type?: string;
  source?: string;
  min_price?: number;
  max_price?: number;
  min_bedrooms?: number;
  min_bathrooms?: number;
  min_size_perches?: number;
  max_size_perches?: number;
  min_size_sqft?: number;
  max_size_sqft?: number;
  sort?: string;
  limit?: number;
  offset?: number;
}) => fetchJSON<ListingsResponse>('/listings', params as Record<string, string | number | undefined>);

export const getPrices = (district: string, propertyType: string = 'land') =>
  fetchJSON<PriceHistory[]>('/prices', { district, property_type: propertyType });

export const sendChatMessage = (message: string, history: any[] = []) =>
  fetchJSON<{ response: string; context_used: boolean }>('/chat', { message, history }, 'POST');

export const getPipelineStatus = () =>
  fetchJSON<PipelineStatusResponse>('/public/pipeline');

// --- Listing Detail ---

export interface ListingDetail extends Listing {
  source_id?: string;
  description?: string | null;
  price_per_sqft?: number | null;
  last_seen_at?: string | null;
  price_history?: PriceSnapshot[];
}

export interface PriceSnapshot {
  date: string | null;
  raw_price: string | null;
}

export interface SimilarListing {
  id: number;
  source: string;
  title: string | null;
  price_lkr: number | null;
  original_price_lkr: number | null;
  price_drop_pct: number | null;
  deal_score: number | null;
  market_median_lkr: number | null;
  price_per_perch: number | null;
  raw_price?: string | null;
  district: string | null;
  city: string | null;
  raw_location: string | null;
  property_type: string | null;
  listing_type: string | null;
  size_perches: number | null;
  size_sqft: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  url: string | null;
  first_seen_at: string | null;
  days_on_market: number | null;
  lat: number | null;
  lng: number | null;
}

export const getListingDetail = (id: number) =>
  fetchJSON<ListingDetail>(`/listings/${id}`);

export const getListingSimilar = (id: number) =>
  fetchJSON<SimilarListing[]>(`/listings/${id}/similar`);

export const getListingPriceHistory = (id: number) =>
  fetchJSON<PriceSnapshot[]>(`/listings/${id}/price-history`);

// --- Price Estimate ---

export interface EstimateResult {
  estimated_low: number | null;
  estimated_median: number | null;
  estimated_high: number | null;
  comparable_count: number;
  confidence: 'high' | 'medium' | 'low' | 'none';
  comparables: SimilarListing[];
}

export const getEstimate = (params: {
  district: string;
  property_type: string;
  size_perches?: number;
  size_sqft?: number;
  bedrooms?: number;
}) => fetchJSON<EstimateResult>('/estimate', params, 'POST');

// --- Exchange Rates ---

export interface ExchangeRates {
  rates: Record<string, number>;
  base: string;
  source: string;
  updated_at: string;
}

export const getExchangeRates = () => fetchJSON<ExchangeRates>('/exchange-rates');

// --- Rental Yield ---

export interface RentalYieldResult {
  available: boolean;
  reason?: string;
  rental_yield_pct?: number | null;
  monthly_rent_estimate?: number | null;
  annual_rent_estimate?: number | null;
  sale_price_median?: number | null;
  data_confidence?: 'high' | 'medium' | 'low';
  sale_sample_count?: number;
  rent_sample_count?: number;
  investment_score?: number;
  district?: string;
  property_type?: string;
  bedrooms?: number | null;
}

export const getRentalYield = (params: {
  district: string;
  property_type: string;
  bedrooms?: number | null;
  deal_score?: number | null;
}) => fetchJSON<RentalYieldResult>('/analytics/rental-yield', params as Record<string, string | number | undefined>);

async function fetchJSON<T>(
  path: string, 
  params?: Record<string, string | number | boolean | any[] | undefined>,
  method: string = 'GET'
): Promise<T> {
  const isPost = method === 'POST';
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (params) {
    if (isPost) {
      options.body = JSON.stringify(params);
    } else {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          url.searchParams.set(k, String(v));
        }
      });
    }
  }

  const res = await fetch(url.toString(), options);
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}
