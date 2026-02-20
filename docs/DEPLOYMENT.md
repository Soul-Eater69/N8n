# FlowForge Deployment Guide

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [Docker Deployment](#docker-deployment)
4. [Production Deployment](#production-deployment)
5. [Environment Variables](#environment-variables)
6. [Database Setup](#database-setup)
7. [SSL/TLS Configuration](#ssltls-configuration)
8. [Scaling & High Availability](#scaling--high-availability)
9. [Monitoring & Logging](#monitoring--logging)
10. [Backup & Recovery](#backup--recovery)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Requirement   | Minimum Version | Recommended    |
|--------------|-----------------|----------------|
| Node.js      | 20.0.0          | 20 LTS         |
| npm          | 9.0.0           | 10+            |
| PostgreSQL   | 14              | 16             |
| Redis        | 6               | 7              |
| Docker       | 20.10           | 24+ (optional) |
| Memory       | 2 GB            | 4 GB+          |
| CPU          | 2 cores         | 4+ cores       |

---

## Local Development Setup

### 1. Clone and Install

```bash
git clone <repository-url> flowforge
cd flowforge
npm install
```

This installs dependencies across all three packages (backend, frontend, shared) using npm workspaces.

### 2. Set Up PostgreSQL

```bash
# macOS with Homebrew
brew install postgresql@16
brew services start postgresql@16

# Ubuntu/Debian
sudo apt install postgresql-16
sudo systemctl start postgresql

# Create database
createdb flowforge_dev
```

### 3. Set Up Redis

```bash
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt install redis-server
sudo systemctl start redis
```

### 4. Configure Environment

```bash
cp packages/backend/.env.example packages/backend/.env
```

Edit `packages/backend/.env`:

```env
NODE_ENV=development
PORT=3000

# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=flowforge_dev
DATABASE_USER=postgres
DATABASE_PASSWORD=

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Auth
JWT_SECRET=your-secure-random-string-at-least-32-chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Encryption
ENCRYPTION_KEY=your-32-character-encryption-key!

# CORS
CORS_ORIGINS=http://localhost:3001
```

### 5. Run Database Migrations

```bash
cd packages/backend
npm run migrate
```

### 6. Start Development Servers

```bash
# From the root directory - starts both frontend and backend
npm run dev
```

This runs:
- Backend: `http://localhost:3000`
- Frontend: `http://localhost:3001`

### 7. Create Your First Account

Visit `http://localhost:3001` and register a new organization.

---

## Docker Deployment

### docker-compose.yml

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: flowforge
      POSTGRES_USER: flowforge
      POSTGRES_PASSWORD: ${DB_PASSWORD:-changeme}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U flowforge"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD:-changeme}
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: .
      dockerfile: packages/backend/Dockerfile
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_HOST: postgres
      DATABASE_PORT: 5432
      DATABASE_NAME: flowforge
      DATABASE_USER: flowforge
      DATABASE_PASSWORD: ${DB_PASSWORD:-changeme}
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: ${REDIS_PASSWORD:-changeme}
      JWT_SECRET: ${JWT_SECRET}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      CORS_ORIGINS: ${CORS_ORIGINS:-http://localhost:3001}
    ports:
      - "3000:3000"

  frontend:
    build:
      context: .
      dockerfile: packages/frontend/Dockerfile
    restart: unless-stopped
    depends_on:
      - backend
    environment:
      NEXT_PUBLIC_API_URL: ${API_URL:-http://localhost:3000}
    ports:
      - "3001:3000"

volumes:
  postgres_data:
  redis_data:
```

### Build and Run

```bash
# Set required environment variables
export JWT_SECRET=$(openssl rand -hex 32)
export ENCRYPTION_KEY=$(openssl rand -hex 16)
export DB_PASSWORD=$(openssl rand -hex 16)
export REDIS_PASSWORD=$(openssl rand -hex 16)

# Build and start
docker compose up -d

# Check logs
docker compose logs -f

# Run migrations
docker compose exec backend npm run migrate
```

### Backend Dockerfile

```dockerfile
# packages/backend/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/backend/package*.json ./packages/backend/

RUN npm ci --workspace=packages/shared --workspace=packages/backend

COPY packages/shared ./packages/shared
COPY packages/backend ./packages/backend

RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=packages/backend

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist
COPY --from=builder /app/packages/backend/package.json ./packages/backend/

EXPOSE 3000
CMD ["node", "packages/backend/dist/index.js"]
```

---

## Production Deployment

### Recommended Architecture

```
Internet → CloudFlare / AWS CloudFront (CDN + WAF)
    │
    ├── Frontend → Vercel / AWS Amplify / Static CDN
    │
    └── Backend → Load Balancer (ALB / Nginx)
            │
            ├── API Server 1 (ECS / K8s Pod)
            ├── API Server 2
            ├── Worker 1 (execution processing)
            └── Worker 2
                    │
            ┌───────┴───────┐
            │               │
        PostgreSQL      Redis Cluster
        (RDS / Aurora)  (ElastiCache)
```

### AWS Deployment

#### Using ECS (Elastic Container Service)

1. **Push images to ECR:**
```bash
aws ecr create-repository --repository-name flowforge-backend
aws ecr create-repository --repository-name flowforge-frontend

# Build and push
docker build -t flowforge-backend -f packages/backend/Dockerfile .
docker tag flowforge-backend:latest <account>.dkr.ecr.<region>.amazonaws.com/flowforge-backend:latest
docker push <account>.dkr.ecr.<region>.amazonaws.com/flowforge-backend:latest
```

2. **Create RDS PostgreSQL instance**
3. **Create ElastiCache Redis cluster**
4. **Create ECS service with task definitions**
5. **Set up ALB with health check on `/api/v1/health`**

#### Using Kubernetes

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: flowforge-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: flowforge-api
  template:
    metadata:
      labels:
        app: flowforge-api
    spec:
      containers:
        - name: api
          image: flowforge-backend:latest
          ports:
            - containerPort: 3000
          envFrom:
            - secretRef:
                name: flowforge-secrets
          resources:
            requests:
              memory: "512Mi"
              cpu: "250m"
            limits:
              memory: "1Gi"
              cpu: "1000m"
          livenessProbe:
            httpGet:
              path: /api/v1/health
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /api/v1/health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: flowforge-worker
spec:
  replicas: 2
  selector:
    matchLabels:
      app: flowforge-worker
  template:
    metadata:
      labels:
        app: flowforge-worker
    spec:
      containers:
        - name: worker
          image: flowforge-backend:latest
          command: ["node", "dist/worker.js"]
          envFrom:
            - secretRef:
                name: flowforge-secrets
          resources:
            requests:
              memory: "1Gi"
              cpu: "500m"
            limits:
              memory: "2Gi"
              cpu: "2000m"
```

---

## Environment Variables

### Required

| Variable          | Description                              | Example                     |
|------------------|------------------------------------------|-----------------------------|
| `DATABASE_HOST`  | PostgreSQL hostname                      | `localhost`                 |
| `DATABASE_PORT`  | PostgreSQL port                          | `5432`                      |
| `DATABASE_NAME`  | Database name                            | `flowforge`                 |
| `DATABASE_USER`  | Database user                            | `flowforge`                 |
| `DATABASE_PASSWORD` | Database password                     | `secure-password`           |
| `REDIS_HOST`     | Redis hostname                           | `localhost`                 |
| `REDIS_PORT`     | Redis port                               | `6379`                      |
| `JWT_SECRET`     | JWT signing secret (min 32 chars)        | `openssl rand -hex 32`     |
| `ENCRYPTION_KEY` | Credential encryption key (32 chars)     | `openssl rand -hex 16`     |

### Optional

| Variable                | Default          | Description                       |
|------------------------|------------------|-----------------------------------|
| `NODE_ENV`             | `development`    | Environment mode                  |
| `PORT`                 | `3000`           | API server port                   |
| `REDIS_PASSWORD`       |                  | Redis password                    |
| `CORS_ORIGINS`         | `*`              | Allowed CORS origins              |
| `JWT_EXPIRES_IN`       | `15m`            | Access token expiry               |
| `JWT_REFRESH_EXPIRES_IN` | `7d`           | Refresh token expiry              |
| `DATABASE_POOL_MIN`    | `2`              | Min DB pool connections           |
| `DATABASE_POOL_MAX`    | `10`             | Max DB pool connections           |
| `QUEUE_CONCURRENCY`    | `5`              | Worker job concurrency            |
| `EXECUTION_TIMEOUT`    | `300000`         | Default execution timeout (ms)    |
| `LOG_LEVEL`            | `info`           | Log level (debug/info/warn/error) |

---

## Database Setup

### Running Migrations

```bash
# Development
cd packages/backend
npm run migrate

# Production (via Docker)
docker compose exec backend npm run migrate

# Check migration status
npm run migrate:status
```

### Database Indexes

The migration automatically creates indexes on:
- `workflows.tenant_id`
- `workflows.status`
- `executions.tenant_id`
- `executions.workflow_id`
- `executions.status`
- `executions.started_at`
- `credentials.tenant_id`
- `audit_logs.tenant_id`
- `audit_logs.created_at`

### Connection Pooling

For production, configure connection pooling:

```env
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=20
```

For high-traffic deployments, use PgBouncer:

```
App → PgBouncer (connection pooler) → PostgreSQL
```

---

## SSL/TLS Configuration

### Nginx Reverse Proxy

```nginx
server {
    listen 443 ssl http2;
    server_name flowforge.example.com;

    ssl_certificate /etc/letsencrypt/live/flowforge.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/flowforge.example.com/privkey.pem;

    # API and WebSocket
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # Frontend
    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Let's Encrypt with Certbot

```bash
sudo certbot --nginx -d flowforge.example.com
```

---

## Scaling & High Availability

### Horizontal Scaling

| Component    | Scaling Strategy                          | Stateless? |
|-------------|------------------------------------------|-----------|
| API Server  | Add more instances behind LB             | Yes       |
| Worker      | Add more worker processes                | Yes       |
| Frontend    | CDN / edge deployment                    | Yes       |
| PostgreSQL  | Read replicas + connection pooling       | No        |
| Redis       | Cluster mode / Sentinel                  | No        |

### Worker Scaling

Workers auto-scale based on queue depth:

```bash
# Scale workers independently
docker compose up -d --scale worker=4
```

### Session Affinity

WebSocket connections require sticky sessions if running multiple API servers:

```nginx
upstream backend {
    ip_hash;  # Sticky sessions for WebSocket
    server api1:3000;
    server api2:3000;
}
```

Alternatively, use Redis adapter for Socket.io (already configured).

---

## Monitoring & Logging

### Health Check Endpoint

```
GET /api/v1/health
```

Returns `200 OK` when the service is healthy.

### Structured Logging

FlowForge uses Pino for structured JSON logging:

```json
{
  "level": 30,
  "time": 1705320000000,
  "pid": 1234,
  "msg": "Workflow execution completed",
  "executionId": "uuid",
  "workflowId": "uuid",
  "duration": 5230
}
```

### Log Aggregation

Recommended stack:
- **ELK Stack**: Elasticsearch + Logstash + Kibana
- **Grafana Loki**: Lightweight log aggregation
- **AWS CloudWatch**: Native AWS logging
- **Datadog**: Full observability platform

### Metrics to Monitor

| Metric                        | Alert Threshold    |
|-------------------------------|-------------------|
| API response time (p95)       | > 500ms           |
| Execution queue depth         | > 100 jobs        |
| Failed execution rate         | > 5%              |
| Database connection pool usage | > 80%            |
| Redis memory usage            | > 80%             |
| Disk space                    | < 20% free        |
| Worker process count          | < min replicas     |

---

## Backup & Recovery

### PostgreSQL Backup

```bash
# Automated daily backup
pg_dump -h localhost -U flowforge -d flowforge -F c -f backup_$(date +%Y%m%d).dump

# Restore from backup
pg_restore -h localhost -U flowforge -d flowforge -c backup_20240115.dump
```

### Continuous Archiving (WAL)

For point-in-time recovery:

```
archive_mode = on
archive_command = 'cp %p /backups/wal/%f'
```

### Redis Backup

```bash
# Trigger RDB snapshot
redis-cli BGSAVE

# Copy the dump file
cp /var/lib/redis/dump.rdb /backups/redis/
```

### Encryption Key Backup

**Critical:** The `ENCRYPTION_KEY` is used to encrypt stored credentials. If lost, all encrypted credentials become unrecoverable. Store it in a secure vault (AWS Secrets Manager, HashiCorp Vault, etc.).

---

## Troubleshooting

### Common Issues

#### "Connection refused" to PostgreSQL
```bash
# Check if PostgreSQL is running
pg_isready -h localhost -p 5432

# Check the connection from the container
docker compose exec backend pg_isready -h postgres -p 5432
```

#### "Connection refused" to Redis
```bash
# Check Redis
redis-cli ping

# With password
redis-cli -a yourpassword ping
```

#### Migrations fail
```bash
# Check migration status
npm run migrate:status

# Rollback last migration
npm run migrate:rollback

# Re-run migrations
npm run migrate
```

#### WebSocket disconnections
- Check that Nginx is configured for WebSocket upgrade
- Verify `Connection: upgrade` and `Upgrade: websocket` headers
- Check for proxy timeout settings (default 60s may be too low)

#### High memory usage on workers
- Reduce `QUEUE_CONCURRENCY`
- Check for memory leaks in custom Function nodes
- Monitor execution data sizes

#### Execution timeouts
- Increase `EXECUTION_TIMEOUT` environment variable
- Check for slow external API calls in nodes
- Verify network connectivity from worker containers

### Debug Mode

```bash
# Enable debug logging
LOG_LEVEL=debug npm run dev

# Enable specific debug namespaces
DEBUG=flowforge:* npm run dev
```

### Support

For issues and bug reports: Check the project repository issues.
