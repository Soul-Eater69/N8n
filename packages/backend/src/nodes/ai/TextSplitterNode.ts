import { INodeHandler, INodeExecutionContext } from '../../engine/NodeRegistry';
import { INodeTypeDescription, INodeExecutionResult, INodeExecutionData } from '@flowforge/shared';

const description: INodeTypeDescription = {
  type: 'ai.textSplitter',
  displayName: 'Text Splitter',
  description: 'Splits text into chunks for processing with embeddings or LLMs',
  icon: 'scissors',
  category: 'ai',
  version: 1,
  inputs: [{ name: 'main', type: 'main' }],
  outputs: [{ name: 'main', type: 'main' }],
  properties: [
    {
      name: 'mode',
      displayName: 'Split Mode',
      type: 'options',
      default: 'recursive',
      required: true,
      options: [
        { name: 'Recursive', value: 'recursive', description: 'Recursively splits by paragraphs, lines, words, then characters' },
        { name: 'Character', value: 'character', description: 'Splits by a custom separator' },
        { name: 'Token', value: 'token', description: 'Splits by approximate token count' },
      ],
    },
    {
      name: 'field',
      displayName: 'Input Field',
      type: 'string',
      default: 'text',
      required: true,
      description: 'The field containing the text to split',
    },
    {
      name: 'chunkSize',
      displayName: 'Chunk Size',
      type: 'number',
      default: 1000,
      description: 'Target size for each chunk (in characters or tokens depending on mode)',
    },
    {
      name: 'chunkOverlap',
      displayName: 'Chunk Overlap',
      type: 'number',
      default: 200,
      description: 'Number of characters/tokens to overlap between chunks',
    },
    {
      name: 'separator',
      displayName: 'Separator',
      type: 'string',
      default: '\\n',
      description: 'Custom separator for character split mode',
      displayOptions: {
        show: { mode: ['character'] },
      },
    },
  ],
  color: '#EC4899',
};

function recursiveSplit(text: string, chunkSize: number, chunkOverlap: number): string[] {
  const separators = ['\n\n', '\n', ' ', ''];

  function splitWithSeparators(text: string, separatorIndex: number): string[] {
    if (text.length <= chunkSize) {
      return [text];
    }

    if (separatorIndex >= separators.length) {
      // Last resort: hard split by character
      return hardSplit(text, chunkSize, chunkOverlap);
    }

    const separator = separators[separatorIndex];

    if (separator === '') {
      return hardSplit(text, chunkSize, chunkOverlap);
    }

    const parts = text.split(separator);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const part of parts) {
      const candidate = currentChunk ? currentChunk + separator + part : part;

      if (candidate.length <= chunkSize) {
        currentChunk = candidate;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
        }

        if (part.length > chunkSize) {
          // Part itself is too large, recurse with next separator
          const subChunks = splitWithSeparators(part, separatorIndex + 1);
          chunks.push(...subChunks);
          currentChunk = '';
        } else {
          currentChunk = part;
        }
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  const rawChunks = splitWithSeparators(text, 0);

  // Apply overlap
  if (chunkOverlap <= 0 || rawChunks.length <= 1) {
    return rawChunks;
  }

  const overlappedChunks: string[] = [];
  for (let i = 0; i < rawChunks.length; i++) {
    if (i === 0) {
      overlappedChunks.push(rawChunks[i]);
    } else {
      const prevChunk = rawChunks[i - 1];
      const overlapText = prevChunk.slice(-chunkOverlap);
      overlappedChunks.push(overlapText + rawChunks[i]);
    }
  }

  return overlappedChunks;
}

function characterSplit(text: string, separator: string, chunkSize: number, chunkOverlap: number): string[] {
  // Handle escaped separators
  const actualSeparator = separator
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r');

  const parts = text.split(actualSeparator);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const part of parts) {
    const candidate = currentChunk ? currentChunk + actualSeparator + part : part;

    if (candidate.length <= chunkSize) {
      currentChunk = candidate;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      // If a single part exceeds chunk size, include it as its own chunk
      if (part.length > chunkSize) {
        const subChunks = hardSplit(part, chunkSize, chunkOverlap);
        chunks.push(...subChunks);
        currentChunk = '';
      } else {
        currentChunk = part;
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  // Apply overlap
  if (chunkOverlap <= 0 || chunks.length <= 1) {
    return chunks;
  }

  const overlappedChunks: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    if (i === 0) {
      overlappedChunks.push(chunks[i]);
    } else {
      const prevChunk = chunks[i - 1];
      const overlapText = prevChunk.slice(-chunkOverlap);
      overlappedChunks.push(overlapText + chunks[i]);
    }
  }

  return overlappedChunks;
}

function tokenSplit(text: string, chunkSize: number, chunkOverlap: number): string[] {
  // Approximate: 1 token ~ 0.75 words, so 1 word ~ 1.33 tokens
  // For chunk size in "tokens", convert to approximate word count
  const wordsPerChunk = Math.max(1, Math.floor(chunkSize * 0.75));
  const overlapWords = Math.max(0, Math.floor(chunkOverlap * 0.75));

  const words = text.split(/\s+/).filter((w) => w.length > 0);

  if (words.length <= wordsPerChunk) {
    return [text];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + wordsPerChunk, words.length);
    const chunkWords = words.slice(start, end);
    chunks.push(chunkWords.join(' '));

    if (end >= words.length) break;

    // Move forward by (wordsPerChunk - overlapWords) to create overlap
    const step = Math.max(1, wordsPerChunk - overlapWords);
    start += step;
  }

  return chunks;
}

function hardSplit(text: string, chunkSize: number, chunkOverlap: number): string[] {
  const chunks: string[] = [];
  const step = Math.max(1, chunkSize - chunkOverlap);
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    if (end >= text.length) break;
    start += step;
  }

  return chunks;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((current: any, key) => current?.[key], obj);
}

export const TextSplitterNode: INodeHandler = {
  description,
  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    const mode = (ctx.parameters.mode as string) || 'recursive';
    const field = (ctx.parameters.field as string) || 'text';
    const chunkSize = Number(ctx.parameters.chunkSize ?? 1000);
    const chunkOverlap = Number(ctx.parameters.chunkOverlap ?? 200);
    const separator = (ctx.parameters.separator as string) || '\\n';

    if (chunkSize <= 0) {
      throw new Error('Chunk size must be a positive number');
    }

    if (chunkOverlap < 0) {
      throw new Error('Chunk overlap must be non-negative');
    }

    if (chunkOverlap >= chunkSize) {
      throw new Error('Chunk overlap must be less than chunk size');
    }

    const results: INodeExecutionData[] = [];

    for (const item of ctx.inputData) {
      const rawText = getNestedValue(item.json, field);
      const text = typeof rawText === 'string' ? rawText : String(rawText || '');

      if (!text) {
        results.push({
          json: {
            ...item.json,
            chunks: [],
            chunkCount: 0,
          },
        });
        continue;
      }

      let chunks: string[];

      switch (mode) {
        case 'recursive':
          chunks = recursiveSplit(text, chunkSize, chunkOverlap);
          break;
        case 'character':
          chunks = characterSplit(text, separator, chunkSize, chunkOverlap);
          break;
        case 'token':
          chunks = tokenSplit(text, chunkSize, chunkOverlap);
          break;
        default:
          throw new Error(`Unsupported split mode: ${mode}`);
      }

      // Emit each chunk as a separate output item
      for (let i = 0; i < chunks.length; i++) {
        results.push({
          json: {
            text: chunks[i],
            chunkIndex: i,
            chunkCount: chunks.length,
            originalField: field,
            mode,
            metadata: {
              chunkSize,
              chunkOverlap,
              characterCount: chunks[i].length,
            },
          },
          pairedItem: { item: ctx.inputData.indexOf(item) },
        });
      }
    }

    return { data: [results] };
  },
};
