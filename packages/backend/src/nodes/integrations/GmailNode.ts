import { INodeHandler, INodeExecutionContext } from '../../engine/NodeRegistry';
import { INodeTypeDescription, INodeExecutionResult, INodeExecutionData } from '@flowforge/shared';

const description: INodeTypeDescription = {
  type: 'integration.gmail',
  displayName: 'Gmail',
  description: 'Send emails, read messages, and manage labels via the Gmail API',
  icon: 'mail',
  category: 'integration',
  version: 1,
  inputs: [{ name: 'main', type: 'main' }],
  outputs: [{ name: 'main', type: 'main' }],
  properties: [
    {
      name: 'operation',
      displayName: 'Operation',
      type: 'options',
      default: 'sendEmail',
      required: true,
      options: [
        { name: 'Send Email', value: 'sendEmail', description: 'Send a new email' },
        { name: 'List Messages', value: 'listMessages', description: 'List messages in the mailbox' },
        { name: 'Get Message', value: 'getMessage', description: 'Get a specific message by ID' },
        { name: 'Search Messages', value: 'searchMessages', description: 'Search messages using a query' },
        { name: 'Create Draft', value: 'createDraft', description: 'Create a draft email' },
        { name: 'Add Label', value: 'addLabel', description: 'Add a label to a message' },
        { name: 'Remove Label', value: 'removeLabel', description: 'Remove a label from a message' },
      ],
    },
    {
      name: 'to',
      displayName: 'To',
      type: 'string',
      default: '',
      description: 'Recipient email address',
      placeholder: 'recipient@example.com',
      displayOptions: {
        show: { operation: ['sendEmail', 'createDraft'] },
      },
    },
    {
      name: 'cc',
      displayName: 'CC',
      type: 'string',
      default: '',
      description: 'CC email addresses (comma-separated)',
      displayOptions: {
        show: { operation: ['sendEmail', 'createDraft'] },
      },
    },
    {
      name: 'bcc',
      displayName: 'BCC',
      type: 'string',
      default: '',
      description: 'BCC email addresses (comma-separated)',
      displayOptions: {
        show: { operation: ['sendEmail', 'createDraft'] },
      },
    },
    {
      name: 'subject',
      displayName: 'Subject',
      type: 'string',
      default: '',
      description: 'Email subject line',
      displayOptions: {
        show: { operation: ['sendEmail', 'createDraft'] },
      },
    },
    {
      name: 'body',
      displayName: 'Body (Plain Text)',
      type: 'string',
      default: '',
      description: 'Plain text email body',
      displayOptions: {
        show: { operation: ['sendEmail', 'createDraft'] },
      },
    },
    {
      name: 'htmlBody',
      displayName: 'Body (HTML)',
      type: 'string',
      default: '',
      description: 'HTML email body (overrides plain text body if provided)',
      displayOptions: {
        show: { operation: ['sendEmail', 'createDraft'] },
      },
    },
    {
      name: 'query',
      displayName: 'Query',
      type: 'string',
      default: '',
      description: 'Gmail search query (e.g. "from:user@example.com is:unread")',
      placeholder: 'is:unread',
      displayOptions: {
        show: { operation: ['searchMessages', 'listMessages'] },
      },
    },
    {
      name: 'messageId',
      displayName: 'Message ID',
      type: 'string',
      default: '',
      description: 'The ID of the message',
      displayOptions: {
        show: { operation: ['getMessage', 'addLabel', 'removeLabel'] },
      },
    },
    {
      name: 'labelId',
      displayName: 'Label ID',
      type: 'string',
      default: '',
      description: 'The label ID to add or remove',
      placeholder: 'INBOX',
      displayOptions: {
        show: { operation: ['addLabel', 'removeLabel'] },
      },
    },
    {
      name: 'maxResults',
      displayName: 'Max Results',
      type: 'number',
      default: 10,
      description: 'Maximum number of messages to return',
      displayOptions: {
        show: { operation: ['listMessages', 'searchMessages'] },
      },
    },
  ],
  credentials: [{ name: 'gmail', required: true }],
  color: '#EA4335',
};

function base64urlEncode(str: string): string {
  const base64 = Buffer.from(str, 'utf-8').toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function buildRfc2822Message(params: Record<string, string>): string {
  const lines: string[] = [];
  lines.push(`To: ${params.to}`);
  if (params.cc) {
    lines.push(`Cc: ${params.cc}`);
  }
  if (params.bcc) {
    lines.push(`Bcc: ${params.bcc}`);
  }
  lines.push(`Subject: ${params.subject}`);

  if (params.htmlBody) {
    const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    lines.push('MIME-Version: 1.0');
    lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    lines.push('');
    lines.push(`--${boundary}`);
    lines.push('Content-Type: text/plain; charset="UTF-8"');
    lines.push('');
    lines.push(params.body || '');
    lines.push(`--${boundary}`);
    lines.push('Content-Type: text/html; charset="UTF-8"');
    lines.push('');
    lines.push(params.htmlBody);
    lines.push(`--${boundary}--`);
  } else {
    lines.push('MIME-Version: 1.0');
    lines.push('Content-Type: text/plain; charset="UTF-8"');
    lines.push('');
    lines.push(params.body || '');
  }

  return lines.join('\r\n');
}

async function callGmailApi(
  endpoint: string,
  accessToken: string,
  method: string = 'GET',
  body?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const url = endpoint.startsWith('https://')
    ? endpoint
    : `https://gmail.googleapis.com/gmail/v1/users/me${endpoint}`;

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
  };

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);

  if (response.status === 204) {
    return { success: true, statusCode: 204 };
  }

  const data = await response.json() as Record<string, unknown>;

  if (!response.ok) {
    const errorData = data.error as Record<string, unknown> | undefined;
    const errorMessage = errorData?.message || response.statusText;
    throw new Error(`Gmail API error (${response.status}): ${errorMessage}`);
  }

  return data;
}

export const GmailNode: INodeHandler = {
  description,

  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    const params = ctx.parameters as Record<string, string>;
    const credentials = ctx.credentials as Record<string, Record<string, string>>;
    const accessToken = credentials.gmail?.accessToken;

    if (!accessToken) {
      throw new Error('Gmail OAuth2 access token is required. Please configure Gmail credentials.');
    }

    const operation = params.operation;
    const results: INodeExecutionData[] = [];

    for (const item of ctx.inputData) {
      try {
        let responseData: Record<string, unknown>;

        switch (operation) {
          case 'sendEmail': {
            const rawMessage = buildRfc2822Message(params);
            const encodedMessage = base64urlEncode(rawMessage);
            responseData = await callGmailApi('/messages/send', accessToken, 'POST', {
              raw: encodedMessage,
            });
            break;
          }

          case 'listMessages': {
            const maxResults = parseInt(params.maxResults, 10) || 10;
            let endpoint = `/messages?maxResults=${maxResults}`;
            if (params.query) {
              endpoint += `&q=${encodeURIComponent(params.query)}`;
            }
            const listData = await callGmailApi(endpoint, accessToken);
            const messages = (listData.messages as Array<Record<string, string>>) || [];

            const fullMessages: Record<string, unknown>[] = [];
            for (const msg of messages) {
              const fullMessage = await callGmailApi(`/messages/${msg.id}?format=full`, accessToken);
              fullMessages.push(fullMessage);
            }

            responseData = {
              messages: fullMessages,
              resultSizeEstimate: listData.resultSizeEstimate,
              nextPageToken: listData.nextPageToken,
            };
            break;
          }

          case 'getMessage': {
            responseData = await callGmailApi(`/messages/${params.messageId}?format=full`, accessToken);
            break;
          }

          case 'searchMessages': {
            const maxResults = parseInt(params.maxResults, 10) || 10;
            const query = params.query;
            if (!query) {
              throw new Error('Search query is required for searchMessages operation');
            }
            const searchData = await callGmailApi(
              `/messages?maxResults=${maxResults}&q=${encodeURIComponent(query)}`,
              accessToken,
            );
            const searchMessages = (searchData.messages as Array<Record<string, string>>) || [];

            const fullSearchMessages: Record<string, unknown>[] = [];
            for (const msg of searchMessages) {
              const fullMessage = await callGmailApi(`/messages/${msg.id}?format=full`, accessToken);
              fullSearchMessages.push(fullMessage);
            }

            responseData = {
              messages: fullSearchMessages,
              resultSizeEstimate: searchData.resultSizeEstimate,
              nextPageToken: searchData.nextPageToken,
            };
            break;
          }

          case 'createDraft': {
            const rawMessage = buildRfc2822Message(params);
            const encodedMessage = base64urlEncode(rawMessage);
            responseData = await callGmailApi('/drafts', accessToken, 'POST', {
              message: {
                raw: encodedMessage,
              },
            });
            break;
          }

          case 'addLabel': {
            responseData = await callGmailApi(`/messages/${params.messageId}/modify`, accessToken, 'POST', {
              addLabelIds: [params.labelId],
            });
            break;
          }

          case 'removeLabel': {
            responseData = await callGmailApi(`/messages/${params.messageId}/modify`, accessToken, 'POST', {
              removeLabelIds: [params.labelId],
            });
            break;
          }

          default:
            throw new Error(`Unsupported Gmail operation: ${operation}`);
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
