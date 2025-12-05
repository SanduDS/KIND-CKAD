#!/bin/bash
#
# Cleanup orphaned KIND clusters and terminal containers
# This runs on startup and periodically via the backend
#

set -e

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

log "Starting orphan cleanup..."

# Remove any orphaned KIND clusters
for cluster in $(kind get clusters 2>/dev/null || true); do
    if [[ "$cluster" == ckad-* ]]; then
        log "Removing orphan KIND cluster: $cluster"
        kind delete cluster --name "$cluster" 2>/dev/null || true
    fi
done

# Remove any orphaned terminal containers
for container in $(docker ps -a --filter "name=term-ckad-" --format "{{.Names}}" 2>/dev/null || true); do
    log "Removing orphan container: $container"
    docker rm -f "$container" 2>/dev/null || true
done

# Clean up old kubeconfig files
find /tmp -name "kubeconfig-ckad-*" -mmin +120 -delete 2>/dev/null || true
find /tmp -name "kind-config-ckad-*" -mmin +120 -delete 2>/dev/null || true

log "Orphan cleanup completed"

