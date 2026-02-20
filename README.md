# FlowForge

**Enterprise Workflow Automation Platform**

FlowForge is a powerful, self-hostable workflow automation platform that lets you connect anything to everything. Build complex automations visually with 46 built-in nodes spanning AI, databases, messaging, CRMs, cloud services, and more. Designed for teams that need production-grade reliability, multi-tenancy, and real-time monitoring.

---

## Key Features

### Visual Workflow Editor
- Drag-and-drop node-based workflow builder powered by ReactFlow
- Real-time collaborative editing with cursor tracking
- Node palette with search and category filtering
- Expression editor with auto-complete for dynamic data mapping
- Mini-map and zoom controls for complex workflows

### 46 Built-in Nodes

| Category       | Nodes | Highlights                                                |
|---------------|-------|----------------------------------------------------------|
| **Triggers**  | 3     | Manual, Webhook (any HTTP method), Cron scheduling        |
| **Logic**     | 5     | If/Else, Switch, Merge, Loop, Sub-Workflow execution      |
| **Actions**   | 2     | HTTP Request (full control), Respond to caller            |
| **Transform** | 4     | Set fields, Custom JavaScript, Filter, Aggregate          |
| **Utility**   | 6     | Delay, Error Handler, Error Trigger, Debug, DateTime, Crypto |
| **AI**        | 8     | OpenAI (GPT-4o, DALL-E, Whisper), Anthropic Claude, AI Agent with tools, Embeddings, Vector Store, Summarize, Sentiment |
| **Integrations** | 18 | Slack, GitHub, Gmail, Discord, Telegram, Google Sheets, Notion, Jira, PostgreSQL, MySQL, MongoDB, Redis, Stripe, Twilio, SendGrid, AWS S3, HubSpot, Webhook Response |

### AI-Native Automation
- **OpenAI** - Chat completions, image generation (DALL-E 3), audio transcription (Whisper), embeddings
- **Anthropic** - Claude chat and completions with all model variants
- **AI Agent** - LangChain-style agents with tool use, memory management, and iterative reasoning
- **Vector Store** - Store and query embeddings for RAG (Retrieval Augmented Generation)
- **Text Splitter** - Chunk documents for embedding with configurable strategies

### Enterprise-Ready
- **Multi-tenancy** - Complete tenant isolation with plan-based limits
- **Role-based access** - Owner, Admin, Member, Viewer roles with granular permissions
- **Audit logging** - Full audit trail of all user actions with IP tracking
- **Encrypted credentials** - AES-256-GCM encryption for all stored secrets
- **Rate limiting** - Configurable per-endpoint rate limits
- **JWT authentication** - Secure token-based auth with refresh flow

### Production-Grade Execution
- **BullMQ job queue** - Distributed, reliable workflow execution with retries
- **Sub-workflows** - Call workflows from other workflows (up to 5 levels deep)
- **Error workflows** - Dedicated error handling workflows with automatic triggering
- **Real-time monitoring** - WebSocket-powered live execution tracking
- **Execution history** - Complete execution logs with per-node results
- **Cancellation support** - Cancel running executions gracefully
- **Configurable timeouts** - Per-workflow and per-node timeout settings
- **Retry logic** - Per-node retry with configurable backoff

---

## Quick Start

### Prerequisites

- Node.js >= 20.0.0
- PostgreSQL 14+
- Redis 6+

### Installation

```bash
# Clone the repository
git clone <repository-url> flowforge
cd flowforge

# Install dependencies
npm install

# Configure environment
cp packages/backend/.env.example packages/backend/.env
# Edit .env with your database and Redis credentials

# Run database migrations
cd packages/backend && npm run migrate && cd ..

# Start development servers
npm run dev
```

The application starts at:
- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:3000

### Docker Quick Start

```bash
# Generate secrets
export JWT_SECRET=$(openssl rand -hex 32)
export ENCRYPTION_KEY=$(openssl rand -hex 16)

# Start all services
docker compose up -d

# Run migrations
docker compose exec backend npm run migrate
```

---

## Architecture Overview

```
┌─────────────────────┐     ┌─────────────────────┐
│  Next.js Frontend   │────▶│  Express.js Backend  │
│  (React + ReactFlow)│◀────│  (REST + WebSocket)  │
└─────────────────────┘     └──────────┬───────────┘
                                       │
                            ┌──────────┴──────────┐
                            │                     │
                    ┌───────▼──────┐    ┌─────────▼────────┐
                    │  PostgreSQL  │    │  Redis + BullMQ   │
                    │  (Storage)   │    │  (Queue + Cache)  │
                    └──────────────┘    └──────────────────┘
```

### Monorepo Structure

```
flowforge/
├── packages/
│   ├── backend/        # Express.js API server + execution engine
│   ├── frontend/       # Next.js web application
│   └── shared/         # Shared TypeScript types and constants
├── docs/               # Documentation
│   ├── ARCHITECTURE.md # System architecture deep dive
│   ├── API_REFERENCE.md# Complete REST API documentation
│   ├── NODE_REFERENCE.md# All 46 nodes documented
│   ├── DEPLOYMENT.md   # Production deployment guide
│   └── DEVELOPMENT.md  # Developer guide for contributors
└── docker-compose.yml  # Container orchestration
```

---

## Workflow Execution Engine

The engine processes workflows as directed acyclic graphs (DAGs):

1. **Trigger fires** (manual click, webhook HTTP request, cron schedule)
2. **DAG analysis** - Topological sort determines execution order
3. **Node-by-node execution** - Each node processes input data and produces output
4. **Expression resolution** - `{{ $input.item.json.name }}` expressions are evaluated
5. **Credential injection** - Encrypted credentials are decrypted at execution time
6. **Error handling** - Per-node retry, continue-on-fail, error workflows

### Expression System

Dynamic data mapping between nodes:

```
{{ $input.item.json.email }}                    // Access input data
{{ $node["HTTP Request"].json.body.users[0] }}  // Cross-node references
{{ Math.round($input.item.json.price * 1.08) }} // JavaScript expressions
{{ $now }}                                       // Current timestamp
{{ $executionId }}                               // Execution context
```

### Sub-Workflow Support

Call workflows from workflows with:
- Input data mapping (dot-notation field transformation)
- Inline or queued execution modes
- Configurable timeouts
- Maximum 5 levels of nesting

### Error Workflows

When a workflow fails:
1. Engine checks for `errorWorkflowId` in workflow settings
2. Error data is packaged (error message, failed node, execution details)
3. Error workflow is triggered asynchronously
4. Recursion guard prevents error workflow loops

---

## API

Full REST API with standard JSON responses:

| Endpoint                          | Method | Description                    |
|----------------------------------|--------|--------------------------------|
| `/api/v1/auth/register`         | POST   | Create tenant + owner account  |
| `/api/v1/auth/login`            | POST   | Authenticate and get tokens    |
| `/api/v1/auth/refresh`          | POST   | Refresh access token           |
| `/api/v1/workflows`             | GET    | List workflows (paginated)     |
| `/api/v1/workflows`             | POST   | Create workflow                |
| `/api/v1/workflows/:id`         | GET    | Get workflow details           |
| `/api/v1/workflows/:id`         | PUT    | Update workflow                |
| `/api/v1/workflows/:id/execute` | POST   | Execute workflow manually      |
| `/api/v1/executions`            | GET    | List executions (filtered)     |
| `/api/v1/executions/:id`        | GET    | Get execution details          |
| `/api/v1/executions/:id/cancel` | POST   | Cancel running execution       |
| `/api/v1/credentials`           | CRUD   | Manage encrypted credentials   |
| `/api/v1/webhooks/:path`        | ANY    | Webhook trigger endpoints      |
| `/api/v1/nodes`                 | GET    | List available node types      |
| `/api/v1/audit`                 | GET    | Query audit logs               |

See [API Reference](docs/API_REFERENCE.md) for complete documentation.

---

## Node Examples

### Send a Slack message when a GitHub issue is created

```json
{
  "nodes": [
    { "type": "trigger.webhook", "parameters": { "path": "/github-issues", "httpMethod": "POST" } },
    { "type": "transform.set", "parameters": { "assignments": [{ "field": "message", "value": "={{ 'New issue: ' + $input.item.json.body.issue.title }}" }] } },
    { "type": "integration.slack", "parameters": { "operation": "sendMessage", "channel": "C01234567", "text": "={{ $input.item.json.message }}" } }
  ]
}
```

### AI-powered customer support classification

```json
{
  "nodes": [
    { "type": "trigger.webhook", "parameters": { "path": "/support-ticket" } },
    { "type": "ai.sentiment", "parameters": { "field": "body.message" } },
    { "type": "ai.openai", "parameters": { "operation": "chat", "systemPrompt": "Classify this support ticket into: billing, technical, feature_request, other", "userPrompt": "={{ $input.item.json.body.message }}" } },
    { "type": "logic.switch", "parameters": { "field": "text", "rules": [{ "value": "billing", "output": 0 }, { "value": "technical", "output": 1 }] } },
    { "type": "integration.slack", "parameters": { "channel": "#billing-support" } },
    { "type": "integration.jira", "parameters": { "operation": "createIssue", "project": "TECH" } }
  ]
}
```

### Scheduled database backup to S3

```json
{
  "nodes": [
    { "type": "trigger.cron", "parameters": { "cronExpression": "0 2 * * *" } },
    { "type": "integration.postgres", "parameters": { "operation": "executeQuery", "query": "SELECT * FROM important_data" } },
    { "type": "transform.function", "parameters": { "functionCode": "return [{ json: { data: JSON.stringify($input.all()), timestamp: new Date().toISOString() } }]" } },
    { "type": "integration.awsS3", "parameters": { "operation": "putObject", "bucket": "backups", "key": "={{ 'backup-' + $now + '.json' }}" } },
    { "type": "integration.slack", "parameters": { "operation": "sendMessage", "text": "Backup completed successfully" } }
  ]
}
```

---

## Security

| Feature                  | Implementation                              |
|-------------------------|---------------------------------------------|
| Password hashing        | bcrypt with 10 salt rounds                  |
| Token authentication    | JWT with 15-min access + 7-day refresh      |
| Credential encryption   | AES-256-GCM with scrypt key derivation      |
| Input validation        | Zod schema validation on all endpoints      |
| Rate limiting           | Per-endpoint limits (20-1000 req/window)    |
| XSS prevention          | HTML sanitization on all user input         |
| CORS                    | Configurable allowed origins                |
| Security headers        | Helmet.js (CSP, HSTS, X-Frame-Options)     |
| SQL injection           | Parameterized queries via Knex.js           |
| Multi-tenant isolation  | All queries scoped by tenant_id             |

---

## Documentation

| Document                                      | Description                          |
|----------------------------------------------|--------------------------------------|
| [Architecture Guide](docs/ARCHITECTURE.md)   | System design, data flow, scaling    |
| [API Reference](docs/API_REFERENCE.md)       | Complete REST API documentation      |
| [Node Reference](docs/NODE_REFERENCE.md)     | All 46 nodes with properties         |
| [Deployment Guide](docs/DEPLOYMENT.md)       | Docker, Kubernetes, AWS deployment   |
| [Development Guide](docs/DEVELOPMENT.md)     | Contributing, creating nodes, testing|

---

## Tech Stack

| Layer          | Technology                                    |
|---------------|----------------------------------------------|
| Frontend      | Next.js 14, React 18, TypeScript             |
| UI Components | Radix UI, TailwindCSS                        |
| Visual Editor | ReactFlow                                    |
| State Mgmt    | Zustand                                      |
| Backend       | Express.js, TypeScript                       |
| Database      | PostgreSQL (Knex.js ORM)                     |
| Queue         | Redis + BullMQ                               |
| Real-time     | Socket.io                                    |
| Auth          | JWT, bcrypt                                  |
| Encryption    | AES-256-GCM                                  |
| Validation    | Zod                                          |
| Logging       | Pino                                         |

---

## License

See [LICENSE](LICENSE) for details.
