# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root config
COPY package.json tsconfig.base.json ./

# Copy shared package
COPY packages/shared/package.json packages/shared/
COPY packages/shared/tsconfig.json packages/shared/
COPY packages/shared/src packages/shared/src/

# Copy backend package
COPY packages/backend/package.json packages/backend/
COPY packages/backend/tsconfig.json packages/backend/
COPY packages/backend/src packages/backend/src/

# Install dependencies
RUN npm install --workspace=packages/shared --workspace=packages/backend

# Build shared and backend
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=packages/backend

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Copy built artifacts
COPY --from=builder /app/package.json ./
COPY --from=builder /app/packages/shared/package.json packages/shared/
COPY --from=builder /app/packages/shared/dist packages/shared/dist/
COPY --from=builder /app/packages/backend/package.json packages/backend/
COPY --from=builder /app/packages/backend/dist packages/backend/dist/

# Install production dependencies only
RUN npm install --workspace=packages/shared --workspace=packages/backend --omit=dev

# Security: run as non-root
RUN addgroup -g 1001 -S nodejs && adduser -S flowforge -u 1001
USER flowforge

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:4000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "packages/backend/dist/index.js"]
