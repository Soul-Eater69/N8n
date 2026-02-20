import { INodeHandler, INodeExecutionContext } from '../../engine/NodeRegistry';
import { INodeTypeDescription, INodeExecutionResult, INodeExecutionData } from '@flowforge/shared';
import { createHmac, createHash } from 'crypto';

const description: INodeTypeDescription = {
  type: 'integration.awsS3',
  displayName: 'AWS S3',
  description: 'Manage files and buckets in Amazon S3',
  icon: 'cloud',
  category: 'integration',
  version: 1,
  inputs: [{ name: 'main', type: 'main' }],
  outputs: [{ name: 'main', type: 'main' }],
  properties: [
    {
      name: 'operation',
      displayName: 'Operation',
      type: 'options',
      default: 'listObjects',
      required: true,
      options: [
        { name: 'List Buckets', value: 'listBuckets', description: 'List all S3 buckets' },
        { name: 'List Objects', value: 'listObjects', description: 'List objects in a bucket' },
        { name: 'Get Object', value: 'getObject', description: 'Download an object from a bucket' },
        { name: 'Put Object', value: 'putObject', description: 'Upload an object to a bucket' },
        { name: 'Delete Object', value: 'deleteObject', description: 'Delete an object from a bucket' },
        { name: 'Copy Object', value: 'copyObject', description: 'Copy an object within or between buckets' },
        { name: 'Get Signed URL', value: 'getSignedUrl', description: 'Generate a pre-signed URL for an object' },
      ],
    },
    {
      name: 'bucket',
      displayName: 'Bucket',
      type: 'string',
      default: '',
      description: 'The S3 bucket name',
      displayOptions: {
        show: { operation: ['listObjects', 'getObject', 'putObject', 'deleteObject', 'copyObject', 'getSignedUrl'] },
      },
    },
    {
      name: 'key',
      displayName: 'Key',
      type: 'string',
      default: '',
      description: 'The object key (path/filename)',
      displayOptions: {
        show: { operation: ['getObject', 'putObject', 'deleteObject', 'copyObject', 'getSignedUrl'] },
      },
    },
    {
      name: 'body',
      displayName: 'Body',
      type: 'string',
      default: '',
      description: 'The content to upload',
      displayOptions: {
        show: { operation: ['putObject'] },
      },
    },
    {
      name: 'contentType',
      displayName: 'Content Type',
      type: 'string',
      default: 'application/octet-stream',
      description: 'The MIME type of the object',
      displayOptions: {
        show: { operation: ['putObject'] },
      },
    },
    {
      name: 'acl',
      displayName: 'ACL',
      type: 'options',
      default: 'private',
      description: 'Access control list for the object',
      options: [
        { name: 'Private', value: 'private' },
        { name: 'Public Read', value: 'public-read' },
      ],
      displayOptions: {
        show: { operation: ['putObject'] },
      },
    },
    {
      name: 'sourceKey',
      displayName: 'Source Key',
      type: 'string',
      default: '',
      description: 'The source object key to copy from',
      displayOptions: {
        show: { operation: ['copyObject'] },
      },
    },
    {
      name: 'sourceBucket',
      displayName: 'Source Bucket',
      type: 'string',
      default: '',
      description: 'The source bucket to copy from (defaults to the same bucket)',
      displayOptions: {
        show: { operation: ['copyObject'] },
      },
    },
    {
      name: 'expiresIn',
      displayName: 'Expires In (seconds)',
      type: 'number',
      default: 3600,
      description: 'URL expiration time in seconds',
      displayOptions: {
        show: { operation: ['getSignedUrl'] },
      },
    },
    {
      name: 'prefix',
      displayName: 'Prefix',
      type: 'string',
      default: '',
      description: 'Filter objects by key prefix',
      displayOptions: {
        show: { operation: ['listObjects'] },
      },
    },
    {
      name: 'maxKeys',
      displayName: 'Max Keys',
      type: 'number',
      default: 1000,
      description: 'Maximum number of objects to return',
      displayOptions: {
        show: { operation: ['listObjects'] },
      },
    },
  ],
  credentials: [{ name: 'awsS3', required: true }],
  color: '#FF9900',
};

// --- AWS Signature V4 Implementation ---

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256Hex(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

function getSigningKey(secretKey: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = hmacSha256(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, 'aws4_request');
  return kSigning;
}

function formatDateISO(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function formatDateStamp(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

interface SignedRequestOptions {
  method: string;
  host: string;
  path: string;
  region: string;
  service: string;
  accessKeyId: string;
  secretAccessKey: string;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  body?: string | Buffer;
  isPresigned?: boolean;
  expiresIn?: number;
}

interface SignedRequest {
  url: string;
  headers: Record<string, string>;
}

function createSignedRequest(options: SignedRequestOptions): SignedRequest {
  const {
    method,
    host,
    path,
    region,
    service,
    accessKeyId,
    secretAccessKey,
    headers: extraHeaders = {},
    queryParams = {},
    body = '',
    isPresigned = false,
    expiresIn = 3600,
  } = options;

  const now = new Date();
  const amzDate = formatDateISO(now);
  const dateStamp = formatDateStamp(now);
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  if (isPresigned) {
    // For pre-signed URLs, we put auth info in query params
    const presignedParams: Record<string, string> = {
      ...queryParams,
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${accessKeyId}/${credentialScope}`,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': String(expiresIn),
      'X-Amz-SignedHeaders': 'host',
    };

    // Sort query parameters
    const sortedKeys = Object.keys(presignedParams).sort();
    const canonicalQueryString = sortedKeys
      .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(presignedParams[k])}`)
      .join('&');

    const canonicalHeaders = `host:${host}\n`;
    const signedHeaders = 'host';
    const payloadHash = 'UNSIGNED-PAYLOAD';

    const encodedPath = path.split('/').map(s => encodeURIComponent(s)).join('/');
    const canonicalRequest = [
      method,
      encodedPath || '/',
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      sha256Hex(canonicalRequest),
    ].join('\n');

    const signingKey = getSigningKey(secretAccessKey, dateStamp, region, service);
    const signature = hmacSha256(signingKey, stringToSign).toString('hex');

    const signedUrl = `https://${host}${encodedPath}?${canonicalQueryString}&X-Amz-Signature=${signature}`;

    return {
      url: signedUrl,
      headers: {},
    };
  }

  // Standard signed request
  const payloadHash = sha256Hex(typeof body === 'string' ? body : body);

  const requestHeaders: Record<string, string> = {
    host: host,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
    ...extraHeaders,
  };

  // Build canonical headers (sorted by lowercase key)
  const sortedHeaderKeys = Object.keys(requestHeaders).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const canonicalHeaders = sortedHeaderKeys
    .map(k => `${k.toLowerCase()}:${requestHeaders[k].trim()}`)
    .join('\n') + '\n';
  const signedHeaders = sortedHeaderKeys.map(k => k.toLowerCase()).join(';');

  // Build canonical query string
  const sortedQueryKeys = Object.keys(queryParams).sort();
  const canonicalQueryString = sortedQueryKeys
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`)
    .join('&');

  const encodedPath = path.split('/').map(s => encodeURIComponent(s)).join('/');
  const canonicalRequest = [
    method,
    encodedPath || '/',
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const signingKey = getSigningKey(secretAccessKey, dateStamp, region, service);
  const signature = hmacSha256(signingKey, stringToSign).toString('hex');

  const authorizationHeader = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const finalHeaders: Record<string, string> = {
    ...requestHeaders,
    Authorization: authorizationHeader,
  };
  // Remove host from fetch headers since fetch sets it automatically
  delete finalHeaders.host;

  let url = `https://${host}${encodedPath || '/'}`;
  if (canonicalQueryString) {
    url += `?${canonicalQueryString}`;
  }

  return {
    url,
    headers: finalHeaders,
  };
}

function parseXmlTag(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'g');
  const matches: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    matches.push(match[1]);
  }
  return matches;
}

function parseXmlValue(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`);
  const match = regex.exec(xml);
  return match ? match[1] : null;
}

interface S3BucketInfo {
  name: string;
  creationDate: string;
}

interface S3ObjectInfo {
  key: string;
  lastModified: string;
  size: string;
  storageClass: string;
  etag: string;
}

function parseBucketList(xml: string): S3BucketInfo[] {
  const bucketElements = parseXmlTag(xml, 'Bucket');
  return bucketElements.map(bucket => ({
    name: parseXmlValue(bucket, 'Name') || '',
    creationDate: parseXmlValue(bucket, 'CreationDate') || '',
  }));
}

function parseObjectList(xml: string): S3ObjectInfo[] {
  const objectElements = parseXmlTag(xml, 'Contents');
  return objectElements.map(obj => ({
    key: parseXmlValue(obj, 'Key') || '',
    lastModified: parseXmlValue(obj, 'LastModified') || '',
    size: parseXmlValue(obj, 'Size') || '0',
    storageClass: parseXmlValue(obj, 'StorageClass') || '',
    etag: parseXmlValue(obj, 'ETag') || '',
  }));
}

export const AWSS3Node: INodeHandler = {
  description,

  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    const params = ctx.parameters as Record<string, unknown>;
    const credentials = ctx.credentials as Record<string, Record<string, string>>;
    const awsCreds = credentials.awsS3;

    if (!awsCreds?.accessKeyId || !awsCreds?.secretAccessKey) {
      throw new Error('AWS S3 credentials (accessKeyId and secretAccessKey) are required.');
    }

    const { accessKeyId, secretAccessKey } = awsCreds;
    const region = awsCreds.region || 'us-east-1';
    const operation = params.operation as string;
    const results: INodeExecutionData[] = [];

    for (const item of ctx.inputData) {
      try {
        switch (operation) {
          case 'listBuckets': {
            const host = 's3.amazonaws.com';
            const signed = createSignedRequest({
              method: 'GET',
              host,
              path: '/',
              region,
              service: 's3',
              accessKeyId,
              secretAccessKey,
            });

            const response = await fetch(signed.url, { method: 'GET', headers: signed.headers });
            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`S3 ListBuckets failed: ${response.status} - ${parseXmlValue(errorText, 'Message') || errorText}`);
            }

            const xml = await response.text();
            const buckets = parseBucketList(xml);

            for (const bucket of buckets) {
              results.push({
                json: {
                  success: true,
                  operation,
                  ...bucket,
                },
                pairedItem: { item: results.length },
              });
            }
            if (buckets.length === 0) {
              results.push({
                json: { success: true, operation, buckets: [] },
                pairedItem: { item: results.length },
              });
            }
            break;
          }

          case 'listObjects': {
            const bucket = params.bucket as string;
            if (!bucket) throw new Error('Bucket name is required');

            const host = `${bucket}.s3.${region}.amazonaws.com`;
            const queryParams: Record<string, string> = {
              'list-type': '2',
              'max-keys': String(Number(params.maxKeys) || 1000),
            };
            if (params.prefix) {
              queryParams.prefix = params.prefix as string;
            }

            const signed = createSignedRequest({
              method: 'GET',
              host,
              path: '/',
              region,
              service: 's3',
              accessKeyId,
              secretAccessKey,
              queryParams,
            });

            const response = await fetch(signed.url, { method: 'GET', headers: signed.headers });
            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`S3 ListObjects failed: ${response.status} - ${parseXmlValue(errorText, 'Message') || errorText}`);
            }

            const xml = await response.text();
            const objects = parseObjectList(xml);

            for (const obj of objects) {
              results.push({
                json: {
                  success: true,
                  operation,
                  bucket,
                  ...obj,
                },
                pairedItem: { item: results.length },
              });
            }
            if (objects.length === 0) {
              results.push({
                json: { success: true, operation, bucket, objects: [] },
                pairedItem: { item: results.length },
              });
            }
            break;
          }

          case 'getObject': {
            const bucket = params.bucket as string;
            const key = params.key as string;
            if (!bucket) throw new Error('Bucket name is required');
            if (!key) throw new Error('Object key is required');

            const host = `${bucket}.s3.${region}.amazonaws.com`;
            const signed = createSignedRequest({
              method: 'GET',
              host,
              path: `/${key}`,
              region,
              service: 's3',
              accessKeyId,
              secretAccessKey,
            });

            const response = await fetch(signed.url, { method: 'GET', headers: signed.headers });
            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`S3 GetObject failed: ${response.status} - ${parseXmlValue(errorText, 'Message') || errorText}`);
            }

            const contentType = response.headers.get('content-type') || 'application/octet-stream';
            const contentLength = response.headers.get('content-length') || '0';
            const etag = response.headers.get('etag') || '';
            const lastModified = response.headers.get('last-modified') || '';

            let bodyContent: string;
            if (contentType.startsWith('text/') || contentType.includes('json') || contentType.includes('xml')) {
              bodyContent = await response.text();
            } else {
              const buffer = Buffer.from(await response.arrayBuffer());
              bodyContent = buffer.toString('base64');
            }

            results.push({
              json: {
                success: true,
                operation,
                bucket,
                key,
                contentType,
                contentLength: Number(contentLength),
                etag,
                lastModified,
                body: bodyContent,
              },
              pairedItem: { item: results.length },
            });
            break;
          }

          case 'putObject': {
            const bucket = params.bucket as string;
            const key = params.key as string;
            const body = (params.body as string) || '';
            const contentType = (params.contentType as string) || 'application/octet-stream';
            const acl = (params.acl as string) || 'private';

            if (!bucket) throw new Error('Bucket name is required');
            if (!key) throw new Error('Object key is required');

            const host = `${bucket}.s3.${region}.amazonaws.com`;
            const signed = createSignedRequest({
              method: 'PUT',
              host,
              path: `/${key}`,
              region,
              service: 's3',
              accessKeyId,
              secretAccessKey,
              headers: {
                'content-type': contentType,
                'x-amz-acl': acl,
              },
              body,
            });

            const response = await fetch(signed.url, {
              method: 'PUT',
              headers: signed.headers,
              body,
            });

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`S3 PutObject failed: ${response.status} - ${parseXmlValue(errorText, 'Message') || errorText}`);
            }

            const etag = response.headers.get('etag') || '';

            results.push({
              json: {
                success: true,
                operation,
                bucket,
                key,
                etag,
                contentType,
                size: body.length,
              },
              pairedItem: { item: results.length },
            });
            break;
          }

          case 'deleteObject': {
            const bucket = params.bucket as string;
            const key = params.key as string;
            if (!bucket) throw new Error('Bucket name is required');
            if (!key) throw new Error('Object key is required');

            const host = `${bucket}.s3.${region}.amazonaws.com`;
            const signed = createSignedRequest({
              method: 'DELETE',
              host,
              path: `/${key}`,
              region,
              service: 's3',
              accessKeyId,
              secretAccessKey,
            });

            const response = await fetch(signed.url, { method: 'DELETE', headers: signed.headers });
            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`S3 DeleteObject failed: ${response.status} - ${parseXmlValue(errorText, 'Message') || errorText}`);
            }

            results.push({
              json: {
                success: true,
                operation,
                bucket,
                key,
                deleted: true,
              },
              pairedItem: { item: results.length },
            });
            break;
          }

          case 'copyObject': {
            const bucket = params.bucket as string;
            const key = params.key as string;
            const sourceKey = params.sourceKey as string;
            const sourceBucket = (params.sourceBucket as string) || bucket;

            if (!bucket) throw new Error('Destination bucket is required');
            if (!key) throw new Error('Destination key is required');
            if (!sourceKey) throw new Error('Source key is required');

            const host = `${bucket}.s3.${region}.amazonaws.com`;
            const copySource = `/${sourceBucket}/${sourceKey}`;

            const signed = createSignedRequest({
              method: 'PUT',
              host,
              path: `/${key}`,
              region,
              service: 's3',
              accessKeyId,
              secretAccessKey,
              headers: {
                'x-amz-copy-source': copySource,
              },
              body: '',
            });

            const response = await fetch(signed.url, { method: 'PUT', headers: signed.headers });
            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`S3 CopyObject failed: ${response.status} - ${parseXmlValue(errorText, 'Message') || errorText}`);
            }

            const xml = await response.text();
            const etag = parseXmlValue(xml, 'ETag') || '';
            const lastModified = parseXmlValue(xml, 'LastModified') || '';

            results.push({
              json: {
                success: true,
                operation,
                sourceBucket,
                sourceKey,
                destinationBucket: bucket,
                destinationKey: key,
                etag,
                lastModified,
              },
              pairedItem: { item: results.length },
            });
            break;
          }

          case 'getSignedUrl': {
            const bucket = params.bucket as string;
            const key = params.key as string;
            const expiresIn = Number(params.expiresIn) || 3600;

            if (!bucket) throw new Error('Bucket name is required');
            if (!key) throw new Error('Object key is required');

            const host = `${bucket}.s3.${region}.amazonaws.com`;
            const signed = createSignedRequest({
              method: 'GET',
              host,
              path: `/${key}`,
              region,
              service: 's3',
              accessKeyId,
              secretAccessKey,
              isPresigned: true,
              expiresIn,
            });

            results.push({
              json: {
                success: true,
                operation,
                bucket,
                key,
                url: signed.url,
                expiresIn,
              },
              pairedItem: { item: results.length },
            });
            break;
          }

          default:
            throw new Error(`Unsupported S3 operation: ${operation}`);
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
  },
};
