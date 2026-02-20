import { INodeHandler, INodeExecutionContext } from '../../engine/NodeRegistry';
import { INodeTypeDescription, INodeExecutionResult, INodeExecutionData } from '@flowforge/shared';

const description: INodeTypeDescription = {
  type: 'ai.sentiment',
  displayName: 'Sentiment Analysis',
  description: 'Analyze text sentiment using an LLM, returning sentiment, confidence, and key phrases',
  icon: 'smile',
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
      description: 'The field containing the text to analyze',
    },
    {
      name: 'granularity',
      displayName: 'Granularity',
      type: 'options',
      default: 'document',
      options: [
        { name: 'Document', value: 'document', description: 'Analyze the entire text as one unit' },
        { name: 'Sentence', value: 'sentence', description: 'Analyze each sentence separately' },
      ],
    },
  ],
  color: '#EF4444',
};

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((current: any, key) => current?.[key], obj);
}

function buildSentimentPrompt(granularity: string): string {
  if (granularity === 'sentence') {
    return `You are a precise sentiment analysis system. Analyze the sentiment of each sentence in the given text.

Respond with ONLY a valid JSON object in this exact format:
{
  "overall": {
    "sentiment": "positive" | "negative" | "neutral" | "mixed",
    "confidence": <number between 0 and 1>,
    "keyPhrases": [<array of key phrases that indicate sentiment>]
  },
  "sentences": [
    {
      "text": "<the sentence>",
      "sentiment": "positive" | "negative" | "neutral",
      "confidence": <number between 0 and 1>,
      "keyPhrases": [<key phrases>]
    }
  ]
}

Rules:
- "sentiment" must be exactly one of: "positive", "negative", "neutral", "mixed"
- "confidence" must be a number between 0 and 1
- "keyPhrases" should contain 1-5 short phrases that most strongly indicate the sentiment
- Respond with ONLY the JSON, no other text`;
  }

  return `You are a precise sentiment analysis system. Analyze the overall sentiment of the given text.

Respond with ONLY a valid JSON object in this exact format:
{
  "sentiment": "positive" | "negative" | "neutral" | "mixed",
  "confidence": <number between 0 and 1>,
  "keyPhrases": [<array of key phrases that indicate sentiment>]
}

Rules:
- "sentiment" must be exactly one of: "positive", "negative", "neutral", "mixed"
- "confidence" must be a number between 0 and 1
- "keyPhrases" should contain 1-5 short phrases that most strongly indicate the sentiment
- Respond with ONLY the JSON, no other text`;
}

async function callOpenAISentiment(
  apiKey: string,
  model: string,
  systemPrompt: string,
  text: string,
): Promise<Record<string, unknown>> {
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
        { role: 'user', content: `Analyze the sentiment of the following text:\n\n${text}` },
      ],
      temperature: 0.1,
      max_tokens: 2048,
      response_format: { type: 'json_object' },
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
  const content = choices[0]?.message?.content || '{}';

  try {
    return JSON.parse(content);
  } catch {
    throw new Error(`Failed to parse sentiment response as JSON: ${content}`);
  }
}

async function callAnthropicSentiment(
  apiKey: string,
  model: string,
  systemPrompt: string,
  text: string,
): Promise<Record<string, unknown>> {
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
        { role: 'user', content: `Analyze the sentiment of the following text:\n\n${text}` },
      ],
      temperature: 0.1,
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
  const contentBlocks = (data.content as any[]) || [];
  const textBlocks = contentBlocks.filter((block: any) => block.type === 'text');
  const rawText = textBlocks.map((block: any) => block.text).join('');

  // Extract JSON from the response (handle possible markdown code blocks)
  let jsonStr = rawText.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  try {
    return JSON.parse(jsonStr);
  } catch {
    throw new Error(`Failed to parse sentiment response as JSON: ${jsonStr}`);
  }
}

function validateSentimentResult(result: Record<string, unknown>): Record<string, unknown> {
  const validSentiments = ['positive', 'negative', 'neutral', 'mixed'];

  // Document-level result
  if (result.sentiment !== undefined) {
    if (!validSentiments.includes(result.sentiment as string)) {
      result.sentiment = 'neutral';
    }
    const confidence = Number(result.confidence);
    result.confidence = isNaN(confidence) ? 0.5 : Math.max(0, Math.min(1, confidence));
    if (!Array.isArray(result.keyPhrases)) {
      result.keyPhrases = [];
    }
  }

  // Sentence-level results
  if (result.overall && typeof result.overall === 'object') {
    const overall = result.overall as Record<string, unknown>;
    if (!validSentiments.includes(overall.sentiment as string)) {
      overall.sentiment = 'neutral';
    }
    const confidence = Number(overall.confidence);
    overall.confidence = isNaN(confidence) ? 0.5 : Math.max(0, Math.min(1, confidence));
    if (!Array.isArray(overall.keyPhrases)) {
      overall.keyPhrases = [];
    }
  }

  if (Array.isArray(result.sentences)) {
    for (const sentence of result.sentences as any[]) {
      if (!validSentiments.includes(sentence.sentiment)) {
        sentence.sentiment = 'neutral';
      }
      const confidence = Number(sentence.confidence);
      sentence.confidence = isNaN(confidence) ? 0.5 : Math.max(0, Math.min(1, confidence));
      if (!Array.isArray(sentence.keyPhrases)) {
        sentence.keyPhrases = [];
      }
    }
  }

  return result;
}

export const SentimentNode: INodeHandler = {
  description,
  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    const provider = (ctx.parameters.provider as string) || 'openai';
    const model = (ctx.parameters.model as string) || (provider === 'openai' ? 'gpt-4o-mini' : 'claude-haiku-4-5-20251001');
    const inputField = (ctx.parameters.inputField as string) || 'text';
    const granularity = (ctx.parameters.granularity as string) || 'document';

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

    const systemPrompt = buildSentimentPrompt(granularity);
    const results: INodeExecutionData[] = [];

    for (const item of ctx.inputData) {
      try {
        const rawText = getNestedValue(item.json, inputField);
        const text = typeof rawText === 'string' ? rawText : String(rawText || '');

        if (!text.trim()) {
          results.push({
            json: {
              ...item.json,
              sentiment: 'neutral',
              confidence: 0,
              keyPhrases: [],
              warning: 'Empty input text',
            },
          });
          continue;
        }

        let sentimentResult: Record<string, unknown>;

        if (provider === 'openai') {
          sentimentResult = await callOpenAISentiment(apiKey, model, systemPrompt, text);
        } else {
          sentimentResult = await callAnthropicSentiment(apiKey, model, systemPrompt, text);
        }

        sentimentResult = validateSentimentResult(sentimentResult);

        if (granularity === 'sentence') {
          const overall = (sentimentResult.overall as Record<string, unknown>) || sentimentResult;
          results.push({
            json: {
              ...item.json,
              sentiment: overall.sentiment || 'neutral',
              confidence: overall.confidence || 0,
              keyPhrases: overall.keyPhrases || [],
              sentences: sentimentResult.sentences || [],
              analysisMetadata: {
                provider,
                model,
                granularity,
              },
            },
          });
        } else {
          results.push({
            json: {
              ...item.json,
              sentiment: sentimentResult.sentiment || 'neutral',
              confidence: sentimentResult.confidence || 0,
              keyPhrases: sentimentResult.keyPhrases || [],
              analysisMetadata: {
                provider,
                model,
                granularity,
              },
            },
          });
        }
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
