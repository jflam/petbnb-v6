import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Box, Container, Paper } from '@mui/material';
import { format } from 'date-fns';
import { useSitterSearch } from '../hooks/useQueryHooks';
import { useUIStore } from '../store/uiStore';
import { SitterSearchParams, Sitter } from '../types';
import SearchBar from '../components/SearchBar';
import FiltersDrawer from '../components/FiltersDrawer';
import ViewToggle from '../components/ViewToggle';
import ResultsList from '../components/ResultsList';
import MapView from '../components/MapView';

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Get view state and filters from store
  const { viewState, filters } = useUIStore();
  
  // State for pagination
  const [page, setPage] = useState(1);
  const [allResults, setAllResults] = useState<Sitter[]>([]);
  
  // Parse search parameters from URL
  const lat = parseFloat(searchParams.get('lat') || '47.6097');
  const lng = parseFloat(searchParams.get('lng') || '-122.3331');
  const start = searchParams.get('start') || format(new Date(), 'yyyy-MM-dd');
  const end = searchParams.get('end') || format(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
  const locationName = searchParams.get('location') || 'Seattle, WA';
  
  // Build search params object
  const searchQueryParams: SitterSearchParams = {
    lat,
    lng,
    start,
    end,
    page,
    pageSize: 10,
    petSize: filters.petSize,
    needs: filters.needs.length > 0 ? filters.needs : undefined,
    sort: filters.sort
  };
  
  // Query for sitters
  const { 
    data: searchResults, 
    isLoading, 
    refetch 
  } = useSitterSearch(searchQueryParams);
  
  // Update all results when data changes
  useEffect(() => {
    if (searchResults) {
      if (page === 1) {
        // Replace results on first page
        setAllResults(searchResults.results);
      } else {
        // Append results for subsequent pages
        setAllResults(prev => [...prev, ...searchResults.results]);
      }
    }
  }, [searchResults, page]);
  
  // Count active filters
  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.petSize) count++;
    if (filters.needs.length > 0) count += filters.needs.length;
    if (filters.priceRange[0] > 20 || filters.priceRange[1] < 100) count++;
    if (filters.sort !== 'distance') count++;
    return count;
  };
  
  // Handle search submission
  const handleSearch = (location: { lat: number; lng: number }, dates: { start: Date; end: Date }) => {
    // Reset pagination on new search
    setPage(1);
    
    // Update URL params
    setSearchParams({
      lat: location.lat.toString(),
      lng: location.lng.toString(),
      start: format(dates.start, 'yyyy-MM-dd'),
      end: format(dates.end, 'yyyy-MM-dd'),
      location: locationName
    });
  };
  
  // Handle filter application
  const handleApplyFilters = () => {
    // Reset pagination when filters change
    setPage(1);
    refetch();
  };
  
  // Handle loading more results
  const handleLoadMore = () => {
    setPage(prevPage => prevPage + 1);
  };
  
  // Handle selecting a sitter
  const handleSitterSelect = (sitter: Sitter) => {
    navigate(`/sitter/${sitter.id}`);
  };
  
  return (
    <Container maxWidth="lg" sx={{ py: 2, height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Search Bar */}
      <Paper elevation={2} sx={{ mb: 2 }}>
        <SearchBar 
          onSearch={handleSearch}
          initialLocation={{ lat, lng, display: locationName }}
          initialDates={{
            start: new Date(start),
            end: new Date(end)
          }}
        />
      </Paper>
      
      {/* Results Section */}
      <Paper 
        elevation={1} 
        sx={{ 
          flexGrow: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* View mode toggle */}
        <ViewToggle filtersCount={getActiveFiltersCount()} />
        
        {/* Results content based on view mode */}
        <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
          {viewState.mode === 'list' ? (
            <ResultsList
              results={allResults}
              loading={isLoading}
              hasMore={!!searchResults && page < searchResults.paging.totalPages}
              onLoadMore={handleLoadMore}
              onSitterSelect={handleSitterSelect}
            />
          ) : (
            <MapView
              results={allResults}
              geoJSON={searchResults?.geojson || { type: 'FeatureCollection', features: [] }}
              bbox={searchResults?.bbox || null}
              onSitterSelect={handleSitterSelect}
            />
          )}
        </Box>
      </Paper>
      
      {/* Filters Drawer */}
      <FiltersDrawer onApplyFilters={handleApplyFilters} />
    </Container>
  );
}