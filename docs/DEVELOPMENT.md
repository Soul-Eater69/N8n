# FlowForge Development Guide

## Table of Contents

1. [Project Setup](#project-setup)
2. [Project Structure](#project-structure)
3. [Development Workflow](#development-workflow)
4. [Creating a New Node](#creating-a-new-node)
5. [Adding an API Endpoint](#adding-an-api-endpoint)
6. [Frontend Development](#frontend-development)
7. [Testing](#testing)
8. [Code Style](#code-style)
9. [Database Changes](#database-changes)

---

## Project Setup

### Prerequisites

- Node.js >= 20.0.0
- PostgreSQL 14+
- Redis 6+
- npm 9+

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd flowforge

# Install all dependencies (workspaces)
npm install

# Set up environment
cp packages/backend/.env.example packages/backend/.env
# Edit .env with your database/redis credentials

# Run database migrations
cd packages/backend && npm run migrate && cd ..

# Start development servers
npm run dev
```

### IDE Setup

**VS Code Extensions:**
- ESLint
- Prettier
- TypeScript Importer
- Tailwind CSS IntelliSense

**Recommended settings (.vscode/settings.json):**
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-prettier",
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

---

## Project Structure

```
flowforge/
├── packages/
│   ├── backend/          # Express.js API + Worker
│   ├── frontend/         # Next.js application
│   └── shared/           # Shared TypeScript types
├── docs/                 # Documentation
├── package.json          # Root workspace configuration
└── tsconfig.json         # Root TypeScript configuration
```

### Backend Structure

```
packages/backend/src/
├── config/               # App configuration, DB, Redis
├── database/migrations/  # Knex.js migration files
├── engine/               # Workflow execution engine
│   ├── WorkflowEngine.ts       # Core execution orchestrator
│   ├── NodeRegistry.ts          # Node type registry (singleton)
│   ├── ExpressionEvaluator.ts   # {{ expression }} resolver
│   ├── SubWorkflowEngine.ts     # Nested workflow support
│   └── ErrorWorkflowRunner.ts   # Error workflow handler
├── middleware/            # Express middleware
├── nodes/                # Node implementations (46 nodes)
│   ├── triggers/         # 3 trigger nodes
│   ├── logic/            # 5 logic nodes
│   ├── actions/          # 2 action nodes
│   ├── transform/        # 4 transform nodes
│   ├── utility/          # 6 utility nodes
│   ├── ai/               # 8 AI nodes
│   ├── integrations/     # 18 integration nodes
│   └── register.ts       # Central registration
├── routes/               # Express route handlers
├── services/             # Business logic layer
├── utils/                # Shared utilities
├── index.ts              # App entry point
└── worker.ts             # BullMQ worker entry point
```

### Frontend Structure

```
packages/frontend/src/
├── app/                  # Next.js App Router
│   ├── layout.tsx        # Root layout
│   ├── page.tsx          # Landing page
│   ├── login/            # Authentication
│   └── dashboard/        # Authenticated pages
│       ├── page.tsx              # Dashboard overview
│       ├── workflows/            # Workflow management
│       │   ├── page.tsx          # Workflow list
│       │   ├── [id]/page.tsx     # Workflow editor
│       │   └── new/page.tsx      # New workflow
│       ├── executions/page.tsx   # Execution history
│       ├── credentials/page.tsx  # Credential management
│       ├── team/page.tsx         # Team management
│       ├── audit/page.tsx        # Audit logs
│       └── settings/page.tsx     # Organization settings
├── components/
│   ├── editor/           # Workflow editor components
│   │   ├── WorkflowCanvas.tsx   # ReactFlow canvas
│   │   ├── WorkflowNode.tsx     # Node visual component
│   │   ├── NodePalette.tsx      # Node search/add panel
│   │   └── NodeConfigPanel.tsx  # Node configuration
│   └── layout/
│       └── Sidebar.tsx          # Navigation sidebar
└── lib/
    ├── api.ts            # API client
    ├── store.ts          # Zustand state stores
    ├── socket.ts         # Socket.io client
    └── utils.ts          # Utility functions
```

---

## Development Workflow

### Starting Development

```bash
# Start all services concurrently
npm run dev

# Or start individually:
npm run dev --workspace=packages/backend    # Backend on :3000
npm run dev --workspace=packages/frontend   # Frontend on :3001
```

### Building for Production

```bash
# Build all packages
npm run build

# Build individually
npm run build --workspace=packages/shared
npm run build --workspace=packages/backend
npm run build --workspace=packages/frontend
```

### Running Tests

```bash
# All tests
npm test

# Backend tests
npm test --workspace=packages/backend

# Watch mode
npm run test:watch --workspace=packages/backend
```

---

## Creating a New Node

This is the most common development task. Follow these steps to create a new node.

### Step 1: Create the Node File

Create a new file in the appropriate category directory:

```
packages/backend/src/nodes/<category>/<NodeName>Node.ts
```

### Step 2: Implement the Node

```typescript
import { INodeHandler, INodeExecutionContext } from '../../engine/NodeRegistry';
import { INodeTypeDescription, INodeExecutionResult, INodeExecutionData } from '@flowforge/shared';

// 1. Define the node description (metadata + UI configuration)
const description: INodeTypeDescription = {
  type: 'category.nodeName',          // Unique identifier
  displayName: 'My Node',             // Display name in UI
  description: 'What this node does', // Tooltip description
  icon: 'icon-name',                  // Lucide icon name
  category: 'integration',            // triggers, logic, actions, transform, utility, ai, integration
  version: 1,
  inputs: [{ name: 'main', type: 'main' }],   // Input connections
  outputs: [{ name: 'main', type: 'main' }],   // Output connections
  properties: [
    {
      name: 'operation',
      displayName: 'Operation',
      type: 'options',
      default: 'doSomething',
      required: true,
      options: [
        { name: 'Do Something', value: 'doSomething', description: 'Description' },
      ],
    },
    {
      name: 'inputField',
      displayName: 'Input Field',
      type: 'string',
      default: '',
      description: 'Description of this field',
      displayOptions: {
        show: { operation: ['doSomething'] },  // Conditional visibility
      },
    },
  ],
  credentials: [{ name: 'myService', required: true }],  // Required credentials
  color: '#HexColor',
};

// 2. Export the node handler
export const MyNodeNode: INodeHandler = {
  description,

  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    // Get credentials
    const credentials = ctx.credentials.myService as Record<string, string> | undefined;
    if (!credentials?.apiKey) {
      throw new Error('Credentials not configured');
    }

    const operation = (ctx.parameters.operation as string) || 'doSomething';
    const results: INodeExecutionData[] = [];

    // Process each input item
    for (const item of ctx.inputData) {
      try {
        // Your node logic here
        const result = { /* ... */ };

        results.push({
          json: { success: true, operation, ...result },
          pairedItem: { item: results.length },
        });
      } catch (error: any) {
        results.push({
          json: { success: false, operation, error: error.message },
          pairedItem: { item: results.length },
        });
      }
    }

    return { data: [results] };
  },
};
```

### Step 3: Register the Node

Edit `packages/backend/src/nodes/register.ts`:

```typescript
// Add import
import { MyNodeNode } from './<category>/MyNodeNode';

// Add registration inside registerAllNodes()
registry.register(MyNodeNode);
```

### Step 4: Test the Node

The node is immediately available in the API and frontend after restart.

### Property Types

| Type       | Description                          | Example Default |
|-----------|--------------------------------------|----------------|
| `string`  | Text input                           | `""`           |
| `number`  | Numeric input                        | `0`            |
| `boolean` | Toggle switch                        | `false`        |
| `options` | Dropdown select (requires `options`) | `"value"`      |
| `json`    | JSON editor                          | `"{}"`         |
| `collection` | Group of properties               | `{}`           |
| `expression` | Expression-enabled field          | `""`           |

### Display Options

Control when properties are visible:

```typescript
displayOptions: {
  show: {
    operation: ['value1', 'value2'],  // Show when operation is value1 or value2
  },
  hide: {
    mode: ['advanced'],  // Hide when mode is 'advanced'
  },
}
```

---

## Adding an API Endpoint

### Step 1: Add Route Handler

Create or edit a route file in `packages/backend/src/routes/`:

```typescript
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { z } from 'zod';

const router = Router();

const mySchema = z.object({
  name: z.string().min(1).max(255),
  value: z.number().optional(),
});

router.get('/', authenticate, async (req, res, next) => {
  try {
    const service = new MyService();
    const data = await service.list(req.user.tenantId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticate, validate(mySchema), async (req, res, next) => {
  try {
    const service = new MyService();
    const data = await service.create(req.body, req.user.tenantId);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export default router;
```

### Step 2: Register the Route

In `packages/backend/src/index.ts`:

```typescript
import myRoutes from './routes/my.routes';
app.use('/api/v1/my-resource', myRoutes);
```

---

## Frontend Development

### Adding a New Page

Create a new file under `packages/frontend/src/app/dashboard/`:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store';
import { apiClient } from '@/lib/api';

export default function MyPage() {
  const { user } = useAuthStore();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const response = await apiClient.get('/my-resource');
      setData(response.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">My Page</h1>
      {/* Your component content */}
    </div>
  );
}
```

### Adding a Sidebar Link

Edit `packages/frontend/src/components/layout/Sidebar.tsx` and add to the menu items array:

```typescript
{ icon: MyIcon, label: 'My Page', href: '/dashboard/my-page' },
```

### State Management

Use Zustand stores in `packages/frontend/src/lib/store.ts`:

```typescript
interface MyStore {
  items: Item[];
  setItems: (items: Item[]) => void;
}

export const useMyStore = create<MyStore>((set) => ({
  items: [],
  setItems: (items) => set({ items }),
}));
```

---

## Testing

### Backend Unit Tests

```typescript
// packages/backend/src/__tests__/myService.test.ts
import { MyService } from '../services/my.service';

describe('MyService', () => {
  const service = new MyService();

  it('should create an item', async () => {
    const result = await service.create({ name: 'Test' }, 'tenant-id');
    expect(result).toBeDefined();
    expect(result.name).toBe('Test');
  });
});
```

### Node Unit Tests

```typescript
// packages/backend/src/__tests__/nodes/myNode.test.ts
import { MyNodeNode } from '../../nodes/category/MyNodeNode';

describe('MyNode', () => {
  it('should have correct description', () => {
    expect(MyNodeNode.description.type).toBe('category.myNode');
  });

  it('should execute correctly', async () => {
    const result = await MyNodeNode.execute({
      node: { id: 'test-node', type: 'category.myNode' },
      inputData: [{ json: { key: 'value' } }],
      parameters: { operation: 'doSomething' },
      credentials: { myService: { apiKey: 'test-key' } },
      context: {
        executionId: 'exec-1',
        workflowId: 'wf-1',
        tenantId: 'tenant-1',
        mode: 'manual',
      },
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0][0].json.success).toBe(true);
  });
});
```

---

## Code Style

### TypeScript

- Use explicit types, avoid `any` where possible
- Use `interface` for object shapes, `type` for unions/intersections
- Use `enum` sparingly, prefer string literal unions
- Export named exports, not default exports

### Naming Conventions

| Entity          | Convention      | Example                    |
|----------------|----------------|----------------------------|
| Files          | PascalCase      | `WorkflowEngine.ts`       |
| Classes        | PascalCase      | `class WorkflowEngine`    |
| Interfaces     | I prefix        | `interface IWorkflow`      |
| Functions      | camelCase       | `function getById()`      |
| Constants      | UPPER_SNAKE     | `const MAX_DEPTH = 5`     |
| Node types     | dot notation    | `'integration.slack'`     |

---

## Database Changes

### Creating a Migration

```bash
cd packages/backend
npx knex migrate:make my_migration_name
```

### Migration Template

```typescript
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('my_table', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('name').notNullable();
    table.jsonb('data').defaultTo('{}');
    table.timestamps(true, true);

    table.index('tenant_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('my_table');
}
```

### Running Migrations

```bash
npm run migrate              # Run pending migrations
npm run migrate:rollback     # Rollback last batch
npm run migrate:status       # Check migration status
```
