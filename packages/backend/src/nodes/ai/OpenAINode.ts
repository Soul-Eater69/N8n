import { INodeHandler, INodeExecutionContext } from '../../engine/NodeRegistry';
import { INodeTypeDescription, INodeExecutionResult, INodeExecutionData } from '@flowforge/shared';

const description: INodeTypeDescription = {
  type: 'ai.openai',
  displayName: 'OpenAI',
  description: 'Interact with OpenAI models for chat, completions, embeddings, image generation, and audio transcription',
  icon: 'brain',
  category: 'ai',
  version: 1,
  inputs: [{ name: 'main', type: 'main' }],
  outputs: [{ name: 'main', type: 'main' }],
  credentials: [{ name: 'openai', required: true }],
  properties: [
    {
      name: 'operation',
      displayName: 'Operation',
      type: 'options',
      default: 'chat',
      required: true,
      options: [
        { name: 'Chat', value: 'chat', description: 'Send a chat message' },
        { name: 'Complete', value: 'complete', description: 'Generate a text completion' },
        { name: 'Embed', value: 'embed', description: 'Generate embeddings for text' },
        { name: 'Image Generate', value: 'image-generate', description: 'Generate images with DALL-E' },
        { name: 'Audio Transcribe', value: 'audio-transcribe', description: 'Transcribe audio with Whisper' },
      ],
    },
    {
      name: 'model',
      displayName: 'Model',
      type: 'options',
      default: 'gpt-4o',
      options: [
        { name: 'GPT-4o', value: 'gpt-4o' },
        { name: 'GPT-4o Mini', value: 'gpt-4o-mini' },
        { name: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
        { name: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' },
      ],
      displayOptions: {
        show: { operation: ['chat', 'complete'] },
      },
    },
    {
      name: 'systemPrompt',
      displayName: 'System Prompt',
      type: 'string',
      default: '',
      description: 'The system message to set the behavior of the assistant',
      displayOptions: {
        show: { operation: ['chat', 'complete'] },
      },
      typeOptions: { rows: 4 },
    },
    {
      name: 'userPrompt',
      displayName: 'User Prompt',
      type: 'string',
      default: '',
      required: true,
      description: 'The user message to send',
      displayOptions: {
        show: { operation: ['chat', 'complete'] },
      },
      typeOptions: { rows: 4 },
    },
    {
      name: 'temperature',
      displayName: 'Temperature',
      type: 'number',
      default: 0.7,
      description: 'Controls randomness (0-2)',
      displayOptions: {
        show: { operation: ['chat', 'complete'] },
      },
    },
    {
      name: 'maxTokens',
      displayName: 'Max Tokens',
      type: 'number',
      default: 1024,
      description: 'Maximum number of tokens to generate',
      displayOptions: {
        show: { operation: ['chat', 'complete'] },
      },
    },
    {
      name: 'topP',
      displayName: 'Top P',
      type: 'number',
      default: 1,
      description: 'Nucleus sampling parameter (0-1)',
      displayOptions: {
        show: { operation: ['chat', 'complete'] },
      },
    },
    {
      name: 'frequencyPenalty',
      displayName: 'Frequency Penalty',
      type: 'number',
      default: 0,
      description: 'Penalizes frequent tokens (-2 to 2)',
      displayOptions: {
        show: { operation: ['chat', 'complete'] },
      },
    },
    {
      name: 'presencePenalty',
      displayName: 'Presence Penalty',
      type: 'number',
      default: 0,
      description: 'Penalizes tokens already present (-2 to 2)',
      displayOptions: {
        show: { operation: ['chat', 'complete'] },
      },
    },
    {
      name: 'responseFormat',
      displayName: 'Response Format',
      type: 'options',
      default: 'text',
      options: [
        { name: 'Text', value: 'text' },
        { name: 'JSON Object', value: 'json_object' },
      ],
      displayOptions: {
        show: { operation: ['chat', 'complete'] },
      },
    },
    {
      name: 'imageSize',
      displayName: 'Image Size',
      type: 'options',
      default: '1024x1024',
      options: [
        { name: '256x256', value: '256x256' },
        { name: '512x512', value: '512x512' },
        { name: '1024x1024', value: '1024x1024' },
        { name: '1792x1024', value: '1792x1024' },
        { name: '1024x1792', value: '1024x1792' },
      ],
      displayOptions: {
        show: { operation: ['image-generate'] },
      },
    },
    {
      name: 'imageQuality',
      displayName: 'Image Quality',
      type: 'options',
      default: 'standard',
      options: [
        { name: 'Standard', value: 'standard' },
        { name: 'HD', value: 'hd' },
      ],
      displayOptions: {
        show: { operation: ['image-generate'] },
      },
    },
  ],
  color: '#10A37F',
};

async function callChatCompletion(
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  temperature: number,
  maxTokens: number,
  topP: number,
  frequencyPenalty: number,
  presencePenalty: number,
  responseFormat: string,
): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    top_p: topP,
    frequency_penalty: frequencyPenalty,
    presence_penalty: presencePenalty,
  };

  if (responseFormat === 'json_object') {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
      `OpenAI API error (${response.status}): ${(errorData as any)?.error?.message || response.statusText}`,
    );
  }

  return response.json() as Promise<Record<string, unknown>>;
}

async function callEmbeddings(
  apiKey: string,
  input: string,
  model: string = 'text-embedding-3-small',
): Promise<Record<string, unknown>> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `OpenAI Embeddings API error (${response.status}): ${(errorData as any)?.error?.message || response.statusText}`,
    );
  }

  return response.json() as Promise<Record<string, unknown>>;
}

async function callImageGeneration(
  apiKey: string,
  prompt: string,
  size: string,
  quality: string,
): Promise<Record<string, unknown>> {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size,
      quality,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `OpenAI Images API error (${response.status}): ${(errorData as any)?.error?.message || response.statusText}`,
    );
  }

  return response.json() as Promise<Record<string, unknown>>;
}

async function callAudioTranscription(
  apiKey: string,
  audioData: string,
  fileName: string,
): Promise<Record<string, unknown>> {
  const binaryData = Buffer.from(audioData, 'base64');
  const boundary = `----FormBoundary${Date.now().toString(36)}`;

  const formParts: Buffer[] = [];

  // Add file part
  formParts.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName || 'audio.mp3'}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
    ),
  );
  formParts.push(binaryData);
  formParts.push(Buffer.from('\r\n'));

  // Add model part
  formParts.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n`,
    ),
  );

  // Closing boundary
  formParts.push(Buffer.from(`--${boundary}--\r\n`));

  const formBody = Buffer.concat(formParts);

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body: formBody,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `OpenAI Audio API error (${response.status}): ${(errorData as any)?.error?.message || response.statusText}`,
    );
  }

  return response.json() as Promise<Record<string, unknown>>;
}

export const OpenAINode: INodeHandler = {
  description,
  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    const credentials = ctx.credentials.openai as Record<string, string> | undefined;
    if (!credentials?.apiKey) {
      throw new Error('OpenAI credentials not configured. Please provide an API key.');
    }
    const apiKey = credentials.apiKey;

    const operation = (ctx.parameters.operation as string) || 'chat';
    const results: INodeExecutionData[] = [];

    for (const item of ctx.inputData) {
      try {
        switch (operation) {
          case 'chat':
          case 'complete': {
            const model = (ctx.parameters.model as string) || 'gpt-4o';
            const systemPrompt = (ctx.parameters.systemPrompt as string) || '';
            const userPrompt = (ctx.parameters.userPrompt as string) || (item.json.prompt as string) || '';
            const temperature = Number(ctx.parameters.temperature ?? 0.7);
            const maxTokens = Number(ctx.parameters.maxTokens ?? 1024);
            const topP = Number(ctx.parameters.topP ?? 1);
            const frequencyPenalty = Number(ctx.parameters.frequencyPenalty ?? 0);
            const presencePenalty = Number(ctx.parameters.presencePenalty ?? 0);
            const responseFormat = (ctx.parameters.responseFormat as string) || 'text';

            const messages: Array<{ role: string; content: string }> = [];
            if (systemPrompt) {
              messages.push({ role: 'system', content: systemPrompt });
            }
            messages.push({ role: 'user', content: userPrompt });

            const data = await callChatCompletion(
              apiKey,
              model,
              messages,
              temperature,
              maxTokens,
              topP,
              frequencyPenalty,
              presencePenalty,
              responseFormat,
            );

            const choices = (data.choices as any[]) || [];
            const choice = choices[0] || {};
            const message = choice.message || {};
            const usage = (data.usage as Record<string, number>) || {};

            results.push({
              json: {
                text: message.content || '',
                role: message.role || 'assistant',
                model: data.model,
                finishReason: choice.finish_reason,
                usage: {
                  promptTokens: usage.prompt_tokens,
                  completionTokens: usage.completion_tokens,
                  totalTokens: usage.total_tokens,
                },
                id: data.id,
              },
            });
            break;
          }

          case 'embed': {
            const inputText = (ctx.parameters.userPrompt as string) || (item.json.text as string) || '';
            if (!inputText) {
              throw new Error('No input text provided for embedding');
            }

            const data = await callEmbeddings(apiKey, inputText);
            const embeddingData = ((data.data as any[]) || [])[0] || {};
            const usage = (data.usage as Record<string, number>) || {};

            results.push({
              json: {
                embedding: embeddingData.embedding || [],
                index: embeddingData.index || 0,
                model: data.model,
                usage: {
                  promptTokens: usage.prompt_tokens,
                  totalTokens: usage.total_tokens,
                },
              },
            });
            break;
          }

          case 'image-generate': {
            const prompt = (ctx.parameters.userPrompt as string) || (item.json.prompt as string) || '';
            if (!prompt) {
              throw new Error('No prompt provided for image generation');
            }
            const imageSize = (ctx.parameters.imageSize as string) || '1024x1024';
            const imageQuality = (ctx.parameters.imageQuality as string) || 'standard';

            const data = await callImageGeneration(apiKey, prompt, imageSize, imageQuality);
            const images = (data.data as any[]) || [];
            const image = images[0] || {};

            results.push({
              json: {
                url: image.url || '',
                revisedPrompt: image.revised_prompt || '',
                created: data.created,
              },
            });
            break;
          }

          case 'audio-transcribe': {
            const binaryField = item.binary;
            if (!binaryField) {
              throw new Error('No binary data provided for audio transcription. Attach an audio file.');
            }
            const firstKey = Object.keys(binaryField)[0];
            const binary = binaryField[firstKey];
            if (!binary) {
              throw new Error('No binary data found in input item');
            }

            const data = await callAudioTranscription(apiKey, binary.data, binary.fileName || 'audio.mp3');

            results.push({
              json: {
                text: (data as any).text || '',
                language: (data as any).language,
                duration: (data as any).duration,
              },
            });
            break;
          }

          default:
            throw new Error(`Unsupported operation: ${operation}`);
        }
      } catch (error: any) {
        results.push({
          json: {
            error: true,
            message: error.message,
            operation,
            ...item.json,
          },
        });
      }
    }

    return { data: [results] };
  },
};
