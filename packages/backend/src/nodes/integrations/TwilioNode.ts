import { INodeHandler, INodeExecutionContext } from '../../engine/NodeRegistry';
import { INodeTypeDescription, INodeExecutionResult, INodeExecutionData } from '@flowforge/shared';

const description: INodeTypeDescription = {
  type: 'integration.twilio',
  displayName: 'Twilio',
  description: 'Send SMS, WhatsApp messages, and make calls using Twilio',
  icon: 'phone',
  category: 'integration',
  version: 1,
  inputs: [{ name: 'main', type: 'main' }],
  outputs: [{ name: 'main', type: 'main' }],
  properties: [
    {
      name: 'operation',
      displayName: 'Operation',
      type: 'options',
      default: 'sendSMS',
      required: true,
      options: [
        { name: 'Send SMS', value: 'sendSMS', description: 'Send an SMS message' },
        { name: 'Send WhatsApp', value: 'sendWhatsApp', description: 'Send a WhatsApp message' },
        { name: 'Make Call', value: 'makeCall', description: 'Initiate a phone call' },
        { name: 'Get Call', value: 'getCall', description: 'Get details of a specific call' },
        { name: 'List Messages', value: 'listMessages', description: 'List messages sent or received' },
      ],
    },
    {
      name: 'to',
      displayName: 'To',
      type: 'string',
      default: '',
      required: true,
      description: 'The destination phone number (E.164 format, e.g. +15551234567)',
      placeholder: '+15551234567',
      displayOptions: {
        show: { operation: ['sendSMS', 'sendWhatsApp', 'makeCall'] },
      },
    },
    {
      name: 'from',
      displayName: 'From',
      type: 'string',
      default: '',
      required: true,
      description: 'The sender phone number (must be a Twilio number)',
      placeholder: '+15559876543',
      displayOptions: {
        show: { operation: ['sendSMS', 'sendWhatsApp', 'makeCall'] },
      },
    },
    {
      name: 'body',
      displayName: 'Body',
      type: 'string',
      default: '',
      description: 'The message body text',
      displayOptions: {
        show: { operation: ['sendSMS', 'sendWhatsApp'] },
      },
    },
    {
      name: 'twiml',
      displayName: 'TwiML',
      type: 'string',
      default: '',
      description: 'TwiML instructions for the call (e.g. <Response><Say>Hello</Say></Response>)',
      displayOptions: {
        show: { operation: ['makeCall'] },
      },
    },
    {
      name: 'statusCallback',
      displayName: 'Status Callback URL',
      type: 'string',
      default: '',
      description: 'URL for status callback notifications',
      displayOptions: {
        show: { operation: ['sendSMS', 'sendWhatsApp', 'makeCall'] },
      },
    },
    {
      name: 'mediaUrl',
      displayName: 'Media URL',
      type: 'string',
      default: '',
      description: 'URL of media to include with the message (MMS/WhatsApp)',
      displayOptions: {
        show: { operation: ['sendSMS', 'sendWhatsApp'] },
      },
    },
    {
      name: 'callSid',
      displayName: 'Call SID',
      type: 'string',
      default: '',
      description: 'The SID of the call to retrieve',
      displayOptions: {
        show: { operation: ['getCall'] },
      },
    },
  ],
  credentials: [{ name: 'twilio', required: true }],
  color: '#F22F46',
};

async function callTwilioApi(
  method: string,
  endpoint: string,
  accountSid: string,
  authToken: string,
  body?: Record<string, string>,
): Promise<Record<string, unknown>> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/${endpoint}`;
  const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Basic ${authHeader}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  };

  if (body && (method === 'POST' || method === 'PUT')) {
    const formBody = Object.entries(body)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
    options.body = formBody;
  }

  const response = await fetch(url, options);
  const data = await response.json() as Record<string, unknown>;

  if (!response.ok) {
    const message = (data.message as string) || `Twilio API error: ${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  return data;
}

export const TwilioNode: INodeHandler = {
  description,

  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    const params = ctx.parameters as Record<string, string>;
    const credentials = ctx.credentials as Record<string, Record<string, string>>;
    const twilioCreds = credentials.twilio;

    if (!twilioCreds?.accountSid || !twilioCreds?.authToken) {
      throw new Error('Twilio accountSid and authToken are required. Please configure Twilio credentials.');
    }

    const { accountSid, authToken } = twilioCreds;
    const operation = params.operation;
    const results: INodeExecutionData[] = [];

    for (const item of ctx.inputData) {
      try {
        let responseData: Record<string, unknown>;

        switch (operation) {
          case 'sendSMS': {
            const body: Record<string, string> = {
              To: params.to,
              From: params.from,
              Body: params.body,
            };
            if (params.statusCallback) {
              body.StatusCallback = params.statusCallback;
            }
            if (params.mediaUrl) {
              body.MediaUrl = params.mediaUrl;
            }

            if (!body.To) throw new Error('To phone number is required');
            if (!body.From) throw new Error('From phone number is required');
            if (!body.Body) throw new Error('Message body is required');

            responseData = await callTwilioApi('POST', 'Messages.json', accountSid, authToken, body);
            break;
          }

          case 'sendWhatsApp': {
            const to = params.to.startsWith('whatsapp:') ? params.to : `whatsapp:${params.to}`;
            const from = params.from.startsWith('whatsapp:') ? params.from : `whatsapp:${params.from}`;

            const body: Record<string, string> = {
              To: to,
              From: from,
              Body: params.body,
            };
            if (params.statusCallback) {
              body.StatusCallback = params.statusCallback;
            }
            if (params.mediaUrl) {
              body.MediaUrl = params.mediaUrl;
            }

            if (!params.to) throw new Error('To phone number is required');
            if (!params.from) throw new Error('From phone number is required');
            if (!params.body) throw new Error('Message body is required');

            responseData = await callTwilioApi('POST', 'Messages.json', accountSid, authToken, body);
            break;
          }

          case 'makeCall': {
            const body: Record<string, string> = {
              To: params.to,
              From: params.from,
            };

            if (!body.To) throw new Error('To phone number is required');
            if (!body.From) throw new Error('From phone number is required');

            if (params.twiml) {
              body.Twiml = params.twiml;
            } else {
              throw new Error('TwiML instructions are required for making a call');
            }

            if (params.statusCallback) {
              body.StatusCallback = params.statusCallback;
            }

            responseData = await callTwilioApi('POST', 'Calls.json', accountSid, authToken, body);
            break;
          }

          case 'getCall': {
            const callSid = params.callSid;
            if (!callSid) throw new Error('Call SID is required');

            responseData = await callTwilioApi('GET', `Calls/${callSid}.json`, accountSid, authToken);
            break;
          }

          case 'listMessages': {
            responseData = await callTwilioApi('GET', 'Messages.json', accountSid, authToken);
            break;
          }

          default:
            throw new Error(`Unsupported Twilio operation: ${operation}`);
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
