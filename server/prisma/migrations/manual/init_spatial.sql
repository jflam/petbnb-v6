-- Enable PostGIS extension if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create materialized view for sitter ratings
CREATE MATERIALIZED VIEW IF NOT EXISTS vw_sitter_rating AS
SELECT 
  "sitterId",
  AVG(rating) AS avg_rating,
  COUNT(*) AS review_count
FROM "Review"
GROUP BY "sitterId";

-- Create GiST index on address_geom for spatial queries
CREATE INDEX IF NOT EXISTS idx_sitter_address_geom ON "Sitter" USING GIST (addressGeom);

-- Create composite index on service and price for filtering
CREATE INDEX IF NOT EXISTS idx_sitter_service_price ON "SitterService" ("service", "priceCents");

-- Create a function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_sitter_rating()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW vw_sitter_rating;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to refresh the view when reviews change
CREATE OR REPLACE TRIGGER trigger_refresh_sitter_rating
AFTER INSERT OR UPDATE OR DELETE ON "Review"
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_sitter_rating();