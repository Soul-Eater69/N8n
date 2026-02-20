import { INodeHandler, INodeExecutionContext } from '../../engine/NodeRegistry';
import { INodeTypeDescription, INodeExecutionResult, INodeExecutionData } from '@flowforge/shared';

const description: INodeTypeDescription = {
  type: 'ai.vectorStore',
  displayName: 'Vector Store',
  description: 'Store, query, and delete vector embeddings with cosine similarity search',
  icon: 'database',
  category: 'ai',
  version: 1,
  inputs: [{ name: 'main', type: 'main' }],
  outputs: [{ name: 'main', type: 'main' }],
  properties: [
    {
      name: 'operation',
      displayName: 'Operation',
      type: 'options',
      default: 'insert',
      required: true,
      options: [
        { name: 'Insert', value: 'insert', description: 'Insert embeddings into the store' },
        { name: 'Query', value: 'query', description: 'Query similar vectors using cosine similarity' },
        { name: 'Delete', value: 'delete', description: 'Delete entries by ID' },
      ],
    },
    {
      name: 'collection',
      displayName: 'Collection',
      type: 'string',
      default: 'default',
      required: true,
      description: 'The name of the vector collection',
    },
    {
      name: 'embeddingField',
      displayName: 'Embedding Field',
      type: 'string',
      default: 'embedding',
      description: 'The field containing the embedding vector',
      displayOptions: {
        show: { operation: ['insert', 'query'] },
      },
    },
    {
      name: 'metadataFields',
      displayName: 'Metadata Fields',
      type: 'string',
      default: '',
      description: 'Comma-separated list of fields to store as metadata alongside the vector',
      displayOptions: {
        show: { operation: ['insert'] },
      },
    },
    {
      name: 'topK',
      displayName: 'Top K',
      type: 'number',
      default: 5,
      description: 'Number of most similar results to return',
      displayOptions: {
        show: { operation: ['query'] },
      },
    },
    {
      name: 'queryText',
      displayName: 'Query Text',
      type: 'string',
      default: '',
      description: 'Optional query text for reference (the actual query uses the embedding)',
      displayOptions: {
        show: { operation: ['query'] },
      },
    },
    {
      name: 'idField',
      displayName: 'ID Field',
      type: 'string',
      default: 'id',
      description: 'The field containing the document ID',
      displayOptions: {
        show: { operation: ['insert', 'delete'] },
      },
    },
  ],
  color: '#14B8A6',
};

interface VectorEntry {
  id: string;
  embedding: number[];
  metadata: Record<string, unknown>;
  text?: string;
}

// In-memory vector store, keyed by collection name
const vectorStore = new Map<string, Map<string, VectorEntry>>();

function getCollection(collectionName: string): Map<string, VectorEntry> {
  if (!vectorStore.has(collectionName)) {
    vectorStore.set(collectionName, new Map());
  }
  return vectorStore.get(collectionName)!;
}

function dotProduct(a: number[], b: number[]): number {
  let sum = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

function magnitude(v: number[]): number {
  let sum = 0;
  for (let i = 0; i < v.length; i++) {
    sum += v[i] * v[i];
  }
  return Math.sqrt(sum);
}

function cosineSimilarity(a: number[], b: number[]): number {
  const magA = magnitude(a);
  const magB = magnitude(b);

  if (magA === 0 || magB === 0) {
    return 0;
  }

  return dotProduct(a, b) / (magA * magB);
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((current: any, key) => current?.[key], obj);
}

export const VectorStoreNode: INodeHandler = {
  description,
  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    const operation = (ctx.parameters.operation as string) || 'insert';
    const collectionName = (ctx.parameters.collection as string) || 'default';
    const collection = getCollection(collectionName);

    const results: INodeExecutionData[] = [];

    switch (operation) {
      case 'insert': {
        const embeddingField = (ctx.parameters.embeddingField as string) || 'embedding';
        const metadataFieldsStr = (ctx.parameters.metadataFields as string) || '';
        const idField = (ctx.parameters.idField as string) || 'id';
        const metadataFieldNames = metadataFieldsStr
          .split(',')
          .map((f) => f.trim())
          .filter((f) => f.length > 0);

        let insertedCount = 0;

        for (const item of ctx.inputData) {
          const embedding = getNestedValue(item.json, embeddingField) as number[];
          if (!embedding || !Array.isArray(embedding)) {
            results.push({
              json: {
                error: true,
                message: `No valid embedding found in field '${embeddingField}'`,
                ...item.json,
              },
            });
            continue;
          }

          const id = (getNestedValue(item.json, idField) as string) || `vec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

          const metadata: Record<string, unknown> = {};
          for (const fieldName of metadataFieldNames) {
            const value = getNestedValue(item.json, fieldName);
            if (value !== undefined) {
              metadata[fieldName] = value;
            }
          }

          const entry: VectorEntry = {
            id,
            embedding,
            metadata,
            text: (item.json.text as string) || undefined,
          };

          collection.set(id, entry);
          insertedCount++;

          results.push({
            json: {
              id,
              collection: collectionName,
              dimensions: embedding.length,
              metadata,
              operation: 'inserted',
            },
          });
        }

        return {
          data: [results],
          metadata: {
            insertedCount,
            collectionSize: collection.size,
          },
        };
      }

      case 'query': {
        const embeddingField = (ctx.parameters.embeddingField as string) || 'embedding';
        const topK = Number(ctx.parameters.topK ?? 5);
        const queryText = (ctx.parameters.queryText as string) || '';

        for (const item of ctx.inputData) {
          const queryEmbedding = getNestedValue(item.json, embeddingField) as number[];
          if (!queryEmbedding || !Array.isArray(queryEmbedding)) {
            results.push({
              json: {
                error: true,
                message: `No valid query embedding found in field '${embeddingField}'`,
                ...item.json,
              },
            });
            continue;
          }

          if (collection.size === 0) {
            results.push({
              json: {
                matches: [],
                matchCount: 0,
                collection: collectionName,
                queryText,
              },
            });
            continue;
          }

          // Compute cosine similarity against all entries in the collection
          const scoredEntries: Array<{ entry: VectorEntry; score: number }> = [];

          for (const entry of collection.values()) {
            const score = cosineSimilarity(queryEmbedding, entry.embedding);
            scoredEntries.push({ entry, score });
          }

          // Sort by score descending
          scoredEntries.sort((a, b) => b.score - a.score);

          // Take top K
          const topResults = scoredEntries.slice(0, topK);

          const matches = topResults.map((result) => ({
            id: result.entry.id,
            score: result.score,
            text: result.entry.text || null,
            metadata: result.entry.metadata,
          }));

          results.push({
            json: {
              matches,
              matchCount: matches.length,
              collection: collectionName,
              queryText,
              totalVectors: collection.size,
            },
          });
        }

        return { data: [results] };
      }

      case 'delete': {
        const idField = (ctx.parameters.idField as string) || 'id';
        let deletedCount = 0;

        for (const item of ctx.inputData) {
          const id = getNestedValue(item.json, idField) as string;
          if (!id) {
            results.push({
              json: {
                error: true,
                message: `No ID found in field '${idField}'`,
                ...item.json,
              },
            });
            continue;
          }

          const existed = collection.has(id);
          if (existed) {
            collection.delete(id);
            deletedCount++;
          }

          results.push({
            json: {
              id,
              deleted: existed,
              collection: collectionName,
            },
          });
        }

        return {
          data: [results],
          metadata: {
            deletedCount,
            collectionSize: collection.size,
          },
        };
      }

      default:
        throw new Error(`Unsupported vector store operation: ${operation}`);
    }
  },
};
