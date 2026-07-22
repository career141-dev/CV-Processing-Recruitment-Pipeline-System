#!/bin/bash
# ============================================================
#  Career141 — VPS Pre-Start Cleanup Script
#  Run this on the VPS BEFORE docker compose up
#  Purpose: Prevent crash from stale Node.js symlinks &
#           leftover temp files from failed deployments
# ============================================================

set -e

echo "🧹 [1/4] Cleaning up stale Convex temp files..."
# Fixes: "EEXIST: file already exists, symlink" crash
find /var/lib/docker/volumes -name "*.tmp*" -type d 2>/dev/null | head -20 | xargs rm -rf 2>/dev/null || true
echo "   Done."

echo "🧹 [2/4] Pruning stopped Docker containers..."
docker container prune -f
echo "   Done."

echo "🧹 [3/4] Checking available disk space..."
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 80 ]; then
  echo "   ⚠️  WARNING: Disk is ${DISK_USAGE}% full! Pruning Docker images..."
  docker image prune -f
else
  echo "   ✅ Disk usage: ${DISK_USAGE}% — OK"
fi

echo "🧹 [4/4] Checking available memory..."
FREE_MEM=$(free -m | awk '/^Mem:/{print $4}')
echo "   Free memory: ${FREE_MEM}MB"
if [ "$FREE_MEM" -lt 512 ]; then
  echo "   ⚠️  WARNING: Less than 512MB free! Consider restarting or upgrading VPS."
else
  echo "   ✅ Memory OK"
fi

echo ""
echo "✅ Pre-start cleanup complete. Safe to run: docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build --force-recreate"
