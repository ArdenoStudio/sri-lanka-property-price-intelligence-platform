import { useState, useEffect } from 'react';
import { formatCurrencyAmount } from '../lib/pricing';

const STORAGE_KEY = 'propertylk_saved_searches';
const STORAGE_VERSION = 2;

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
  lastResultCount: number | null;
  notificationsEnabled: boolean;
  lastCheckedAt: string | null;
}

interface PersistedSavedSearches {
  version: number;
  searches: SavedSearch[];
}

function formatPrice(p: number): string {
  return formatCurrencyAmount(p, 'LKR', { variant: 'table' });
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

function normalizeFilters(filters: Partial<FilterState>): FilterState {
  return {
    district: filters.district ?? '',
    type: filters.type ?? '',
    listingType: filters.listingType ?? '',
    minPrice: filters.minPrice ?? '',
    maxPrice: filters.maxPrice ?? '',
    minBeds: filters.minBeds ?? 0,
    minBaths: filters.minBaths ?? 0,
    minSizePerches: filters.minSizePerches ?? '',
    maxSizePerches: filters.maxSizePerches ?? '',
    minSizeSqft: filters.minSizeSqft ?? '',
    maxSizeSqft: filters.maxSizeSqft ?? '',
    sortBy: filters.sortBy ?? 'newest',
    source: filters.source ?? '',
  };
}

export function getFilterFingerprint(filters: FilterState): string {
  return JSON.stringify(normalizeFilters(filters));
}

function normalizeSavedSearch(raw: Partial<SavedSearch> & { filters?: Partial<FilterState> }): SavedSearch {
  const filters = normalizeFilters(raw.filters ?? {});
  const savedAt = typeof raw.savedAt === 'string' ? raw.savedAt : new Date().toISOString();

  return {
    id:
      typeof raw.id === 'string' && raw.id.trim().length > 0
        ? raw.id
        : (typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : Date.now().toString()),
    name: typeof raw.name === 'string' && raw.name.trim().length > 0 ? raw.name : generateName(filters),
    filters,
    savedAt,
    lastResultCount: typeof raw.lastResultCount === 'number' ? raw.lastResultCount : null,
    notificationsEnabled: Boolean(raw.notificationsEnabled),
    lastCheckedAt: typeof raw.lastCheckedAt === 'string' ? raw.lastCheckedAt : null,
  };
}

function readSavedSearches(): SavedSearch[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as PersistedSavedSearches | SavedSearch[];
    if (Array.isArray(parsed)) {
      return parsed.map(item => normalizeSavedSearch(item));
    }

    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.searches)) {
      return parsed.searches.map(item => normalizeSavedSearch(item));
    }

    return [];
  } catch {
    return [];
  }
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
  const [searches, setSearches] = useState<SavedSearch[]>(() => readSavedSearches());

  useEffect(() => {
    try {
      const payload: PersistedSavedSearches = {
        version: STORAGE_VERSION,
        searches,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // localStorage quota exceeded — silently ignore
    }
  }, [searches]);

  const save = (filters: FilterState, resultCount?: number | null) => {
    if (isDefaultFilters(filters)) return;
    const now = new Date().toISOString();
    const normalizedFilters = normalizeFilters(filters);
    const fingerprint = getFilterFingerprint(normalizedFilters);

    setSearches(prev => {
      const existingIndex = prev.findIndex(search => getFilterFingerprint(search.filters) === fingerprint);

      if (existingIndex >= 0) {
        const existing = prev[existingIndex];
        const updated: SavedSearch = {
          ...existing,
          name: generateName(normalizedFilters),
          filters: normalizedFilters,
          savedAt: now,
          lastResultCount: typeof resultCount === 'number' ? resultCount : existing.lastResultCount,
          lastCheckedAt: typeof resultCount === 'number' ? now : existing.lastCheckedAt,
        };

        return [updated, ...prev.filter((_, index) => index !== existingIndex)];
      }

      const newSearch: SavedSearch = {
        id:
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : Date.now().toString(),
        name: generateName(normalizedFilters),
        filters: normalizedFilters,
        savedAt: now,
        lastResultCount: typeof resultCount === 'number' ? resultCount : null,
        notificationsEnabled: false,
        lastCheckedAt: typeof resultCount === 'number' ? now : null,
      };

      return [newSearch, ...prev];
    });
  };

  const remove = (id: string) => {
    setSearches(prev => prev.filter(s => s.id !== id));
  };

  const toggleNotifications = (id: string) => {
    let nextEnabled = false;

    setSearches(prev =>
      prev.map(search => {
        if (search.id !== id) return search;
        nextEnabled = !search.notificationsEnabled;
        return {
          ...search,
          notificationsEnabled: nextEnabled,
          lastCheckedAt: nextEnabled ? new Date().toISOString() : search.lastCheckedAt,
        };
      })
    );

    return nextEnabled;
  };

  const markSeen = (id: string, resultCount?: number | null) => {
    if (typeof resultCount !== 'number') return;

    const now = new Date().toISOString();
    setSearches(prev =>
      prev.map(search =>
        search.id === id
          ? { ...search, lastResultCount: resultCount, lastCheckedAt: now }
          : search
      )
    );
  };

  const hasFilters = (filters: FilterState) => !isDefaultFilters(filters);
  const getMatchingSearch = (filters: FilterState) => {
    const fingerprint = getFilterFingerprint(filters);
    return searches.find(search => getFilterFingerprint(search.filters) === fingerprint);
  };

  return { searches, save, remove, toggleNotifications, markSeen, hasFilters, getMatchingSearch };
}
