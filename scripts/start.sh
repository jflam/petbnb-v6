#!/bin/bash
set -e

# Clean up any leftover containers or volumes from a failed run
echo "Cleaning up any existing containers and volumes..."
docker compose down -v 2>/dev/null || true

# Fix the migrations directory to ensure it's properly recognized by Prisma
echo "Ensuring migrations directory is properly set up..."
cd server/prisma
rm -rf migrations/.db
mkdir -p migrations/20250502173436_init
touch migrations/20250502173436_init/.gitkeep
cd ../..

# Start fresh
echo "Starting the application with fresh volumes..."
docker compose up --build