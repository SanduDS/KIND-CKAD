#!/bin/bash
# Cleanup all KIND clusters and terminal containers

echo "🧹 Cleaning up all sessions..."

# List and delete all KIND clusters
for cluster in $(kind get clusters 2>/dev/null | grep ckad-); do
    echo "Deleting cluster: $cluster"
    kind delete cluster --name "$cluster" 2>/dev/null || true
done

# Remove all terminal containers
for container in $(docker ps -a --filter "name=term-ckad-" --format "{{.Names}}" 2>/dev/null); do
    echo "Removing container: $container"
    docker rm -f "$container" 2>/dev/null || true
done

# Clean up kubeconfig files
find /tmp -name "kubeconfig-ckad-*" -delete 2>/dev/null || true
find /tmp -name "kind-config-ckad-*" -delete 2>/dev/null || true

echo "✅ Cleanup complete"

