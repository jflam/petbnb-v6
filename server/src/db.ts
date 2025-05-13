import { PrismaClient } from '@prisma/client';
import knex from 'knex';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

// Import knexfile using require to avoid TypeScript issues
// eslint-disable-next-line @typescript-eslint/no-var-requires
const knexConfig = require('../knexfile');

export const prisma = new PrismaClient();
export const db = knex(knexConfig);

const execPromise = promisify(exec);

// This function is now deprecated as we've removed the Fortune model
export async function getRandomFortune() {
  try {
    console.log('⚠️ getRandomFortune() is deprecated and will be removed in future versions');
    return null;
  } catch (error) {
    console.error('Error in getRandomFortune:', error);
    throw error;
  }
}

// Direct SQL query to insert seed data
async function seedFortunesTable() {
  try {
    // This function is deprecated as we've removed Fortune model
    console.log('⚠️ seedFortunesTable() is deprecated and will be removed in future versions');
    return true;
  } catch (error) {
    console.error('Error seeding fortunes:', error);
    throw error;
  }
}

// Run outstanding migrations (idempotent)
export async function migrate() {
  try {
    // Step 1: Run Knex migrations to create fortunes table
    console.log('📊 Running Knex migrations...');
    const knexMigrationResult = await db.migrate.latest();
    console.log('✅ Knex migrations completed successfully');
    console.log(`   Files executed: ${knexMigrationResult[1].join(', ')}`);

    // Step 2: Check if the Knex fortunes table has data
    const fortunesCount = await db('fortunes').count('id as count').first();
    const count = parseInt(fortunesCount?.count?.toString() || '0');
    
    if (count === 0) {
      console.log('🌱 No fortune records found. Running database seed...');
      await seedFortunesTable();
    } else {
      console.log(`✅ Database already contains ${count} fortune records, skipping seed`);
    }

    // Step 3: Set up the view for Prisma if it doesn't exist
    await getRandomFortune();
    
    return true;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}
