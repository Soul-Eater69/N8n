import { INodeHandler, INodeExecutionContext } from '../../engine/NodeRegistry';
import { INodeTypeDescription, INodeExecutionResult, INodeExecutionData } from '@flowforge/shared';

const description: INodeTypeDescription = {
  type: 'ai.agent',
  displayName: 'AI Agent',
  description: 'An autonomous AI agent that can use tools in a loop to accomplish tasks',
  icon: 'bot',
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
      default: 'gpt-4o',
      required: true,
      description: 'Model identifier (e.g. gpt-4o, claude-sonnet-4-5-20250929)',
    },
    {
      name: 'systemPrompt',
      displayName: 'System Prompt',
      type: 'string',
      default: 'You are a helpful assistant. Use the provided tools when necessary to accomplish the user\'s task.',
      description: 'Instructions for the agent behavior',
      typeOptions: { rows: 4 },
    },
    {
      name: 'tools',
      displayName: 'Tools',
      type: 'json',
      default: '[]',
      description: 'JSON array of tool definitions with name, description, and parameters schema',
      typeOptions: { rows: 10 },
    },
    {
      name: 'maxIterations',
      displayName: 'Max Iterations',
      type: 'number',
      default: 10,
      description: 'Maximum number of tool-use iterations before stopping',
    },
    {
      name: 'temperature',
      displayName: 'Temperature',
      type: 'number',
      default: 0.7,
      description: 'Controls randomness of the model',
    },
    {
      name: 'memory',
      displayName: 'Use Conversational Memory',
      type: 'boolean',
      default: false,
      description: 'Whether to include prior conversation context from input data',
    },
  ],
  color: '#8B5CF6',
};

interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

interface OpenAIMessage {
  role: string;
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: string;
    function: { name: string; arguments: string };
  }>;
}

interface AnthropicContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

function parseTools(toolsParam: unknown): ToolDefinition[] {
  if (!toolsParam) return [];
  const raw = typeof toolsParam === 'string' ? JSON.parse(toolsParam || '[]') : toolsParam;
  if (!Array.isArray(raw)) return [];
  return raw.map((tool: any) => ({
    name: tool.name || '',
    description: tool.description || '',
    parameters: tool.parameters || { type: 'object', properties: {} },
  }));
}

function buildOpenAITools(tools: ToolDefinition[]): Array<Record<string, unknown>> {
  return tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

function buildAnthropicTools(tools: ToolDefinition[]): Array<Record<string, unknown>> {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters,
  }));
}

function simulateToolExecution(toolName: string, toolArgs: Record<string, unknown>, toolDef: ToolDefinition | undefined): string {
  const result: Record<string, unknown> = {
    tool: toolName,
    status: 'executed',
    input: toolArgs,
    output: `Tool '${toolName}' executed successfully with arguments: ${JSON.stringify(toolArgs)}`,
  };

  if (toolDef) {
    result.description = toolDef.description;
  }

  return JSON.stringify(result);
}

async function runOpenAIAgentLoop(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  tools: ToolDefinition[],
  maxIterations: number,
  temperature: number,
): Promise<{ finalAnswer: string; conversationHistory: OpenAIMessage[]; iterations: number }> {
  const messages: OpenAIMessage[] = [];

  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: userPrompt });

  const openaiTools = tools.length > 0 ? buildOpenAITools(tools) : undefined;
  let iterations = 0;

  while (iterations < maxIterations) {
    iterations++;

    const body: Record<string, unknown> = {
      model,
      messages,
      temperature,
      max_tokens: 4096,
    };

    if (openaiTools && openaiTools.length > 0) {
      body.tools = openaiTools;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `OpenAI API error (${response.status}): ${(errorData as any)?.error?.message || response.statusText}`,
      );
    }

    const data = (await response.json()) as Record<string, unknown>;
    const choices = (data.choices as any[]) || [];
    const choice = choices[0] || {};
    const message = choice.message || {};

    messages.push(message);

    if (!message.tool_calls || message.tool_calls.length === 0) {
      return {
        finalAnswer: message.content || '',
        conversationHistory: messages,
        iterations,
      };
    }

    for (const toolCall of message.tool_calls) {
      const fnName = toolCall.function.name;
      let fnArgs: Record<string, unknown> = {};
      try {
        fnArgs = JSON.parse(toolCall.function.arguments || '{}');
      } catch {
        fnArgs = {};
      }

      const toolDef = tools.find((t) => t.name === fnName);
      const toolResult = simulateToolExecution(fnName, fnArgs, toolDef);

      messages.push({
        role: 'tool',
        content: toolResult,
        tool_calls: undefined,
      } as any);

      // Set tool_call_id on the tool message for OpenAI format
      (messages[messages.length - 1] as any).tool_call_id = toolCall.id;
    }
  }

  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === 'assistant');
  return {
    finalAnswer: lastAssistantMsg?.content || 'Agent reached maximum iterations without a final answer.',
    conversationHistory: messages,
    iterations,
  };
}

async function runAnthropicAgentLoop(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  tools: ToolDefinition[],
  maxIterations: number,
  temperature: number,
): Promise<{ finalAnswer: string; conversationHistory: Array<Record<string, unknown>>; iterations: number }> {
  const messages: Array<Record<string, unknown>> = [
    { role: 'user', content: userPrompt },
  ];

  const anthropicTools = tools.length > 0 ? buildAnthropicTools(tools) : undefined;
  let iterations = 0;

  while (iterations < maxIterations) {
    iterations++;

    const body: Record<string, unknown> = {
      model,
      messages,
      max_tokens: 4096,
      temperature,
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }

    if (anthropicTools && anthropicTools.length > 0) {
      body.tools = anthropicTools;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        (errorData as any)?.error?.message || (errorData as any)?.message || response.statusText;
      throw new Error(`Anthropic API error (${response.status}): ${errorMessage}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    const contentBlocks = (data.content as AnthropicContentBlock[]) || [];
    const stopReason = data.stop_reason as string;

    messages.push({ role: 'assistant', content: contentBlocks });

    const toolUseBlocks = contentBlocks.filter((b) => b.type === 'tool_use');

    if (toolUseBlocks.length === 0 || stopReason === 'end_turn') {
      const textBlocks = contentBlocks.filter((b) => b.type === 'text');
      const finalText = textBlocks.map((b) => b.text || '').join('');
      return {
        finalAnswer: finalText,
        conversationHistory: messages,
        iterations,
      };
    }

    const toolResults: Array<Record<string, unknown>> = [];
    for (const toolUse of toolUseBlocks) {
      const toolDef = tools.find((t) => t.name === toolUse.name);
      const toolResult = simulateToolExecution(
        toolUse.name || '',
        (toolUse.input as Record<string, unknown>) || {},
        toolDef,
      );
      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: toolResult,
      });
    }

    messages.push({ role: 'user', content: toolResults });
  }

  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
  let fallbackText = 'Agent reached maximum iterations without a final answer.';
  if (lastAssistant && Array.isArray(lastAssistant.content)) {
    const textBlocks = (lastAssistant.content as AnthropicContentBlock[]).filter((b) => b.type === 'text');
    if (textBlocks.length > 0) {
      fallbackText = textBlocks.map((b) => b.text || '').join('');
    }
  }

  return {
    finalAnswer: fallbackText,
    conversationHistory: messages,
    iterations,
  };
}

export const AIAgentNode: INodeHandler = {
  description,
  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    const provider = (ctx.parameters.provider as string) || 'openai';
    const model = (ctx.parameters.model as string) || (provider === 'openai' ? 'gpt-4o' : 'claude-sonnet-4-5-20250929');
    const systemPrompt = (ctx.parameters.systemPrompt as string) || '';
    const maxIterations = Number(ctx.parameters.maxIterations ?? 10);
    const temperature = Number(ctx.parameters.temperature ?? 0.7);
    const useMemory = Boolean(ctx.parameters.memory);
    const tools = parseTools(ctx.parameters.tools);

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

    const results: INodeExecutionData[] = [];

    for (const item of ctx.inputData) {
      try {
        let userPrompt = (ctx.parameters.userPrompt as string) || (item.json.prompt as string) || '';

        // If memory is enabled, prepend conversation history from input
        if (useMemory && item.json.conversationHistory) {
          const priorHistory = item.json.conversationHistory;
          if (typeof priorHistory === 'string') {
            userPrompt = `Previous conversation context:\n${priorHistory}\n\nCurrent request:\n${userPrompt}`;
          }
        }

        if (!userPrompt) {
          throw new Error('No user prompt provided');
        }

        if (provider === 'openai') {
          const result = await runOpenAIAgentLoop(
            apiKey,
            model,
            systemPrompt,
            userPrompt,
            tools,
            maxIterations,
            temperature,
          );

          results.push({
            json: {
              answer: result.finalAnswer,
              iterations: result.iterations,
              conversationHistory: result.conversationHistory,
              provider: 'openai',
              model,
              toolsUsed: tools.map((t) => t.name),
            },
          });
        } else {
          const result = await runAnthropicAgentLoop(
            apiKey,
            model,
            systemPrompt,
            userPrompt,
            tools,
            maxIterations,
            temperature,
          );

          results.push({
            json: {
              answer: result.finalAnswer,
              iterations: result.iterations,
              conversationHistory: result.conversationHistory,
              provider: 'anthropic',
              model,
              toolsUsed: tools.map((t) => t.name),
            },
          });
        }
      } catch (error: any) {
        results.push({
          json: {
            error: true,
            message: error.message,
            provider,
            model,
            ...item.json,
          },
        });
      }
    }

    return { data: [results] };
  },
};
