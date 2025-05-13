import React, { useState, useRef, useEffect } from 'react';
import { Box, TextField, Autocomplete, Paper, InputAdornment, Button } from '@mui/material';
import { Search as SearchIcon, DateRange as DateRangeIcon } from '@mui/icons-material';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { addDays, format } from 'date-fns';
import { useLocationSearch } from '../hooks/useQueryHooks';
import { LocationSearchResult } from '../types';

interface SearchBarProps {
  onSearch: (location: { lat: number; lng: number }, dates: { start: Date; end: Date }) => void;
  initialLocation?: { lat: number; lng: number; display?: string };
  initialDates?: { start: Date; end: Date };
}

export default function SearchBar({ onSearch, initialLocation, initialDates }: SearchBarProps) {
  // State for location search
  const [locationQuery, setLocationQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<LocationSearchResult | null>(
    initialLocation 
      ? { 
          display_name: initialLocation.display || 'Current Location', 
          lat: initialLocation.lat, 
          lon: initialLocation.lng 
        } 
      : null
  );
  
  // State for date picker
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date>(initialDates?.start || new Date());
  const [endDate, setEndDate] = useState<Date>(initialDates?.end || addDays(new Date(), 3));
  const dateRangeText = `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d')}`;
  
  // Reference for date picker
  const datePickerRef = useRef<HTMLDivElement>(null);
  
  // Query for location search
  const { data: locationResults = [] } = useLocationSearch(locationQuery);
  
  // Close date picker when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setDatePickerOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Handle date selection
  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    
    if (!startDate || (startDate && endDate)) {
      // Starting a new range
      setStartDate(date);
      setEndDate(undefined as unknown as Date);
    } else {
      // Completing the range
      if (date < startDate) {
        setStartDate(date);
        setEndDate(startDate);
      } else {
        setEndDate(date);
        setDatePickerOpen(false);
      }
    }
  };
  
  // Handle search button click
  const handleSearch = () => {
    if (!selectedLocation) return;
    
    onSearch(
      { lat: selectedLocation.lat, lng: selectedLocation.lon },
      { start: startDate, end: endDate || addDays(startDate, 1) }
    );
  };
  
  return (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', sm: 'row' }, 
        gap: 2,
        width: '100%',
        p: 2,
        bgcolor: 'background.paper',
        borderRadius: 1,
        boxShadow: 1
      }}
    >
      {/* Location Search */}
      <Autocomplete
        id="location-search"
        options={locationResults}
        getOptionLabel={(option) => option.display_name}
        value={selectedLocation}
        onChange={(_event, newValue) => setSelectedLocation(newValue)}
        onInputChange={(_event, newValue) => setLocationQuery(newValue)}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Where are you looking?"
            variant="outlined"
            fullWidth
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              )
            }}
          />
        )}
        sx={{ flexGrow: 1 }}
      />
      
      {/* Date Range Picker */}
      <Box sx={{ position: 'relative', minWidth: '200px' }}>
        <TextField
          id="date-range"
          label="When?"
          variant="outlined"
          value={dateRangeText}
          onClick={() => setDatePickerOpen(true)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <DateRangeIcon />
              </InputAdornment>
            ),
            readOnly: true
          }}
          fullWidth
        />
        
        {datePickerOpen && (
          <Paper 
            ref={datePickerRef}
            sx={{ 
              position: 'absolute', 
              zIndex: 10, 
              mt: 1, 
              p: 2,
              width: { xs: '100%', sm: '350px' }
            }}
          >
            <DayPicker
              mode="range"
              selected={{ 
                from: startDate, 
                to: endDate 
              }}
              onSelect={(range) => {
                if (range) {
                  setStartDate(range.from || new Date());
                  setEndDate(range.to || addDays(range.from || new Date(), 1));
                }
              }}
              fromDate={new Date()}
              numberOfMonths={1}
            />
          </Paper>
        )}
      </Box>
      
      {/* Search Button */}
      <Button 
        variant="contained" 
        color="primary" 
        onClick={handleSearch}
        disabled={!selectedLocation}
        sx={{ height: '56px', px: 4 }}
      >
        Search
      </Button>
    </Box>
  );
}