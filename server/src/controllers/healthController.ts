import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

const prisma = new PrismaClient();

export async function healthCheck(req: Request, res: Response) {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    logger.info('Health check passed');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error({ error }, 'Health check failed');
    res.status(500).json({ status: 'error', message: 'Database connection failed' });
  }
}