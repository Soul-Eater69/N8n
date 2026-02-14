import { INodeHandler, INodeExecutionContext } from '../../engine/NodeRegistry';
import { INodeTypeDescription, INodeExecutionResult } from '@flowforge/shared';

const description: INodeTypeDescription = {
  type: 'trigger.webhook',
  displayName: 'Webhook Trigger',
  description: 'Starts the workflow when a webhook is received',
  icon: 'webhook',
  category: 'triggers',
  version: 1,
  inputs: [],
  outputs: [{ name: 'main', type: 'main' }],
  properties: [
    {
      name: 'httpMethod',
      displayName: 'HTTP Method',
      type: 'options',
      default: 'POST',
      options: [
        { name: 'GET', value: 'GET' },
        { name: 'POST', value: 'POST' },
        { name: 'PUT', value: 'PUT' },
        { name: 'PATCH', value: 'PATCH' },
        { name: 'DELETE', value: 'DELETE' },
      ],
    },
    {
      name: 'path',
      displayName: 'Webhook Path',
      type: 'string',
      default: '',
      required: true,
      placeholder: '/my-webhook',
      description: 'The path for the webhook URL',
    },
    {
      name: 'responseMode',
      displayName: 'Response Mode',
      type: 'options',
      default: 'onReceived',
      options: [
        { name: 'When Received', value: 'onReceived' },
        { name: 'When Last Node Finishes', value: 'lastNode' },
      ],
    },
    {
      name: 'responseCode',
      displayName: 'Response Code',
      type: 'number',
      default: 200,
    },
  ],
  triggerType: 'webhook',
  color: '#6C5CE7',
};

export const WebhookTriggerNode: INodeHandler = {
  description,
  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    // Webhook data comes from the trigger context
    const webhookData = ctx.inputData[0]?.json || {};

    return {
      data: [[{
        json: {
          headers: webhookData.headers || {},
          query: webhookData.query || {},
          body: webhookData.body || {},
          method: webhookData.method || 'POST',
          path: webhookData.path || '',
        },
      }]],
    };
  },
};
