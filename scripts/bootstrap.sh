#!/bin/bash
set -e

# Color escape codes
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🔍 Starting PetBnB bootstrap process...${NC}"

# Install dependencies at project root
echo -e "${YELLOW}📦 Installing root dependencies...${NC}"
npm install

# Install client dependencies
echo -e "${YELLOW}📦 Installing client dependencies...${NC}"
cd client
npm install --legacy-peer-deps
cd ..

# Install server dependencies
echo -e "${YELLOW}📦 Installing server dependencies...${NC}"
cd server
npm install
cd ..

echo -e "${GREEN}✅ Bootstrap complete! Run 'npm run dev' to start the application.${NC}"