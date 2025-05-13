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
  validateRequest(searchQuerySchema, 'query'),
  searchSitters as any
);

app.get(
  '/api/sitters/:id',
  validateRequest(sitterParamSchema, 'params'),
  getSitterProfile as any
);

// Helper function to run migrations and seed data
async function setupDatabase() {
  try {
    logger.info('Running database migrations...');
    
    try {
      // Run the Prisma migrations
      try {
        execSync('npx prisma migrate deploy', { stdio: 'inherit' });
      } catch (error) {
        logger.warn('Prisma migrate deploy failed, falling back to direct SQL execution');
        // If migration fails, we'll apply the SQL directly
        const initMigrationPath = path.resolve(__dirname, '../prisma/migrations/20250502173436_init/migration.sql');
        logger.info(`Executing init migration: ${initMigrationPath}`);
        const sql = require('fs').readFileSync(initMigrationPath, 'utf8');
        await prisma.$executeRawUnsafe(sql);
      }
      
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

// Helper function to wait for the database to be ready
async function waitForDatabase(retries = 10, delay = 3000) {
  logger.info('Checking database connection...');
  
  for (let i = 0; i < retries; i++) {
    try {
      // Try to connect to the database
      await prisma.$queryRaw`SELECT 1`;
      logger.info('Database connection successful');
      return true;
    } catch (error) {
      logger.warn(`Database connection attempt ${i + 1}/${retries} failed, retrying in ${delay/1000}s...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error(`Could not connect to database after ${retries} attempts`);
}

// Start server with database setup
(async () => {
  logger.info('Starting PetBnB API server...');

  try {
    // First wait for the database to be available
    await waitForDatabase();
    
    // Then run migrations and seed data
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