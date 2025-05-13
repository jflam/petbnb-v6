import React from 'react';
import { Box, ToggleButtonGroup, ToggleButton, Badge, IconButton } from '@mui/material';
import { FilterList, ViewList, Map } from '@mui/icons-material';
import { useUIStore } from '../store/uiStore';

interface ViewToggleProps {
  filtersCount: number;
}

export default function ViewToggle({ filtersCount }: ViewToggleProps) {
  const { viewState, setViewMode, toggleFiltersDrawer } = useUIStore();
  
  // Handle view mode change
  const handleViewChange = (_event: React.MouseEvent<HTMLElement>, newMode: 'list' | 'map' | null) => {
    if (newMode !== null) {
      setViewMode(newMode);
    }
  };
  
  return (
    <Box 
      sx={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        p: 1,
        borderBottom: 1,
        borderColor: 'divider'
      }}
    >
      {/* View mode toggle */}
      <ToggleButtonGroup
        value={viewState.mode}
        exclusive
        onChange={handleViewChange}
        size="small"
        aria-label="view mode"
      >
        <ToggleButton value="list" aria-label="list view">
          <ViewList fontSize="small" />
        </ToggleButton>
        <ToggleButton value="map" aria-label="map view">
          <Map fontSize="small" />
        </ToggleButton>
      </ToggleButtonGroup>
      
      {/* Filter button with active filter count badge */}
      <Badge 
        badgeContent={filtersCount} 
        color="primary"
        invisible={filtersCount === 0}
      >
        <IconButton 
          onClick={toggleFiltersDrawer} 
          size="small"
          color={viewState.filtersOpen ? 'primary' : 'default'}
        >
          <FilterList />
        </IconButton>
      </Badge>
    </Box>
  );
}