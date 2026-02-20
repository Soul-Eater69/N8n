import { INodeHandler, INodeExecutionContext } from '../../engine/NodeRegistry';
import { INodeTypeDescription, INodeExecutionResult, INodeExecutionData } from '@flowforge/shared';

const description: INodeTypeDescription = {
  type: 'integration.mongodb',
  displayName: 'MongoDB',
  description: 'Perform operations on MongoDB collections',
  icon: 'database',
  category: 'integration',
  version: 1,
  inputs: [{ name: 'main', type: 'main' }],
  outputs: [{ name: 'main', type: 'main' }],
  properties: [
    {
      name: 'operation',
      displayName: 'Operation',
      type: 'options',
      default: 'find',
      required: true,
      options: [
        { name: 'Find', value: 'find', description: 'Find documents matching a filter' },
        { name: 'Insert One', value: 'insertOne', description: 'Insert a single document' },
        { name: 'Insert Many', value: 'insertMany', description: 'Insert multiple documents' },
        { name: 'Update One', value: 'updateOne', description: 'Update a single document' },
        { name: 'Update Many', value: 'updateMany', description: 'Update multiple documents' },
        { name: 'Delete One', value: 'deleteOne', description: 'Delete a single document' },
        { name: 'Delete Many', value: 'deleteMany', description: 'Delete multiple documents' },
        { name: 'Aggregate', value: 'aggregate', description: 'Run an aggregation pipeline' },
        { name: 'Count Documents', value: 'countDocuments', description: 'Count documents matching a filter' },
      ],
    },
    {
      name: 'database',
      displayName: 'Database',
      type: 'string',
      default: '',
      required: true,
      description: 'The MongoDB database name',
    },
    {
      name: 'collection',
      displayName: 'Collection',
      type: 'string',
      default: '',
      required: true,
      description: 'The MongoDB collection name',
    },
    {
      name: 'filter',
      displayName: 'Filter',
      type: 'json',
      default: '{}',
      description: 'Query filter as JSON object',
      displayOptions: {
        show: { operation: ['find', 'updateOne', 'updateMany', 'deleteOne', 'deleteMany', 'countDocuments'] },
      },
    },
    {
      name: 'document',
      displayName: 'Document',
      type: 'json',
      default: '{}',
      description: 'Document to insert (JSON object or array for insertMany)',
      displayOptions: {
        show: { operation: ['insertOne', 'insertMany'] },
      },
    },
    {
      name: 'update',
      displayName: 'Update',
      type: 'json',
      default: '{}',
      description: 'Update operations (e.g. {"$set": {"field": "value"}})',
      displayOptions: {
        show: { operation: ['updateOne', 'updateMany'] },
      },
    },
    {
      name: 'pipeline',
      displayName: 'Pipeline',
      type: 'json',
      default: '[]',
      description: 'Aggregation pipeline as JSON array',
      displayOptions: {
        show: { operation: ['aggregate'] },
      },
    },
    {
      name: 'sort',
      displayName: 'Sort',
      type: 'json',
      default: '{}',
      description: 'Sort order as JSON object (e.g. {"createdAt": -1})',
      displayOptions: {
        show: { operation: ['find'] },
      },
    },
    {
      name: 'limit',
      displayName: 'Limit',
      type: 'number',
      default: 100,
      description: 'Maximum number of documents to return',
      displayOptions: {
        show: { operation: ['find'] },
      },
    },
    {
      name: 'skip',
      displayName: 'Skip',
      type: 'number',
      default: 0,
      description: 'Number of documents to skip',
      displayOptions: {
        show: { operation: ['find'] },
      },
    },
    {
      name: 'projection',
      displayName: 'Projection',
      type: 'json',
      default: '{}',
      description: 'Fields to include or exclude (e.g. {"name": 1, "email": 1})',
      displayOptions: {
        show: { operation: ['find'] },
      },
    },
  ],
  credentials: [{ name: 'mongodb', required: true }],
  color: '#47A248',
};

function parseJsonParam(value: unknown, fallback: unknown): unknown {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
}

export const MongoDBNode: INodeHandler = {
  description,

  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    const params = ctx.parameters as Record<string, unknown>;
    const credentials = ctx.credentials as Record<string, Record<string, unknown>>;
    const mongoCreds = credentials.mongodb;

    if (!mongoCreds) {
      throw new Error('MongoDB credentials are required. Please configure mongodb credentials.');
    }

    const connectionString = mongoCreds.connectionString as string;
    if (!connectionString) {
      throw new Error('MongoDB connection string is required in credentials.');
    }

    const { MongoClient } = await import('mongodb');

    const client = new MongoClient(connectionString);

    try {
      await client.connect();

      const operation = params.operation as string;
      const databaseName = params.database as string;
      const collectionName = params.collection as string;

      if (!databaseName) throw new Error('Database name is required');
      if (!collectionName) throw new Error('Collection name is required');

      const db = client.db(databaseName);
      const collection = db.collection(collectionName);

      const results: INodeExecutionData[] = [];

      for (const item of ctx.inputData) {
        try {
          switch (operation) {
            case 'find': {
              const filter = parseJsonParam(params.filter, {}) as Record<string, unknown>;
              const sort = parseJsonParam(params.sort, {}) as Record<string, unknown>;
              const projection = parseJsonParam(params.projection, {}) as Record<string, unknown>;
              const limit = Number(params.limit) || 100;
              const skip = Number(params.skip) || 0;

              const documents = await collection
                .find(filter)
                .sort(sort as any)
                .skip(skip)
                .limit(limit)
                .project(projection)
                .toArray();

              for (const doc of documents) {
                const jsonDoc: Record<string, unknown> = { ...doc };
                if (jsonDoc._id) {
                  jsonDoc._id = String(jsonDoc._id);
                }
                results.push({
                  json: {
                    success: true,
                    operation,
                    ...jsonDoc,
                  },
                  pairedItem: { item: results.length },
                });
              }

              if (documents.length === 0) {
                results.push({
                  json: {
                    success: true,
                    operation,
                    count: 0,
                    documents: [],
                  },
                  pairedItem: { item: results.length },
                });
              }
              break;
            }

            case 'insertOne': {
              const document = parseJsonParam(params.document, {}) as Record<string, unknown>;
              if (Object.keys(document).length === 0) {
                throw new Error('Document is required for insertOne operation');
              }

              const result = await collection.insertOne(document);
              results.push({
                json: {
                  success: true,
                  operation,
                  insertedId: String(result.insertedId),
                  acknowledged: result.acknowledged,
                },
                pairedItem: { item: results.length },
              });
              break;
            }

            case 'insertMany': {
              const documents = parseJsonParam(params.document, []) as Record<string, unknown>[];
              if (!Array.isArray(documents) || documents.length === 0) {
                throw new Error('An array of documents is required for insertMany operation');
              }

              const result = await collection.insertMany(documents);
              const insertedIds: Record<string, string> = {};
              for (const [key, value] of Object.entries(result.insertedIds)) {
                insertedIds[key] = String(value);
              }

              results.push({
                json: {
                  success: true,
                  operation,
                  insertedCount: result.insertedCount,
                  insertedIds,
                  acknowledged: result.acknowledged,
                },
                pairedItem: { item: results.length },
              });
              break;
            }

            case 'updateOne': {
              const filter = parseJsonParam(params.filter, {}) as Record<string, unknown>;
              const update = parseJsonParam(params.update, {}) as Record<string, unknown>;
              if (Object.keys(update).length === 0) {
                throw new Error('Update is required for updateOne operation');
              }

              const result = await collection.updateOne(filter, update);
              results.push({
                json: {
                  success: true,
                  operation,
                  matchedCount: result.matchedCount,
                  modifiedCount: result.modifiedCount,
                  upsertedId: result.upsertedId ? String(result.upsertedId) : null,
                  acknowledged: result.acknowledged,
                },
                pairedItem: { item: results.length },
              });
              break;
            }

            case 'updateMany': {
              const filter = parseJsonParam(params.filter, {}) as Record<string, unknown>;
              const update = parseJsonParam(params.update, {}) as Record<string, unknown>;
              if (Object.keys(update).length === 0) {
                throw new Error('Update is required for updateMany operation');
              }

              const result = await collection.updateMany(filter, update);
              results.push({
                json: {
                  success: true,
                  operation,
                  matchedCount: result.matchedCount,
                  modifiedCount: result.modifiedCount,
                  upsertedId: result.upsertedId ? String(result.upsertedId) : null,
                  acknowledged: result.acknowledged,
                },
                pairedItem: { item: results.length },
              });
              break;
            }

            case 'deleteOne': {
              const filter = parseJsonParam(params.filter, {}) as Record<string, unknown>;

              const result = await collection.deleteOne(filter);
              results.push({
                json: {
                  success: true,
                  operation,
                  deletedCount: result.deletedCount,
                  acknowledged: result.acknowledged,
                },
                pairedItem: { item: results.length },
              });
              break;
            }

            case 'deleteMany': {
              const filter = parseJsonParam(params.filter, {}) as Record<string, unknown>;

              const result = await collection.deleteMany(filter);
              results.push({
                json: {
                  success: true,
                  operation,
                  deletedCount: result.deletedCount,
                  acknowledged: result.acknowledged,
                },
                pairedItem: { item: results.length },
              });
              break;
            }

            case 'aggregate': {
              const pipeline = parseJsonParam(params.pipeline, []) as Record<string, unknown>[];
              if (!Array.isArray(pipeline)) {
                throw new Error('Pipeline must be a JSON array for aggregate operation');
              }

              const documents = await collection.aggregate(pipeline).toArray();

              for (const doc of documents) {
                const jsonDoc: Record<string, unknown> = { ...doc };
                if (jsonDoc._id) {
                  jsonDoc._id = String(jsonDoc._id);
                }
                results.push({
                  json: {
                    success: true,
                    operation,
                    ...jsonDoc,
                  },
                  pairedItem: { item: results.length },
                });
              }

              if (documents.length === 0) {
                results.push({
                  json: {
                    success: true,
                    operation,
                    count: 0,
                    documents: [],
                  },
                  pairedItem: { item: results.length },
                });
              }
              break;
            }

            case 'countDocuments': {
              const filter = parseJsonParam(params.filter, {}) as Record<string, unknown>;

              const count = await collection.countDocuments(filter);
              results.push({
                json: {
                  success: true,
                  operation,
                  count,
                },
                pairedItem: { item: results.length },
              });
              break;
            }

            default:
              throw new Error(`Unsupported MongoDB operation: ${operation}`);
          }
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
    } finally {
      await client.close().catch(() => {});
    }
  },
};
