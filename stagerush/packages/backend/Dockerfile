# ─── StageRush Backend ──────────────────────────────────────────────
# Multi-stage build for minimal production image

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace root files
COPY package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/backend/package.json packages/backend/

# Install all dependencies
RUN npm install --workspace=packages/shared --workspace=packages/backend

# Copy source
COPY packages/shared/ packages/shared/
COPY packages/backend/ packages/backend/

# Build shared types first, then backend
RUN npm run build --workspace=packages/shared 2>/dev/null || true
RUN npm run build --workspace=packages/backend 2>/dev/null || true

# Stage 2: Production
FROM node:20-alpine AS production

RUN apk add --no-cache dumb-init curl

WORKDIR /app

ENV NODE_ENV=production

# Copy package files and install production deps only
COPY package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/backend/package.json packages/backend/

RUN npm install --workspace=packages/shared --workspace=packages/backend --omit=dev

# Copy built artifacts
COPY --from=builder /app/packages/shared/ packages/shared/
COPY --from=builder /app/packages/backend/ packages/backend/

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:4100/health || exit 1

EXPOSE 4100

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "packages/backend/src/index.ts"]
