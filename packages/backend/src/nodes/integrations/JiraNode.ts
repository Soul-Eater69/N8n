import { INodeHandler, INodeExecutionContext } from '../../engine/NodeRegistry';
import { INodeTypeDescription, INodeExecutionResult, INodeExecutionData } from '@flowforge/shared';

const description: INodeTypeDescription = {
  type: 'integration.jira',
  displayName: 'Jira',
  description: 'Create and manage issues, projects, and workflows in Jira',
  icon: 'check-square',
  category: 'integration',
  version: 1,
  inputs: [{ name: 'main', type: 'main' }],
  outputs: [{ name: 'main', type: 'main' }],
  properties: [
    {
      name: 'operation',
      displayName: 'Operation',
      type: 'options',
      default: 'createIssue',
      required: true,
      options: [
        { name: 'Create Issue', value: 'createIssue', description: 'Create a new Jira issue' },
        { name: 'Get Issue', value: 'getIssue', description: 'Get an issue by its key' },
        { name: 'Update Issue', value: 'updateIssue', description: 'Update an existing issue' },
        { name: 'Delete Issue', value: 'deleteIssue', description: 'Delete an issue' },
        { name: 'Add Comment', value: 'addComment', description: 'Add a comment to an issue' },
        { name: 'Assign Issue', value: 'assignIssue', description: 'Assign an issue to a user' },
        { name: 'Transition Issue', value: 'transitionIssue', description: 'Transition an issue to a new status' },
        { name: 'Search Issues (JQL)', value: 'searchIssues', description: 'Search for issues using JQL' },
        { name: 'Get Project', value: 'getProject', description: 'Get project information' },
        { name: 'List Projects', value: 'listProjects', description: 'List all accessible projects' },
      ],
    },
    {
      name: 'domain',
      displayName: 'Jira Domain',
      type: 'string',
      default: '',
      required: true,
      description: 'Your Jira Cloud domain (e.g. your-company.atlassian.net)',
      placeholder: 'your-company.atlassian.net',
    },
    {
      name: 'projectKey',
      displayName: 'Project Key',
      type: 'string',
      default: '',
      description: 'The project key (e.g. PROJ)',
      placeholder: 'PROJ',
      displayOptions: {
        show: { operation: ['createIssue', 'getProject'] },
      },
    },
    {
      name: 'issueKey',
      displayName: 'Issue Key',
      type: 'string',
      default: '',
      description: 'The issue key (e.g. PROJ-123)',
      placeholder: 'PROJ-123',
      displayOptions: {
        show: { operation: ['getIssue', 'updateIssue', 'deleteIssue', 'addComment', 'assignIssue', 'transitionIssue'] },
      },
    },
    {
      name: 'summary',
      displayName: 'Summary',
      type: 'string',
      default: '',
      description: 'Issue summary/title',
      displayOptions: {
        show: { operation: ['createIssue', 'updateIssue'] },
      },
    },
    {
      name: 'description',
      displayName: 'Description',
      type: 'string',
      default: '',
      description: 'Issue description (supports Atlassian Document Format in JSON, or plain text)',
      displayOptions: {
        show: { operation: ['createIssue', 'updateIssue'] },
      },
    },
    {
      name: 'issueType',
      displayName: 'Issue Type',
      type: 'options',
      default: 'Task',
      description: 'The type of issue to create',
      options: [
        { name: 'Bug', value: 'Bug' },
        { name: 'Story', value: 'Story' },
        { name: 'Task', value: 'Task' },
        { name: 'Epic', value: 'Epic' },
      ],
      displayOptions: {
        show: { operation: ['createIssue'] },
      },
    },
    {
      name: 'priority',
      displayName: 'Priority',
      type: 'options',
      default: 'Medium',
      description: 'Issue priority',
      options: [
        { name: 'Highest', value: 'Highest' },
        { name: 'High', value: 'High' },
        { name: 'Medium', value: 'Medium' },
        { name: 'Low', value: 'Low' },
        { name: 'Lowest', value: 'Lowest' },
      ],
      displayOptions: {
        show: { operation: ['createIssue', 'updateIssue'] },
      },
    },
    {
      name: 'assignee',
      displayName: 'Assignee',
      type: 'string',
      default: '',
      description: 'The account ID of the user to assign (use -1 for unassigned)',
      displayOptions: {
        show: { operation: ['createIssue', 'assignIssue'] },
      },
    },
    {
      name: 'comment',
      displayName: 'Comment',
      type: 'string',
      default: '',
      description: 'Comment text to add',
      displayOptions: {
        show: { operation: ['addComment'] },
      },
    },
    {
      name: 'transitionId',
      displayName: 'Transition ID',
      type: 'string',
      default: '',
      description: 'The ID of the transition to perform (use Get Issue to find available transitions)',
      displayOptions: {
        show: { operation: ['transitionIssue'] },
      },
    },
    {
      name: 'jql',
      displayName: 'JQL Query',
      type: 'string',
      default: '',
      description: 'JQL query string to search for issues',
      placeholder: 'project = PROJ AND status = "In Progress"',
      displayOptions: {
        show: { operation: ['searchIssues'] },
      },
    },
    {
      name: 'maxResults',
      displayName: 'Max Results',
      type: 'number',
      default: 50,
      description: 'Maximum number of results to return',
      displayOptions: {
        show: { operation: ['searchIssues', 'listProjects'] },
      },
    },
  ],
  credentials: [{ name: 'jira', required: true }],
  color: '#0052CC',
};

function buildAdfDescription(text: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(text);
    if (parsed.type === 'doc') {
      return parsed;
    }
  } catch {
    // Not JSON, treat as plain text
  }

  return {
    type: 'doc',
    version: 1,
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text,
          },
        ],
      },
    ],
  };
}

async function callJiraApi(
  domain: string,
  endpoint: string,
  email: string,
  apiToken: string,
  method: string = 'GET',
  body?: Record<string, unknown>,
): Promise<Record<string, unknown> | Record<string, unknown>[] | null> {
  const url = `https://${domain}/rest/api/3${endpoint}`;
  const authString = Buffer.from(`${email}:${apiToken}`).toString('base64');

  const headers: Record<string, string> = {
    'Authorization': `Basic ${authString}`,
    'Accept': 'application/json',
  };

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  if (body && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);

  if (response.status === 204) {
    return { success: true, statusCode: 204 };
  }

  if (response.status === 404) {
    throw new Error(`Jira resource not found at ${endpoint}`);
  }

  const contentType = response.headers.get('content-type') || '';
  let data: unknown;

  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    const text = await response.text();
    data = { rawResponse: text };
  }

  if (!response.ok) {
    const errorData = data as Record<string, unknown>;
    const errors = errorData.errorMessages as string[] | undefined;
    const fieldErrors = errorData.errors as Record<string, string> | undefined;
    let errorMessage = errors?.join(', ') || response.statusText;
    if (fieldErrors && Object.keys(fieldErrors).length > 0) {
      errorMessage += ` | Field errors: ${JSON.stringify(fieldErrors)}`;
    }
    throw new Error(`Jira API error (${response.status}): ${errorMessage}`);
  }

  return data as Record<string, unknown> | Record<string, unknown>[];
}

export const JiraNode: INodeHandler = {
  description,

  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    const params = ctx.parameters as Record<string, unknown>;
    const credentials = ctx.credentials as Record<string, Record<string, string>>;
    const jiraCreds = credentials.jira;

    if (!jiraCreds?.email || !jiraCreds?.apiToken) {
      throw new Error('Jira email and API token are required. Please configure Jira credentials.');
    }

    const email = jiraCreds.email;
    const apiToken = jiraCreds.apiToken;
    const domain = (params.domain as string) || jiraCreds.domain;

    if (!domain) {
      throw new Error('Jira domain is required (e.g. your-company.atlassian.net).');
    }

    const operation = params.operation as string;
    const results: INodeExecutionData[] = [];

    for (const item of ctx.inputData) {
      try {
        let responseData: Record<string, unknown> | Record<string, unknown>[] | null;

        switch (operation) {
          case 'createIssue': {
            const projectKey = params.projectKey as string;
            if (!projectKey) {
              throw new Error('Project key is required to create an issue');
            }

            const fields: Record<string, unknown> = {
              project: { key: projectKey },
              summary: params.summary as string,
              issuetype: { name: params.issueType as string || 'Task' },
            };

            if (params.description) {
              fields.description = buildAdfDescription(params.description as string);
            }

            if (params.priority) {
              fields.priority = { name: params.priority as string };
            }

            if (params.assignee) {
              fields.assignee = { accountId: params.assignee as string };
            }

            responseData = await callJiraApi(domain, '/issue', email, apiToken, 'POST', { fields });
            break;
          }

          case 'getIssue': {
            const issueKey = params.issueKey as string;
            if (!issueKey) {
              throw new Error('Issue key is required');
            }
            responseData = await callJiraApi(domain, `/issue/${issueKey}`, email, apiToken);
            break;
          }

          case 'updateIssue': {
            const issueKey = params.issueKey as string;
            if (!issueKey) {
              throw new Error('Issue key is required');
            }

            const fields: Record<string, unknown> = {};

            if (params.summary) {
              fields.summary = params.summary as string;
            }

            if (params.description) {
              fields.description = buildAdfDescription(params.description as string);
            }

            if (params.priority) {
              fields.priority = { name: params.priority as string };
            }

            responseData = await callJiraApi(domain, `/issue/${issueKey}`, email, apiToken, 'PUT', { fields });
            break;
          }

          case 'deleteIssue': {
            const issueKey = params.issueKey as string;
            if (!issueKey) {
              throw new Error('Issue key is required');
            }
            responseData = await callJiraApi(domain, `/issue/${issueKey}`, email, apiToken, 'DELETE');
            break;
          }

          case 'addComment': {
            const issueKey = params.issueKey as string;
            if (!issueKey) {
              throw new Error('Issue key is required');
            }
            const commentText = params.comment as string;
            if (!commentText) {
              throw new Error('Comment text is required');
            }

            const commentBody = buildAdfDescription(commentText);

            responseData = await callJiraApi(domain, `/issue/${issueKey}/comment`, email, apiToken, 'POST', {
              body: commentBody,
            });
            break;
          }

          case 'assignIssue': {
            const issueKey = params.issueKey as string;
            if (!issueKey) {
              throw new Error('Issue key is required');
            }
            const assigneeId = params.assignee as string;

            responseData = await callJiraApi(domain, `/issue/${issueKey}/assignee`, email, apiToken, 'PUT', {
              accountId: assigneeId === '-1' ? null : assigneeId,
            });
            break;
          }

          case 'transitionIssue': {
            const issueKey = params.issueKey as string;
            if (!issueKey) {
              throw new Error('Issue key is required');
            }
            const transitionId = params.transitionId as string;
            if (!transitionId) {
              throw new Error('Transition ID is required. Use getIssue to find available transitions.');
            }

            responseData = await callJiraApi(domain, `/issue/${issueKey}/transitions`, email, apiToken, 'POST', {
              transition: { id: transitionId },
            });
            break;
          }

          case 'searchIssues': {
            const jql = params.jql as string;
            if (!jql) {
              throw new Error('JQL query is required');
            }
            const maxResults = (params.maxResults as number) || 50;

            responseData = await callJiraApi(domain, '/search', email, apiToken, 'POST', {
              jql,
              maxResults,
              fields: ['summary', 'status', 'assignee', 'priority', 'issuetype', 'created', 'updated', 'description'],
            });
            break;
          }

          case 'getProject': {
            const projectKey = params.projectKey as string;
            if (!projectKey) {
              throw new Error('Project key is required');
            }
            responseData = await callJiraApi(domain, `/project/${projectKey}`, email, apiToken);
            break;
          }

          case 'listProjects': {
            const maxResults = (params.maxResults as number) || 50;
            responseData = await callJiraApi(domain, `/project/search?maxResults=${maxResults}`, email, apiToken);
            break;
          }

          default:
            throw new Error(`Unsupported Jira operation: ${operation}`);
        }

        const jsonResult = Array.isArray(responseData)
          ? { items: responseData, count: responseData.length }
          : responseData || {};

        results.push({
          json: {
            success: true,
            operation,
            ...jsonResult,
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
