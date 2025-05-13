#!/bin/bash
set -eo pipefail

echo "🗑️ Decommissioning Fortune demo code..."

# Step 1: Create a backup first
BACKUP_DIR="/tmp/fortune-backup-$(date +%Y%m%d%H%M%S)"
mkdir -p $BACKUP_DIR
echo "📦 Creating backup at $BACKUP_DIR"

# Copy relevant files
cp -r /Users/jflam/src/petbnb-v6/server/src/db.ts $BACKUP_DIR/
cp -r /Users/jflam/src/petbnb-v6/server/migrations $BACKUP_DIR/
cp -r /Users/jflam/src/petbnb-v6/server/seeds $BACKUP_DIR/
cp -r /Users/jflam/src/petbnb-v6/client/src/App.tsx.bak $BACKUP_DIR/ 2>/dev/null || true

echo "✅ Backup completed"

# Step 2: Remove the fortune endpoint from the server/src/index.ts
# We'll do this manually in our next step

# Step 3: Remove the fortune section from the Prisma schema
# We'll do this manually in our next step

# Step 4: Clean up the database
echo "🧹 The following files/directories should be manually reviewed and cleaned up:"
echo "- /Users/jflam/src/petbnb-v6/server/src/db.ts (can be deleted)"
echo "- /Users/jflam/src/petbnb-v6/server/migrations/ (fortune-related migrations can be deleted)"
echo "- /Users/jflam/src/petbnb-v6/server/seeds/ (fortune-related seeds can be deleted)"
echo "- Prisma schema: Remove the Fortune model"
echo "- server/src/index.ts: Remove the /api/fortunes/random endpoint"

echo "⚠️ IMPORTANT: Run migrations and seed script after making these changes"
echo "✅ Decommission script completed"