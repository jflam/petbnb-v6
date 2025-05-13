import { create } from 'zustand';
import { ViewState, SearchFilters } from '../types';

interface UIStore {
  // View state
  viewState: ViewState;
  setViewMode: (mode: 'list' | 'map') => void;
  toggleFiltersDrawer: () => void;
  setFiltersOpen: (open: boolean) => void;
  
  // Search filters
  filters: SearchFilters;
  setPetSize: (size: string | undefined) => void;
  toggleNeed: (need: string) => void;
  setPriceRange: (range: [number, number]) => void;
  setSortOption: (sort: 'distance' | 'rating' | 'price') => void;
  resetFilters: () => void;
}

// Default values
const DEFAULT_FILTERS: SearchFilters = {
  petSize: undefined,
  needs: [],
  priceRange: [20, 100],
  sort: 'distance'
};

const DEFAULT_VIEW_STATE: ViewState = {
  mode: 'list',
  filtersOpen: false
};

// Create the store
export const useUIStore = create<UIStore>((set) => ({
  // Initial view state
  viewState: DEFAULT_VIEW_STATE,
  
  setViewMode: (mode) => set((state) => ({
    viewState: { ...state.viewState, mode }
  })),
  
  toggleFiltersDrawer: () => set((state) => ({
    viewState: { ...state.viewState, filtersOpen: !state.viewState.filtersOpen }
  })),
  
  setFiltersOpen: (open) => set((state) => ({
    viewState: { ...state.viewState, filtersOpen: open }
  })),
  
  // Initial filters
  filters: DEFAULT_FILTERS,
  
  setPetSize: (size) => set((state) => ({
    filters: { ...state.filters, petSize: size }
  })),
  
  toggleNeed: (need) => set((state) => {
    const needsSet = new Set(state.filters.needs);
    if (needsSet.has(need)) {
      needsSet.delete(need);
    } else {
      needsSet.add(need);
    }
    return {
      filters: { ...state.filters, needs: Array.from(needsSet) }
    };
  }),
  
  setPriceRange: (range) => set((state) => ({
    filters: { ...state.filters, priceRange: range }
  })),
  
  setSortOption: (sort) => set((state) => ({
    filters: { ...state.filters, sort }
  })),
  
  resetFilters: () => set({ filters: DEFAULT_FILTERS })
}));