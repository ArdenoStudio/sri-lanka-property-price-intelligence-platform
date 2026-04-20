import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import type { FilterState } from './hooks/useSavedSearches';
import { Routes, Route } from 'react-router-dom';
import { getStats, getDistricts, getHeatmap, getListings, getPipelineStatus } from './api';
import type { Stats, District, HeatmapPoint, Listing, PipelineStatusResponse } from './api';
import { Header } from './components/Header';
import { StatsBar } from './components/StatsBar';
import { PipelineStatus } from './components/PipelineStatus';
import { Filters } from './components/Filters';
import { ListingsGrid } from './components/ListingsGrid';
import { About } from './components/About';
import { Footer } from './components/Footer';
import { ComparisonTray } from './components/ComparisonTray';
import { PageLoader } from './components/PageLoader';
import { NoiseOverlay } from './components/NoiseOverlay';
import { ScrollProgressBar } from './components/ScrollProgressBar';
import { RevealSection } from './components/RevealSection';
import { MobileNav } from './components/MobileNav';
import { Analytics } from '@vercel/analytics/react';

// ── Lazy-loaded heavy components ──────────────────────────────────────────────
const MapSection = lazy(() =>
  import('./components/MapSection').then(m => ({ default: m.MapSection }))
);
const DistrictTrends = lazy(() =>
  import('./components/DistrictTrends').then(m => ({ default: m.DistrictTrends }))
);
const ComparisonModal = lazy(() =>
  import('./components/ComparisonModal').then(m => ({ default: m.ComparisonModal }))
);
const ChatWidget = lazy(() =>
  import('./components/ChatWidget').then(m => ({ default: m.ChatWidget }))
);
const ListingDetail = lazy(() =>
  import('./components/ListingDetail').then(m => ({ default: m.ListingDetail }))
);
const EstimateTool = lazy(() =>
  import('./components/EstimateTool').then(m => ({ default: m.EstimateTool }))
);
const SavedSearches = lazy(() =>
  import('./components/SavedSearches').then(m => ({ default: m.SavedSearches }))
);

// ── Skeleton fallbacks ────────────────────────────────────────────────────────
function MapSkeleton() {
  return (
    <section className="mt-4 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="h-3 w-24 bg-white/[0.05] rounded mb-2" />
          <div className="h-2.5 w-48 bg-white/[0.05] rounded" />
        </div>
      </div>
      <div className="card overflow-hidden" style={{ height: 420 }}>
        <div className="h-full w-full bg-[#0a0a0a] animate-pulse flex items-center justify-center">
          <p className="text-[11px] text-[#2e2e2e] uppercase tracking-widest">Loading map…</p>
        </div>
      </div>
    </section>
  );
}

function TrendsSkeleton() {
  return (
    <div className="card p-6 mb-8">
      <div className="h-3 w-20 bg-white/[0.05] rounded mb-3" />
      <div className="h-8 w-40 bg-white/[0.05] rounded mb-6" />
      <div className="h-[300px] bg-[#0a0a0a] rounded-2xl animate-pulse" />
    </div>
  );
}

function ModalSkeleton() {
  return null; // Modal is hidden by default, no visual skeleton needed
}

function ChatSkeleton() {
  return null; // Chat FAB appears on demand, no visual skeleton needed
}

function PageSkeleton() {
  return <div className="min-h-screen bg-black" />;
}

function readURLFilters() {
  const p = new URLSearchParams(window.location.search);
  const n = (k: string) => p.get(k) ? Number(p.get(k)) : ('' as number | '');
  return {
    district:       p.get('district') || '',
    type:           p.get('type') || '',
    listingType:    p.get('listing_type') || '',
    minPrice:       n('min_price'),
    maxPrice:       n('max_price'),
    minBeds:        p.get('min_beds')  ? Number(p.get('min_beds'))  : 0,
    minBaths:       p.get('min_baths') ? Number(p.get('min_baths')) : 0,
    minSizePerches: n('min_size_p'),
    maxSizePerches: n('max_size_p'),
    minSizeSqft:    n('min_size_sqft'),
    maxSizeSqft:    n('max_size_sqft'),
    sortBy:         p.get('sort') || 'newest',
    source:         p.get('source') || '',
  };
}

// ── Dashboard (home route) ────────────────────────────────────────────────────
function Dashboard() {
  // Data state
  const [stats, setStats] = useState<Stats | null>(null);
  const [districts, setDistricts] = useState<District[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapPoint[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [totalListings, setTotalListings] = useState(0);
  const [pipeline, setPipeline] = useState<PipelineStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [listingsLoading, setListingsLoading] = useState(false);

  // Filter state — seeded from URL on mount (lazy initializers avoid re-reading on re-render)
  const [selectedDistrict, setSelectedDistrict] = useState(() => readURLFilters().district);
  const [selectedType, setSelectedType] = useState(() => readURLFilters().type);
  const [listingType, setListingType] = useState(() => readURLFilters().listingType);
  const [minPrice, setMinPrice] = useState<number | ''>(() => readURLFilters().minPrice);
  const [maxPrice, setMaxPrice] = useState<number | ''>(() => readURLFilters().maxPrice);
  const [minBeds, setMinBeds] = useState(() => readURLFilters().minBeds);
  const [minBaths, setMinBaths] = useState(() => readURLFilters().minBaths);
  const [minSizePerches, setMinSizePerches] = useState<number | ''>(() => readURLFilters().minSizePerches);
  const [maxSizePerches, setMaxSizePerches] = useState<number | ''>(() => readURLFilters().maxSizePerches);
  const [minSizeSqft, setMinSizeSqft] = useState<number | ''>(() => readURLFilters().minSizeSqft);
  const [maxSizeSqft, setMaxSizeSqft] = useState<number | ''>(() => readURLFilters().maxSizeSqft);
  const [sortBy, setSortBy] = useState(() => readURLFilters().sortBy);
  const [selectedSource, setSelectedSource] = useState(() => readURLFilters().source);
  const [page, setPage] = useState(0);

  // Saved searches panel state
  const [isSavedSearchesOpen, setIsSavedSearchesOpen] = useState(false);

  // Memoized current filter state for saved searches
  const currentFilters = useMemo(() => ({
    district: selectedDistrict,
    type: selectedType,
    listingType,
    minPrice,
    maxPrice,
    minBeds,
    minBaths,
    minSizePerches,
    maxSizePerches,
    minSizeSqft,
    maxSizeSqft,
    sortBy,
    source: selectedSource,
  }), [selectedDistrict, selectedType, listingType, minPrice, maxPrice, minBeds, minBaths,
      minSizePerches, maxSizePerches, minSizeSqft, maxSizeSqft, sortBy, selectedSource]);

  // Keep URL in sync with filters
  useEffect(() => {
    const p = new URLSearchParams();
    if (selectedDistrict) p.set('district', selectedDistrict);
    if (selectedType) p.set('type', selectedType);
    if (listingType) p.set('listing_type', listingType);
    if (minPrice !== '') p.set('min_price', String(minPrice));
    if (maxPrice !== '') p.set('max_price', String(maxPrice));
    if (minBeds > 0) p.set('min_beds', String(minBeds));
    if (minBaths > 0) p.set('min_baths', String(minBaths));
    if (minSizePerches !== '') p.set('min_size_p', String(minSizePerches));
    if (maxSizePerches !== '') p.set('max_size_p', String(maxSizePerches));
    if (minSizeSqft !== '') p.set('min_size_sqft', String(minSizeSqft));
    if (maxSizeSqft !== '') p.set('max_size_sqft', String(maxSizeSqft));
    if (sortBy && sortBy !== 'newest') p.set('sort', sortBy);
    if (selectedSource) p.set('source', selectedSource);
    const qs = p.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [selectedDistrict, selectedType, listingType, minPrice, maxPrice, minBeds, minBaths, minSizePerches, maxSizePerches, minSizeSqft, maxSizeSqft, sortBy, selectedSource]);

  const PAGE_SIZE = 24;

  // Comparison state
  const [selectedForComparison, setSelectedForComparison] = useState<Listing[]>([]);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

  // Clear size filters when property type changes (sqft vs perches units are incompatible)
  useEffect(() => {
    setMinSizePerches(''); setMaxSizePerches('');
    setMinSizeSqft('');    setMaxSizeSqft('');
  }, [selectedType]);

  // Listings load (depends on filters)
  const loadListings = useCallback(async (isSilent = false) => {
    if (!isSilent) setListingsLoading(true);
    try {
      const res = await getListings({
        district:          selectedDistrict || undefined,
        property_type:     selectedType || undefined,
        listing_type:      listingType || undefined,
        source:            selectedSource || undefined,
        min_price:         minPrice !== '' ? minPrice : undefined,
        max_price:         maxPrice !== '' ? maxPrice : undefined,
        min_bedrooms:      minBeds > 0  ? minBeds  : undefined,
        min_bathrooms:     minBaths > 0 ? minBaths : undefined,
        min_size_perches:  minSizePerches !== '' ? minSizePerches : undefined,
        max_size_perches:  maxSizePerches !== '' ? maxSizePerches : undefined,
        min_size_sqft:     minSizeSqft !== '' ? minSizeSqft : undefined,
        max_size_sqft:     maxSizeSqft !== '' ? maxSizeSqft : undefined,
        sort:              sortBy,
        limit:             PAGE_SIZE,
        offset:            page * PAGE_SIZE,
      });
      setListings(res.listings);
      setTotalListings(res.total);
    } catch {
      setListings([]);
    }
    if (!isSilent) setListingsLoading(false);
  }, [selectedDistrict, selectedType, listingType, minPrice, maxPrice, minBeds, minBaths, minSizePerches, maxSizePerches, minSizeSqft, maxSizeSqft, sortBy, selectedSource, page]);

  // Initial data load + polling
  const loadCritical = useCallback(async () => {
    try {
      const [s, d] = await Promise.all([
        getStats().catch(() => null),
        getDistricts().catch(() => []),
      ]);
      if (s) setStats(s);
      setDistricts(d);
    } catch (e) {
      console.error('Critical data load error:', e);
    }
  }, []);

  const loadDeferred = useCallback(async () => {
    try {
      const [h, p] = await Promise.all([
        getHeatmap(selectedType || undefined, listingType || undefined).catch(() => ({ points: [], total_districts: 0 })),
        getPipelineStatus().catch(() => null),
      ]);
      setHeatmap(h.points);
      if (p) setPipeline(p);
    } catch (e) {
      console.error('Deferred data load error:', e);
    }
  }, [selectedType, listingType]);

  useEffect(() => {
    loadCritical();
    loadListings();

    const scheduleDeferred = () => {
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => loadDeferred());
      } else {
        setTimeout(() => loadDeferred(), 200);
      }
    };
    scheduleDeferred();

    const interval = setInterval(() => {
      loadCritical();
      loadDeferred();
      loadListings(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [loadCritical, loadDeferred, loadListings]);

  // Reset page on filter change
  useEffect(() => {
    setPage(0);
  }, [selectedDistrict, selectedType, listingType, minPrice, maxPrice, minBeds, minBaths, minSizePerches, maxSizePerches, minSizeSqft, maxSizeSqft, sortBy, selectedSource]);

  // Apply a saved search — restores all filter state
  const applySearch = useCallback((f: FilterState) => {
    setSelectedDistrict(f.district);
    setSelectedType(f.type);
    setListingType(f.listingType);
    setMinPrice(f.minPrice);
    setMaxPrice(f.maxPrice);
    setMinBeds(f.minBeds);
    setMinBaths(f.minBaths);
    setMinSizePerches(f.minSizePerches);
    setMaxSizePerches(f.maxSizePerches);
    setMinSizeSqft(f.minSizeSqft);
    setMaxSizeSqft(f.maxSizeSqft);
    setSortBy(f.sortBy);
    setSelectedSource(f.source);
    setIsSavedSearchesOpen(false);
  }, []);

  return (
    <>
      <PageLoader
        minDuration={1800}
        onComplete={() => setLoading(false)}
      />

      {!loading && (
        <div className="min-h-screen relative overflow-x-hidden">
          <Header />

          <main className="relative max-w-7xl mx-auto px-6 lg:px-8 pb-32 pt-24">
            <StatsBar stats={stats} />

            <RevealSection className="mt-4">
              <PipelineStatus status={pipeline} />
            </RevealSection>

            <RevealSection className="mt-8">
              <Suspense fallback={<MapSkeleton />}>
                <MapSection
                  points={heatmap}
                  onDistrictSelect={(d) => setSelectedDistrict(d)}
                  selectedDistrict={selectedDistrict}
                />
              </Suspense>
            </RevealSection>

            <RevealSection className="pt-20" delay={50}>
              <div id="trends">
                <Suspense fallback={<TrendsSkeleton />}>
                  <DistrictTrends district={selectedDistrict} propertyType={selectedType} />
                </Suspense>
              </div>
            </RevealSection>

            <RevealSection className="pt-20">
              <div id="listings">
                <Filters
                  districts={districts}
                  selectedDistrict={selectedDistrict}
                  onDistrictChange={setSelectedDistrict}
                  selectedType={selectedType}
                  onTypeChange={setSelectedType}
                  listingType={listingType}
                  onListingTypeChange={setListingType}
                  minPrice={minPrice}
                  onMinPriceChange={setMinPrice}
                  maxPrice={maxPrice}
                  onMaxPriceChange={setMaxPrice}
                  minBeds={minBeds}
                  onMinBedsChange={setMinBeds}
                  minBaths={minBaths}
                  onMinBathsChange={setMinBaths}
                  minSizePerches={minSizePerches}
                  maxSizePerches={maxSizePerches}
                  onMinSizePerchesChange={setMinSizePerches}
                  onMaxSizePerchesChange={setMaxSizePerches}
                  minSizeSqft={minSizeSqft}
                  maxSizeSqft={maxSizeSqft}
                  onMinSizeSqftChange={setMinSizeSqft}
                  onMaxSizeSqftChange={setMaxSizeSqft}
                  sortBy={sortBy}
                  onSortChange={setSortBy}
                  selectedSource={selectedSource}
                  onSourceChange={setSelectedSource}
                  totalResults={totalListings}
                  onOpenSavedSearches={() => setIsSavedSearchesOpen(true)}
                />

                <ListingsGrid
                  listings={listings}
                  loading={listingsLoading}
                  page={page}
                  pageSize={PAGE_SIZE}
                  total={totalListings}
                  onPageChange={setPage}
                  selectedForComparison={selectedForComparison.map(l => l.id)}
                />
              </div>
            </RevealSection>

            <RevealSection className="pt-20">
              <About stats={stats} />
            </RevealSection>
          </main>

          <ComparisonTray
            selected={selectedForComparison}
            onRemove={(id) => setSelectedForComparison(prev => prev.filter(l => l.id !== id))}
            onClear={() => setSelectedForComparison([])}
            onCompare={() => setIsCompareModalOpen(true)}
          />

          <Suspense fallback={<ModalSkeleton />}>
            <ComparisonModal
              isOpen={isCompareModalOpen}
              onClose={() => setIsCompareModalOpen(false)}
              listings={selectedForComparison}
            />
          </Suspense>

          <Suspense fallback={null}>
            <SavedSearches
              isOpen={isSavedSearchesOpen}
              onClose={() => setIsSavedSearchesOpen(false)}
              currentFilters={currentFilters}
              onApplySearch={applySearch}
            />
          </Suspense>

          <Suspense fallback={<ChatSkeleton />}>
            <ChatWidget onFilters={(f) => {
              if (f.district) setSelectedDistrict(f.district);
              if (f.property_type) setSelectedType(f.property_type);
              if (f.listing_type) setListingType(f.listing_type);
              if (f.bedrooms) setMinBeds(f.bedrooms);
              if (f.min_price) setMinPrice(f.min_price);
              if (f.max_price) setMaxPrice(f.max_price);
            }} />
          </Suspense>
          <MobileNav />
          <Footer />
        </div>
      )}
    </>
  );
}

// ── App shell with routing ────────────────────────────────────────────────────
function App() {
  return (
    <>
      <NoiseOverlay />
      <ScrollProgressBar />
      <Analytics />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route
          path="/listing/:id"
          element={
            <Suspense fallback={<PageSkeleton />}>
              <ListingDetail />
            </Suspense>
          }
        />
        <Route
          path="/estimate"
          element={
            <Suspense fallback={<PageSkeleton />}>
              <EstimateTool />
            </Suspense>
          }
        />
      </Routes>
    </>
  );
}

export default App;
