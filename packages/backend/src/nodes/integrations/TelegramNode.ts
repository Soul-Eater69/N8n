import { INodeHandler, INodeExecutionContext } from '../../engine/NodeRegistry';
import { INodeTypeDescription, INodeExecutionResult, INodeExecutionData } from '@flowforge/shared';

const description: INodeTypeDescription = {
  type: 'integration.telegram',
  displayName: 'Telegram',
  description: 'Send messages, photos, documents, and manage chats via the Telegram Bot API',
  icon: 'send',
  category: 'integration',
  version: 1,
  inputs: [{ name: 'main', type: 'main' }],
  outputs: [{ name: 'main', type: 'main' }],
  properties: [
    {
      name: 'operation',
      displayName: 'Operation',
      type: 'options',
      default: 'sendMessage',
      required: true,
      options: [
        { name: 'Send Message', value: 'sendMessage', description: 'Send a text message' },
        { name: 'Send Photo', value: 'sendPhoto', description: 'Send a photo by URL' },
        { name: 'Send Document', value: 'sendDocument', description: 'Send a document by URL' },
        { name: 'Edit Message', value: 'editMessage', description: 'Edit an existing text message' },
        { name: 'Delete Message', value: 'deleteMessage', description: 'Delete a message' },
        { name: 'Get Updates', value: 'getUpdates', description: 'Get incoming updates (messages)' },
        { name: 'Get Chat Info', value: 'getChatInfo', description: 'Get information about a chat' },
        { name: 'Send Poll', value: 'sendPoll', description: 'Send a poll to a chat' },
        { name: 'Pin Message', value: 'pinMessage', description: 'Pin a message in a chat' },
      ],
    },
    {
      name: 'chatId',
      displayName: 'Chat ID',
      type: 'string',
      default: '',
      description: 'The unique identifier for the target chat or username of the target channel',
      placeholder: '-1001234567890',
      displayOptions: {
        show: { operation: ['sendMessage', 'sendPhoto', 'sendDocument', 'editMessage', 'deleteMessage', 'getChatInfo', 'sendPoll', 'pinMessage'] },
      },
    },
    {
      name: 'text',
      displayName: 'Text',
      type: 'string',
      default: '',
      description: 'The message text to send',
      displayOptions: {
        show: { operation: ['sendMessage', 'editMessage'] },
      },
    },
    {
      name: 'parseMode',
      displayName: 'Parse Mode',
      type: 'options',
      default: 'HTML',
      description: 'How to parse the message text',
      options: [
        { name: 'HTML', value: 'HTML', description: 'HTML formatting' },
        { name: 'Markdown', value: 'Markdown', description: 'Legacy Markdown formatting' },
        { name: 'MarkdownV2', value: 'MarkdownV2', description: 'MarkdownV2 formatting' },
      ],
      displayOptions: {
        show: { operation: ['sendMessage', 'editMessage', 'sendPhoto', 'sendDocument'] },
      },
    },
    {
      name: 'photoUrl',
      displayName: 'Photo URL',
      type: 'string',
      default: '',
      description: 'URL of the photo to send',
      placeholder: 'https://example.com/photo.jpg',
      displayOptions: {
        show: { operation: ['sendPhoto'] },
      },
    },
    {
      name: 'documentUrl',
      displayName: 'Document URL',
      type: 'string',
      default: '',
      description: 'URL of the document to send',
      placeholder: 'https://example.com/document.pdf',
      displayOptions: {
        show: { operation: ['sendDocument'] },
      },
    },
    {
      name: 'messageId',
      displayName: 'Message ID',
      type: 'number',
      default: 0,
      description: 'The ID of the message to edit, delete, or pin',
      displayOptions: {
        show: { operation: ['editMessage', 'deleteMessage', 'pinMessage'] },
      },
    },
    {
      name: 'question',
      displayName: 'Question',
      type: 'string',
      default: '',
      description: 'Poll question',
      displayOptions: {
        show: { operation: ['sendPoll'] },
      },
    },
    {
      name: 'options',
      displayName: 'Poll Options (JSON)',
      type: 'json',
      default: '["Option 1", "Option 2"]',
      description: 'JSON array of poll answer options (2-10 strings)',
      displayOptions: {
        show: { operation: ['sendPoll'] },
      },
    },
    {
      name: 'disableNotification',
      displayName: 'Disable Notification',
      type: 'boolean',
      default: false,
      description: 'Send the message silently without notification sound',
    },
  ],
  credentials: [{ name: 'telegram', required: true }],
  color: '#0088CC',
};

async function callTelegramApi(
  method: string,
  botToken: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const url = `https://api.telegram.org/bot${botToken}/${method}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json() as Record<string, unknown>;

  if (!response.ok || !data.ok) {
    const errorDescription = data.description || response.statusText;
    const errorCode = data.error_code || response.status;
    throw new Error(`Telegram API error (${errorCode}): ${errorDescription}`);
  }

  return data;
}

export const TelegramNode: INodeHandler = {
  description,

  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    const params = ctx.parameters as Record<string, unknown>;
    const credentials = ctx.credentials as Record<string, Record<string, string>>;
    const botToken = credentials.telegram?.botToken;

    if (!botToken) {
      throw new Error('Telegram bot token is required. Please configure Telegram credentials.');
    }

    const operation = params.operation as string;
    const disableNotification = params.disableNotification as boolean || false;
    const results: INodeExecutionData[] = [];

    for (const item of ctx.inputData) {
      try {
        let responseData: Record<string, unknown>;

        switch (operation) {
          case 'sendMessage': {
            responseData = await callTelegramApi('sendMessage', botToken, {
              chat_id: params.chatId as string,
              text: params.text as string,
              parse_mode: params.parseMode as string || 'HTML',
              disable_notification: disableNotification,
            });
            break;
          }

          case 'sendPhoto': {
            const payload: Record<string, unknown> = {
              chat_id: params.chatId as string,
              photo: params.photoUrl as string,
              disable_notification: disableNotification,
            };
            if (params.text) {
              payload.caption = params.text as string;
              payload.parse_mode = params.parseMode as string || 'HTML';
            }
            responseData = await callTelegramApi('sendPhoto', botToken, payload);
            break;
          }

          case 'sendDocument': {
            const payload: Record<string, unknown> = {
              chat_id: params.chatId as string,
              document: params.documentUrl as string,
              disable_notification: disableNotification,
            };
            if (params.text) {
              payload.caption = params.text as string;
              payload.parse_mode = params.parseMode as string || 'HTML';
            }
            responseData = await callTelegramApi('sendDocument', botToken, payload);
            break;
          }

          case 'editMessage': {
            responseData = await callTelegramApi('editMessageText', botToken, {
              chat_id: params.chatId as string,
              message_id: params.messageId as number,
              text: params.text as string,
              parse_mode: params.parseMode as string || 'HTML',
            });
            break;
          }

          case 'deleteMessage': {
            responseData = await callTelegramApi('deleteMessage', botToken, {
              chat_id: params.chatId as string,
              message_id: params.messageId as number,
            });
            break;
          }

          case 'getUpdates': {
            responseData = await callTelegramApi('getUpdates', botToken, {
              limit: 100,
              timeout: 0,
            });
            break;
          }

          case 'getChatInfo': {
            responseData = await callTelegramApi('getChat', botToken, {
              chat_id: params.chatId as string,
            });
            break;
          }

          case 'sendPoll': {
            const pollOptions = params.options as string;
            const parsedOptions = typeof pollOptions === 'string' ? JSON.parse(pollOptions) : pollOptions;

            if (!Array.isArray(parsedOptions) || parsedOptions.length < 2 || parsedOptions.length > 10) {
              throw new Error('Poll requires between 2 and 10 options');
            }

            responseData = await callTelegramApi('sendPoll', botToken, {
              chat_id: params.chatId as string,
              question: params.question as string,
              options: parsedOptions,
              disable_notification: disableNotification,
            });
            break;
          }

          case 'pinMessage': {
            responseData = await callTelegramApi('pinChatMessage', botToken, {
              chat_id: params.chatId as string,
              message_id: params.messageId as number,
              disable_notification: disableNotification,
            });
            break;
          }

          default:
            throw new Error(`Unsupported Telegram operation: ${operation}`);
        }

        results.push({
          json: {
            success: true,
            operation,
            result: responseData.result,
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
