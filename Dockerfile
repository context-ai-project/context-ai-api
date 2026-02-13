# ============================================
# Context.ai API — Multi-stage Dockerfile
# ============================================
# Optimised for production: small image, non-root user,
# health-check included, only production deps shipped.
# ============================================

# --------------- Stage 1: Build ---------------
FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy shared package first (required by link dependency)
COPY context-ai-shared/ /shared/
WORKDIR /shared
RUN pnpm install --frozen-lockfile && pnpm build

WORKDIR /app

# Copy dependency manifests
COPY context-ai-api/package.json context-ai-api/pnpm-lock.yaml ./

# Rewrite the link dependency to point to /shared
RUN sed -i 's|"link:../context-ai-shared"|"file:/shared"|' package.json

# Install ALL dependencies (needed for build)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY context-ai-api/ .

# Build application
RUN pnpm build

# --------------- Stage 2: Production ---------------
FROM node:22-alpine AS production

LABEL maintainer="Context.ai Team"
LABEL description="Context.ai API — RAG-based knowledge management system"

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Copy shared package (production build only)
COPY --from=builder /shared/dist /shared/dist
COPY --from=builder /shared/package.json /shared/package.json

# Copy dependency manifests
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./

# Rewrite link → file for production
RUN sed -i 's|"link:../context-ai-shared"|"file:/shared"|' package.json

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile && \
    pnpm store prune

# Copy built application
COPY --from=builder /app/dist ./dist

# Copy health-check helper
COPY context-ai-api/scripts/docker-healthcheck.js ./scripts/docker-healthcheck.js

# Set ownership
RUN chown -R nestjs:nodejs /app

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3000

# Environment defaults
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node scripts/docker-healthcheck.js

# Start application
CMD ["node", "dist/main.js"]

