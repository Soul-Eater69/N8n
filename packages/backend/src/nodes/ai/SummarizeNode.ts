import { INodeHandler, INodeExecutionContext } from '../../engine/NodeRegistry';
import { INodeTypeDescription, INodeExecutionResult, INodeExecutionData } from '@flowforge/shared';

const description: INodeTypeDescription = {
  type: 'ai.summarize',
  displayName: 'Summarize',
  description: 'Summarize text using an LLM with configurable styles',
  icon: 'file-text',
  category: 'ai',
  version: 1,
  inputs: [{ name: 'main', type: 'main' }],
  outputs: [{ name: 'main', type: 'main' }],
  credentials: [
    { name: 'openai', required: false },
    { name: 'anthropic', required: false },
  ],
  properties: [
    {
      name: 'provider',
      displayName: 'Provider',
      type: 'options',
      default: 'openai',
      required: true,
      options: [
        { name: 'OpenAI', value: 'openai' },
        { name: 'Anthropic', value: 'anthropic' },
      ],
    },
    {
      name: 'model',
      displayName: 'Model',
      type: 'string',
      default: 'gpt-4o-mini',
      required: true,
      description: 'Model identifier (e.g. gpt-4o-mini, claude-haiku-4-5-20251001)',
    },
    {
      name: 'inputField',
      displayName: 'Input Field',
      type: 'string',
      default: 'text',
      required: true,
      description: 'The field containing the text to summarize',
    },
    {
      name: 'style',
      displayName: 'Summary Style',
      type: 'options',
      default: 'concise',
      required: true,
      options: [
        { name: 'Concise', value: 'concise', description: 'Brief 2-3 sentence summary' },
        { name: 'Detailed', value: 'detailed', description: 'Comprehensive summary preserving key details' },
        { name: 'Bullet Points', value: 'bullet_points', description: 'Key points as bullet list' },
        { name: 'Executive', value: 'executive', description: 'Executive summary with key takeaways' },
      ],
    },
    {
      name: 'maxLength',
      displayName: 'Max Length (words)',
      type: 'number',
      default: 0,
      description: 'Approximate maximum word count for the summary (0 for no limit)',
    },
    {
      name: 'language',
      displayName: 'Language',
      type: 'string',
      default: 'English',
      description: 'Output language for the summary',
    },
  ],
  color: '#F59E0B',
};

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((current: any, key) => current?.[key], obj);
}

function buildSummarizationPrompt(style: string, maxLength: number, language: string): string {
  let styleInstruction: string;

  switch (style) {
    case 'concise':
      styleInstruction = 'Provide a concise summary in 2-3 sentences that captures the core message and key points.';
      break;
    case 'detailed':
      styleInstruction = 'Provide a comprehensive and detailed summary that preserves all key details, arguments, and important nuances from the original text.';
      break;
    case 'bullet_points':
      styleInstruction = 'Summarize the text as a clear bullet-point list. Each bullet should capture one key point or finding. Use "- " prefix for each bullet.';
      break;
    case 'executive':
      styleInstruction = 'Write an executive summary suitable for senior leadership. Start with a one-line overview, then cover key findings, implications, and recommended actions or takeaways.';
      break;
    default:
      styleInstruction = 'Provide a concise summary.';
  }

  let prompt = `You are an expert summarization assistant. ${styleInstruction}`;

  if (maxLength > 0) {
    prompt += ` Keep the summary to approximately ${maxLength} words or fewer.`;
  }

  if (language && language.toLowerCase() !== 'english') {
    prompt += ` Write the summary in ${language}.`;
  }

  prompt += '\n\nProvide only the summary, with no preamble or explanation.';

  return prompt;
}

async function callOpenAISummarize(
  apiKey: string,
  model: string,
  systemPrompt: string,
  text: string,
): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Please summarize the following text:\n\n${text}` },
      ],
      temperature: 0.3,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `OpenAI API error (${response.status}): ${(errorData as any)?.error?.message || response.statusText}`,
    );
  }

  const data = (await response.json()) as Record<string, unknown>;
  const choices = (data.choices as any[]) || [];
  const message = choices[0]?.message || {};
  return (message.content as string) || '';
}

async function callAnthropicSummarize(
  apiKey: string,
  model: string,
  systemPrompt: string,
  text: string,
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      system: systemPrompt,
      messages: [
        { role: 'user', content: `Please summarize the following text:\n\n${text}` },
      ],
      temperature: 0.3,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage =
      (errorData as any)?.error?.message || (errorData as any)?.message || response.statusText;
    throw new Error(`Anthropic API error (${response.status}): ${errorMessage}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  const content = (data.content as any[]) || [];
  const textBlocks = content.filter((block: any) => block.type === 'text');
  return textBlocks.map((block: any) => block.text).join('');
}

export const SummarizeNode: INodeHandler = {
  description,
  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    const provider = (ctx.parameters.provider as string) || 'openai';
    const model = (ctx.parameters.model as string) || (provider === 'openai' ? 'gpt-4o-mini' : 'claude-haiku-4-5-20251001');
    const inputField = (ctx.parameters.inputField as string) || 'text';
    const style = (ctx.parameters.style as string) || 'concise';
    const maxLength = Number(ctx.parameters.maxLength ?? 0);
    const language = (ctx.parameters.language as string) || 'English';

    let apiKey: string;

    if (provider === 'openai') {
      const credentials = ctx.credentials.openai as Record<string, string> | undefined;
      if (!credentials?.apiKey) {
        throw new Error('OpenAI credentials not configured. Please provide an API key.');
      }
      apiKey = credentials.apiKey;
    } else {
      const credentials = ctx.credentials.anthropic as Record<string, string> | undefined;
      if (!credentials?.apiKey) {
        throw new Error('Anthropic credentials not configured. Please provide an API key.');
      }
      apiKey = credentials.apiKey;
    }

    const systemPrompt = buildSummarizationPrompt(style, maxLength, language);
    const results: INodeExecutionData[] = [];

    for (const item of ctx.inputData) {
      try {
        const rawText = getNestedValue(item.json, inputField);
        const text = typeof rawText === 'string' ? rawText : String(rawText || '');

        if (!text.trim()) {
          results.push({
            json: {
              ...item.json,
              summary: '',
              warning: 'Empty input text, no summary generated',
            },
          });
          continue;
        }

        let summary: string;

        if (provider === 'openai') {
          summary = await callOpenAISummarize(apiKey, model, systemPrompt, text);
        } else {
          summary = await callAnthropicSummarize(apiKey, model, systemPrompt, text);
        }

        const inputWordCount = text.split(/\s+/).filter((w) => w.length > 0).length;
        const summaryWordCount = summary.split(/\s+/).filter((w) => w.length > 0).length;

        results.push({
          json: {
            ...item.json,
            summary,
            summaryMetadata: {
              style,
              provider,
              model,
              language,
              inputWordCount,
              summaryWordCount,
              compressionRatio: inputWordCount > 0 ? parseFloat((summaryWordCount / inputWordCount).toFixed(4)) : 0,
            },
          },
        });
      } catch (error: any) {
        results.push({
          json: {
            ...item.json,
            error: true,
            message: error.message,
          },
        });
      }
    }

    return { data: [results] };
  },
};
