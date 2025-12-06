#!/bin/bash
#
# Backup CKAD Platform database
# Add to cron: 0 */6 * * * /opt/ckad-platform/scripts/backup.sh
#

set -e

BACKUP_DIR="/opt/ckad-platform/backups"
DB_PATH="/opt/ckad-platform/data/ckad.db"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/ckad_backup_$DATE.db"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup SQLite database (with WAL checkpoint)
if [ -f "$DB_PATH" ]; then
    sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"
    gzip "$BACKUP_FILE"
    echo "[$(date)] Backup created: ${BACKUP_FILE}.gz"
    
    # Keep only last 7 days of backups
    find $BACKUP_DIR -name "*.gz" -mtime +7 -delete
    echo "[$(date)] Old backups cleaned up"
else
    echo "[$(date)] Database not found: $DB_PATH"
fi



