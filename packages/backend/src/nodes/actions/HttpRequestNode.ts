import { INodeHandler, INodeExecutionContext } from '../../engine/NodeRegistry';
import { INodeTypeDescription, INodeExecutionResult } from '@flowforge/shared';

const description: INodeTypeDescription = {
  type: 'action.httpRequest',
  displayName: 'HTTP Request',
  description: 'Makes an HTTP request to any URL',
  icon: 'globe',
  category: 'actions',
  version: 1,
  inputs: [{ name: 'main', type: 'main' }],
  outputs: [{ name: 'main', type: 'main' }],
  properties: [
    {
      name: 'method',
      displayName: 'Method',
      type: 'options',
      default: 'GET',
      options: [
        { name: 'GET', value: 'GET' },
        { name: 'POST', value: 'POST' },
        { name: 'PUT', value: 'PUT' },
        { name: 'PATCH', value: 'PATCH' },
        { name: 'DELETE', value: 'DELETE' },
        { name: 'HEAD', value: 'HEAD' },
      ],
    },
    {
      name: 'url',
      displayName: 'URL',
      type: 'string',
      default: '',
      required: true,
      placeholder: 'https://api.example.com/endpoint',
    },
    {
      name: 'headers',
      displayName: 'Headers',
      type: 'json',
      default: '{}',
    },
    {
      name: 'queryParameters',
      displayName: 'Query Parameters',
      type: 'json',
      default: '{}',
    },
    {
      name: 'body',
      displayName: 'Body',
      type: 'json',
      default: '{}',
      displayOptions: {
        show: { method: ['POST', 'PUT', 'PATCH'] },
      },
    },
    {
      name: 'timeout',
      displayName: 'Timeout (ms)',
      type: 'number',
      default: 30000,
    },
    {
      name: 'followRedirects',
      displayName: 'Follow Redirects',
      type: 'boolean',
      default: true,
    },
  ],
  color: '#74B9FF',
};

export const HttpRequestNode: INodeHandler = {
  description,
  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    const { method, url, headers: headersStr, queryParameters: queryStr, body: bodyStr, timeout } = ctx.parameters as Record<string, string>;

    const headers = typeof headersStr === 'string' ? JSON.parse(headersStr || '{}') : headersStr || {};
    const queryParameters = typeof queryStr === 'string' ? JSON.parse(queryStr || '{}') : queryStr || {};
    const body = typeof bodyStr === 'string' ? JSON.parse(bodyStr || '{}') : bodyStr || {};

    const results = [];

    for (const item of ctx.inputData) {
      try {
        // Build URL with query params
        const urlObj = new URL(url);
        for (const [key, value] of Object.entries(queryParameters)) {
          urlObj.searchParams.append(key, String(value));
        }

        const fetchOptions: RequestInit = {
          method: method || 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          signal: AbortSignal.timeout(parseInt(timeout as string, 10) || 30000),
        };

        if (['POST', 'PUT', 'PATCH'].includes(method) && body) {
          fetchOptions.body = JSON.stringify(body);
        }

        const response = await fetch(urlObj.toString(), fetchOptions);
        const contentType = response.headers.get('content-type') || '';

        let responseData: unknown;
        if (contentType.includes('application/json')) {
          responseData = await response.json();
        } else {
          responseData = await response.text();
        }

        results.push({
          json: {
            statusCode: response.status,
            statusMessage: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            data: responseData,
          },
        });
      } catch (error: any) {
        results.push({
          json: {
            error: true,
            message: error.message,
            code: error.code,
          },
        });
      }
    }

    return { data: [results] };
  },
};
