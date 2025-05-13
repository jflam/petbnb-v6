import React from 'react';
import { 
  Drawer, 
  Box, 
  Typography, 
  Divider, 
  FormControl, 
  FormLabel, 
  RadioGroup, 
  FormControlLabel, 
  Radio, 
  Checkbox, 
  Slider, 
  Chip, 
  Button, 
  IconButton,
  useMediaQuery,
  useTheme
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useUIStore } from '../store/uiStore';

// Predefined needs/special requirements
const SPECIAL_NEEDS = [
  { id: 'medication', label: 'Medication' },
  { id: 'senior', label: 'Senior Pet' },
  { id: 'anxiety', label: 'Anxiety' },
  { id: 'dietary_restrictions', label: 'Dietary Restrictions' },
  { id: 'requires_exercise', label: 'Requires Exercise' },
  { id: 'not_house_trained', label: 'Not House Trained' },
  { id: 'separation_anxiety', label: 'Separation Anxiety' }
];

// Pet size options
const PET_SIZES = [
  { value: 'XS', label: 'X-Small (0-10 lbs)' },
  { value: 'S', label: 'Small (10-20 lbs)' },
  { value: 'M', label: 'Medium (20-50 lbs)' },
  { value: 'L', label: 'Large (50-90 lbs)' },
  { value: 'XL', label: 'X-Large (90+ lbs)' }
];

// Sort options
const SORT_OPTIONS = [
  { value: 'distance', label: 'Distance' },
  { value: 'rating', label: 'Rating' },
  { value: 'price', label: 'Price: Low to High' }
];

interface FiltersDrawerProps {
  onApplyFilters: () => void;
}

export default function FiltersDrawer({ onApplyFilters }: FiltersDrawerProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // Get filter state and actions from store
  const { 
    viewState, 
    filters, 
    setFiltersOpen, 
    setPetSize,
    toggleNeed,
    setPriceRange,
    setSortOption,
    resetFilters
  } = useUIStore();
  
  // Handle price range change
  const handlePriceChange = (_event: Event, newValue: number | number[]) => {
    setPriceRange(newValue as [number, number]);
  };
  
  // Handle apply button click
  const handleApply = () => {
    onApplyFilters();
    if (isMobile) {
      setFiltersOpen(false);
    }
  };
  
  // Handle reset button click
  const handleReset = () => {
    resetFilters();
  };
  
  return (
    <Drawer
      anchor={isMobile ? 'bottom' : 'right'}
      open={viewState.filtersOpen}
      onClose={() => setFiltersOpen(false)}
      PaperProps={{
        sx: {
          width: isMobile ? '100%' : 320,
          height: isMobile ? '80%' : '100%',
          p: 3
        }
      }}
    >
      {/* Header with close button */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">Filters</Typography>
        <IconButton onClick={() => setFiltersOpen(false)}>
          <CloseIcon />
        </IconButton>
      </Box>
      
      <Divider sx={{ mb: 3 }} />
      
      {/* Pet Size */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
          Pet Size
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {PET_SIZES.map((size) => (
            <Chip
              key={size.value}
              label={size.label}
              clickable
              color={filters.petSize === size.value ? 'primary' : 'default'}
              onClick={() => setPetSize(filters.petSize === size.value ? undefined : size.value)}
            />
          ))}
        </Box>
      </Box>
      
      {/* Special Needs */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
          Special Requirements
        </Typography>
        <Box>
          {SPECIAL_NEEDS.map((need) => (
            <FormControlLabel
              key={need.id}
              control={
                <Checkbox
                  checked={filters.needs.includes(need.id)}
                  onChange={() => toggleNeed(need.id)}
                />
              }
              label={need.label}
            />
          ))}
        </Box>
      </Box>
      
      {/* Price Range */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
          Price Range (per night)
        </Typography>
        <Box sx={{ px: 1 }}>
          <Slider
            value={filters.priceRange}
            onChange={handlePriceChange}
            valueLabelDisplay="auto"
            min={20}
            max={100}
            step={5}
            valueLabelFormat={(value) => `$${value}`}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">
              ${filters.priceRange[0]}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              ${filters.priceRange[1]}
            </Typography>
          </Box>
        </Box>
      </Box>
      
      {/* Sort Options */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
          Sort Results By
        </Typography>
        <FormControl component="fieldset">
          <RadioGroup 
            value={filters.sort} 
            onChange={(e) => setSortOption(e.target.value as 'distance' | 'rating' | 'price')}
          >
            {SORT_OPTIONS.map((option) => (
              <FormControlLabel
                key={option.value}
                value={option.value}
                control={<Radio />}
                label={option.label}
              />
            ))}
          </RadioGroup>
        </FormControl>
      </Box>
      
      {/* Action Buttons */}
      <Box sx={{ display: 'flex', mt: 'auto', gap: 2 }}>
        <Button 
          variant="outlined" 
          fullWidth
          onClick={handleReset}
        >
          Reset
        </Button>
        <Button 
          variant="contained" 
          color="primary"
          fullWidth
          onClick={handleApply}
        >
          Apply Filters
        </Button>
      </Box>
    </Drawer>
  );
}