# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root config
COPY package.json tsconfig.base.json ./

# Copy shared package
COPY packages/shared/package.json packages/shared/
COPY packages/shared/tsconfig.json packages/shared/
COPY packages/shared/src packages/shared/src/

# Copy frontend package
COPY packages/frontend/package.json packages/frontend/
COPY packages/frontend/tsconfig.json packages/frontend/
COPY packages/frontend/next.config.js packages/frontend/
COPY packages/frontend/tailwind.config.ts packages/frontend/
COPY packages/frontend/postcss.config.js packages/frontend/
COPY packages/frontend/src packages/frontend/src/

# Install dependencies
RUN npm install --workspace=packages/shared --workspace=packages/frontend

# Build
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=packages/frontend

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy built artifacts
COPY --from=builder /app/packages/frontend/.next packages/frontend/.next/
COPY --from=builder /app/packages/frontend/public packages/frontend/public/
COPY --from=builder /app/packages/frontend/package.json packages/frontend/
COPY --from=builder /app/packages/frontend/next.config.js packages/frontend/
COPY --from=builder /app/node_modules node_modules/
COPY --from=builder /app/package.json ./

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
USER nextjs

EXPOSE 3000

CMD ["npm", "run", "start", "--workspace=packages/frontend"]
