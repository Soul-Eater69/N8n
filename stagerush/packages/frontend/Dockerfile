# ─── StageRush Frontend ─────────────────────────────────────────────
# Multi-stage build for Next.js production image

# Stage 1: Dependencies
FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/frontend/package.json packages/frontend/

RUN npm install --workspace=packages/shared --workspace=packages/frontend

# Stage 2: Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules packages/shared/node_modules
COPY --from=deps /app/packages/frontend/node_modules packages/frontend/node_modules

COPY package.json tsconfig.base.json ./
COPY packages/shared/ packages/shared/
COPY packages/frontend/ packages/frontend/

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN cd packages/frontend && npx next build

# Stage 3: Production
FROM node:20-alpine AS production

RUN apk add --no-cache dumb-init curl

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/packages/frontend/.next/standalone ./
COPY --from=builder /app/packages/frontend/.next/static packages/frontend/.next/static
COPY --from=builder /app/packages/frontend/public packages/frontend/public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "packages/frontend/server.js"]
