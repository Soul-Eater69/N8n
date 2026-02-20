import { INodeHandler, INodeExecutionContext } from '../../engine/NodeRegistry';
import { INodeTypeDescription, INodeExecutionResult, INodeExecutionData } from '@flowforge/shared';

const description: INodeTypeDescription = {
  type: 'integration.hubspot',
  displayName: 'HubSpot',
  description: 'Manage contacts, deals, companies, and tickets in HubSpot CRM',
  icon: 'users',
  category: 'integration',
  version: 1,
  inputs: [{ name: 'main', type: 'main' }],
  outputs: [{ name: 'main', type: 'main' }],
  properties: [
    {
      name: 'operation',
      displayName: 'Operation',
      type: 'options',
      default: 'createContact',
      required: true,
      options: [
        { name: 'Create Contact', value: 'createContact', description: 'Create a new contact' },
        { name: 'Get Contact', value: 'getContact', description: 'Get a contact by ID' },
        { name: 'Update Contact', value: 'updateContact', description: 'Update a contact' },
        { name: 'List Contacts', value: 'listContacts', description: 'List all contacts' },
        { name: 'Search Contacts', value: 'searchContacts', description: 'Search contacts with filters' },
        { name: 'Create Deal', value: 'createDeal', description: 'Create a new deal' },
        { name: 'Get Deal', value: 'getDeal', description: 'Get a deal by ID' },
        { name: 'Update Deal', value: 'updateDeal', description: 'Update a deal' },
        { name: 'List Deals', value: 'listDeals', description: 'List all deals' },
        { name: 'Create Company', value: 'createCompany', description: 'Create a new company' },
        { name: 'Get Company', value: 'getCompany', description: 'Get a company by ID' },
      ],
    },
    {
      name: 'contactId',
      displayName: 'Contact ID',
      type: 'string',
      default: '',
      description: 'The HubSpot contact ID',
      displayOptions: { show: { operation: ['getContact', 'updateContact'] } },
    },
    {
      name: 'dealId',
      displayName: 'Deal ID',
      type: 'string',
      default: '',
      description: 'The HubSpot deal ID',
      displayOptions: { show: { operation: ['getDeal', 'updateDeal'] } },
    },
    {
      name: 'companyId',
      displayName: 'Company ID',
      type: 'string',
      default: '',
      description: 'The HubSpot company ID',
      displayOptions: { show: { operation: ['getCompany'] } },
    },
    {
      name: 'email',
      displayName: 'Email',
      type: 'string',
      default: '',
      description: 'Contact email address',
      displayOptions: { show: { operation: ['createContact', 'updateContact'] } },
    },
    {
      name: 'firstName',
      displayName: 'First Name',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['createContact', 'updateContact'] } },
    },
    {
      name: 'lastName',
      displayName: 'Last Name',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['createContact', 'updateContact'] } },
    },
    {
      name: 'phone',
      displayName: 'Phone',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['createContact', 'updateContact'] } },
    },
    {
      name: 'company',
      displayName: 'Company Name',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['createContact', 'updateContact', 'createCompany'] } },
    },
    {
      name: 'dealName',
      displayName: 'Deal Name',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['createDeal', 'updateDeal'] } },
    },
    {
      name: 'dealStage',
      displayName: 'Deal Stage',
      type: 'string',
      default: '',
      description: 'The deal stage ID (e.g., appointmentscheduled, qualifiedtobuy, closedwon)',
      displayOptions: { show: { operation: ['createDeal', 'updateDeal'] } },
    },
    {
      name: 'amount',
      displayName: 'Amount',
      type: 'number',
      default: 0,
      displayOptions: { show: { operation: ['createDeal', 'updateDeal'] } },
    },
    {
      name: 'pipeline',
      displayName: 'Pipeline',
      type: 'string',
      default: 'default',
      displayOptions: { show: { operation: ['createDeal', 'updateDeal'] } },
    },
    {
      name: 'properties',
      displayName: 'Additional Properties (JSON)',
      type: 'json',
      default: '{}',
      description: 'Additional HubSpot properties as a JSON object',
    },
    {
      name: 'query',
      displayName: 'Search Query',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['searchContacts'] } },
    },
    {
      name: 'limit',
      displayName: 'Limit',
      type: 'number',
      default: 100,
      description: 'Number of results to return',
      displayOptions: { show: { operation: ['listContacts', 'listDeals', 'searchContacts'] } },
    },
  ],
  credentials: [{ name: 'hubspot', required: true }],
  color: '#FF7A59',
};

async function callHubSpotApi(
  method: string,
  path: string,
  accessToken: string,
  body?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const url = `https://api.hubapi.com${path}`;
  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  };

  if (body && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `HubSpot API error (${response.status}): ${(errorData as any)?.message || response.statusText}`,
    );
  }

  if (response.status === 204) return { success: true };
  return response.json() as Promise<Record<string, unknown>>;
}

export const HubSpotNode: INodeHandler = {
  description,

  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    const credentials = ctx.credentials.hubspot as Record<string, string> | undefined;
    if (!credentials?.accessToken) {
      throw new Error('HubSpot credentials not configured. Please provide an access token.');
    }
    const token = credentials.accessToken;

    const operation = (ctx.parameters.operation as string) || 'createContact';
    const results: INodeExecutionData[] = [];

    for (const item of ctx.inputData) {
      try {
        let additionalProps: Record<string, unknown> = {};
        const propsRaw = ctx.parameters.properties;
        if (propsRaw && typeof propsRaw === 'string' && propsRaw !== '{}') {
          additionalProps = JSON.parse(propsRaw);
        } else if (propsRaw && typeof propsRaw === 'object') {
          additionalProps = propsRaw as Record<string, unknown>;
        }

        let responseData: Record<string, unknown>;

        switch (operation) {
          case 'createContact': {
            const properties: Record<string, unknown> = {
              ...additionalProps,
              email: ctx.parameters.email || item.json.email,
              firstname: ctx.parameters.firstName || item.json.firstName,
              lastname: ctx.parameters.lastName || item.json.lastName,
            };
            if (ctx.parameters.phone) properties.phone = ctx.parameters.phone;
            if (ctx.parameters.company) properties.company = ctx.parameters.company;

            responseData = await callHubSpotApi('POST', '/crm/v3/objects/contacts', token, { properties });
            break;
          }

          case 'getContact': {
            const contactId = (ctx.parameters.contactId as string) || (item.json.contactId as string);
            responseData = await callHubSpotApi('GET', `/crm/v3/objects/contacts/${contactId}`, token);
            break;
          }

          case 'updateContact': {
            const contactId = (ctx.parameters.contactId as string) || (item.json.contactId as string);
            const properties: Record<string, unknown> = { ...additionalProps };
            if (ctx.parameters.email) properties.email = ctx.parameters.email;
            if (ctx.parameters.firstName) properties.firstname = ctx.parameters.firstName;
            if (ctx.parameters.lastName) properties.lastname = ctx.parameters.lastName;
            if (ctx.parameters.phone) properties.phone = ctx.parameters.phone;

            responseData = await callHubSpotApi('PATCH', `/crm/v3/objects/contacts/${contactId}`, token, { properties });
            break;
          }

          case 'listContacts': {
            const limit = ctx.parameters.limit || 100;
            responseData = await callHubSpotApi('GET', `/crm/v3/objects/contacts?limit=${limit}`, token);
            break;
          }

          case 'searchContacts': {
            const query = (ctx.parameters.query as string) || (item.json.query as string) || '';
            const limit = ctx.parameters.limit || 100;
            responseData = await callHubSpotApi('POST', '/crm/v3/objects/contacts/search', token, {
              query,
              limit,
            });
            break;
          }

          case 'createDeal': {
            const properties: Record<string, unknown> = {
              ...additionalProps,
              dealname: ctx.parameters.dealName || item.json.dealName,
              dealstage: ctx.parameters.dealStage || 'appointmentscheduled',
              amount: String(ctx.parameters.amount || 0),
              pipeline: ctx.parameters.pipeline || 'default',
            };

            responseData = await callHubSpotApi('POST', '/crm/v3/objects/deals', token, { properties });
            break;
          }

          case 'getDeal': {
            const dealId = (ctx.parameters.dealId as string) || (item.json.dealId as string);
            responseData = await callHubSpotApi('GET', `/crm/v3/objects/deals/${dealId}`, token);
            break;
          }

          case 'updateDeal': {
            const dealId = (ctx.parameters.dealId as string) || (item.json.dealId as string);
            const properties: Record<string, unknown> = { ...additionalProps };
            if (ctx.parameters.dealName) properties.dealname = ctx.parameters.dealName;
            if (ctx.parameters.dealStage) properties.dealstage = ctx.parameters.dealStage;
            if (ctx.parameters.amount) properties.amount = String(ctx.parameters.amount);
            if (ctx.parameters.pipeline) properties.pipeline = ctx.parameters.pipeline;

            responseData = await callHubSpotApi('PATCH', `/crm/v3/objects/deals/${dealId}`, token, { properties });
            break;
          }

          case 'listDeals': {
            const limit = ctx.parameters.limit || 100;
            responseData = await callHubSpotApi('GET', `/crm/v3/objects/deals?limit=${limit}`, token);
            break;
          }

          case 'createCompany': {
            const properties: Record<string, unknown> = {
              ...additionalProps,
              name: ctx.parameters.company || item.json.companyName,
            };

            responseData = await callHubSpotApi('POST', '/crm/v3/objects/companies', token, { properties });
            break;
          }

          case 'getCompany': {
            const companyId = (ctx.parameters.companyId as string) || (item.json.companyId as string);
            responseData = await callHubSpotApi('GET', `/crm/v3/objects/companies/${companyId}`, token);
            break;
          }

          default:
            throw new Error(`Unsupported HubSpot operation: ${operation}`);
        }

        results.push({
          json: { success: true, operation, ...responseData },
          pairedItem: { item: results.length },
        });
      } catch (error: any) {
        results.push({
          json: { success: false, operation, error: error.message },
          pairedItem: { item: results.length },
        });
      }
    }

    return { data: [results] };
  },
};
