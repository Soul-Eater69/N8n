import { INodeHandler, INodeExecutionContext } from '../../engine/NodeRegistry';
import { INodeTypeDescription, INodeExecutionResult, INodeExecutionData } from '@flowforge/shared';

const description: INodeTypeDescription = {
  type: 'ai.embeddings',
  displayName: 'Embeddings',
  description: 'Generate vector embeddings for text using OpenAI or custom providers',
  icon: 'hash',
  category: 'ai',
  version: 1,
  inputs: [{ name: 'main', type: 'main' }],
  outputs: [{ name: 'main', type: 'main' }],
  credentials: [{ name: 'openai', required: false }],
  properties: [
    {
      name: 'provider',
      displayName: 'Provider',
      type: 'options',
      default: 'openai',
      required: true,
      options: [
        { name: 'OpenAI', value: 'openai' },
        { name: 'Custom', value: 'custom', description: 'Use a custom embeddings endpoint' },
      ],
    },
    {
      name: 'model',
      displayName: 'Model',
      type: 'options',
      default: 'text-embedding-3-small',
      options: [
        { name: 'text-embedding-3-small', value: 'text-embedding-3-small', description: 'Best balance of cost and performance' },
        { name: 'text-embedding-3-large', value: 'text-embedding-3-large', description: 'Highest performance' },
        { name: 'text-embedding-ada-002', value: 'text-embedding-ada-002', description: 'Legacy model' },
      ],
      displayOptions: {
        show: { provider: ['openai'] },
      },
    },
    {
      name: 'inputField',
      displayName: 'Input Field',
      type: 'string',
      default: 'text',
      required: true,
      description: 'The field containing the text to embed',
    },
    {
      name: 'dimensions',
      displayName: 'Dimensions',
      type: 'number',
      default: 0,
      description: 'Override output dimensions (0 for model default). Only supported by text-embedding-3 models.',
    },
    {
      name: 'customEndpoint',
      displayName: 'Custom Endpoint URL',
      type: 'string',
      default: '',
      description: 'The URL of the custom embeddings endpoint',
      displayOptions: {
        show: { provider: ['custom'] },
      },
    },
    {
      name: 'customApiKey',
      displayName: 'Custom API Key',
      type: 'string',
      default: '',
      description: 'API key for the custom endpoint',
      displayOptions: {
        show: { provider: ['custom'] },
      },
    },
  ],
  color: '#06B6D4',
};

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((current: any, key) => current?.[key], obj);
}

async function callOpenAIEmbeddings(
  apiKey: string,
  model: string,
  inputs: string[],
  dimensions: number,
): Promise<Array<{ embedding: number[]; index: number }>> {
  const body: Record<string, unknown> = {
    model,
    input: inputs,
  };

  if (dimensions > 0 && model.startsWith('text-embedding-3')) {
    body.dimensions = dimensions;
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `OpenAI Embeddings API error (${response.status}): ${(errorData as any)?.error?.message || response.statusText}`,
    );
  }

  const data = (await response.json()) as Record<string, unknown>;
  return (data.data as Array<{ embedding: number[]; index: number }>) || [];
}

async function callCustomEmbeddings(
  endpoint: string,
  apiKey: string,
  inputs: string[],
): Promise<Array<{ embedding: number[]; index: number }>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ input: inputs }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Custom Embeddings API error (${response.status}): ${JSON.stringify(errorData)}`,
    );
  }

  const data = (await response.json()) as Record<string, unknown>;

  // Support both OpenAI-compatible format and flat array format
  if (data.data && Array.isArray(data.data)) {
    return data.data as Array<{ embedding: number[]; index: number }>;
  }

  if (data.embeddings && Array.isArray(data.embeddings)) {
    return (data.embeddings as number[][]).map((emb: number[], i: number) => ({
      embedding: emb,
      index: i,
    }));
  }

  throw new Error('Custom endpoint returned unrecognized format. Expected { data: [...] } or { embeddings: [...] }');
}

export const EmbeddingsNode: INodeHandler = {
  description,
  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    const provider = (ctx.parameters.provider as string) || 'openai';
    const model = (ctx.parameters.model as string) || 'text-embedding-3-small';
    const inputField = (ctx.parameters.inputField as string) || 'text';
    const dimensions = Number(ctx.parameters.dimensions ?? 0);

    // Collect texts from all input items
    const texts: string[] = [];
    for (const item of ctx.inputData) {
      const rawValue = getNestedValue(item.json, inputField);
      const text = typeof rawValue === 'string' ? rawValue : String(rawValue || '');
      texts.push(text);
    }

    // Filter out empty texts but track their indices
    const nonEmptyIndices: number[] = [];
    const nonEmptyTexts: string[] = [];
    for (let i = 0; i < texts.length; i++) {
      if (texts[i].trim()) {
        nonEmptyIndices.push(i);
        nonEmptyTexts.push(texts[i]);
      }
    }

    let embeddingsData: Array<{ embedding: number[]; index: number }> = [];

    if (nonEmptyTexts.length > 0) {
      if (provider === 'openai') {
        const credentials = ctx.credentials.openai as Record<string, string> | undefined;
        if (!credentials?.apiKey) {
          throw new Error('OpenAI credentials not configured. Please provide an API key.');
        }

        // Batch requests in groups of 100 to stay within API limits
        const batchSize = 100;
        for (let batchStart = 0; batchStart < nonEmptyTexts.length; batchStart += batchSize) {
          const batch = nonEmptyTexts.slice(batchStart, batchStart + batchSize);
          const batchResults = await callOpenAIEmbeddings(credentials.apiKey, model, batch, dimensions);

          // Adjust indices for the batch offset
          for (const result of batchResults) {
            embeddingsData.push({
              embedding: result.embedding,
              index: batchStart + result.index,
            });
          }
        }
      } else if (provider === 'custom') {
        const customEndpoint = (ctx.parameters.customEndpoint as string) || '';
        const customApiKey = (ctx.parameters.customApiKey as string) || '';

        if (!customEndpoint) {
          throw new Error('Custom endpoint URL is required');
        }

        embeddingsData = await callCustomEmbeddings(customEndpoint, customApiKey, nonEmptyTexts);
      } else {
        throw new Error(`Unsupported provider: ${provider}`);
      }
    }

    // Build a map from nonEmpty index -> embedding
    const embeddingMap = new Map<number, number[]>();
    for (const item of embeddingsData) {
      embeddingMap.set(item.index, item.embedding);
    }

    // Build results for all input items
    const results: INodeExecutionData[] = [];
    let nonEmptyIdx = 0;

    for (let i = 0; i < ctx.inputData.length; i++) {
      const inputItem = ctx.inputData[i];

      if (nonEmptyIndices.includes(i)) {
        const embedding = embeddingMap.get(nonEmptyIdx) || [];
        results.push({
          json: {
            ...inputItem.json,
            embedding,
            embeddingDimensions: embedding.length,
            model: provider === 'openai' ? model : 'custom',
            provider,
          },
          pairedItem: { item: i },
        });
        nonEmptyIdx++;
      } else {
        results.push({
          json: {
            ...inputItem.json,
            embedding: [],
            embeddingDimensions: 0,
            model: provider === 'openai' ? model : 'custom',
            provider,
            warning: 'Empty text input, no embedding generated',
          },
          pairedItem: { item: i },
        });
      }
    }

    return { data: [results] };
  },
};
