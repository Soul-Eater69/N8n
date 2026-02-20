import { INodeHandler, INodeExecutionContext } from '../../engine/NodeRegistry';
import { INodeTypeDescription, INodeExecutionResult, INodeExecutionData } from '@flowforge/shared';

const description: INodeTypeDescription = {
  type: 'integration.postgres',
  displayName: 'PostgreSQL',
  description: 'Execute queries and manage data in PostgreSQL databases',
  icon: 'database',
  category: 'integration',
  version: 1,
  inputs: [{ name: 'main', type: 'main' }],
  outputs: [{ name: 'main', type: 'main' }],
  properties: [
    {
      name: 'operation',
      displayName: 'Operation',
      type: 'options',
      default: 'executeQuery',
      required: true,
      options: [
        { name: 'Execute Query', value: 'executeQuery', description: 'Execute a raw SQL query' },
        { name: 'Insert', value: 'insert', description: 'Insert rows into a table' },
        { name: 'Update', value: 'update', description: 'Update rows in a table' },
        { name: 'Delete', value: 'delete', description: 'Delete rows from a table' },
        { name: 'Select', value: 'select', description: 'Select rows from a table' },
      ],
    },
    {
      name: 'query',
      displayName: 'Query',
      type: 'string',
      default: '',
      description: 'The raw SQL query to execute',
      displayOptions: {
        show: { operation: ['executeQuery'] },
      },
    },
    {
      name: 'table',
      displayName: 'Table',
      type: 'string',
      default: '',
      required: true,
      description: 'The table to operate on',
      displayOptions: {
        show: { operation: ['insert', 'update', 'delete', 'select'] },
      },
    },
    {
      name: 'columns',
      displayName: 'Columns',
      type: 'json',
      default: '[]',
      description: 'Columns to select (JSON array of strings). Leave empty for all columns.',
      displayOptions: {
        show: { operation: ['select'] },
      },
    },
    {
      name: 'values',
      displayName: 'Values',
      type: 'json',
      default: '{}',
      description: 'Key-value pairs for insert or update (JSON object)',
      displayOptions: {
        show: { operation: ['insert', 'update'] },
      },
    },
    {
      name: 'where',
      displayName: 'Where Conditions',
      type: 'json',
      default: '{}',
      description: 'WHERE conditions as key-value pairs (JSON object)',
      displayOptions: {
        show: { operation: ['select', 'update', 'delete'] },
      },
    },
    {
      name: 'orderBy',
      displayName: 'Order By',
      type: 'string',
      default: '',
      description: 'Column to order by (e.g. "created_at DESC")',
      displayOptions: {
        show: { operation: ['select'] },
      },
    },
    {
      name: 'limit',
      displayName: 'Limit',
      type: 'number',
      default: 100,
      description: 'Maximum number of rows to return',
      displayOptions: {
        show: { operation: ['select'] },
      },
    },
    {
      name: 'offset',
      displayName: 'Offset',
      type: 'number',
      default: 0,
      description: 'Number of rows to skip',
      displayOptions: {
        show: { operation: ['select'] },
      },
    },
  ],
  credentials: [{ name: 'postgres', required: true }],
  color: '#336791',
};

function parseJsonParam(value: unknown, fallback: unknown): unknown {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
}

interface WhereResult {
  clause: string;
  params: unknown[];
  startIndex: number;
}

function buildWhereClause(where: Record<string, unknown>, startIndex: number = 1): WhereResult {
  const entries = Object.entries(where);
  if (entries.length === 0) {
    return { clause: '', params: [], startIndex };
  }
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = startIndex;
  for (const [key, value] of entries) {
    if (value === null) {
      conditions.push(`"${key}" IS NULL`);
    } else {
      conditions.push(`"${key}" = $${idx}`);
      params.push(value);
      idx++;
    }
  }
  return {
    clause: ` WHERE ${conditions.join(' AND ')}`,
    params,
    startIndex: idx,
  };
}

export const PostgresNode: INodeHandler = {
  description,

  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    const params = ctx.parameters as Record<string, unknown>;
    const credentials = ctx.credentials as Record<string, Record<string, unknown>>;
    const pgCreds = credentials.postgres;

    if (!pgCreds) {
      throw new Error('PostgreSQL credentials are required. Please configure postgres credentials.');
    }

    const { Client } = await import('pg');

    const client = new Client({
      host: pgCreds.host as string,
      port: Number(pgCreds.port) || 5432,
      database: pgCreds.database as string,
      user: pgCreds.user as string,
      password: pgCreds.password as string,
      ssl: pgCreds.ssl ? { rejectUnauthorized: false } : undefined,
    });

    try {
      await client.connect();

      const operation = params.operation as string;
      const results: INodeExecutionData[] = [];

      for (const item of ctx.inputData) {
        try {
          let queryText: string;
          let queryParams: unknown[] = [];

          switch (operation) {
            case 'executeQuery': {
              queryText = params.query as string;
              if (!queryText) {
                throw new Error('Query is required for executeQuery operation');
              }
              break;
            }

            case 'select': {
              const table = params.table as string;
              if (!table) throw new Error('Table name is required');

              const columns = parseJsonParam(params.columns, []) as string[];
              const where = parseJsonParam(params.where, {}) as Record<string, unknown>;
              const orderBy = params.orderBy as string;
              const limit = Number(params.limit) || 100;
              const offset = Number(params.offset) || 0;

              const columnList = columns.length > 0
                ? columns.map(c => `"${c}"`).join(', ')
                : '*';

              queryText = `SELECT ${columnList} FROM "${table}"`;

              const whereResult = buildWhereClause(where);
              queryText += whereResult.clause;
              queryParams = whereResult.params;

              if (orderBy) {
                queryText += ` ORDER BY ${orderBy}`;
              }

              queryText += ` LIMIT $${queryParams.length + 1}`;
              queryParams.push(limit);

              queryText += ` OFFSET $${queryParams.length + 1}`;
              queryParams.push(offset);
              break;
            }

            case 'insert': {
              const table = params.table as string;
              if (!table) throw new Error('Table name is required');

              const values = parseJsonParam(params.values, {}) as Record<string, unknown>;
              const entries = Object.entries(values);
              if (entries.length === 0) {
                throw new Error('Values are required for insert operation');
              }

              const cols = entries.map(([key]) => `"${key}"`).join(', ');
              const placeholders = entries.map((_, i) => `$${i + 1}`).join(', ');
              queryParams = entries.map(([, val]) => val);

              queryText = `INSERT INTO "${table}" (${cols}) VALUES (${placeholders}) RETURNING *`;
              break;
            }

            case 'update': {
              const table = params.table as string;
              if (!table) throw new Error('Table name is required');

              const values = parseJsonParam(params.values, {}) as Record<string, unknown>;
              const where = parseJsonParam(params.where, {}) as Record<string, unknown>;
              const entries = Object.entries(values);
              if (entries.length === 0) {
                throw new Error('Values are required for update operation');
              }

              let paramIdx = 1;
              const setClauses = entries.map(([key, _]) => {
                return `"${key}" = $${paramIdx++}`;
              });
              queryParams = entries.map(([, val]) => val);

              queryText = `UPDATE "${table}" SET ${setClauses.join(', ')}`;

              const whereResult = buildWhereClause(where, paramIdx);
              queryText += whereResult.clause;
              queryParams.push(...whereResult.params);

              queryText += ' RETURNING *';
              break;
            }

            case 'delete': {
              const table = params.table as string;
              if (!table) throw new Error('Table name is required');

              const where = parseJsonParam(params.where, {}) as Record<string, unknown>;

              queryText = `DELETE FROM "${table}"`;

              const whereResult = buildWhereClause(where);
              queryText += whereResult.clause;
              queryParams = whereResult.params;

              queryText += ' RETURNING *';
              break;
            }

            default:
              throw new Error(`Unsupported PostgreSQL operation: ${operation}`);
          }

          const result = await client.query(queryText, queryParams);

          if (Array.isArray(result.rows) && result.rows.length > 0) {
            for (const row of result.rows) {
              results.push({
                json: {
                  success: true,
                  operation,
                  ...row,
                },
                pairedItem: { item: results.length },
              });
            }
          } else {
            results.push({
              json: {
                success: true,
                operation,
                rowCount: result.rowCount,
                rows: result.rows || [],
                command: result.command,
              },
              pairedItem: { item: results.length },
            });
          }
        } catch (error: any) {
          results.push({
            json: {
              success: false,
              operation,
              error: error.message,
            },
            pairedItem: { item: results.length },
          });
        }
      }

      return { data: [results] };
    } finally {
      await client.end().catch(() => {});
    }
  },
};
