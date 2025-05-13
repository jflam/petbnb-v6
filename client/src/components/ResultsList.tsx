import React, { useRef, useEffect } from 'react';
import { Box, Typography, CircularProgress, Button } from '@mui/material';
import { FixedSizeList as List } from 'react-window';
import { Sitter } from '../types';
import SitterCard from './SitterCard';

interface ResultsListProps {
  results: Sitter[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onSitterSelect: (sitter: Sitter) => void;
}

export default function ResultsList({ 
  results, 
  loading, 
  hasMore, 
  onLoadMore, 
  onSitterSelect 
}: ResultsListProps) {
  const listRef = useRef<List>(null);
  
  // Reset list scroll position when results change
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTo(0);
    }
  }, [results]);
  
  // If no results
  if (!loading && results.length === 0) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        p: 4,
        height: '100%'
      }}>
        <Typography variant="h6" textAlign="center">
          No sitters found for your search criteria.
        </Typography>
        <Typography color="text.secondary" textAlign="center" sx={{ mt: 1 }}>
          Try adjusting your filters or searching in a different location.
        </Typography>
      </Box>
    );
  }
  
  // Row renderer for virtualized list
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    // Special row for loading more
    if (index === results.length) {
      return (
        <Box style={style} sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
          {loading ? (
            <CircularProgress size={24} />
          ) : (
            hasMore && (
              <Button onClick={onLoadMore} variant="outlined">
                Load More
              </Button>
            )
          )}
        </Box>
      );
    }
    
    // Regular sitter row
    return (
      <Box style={style} sx={{ px: 2 }}>
        <SitterCard 
          sitter={results[index]} 
          onClick={onSitterSelect}
        />
      </Box>
    );
  };
  
  return (
    <Box sx={{ height: '100%', width: '100%' }}>
      {/* Results count */}
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="subtitle1">
          {results.length > 0 ? `${results.length} sitters found` : ''}
        </Typography>
      </Box>
      
      {/* Virtualized list of results */}
      {results.length > 0 && (
        <List
          ref={listRef}
          height={window.innerHeight - 220} // Adjust based on your layout
          width="100%"
          itemCount={results.length + (hasMore ? 1 : 0)} // Add extra row for load more button
          itemSize={230} // Adjust based on your card height
          overscanCount={2}
        >
          {Row}
        </List>
      )}
      
      {/* Loading indicator for initial load */}
      {loading && results.length === 0 && (
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          height: 'calc(100% - 60px)' 
        }}>
          <CircularProgress />
        </Box>
      )}
    </Box>
  );
}