import { INodeHandler, INodeExecutionContext } from '../../engine/NodeRegistry';
import { INodeTypeDescription, INodeExecutionResult, INodeExecutionData } from '@flowforge/shared';

const description: INodeTypeDescription = {
  type: 'integration.github',
  displayName: 'GitHub',
  description: 'Manage issues, pull requests, repos, and more via the GitHub API',
  icon: 'github',
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
        { name: 'Create Issue', value: 'createIssue', description: 'Create a new issue' },
        { name: 'Get Issue', value: 'getIssue', description: 'Get a single issue by number' },
        { name: 'List Issues', value: 'listIssues', description: 'List issues for a repository' },
        { name: 'Create Pull Request', value: 'createPR', description: 'Create a new pull request' },
        { name: 'Merge Pull Request', value: 'mergePR', description: 'Merge a pull request' },
        { name: 'Get Repository', value: 'getRepo', description: 'Get repository information' },
        { name: 'List Repositories', value: 'listRepos', description: 'List repositories for a user or org' },
        { name: 'Create Comment', value: 'createComment', description: 'Create a comment on an issue or PR' },
        { name: 'List Commits', value: 'listCommits', description: 'List commits for a repository' },
        { name: 'Create Release', value: 'createRelease', description: 'Create a new release' },
        { name: 'Get User', value: 'getUser', description: 'Get information about a user' },
      ],
    },
    {
      name: 'owner',
      displayName: 'Owner',
      type: 'string',
      default: '',
      description: 'Repository owner (user or organization)',
      placeholder: 'octocat',
      displayOptions: {
        show: { operation: ['createIssue', 'getIssue', 'listIssues', 'createPR', 'mergePR', 'getRepo', 'createComment', 'listCommits', 'createRelease'] },
      },
    },
    {
      name: 'repo',
      displayName: 'Repository',
      type: 'string',
      default: '',
      description: 'Repository name',
      placeholder: 'my-repo',
      displayOptions: {
        show: { operation: ['createIssue', 'getIssue', 'listIssues', 'createPR', 'mergePR', 'getRepo', 'createComment', 'listCommits', 'createRelease'] },
      },
    },
    {
      name: 'title',
      displayName: 'Title',
      type: 'string',
      default: '',
      description: 'Title for issue, PR, or release',
      displayOptions: {
        show: { operation: ['createIssue', 'createPR', 'createRelease'] },
      },
    },
    {
      name: 'body',
      displayName: 'Body',
      type: 'string',
      default: '',
      description: 'Body text or description',
      displayOptions: {
        show: { operation: ['createIssue', 'createPR', 'createComment', 'createRelease'] },
      },
    },
    {
      name: 'labels',
      displayName: 'Labels (JSON)',
      type: 'json',
      default: '[]',
      description: 'Array of label names',
      displayOptions: {
        show: { operation: ['createIssue'] },
      },
    },
    {
      name: 'assignees',
      displayName: 'Assignees (JSON)',
      type: 'json',
      default: '[]',
      description: 'Array of usernames to assign',
      displayOptions: {
        show: { operation: ['createIssue'] },
      },
    },
    {
      name: 'head',
      displayName: 'Head Branch',
      type: 'string',
      default: '',
      description: 'The branch containing changes (head)',
      displayOptions: {
        show: { operation: ['createPR'] },
      },
    },
    {
      name: 'base',
      displayName: 'Base Branch',
      type: 'string',
      default: 'main',
      description: 'The branch to merge into (base)',
      displayOptions: {
        show: { operation: ['createPR'] },
      },
    },
    {
      name: 'issueNumber',
      displayName: 'Issue Number',
      type: 'number',
      default: 0,
      description: 'The issue number',
      displayOptions: {
        show: { operation: ['getIssue', 'createComment'] },
      },
    },
    {
      name: 'prNumber',
      displayName: 'Pull Request Number',
      type: 'number',
      default: 0,
      description: 'The pull request number',
      displayOptions: {
        show: { operation: ['mergePR'] },
      },
    },
    {
      name: 'tag',
      displayName: 'Tag Name',
      type: 'string',
      default: '',
      description: 'The tag name for the release',
      placeholder: 'v1.0.0',
      displayOptions: {
        show: { operation: ['createRelease'] },
      },
    },
    {
      name: 'sha',
      displayName: 'SHA',
      type: 'string',
      default: '',
      description: 'SHA or branch to list commits from',
      displayOptions: {
        show: { operation: ['listCommits'] },
      },
    },
    {
      name: 'perPage',
      displayName: 'Per Page',
      type: 'number',
      default: 30,
      description: 'Number of results per page',
      displayOptions: {
        show: { operation: ['listIssues', 'listRepos', 'listCommits'] },
      },
    },
    {
      name: 'state',
      displayName: 'State',
      type: 'options',
      default: 'open',
      options: [
        { name: 'Open', value: 'open' },
        { name: 'Closed', value: 'closed' },
        { name: 'All', value: 'all' },
      ],
      displayOptions: {
        show: { operation: ['listIssues'] },
      },
    },
  ],
  credentials: [{ name: 'github', required: true }],
  color: '#24292F',
};

async function callGitHubApi(
  endpoint: string,
  token: string,
  method: string = 'GET',
  body?: Record<string, unknown>,
): Promise<Record<string, unknown> | Record<string, unknown>[]> {
  const url = endpoint.startsWith('https://') ? endpoint : `https://api.github.com${endpoint}`;

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'FlowForge-Integration',
  };

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);

  if (response.status === 204) {
    return { success: true, statusCode: 204 };
  }

  const data = await response.json();

  if (!response.ok) {
    const errorMessage = (data as Record<string, unknown>).message || response.statusText;
    throw new Error(`GitHub API error (${response.status}): ${errorMessage}`);
  }

  return data as Record<string, unknown> | Record<string, unknown>[];
}

export const GitHubNode: INodeHandler = {
  description,

  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    const params = ctx.parameters as Record<string, unknown>;
    const credentials = ctx.credentials as Record<string, Record<string, string>>;
    const token = credentials.github?.token;

    if (!token) {
      throw new Error('GitHub token is required. Please configure GitHub credentials.');
    }

    const operation = params.operation as string;
    const owner = params.owner as string;
    const repo = params.repo as string;
    const results: INodeExecutionData[] = [];

    for (const item of ctx.inputData) {
      try {
        let responseData: Record<string, unknown> | Record<string, unknown>[];

        switch (operation) {
          case 'createIssue': {
            const payload: Record<string, unknown> = {
              title: params.title as string,
              body: params.body as string,
            };
            const labelsRaw = params.labels as string;
            if (labelsRaw && labelsRaw !== '[]') {
              payload.labels = typeof labelsRaw === 'string' ? JSON.parse(labelsRaw) : labelsRaw;
            }
            const assigneesRaw = params.assignees as string;
            if (assigneesRaw && assigneesRaw !== '[]') {
              payload.assignees = typeof assigneesRaw === 'string' ? JSON.parse(assigneesRaw) : assigneesRaw;
            }
            responseData = await callGitHubApi(`/repos/${owner}/${repo}/issues`, token, 'POST', payload);
            break;
          }

          case 'getIssue': {
            const issueNumber = params.issueNumber as number;
            responseData = await callGitHubApi(`/repos/${owner}/${repo}/issues/${issueNumber}`, token);
            break;
          }

          case 'listIssues': {
            const perPage = params.perPage as number || 30;
            const state = params.state as string || 'open';
            responseData = await callGitHubApi(`/repos/${owner}/${repo}/issues?state=${state}&per_page=${perPage}`, token);
            break;
          }

          case 'createPR': {
            responseData = await callGitHubApi(`/repos/${owner}/${repo}/pulls`, token, 'POST', {
              title: params.title as string,
              body: params.body as string,
              head: params.head as string,
              base: params.base as string || 'main',
            });
            break;
          }

          case 'mergePR': {
            const prNumber = params.prNumber as number;
            responseData = await callGitHubApi(`/repos/${owner}/${repo}/pulls/${prNumber}/merge`, token, 'PUT', {});
            break;
          }

          case 'getRepo': {
            responseData = await callGitHubApi(`/repos/${owner}/${repo}`, token);
            break;
          }

          case 'listRepos': {
            const perPage = params.perPage as number || 30;
            responseData = await callGitHubApi(`/users/${owner}/repos?per_page=${perPage}&sort=updated`, token);
            break;
          }

          case 'createComment': {
            const issueNumber = params.issueNumber as number;
            responseData = await callGitHubApi(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, token, 'POST', {
              body: params.body as string,
            });
            break;
          }

          case 'listCommits': {
            const perPage = params.perPage as number || 30;
            const sha = params.sha as string;
            let endpoint = `/repos/${owner}/${repo}/commits?per_page=${perPage}`;
            if (sha) {
              endpoint += `&sha=${encodeURIComponent(sha)}`;
            }
            responseData = await callGitHubApi(endpoint, token);
            break;
          }

          case 'createRelease': {
            responseData = await callGitHubApi(`/repos/${owner}/${repo}/releases`, token, 'POST', {
              tag_name: params.tag as string,
              name: params.title as string,
              body: params.body as string,
            });
            break;
          }

          case 'getUser': {
            const username = owner || 'user';
            const endpoint = username === 'user' ? '/user' : `/users/${username}`;
            responseData = await callGitHubApi(endpoint, token);
            break;
          }

          default:
            throw new Error(`Unsupported GitHub operation: ${operation}`);
        }

        const jsonResult = Array.isArray(responseData)
          ? { items: responseData, count: responseData.length }
          : responseData;

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
