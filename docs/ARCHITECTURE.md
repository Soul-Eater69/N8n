# FlowForge Architecture Guide

## Table of Contents

1. [System Overview](#system-overview)
2. [Monorepo Structure](#monorepo-structure)
3. [Backend Architecture](#backend-architecture)
4. [Frontend Architecture](#frontend-architecture)
5. [Workflow Execution Engine](#workflow-execution-engine)
6. [Node System](#node-system)
7. [Data Flow](#data-flow)
8. [Security Architecture](#security-architecture)
9. [Multi-Tenancy Model](#multi-tenancy-model)
10. [Infrastructure & Deployment](#infrastructure--deployment)

---

## System Overview

FlowForge is an enterprise-grade workflow automation platform built as a TypeScript monorepo. It enables users to design, execute, and monitor complex automation workflows through a visual node-based editor.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Load Balancer / CDN                    │
└─────────────┬───────────────────────────────┬───────────┘
              │                               │
┌─────────────▼───────────┐     ┌─────────────▼───────────┐
│   Frontend (Next.js)    │     │   Backend (Express.js)  │
│                         │     │                         │
│  - React 18 + TypeScript│     │  - REST API             │
│  - ReactFlow canvas     │     │  - WebSocket server     │
│  - Zustand state mgmt   │     │  - Webhook endpoints    │
│  - Socket.io client     │     │  - Auth middleware       │
│  - TailwindCSS          │     │  - Rate limiting         │
└─────────────────────────┘     └────────┬────────────────┘
                                         │
              ┌──────────────────────────┤
              │                          │
┌─────────────▼───────────┐   ┌──────────▼──────────────┐
│   PostgreSQL Database   │   │   Redis                  │
│                         │   │                          │
│  - Workflow storage     │   │  - Job queue (BullMQ)    │
│  - Execution history    │   │  - Session cache         │
│  - Credential vault     │   │  - Real-time pub/sub     │
│  - Audit logs           │   │  - Rate limit counters   │
│  - User management      │   │  - Scheduled triggers    │
└─────────────────────────┘   └──────────────────────────┘
```

### Core Technology Stack

| Layer       | Technology                  | Purpose                          |
|-------------|----------------------------|----------------------------------|
| Frontend    | Next.js 14, React 18       | SSR/SSG, visual workflow editor  |
| Canvas      | ReactFlow                  | Node-based workflow visualization|
| State       | Zustand                    | Lightweight client state         |
| Styling     | TailwindCSS, Radix UI      | Utility-first responsive UI      |
| Backend     | Express.js, TypeScript     | REST API, webhook handling       |
| Database    | PostgreSQL, Knex.js        | Persistent data storage          |
| Cache/Queue | Redis, BullMQ              | Job queue, caching, pub/sub      |
| Real-time   | Socket.io                  | Live execution monitoring        |
| Auth        | JWT, bcrypt                | Authentication, encryption       |

---

## Monorepo Structure

```
flowforge/
├── packages/
│   ├── backend/               # Express.js API server
│   │   ├── src/
│   │   │   ├── config/        # Database, Redis, app configuration
│   │   │   ├── database/      # Migrations, seeds
│   │   │   ├── engine/        # Workflow execution engine
│   │   │   │   ├── WorkflowEngine.ts      # Main execution orchestrator
│   │   │   │   ├── NodeRegistry.ts        # Node type registration
│   │   │   │   ├── ExpressionEvaluator.ts # Template expression parser
│   │   │   │   ├── SubWorkflowEngine.ts   # Nested workflow execution
│   │   │   │   └── ErrorWorkflowRunner.ts # Error workflow handler
│   │   │   ├── middleware/    # Auth, validation, rate limiting
│   │   │   ├── nodes/        # All node implementations
│   │   │   │   ├── triggers/  # ManualTrigger, WebhookTrigger, CronTrigger
│   │   │   │   ├── logic/     # If, Switch, Merge, Loop, SubWorkflow
│   │   │   │   ├── actions/   # HttpRequest, Respond
│   │   │   │   ├── transform/ # Set, Function, Filter, Aggregate
│   │   │   │   ├── utility/   # Delay, ErrorHandler, Debug, DateTime, Crypto
│   │   │   │   ├── ai/        # OpenAI, Anthropic, Agent, Embeddings, VectorStore
│   │   │   │   ├── integrations/ # 18 service integrations
│   │   │   │   └── register.ts   # Central node registration
│   │   │   ├── routes/       # Express route handlers
│   │   │   ├── services/     # Business logic layer
│   │   │   └── utils/        # Helpers, encryption, logging
│   │   └── package.json
│   │
│   ├── frontend/             # Next.js web application
│   │   ├── src/
│   │   │   ├── app/          # Next.js App Router pages
│   │   │   │   ├── login/
│   │   │   │   └── dashboard/
│   │   │   │       ├── workflows/   # Workflow list + editor
│   │   │   │       ├── executions/  # Execution monitoring
│   │   │   │       ├── credentials/ # Credential management
│   │   │   │       ├── team/        # Team management
│   │   │   │       ├── audit/       # Audit log viewer
│   │   │   │       └── settings/    # Organization settings
│   │   │   ├── components/   # Reusable UI components
│   │   │   │   ├── editor/   # WorkflowCanvas, NodePalette, NodeConfigPanel
│   │   │   │   └── layout/   # Sidebar, navigation
│   │   │   └── lib/          # API client, stores, socket, utilities
│   │   └── package.json
│   │
│   └── shared/               # Shared TypeScript types
│       ├── src/
│       │   ├── types/        # Workflow, Node, Execution, User, API types
│       │   ├── constants.ts  # Plan limits, timeouts, API version
│       │   └── index.ts      # Barrel exports
│       └── package.json
│
├── docs/                     # Documentation
├── docker-compose.yml        # Container orchestration
└── package.json              # Root workspace config
```

---

## Backend Architecture

### Layered Architecture

The backend follows a strict layered architecture:

```
Routes (HTTP handlers) → Services (business logic) → Database (Knex.js)
         ↕                        ↕
    Middleware              Engine (execution)
  (auth, validation)        ↕
                         NodeRegistry
```

### Services Layer

Each service is a class that encapsulates business logic:

| Service              | Responsibility                                        |
|---------------------|------------------------------------------------------|
| `AuthService`       | User registration, login, JWT token management        |
| `WorkflowService`   | CRUD operations on workflows, version history         |
| `ExecutionService`  | Execution lifecycle management, statistics             |
| `CredentialService` | Encrypted credential storage and retrieval            |
| `QueueService`      | BullMQ job queue management for async execution       |
| `WebSocketService`  | Real-time event broadcasting via Socket.io            |
| `AuditService`      | Action logging for compliance and debugging           |

### Middleware Stack

Request processing follows this middleware chain:

```
Request → Helmet → CORS → Compression → JSON Parser → Rate Limiter →
  JWT Auth → Tenant Guard → Role Check → Validation → Route Handler →
  Error Handler → Response
```

### Database Schema

The PostgreSQL schema consists of 9 core tables:

```
tenants         ──┬── users
                  ├── workflows ──── workflow_versions
                  ├── executions
                  ├── credentials
                  ├── webhooks
                  ├── audit_logs
                  └── tags
```

Key design decisions:
- **Tenant isolation**: Every query is scoped by `tenant_id`
- **Cascading deletes**: Removing a tenant removes all child data
- **Indexed columns**: `tenant_id`, `status`, `created_at` on all major tables
- **JSON columns**: `nodes`, `connections`, `data`, `settings` stored as JSONB

---

## Frontend Architecture

### Next.js App Router

The frontend uses Next.js 14 App Router with:
- **Server-side rendering** for the initial page load
- **Client-side navigation** for seamless page transitions
- **Dynamic routes** for workflow editing (`/dashboard/workflows/[id]`)

### State Management (Zustand)

Four independent stores manage different aspects of state:

```typescript
useAuthStore        // User authentication, tenant context
useWorkflowEditorStore  // Active workflow, selected node, dirty flag
useNodePaletteStore     // Search query, category filter, node types
useUIStore             // Sidebar state, theme, panel visibility
```

### Workflow Editor

The visual workflow editor is built on ReactFlow:

```
┌──────────────────────────────────────────────────┐
│ Toolbar: Save | Execute | Add Node | Status      │
├──────────┬───────────────────────┬───────────────┤
│          │                       │               │
│  Node    │   WorkflowCanvas     │  NodeConfig   │
│ Palette  │   (ReactFlow)        │  Panel        │
│          │                       │               │
│ - Search │  - Nodes (draggable) │  - Parameters │
│ - Categories│- Edges (connections)│- Credentials │
│ - Drag   │  - MiniMap           │  - Error opts │
│   to add │  - Controls          │  - Notes      │
│          │                       │               │
└──────────┴───────────────────────┴───────────────┘
```

### Real-time Updates

Socket.io connects the frontend to backend events:
- `execution:started` - Execution begins
- `node:executing` - Individual node starts
- `node:completed` - Node finishes with result
- `execution:completed` - Full execution finishes
- `execution:error` - Execution fails

---

## Workflow Execution Engine

### Execution Lifecycle

```
1. Trigger fires (manual, webhook, cron, sub-workflow)
       │
2. ExecutionService.create() → new execution record (status: pending)
       │
3. QueueService adds job to BullMQ
       │
4. Worker picks up job from queue
       │
5. WorkflowEngine.execute() called
       │
6. Build DAG → Topological sort for execution order
       │
7. For each node in order:
   a. Check abort signal (cancellation support)
   b. Skip if disabled
   c. Gather input data from connected nodes
   d. Resolve expression templates ({{ }})
   e. Decrypt credentials if needed
   f. Call NodeHandler.execute()
   g. Store results in nodeOutputs map
   h. Emit node:completed event
   i. If error + continueOnFail=false → throw
   j. If error + retryOnFail → retry with backoff
       │
8. ExecutionService.updateStatus('success', data)
       │
9. Emit execution:completed event
```

### Expression Evaluation

The `ExpressionEvaluator` resolves template expressions in node parameters:

```
{{ $input.item.json.name }}           → Input data access
{{ $node["HTTP Request"].json.body }} → Cross-node data reference
{{ Math.round($input.item.json.price * 1.08) }} → JavaScript expressions
{{ $now }}                            → Current timestamp
{{ $executionId }}                    → Execution context
```

Expressions are sandboxed to prevent code injection.

### Sub-Workflow Execution

The `SubWorkflowEngine` handles nested workflow calls:

- **Max depth**: 5 levels to prevent infinite recursion
- **Input mapping**: Transform parent data for child workflow
- **Inline mode**: Execute immediately in current process
- **Queued mode**: Add to BullMQ for worker processing
- **Timeout**: Configurable per sub-workflow call
- **Tracking**: Parent-child execution relationship maintained

### Error Workflow Handling

When a workflow fails and has `errorWorkflowId` configured:

1. `ErrorWorkflowRunner.executeErrorWorkflow()` is called
2. Error data is packaged (message, stack, failed node, execution ID)
3. Error workflow is fetched and executed asynchronously (fire-and-forget)
4. Recursion guard prevents error workflows from triggering themselves
5. All error workflow failures are logged but silently swallowed

---

## Node System

### Node Interface

Every node implements `INodeHandler`:

```typescript
interface INodeHandler {
  description: INodeTypeDescription;  // Metadata, properties, UI config
  execute(context: INodeExecutionContext): Promise<INodeExecutionResult>;
}
```

### Node Categories

| Category     | Count | Nodes                                                    |
|-------------|-------|----------------------------------------------------------|
| Triggers    | 3     | Manual, Webhook, Cron                                    |
| Logic       | 5     | If, Switch, Merge, Loop, Sub-Workflow                    |
| Actions     | 2     | HTTP Request, Respond                                    |
| Transform   | 4     | Set, Function, Filter, Aggregate                         |
| Utility     | 6     | Delay, Error Handler, Error Trigger, Debug, DateTime, Crypto |
| AI          | 8     | OpenAI, Anthropic, AI Agent, Text Splitter, Embeddings, Vector Store, Summarize, Sentiment |
| Integration | 18    | Slack, GitHub, Gmail, Discord, Telegram, Google Sheets, Notion, Jira, PostgreSQL, MySQL, MongoDB, Redis, Stripe, Twilio, SendGrid, AWS S3, HubSpot, Webhook Response |

**Total: 46 nodes**

### Node Execution Context

Each node receives:

```typescript
interface INodeExecutionContext {
  node: IWorkflowNode;                    // Node configuration
  inputData: INodeExecutionData[];         // Data from upstream nodes
  parameters: Record<string, unknown>;     // Resolved parameters
  credentials: Record<string, unknown>;    // Decrypted credentials
  context: {
    executionId: string;
    workflowId: string;
    tenantId: string;
    mode: string;
  };
}
```

### Data Format

All data flows between nodes as `INodeExecutionData[]`:

```typescript
interface INodeExecutionData {
  json: Record<string, unknown>;  // Primary data payload
  binary?: Record<string, IBinaryData>;  // Optional binary attachments
  pairedItem?: { item: number };  // Item tracking for debugging
}
```

---

## Data Flow

### Request → Response Flow

```
Client → Express Router → Auth Middleware → Validation → Service → Database
                                                              ↓
Client ← JSON Response ← Error Handler ← Service Response ←──┘
```

### Execution Data Flow

```
Trigger Node
    │
    ▼  [{ json: { webhookData: {...} } }]
  Node A (HTTP Request)
    │
    ▼  [{ json: { statusCode: 200, body: {...} } }]
  Node B (Function - transform)
    │
    ├──▶ Node C (Slack - notify)
    │       └──▶ [{ json: { success: true, ts: "..." } }]
    │
    └──▶ Node D (PostgreSQL - store)
            └──▶ [{ json: { id: 1, created: true } }]
```

### WebSocket Event Flow

```
WorkflowEngine ──emit──▶ Worker ──broadcast──▶ WebSocketService ──emit──▶ Browser
                                                                          │
                                                                    Socket.io Client
                                                                          │
                                                                    Zustand Store
                                                                          │
                                                                    React Re-render
```

---

## Security Architecture

### Authentication

- **bcrypt** password hashing (10 salt rounds)
- **JWT** access tokens (15-minute expiry)
- **JWT** refresh tokens (7-day expiry)
- Token stored in localStorage, sent as `Authorization: Bearer` header

### Credential Encryption

All stored credentials are encrypted at rest:

```
User Input → JSON.stringify → AES-256-GCM encrypt → Base64 → PostgreSQL
PostgreSQL → Base64 → AES-256-GCM decrypt → JSON.parse → Node Execution
```

- **Algorithm**: AES-256-GCM
- **Key derivation**: scrypt
- **IV**: Random 16 bytes per encryption
- **Auth tag**: 16 bytes for integrity verification

### Rate Limiting

| Endpoint Category | Limit          | Window    |
|------------------|----------------|-----------|
| API (general)    | 1,000 requests | 15 min    |
| Authentication   | 20 requests    | 15 min    |
| Webhooks         | 500 requests   | 1 min     |
| Executions       | 100 requests   | 1 min     |

### Input Validation

All API inputs are validated using Zod schemas before processing.

---

## Multi-Tenancy Model

FlowForge uses a **shared database, isolated data** multi-tenancy model:

```
┌─────────────────────────────────┐
│         PostgreSQL DB           │
│                                 │
│  Tenant A │ Tenant B │ Tenant C │
│  ─────────┼──────────┼──────────│
│  workflows│ workflows│ workflows│
│  users    │ users    │ users    │
│  creds    │ creds    │ creds    │
│  execs    │ execs    │ execs    │
└─────────────────────────────────┘
```

- Every table has a `tenant_id` column
- All queries are scoped by the authenticated user's tenant
- JWT tokens include `tenantId` claim
- Middleware enforces tenant boundaries

### Plan-Based Limits

```typescript
PLAN_LIMITS = {
  free:       { workflows: 5,   executions: 500,   users: 2,  credentials: 10 },
  starter:    { workflows: 25,  executions: 5000,  users: 5,  credentials: 50 },
  pro:        { workflows: 100, executions: 50000, users: 25, credentials: 200 },
  enterprise: { workflows: -1,  executions: -1,    users: -1, credentials: -1 },
}
```

---

## Infrastructure & Deployment

### Production Architecture

```
                    ┌──────────────┐
                    │   Nginx /    │
                    │ CloudFlare   │
                    └──────┬───────┘
                           │
              ┌────────────┴────────────┐
              │                         │
    ┌─────────▼─────────┐   ┌──────────▼──────────┐
    │  Frontend (Vercel) │   │  Backend Cluster     │
    │  or Static CDN     │   │  (Docker / K8s)      │
    └────────────────────┘   │                      │
                             │  Instance 1 (API)    │
                             │  Instance 2 (API)    │
                             │  Instance 3 (Worker) │
                             │  Instance 4 (Worker) │
                             └────────┬─────────────┘
                                      │
                    ┌─────────────────┤
                    │                 │
          ┌─────────▼──────┐  ┌──────▼──────────┐
          │  PostgreSQL    │  │  Redis Cluster   │
          │  (Primary +   │  │  (Sentinel or    │
          │   Replica)    │  │   Cluster mode)  │
          └───────────────┘  └──────────────────┘
```

### Docker Compose Services

```yaml
services:
  backend:    # Express.js API + Worker
  frontend:   # Next.js SSR application
  postgres:   # PostgreSQL 15
  redis:      # Redis 7
```

### Environment Variables

```
DATABASE_HOST, DATABASE_PORT, DATABASE_NAME, DATABASE_USER, DATABASE_PASSWORD
REDIS_HOST, REDIS_PORT, REDIS_PASSWORD
JWT_SECRET, JWT_EXPIRES_IN, JWT_REFRESH_EXPIRES_IN
ENCRYPTION_KEY
CORS_ORIGINS
NODE_ENV
PORT
```

### Scaling Strategy

- **API servers**: Horizontal scaling behind load balancer
- **Workers**: Independent scaling based on queue depth
- **Database**: Read replicas for query scaling
- **Redis**: Cluster mode for queue scaling
- **Frontend**: CDN/edge deployment for global performance
