import { useState, useEffect, useCallback } from 'react';
import { getStats, getDistricts, getHeatmap, getListings, getPipelineStatus } from './api';
import type { Stats, District, HeatmapPoint, Listing, PipelineStatusResponse } from './api';
import { Header } from './components/Header';
import { StatsBar } from './components/StatsBar';
import { PipelineStatus } from './components/PipelineStatus';
import { MapSection } from './components/MapSection';
import { Filters } from './components/Filters';
import { ListingsGrid } from './components/ListingsGrid';
import { About } from './components/About';
import { Footer } from './components/Footer';
import { DistrictTrends } from './components/DistrictTrends';
import { ComparisonTray } from './components/ComparisonTray';
import { ComparisonModal } from './components/ComparisonModal';
import { PageLoader } from './components/PageLoader';
import { ChatWidget } from './components/ChatWidget';
import { NoiseOverlay } from './components/NoiseOverlay';
import { ScrollProgressBar } from './components/ScrollProgressBar';
import { RevealSection } from './components/RevealSection';
import { Analytics } from '@vercel/analytics/react';

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
  };
}

function App() {
  // Data state
  const [stats, setStats] = useState<Stats | null>(null);
  const [districts, setDistricts] = useState<District[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapPoint[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [totalListings, setTotalListings] = useState(0);
  const [pipeline, setPipeline] = useState<PipelineStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [listingsLoading, setListingsLoading] = useState(false);

  // Filter state — seeded from URL on mount
  const initialFilters = readURLFilters();
  const [selectedDistrict, setSelectedDistrict] = useState(initialFilters.district);
  const [selectedType, setSelectedType] = useState(initialFilters.type);
  const [listingType, setListingType] = useState(initialFilters.listingType);
  const [minPrice, setMinPrice] = useState<number | ''>(initialFilters.minPrice);
  const [maxPrice, setMaxPrice] = useState<number | ''>(initialFilters.maxPrice);
  const [minBeds, setMinBeds] = useState(initialFilters.minBeds);
  const [minBaths, setMinBaths] = useState(initialFilters.minBaths);
  const [minSizePerches, setMinSizePerches] = useState<number | ''>(initialFilters.minSizePerches);
  const [maxSizePerches, setMaxSizePerches] = useState<number | ''>(initialFilters.maxSizePerches);
  const [minSizeSqft, setMinSizeSqft] = useState<number | ''>(initialFilters.minSizeSqft);
  const [maxSizeSqft, setMaxSizeSqft] = useState<number | ''>(initialFilters.maxSizeSqft);
  const [sortBy, setSortBy] = useState(initialFilters.sortBy);
  const [page, setPage] = useState(0);

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
    const qs = p.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [selectedDistrict, selectedType, listingType, minPrice, maxPrice, minBeds, minBaths, minSizePerches, maxSizePerches, minSizeSqft, maxSizeSqft, sortBy]);

  const PAGE_SIZE = 24;

  // Comparison state
  const [selectedForComparison, setSelectedForComparison] = useState<Listing[]>([]);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

  const toggleComparison = (listing: Listing) => {
    setSelectedForComparison(prev => {
      const isAlreadyAdded = prev.some(l => l.id === listing.id);
      if (isAlreadyAdded) return prev.filter(l => l.id !== listing.id);
      if (prev.length >= 3) return prev;
      return [...prev, listing];
    });
  };

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
  }, [selectedDistrict, selectedType, listingType, minPrice, maxPrice, minBeds, minBaths, minSizePerches, maxSizePerches, minSizeSqft, maxSizeSqft, sortBy, page]);

  // Initial data load + polling
  const refreshStatsAndDistricts = useCallback(async () => {
    try {
      const [s, d, h, p] = await Promise.all([
        getStats().catch(() => null),
        getDistricts().catch(() => []),
        getHeatmap(selectedType || undefined, listingType || undefined).catch(() => ({ points: [], total_districts: 0 })),
        getPipelineStatus().catch(() => null),
      ]);
      if (s) setStats(s);
      setDistricts(d);
      setHeatmap(h.points);
      if (p) setPipeline(p);
    } catch (e) {
      console.error('Data sync error:', e);
    }
  }, [selectedType, listingType]);

  useEffect(() => {
    refreshStatsAndDistricts();
    loadListings();

    const interval = setInterval(() => {
      refreshStatsAndDistricts();
      loadListings(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [refreshStatsAndDistricts, loadListings]);

  // Reset page on filter change
  useEffect(() => {
    setPage(0);
  }, [selectedDistrict, selectedType, listingType, minPrice, maxPrice, minBeds, minBaths, minSizePerches, maxSizePerches, minSizeSqft, maxSizeSqft, sortBy]);

  return (
    <>
      {/* Global ambient components — always rendered */}
      <NoiseOverlay />
      <ScrollProgressBar />

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
              <MapSection
                points={heatmap}
                onDistrictSelect={(d) => setSelectedDistrict(d)}
              />
            </RevealSection>

            <RevealSection className="pt-20" delay={50}>
              <div id="trends">
                <DistrictTrends district={selectedDistrict} propertyType={selectedType} />
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
                  totalResults={totalListings}
                />

                <ListingsGrid
                  listings={listings}
                  loading={listingsLoading}
                  page={page}
                  pageSize={PAGE_SIZE}
                  total={totalListings}
                  onPageChange={setPage}
                  onCompareToggle={toggleComparison}
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

          <ComparisonModal
            isOpen={isCompareModalOpen}
            onClose={() => setIsCompareModalOpen(false)}
            listings={selectedForComparison}
          />

          <ChatWidget />
          <Footer />
          <Analytics />
        </div>
      )}
    </>
  );
}

export default App;
