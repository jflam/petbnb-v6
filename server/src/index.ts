import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import logger from './utils/logger';
import { searchSitters, getSitterProfile } from './controllers/sitterController';
import { healthCheck } from './controllers/healthController';
import { validateRequest } from './middleware/validateRequest';
import { searchQuerySchema, sitterParamSchema } from './utils/validation';
import { execSync } from 'child_process';
import path from 'path';

// Create Express app
const app = express();
const PORT = process.env.PORT || 4000;

// Initialize Prisma client
const prisma = new PrismaClient();

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.get('/api/health', healthCheck);

// Sitter routes
app.get(
  '/api/sitters/search',
  validateRequest(searchQuerySchema),
  searchSitters
);

app.get(
  '/api/sitters/:id',
  validateRequest(sitterParamSchema, 'params'),
  getSitterProfile
);

// Helper function to run migrations and seed data
async function setupDatabase() {
  try {
    logger.info('Running database migrations...');
    
    try {
      // Run the Prisma migrations
      execSync('npx prisma migrate deploy', { stdio: 'inherit' });
      
      // Execute the manual migrations
      const manualMigrationPath = path.resolve(__dirname, '../prisma/migrations/manual/init_spatial.sql');
      logger.info(`Executing manual migration: ${manualMigrationPath}`);
      
      // Check if the PostgreSQL extension is needed
      await prisma.$executeRawUnsafe(`
        CREATE EXTENSION IF NOT EXISTS postgis;
      `);
      
      // Create materialized view if it doesn't exist
      await prisma.$executeRawUnsafe(`
        CREATE MATERIALIZED VIEW IF NOT EXISTS vw_sitter_rating AS
        SELECT 
          "sitterId",
          AVG(rating) AS avg_rating,
          COUNT(*) AS review_count
        FROM "Review"
        GROUP BY "sitterId";
      `);
      
      logger.info('Database migrations completed successfully');
    } catch (error) {
      logger.error({ error }, 'Error running migrations');
      throw error;
    }
    
    logger.info('Checking if seed data is needed...');
    const sitterCount = await prisma.sitter.count();
    
    if (sitterCount === 0) {
      logger.info('No sitters found, running seed script...');
      execSync('npm run seed', { stdio: 'inherit' });
      logger.info('Seed completed successfully');
    } else {
      logger.info(`Database already contains ${sitterCount} sitters, skipping seed`);
    }
    
    return true;
  } catch (error) {
    logger.error({ error }, 'Database setup failed');
    throw error;
  }
}

// Start server with database setup
(async () => {
  logger.info('Starting PetBnB API server...');

  try {
    await setupDatabase();
    logger.info('Database setup completed successfully');
    
    const server = app.listen(PORT, () => {
      logger.info(`🐾 PetBnB API listening at http://localhost:${PORT}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully...');
      server.close(async () => {
        await prisma.$disconnect();
        logger.info('Server shut down gracefully');
      });
    });
  } catch (error) {
    logger.error({ error }, 'Server initialization failed');
    process.exit(1);
  }
})();