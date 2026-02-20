import { INodeHandler, INodeExecutionContext } from '../../engine/NodeRegistry';
import { INodeTypeDescription, INodeExecutionResult, INodeExecutionData } from '@flowforge/shared';

const description: INodeTypeDescription = {
  type: 'ai.anthropic',
  displayName: 'Anthropic (Claude)',
  description: 'Interact with Anthropic Claude models for chat and text generation',
  icon: 'message-square',
  category: 'ai',
  version: 1,
  inputs: [{ name: 'main', type: 'main' }],
  outputs: [{ name: 'main', type: 'main' }],
  credentials: [{ name: 'anthropic', required: true }],
  properties: [
    {
      name: 'model',
      displayName: 'Model',
      type: 'options',
      default: 'claude-sonnet-4-5-20250929',
      required: true,
      options: [
        { name: 'Claude Opus 4', value: 'claude-opus-4-6', description: 'Most capable model for complex tasks' },
        { name: 'Claude Sonnet 4', value: 'claude-sonnet-4-5-20250929', description: 'Balanced performance and speed' },
        { name: 'Claude Haiku 4', value: 'claude-haiku-4-5-20251001', description: 'Fastest model for simple tasks' },
      ],
    },
    {
      name: 'systemPrompt',
      displayName: 'System Prompt',
      type: 'string',
      default: '',
      description: 'The system message to set the behavior of the assistant',
      typeOptions: { rows: 4 },
    },
    {
      name: 'userPrompt',
      displayName: 'User Prompt',
      type: 'string',
      default: '',
      required: true,
      description: 'The user message to send',
      typeOptions: { rows: 4 },
    },
    {
      name: 'temperature',
      displayName: 'Temperature',
      type: 'number',
      default: 0.7,
      description: 'Controls randomness (0-1)',
    },
    {
      name: 'maxTokens',
      displayName: 'Max Tokens',
      type: 'number',
      default: 1024,
      description: 'Maximum number of tokens to generate',
    },
    {
      name: 'topK',
      displayName: 'Top K',
      type: 'number',
      default: 0,
      description: 'Only sample from the top K options (0 to disable)',
    },
    {
      name: 'topP',
      displayName: 'Top P',
      type: 'number',
      default: 1,
      description: 'Nucleus sampling parameter (0-1)',
    },
  ],
  color: '#D97706',
};

async function callAnthropicMessages(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  temperature: number,
  maxTokens: number,
  topK: number,
  topP: number,
): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = {
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
    top_p: topP,
  };

  if (systemPrompt) {
    body.system = systemPrompt;
  }

  if (topK > 0) {
    body.top_k = topK;
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage =
      (errorData as any)?.error?.message || (errorData as any)?.message || response.statusText;
    throw new Error(`Anthropic API error (${response.status}): ${errorMessage}`);
  }

  return response.json() as Promise<Record<string, unknown>>;
}

export const AnthropicNode: INodeHandler = {
  description,
  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    const credentials = ctx.credentials.anthropic as Record<string, string> | undefined;
    if (!credentials?.apiKey) {
      throw new Error('Anthropic credentials not configured. Please provide an API key.');
    }
    const apiKey = credentials.apiKey;

    const model = (ctx.parameters.model as string) || 'claude-sonnet-4-5-20250929';
    const systemPrompt = (ctx.parameters.systemPrompt as string) || '';
    const temperature = Number(ctx.parameters.temperature ?? 0.7);
    const maxTokens = Number(ctx.parameters.maxTokens ?? 1024);
    const topK = Number(ctx.parameters.topK ?? 0);
    const topP = Number(ctx.parameters.topP ?? 1);

    const results: INodeExecutionData[] = [];

    for (const item of ctx.inputData) {
      try {
        const userPrompt = (ctx.parameters.userPrompt as string) || (item.json.prompt as string) || '';
        if (!userPrompt) {
          throw new Error('No user prompt provided');
        }

        const messages: Array<{ role: string; content: string }> = [
          { role: 'user', content: userPrompt },
        ];

        const data = await callAnthropicMessages(
          apiKey,
          model,
          systemPrompt,
          messages,
          temperature,
          maxTokens,
          topK,
          topP,
        );

        const content = (data.content as any[]) || [];
        const textBlocks = content.filter((block: any) => block.type === 'text');
        const fullText = textBlocks.map((block: any) => block.text).join('');
        const usage = (data.usage as Record<string, number>) || {};

        results.push({
          json: {
            text: fullText,
            role: data.role || 'assistant',
            model: data.model,
            stopReason: data.stop_reason,
            contentBlocks: content,
            usage: {
              inputTokens: usage.input_tokens,
              outputTokens: usage.output_tokens,
            },
            id: data.id,
          },
        });
      } catch (error: any) {
        results.push({
          json: {
            error: true,
            message: error.message,
            ...item.json,
          },
        });
      }
    }

    return { data: [results] };
  },
};
