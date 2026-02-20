# FlowForge API Reference

## Base URL

```
http://localhost:3000/api/v1
```

## Authentication

All API requests (except auth endpoints) require a Bearer token:

```
Authorization: Bearer <access_token>
```

### Response Format

All responses follow a standard structure:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

Error responses:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Workflow not found",
    "details": {}
  }
}
```

---

## Auth Endpoints

### POST /api/v1/auth/register

Create a new tenant and owner account.

**Request Body:**
```json
{
  "email": "admin@company.com",
  "password": "securePassword123",
  "name": "John Doe",
  "organizationName": "Acme Corp",
  "tenantSlug": "acme-corp"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "admin@company.com",
      "name": "John Doe",
      "role": "owner"
    },
    "tenant": {
      "id": "uuid",
      "name": "Acme Corp",
      "slug": "acme-corp",
      "plan": "free"
    },
    "tokens": {
      "accessToken": "eyJ...",
      "refreshToken": "eyJ..."
    }
  }
}
```

### POST /api/v1/auth/login

Authenticate and receive tokens.

**Request Body:**
```json
{
  "email": "admin@company.com",
  "password": "securePassword123",
  "tenantSlug": "acme-corp"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "email": "...", "name": "...", "role": "owner" },
    "tokens": {
      "accessToken": "eyJ...",
      "refreshToken": "eyJ..."
    }
  }
}
```

### POST /api/v1/auth/refresh

Refresh an expired access token.

**Request Body:**
```json
{
  "refreshToken": "eyJ..."
}
```

### GET /api/v1/auth/me

Get the current authenticated user.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "admin@company.com",
    "name": "John Doe",
    "role": "owner",
    "tenantId": "uuid",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

### GET /api/v1/auth/users

List all users in the tenant (admin/owner only).

### POST /api/v1/auth/users/invite

Invite a new user to the tenant.

**Request Body:**
```json
{
  "email": "member@company.com",
  "name": "Jane Smith",
  "role": "member",
  "password": "initialPassword"
}
```

---

## Workflow Endpoints

### GET /api/v1/workflows

List all workflows with pagination and search.

**Query Parameters:**
| Parameter | Type   | Default | Description                    |
|-----------|--------|---------|--------------------------------|
| page      | number | 1       | Page number                    |
| limit     | number | 20      | Items per page                 |
| search    | string |         | Search by name or description  |
| status    | string |         | Filter by status               |
| sortBy    | string | updatedAt | Sort field                   |
| sortOrder | string | desc    | asc or desc                    |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Customer Onboarding",
      "description": "Automates new customer setup",
      "status": "active",
      "tags": ["sales", "automation"],
      "nodes": [...],
      "connections": [...],
      "settings": {...},
      "createdBy": "uuid",
      "updatedBy": "uuid",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-15T12:00:00Z",
      "version": 3
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 }
}
```

### POST /api/v1/workflows

Create a new workflow.

**Request Body:**
```json
{
  "name": "My Workflow",
  "description": "Description of what this workflow does",
  "nodes": [
    {
      "id": "node-1",
      "type": "trigger.manual",
      "name": "Start",
      "position": { "x": 100, "y": 200 },
      "parameters": {}
    },
    {
      "id": "node-2",
      "type": "integration.slack",
      "name": "Notify Slack",
      "position": { "x": 400, "y": 200 },
      "parameters": {
        "operation": "sendMessage",
        "channel": "C01234567",
        "text": "Workflow executed!"
      },
      "credentials": {
        "slack": "credential-id"
      }
    }
  ],
  "connections": [
    {
      "id": "conn-1",
      "sourceNodeId": "node-1",
      "sourceOutput": "main",
      "targetNodeId": "node-2",
      "targetInput": "main"
    }
  ],
  "settings": {
    "executionTimeout": 300000,
    "saveExecutionData": true,
    "timezone": "America/New_York"
  },
  "tags": ["notifications"]
}
```

### GET /api/v1/workflows/:id

Get a single workflow by ID.

### PUT /api/v1/workflows/:id

Update a workflow.

### DELETE /api/v1/workflows/:id

Delete a workflow and all associated data.

### POST /api/v1/workflows/:id/activate

Activate a workflow (enable triggers).

### POST /api/v1/workflows/:id/deactivate

Deactivate a workflow (disable triggers).

### POST /api/v1/workflows/:id/execute

Manually trigger a workflow execution.

**Request Body (optional):**
```json
{
  "triggerData": {
    "key": "value"
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "executionId": "uuid",
    "status": "pending"
  }
}
```

### GET /api/v1/workflows/:id/versions

Get version history for a workflow.

---

## Execution Endpoints

### GET /api/v1/executions

List executions with filtering.

**Query Parameters:**
| Parameter     | Type   | Description                           |
|--------------|--------|---------------------------------------|
| workflowId   | string | Filter by workflow                    |
| status       | string | pending, running, success, error, cancelled |
| mode         | string | manual, trigger, webhook, retry, sub_workflow |
| startedAfter | string | ISO date filter                       |
| startedBefore| string | ISO date filter                       |
| limit        | number | Results per page                      |
| offset       | number | Pagination offset                     |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "workflowId": "uuid",
      "status": "success",
      "mode": "manual",
      "startedAt": "2024-01-15T12:00:00Z",
      "finishedAt": "2024-01-15T12:00:05Z",
      "data": {
        "nodeExecutionOrder": ["node-1", "node-2"],
        "nodeResults": {
          "node-1": {
            "nodeId": "node-1",
            "nodeType": "trigger.manual",
            "startTime": 1705320000000,
            "endTime": 1705320001000,
            "status": "success",
            "data": [[{ "json": {} }]]
          }
        }
      }
    }
  ]
}
```

### GET /api/v1/executions/:id

Get detailed execution data including all node results.

### POST /api/v1/executions/:id/cancel

Cancel a running execution.

### GET /api/v1/executions/stats

Get execution statistics.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "byStatus": {
      "success": 1250,
      "error": 42,
      "running": 3,
      "cancelled": 15
    },
    "daily": [
      { "date": "2024-01-15", "count": 87, "errors": 2 },
      { "date": "2024-01-14", "count": 92, "errors": 5 }
    ]
  }
}
```

---

## Credential Endpoints

### GET /api/v1/credentials

List all credentials (data is excluded by default).

**Query Parameters:**
| Parameter   | Type    | Description                        |
|------------|---------|-------------------------------------|
| type       | string  | Filter by credential type           |
| includeData| boolean | Include decrypted credential data   |

### POST /api/v1/credentials

Create a new credential.

**Request Body:**
```json
{
  "name": "My Slack Bot",
  "type": "slack",
  "data": {
    "botToken": "xoxb-your-bot-token"
  }
}
```

### GET /api/v1/credentials/:id

Get a single credential.

### PUT /api/v1/credentials/:id

Update a credential.

### DELETE /api/v1/credentials/:id

Delete a credential.

---

## Webhook Endpoints

### ALL /api/v1/webhooks/:path

Trigger a webhook-based workflow. Supports GET, POST, PUT, PATCH, DELETE.

**The webhook path is configured in the WebhookTrigger node.**

**Response:** Depends on the workflow's WebhookResponse node configuration. Default:

```json
{
  "success": true,
  "executionId": "uuid"
}
```

---

## Node Endpoints

### GET /api/v1/nodes

List all available node types.

**Query Parameters:**
| Parameter | Type   | Description             |
|-----------|--------|------------------------|
| category  | string | Filter by category      |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "type": "integration.slack",
      "displayName": "Slack",
      "description": "Send messages and manage channels",
      "icon": "message-circle",
      "category": "integration",
      "version": 1,
      "inputs": [{ "name": "main", "type": "main" }],
      "outputs": [{ "name": "main", "type": "main" }],
      "properties": [...],
      "credentials": [{ "name": "slack", "required": true }],
      "color": "#4A154B"
    }
  ]
}
```

### GET /api/v1/nodes/:type

Get details for a specific node type.

---

## Audit Endpoints

### GET /api/v1/audit

List audit logs (admin/owner only).

**Query Parameters:**
| Parameter  | Type   | Description             |
|-----------|--------|-------------------------|
| action    | string | Filter by action type    |
| userId    | string | Filter by user           |
| resource  | string | Filter by resource type  |
| limit     | number | Results per page         |
| offset    | number | Pagination offset        |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "action": "workflow.created",
      "resource": "workflow",
      "resourceId": "uuid",
      "details": { "name": "My Workflow" },
      "ipAddress": "192.168.1.1",
      "timestamp": "2024-01-15T12:00:00Z"
    }
  ]
}
```

---

## WebSocket Events

Connect to the WebSocket server at the backend URL:

```javascript
const socket = io('http://localhost:3000', {
  auth: { token: 'your-jwt-token' }
});
```

### Events Emitted by Server

| Event                 | Payload                                          |
|----------------------|--------------------------------------------------|
| `execution:started`  | `{ executionId, workflowId }`                    |
| `execution:progress` | `{ executionId, progress, currentNode }`         |
| `execution:completed`| `{ executionId, status, duration }`              |
| `execution:error`    | `{ executionId, error: { message, nodeId } }`    |
| `node:executing`     | `{ executionId, nodeId, nodeType }`              |
| `node:completed`     | `{ executionId, nodeId, status }`                |
| `node:error`         | `{ executionId, nodeId, error }`                 |
| `workflow:updated`   | `{ workflowId, updatedBy }`                      |

### Room Subscriptions

```javascript
// Subscribe to a specific execution
socket.emit('join:execution', { executionId: 'uuid' });

// Subscribe to all workflow updates
socket.emit('join:workflow', { workflowId: 'uuid' });

// Subscribe to tenant-wide events
socket.emit('join:tenant', { tenantId: 'uuid' });
```

---

## Error Codes

| Code                | HTTP Status | Description                      |
|---------------------|-------------|----------------------------------|
| `UNAUTHORIZED`      | 401         | Invalid or missing auth token    |
| `FORBIDDEN`         | 403         | Insufficient permissions         |
| `NOT_FOUND`         | 404         | Resource not found               |
| `VALIDATION_ERROR`  | 400         | Invalid request body/params      |
| `CONFLICT`          | 409         | Resource already exists          |
| `RATE_LIMIT`        | 429         | Too many requests                |
| `EXECUTION_ERROR`   | 500         | Workflow execution failed        |
| `INTERNAL_ERROR`    | 500         | Unexpected server error          |

---

## Rate Limits

| Endpoint Group  | Limit           | Window    | Header                    |
|----------------|-----------------|-----------|---------------------------|
| API (general)  | 1,000 requests  | 15 min    | `X-RateLimit-Limit`       |
| Authentication | 20 requests     | 15 min    | `X-RateLimit-Remaining`   |
| Webhooks       | 500 requests    | 1 min     | `X-RateLimit-Reset`       |
| Executions     | 100 requests    | 1 min     | `Retry-After`             |
