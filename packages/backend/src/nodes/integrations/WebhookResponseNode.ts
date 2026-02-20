import { INodeHandler, INodeExecutionContext } from '../../engine/NodeRegistry';
import { INodeTypeDescription, INodeExecutionResult, INodeExecutionData } from '@flowforge/shared';

const description: INodeTypeDescription = {
  type: 'integration.webhookResponse',
  displayName: 'Webhook Response',
  description: 'Send a custom HTTP response back to a webhook caller with status code, headers, and body',
  icon: 'arrow-left',
  category: 'integration',
  version: 1,
  inputs: [{ name: 'main', type: 'main' }],
  outputs: [{ name: 'main', type: 'main' }],
  properties: [
    {
      name: 'statusCode',
      displayName: 'Status Code',
      type: 'options',
      default: '200',
      required: true,
      options: [
        { name: '200 OK', value: '200' },
        { name: '201 Created', value: '201' },
        { name: '202 Accepted', value: '202' },
        { name: '204 No Content', value: '204' },
        { name: '301 Moved Permanently', value: '301' },
        { name: '302 Found', value: '302' },
        { name: '400 Bad Request', value: '400' },
        { name: '401 Unauthorized', value: '401' },
        { name: '403 Forbidden', value: '403' },
        { name: '404 Not Found', value: '404' },
        { name: '409 Conflict', value: '409' },
        { name: '422 Unprocessable Entity', value: '422' },
        { name: '429 Too Many Requests', value: '429' },
        { name: '500 Internal Server Error', value: '500' },
        { name: '502 Bad Gateway', value: '502' },
        { name: '503 Service Unavailable', value: '503' },
      ],
    },
    {
      name: 'contentType',
      displayName: 'Content Type',
      type: 'options',
      default: 'application/json',
      options: [
        { name: 'JSON', value: 'application/json' },
        { name: 'Plain Text', value: 'text/plain' },
        { name: 'HTML', value: 'text/html' },
        { name: 'XML', value: 'application/xml' },
        { name: 'CSV', value: 'text/csv' },
      ],
    },
    {
      name: 'responseBody',
      displayName: 'Response Body',
      type: 'json',
      default: '{}',
      description: 'The body to send in the response. For JSON content type, provide a JSON object. For text/html, provide a string.',
    },
    {
      name: 'responseHeaders',
      displayName: 'Custom Headers (JSON)',
      type: 'json',
      default: '{}',
      description: 'Additional headers to include in the response as a JSON object. Example: {"X-Custom-Header": "value"}',
    },
    {
      name: 'redirectUrl',
      displayName: 'Redirect URL',
      type: 'string',
      default: '',
      description: 'URL to redirect to (only used with 301/302 status codes)',
      displayOptions: { show: { statusCode: ['301', '302'] } },
    },
  ],
  color: '#00B894',
};

export const WebhookResponseNode: INodeHandler = {
  description,

  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    const statusCode = parseInt((ctx.parameters.statusCode as string) || '200', 10);
    const contentType = (ctx.parameters.contentType as string) || 'application/json';
    const redirectUrl = (ctx.parameters.redirectUrl as string) || '';

    let responseBody: unknown;
    const bodyRaw = ctx.parameters.responseBody;
    if (typeof bodyRaw === 'string') {
      try {
        responseBody = JSON.parse(bodyRaw);
      } catch {
        responseBody = bodyRaw;
      }
    } else {
      responseBody = bodyRaw;
    }

    let responseHeaders: Record<string, string> = {};
    const headersRaw = ctx.parameters.responseHeaders;
    if (typeof headersRaw === 'string' && headersRaw !== '{}') {
      try {
        responseHeaders = JSON.parse(headersRaw);
      } catch {
        // Ignore invalid header JSON
      }
    } else if (headersRaw && typeof headersRaw === 'object') {
      responseHeaders = headersRaw as Record<string, string>;
    }

    // Add content type header
    responseHeaders['Content-Type'] = contentType;

    // Handle redirects
    if ((statusCode === 301 || statusCode === 302) && redirectUrl) {
      responseHeaders['Location'] = redirectUrl;
    }

    // Build the webhook response metadata that the engine uses to send back the HTTP response
    const webhookResponse = {
      statusCode,
      headers: responseHeaders,
      body: responseBody,
    };

    const results: INodeExecutionData[] = ctx.inputData.map((item, index) => ({
      json: {
        ...item.json,
        webhookResponse,
      },
      pairedItem: { item: index },
    }));

    return {
      data: [results],
      metadata: { webhookResponse },
    };
  },
};
