import { INodeHandler, INodeExecutionContext } from '../../engine/NodeRegistry';
import { INodeTypeDescription, INodeExecutionResult, INodeExecutionData } from '@flowforge/shared';

const description: INodeTypeDescription = {
  type: 'integration.discord',
  displayName: 'Discord',
  description: 'Send messages, manage channels, and interact with the Discord API',
  icon: 'hash',
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
        { name: 'Send Message', value: 'sendMessage', description: 'Send a message to a channel' },
        { name: 'Edit Message', value: 'editMessage', description: 'Edit an existing message' },
        { name: 'Delete Message', value: 'deleteMessage', description: 'Delete a message' },
        { name: 'Get Guild Info', value: 'getGuildInfo', description: 'Get information about a guild (server)' },
        { name: 'List Channels', value: 'listChannels', description: 'List channels in a guild' },
        { name: 'Add Reaction', value: 'addReaction', description: 'Add a reaction to a message' },
        { name: 'Create Thread', value: 'createThread', description: 'Create a new thread from a message' },
        { name: 'Send Embed', value: 'sendEmbed', description: 'Send a rich embed message' },
      ],
    },
    {
      name: 'channelId',
      displayName: 'Channel ID',
      type: 'string',
      default: '',
      description: 'The Discord channel ID',
      placeholder: '123456789012345678',
      displayOptions: {
        show: { operation: ['sendMessage', 'editMessage', 'deleteMessage', 'addReaction', 'createThread', 'sendEmbed'] },
      },
    },
    {
      name: 'content',
      displayName: 'Content',
      type: 'string',
      default: '',
      description: 'The message content to send',
      displayOptions: {
        show: { operation: ['sendMessage', 'editMessage'] },
      },
    },
    {
      name: 'messageId',
      displayName: 'Message ID',
      type: 'string',
      default: '',
      description: 'The ID of the message to interact with',
      displayOptions: {
        show: { operation: ['editMessage', 'deleteMessage', 'addReaction', 'createThread'] },
      },
    },
    {
      name: 'guildId',
      displayName: 'Guild ID',
      type: 'string',
      default: '',
      description: 'The Discord guild (server) ID',
      placeholder: '123456789012345678',
      displayOptions: {
        show: { operation: ['getGuildInfo', 'listChannels'] },
      },
    },
    {
      name: 'threadName',
      displayName: 'Thread Name',
      type: 'string',
      default: '',
      description: 'Name for the new thread',
      displayOptions: {
        show: { operation: ['createThread'] },
      },
    },
    {
      name: 'embedTitle',
      displayName: 'Embed Title',
      type: 'string',
      default: '',
      description: 'Title for the embed',
      displayOptions: {
        show: { operation: ['sendEmbed'] },
      },
    },
    {
      name: 'embedDescription',
      displayName: 'Embed Description',
      type: 'string',
      default: '',
      description: 'Description text for the embed',
      displayOptions: {
        show: { operation: ['sendEmbed'] },
      },
    },
    {
      name: 'embedColor',
      displayName: 'Embed Color',
      type: 'number',
      default: 0,
      description: 'Color of the embed sidebar as a decimal integer (e.g. 5814783 for blue)',
      displayOptions: {
        show: { operation: ['sendEmbed'] },
      },
    },
    {
      name: 'embedFields',
      displayName: 'Embed Fields (JSON)',
      type: 'json',
      default: '[]',
      description: 'Array of embed fields: [{"name": "Field", "value": "Value", "inline": true}]',
      displayOptions: {
        show: { operation: ['sendEmbed'] },
      },
    },
  ],
  credentials: [{ name: 'discord', required: true }],
  color: '#5865F2',
};

async function callDiscordApi(
  endpoint: string,
  botToken: string,
  method: string = 'GET',
  body?: Record<string, unknown>,
): Promise<Record<string, unknown> | Record<string, unknown>[] | null> {
  const url = `https://discord.com/api/v10${endpoint}`;

  const headers: Record<string, string> = {
    'Authorization': `Bot ${botToken}`,
    'User-Agent': 'FlowForge-Integration (https://flowforge.dev, 1.0)',
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

  if (response.status === 429) {
    const rateLimitData = await response.json() as Record<string, unknown>;
    const retryAfter = rateLimitData.retry_after as number;
    throw new Error(`Discord rate limited. Retry after ${retryAfter} seconds.`);
  }

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as Record<string, unknown>;
    const errorMessage = errorData.message || response.statusText;
    const errorCode = errorData.code ? ` (code: ${errorData.code})` : '';
    throw new Error(`Discord API error (${response.status})${errorCode}: ${errorMessage}`);
  }

  return data as Record<string, unknown> | Record<string, unknown>[];
}

export const DiscordNode: INodeHandler = {
  description,

  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    const params = ctx.parameters as Record<string, unknown>;
    const credentials = ctx.credentials as Record<string, Record<string, string>>;
    const botToken = credentials.discord?.botToken;

    if (!botToken) {
      throw new Error('Discord bot token is required. Please configure Discord credentials.');
    }

    const operation = params.operation as string;
    const results: INodeExecutionData[] = [];

    for (const item of ctx.inputData) {
      try {
        let responseData: Record<string, unknown> | Record<string, unknown>[] | null;

        switch (operation) {
          case 'sendMessage': {
            responseData = await callDiscordApi(
              `/channels/${params.channelId}/messages`,
              botToken,
              'POST',
              { content: params.content as string },
            );
            break;
          }

          case 'editMessage': {
            responseData = await callDiscordApi(
              `/channels/${params.channelId}/messages/${params.messageId}`,
              botToken,
              'PATCH',
              { content: params.content as string },
            );
            break;
          }

          case 'deleteMessage': {
            responseData = await callDiscordApi(
              `/channels/${params.channelId}/messages/${params.messageId}`,
              botToken,
              'DELETE',
            );
            break;
          }

          case 'getGuildInfo': {
            responseData = await callDiscordApi(
              `/guilds/${params.guildId}?with_counts=true`,
              botToken,
            );
            break;
          }

          case 'listChannels': {
            responseData = await callDiscordApi(
              `/guilds/${params.guildId}/channels`,
              botToken,
            );
            break;
          }

          case 'addReaction': {
            const emoji = encodeURIComponent(params.content as string);
            responseData = await callDiscordApi(
              `/channels/${params.channelId}/messages/${params.messageId}/reactions/${emoji}/@me`,
              botToken,
              'PUT',
            );
            break;
          }

          case 'createThread': {
            responseData = await callDiscordApi(
              `/channels/${params.channelId}/messages/${params.messageId}/threads`,
              botToken,
              'POST',
              {
                name: params.threadName as string,
                auto_archive_duration: 1440,
              },
            );
            break;
          }

          case 'sendEmbed': {
            const embed: Record<string, unknown> = {};

            if (params.embedTitle) {
              embed.title = params.embedTitle as string;
            }
            if (params.embedDescription) {
              embed.description = params.embedDescription as string;
            }
            if (params.embedColor) {
              embed.color = params.embedColor as number;
            }

            const fieldsRaw = params.embedFields as string;
            if (fieldsRaw && fieldsRaw !== '[]') {
              embed.fields = typeof fieldsRaw === 'string' ? JSON.parse(fieldsRaw) : fieldsRaw;
            }

            responseData = await callDiscordApi(
              `/channels/${params.channelId}/messages`,
              botToken,
              'POST',
              { embeds: [embed] },
            );
            break;
          }

          default:
            throw new Error(`Unsupported Discord operation: ${operation}`);
        }

        const jsonResult = Array.isArray(responseData)
          ? { items: responseData, count: responseData.length }
          : responseData || {};

        results.push({
          json: {
            success: true,
            operation,
            ...jsonResult,
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
