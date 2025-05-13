import { z } from 'zod';

// Define PetSize enum locally
enum PetSize {
  XS = "XS",
  S = "S",
  M = "M",
  L = "L",
  XL = "XL"
}

// Schema for sitter search query parameters
export const searchQuerySchema = z.object({
  lat: z.coerce.number()
    .min(-90).max(90)
    .describe('Latitude of the search location'),
  
  lng: z.coerce.number()
    .min(-180).max(180)
    .describe('Longitude of the search location'),
  
  start: z.coerce.date()
    .describe('Start date for availability search'),
  
  end: z.coerce.date()
    .describe('End date for availability search'),
  
  page: z.coerce.number()
    .int()
    .positive()
    .default(1)
    .describe('Page number for pagination'),
  
  pageSize: z.coerce.number()
    .int()
    .positive()
    .max(100)
    .default(50)
    .describe('Number of results per page'),
  
  petSize: z.enum([
    "XS", "S", "M", "L", "XL"
  ]).optional()
    .describe('Size of the pet'),
  
  needs: z.array(z.string())
    .optional()
    .describe('Special needs of the pet'),
  
  sort: z.enum(['distance', 'rating', 'price'])
    .default('distance')
    .describe('Sorting criteria')
});

// Schema for retrieving a sitter profile
export const sitterParamSchema = z.object({
  id: z.coerce.number()
    .int()
    .positive()
    .describe('Sitter ID')
});

// Export types based on the schemas
export type SearchQueryParams = z.infer<typeof searchQuerySchema>;
export type SitterParams = z.infer<typeof sitterParamSchema>;