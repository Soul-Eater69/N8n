import { INodeHandler, INodeExecutionContext } from '../../engine/NodeRegistry';
import { INodeTypeDescription, INodeExecutionResult, INodeExecutionData } from '@flowforge/shared';

const description: INodeTypeDescription = {
  type: 'integration.notion',
  displayName: 'Notion',
  description: 'Create pages, query databases, and manage content in Notion',
  icon: 'book-open',
  category: 'integration',
  version: 1,
  inputs: [{ name: 'main', type: 'main' }],
  outputs: [{ name: 'main', type: 'main' }],
  properties: [
    {
      name: 'operation',
      displayName: 'Operation',
      type: 'options',
      default: 'createPage',
      required: true,
      options: [
        { name: 'Create Page', value: 'createPage', description: 'Create a new page in a database or as a child of another page' },
        { name: 'Get Page', value: 'getPage', description: 'Retrieve a page by ID' },
        { name: 'Update Page', value: 'updatePage', description: 'Update page properties' },
        { name: 'Query Database', value: 'queryDatabase', description: 'Query a database with optional filters and sorts' },
        { name: 'Create Database', value: 'createDatabase', description: 'Create a new database as a child of a page' },
        { name: 'Append Block', value: 'appendBlock', description: 'Append child blocks to a page or block' },
        { name: 'Get Block', value: 'getBlock', description: 'Retrieve a block by ID' },
        { name: 'Search Pages', value: 'searchPages', description: 'Search for pages by title' },
      ],
    },
    {
      name: 'databaseId',
      displayName: 'Database ID',
      type: 'string',
      default: '',
      description: 'The Notion database ID',
      placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      displayOptions: {
        show: { operation: ['createPage', 'queryDatabase'] },
      },
    },
    {
      name: 'pageId',
      displayName: 'Page ID',
      type: 'string',
      default: '',
      description: 'The Notion page ID',
      placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      displayOptions: {
        show: { operation: ['getPage', 'updatePage', 'createDatabase', 'appendBlock'] },
      },
    },
    {
      name: 'blockId',
      displayName: 'Block ID',
      type: 'string',
      default: '',
      description: 'The Notion block ID',
      displayOptions: {
        show: { operation: ['getBlock', 'appendBlock'] },
      },
    },
    {
      name: 'title',
      displayName: 'Title',
      type: 'string',
      default: '',
      description: 'Title for the page or database',
      displayOptions: {
        show: { operation: ['createPage', 'createDatabase'] },
      },
    },
    {
      name: 'properties',
      displayName: 'Properties (JSON)',
      type: 'json',
      default: '{}',
      description: 'Page or database properties as a JSON object. For pages: {"Name": {"title": [{"text": {"content": "My Page"}}]}}',
      displayOptions: {
        show: { operation: ['createPage', 'updatePage', 'createDatabase'] },
      },
    },
    {
      name: 'filter',
      displayName: 'Filter (JSON)',
      type: 'json',
      default: '{}',
      description: 'Database query filter as a JSON object',
      displayOptions: {
        show: { operation: ['queryDatabase'] },
      },
    },
    {
      name: 'sorts',
      displayName: 'Sorts (JSON)',
      type: 'json',
      default: '[]',
      description: 'Database query sort rules as a JSON array',
      displayOptions: {
        show: { operation: ['queryDatabase'] },
      },
    },
    {
      name: 'content',
      displayName: 'Content',
      type: 'string',
      default: '',
      description: 'Text content for a block (creates a paragraph block)',
      displayOptions: {
        show: { operation: ['appendBlock'] },
      },
    },
    {
      name: 'query',
      displayName: 'Search Query',
      type: 'string',
      default: '',
      description: 'Text to search for in page titles',
      displayOptions: {
        show: { operation: ['searchPages'] },
      },
    },
  ],
  credentials: [{ name: 'notion', required: true }],
  color: '#000000',
};

async function callNotionApi(
  endpoint: string,
  apiKey: string,
  method: string = 'GET',
  body?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const url = `https://api.notion.com/v1${endpoint}`;

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey}`,
    'Notion-Version': '2022-06-28',
  };

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  if (body && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);

  const data = await response.json() as Record<string, unknown>;

  if (!response.ok) {
    const errorMessage = data.message || response.statusText;
    const errorCode = data.code || response.status;
    throw new Error(`Notion API error (${errorCode}): ${errorMessage}`);
  }

  return data;
}

function parseJsonParam(value: unknown, defaultValue: unknown): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed === '{}' || trimmed === '[]') {
      return defaultValue;
    }
    return JSON.parse(trimmed);
  }
  return value || defaultValue;
}

export const NotionNode: INodeHandler = {
  description,

  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    const params = ctx.parameters as Record<string, unknown>;
    const credentials = ctx.credentials as Record<string, Record<string, string>>;
    const apiKey = credentials.notion?.apiKey;

    if (!apiKey) {
      throw new Error('Notion integration token is required. Please configure Notion credentials.');
    }

    const operation = params.operation as string;
    const results: INodeExecutionData[] = [];

    for (const item of ctx.inputData) {
      try {
        let responseData: Record<string, unknown>;

        switch (operation) {
          case 'createPage': {
            const propertiesRaw = parseJsonParam(params.properties, {}) as Record<string, unknown>;
            const title = params.title as string;

            const pagePayload: Record<string, unknown> = {};

            if (params.databaseId) {
              pagePayload.parent = { database_id: params.databaseId as string };
            } else if (params.pageId) {
              pagePayload.parent = { page_id: params.pageId as string };
            } else {
              throw new Error('Either databaseId or pageId is required as a parent for creating a page');
            }

            if (title && Object.keys(propertiesRaw).length === 0) {
              pagePayload.properties = {
                Name: {
                  title: [
                    {
                      text: {
                        content: title,
                      },
                    },
                  ],
                },
              };
            } else {
              pagePayload.properties = propertiesRaw;
              if (title && !propertiesRaw.Name && !propertiesRaw.title) {
                (pagePayload.properties as Record<string, unknown>).Name = {
                  title: [
                    {
                      text: {
                        content: title,
                      },
                    },
                  ],
                };
              }
            }

            responseData = await callNotionApi('/pages', apiKey, 'POST', pagePayload);
            break;
          }

          case 'getPage': {
            const pageId = params.pageId as string;
            if (!pageId) {
              throw new Error('Page ID is required for getPage operation');
            }
            responseData = await callNotionApi(`/pages/${pageId}`, apiKey);
            break;
          }

          case 'updatePage': {
            const pageId = params.pageId as string;
            if (!pageId) {
              throw new Error('Page ID is required for updatePage operation');
            }
            const properties = parseJsonParam(params.properties, {}) as Record<string, unknown>;
            responseData = await callNotionApi(`/pages/${pageId}`, apiKey, 'PATCH', {
              properties,
            });
            break;
          }

          case 'queryDatabase': {
            const databaseId = params.databaseId as string;
            if (!databaseId) {
              throw new Error('Database ID is required for queryDatabase operation');
            }

            const payload: Record<string, unknown> = {};

            const filter = parseJsonParam(params.filter, null);
            if (filter && Object.keys(filter as Record<string, unknown>).length > 0) {
              payload.filter = filter;
            }

            const sorts = parseJsonParam(params.sorts, null);
            if (sorts && Array.isArray(sorts) && sorts.length > 0) {
              payload.sorts = sorts;
            }

            responseData = await callNotionApi(`/databases/${databaseId}/query`, apiKey, 'POST', payload);
            break;
          }

          case 'createDatabase': {
            const pageId = params.pageId as string;
            if (!pageId) {
              throw new Error('Parent page ID is required for createDatabase operation');
            }

            const title = params.title as string;
            const properties = parseJsonParam(params.properties, {
              Name: { title: {} },
            }) as Record<string, unknown>;

            responseData = await callNotionApi('/databases', apiKey, 'POST', {
              parent: { page_id: pageId },
              title: [
                {
                  type: 'text',
                  text: {
                    content: title || 'Untitled Database',
                  },
                },
              ],
              properties,
            });
            break;
          }

          case 'appendBlock': {
            const parentId = (params.blockId as string) || (params.pageId as string);
            if (!parentId) {
              throw new Error('Block ID or Page ID is required for appendBlock operation');
            }

            const content = params.content as string;
            let children: Record<string, unknown>[];

            if (content) {
              children = [
                {
                  object: 'block',
                  type: 'paragraph',
                  paragraph: {
                    rich_text: [
                      {
                        type: 'text',
                        text: {
                          content,
                        },
                      },
                    ],
                  },
                },
              ];
            } else {
              const propertiesRaw = parseJsonParam(params.properties, []) as unknown;
              children = Array.isArray(propertiesRaw)
                ? propertiesRaw as Record<string, unknown>[]
                : [propertiesRaw as Record<string, unknown>];
            }

            responseData = await callNotionApi(`/blocks/${parentId}/children`, apiKey, 'PATCH', {
              children,
            });
            break;
          }

          case 'getBlock': {
            const blockId = params.blockId as string;
            if (!blockId) {
              throw new Error('Block ID is required for getBlock operation');
            }
            responseData = await callNotionApi(`/blocks/${blockId}`, apiKey);
            break;
          }

          case 'searchPages': {
            const query = params.query as string;
            const payload: Record<string, unknown> = {
              filter: {
                value: 'page',
                property: 'object',
              },
            };
            if (query) {
              payload.query = query;
            }
            responseData = await callNotionApi('/search', apiKey, 'POST', payload);
            break;
          }

          default:
            throw new Error(`Unsupported Notion operation: ${operation}`);
        }

        results.push({
          json: {
            success: true,
            operation,
            ...responseData,
          },
          pairedItem: { item: results.length },
        });
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
  },
};
