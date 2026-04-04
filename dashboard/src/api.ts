const API_BASE = import.meta.env.VITE_API_URL || '/api';

// ---------- Types ----------

export interface Stats {
  total_listings: number;
  listings_last_7_days: number;
  avg_price_lkr: number | null;
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
  price_per_perch: number | null;
  raw_price?: string | null;
  district: string | null;
  city: string | null;
  raw_location: string | null;
  property_type: string | null;
  listing_type: string | null;
  size_perches: number | null;
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

export const getHeatmap = (propertyType?: string) =>
  fetchJSON<HeatmapResponse>('/heatmap', { property_type: propertyType });

export const getListings = (params: {
  district?: string;
  property_type?: string;
  listing_type?: string;
  min_price?: number;
  max_price?: number;
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
