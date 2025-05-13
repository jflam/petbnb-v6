// Sitter types
export interface Sitter {
  id: number;
  name: string;
  bio: string | null;
  distanceMi: number;
  rateBoarding: number | null;
  rateDaycare: number | null;
  responseTime: number | null; // in minutes
  repeatClient: number | null; // percentage
  avgRating: number;
  reviewCount: number;
  imageUrl: string;
}

export interface SitterDetail extends Sitter {
  location: {
    lat: number;
    lng: number;
    radiusKm: number;
  };
  services: {
    type: string;
    priceDollars: number;
  }[];
  reviews: {
    id: number;
    rating: number;
    comment: string | null;
    date: string;
    owner: {
      id: number;
      name: string;
    };
  }[];
  availability: string[]; // ISO date strings
}

export interface SitterSearchParams {
  lat: number;
  lng: number;
  start: string;
  end: string;
  page?: number;
  pageSize?: number;
  petSize?: string;
  needs?: string[];
  sort?: 'distance' | 'rating' | 'price';
}

export interface SitterSearchResponse {
  results: Sitter[];
  geojson: GeoJSON.FeatureCollection;
  total: number;
  paging: {
    page: number;
    pageSize: number;
    totalPages: number;
  };
  bbox: number[] | null; // [minLng, minLat, maxLng, maxLat] or null
}

// Filter and UI state types
export interface SearchFilters {
  petSize?: string;
  needs: string[];
  priceRange: [number, number];
  sort: 'distance' | 'rating' | 'price';
}

export interface ViewState {
  mode: 'list' | 'map';
  filtersOpen: boolean;
}

// Location search result type
export interface LocationSearchResult {
  display_name: string;
  lat: number;
  lon: number;
}