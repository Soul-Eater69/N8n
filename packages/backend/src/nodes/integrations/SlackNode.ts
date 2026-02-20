import { INodeHandler, INodeExecutionContext } from '../../engine/NodeRegistry';
import { INodeTypeDescription, INodeExecutionResult, INodeExecutionData } from '@flowforge/shared';

const description: INodeTypeDescription = {
  type: 'integration.slack',
  displayName: 'Slack',
  description: 'Send messages, manage channels, and interact with the Slack API',
  icon: 'message-circle',
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
        { name: 'Send Message', value: 'sendMessage', description: 'Post a message to a channel' },
        { name: 'Update Message', value: 'updateMessage', description: 'Update an existing message' },
        { name: 'Delete Message', value: 'deleteMessage', description: 'Delete a message from a channel' },
        { name: 'Get Channel', value: 'getChannel', description: 'Get information about a channel' },
        { name: 'List Channels', value: 'listChannels', description: 'List all channels in the workspace' },
        { name: 'Upload File', value: 'uploadFile', description: 'Upload a file to a channel' },
        { name: 'Add Reaction', value: 'addReaction', description: 'Add an emoji reaction to a message' },
        { name: 'Get User Info', value: 'getUserInfo', description: 'Get information about a user' },
        { name: 'Set Topic', value: 'setTopic', description: 'Set the topic for a channel' },
      ],
    },
    {
      name: 'channel',
      displayName: 'Channel',
      type: 'string',
      default: '',
      description: 'The channel ID to operate on',
      placeholder: 'C01234567',
      displayOptions: {
        show: { operation: ['sendMessage', 'updateMessage', 'deleteMessage', 'getChannel', 'uploadFile', 'addReaction', 'setTopic'] },
      },
    },
    {
      name: 'text',
      displayName: 'Text',
      type: 'string',
      default: '',
      description: 'The message text to send',
      displayOptions: {
        show: { operation: ['sendMessage', 'updateMessage'] },
      },
    },
    {
      name: 'blocks',
      displayName: 'Blocks (JSON)',
      type: 'json',
      default: '[]',
      description: 'Block Kit message blocks as JSON array',
      displayOptions: {
        show: { operation: ['sendMessage', 'updateMessage'] },
      },
    },
    {
      name: 'threadTs',
      displayName: 'Thread Timestamp',
      type: 'string',
      default: '',
      description: 'Timestamp of the parent message for threading',
      displayOptions: {
        show: { operation: ['sendMessage', 'updateMessage', 'deleteMessage', 'addReaction'] },
      },
    },
    {
      name: 'username',
      displayName: 'Username',
      type: 'string',
      default: '',
      description: 'Override the bot username',
      displayOptions: {
        show: { operation: ['sendMessage'] },
      },
    },
    {
      name: 'iconEmoji',
      displayName: 'Icon Emoji',
      type: 'string',
      default: '',
      description: 'Override the bot icon with an emoji (e.g. :robot_face:)',
      placeholder: ':robot_face:',
      displayOptions: {
        show: { operation: ['sendMessage'] },
      },
    },
    {
      name: 'filePath',
      displayName: 'File Content',
      type: 'string',
      default: '',
      description: 'The file content or base64-encoded file data to upload',
      displayOptions: {
        show: { operation: ['uploadFile'] },
      },
    },
    {
      name: 'reaction',
      displayName: 'Reaction',
      type: 'string',
      default: '',
      description: 'Emoji name without colons (e.g. thumbsup)',
      placeholder: 'thumbsup',
      displayOptions: {
        show: { operation: ['addReaction'] },
      },
    },
    {
      name: 'userId',
      displayName: 'User ID',
      type: 'string',
      default: '',
      description: 'The user ID to look up',
      placeholder: 'U01234567',
      displayOptions: {
        show: { operation: ['getUserInfo'] },
      },
    },
    {
      name: 'topic',
      displayName: 'Topic',
      type: 'string',
      default: '',
      description: 'The new topic for the channel',
      displayOptions: {
        show: { operation: ['setTopic'] },
      },
    },
  ],
  credentials: [{ name: 'slack', required: true }],
  color: '#4A154B',
};

async function callSlackApi(
  method: string,
  botToken: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const response = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${botToken}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Slack API HTTP error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as Record<string, unknown>;
  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error as string}${data.response_metadata ? ` - ${JSON.stringify(data.response_metadata)}` : ''}`);
  }

  return data;
}

export const SlackNode: INodeHandler = {
  description,

  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    const params = ctx.parameters as Record<string, string>;
    const credentials = ctx.credentials as Record<string, Record<string, string>>;
    const botToken = credentials.slack?.botToken;

    if (!botToken) {
      throw new Error('Slack bot token is required. Please configure Slack credentials.');
    }

    const operation = params.operation;
    const results: INodeExecutionData[] = [];

    for (const item of ctx.inputData) {
      try {
        let responseData: Record<string, unknown>;

        switch (operation) {
          case 'sendMessage': {
            const payload: Record<string, unknown> = {
              channel: params.channel,
              text: params.text,
            };
            if (params.blocks && params.blocks !== '[]') {
              payload.blocks = typeof params.blocks === 'string' ? JSON.parse(params.blocks) : params.blocks;
            }
            if (params.threadTs) {
              payload.thread_ts = params.threadTs;
            }
            if (params.username) {
              payload.username = params.username;
            }
            if (params.iconEmoji) {
              payload.icon_emoji = params.iconEmoji;
            }
            responseData = await callSlackApi('chat.postMessage', botToken, payload);
            break;
          }

          case 'updateMessage': {
            const payload: Record<string, unknown> = {
              channel: params.channel,
              ts: params.threadTs,
              text: params.text,
            };
            if (params.blocks && params.blocks !== '[]') {
              payload.blocks = typeof params.blocks === 'string' ? JSON.parse(params.blocks) : params.blocks;
            }
            responseData = await callSlackApi('chat.update', botToken, payload);
            break;
          }

          case 'deleteMessage': {
            responseData = await callSlackApi('chat.delete', botToken, {
              channel: params.channel,
              ts: params.threadTs,
            });
            break;
          }

          case 'getChannel': {
            responseData = await callSlackApi('conversations.info', botToken, {
              channel: params.channel,
            });
            break;
          }

          case 'listChannels': {
            responseData = await callSlackApi('conversations.list', botToken, {
              types: 'public_channel,private_channel',
              limit: 200,
            });
            break;
          }

          case 'uploadFile': {
            const fileContent = params.filePath;
            const payload: Record<string, unknown> = {
              channels: params.channel,
              content: fileContent,
            };
            if (params.text) {
              payload.initial_comment = params.text;
            }
            responseData = await callSlackApi('files.upload', botToken, payload);
            break;
          }

          case 'addReaction': {
            responseData = await callSlackApi('reactions.add', botToken, {
              channel: params.channel,
              name: params.reaction,
              timestamp: params.threadTs,
            });
            break;
          }

          case 'getUserInfo': {
            responseData = await callSlackApi('users.info', botToken, {
              user: params.userId,
            });
            break;
          }

          case 'setTopic': {
            responseData = await callSlackApi('conversations.setTopic', botToken, {
              channel: params.channel,
              topic: params.topic,
            });
            break;
          }

          default:
            throw new Error(`Unsupported Slack operation: ${operation}`);
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
