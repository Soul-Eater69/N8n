-- StageRush Database Initialization
-- This runs automatically on first PostgreSQL container start

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Performance tuning for high-concurrency ticket sales
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '768MB';
ALTER SYSTEM SET work_mem = '4MB';
ALTER SYSTEM SET maintenance_work_mem = '128MB';

-- WAL settings for better write performance
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET max_wal_size = '1GB';

-- Lock tuning for seat reservation workload
ALTER SYSTEM SET deadlock_timeout = '2s';
ALTER SYSTEM SET lock_timeout = '10s';
ALTER SYSTEM SET statement_timeout = '30s';

-- Connection pooling hint
ALTER SYSTEM SET idle_in_transaction_session_timeout = '60s';
