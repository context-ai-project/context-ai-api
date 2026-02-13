#!/usr/bin/env bash
# ============================================
# Context.ai API — Docker Build Script
# ============================================
# Usage:
#   ./scripts/docker-build.sh [tag]
#
# Examples:
#   ./scripts/docker-build.sh              # builds context-ai-api:latest
#   ./scripts/docker-build.sh v1.0.0       # builds context-ai-api:v1.0.0
# ============================================

set -euo pipefail

TAG="${1:-latest}"
IMAGE="context-ai-api"
FULL_IMAGE="${IMAGE}:${TAG}"

# Build context must be the monorepo root (one level up from context-ai-api)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo "🐳  Building ${FULL_IMAGE}"
echo "    Build context: ${REPO_ROOT}"
echo "    Dockerfile:    context-ai-api/Dockerfile"
echo ""

docker build \
  -t "${FULL_IMAGE}" \
  -f "${REPO_ROOT}/context-ai-api/Dockerfile" \
  "${REPO_ROOT}"

echo ""
echo "✅  Image built successfully: ${FULL_IMAGE}"
echo ""

# Print image size
SIZE=$(docker image inspect "${FULL_IMAGE}" --format='{{.Size}}' 2>/dev/null)
SIZE_MB=$((SIZE / 1024 / 1024))
echo "📦  Image size: ${SIZE_MB} MB"

if [ "${SIZE_MB}" -gt 500 ]; then
  echo "⚠️   Warning: Image exceeds 500 MB target"
else
  echo "✅  Image size is within the 500 MB target"
fi

echo ""
echo "To run:"
echo "  docker run -p 3001:3000 --env-file .env ${FULL_IMAGE}"

