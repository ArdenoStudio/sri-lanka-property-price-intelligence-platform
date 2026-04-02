import { useState, useEffect, useCallback } from 'react';
import { getStats, getDistricts, getHeatmap, getListings } from './api';
import type { Stats, District, HeatmapPoint, Listing } from './api';
import { Header } from './components/Header';
import { StatsBar } from './components/StatsBar';
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

function App() {
  // Data state
  const [stats, setStats] = useState<Stats | null>(null);
  const [districts, setDistricts] = useState<District[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapPoint[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [totalListings, setTotalListings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listingsLoading, setListingsLoading] = useState(false);

  // Filter state
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 24;

  // Comparison state
  const [selectedForComparison, setSelectedForComparison] = useState<Listing[]>([]);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

  const toggleComparison = (listing: Listing) => {
    setSelectedForComparison(prev => {
      const isAlreadyAdded = prev.some(l => l.id === listing.id);
      if (isAlreadyAdded) {
        return prev.filter(l => l.id !== listing.id);
      }
      if (prev.length >= 3) return prev; // Limit to 3
      return [...prev, listing];
    });
  };

  // Listings load (depends on filters)
  const loadListings = useCallback(async (isSilent = false) => {
    if (!isSilent) setListingsLoading(true);
    try {
      const res = await getListings({
        district: selectedDistrict || undefined,
        property_type: selectedType || undefined,
        sort: sortBy,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setListings(res.listings);
      setTotalListings(res.total);
    } catch {
      setListings([]);
    }
    if (!isSilent) setListingsLoading(false);
  }, [selectedDistrict, selectedType, sortBy, page]);

  // Initial data load + Polling
  const refreshStatsAndDistricts = useCallback(async () => {
    try {
      const [s, d, h] = await Promise.all([
        getStats().catch(() => null),
        getDistricts().catch(() => []),
        getHeatmap().catch(() => ({ points: [], total_districts: 0 })),
      ]);
      if (s) setStats(s);
      setDistricts(d);
      setHeatmap(h.points);
    } catch (e) {
      console.error("Data sync error:", e);
    }
  }, []);

  useEffect(() => {
    refreshStatsAndDistricts();
    loadListings();

    // Polling every 30 seconds
    const interval = setInterval(() => {
      refreshStatsAndDistricts();
      loadListings(true); // silent refresh
    }, 30000);

    return () => clearInterval(interval);
  }, [refreshStatsAndDistricts, loadListings]);

  // Reset page on filter change
  useEffect(() => {
    setPage(0);
  }, [selectedDistrict, selectedType, sortBy]);

  return (
    <>
      <PageLoader 
        minDuration={3200} 
        onComplete={() => setLoading(false)} 
      />
      
      {!loading && (
        <div className="min-h-screen">
          <Header />

          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
            <StatsBar stats={stats} />

            <MapSection
              points={heatmap}
              onDistrictSelect={(d) => {
                setSelectedDistrict(d);
                document.getElementById('trends')?.scrollIntoView({ behavior: 'smooth' });
              }}
            />

            <div id="trends" className="pt-8">
              <DistrictTrends district={selectedDistrict} propertyType={selectedType} />
            </div>

            <div id="listings" className="pt-8">
              <Filters
                districts={districts}
                selectedDistrict={selectedDistrict}
                onDistrictChange={setSelectedDistrict}
                selectedType={selectedType}
                onTypeChange={setSelectedType}
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

            <About stats={stats} />
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
        </div>
      )}
    </>
  );
}

export default App;
