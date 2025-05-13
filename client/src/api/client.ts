import { SitterSearchParams, SitterSearchResponse, SitterDetail } from '../types';

// Get API base URL from environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

/**
 * Search for sitters based on location, dates, and filters
 */
export async function searchSitters(params: SitterSearchParams): Promise<SitterSearchResponse> {
  // Build query string
  const queryParams = new URLSearchParams();
  
  // Add required params
  queryParams.append('lat', params.lat.toString());
  queryParams.append('lng', params.lng.toString());
  queryParams.append('start', params.start);
  queryParams.append('end', params.end);
  
  // Add optional params
  if (params.page) queryParams.append('page', params.page.toString());
  if (params.pageSize) queryParams.append('pageSize', params.pageSize.toString());
  if (params.petSize) queryParams.append('petSize', params.petSize);
  if (params.needs && params.needs.length > 0) {
    params.needs.forEach(need => queryParams.append('needs', need));
  }
  if (params.sort) queryParams.append('sort', params.sort);
  
  // Make request
  const response = await fetch(`${API_BASE_URL}/api/sitters/search?${queryParams}`);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error searching for sitters: ${errorText}`);
  }
  
  return response.json();
}

/**
 * Get a single sitter's detailed profile
 */
export async function getSitterProfile(id: number): Promise<SitterDetail> {
  const response = await fetch(`${API_BASE_URL}/api/sitters/${id}`);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error fetching sitter profile: ${errorText}`);
  }
  
  return response.json();
}

/**
 * Search for a location using the OpenStreetMap Nominatim API
 */
export async function searchLocation(query: string) {
  if (!query) return [];
  
  // Use Nominatim for geocoding (free, no API key required)
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`
  );
  
  if (!response.ok) {
    throw new Error('Location search failed');
  }
  
  return response.json();
}