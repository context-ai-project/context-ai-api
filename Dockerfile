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

# Build arg for GitHub Packages authentication
# Pass at build time: --build-arg NODE_AUTH_TOKEN=ghp_xxx
ARG NODE_AUTH_TOKEN

# Copy dependency manifests and .npmrc (registry config)
COPY package.json pnpm-lock.yaml .npmrc ./

# Install ALL dependencies (needed for build)
# NODE_AUTH_TOKEN is used by .npmrc to authenticate with GitHub Packages
RUN NODE_AUTH_TOKEN=${NODE_AUTH_TOKEN} pnpm install --frozen-lockfile

# Copy source code
COPY . .

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

# Build arg for GitHub Packages authentication (needed for prod install)
ARG NODE_AUTH_TOKEN

# Copy dependency manifests and .npmrc
COPY package.json pnpm-lock.yaml .npmrc ./

# Install production dependencies only (--ignore-scripts skips husky/prepare)
RUN NODE_AUTH_TOKEN=${NODE_AUTH_TOKEN} pnpm install --prod --frozen-lockfile --ignore-scripts && \
    pnpm store prune

# Remove .npmrc after install (don't ship auth tokens in final image)
RUN rm -f .npmrc

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Copy health-check helper
COPY scripts/docker-healthcheck.js ./scripts/docker-healthcheck.js

# Set ownership
RUN chown -R nestjs:nodejs /app

# Switch to non-root user
USER nestjs

# Cloud Run uses PORT env var (default 3001)
EXPOSE 3001

# Environment defaults
ENV NODE_ENV=production
ENV PORT=3001

# Health check (for local Docker; Cloud Run uses its own probes)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node scripts/docker-healthcheck.js

# Start application
CMD ["node", "dist/main.js"]
