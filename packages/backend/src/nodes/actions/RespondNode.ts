import { INodeHandler, INodeExecutionContext } from '../../engine/NodeRegistry';
import { INodeTypeDescription, INodeExecutionResult } from '@flowforge/shared';

const description: INodeTypeDescription = {
  type: 'action.respond',
  displayName: 'Respond to Webhook',
  description: 'Sends a response back to the webhook caller',
  icon: 'send',
  category: 'actions',
  version: 1,
  inputs: [{ name: 'main', type: 'main' }],
  outputs: [{ name: 'main', type: 'main' }],
  properties: [
    {
      name: 'statusCode',
      displayName: 'Status Code',
      type: 'number',
      default: 200,
    },
    {
      name: 'responseBody',
      displayName: 'Response Body',
      type: 'json',
      default: '{}',
    },
    {
      name: 'responseHeaders',
      displayName: 'Response Headers',
      type: 'json',
      default: '{}',
    },
  ],
  color: '#55EFC4',
};

export const RespondNode: INodeHandler = {
  description,
  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    const { statusCode, responseBody, responseHeaders } = ctx.parameters;

    return {
      data: [ctx.inputData],
      metadata: {
        webhookResponse: {
          statusCode: statusCode || 200,
          body: typeof responseBody === 'string' ? JSON.parse(responseBody as string) : responseBody,
          headers: typeof responseHeaders === 'string' ? JSON.parse(responseHeaders as string) : responseHeaders,
        },
      },
    };
  },
};
