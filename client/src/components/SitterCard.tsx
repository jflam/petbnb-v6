import React from 'react';
import { Card, CardMedia, CardContent, Typography, Box, Chip, Rating, Tooltip } from '@mui/material';
import { AccessTime, Refresh, PriceCheck } from '@mui/icons-material';
import { Sitter } from '../types';

interface SitterCardProps {
  sitter: Sitter;
  onClick: (sitter: Sitter) => void;
}

export default function SitterCard({ sitter, onClick }: SitterCardProps) {
  // Format response time in minutes/hours
  const formatResponseTime = (minutes: number | null) => {
    if (!minutes) return 'N/A';
    if (minutes < 60) return `${minutes}m`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  };
  
  return (
    <Card 
      sx={{ 
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        mb: 2,
        cursor: 'pointer',
        transition: 'transform 0.2s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 3
        }
      }}
      onClick={() => onClick(sitter)}
    >
      {/* Sitter Image */}
      <CardMedia
        component="img"
        sx={{ 
          width: { xs: '100%', sm: 200 },
          height: { xs: 200, sm: 'auto' },
          objectFit: 'cover'
        }}
        image={sitter.imageUrl}
        alt={sitter.name}
      />
      
      {/* Sitter Details */}
      <CardContent sx={{ flex: '1 0 auto', p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            {/* Name and Rating */}
            <Typography variant="h5" component="div">
              {sitter.name}
            </Typography>
            
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
              <Rating value={sitter.avgRating} precision={0.5} readOnly size="small" />
              <Tooltip title={`${sitter.reviewCount} reviews`}>
                <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                  ({sitter.reviewCount})
                </Typography>
              </Tooltip>
              
              <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                {sitter.distanceMi} mi away
              </Typography>
            </Box>
          </Box>
          
          {/* Price Information */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            {sitter.rateBoarding && (
              <Typography variant="h6" color="primary">
                ${sitter.rateBoarding}/night
              </Typography>
            )}
            {sitter.rateDaycare && (
              <Typography variant="body2" color="text.secondary">
                ${sitter.rateDaycare}/day
              </Typography>
            )}
          </Box>
        </Box>
        
        {/* Badges */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
          {sitter.responseTime && (
            <Chip
              icon={<AccessTime fontSize="small" />}
              label={`Responds in ${formatResponseTime(sitter.responseTime)}`}
              size="small"
              variant="outlined"
            />
          )}
          
          {sitter.repeatClient && (
            <Chip
              icon={<Refresh fontSize="small" />}
              label={`${sitter.repeatClient}% repeat clients`}
              size="small"
              variant="outlined"
            />
          )}
          
          <Chip
            icon={<PriceCheck fontSize="small" />}
            label="Boarding"
            size="small"
            color="primary"
            variant="outlined"
          />
          
          <Chip
            label="Daycare"
            size="small"
            variant="outlined"
          />
        </Box>
        
        {/* Bio Preview */}
        <Typography 
          variant="body2" 
          color="text.secondary"
          sx={{ 
            mt: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {sitter.bio || 'No bio available.'}
        </Typography>
      </CardContent>
    </Card>
  );
}