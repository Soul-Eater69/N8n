import { INodeHandler, INodeExecutionContext } from '../../engine/NodeRegistry';
import { INodeTypeDescription, INodeExecutionResult } from '@flowforge/shared';

const description: INodeTypeDescription = {
  type: 'trigger.error',
  displayName: 'Error Trigger',
  description:
    'Triggers when a workflow encounters an error. Use this as the starting node ' +
    'in an error workflow to receive error details automatically.',
  icon: 'alert-octagon',
  category: 'triggers',
  version: 1,
  inputs: [],
  outputs: [{ name: 'main', type: 'main' }],
  properties: [],
  triggerType: 'event',
  color: '#E74C3C',
  group: ['trigger'],
  defaults: {
    name: 'Error Trigger',
  },
  subtitle: 'When a workflow errors',
};

/**
 * ErrorTriggerNode is a trigger node designed to be the entry point of
 * error workflows. When a workflow fails and has an `errorWorkflowId`
 * configured in its settings, the ErrorWorkflowRunner executes that
 * error workflow with error details as trigger data.
 *
 * This node receives that error data and passes it through to the
 * downstream nodes. The trigger data contains:
 *
 * - error.message: The error message
 * - error.stack: The stack trace (if available)
 * - error.timestamp: When the error occurred
 * - execution.id: The execution ID of the failed workflow
 * - execution.mode: The execution mode (manual, trigger, webhook, etc.)
 * - workflow.id: The ID of the failed workflow
 * - workflow.name: The name of the failed workflow
 * - node.id: The ID of the failed node (if applicable)
 * - node.name: The name of the failed node (if applicable)
 * - node.type: The type of the failed node (if applicable)
 */
export const ErrorTriggerNode: INodeHandler = {
  description,

  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    // The error data is passed as trigger data (inputData) by the
    // ErrorWorkflowRunner. We simply pass it through as output.
    //
    // If there is no input data (e.g., testing the node manually),
    // return a sample structure showing what the error data looks like.
    if (ctx.inputData.length === 0 || Object.keys(ctx.inputData[0].json).length === 0) {
      return {
        data: [
          [
            {
              json: {
                error: {
                  message: 'No error data received - this node should be triggered by an error workflow',
                  stack: undefined,
                  timestamp: new Date().toISOString(),
                },
                execution: {
                  id: ctx.context.executionId,
                  mode: ctx.context.mode,
                },
                workflow: {
                  id: ctx.context.workflowId,
                  name: undefined,
                },
                node: undefined,
              },
            },
          ],
        ],
      };
    }

    // Pass through the error data received from ErrorWorkflowRunner
    // Ensure each item has the expected structure
    const outputItems = ctx.inputData.map((item) => {
      const json = item.json;

      return {
        json: {
          error: {
            message: (json.error as any)?.message || json.message || 'Unknown error',
            stack: (json.error as any)?.stack || json.stack,
            timestamp: (json.error as any)?.timestamp || new Date().toISOString(),
          },
          execution: {
            id: (json.execution as any)?.id || json.executionId || ctx.context.executionId,
            mode: (json.execution as any)?.mode || json.executionMode || ctx.context.mode,
          },
          workflow: {
            id: (json.workflow as any)?.id || json.workflowId,
            name: (json.workflow as any)?.name || json.workflowName,
          },
          node: json.node || (json.failedNodeId
            ? {
                id: json.failedNodeId,
                name: json.failedNodeName,
                type: json.failedNodeType,
              }
            : undefined),
        },
      };
    });

    return {
      data: [outputItems],
    };
  },
};
