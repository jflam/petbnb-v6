import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Container, 
  Box, 
  Typography, 
  Paper, 
  Grid, 
  Avatar, 
  Rating, 
  Chip, 
  Button, 
  Divider, 
  IconButton, 
  Card, 
  CardContent 
} from '@mui/material';
import { 
  ArrowBack, 
  LocationOn, 
  AccessTime, 
  Refresh 
} from '@mui/icons-material';
import { useSitterProfile } from '../hooks/useQueryHooks';

// Format a date as MM/DD/YYYY
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
};

export default function SitterProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // Fetch sitter profile
  const { data: sitter, isLoading, error } = useSitterProfile(id ? parseInt(id) : null);
  
  // Handle back button click
  const handleBack = () => {
    navigate(-1);
  };
  
  // If loading or error
  if (isLoading) {
    return (
      <Container sx={{ py: 4, textAlign: 'center' }}>
        <Typography>Loading profile...</Typography>
      </Container>
    );
  }
  
  if (error || !sitter) {
    return (
      <Container sx={{ py: 4, textAlign: 'center' }}>
        <Typography color="error">Error loading sitter profile</Typography>
        <Button 
          variant="contained" 
          startIcon={<ArrowBack />} 
          onClick={handleBack}
          sx={{ mt: 2 }}
        >
          Back to Search
        </Button>
      </Container>
    );
  }
  
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {/* Back button */}
      <IconButton 
        onClick={handleBack} 
        sx={{ mb: 2 }}
        aria-label="back to search"
      >
        <ArrowBack />
      </IconButton>
      
      {/* Sitter header */}
      <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
        <Grid container spacing={3}>
          {/* Sitter image */}
          <Grid item xs={12} sm={4} sx={{ textAlign: 'center' }}>
            <Avatar
              src={sitter.imageUrl}
              alt={sitter.name}
              sx={{ 
                width: { xs: 150, sm: 200 }, 
                height: { xs: 150, sm: 200 }, 
                mx: 'auto'
              }}
            />
          </Grid>
          
          {/* Sitter info */}
          <Grid item xs={12} sm={8}>
            <Typography variant="h4" component="h1" gutterBottom>
              {sitter.name}
            </Typography>
            
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Rating 
                value={sitter.rating.average} 
                precision={0.5} 
                readOnly 
              />
              <Typography variant="body1" sx={{ ml: 1 }}>
                ({sitter.rating.count} reviews)
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <LocationOn color="action" fontSize="small" />
              <Typography variant="body2" color="text.secondary">
                Serves within {sitter.location.radiusKm}km radius
              </Typography>
            </Box>
            
            {/* Service badges */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
              {sitter.services.map((service) => (
                <Chip
                  key={service.type}
                  label={`${service.type}: $${service.priceDollars}/day`}
                  color="primary"
                  variant="outlined"
                />
              ))}
              
              {sitter.responseTime && (
                <Chip
                  icon={<AccessTime fontSize="small" />}
                  label={`Responds in ${sitter.responseTime}m`}
                  variant="outlined"
                />
              )}
              
              {sitter.repeatClient && (
                <Chip
                  icon={<Refresh fontSize="small" />}
                  label={`${sitter.repeatClient}% repeat clients`}
                  variant="outlined"
                />
              )}
            </Box>
            
            {/* Book button - non-functional for MVP */}
            <Button 
              variant="contained" 
              color="primary" 
              size="large" 
              fullWidth
              sx={{ mt: 2 }}
            >
              Book Now
            </Button>
          </Grid>
        </Grid>
      </Paper>
      
      {/* Bio section */}
      <Paper elevation={1} sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          About {sitter.name}
        </Typography>
        <Typography paragraph>
          {sitter.bio || 'No bio available.'}
        </Typography>
      </Paper>
      
      {/* Reviews section */}
      <Paper elevation={1} sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Reviews ({sitter.rating.count})
        </Typography>
        
        {sitter.reviews.length > 0 ? (
          sitter.reviews.map((review) => (
            <Box key={review.id} sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography fontWeight="bold">
                  {review.owner.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {formatDate(review.date)}
                </Typography>
              </Box>
              
              <Rating value={review.rating} readOnly size="small" sx={{ mt: 0.5 }} />
              
              <Typography variant="body2" sx={{ mt: 1 }}>
                {review.comment || 'No comment provided.'}
              </Typography>
              
              <Divider sx={{ mt: 2 }} />
            </Box>
          ))
        ) : (
          <Typography color="text.secondary">
            No reviews yet.
          </Typography>
        )}
      </Paper>
      
      {/* Availability section */}
      <Paper elevation={1} sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Availability
        </Typography>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Available dates are shown below. Contact the sitter to confirm.
        </Typography>
        
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {sitter.availability.slice(0, 12).map((date, index) => (
            <Card key={index} variant="outlined" sx={{ minWidth: 90 }}>
              <CardContent sx={{ p: 1, textAlign: 'center' }}>
                <Typography variant="body2">{formatDate(date)}</Typography>
              </CardContent>
            </Card>
          ))}
          
          {sitter.availability.length > 12 && (
            <Card variant="outlined" sx={{ minWidth: 90 }}>
              <CardContent sx={{ p: 1, textAlign: 'center' }}>
                <Typography variant="body2">+{sitter.availability.length - 12} more</Typography>
              </CardContent>
            </Card>
          )}
        </Box>
      </Paper>
    </Container>
  );
}