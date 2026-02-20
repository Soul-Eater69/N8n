import { INodeHandler, INodeExecutionContext } from '../../engine/NodeRegistry';
import { INodeTypeDescription, INodeExecutionResult, INodeExecutionData } from '@flowforge/shared';
import * as crypto from 'crypto';

const description: INodeTypeDescription = {
  type: 'utility.crypto',
  displayName: 'Crypto',
  description: 'Performs cryptographic operations including hashing, HMAC, encryption, decryption, signing, and random generation',
  icon: 'lock',
  category: 'utility',
  version: 1,
  inputs: [{ name: 'main', type: 'main' }],
  outputs: [{ name: 'main', type: 'main' }],
  properties: [
    {
      name: 'operation',
      displayName: 'Operation',
      type: 'options',
      default: 'hash',
      required: true,
      options: [
        { name: 'Hash', value: 'hash', description: 'Create a hash digest of a value' },
        { name: 'HMAC', value: 'hmac', description: 'Create an HMAC of a value' },
        { name: 'Encrypt', value: 'encrypt', description: 'Encrypt a value using AES' },
        { name: 'Decrypt', value: 'decrypt', description: 'Decrypt a value encrypted with AES' },
        { name: 'Sign', value: 'sign', description: 'Create a digital signature' },
        { name: 'Verify', value: 'verify', description: 'Verify a digital signature' },
        { name: 'Random Bytes', value: 'randomBytes', description: 'Generate cryptographically secure random bytes' },
        { name: 'UUID', value: 'uuid', description: 'Generate a random UUID v4' },
      ],
    },
    {
      name: 'algorithm',
      displayName: 'Algorithm',
      type: 'options',
      default: 'sha256',
      options: [
        { name: 'SHA-256', value: 'sha256' },
        { name: 'SHA-512', value: 'sha512' },
        { name: 'MD5', value: 'md5' },
        { name: 'SHA-1', value: 'sha1' },
        { name: 'SHA-384', value: 'sha384' },
      ],
      displayOptions: {
        show: {
          operation: ['hash', 'hmac', 'sign', 'verify'],
        },
      },
    },
    {
      name: 'inputField',
      displayName: 'Input Field',
      type: 'string',
      default: 'data',
      description: 'The field containing the data to process',
      displayOptions: {
        hide: {
          operation: ['randomBytes', 'uuid'],
        },
      },
    },
    {
      name: 'outputField',
      displayName: 'Output Field',
      type: 'string',
      default: 'result',
      description: 'The field to store the result in',
    },
    {
      name: 'key',
      displayName: 'Key / Secret',
      type: 'string',
      default: '',
      description: 'The secret key for HMAC, encryption key for AES, or private/public key for sign/verify',
      displayOptions: {
        show: {
          operation: ['hmac', 'encrypt', 'decrypt', 'sign', 'verify'],
        },
      },
    },
    {
      name: 'encoding',
      displayName: 'Output Encoding',
      type: 'options',
      default: 'hex',
      options: [
        { name: 'Hex', value: 'hex' },
        { name: 'Base64', value: 'base64' },
        { name: 'UTF-8', value: 'utf8' },
      ],
    },
    {
      name: 'iv',
      displayName: 'Initialization Vector (IV)',
      type: 'string',
      default: '',
      description: 'The IV for AES encryption/decryption. If empty, a random IV is generated for encryption and prepended to the output.',
      displayOptions: {
        show: {
          operation: ['encrypt', 'decrypt'],
        },
      },
    },
    {
      name: 'signatureField',
      displayName: 'Signature Field',
      type: 'string',
      default: 'signature',
      description: 'The field containing or to store the signature',
      displayOptions: {
        show: {
          operation: ['sign', 'verify'],
        },
      },
    },
    {
      name: 'byteLength',
      displayName: 'Byte Length',
      type: 'number',
      default: 32,
      description: 'Number of random bytes to generate',
      displayOptions: {
        show: {
          operation: ['randomBytes'],
        },
      },
    },
  ],
  color: '#2D3436',
  subtitle: '={{$parameter["operation"]}}',
};

/**
 * Gets a nested value from an object using dot notation.
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((current: any, key) => {
    if (current === null || current === undefined) return undefined;
    return current[key];
  }, obj);
}

/**
 * Sets a nested value in an object using dot notation.
 */
function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  let current: any = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in current) || typeof current[keys[i]] !== 'object' || current[keys[i]] === null) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
}

/**
 * Ensures the encryption key is exactly 32 bytes for AES-256.
 * Pads with zeros or truncates as needed.
 */
function normalizeKey(key: string): Buffer {
  const keyBuffer = Buffer.from(key, 'utf8');
  if (keyBuffer.length === 32) return keyBuffer;
  if (keyBuffer.length > 32) return keyBuffer.subarray(0, 32);
  // Pad with SHA-256 hash to get consistent 32 bytes
  return crypto.createHash('sha256').update(key).digest();
}

export const CryptoNode: INodeHandler = {
  description,

  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    const operation = (ctx.parameters.operation as string) || 'hash';
    const algorithm = (ctx.parameters.algorithm as string) || 'sha256';
    const inputField = (ctx.parameters.inputField as string) || 'data';
    const outputField = (ctx.parameters.outputField as string) || 'result';
    const key = (ctx.parameters.key as string) || '';
    const encoding = (ctx.parameters.encoding as BufferEncoding) || 'hex';
    const ivParam = (ctx.parameters.iv as string) || '';
    const signatureField = (ctx.parameters.signatureField as string) || 'signature';
    const byteLength = (ctx.parameters.byteLength as number) || 32;

    const outputItems: INodeExecutionData[] = [];

    for (const item of ctx.inputData) {
      const newJson = { ...item.json };

      switch (operation) {
        case 'hash': {
          const rawValue = getNestedValue(item.json, inputField);
          const input = rawValue !== undefined && rawValue !== null
            ? typeof rawValue === 'string'
              ? rawValue
              : JSON.stringify(rawValue)
            : '';

          const hash = crypto
            .createHash(algorithm)
            .update(input, 'utf8')
            .digest(encoding as any);

          setNestedValue(newJson, outputField, hash);
          break;
        }

        case 'hmac': {
          if (!key) {
            throw new Error('A key/secret is required for HMAC operation');
          }

          const rawValue = getNestedValue(item.json, inputField);
          const input = rawValue !== undefined && rawValue !== null
            ? typeof rawValue === 'string'
              ? rawValue
              : JSON.stringify(rawValue)
            : '';

          const hmac = crypto
            .createHmac(algorithm, key)
            .update(input, 'utf8')
            .digest(encoding as any);

          setNestedValue(newJson, outputField, hmac);
          break;
        }

        case 'encrypt': {
          if (!key) {
            throw new Error('An encryption key is required for encrypt operation');
          }

          const rawValue = getNestedValue(item.json, inputField);
          const plaintext = rawValue !== undefined && rawValue !== null
            ? typeof rawValue === 'string'
              ? rawValue
              : JSON.stringify(rawValue)
            : '';

          const keyBuffer = normalizeKey(key);
          let iv: Buffer;

          if (ivParam) {
            iv = Buffer.from(ivParam, 'hex');
            if (iv.length !== 16) {
              throw new Error('IV must be 16 bytes (32 hex characters) for AES-256-CBC');
            }
          } else {
            iv = crypto.randomBytes(16);
          }

          const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
          let encrypted = cipher.update(plaintext, 'utf8', encoding as any);
          encrypted += cipher.final(encoding as any);

          // If no IV was provided, prepend the random IV to the output
          // so it can be extracted during decryption
          if (!ivParam) {
            const ivString = iv.toString('hex');
            setNestedValue(newJson, outputField, `${ivString}:${encrypted}`);
          } else {
            setNestedValue(newJson, outputField, encrypted);
          }
          break;
        }

        case 'decrypt': {
          if (!key) {
            throw new Error('A decryption key is required for decrypt operation');
          }

          const rawValue = getNestedValue(item.json, inputField);
          if (rawValue === undefined || rawValue === null) {
            setNestedValue(newJson, outputField, null);
            break;
          }

          const encryptedString = String(rawValue);
          const keyBuffer = normalizeKey(key);
          let iv: Buffer;
          let encryptedData: string;

          if (ivParam) {
            iv = Buffer.from(ivParam, 'hex');
            encryptedData = encryptedString;
          } else {
            // Extract the prepended IV
            const parts = encryptedString.split(':');
            if (parts.length < 2) {
              throw new Error(
                'Encrypted data must include prepended IV (format: "iv:ciphertext") ' +
                'or provide IV separately'
              );
            }
            iv = Buffer.from(parts[0], 'hex');
            encryptedData = parts.slice(1).join(':');
          }

          if (iv.length !== 16) {
            throw new Error('IV must be 16 bytes for AES-256-CBC');
          }

          const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);
          let decrypted = decipher.update(encryptedData, encoding as any, 'utf8');
          decrypted += decipher.final('utf8');

          // Try to parse as JSON if it looks like it
          let result: unknown = decrypted;
          if (
            (decrypted.startsWith('{') && decrypted.endsWith('}')) ||
            (decrypted.startsWith('[') && decrypted.endsWith(']'))
          ) {
            try {
              result = JSON.parse(decrypted);
            } catch {
              // Keep as string
            }
          }

          setNestedValue(newJson, outputField, result);
          break;
        }

        case 'sign': {
          if (!key) {
            throw new Error('A private key is required for sign operation');
          }

          const rawValue = getNestedValue(item.json, inputField);
          const input = rawValue !== undefined && rawValue !== null
            ? typeof rawValue === 'string'
              ? rawValue
              : JSON.stringify(rawValue)
            : '';

          const signer = crypto.createSign(algorithm);
          signer.update(input);
          signer.end();

          const signature = signer.sign(key, encoding as any);
          setNestedValue(newJson, signatureField, signature);
          setNestedValue(newJson, outputField, input);
          break;
        }

        case 'verify': {
          if (!key) {
            throw new Error('A public key is required for verify operation');
          }

          const rawValue = getNestedValue(item.json, inputField);
          const input = rawValue !== undefined && rawValue !== null
            ? typeof rawValue === 'string'
              ? rawValue
              : JSON.stringify(rawValue)
            : '';

          const signatureValue = getNestedValue(item.json, signatureField);
          if (!signatureValue) {
            throw new Error(`Signature field "${signatureField}" is empty or missing`);
          }

          const verifier = crypto.createVerify(algorithm);
          verifier.update(input);
          verifier.end();

          const isValid = verifier.verify(
            key,
            String(signatureValue),
            encoding as any
          );

          setNestedValue(newJson, outputField, isValid);
          break;
        }

        case 'randomBytes': {
          const safeLength = Math.min(Math.max(1, byteLength), 1024);
          const bytes = crypto.randomBytes(safeLength);

          setNestedValue(newJson, outputField, bytes.toString(encoding as any));
          break;
        }

        case 'uuid': {
          setNestedValue(newJson, outputField, crypto.randomUUID());
          break;
        }

        default:
          throw new Error(`Unknown crypto operation: ${operation}`);
      }

      outputItems.push({ json: newJson, binary: item.binary });
    }

    return { data: [outputItems] };
  },
};
