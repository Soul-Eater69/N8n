import { INodeHandler, INodeExecutionContext } from '../../engine/NodeRegistry';
import { INodeTypeDescription, INodeExecutionResult } from '@flowforge/shared';
import { logger } from '../../utils/logger';

const description: INodeTypeDescription = {
  type: 'utility.debug',
  displayName: 'Debug',
  description:
    'Logs input data structure and item count for debugging purposes. ' +
    'Passes input data through unchanged.',
  icon: 'bug',
  category: 'utility',
  version: 1,
  inputs: [{ name: 'main', type: 'main' }],
  outputs: [{ name: 'main', type: 'main' }],
  properties: [
    {
      name: 'logToConsole',
      displayName: 'Log to Console',
      type: 'boolean',
      default: true,
      description: 'Whether to log debug information to the server console',
    },
    {
      name: 'pauseExecution',
      displayName: 'Pause Execution',
      type: 'boolean',
      default: false,
      description:
        'Whether to pause execution at this node. The pause simulates a ' +
        'breakpoint by introducing a delay (useful for inspecting live execution in the UI).',
    },
    {
      name: 'customMessage',
      displayName: 'Custom Message',
      type: 'string',
      default: '',
      description: 'An optional message to include in the debug output',
      placeholder: 'e.g., "After data transformation"',
    },
  ],
  color: '#636E72',
  subtitle: 'Debug Point',
};

export const DebugNode: INodeHandler = {
  description,

  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    const logToConsole = ctx.parameters.logToConsole !== false;
    const pauseExecution = ctx.parameters.pauseExecution === true;
    const customMessage = (ctx.parameters.customMessage as string) || '';

    const itemCount = ctx.inputData.length;

    // Build a summary of the data structure for each item
    const dataStructure = ctx.inputData.map((item, index) => {
      const keys = Object.keys(item.json);
      const hasBinary = item.binary ? Object.keys(item.binary) : [];

      return {
        itemIndex: index,
        fields: keys,
        fieldCount: keys.length,
        binaryFields: hasBinary,
        sampleValues: keys.reduce((acc, key) => {
          const value = item.json[key];
          const type = Array.isArray(value)
            ? `array[${value.length}]`
            : value === null
              ? 'null'
              : typeof value;
          acc[key] = type;
          return acc;
        }, {} as Record<string, string>),
      };
    });

    const debugInfo = {
      timestamp: new Date().toISOString(),
      executionId: ctx.context.executionId,
      workflowId: ctx.context.workflowId,
      nodeId: ctx.node.id,
      nodeName: ctx.node.name,
      customMessage: customMessage || undefined,
      itemCount,
      dataStructure,
    };

    if (logToConsole) {
      logger.info(
        {
          debugNode: true,
          executionId: ctx.context.executionId,
          nodeId: ctx.node.id,
          nodeName: ctx.node.name,
          itemCount,
          customMessage: customMessage || undefined,
        },
        `[DEBUG NODE] ${customMessage || ctx.node.name}: ${itemCount} item(s)`
      );

      // Log detailed structure at debug level
      logger.debug(
        {
          debugNode: true,
          dataStructure,
        },
        `[DEBUG NODE] Data structure details`
      );
    }

    if (pauseExecution) {
      // Simulate a breakpoint by pausing for a short period.
      // In a real debugger integration, this would wait for a
      // resume signal from the UI. For now, we pause for 5 seconds
      // to allow observation in real-time monitoring.
      const pauseDuration = 5000;
      logger.info(
        {
          executionId: ctx.context.executionId,
          nodeId: ctx.node.id,
          pauseDuration,
        },
        `[DEBUG NODE] Execution paused for ${pauseDuration}ms`
      );

      await new Promise((resolve) => setTimeout(resolve, pauseDuration));
    }

    // Attach debug info as metadata to each item, but pass through
    // the original data unchanged in the json field
    const outputItems = ctx.inputData.map((item) => ({
      json: {
        ...item.json,
        _debug: debugInfo,
      },
      binary: item.binary,
    }));

    return {
      data: [outputItems],
      metadata: debugInfo,
    };
  },
};
