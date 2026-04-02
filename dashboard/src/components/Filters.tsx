import { SlidersHorizontal, X } from 'lucide-react';
import type { District } from '../api';

const PROPERTY_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'land', label: 'Land' },
  { value: 'house', label: 'Houses' },
  { value: 'apartment', label: 'Apartments' },
  { value: 'commercial', label: 'Commercial' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
];

interface Props {
  districts: District[];
  selectedDistrict: string;
  onDistrictChange: (d: string) => void;
  selectedType: string;
  onTypeChange: (t: string) => void;
  sortBy: string;
  onSortChange: (s: string) => void;
  totalResults: number;
}

export function Filters({
  districts,
  selectedDistrict,
  onDistrictChange,
  selectedType,
  onTypeChange,
  sortBy,
  onSortChange,
  totalResults,
}: Props) {
  const hasFilters = selectedDistrict || selectedType;

  return (
    <div className="mb-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-accent-light" />
          <h3 className="text-lg font-bold">Browse Listings</h3>
          <span className="text-xs text-text-muted ml-1">
            {totalResults.toLocaleString()} results
          </span>
        </div>

        {hasFilters && (
          <button
            onClick={() => {
              onDistrictChange('');
              onTypeChange('');
            }}
            className="flex items-center gap-1 text-xs text-danger hover:text-danger/80 transition-colors bg-transparent border-none cursor-pointer"
          >
            <X className="w-3 h-3" /> Clear filters
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* District select */}
        <select
          value={selectedDistrict}
          onChange={(e) => onDistrictChange(e.target.value)}
          className="w-full bg-bg-card border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent appearance-none cursor-pointer"
        >
          <option value="">All Districts</option>
          {districts.map((d) => (
            <option key={d.district} value={d.district}>
              {d.district} ({d.count})
            </option>
          ))}
        </select>

        {/* Property type */}
        <select
          value={selectedType}
          onChange={(e) => onTypeChange(e.target.value)}
          className="w-full bg-bg-card border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent appearance-none cursor-pointer"
        >
          {PROPERTY_TYPES.map((pt) => (
            <option key={pt.value} value={pt.value}>
              {pt.label}
            </option>
          ))}
        </select>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value)}
          className="w-full bg-bg-card border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent appearance-none cursor-pointer"
        >
          {SORT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Active filter pills */}
      {hasFilters && (
        <div className="flex flex-wrap gap-2 mt-3">
          {selectedDistrict && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-accent/15 text-accent-light border border-accent/25">
              {selectedDistrict}
              <button onClick={() => onDistrictChange('')} className="hover:text-white ml-0.5 bg-transparent border-none cursor-pointer text-accent-light">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {selectedType && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-accent/15 text-accent-light border border-accent/25">
              {selectedType}
              <button onClick={() => onTypeChange('')} className="hover:text-white ml-0.5 bg-transparent border-none cursor-pointer text-accent-light">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
