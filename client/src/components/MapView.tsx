import React, { useRef, useEffect, useState } from 'react';
import { Box, Card, CardContent, Typography, Avatar, Rating } from '@mui/material';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Sitter } from '../types';

interface MapViewProps {
  results: Sitter[];
  geoJSON: GeoJSON.FeatureCollection;
  bbox?: number[] | null;
  onSitterSelect: (sitter: Sitter) => void;
}

export default function MapView({ results, geoJSON, bbox, onSitterSelect }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [selectedSitter, setSelectedSitter] = useState<Sitter | null>(null);
  
  // Initialize map when component mounts
  useEffect(() => {
    if (map.current || !mapContainer.current) return;
    
    // Create the map
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://demotiles.maplibre.org/style.json', // Free tile source
      center: [-122.3331, 47.6097], // Default to Seattle
      zoom: 10
    });
    
    // Add navigation controls
    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');
    
    // Clean up on unmount
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);
  
  // Update map when results change
  useEffect(() => {
    if (!map.current || !geoJSON.features.length) return;
    
    // Wait for map to load before adding sources and layers
    if (!map.current.loaded()) {
      map.current.on('load', () => updateMapData());
    } else {
      updateMapData();
    }
    
    function updateMapData() {
      if (!map.current) return;
      
      // Add/update source
      if (map.current.getSource('sitters')) {
        (map.current.getSource('sitters') as maplibregl.GeoJSONSource).setData(geoJSON);
      } else {
        map.current.addSource('sitters', {
          type: 'geojson',
          data: geoJSON
        });
        
        // Add layer for sitter markers
        map.current.addLayer({
          id: 'sitters-points',
          type: 'circle',
          source: 'sitters',
          paint: {
            'circle-radius': 8,
            'circle-color': '#2196f3',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff'
          }
        });
        
        // Add click event
        map.current.on('click', 'sitters-points', (e) => {
          if (!e.features || !e.features[0] || !e.features[0].properties) return;
          
          const props = e.features[0].properties;
          const sitter = results.find(s => s.id === props.id);
          if (sitter) {
            setSelectedSitter(sitter);
          }
        });
        
        // Change cursor on hover
        map.current.on('mouseenter', 'sitters-points', () => {
          if (map.current) map.current.getCanvas().style.cursor = 'pointer';
        });
        
        map.current.on('mouseleave', 'sitters-points', () => {
          if (map.current) map.current.getCanvas().style.cursor = '';
        });
      }
      
      // Fit map to bounds if provided
      if (bbox && bbox.length === 4) {
        map.current.fitBounds([
          [bbox[0], bbox[1]], // SW coordinates
          [bbox[2], bbox[3]]  // NE coordinates
        ], {
          padding: 50,
          maxZoom: 15
        });
      }
    }
  }, [results, geoJSON, bbox]);
  
  // Handle clicking on a sitter in the popup
  const handleSitterClick = () => {
    if (selectedSitter) {
      onSitterSelect(selectedSitter);
      setSelectedSitter(null);
    }
  };
  
  return (
    <Box sx={{ position: 'relative', height: '100%', width: '100%' }}>
      {/* Map container */}
      <Box 
        ref={mapContainer} 
        sx={{ 
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: '100%'
        }} 
      />
      
      {/* Selected sitter popup */}
      {selectedSitter && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            width: { xs: '90%', sm: '350px' },
            zIndex: 1
          }}
        >
          <Card 
            sx={{ 
              display: 'flex',
              cursor: 'pointer',
              '&:hover': { boxShadow: 3 }
            }}
            onClick={handleSitterClick}
          >
            <Avatar
              src={selectedSitter.imageUrl}
              alt={selectedSitter.name}
              sx={{ 
                width: 80, 
                height: 80,
                m: 2,
                borderRadius: 2
              }}
            />
            <CardContent sx={{ flex: '1 1 auto', py: 1 }}>
              <Typography variant="h6" component="div">
                {selectedSitter.name}
              </Typography>
              
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                <Rating value={selectedSitter.avgRating} precision={0.5} readOnly size="small" />
                <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                  ({selectedSitter.reviewCount})
                </Typography>
              </Box>
              
              <Typography color="primary" variant="body1" fontWeight="bold" sx={{ mt: 1 }}>
                ${selectedSitter.rateBoarding}/night
              </Typography>
            </CardContent>
          </Card>
        </Box>
      )}
    </Box>
  );
}