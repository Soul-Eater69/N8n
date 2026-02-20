import { INodeHandler, INodeExecutionContext } from '../../engine/NodeRegistry';
import { INodeTypeDescription, INodeExecutionResult, INodeExecutionData } from '@flowforge/shared';

const description: INodeTypeDescription = {
  type: 'integration.stripe',
  displayName: 'Stripe',
  description: 'Manage payments, customers, and subscriptions with the Stripe API',
  icon: 'credit-card',
  category: 'integration',
  version: 1,
  inputs: [{ name: 'main', type: 'main' }],
  outputs: [{ name: 'main', type: 'main' }],
  properties: [
    {
      name: 'operation',
      displayName: 'Operation',
      type: 'options',
      default: 'createPaymentIntent',
      required: true,
      options: [
        { name: 'Create Charge', value: 'createCharge', description: 'Create a new charge' },
        { name: 'Create Customer', value: 'createCustomer', description: 'Create a new customer' },
        { name: 'Get Customer', value: 'getCustomer', description: 'Retrieve a customer by ID' },
        { name: 'List Customers', value: 'listCustomers', description: 'List all customers' },
        { name: 'Create Payment Intent', value: 'createPaymentIntent', description: 'Create a payment intent' },
        { name: 'Confirm Payment Intent', value: 'confirmPaymentIntent', description: 'Confirm a payment intent' },
        { name: 'Create Subscription', value: 'createSubscription', description: 'Create a subscription' },
        { name: 'Cancel Subscription', value: 'cancelSubscription', description: 'Cancel a subscription' },
        { name: 'List Payments', value: 'listPayments', description: 'List payment intents' },
        { name: 'Create Refund', value: 'createRefund', description: 'Create a refund for a charge' },
        { name: 'Create Product', value: 'createProduct', description: 'Create a new product' },
        { name: 'Create Price', value: 'createPrice', description: 'Create a price for a product' },
      ],
    },
    {
      name: 'amount',
      displayName: 'Amount',
      type: 'number',
      default: 0,
      description: 'Amount in smallest currency unit (e.g. cents for USD)',
      displayOptions: {
        show: { operation: ['createCharge', 'createPaymentIntent'] },
      },
    },
    {
      name: 'currency',
      displayName: 'Currency',
      type: 'string',
      default: 'usd',
      description: 'Three-letter ISO currency code (e.g. usd, eur)',
      displayOptions: {
        show: { operation: ['createCharge', 'createPaymentIntent'] },
      },
    },
    {
      name: 'customerId',
      displayName: 'Customer ID',
      type: 'string',
      default: '',
      description: 'The Stripe customer ID',
      displayOptions: {
        show: { operation: ['getCustomer', 'createCharge', 'createPaymentIntent', 'createSubscription'] },
      },
    },
    {
      name: 'email',
      displayName: 'Email',
      type: 'string',
      default: '',
      description: 'Customer email address',
      displayOptions: {
        show: { operation: ['createCustomer'] },
      },
    },
    {
      name: 'name',
      displayName: 'Name',
      type: 'string',
      default: '',
      description: 'Customer name',
      displayOptions: {
        show: { operation: ['createCustomer'] },
      },
    },
    {
      name: 'description',
      displayName: 'Description',
      type: 'string',
      default: '',
      description: 'Description for the resource',
      displayOptions: {
        show: { operation: ['createCustomer', 'createCharge', 'createPaymentIntent'] },
      },
    },
    {
      name: 'paymentMethodId',
      displayName: 'Payment Method ID',
      type: 'string',
      default: '',
      description: 'The payment method ID',
      displayOptions: {
        show: { operation: ['createPaymentIntent', 'confirmPaymentIntent'] },
      },
    },
    {
      name: 'paymentIntentId',
      displayName: 'Payment Intent ID',
      type: 'string',
      default: '',
      description: 'The payment intent ID',
      displayOptions: {
        show: { operation: ['confirmPaymentIntent'] },
      },
    },
    {
      name: 'priceId',
      displayName: 'Price ID',
      type: 'string',
      default: '',
      description: 'The Stripe price ID',
      displayOptions: {
        show: { operation: ['createSubscription'] },
      },
    },
    {
      name: 'subscriptionId',
      displayName: 'Subscription ID',
      type: 'string',
      default: '',
      description: 'The Stripe subscription ID',
      displayOptions: {
        show: { operation: ['cancelSubscription'] },
      },
    },
    {
      name: 'chargeId',
      displayName: 'Charge ID',
      type: 'string',
      default: '',
      description: 'The charge ID to refund',
      displayOptions: {
        show: { operation: ['createRefund'] },
      },
    },
    {
      name: 'productName',
      displayName: 'Product Name',
      type: 'string',
      default: '',
      description: 'Name of the product',
      displayOptions: {
        show: { operation: ['createProduct'] },
      },
    },
    {
      name: 'unitAmount',
      displayName: 'Unit Amount',
      type: 'number',
      default: 0,
      description: 'Price per unit in smallest currency unit',
      displayOptions: {
        show: { operation: ['createPrice'] },
      },
    },
    {
      name: 'productId',
      displayName: 'Product ID',
      type: 'string',
      default: '',
      description: 'The product ID to attach the price to',
      displayOptions: {
        show: { operation: ['createPrice'] },
      },
    },
    {
      name: 'recurring',
      displayName: 'Recurring',
      type: 'json',
      default: '{}',
      description: 'Recurring pricing details (e.g. {"interval": "month"})',
      displayOptions: {
        show: { operation: ['createPrice'] },
      },
    },
  ],
  credentials: [{ name: 'stripe', required: true }],
  color: '#635BFF',
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

function encodeFormData(data: Record<string, unknown>, prefix: string = ''): string {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null || value === '') continue;

    const fullKey = prefix ? `${prefix}[${key}]` : key;

    if (typeof value === 'object' && !Array.isArray(value)) {
      parts.push(encodeFormData(value as Record<string, unknown>, fullKey));
    } else if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        if (typeof value[i] === 'object') {
          parts.push(encodeFormData(value[i] as Record<string, unknown>, `${fullKey}[${i}]`));
        } else {
          parts.push(`${encodeURIComponent(`${fullKey}[${i}`)}]=${encodeURIComponent(String(value[i]))}`);
        }
      }
    } else {
      parts.push(`${encodeURIComponent(fullKey)}=${encodeURIComponent(String(value))}`);
    }
  }

  return parts.filter(p => p.length > 0).join('&');
}

async function callStripeApi(
  method: string,
  endpoint: string,
  secretKey: string,
  body?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const url = `https://api.stripe.com/v1/${endpoint}`;

  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  };

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    options.body = encodeFormData(body);
  }

  const response = await fetch(url, options);
  const data = await response.json() as Record<string, unknown>;

  if (!response.ok) {
    const error = data.error as Record<string, unknown> | undefined;
    const message = error?.message || `Stripe API error: ${response.status} ${response.statusText}`;
    throw new Error(String(message));
  }

  return data;
}

export const StripeNode: INodeHandler = {
  description,

  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    const params = ctx.parameters as Record<string, unknown>;
    const credentials = ctx.credentials as Record<string, Record<string, string>>;
    const stripeCreds = credentials.stripe;

    if (!stripeCreds?.secretKey) {
      throw new Error('Stripe secret key is required. Please configure Stripe credentials.');
    }

    const secretKey = stripeCreds.secretKey;
    const operation = params.operation as string;
    const results: INodeExecutionData[] = [];

    for (const item of ctx.inputData) {
      try {
        let responseData: Record<string, unknown>;

        switch (operation) {
          case 'createCharge': {
            responseData = await callStripeApi('POST', 'charges', secretKey, {
              amount: Number(params.amount),
              currency: (params.currency as string) || 'usd',
              customer: params.customerId as string || undefined,
              description: params.description as string || undefined,
            });
            break;
          }

          case 'createCustomer': {
            const body: Record<string, unknown> = {};
            if (params.email) body.email = params.email;
            if (params.name) body.name = params.name;
            if (params.description) body.description = params.description;

            responseData = await callStripeApi('POST', 'customers', secretKey, body);
            break;
          }

          case 'getCustomer': {
            const customerId = params.customerId as string;
            if (!customerId) throw new Error('Customer ID is required');

            responseData = await callStripeApi('GET', `customers/${customerId}`, secretKey);
            break;
          }

          case 'listCustomers': {
            responseData = await callStripeApi('GET', 'customers?limit=100', secretKey);
            break;
          }

          case 'createPaymentIntent': {
            const body: Record<string, unknown> = {
              amount: Number(params.amount),
              currency: (params.currency as string) || 'usd',
            };
            if (params.customerId) body.customer = params.customerId;
            if (params.paymentMethodId) body.payment_method = params.paymentMethodId;
            if (params.description) body.description = params.description;

            responseData = await callStripeApi('POST', 'payment_intents', secretKey, body);
            break;
          }

          case 'confirmPaymentIntent': {
            const paymentIntentId = params.paymentIntentId as string;
            if (!paymentIntentId) throw new Error('Payment Intent ID is required');

            const body: Record<string, unknown> = {};
            if (params.paymentMethodId) body.payment_method = params.paymentMethodId;

            responseData = await callStripeApi('POST', `payment_intents/${paymentIntentId}/confirm`, secretKey, body);
            break;
          }

          case 'createSubscription': {
            const customerId = params.customerId as string;
            const priceId = params.priceId as string;
            if (!customerId) throw new Error('Customer ID is required');
            if (!priceId) throw new Error('Price ID is required');

            responseData = await callStripeApi('POST', 'subscriptions', secretKey, {
              customer: customerId,
              items: [{ price: priceId }],
            });
            break;
          }

          case 'cancelSubscription': {
            const subscriptionId = params.subscriptionId as string;
            if (!subscriptionId) throw new Error('Subscription ID is required');

            responseData = await callStripeApi('DELETE', `subscriptions/${subscriptionId}`, secretKey);
            break;
          }

          case 'listPayments': {
            responseData = await callStripeApi('GET', 'payment_intents?limit=100', secretKey);
            break;
          }

          case 'createRefund': {
            const chargeId = params.chargeId as string;
            if (!chargeId) throw new Error('Charge ID is required');

            const body: Record<string, unknown> = { charge: chargeId };
            if (params.amount) body.amount = Number(params.amount);

            responseData = await callStripeApi('POST', 'refunds', secretKey, body);
            break;
          }

          case 'createProduct': {
            const productName = params.productName as string;
            if (!productName) throw new Error('Product name is required');

            responseData = await callStripeApi('POST', 'products', secretKey, {
              name: productName,
            });
            break;
          }

          case 'createPrice': {
            const productId = params.productId as string;
            if (!productId) throw new Error('Product ID is required');

            const body: Record<string, unknown> = {
              product: productId,
              unit_amount: Number(params.unitAmount),
              currency: (params.currency as string) || 'usd',
            };

            const recurring = parseJsonParam(params.recurring, {}) as Record<string, unknown>;
            if (Object.keys(recurring).length > 0) {
              body.recurring = recurring;
            }

            responseData = await callStripeApi('POST', 'prices', secretKey, body);
            break;
          }

          default:
            throw new Error(`Unsupported Stripe operation: ${operation}`);
        }

        results.push({
          json: {
            success: true,
            operation,
            ...responseData,
          },
          pairedItem: { item: results.length },
        });
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
