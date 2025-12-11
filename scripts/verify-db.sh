#!/bin/bash
#
# Verify Database Tasks Script
# Checks that all tasks have verification configs
#

set -e

APP_DIR="${1:-/opt/ckad-platform}"
DB_PATH="$APP_DIR/backend/data/ckad.db"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }

echo ""
echo "╔═══════════════════════════════════════════════════╗"
echo "║   Database Verification Check                     ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
    error "Database not found at $DB_PATH"
    exit 1
fi

success "Database found: $DB_PATH"

# Check total tasks
TOTAL_TASKS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM tasks;")
log "Total tasks in database: $TOTAL_TASKS"

if [ "$TOTAL_TASKS" -ne 40 ]; then
    warn "Expected 40 tasks, found $TOTAL_TASKS"
else
    success "Correct number of tasks (40)"
fi

# Check tasks with verification configs
TASKS_WITH_VERIFICATION=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM tasks WHERE verification_config IS NOT NULL AND verification_config != 'null';")
log "Tasks with verification configs: $TASKS_WITH_VERIFICATION"

if [ "$TASKS_WITH_VERIFICATION" -ne 40 ]; then
    error "Only $TASKS_WITH_VERIFICATION tasks have verification configs (expected 40)"
    
    # Show tasks missing verification
    echo ""
    warn "Tasks missing verification configs:"
    sqlite3 "$DB_PATH" "SELECT id, title, difficulty FROM tasks WHERE verification_config IS NULL OR verification_config = 'null';" | while read line; do
        echo "  - $line"
    done
    exit 1
else
    success "All 40 tasks have verification configs"
fi

# Check difficulty distribution
echo ""
log "Difficulty distribution:"
EASY=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM tasks WHERE difficulty = 'easy';")
MEDIUM=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM tasks WHERE difficulty = 'medium';")
HARD=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM tasks WHERE difficulty = 'hard';")

echo "  Easy:   $EASY tasks ($(awk "BEGIN {printf \"%.0f\", ($EASY/$TOTAL_TASKS)*100}")%)"
echo "  Medium: $MEDIUM tasks ($(awk "BEGIN {printf \"%.0f\", ($MEDIUM/$TOTAL_TASKS)*100}")%)"
echo "  Hard:   $HARD tasks ($(awk "BEGIN {printf \"%.0f\", ($HARD/$TOTAL_TASKS)*100}")%)"

# Sample a few verification configs
echo ""
log "Sample verification configs:"
sqlite3 "$DB_PATH" "SELECT id, title, json_extract(verification_config, '$.checks') FROM tasks LIMIT 3;" | while IFS='|' read -r id title checks; do
    CHECK_COUNT=$(echo "$checks" | jq 'length' 2>/dev/null || echo "0")
    echo "  Task $id: $title - $CHECK_COUNT checks"
done

echo ""
success "Database verification complete!"
echo ""
