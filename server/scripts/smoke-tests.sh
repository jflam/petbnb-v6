#!/bin/bash
set -eo pipefail

API_URL=${1:-"http://localhost:4000"}
echo "🧪 Running smoke tests against $API_URL"

# Helper function for colored output
function log() {
  GREEN='\033[0;32m'
  RED='\033[0;31m'
  YELLOW='\033[0;33m'
  NC='\033[0m' # No Color
  
  if [ "$1" = "success" ]; then
    echo -e "${GREEN}✅ $2${NC}"
  elif [ "$1" = "error" ]; then
    echo -e "${RED}❌ $2${NC}"
    exit 1
  else
    echo -e "${YELLOW}🔍 $2${NC}"
  fi
}

log "info" "Test 1: API Liveness check"
if curl --silent --fail --show-error --location "$API_URL/api/health" | jq -e '.status=="ok"'; then
  log "success" "API health check passed"
else
  log "error" "API health check failed"
fi

# Get today's date
TODAY=$(date -I)
# Get date 2 days from now
FUTURE_DATE=$(date -I -d "+2 days")

log "info" "Test 2: Basic Sitter Search (returns ≥1 demo sitter)"
if SEARCH_RESULT=$(curl --silent --fail --show-error --location \
  "$API_URL/api/sitters/search?lat=47.6097&lng=-122.3331&start=$TODAY&end=$FUTURE_DATE&page=1"); then
  
  # Check if results array exists and has at least one sitter
  if echo "$SEARCH_RESULT" | jq -e '.["results"] | length > 0 and .[0] | (has("id") and has("name") and has("distanceMi"))'; then
    log "success" "Sitter search returned valid results"
  else
    log "error" "Sitter search response is missing expected fields"
  fi
else
  log "error" "Sitter search request failed"
fi

log "info" "Test 3: Fetch First Sitter Profile"
# Get the ID of the first sitter
FIRST_ID=$(echo "$SEARCH_RESULT" | jq -r '.results[0].id')

if curl --silent --fail --show-error --location "$API_URL/api/sitters/$FIRST_ID" | 
   jq -e 'has("id") and has("bio") and has("services")'; then
  log "success" "Sitter profile fetch succeeded"
else
  log "error" "Sitter profile fetch failed"
fi

log "success" "All smoke tests passed successfully! 🎉"