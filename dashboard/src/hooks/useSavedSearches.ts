import { useState, useEffect } from 'react';

const STORAGE_KEY = 'propertylk_saved_searches';

export interface FilterState {
  district: string;
  type: string;
  listingType: string;
  minPrice: number | '';
  maxPrice: number | '';
  minBeds: number;
  minBaths: number;
  minSizePerches: number | '';
  maxSizePerches: number | '';
  minSizeSqft: number | '';
  maxSizeSqft: number | '';
  sortBy: string;
  source: string;
}

export interface SavedSearch {
  id: string;
  name: string;
  filters: FilterState;
  savedAt: string;
}

function formatPrice(p: number): string {
  if (p >= 1_000_000) return `Rs ${(p / 1_000_000).toFixed(0)}M`;
  if (p >= 1_000) return `Rs ${(p / 1_000).toFixed(0)}K`;
  return `Rs ${p}`;
}

function generateName(f: FilterState): string {
  const parts: string[] = [];
  if (f.type) parts.push(f.type.charAt(0).toUpperCase() + f.type.slice(1) + 's');
  if (f.district) parts.push(`in ${f.district}`);
  if (f.listingType === 'rent') parts.push('for Rent');
  else if (f.listingType === 'sale') parts.push('for Sale');
  if (f.maxPrice !== '') parts.push(`< ${formatPrice(f.maxPrice as number)}`);
  else if (f.minPrice !== '') parts.push(`> ${formatPrice(f.minPrice as number)}`);
  if (f.minBeds > 0) parts.push(`${f.minBeds}+ BR`);
  return parts.length > 0 ? parts.join(' ') : 'My Search';
}

function isDefaultFilters(f: FilterState): boolean {
  return (
    !f.district && !f.type && !f.listingType && !f.source &&
    f.minPrice === '' && f.maxPrice === '' &&
    f.minBeds === 0 && f.minBaths === 0 &&
    f.minSizePerches === '' && f.maxSizePerches === '' &&
    f.minSizeSqft === '' && f.maxSizeSqft === ''
  );
}

export function useSavedSearches() {
  const [searches, setSearches] = useState<SavedSearch[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(searches));
    } catch {
      // localStorage quota exceeded — silently ignore
    }
  }, [searches]);

  const save = (filters: FilterState) => {
    if (isDefaultFilters(filters)) return;
    const newSearch: SavedSearch = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : Date.now().toString(),
      name: generateName(filters),
      filters,
      savedAt: new Date().toISOString(),
    };
    setSearches(prev => [newSearch, ...prev]);
  };

  const remove = (id: string) => {
    setSearches(prev => prev.filter(s => s.id !== id));
  };

  const hasFilters = (filters: FilterState) => !isDefaultFilters(filters);

  return { searches, save, remove, hasFilters };
}
