import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';
import { SearchQueryParams, SitterParams } from '../utils/validation';

const prisma = new PrismaClient();

// Helper function to calculate days between two dates
function daysBetween(startDate: Date, endDate: Date): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end dates
}

// Helper function to format sitter data for response
function formatSitterResult(sitter: any, distanceMeters: number) {
  return {
    id: sitter.id,
    userId: sitter.userId,
    name: sitter.user?.email?.split('@')[0] || `Sitter ${sitter.id}`,
    bio: sitter.bio,
    distanceMi: Math.round((distanceMeters / 1609.34) * 10) / 10, // Convert meters to miles with 1 decimal
    rateBoarding: sitter.rateBoarding ? sitter.rateBoarding / 100 : null,
    rateDaycare: sitter.rateDaycare ? sitter.rateDaycare / 100 : null,
    responseTime: sitter.responseTime,
    repeatClient: sitter.repeatClient,
    avgRating: sitter.avgRating,
    reviewCount: sitter.reviewCount,
    // Generate image URL based on ID
    imageUrl: `/assets/sitters/${sitter.id}.jpg`,
  };
}

// Function to convert to GeoJSON
function toGeoJSON(sitters: any[]) {
  return {
    type: 'FeatureCollection',
    features: sitters.map(sitter => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [sitter.lng, sitter.lat]
      },
      properties: {
        id: sitter.id,
        name: sitter.name,
        rateBoarding: sitter.rateBoarding,
        rateDaycare: sitter.rateDaycare,
        avgRating: sitter.avgRating,
        reviewCount: sitter.reviewCount,
        imageUrl: sitter.imageUrl
      }
    }))
  };
}

// Controller for searching sitters based on location, dates, and filters
export async function searchSitters(req: Request<{}, {}, {}, SearchQueryParams>, res: Response) {
  try {
    const { 
      lat, 
      lng, 
      start, 
      end, 
      page = 1, 
      pageSize = 50,
      petSize,
      needs,
      sort = 'distance'
    } = req.query;

    logger.info({ 
      component: 'SitterSearch', 
      params: { lat, lng, start, end, page, pageSize, petSize, needs, sort }
    }, 'Searching for sitters');

    // Make sure these are proper types
    const startDate = start instanceof Date ? start : new Date(start as string);
    const endDate = end instanceof Date ? end : new Date(end as string);
    const pageNum = typeof page === 'number' ? page : parseInt(page as string, 10);
    const pageSizeNum = typeof pageSize === 'number' ? pageSize : parseInt(pageSize as string, 10);

    // Calculate the number of days between start and end dates
    const numDays = daysBetween(startDate, endDate);
    const offset = (pageNum - 1) * pageSizeNum;

    // Build a date array for availability check
    const dateRange = [];
    for (let i = 0; i < numDays; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      dateRange.push(date.toISOString().split('T')[0]);
    }
    
    // Search for sitters using Prisma with raw SQL for spatial queries
    const sitters = await prisma.$queryRaw`
      WITH sitter_distances AS (
        SELECT 
          s."id",
          s."userId",
          s."bio",
          s."rateBoarding",
          s."rateDaycare",
          s."responseTime",
          s."repeatClient",
          ST_Distance(s."addressGeom", ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography) as distance,
          COALESCE(r.avg_rating, 0) as "avgRating",
          COALESCE(r.review_count, 0) as "reviewCount"
        FROM "Sitter" s
        LEFT JOIN vw_sitter_rating r ON s."id" = r."sitterId"
        WHERE ST_DWithin(s."addressGeom", ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, s."radiusKm" * 1000)
        AND EXISTS (
          SELECT 1 FROM "Availability" a
          WHERE a."sitterId" = s."id"
            AND a."date" >= ${start}::date
            AND a."date" <= ${end}::date
            AND a."isAvailable" = true
          GROUP BY a."sitterId"
          HAVING COUNT(*) = ${numDays}  -- Must be available all requested days
        )
        ${petSize ? 
          prisma.$queryRaw`AND EXISTS (
            SELECT 1 FROM "SitterService" ss
            WHERE ss."sitterId" = s."id"
              AND (ss."service" = 'boarding' OR ss."service" = 'daycare')
          )` : 
          prisma.$queryRaw`AND 1=1`
        }
        ${needs && Array.isArray(needs) && needs.length > 0 ?
          prisma.$queryRaw`AND EXISTS (
            -- Simplified for MVP. In a real app, we'd check for specific capabilities
            SELECT 1 FROM "SitterService" ss
            WHERE ss."sitterId" = s."id"
          )` :
          prisma.$queryRaw`AND 1=1`
        }
      )
      SELECT *
      FROM sitter_distances
      ORDER BY ${
        sort === 'distance' ? prisma.$queryRaw`distance ASC` :
        sort === 'rating' ? prisma.$queryRaw`"avgRating" DESC, distance ASC` :
        sort === 'price' ? prisma.$queryRaw`"rateBoarding" ASC, distance ASC` :
        prisma.$queryRaw`distance ASC`
      }
      LIMIT ${pageSize}
      OFFSET ${offset};
    `;

    // Add related data from user table for each sitter
    const enrichedSitters = await Promise.all(
      (sitters as any[]).map(async (sitter) => {
        const user = await prisma.user.findUnique({
          where: { id: sitter.userId },
          select: { email: true }
        });
        
        const coordsResult = await prisma.$queryRaw`
          SELECT 
            ST_X(ST_Transform(ST_SetSRID(ST_MakePoint(
              ST_X(geography::geometry), 
              ST_Y(geography::geometry)
            ), 4326), 4326)) as lng,
            ST_Y(ST_Transform(ST_SetSRID(ST_MakePoint(
              ST_X(geography::geometry), 
              ST_Y(geography::geometry)
            ), 4326), 4326)) as lat
          FROM (
            SELECT "addressGeom"::geography as geography
            FROM "Sitter"
            WHERE id = ${sitter.id}
          ) as geog;
        `;
        
        const coords = (coordsResult as any[])[0];
        return {
          ...sitter,
          user,
          lat: coords?.lat,
          lng: coords?.lng
        };
      })
    );

    // Calculate total results for pagination
    const totalResults = await prisma.$queryRaw`
      SELECT COUNT(*)
      FROM "Sitter" s
      WHERE ST_DWithin(s."addressGeom", ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, s."radiusKm" * 1000)
      AND EXISTS (
        SELECT 1 FROM "Availability" a
        WHERE a."sitterId" = s."id"
          AND a."date" >= ${start}::date
          AND a."date" <= ${end}::date
          AND a."isAvailable" = true
        GROUP BY a."sitterId"
        HAVING COUNT(*) = ${numDays}
      );
    `;
    
    const count = parseInt((totalResults as any[])[0].count);
    const totalPages = Math.ceil(count / pageSizeNum);

    // Format the sitter results
    const formattedResults = enrichedSitters.map(sitter => 
      formatSitterResult(sitter, sitter.distance)
    );

    // Calculate the bounding box for the results
    const bbox = enrichedSitters.length ? [
      Math.min(...enrichedSitters.map(s => s.lng)),
      Math.min(...enrichedSitters.map(s => s.lat)),
      Math.max(...enrichedSitters.map(s => s.lng)),
      Math.max(...enrichedSitters.map(s => s.lat))
    ] : null;

    // Return the response
    res.json({
      results: formattedResults,
      geojson: toGeoJSON(formattedResults),
      total: count,
      paging: {
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages
      },
      bbox
    });
  } catch (error) {
    logger.error({ error }, 'Error in sitter search');
    res.status(500).json({ error: 'Error searching for sitters' });
  }
}

// Controller for retrieving a single sitter's profile
export async function getSitterProfile(req: Request<SitterParams>, res: Response) {
  try {
    const { id } = req.params;

    logger.info({ component: 'SitterProfile', sitterId: id }, 'Fetching sitter profile');

    // Get the sitter with related data
    const sitter = await prisma.sitter.findUnique({
      where: { id: Number(id) },
      include: {
        user: {
          select: {
            email: true
          }
        },
        services: {
          select: {
            service: true,
            priceCents: true
          }
        },
        reviews: {
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
            owner: {
              select: {
                id: true,
                email: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 5
        }
      }
    });

    if (!sitter) {
      return res.status(404).json({ error: 'Sitter not found' });
    }

    // Get the sitter rating
    const rating = await prisma.$queryRaw`
      SELECT 
        COALESCE(AVG(rating), 0) as "avgRating",
        COUNT(*) as "reviewCount"
      FROM "Review"
      WHERE "sitterId" = ${id};
    `;

    // Fetch all availability dates for the next 60 days
    const today = new Date();
    const sixtyDaysLater = new Date();
    sixtyDaysLater.setDate(today.getDate() + 60);

    const availability = await prisma.availability.findMany({
      where: {
        sitterId: Number(id),
        date: {
          gte: today,
          lte: sixtyDaysLater
        },
        isAvailable: true
      },
      select: {
        date: true
      }
    });

    // Get coordinates
    const coords = await prisma.$queryRaw`
      SELECT 
        ST_X(ST_Transform(ST_SetSRID(ST_MakePoint(
          ST_X(geography::geometry), 
          ST_Y(geography::geometry)
        ), 4326), 4326)) as lng,
        ST_Y(ST_Transform(ST_SetSRID(ST_MakePoint(
          ST_X(geography::geometry), 
          ST_Y(geography::geometry)
        ), 4326), 4326)) as lat
      FROM (
        SELECT "addressGeom"::geography as geography
        FROM "Sitter"
        WHERE id = ${id}
      ) as geog;
    `;

    // Format the response
    const formattedResponse = {
      id: sitter.id,
      name: sitter.user?.email?.split('@')[0] || `Sitter ${sitter.id}`,
      bio: sitter.bio,
      responseTime: sitter.responseTime,
      repeatClient: sitter.repeatClient,
      imageUrl: `/assets/sitters/${sitter.id}.jpg`,
      location: {
        lat: (coords as any[])[0]?.lat,
        lng: (coords as any[])[0]?.lng,
        radiusKm: sitter.radiusKm
      },
      rating: {
        average: parseFloat((rating as any[])[0].avgRating),
        count: parseInt((rating as any[])[0].reviewCount)
      },
      services: sitter.services.map((service: any) => ({
        type: service.service,
        priceDollars: service.priceCents / 100
      })),
      reviews: sitter.reviews.map((review: any) => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        date: review.createdAt,
        owner: {
          id: review.owner.id,
          name: review.owner.email.split('@')[0]
        }
      })),
      availability: availability.map((a: any) => a.date.toISOString().split('T')[0])
    };

    res.json(formattedResponse);
  } catch (error) {
    logger.error({ error, sitterId: req.params.id }, 'Error fetching sitter profile');
    res.status(500).json({ error: 'Error fetching sitter profile' });
  }
}