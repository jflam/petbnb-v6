import { useQuery } from '@tanstack/react-query';
import { searchSitters, getSitterProfile, searchLocation } from '../api/client';
import { SitterSearchParams } from '../types';

/**
 * Hook for searching sitters
 */
export function useSitterSearch(params: SitterSearchParams | null) {
  return useQuery({
    queryKey: ['sitters', 'search', params],
    queryFn: () => (params ? searchSitters(params) : Promise.resolve(null)),
    enabled: !!params,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook for fetching a sitter's profile
 */
export function useSitterProfile(id: number | null) {
  return useQuery({
    queryKey: ['sitters', 'profile', id],
    queryFn: () => (id ? getSitterProfile(id) : Promise.resolve(null)),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook for searching locations
 */
export function useLocationSearch(query: string) {
  return useQuery({
    queryKey: ['location', 'search', query],
    queryFn: () => searchLocation(query),
    enabled: query.length > 2, // Only search if query is long enough
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
  });
}