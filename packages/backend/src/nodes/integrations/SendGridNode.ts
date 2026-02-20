import { INodeHandler, INodeExecutionContext } from '../../engine/NodeRegistry';
import { INodeTypeDescription, INodeExecutionResult, INodeExecutionData } from '@flowforge/shared';

const description: INodeTypeDescription = {
  type: 'integration.sendgrid',
  displayName: 'SendGrid',
  description: 'Send emails and manage contacts using the SendGrid API',
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
        { name: 'Send Email', value: 'sendEmail', description: 'Send an email' },
        { name: 'Send Template Email', value: 'sendTemplateEmail', description: 'Send an email using a template' },
        { name: 'Add Contact', value: 'addContact', description: 'Add or update a contact' },
        { name: 'List Contacts', value: 'listContacts', description: 'List all contacts' },
        { name: 'Create List', value: 'createList', description: 'Create a contact list' },
      ],
    },
    {
      name: 'to',
      displayName: 'To',
      type: 'string',
      default: '',
      required: true,
      description: 'Recipient email address',
      placeholder: 'recipient@example.com',
      displayOptions: {
        show: { operation: ['sendEmail', 'sendTemplateEmail'] },
      },
    },
    {
      name: 'from',
      displayName: 'From',
      type: 'string',
      default: '',
      required: true,
      description: 'Sender email address (must be verified in SendGrid)',
      placeholder: 'sender@example.com',
      displayOptions: {
        show: { operation: ['sendEmail', 'sendTemplateEmail'] },
      },
    },
    {
      name: 'subject',
      displayName: 'Subject',
      type: 'string',
      default: '',
      description: 'Email subject line',
      displayOptions: {
        show: { operation: ['sendEmail'] },
      },
    },
    {
      name: 'textContent',
      displayName: 'Text Content',
      type: 'string',
      default: '',
      description: 'Plain text email body',
      displayOptions: {
        show: { operation: ['sendEmail'] },
      },
    },
    {
      name: 'htmlContent',
      displayName: 'HTML Content',
      type: 'string',
      default: '',
      description: 'HTML email body',
      displayOptions: {
        show: { operation: ['sendEmail'] },
      },
    },
    {
      name: 'templateId',
      displayName: 'Template ID',
      type: 'string',
      default: '',
      required: true,
      description: 'The SendGrid dynamic template ID',
      displayOptions: {
        show: { operation: ['sendTemplateEmail'] },
      },
    },
    {
      name: 'dynamicData',
      displayName: 'Dynamic Template Data',
      type: 'json',
      default: '{}',
      description: 'Dynamic data to populate the template (JSON object)',
      displayOptions: {
        show: { operation: ['sendTemplateEmail'] },
      },
    },
    {
      name: 'email',
      displayName: 'Email',
      type: 'string',
      default: '',
      required: true,
      description: 'Contact email address',
      displayOptions: {
        show: { operation: ['addContact'] },
      },
    },
    {
      name: 'firstName',
      displayName: 'First Name',
      type: 'string',
      default: '',
      description: 'Contact first name',
      displayOptions: {
        show: { operation: ['addContact'] },
      },
    },
    {
      name: 'lastName',
      displayName: 'Last Name',
      type: 'string',
      default: '',
      description: 'Contact last name',
      displayOptions: {
        show: { operation: ['addContact'] },
      },
    },
    {
      name: 'listId',
      displayName: 'List ID',
      type: 'string',
      default: '',
      description: 'The list ID to add the contact to',
      displayOptions: {
        show: { operation: ['addContact'] },
      },
    },
    {
      name: 'listName',
      displayName: 'List Name',
      type: 'string',
      default: '',
      required: true,
      description: 'Name for the new contact list',
      displayOptions: {
        show: { operation: ['createList'] },
      },
    },
  ],
  credentials: [{ name: 'sendgrid', required: true }],
  color: '#1A82E2',
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

async function callSendGridApi(
  method: string,
  endpoint: string,
  apiKey: string,
  body?: unknown,
): Promise<{ status: number; data: unknown }> {
  const url = `https://api.sendgrid.com/v3/${endpoint}`;

  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  };

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  let data: unknown;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    const text = await response.text();
    data = text || null;
  }

  if (!response.ok) {
    const errorData = data as Record<string, unknown> | null;
    const errors = errorData?.errors as Array<Record<string, unknown>> | undefined;
    const message = errors?.[0]?.message
      || (errorData?.message as string)
      || `SendGrid API error: ${response.status} ${response.statusText}`;
    throw new Error(String(message));
  }

  return { status: response.status, data };
}

export const SendGridNode: INodeHandler = {
  description,

  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    const params = ctx.parameters as Record<string, string>;
    const credentials = ctx.credentials as Record<string, Record<string, string>>;
    const sgCreds = credentials.sendgrid;

    if (!sgCreds?.apiKey) {
      throw new Error('SendGrid API key is required. Please configure SendGrid credentials.');
    }

    const apiKey = sgCreds.apiKey;
    const operation = params.operation;
    const results: INodeExecutionData[] = [];

    for (const item of ctx.inputData) {
      try {
        let responseData: unknown;

        switch (operation) {
          case 'sendEmail': {
            if (!params.to) throw new Error('Recipient email (To) is required');
            if (!params.from) throw new Error('Sender email (From) is required');

            const content: Array<Record<string, string>> = [];
            if (params.textContent) {
              content.push({ type: 'text/plain', value: params.textContent });
            }
            if (params.htmlContent) {
              content.push({ type: 'text/html', value: params.htmlContent });
            }
            if (content.length === 0) {
              throw new Error('Either text content or HTML content is required');
            }

            const emailPayload = {
              personalizations: [
                {
                  to: [{ email: params.to }],
                },
              ],
              from: { email: params.from },
              subject: params.subject || '(no subject)',
              content,
            };

            const result = await callSendGridApi('POST', 'mail/send', apiKey, emailPayload);
            responseData = {
              statusCode: result.status,
              message: 'Email sent successfully',
            };
            break;
          }

          case 'sendTemplateEmail': {
            if (!params.to) throw new Error('Recipient email (To) is required');
            if (!params.from) throw new Error('Sender email (From) is required');
            if (!params.templateId) throw new Error('Template ID is required');

            const dynamicData = parseJsonParam(params.dynamicData, {}) as Record<string, unknown>;

            const emailPayload = {
              personalizations: [
                {
                  to: [{ email: params.to }],
                  dynamic_template_data: dynamicData,
                },
              ],
              from: { email: params.from },
              template_id: params.templateId,
            };

            const result = await callSendGridApi('POST', 'mail/send', apiKey, emailPayload);
            responseData = {
              statusCode: result.status,
              message: 'Template email sent successfully',
            };
            break;
          }

          case 'addContact': {
            if (!params.email) throw new Error('Contact email is required');

            const contact: Record<string, string> = {
              email: params.email,
            };
            if (params.firstName) contact.first_name = params.firstName;
            if (params.lastName) contact.last_name = params.lastName;

            const payload: Record<string, unknown> = {
              contacts: [contact],
            };

            if (params.listId) {
              payload.list_ids = [params.listId];
            }

            const result = await callSendGridApi('PUT', 'marketing/contacts', apiKey, payload);
            responseData = result.data;
            break;
          }

          case 'listContacts': {
            const result = await callSendGridApi('GET', 'marketing/contacts', apiKey);
            responseData = result.data;
            break;
          }

          case 'createList': {
            if (!params.listName) throw new Error('List name is required');

            const result = await callSendGridApi('POST', 'marketing/lists', apiKey, {
              name: params.listName,
            });
            responseData = result.data;
            break;
          }

          default:
            throw new Error(`Unsupported SendGrid operation: ${operation}`);
        }

        results.push({
          json: {
            success: true,
            operation,
            ...(typeof responseData === 'object' && responseData !== null
              ? (responseData as Record<string, unknown>)
              : { data: responseData }),
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
