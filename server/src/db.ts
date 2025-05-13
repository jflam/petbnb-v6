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

export async function getRandomFortune() {
  try {
    // First, check if we need to create view - if we're using Knex table with Prisma
    const count = await db.raw(`
      SELECT COUNT(*) 
      FROM information_schema.tables 
      WHERE table_name = 'Fortune'
    `);

    if (parseInt(count.rows[0].count) === 0) {
      // Check if Knex 'fortunes' table exists
      const knexTableExists = await db.raw(`
        SELECT COUNT(*) 
        FROM information_schema.tables 
        WHERE table_name = 'fortunes'
      `);

      if (parseInt(knexTableExists.rows[0].count) > 0) {
        // Create a view that Prisma can use 
        console.log('🔄 Creating database view "Fortune" to map to Knex table "fortunes"');
        await db.raw(`
          CREATE OR REPLACE VIEW "Fortune" AS
          SELECT id, text, NOW() as created
          FROM fortunes;
        `);
        console.log('✅ Database view created successfully');
      }
    }

    // Now proceed with query
    const dataCount = await prisma.fortune.count();
    if (dataCount === 0) {
      return null;
    }
    
    const skip = Math.floor(Math.random() * dataCount);
    return prisma.fortune.findFirst({ skip });
  } catch (error) {
    console.error('Error in getRandomFortune:', error);
    throw error;
  }
}

// Direct SQL query to insert seed data
async function seedFortunesTable() {
  try {
    // Seed the Knex fortunes table
    console.log('🌱 Seeding fortunes table...');
    await db('fortunes').insert([
      { text: 'You will encounter a challenging opportunity that will lead to growth.' },
      { text: 'A surprise awaits you in the near future.' },
      { text: 'Your dedication will soon be rewarded.' },
      { text: 'The journey is more important than the destination.' },
      { text: 'A creative solution will present itself to a longstanding problem.' }
    ]);
    console.log('✅ Fortunes table seeded successfully');
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
