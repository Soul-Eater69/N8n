import { INodeHandler, INodeExecutionContext } from '../../engine/NodeRegistry';
import { INodeTypeDescription, INodeExecutionResult, INodeExecutionData } from '@flowforge/shared';

const description: INodeTypeDescription = {
  type: 'logic.subWorkflow',
  displayName: 'Execute Sub-Workflow',
  description: 'Executes another workflow as a sub-workflow and returns its output',
  icon: 'layers',
  category: 'logic',
  version: 1,
  inputs: [{ name: 'main', type: 'main' }],
  outputs: [{ name: 'main', type: 'main' }],
  properties: [
    {
      name: 'workflowId',
      displayName: 'Workflow ID',
      type: 'string',
      default: '',
      required: true,
      description: 'The ID of the workflow to execute as a sub-workflow',
      placeholder: 'e.g., a1b2c3d4-e5f6-...',
    },
    {
      name: 'executionMode',
      displayName: 'Execution Mode',
      type: 'options',
      default: 'inline',
      description: 'How to execute the sub-workflow',
      options: [
        {
          name: 'Inline',
          value: 'inline',
          description: 'Execute immediately in the current process',
        },
        {
          name: 'Queued',
          value: 'queued',
          description: 'Add to the execution queue for processing by a worker',
        },
      ],
    },
    {
      name: 'waitForCompletion',
      displayName: 'Wait for Completion',
      type: 'boolean',
      default: true,
      description: 'Whether to wait for the sub-workflow to complete before continuing. Only applies to queued mode.',
      displayOptions: {
        show: {
          executionMode: ['queued'],
        },
      },
    },
    {
      name: 'timeout',
      displayName: 'Timeout (ms)',
      type: 'number',
      default: 300000,
      description: 'Maximum time in milliseconds to wait for the sub-workflow to complete',
    },
    {
      name: 'inputMapping',
      displayName: 'Input Mapping',
      type: 'json',
      default: '{}',
      description:
        'JSON object mapping parent data fields to sub-workflow input fields. ' +
        'Keys are destination field names, values are source field paths (dot notation). ' +
        'Example: {"userName": "data.user.name", "orderId": "data.id"}',
      placeholder: '{"targetField": "sourceField.path"}',
    },
  ],
  color: '#6C5CE7',
  subtitle: '={{$parameter["workflowId"]}}',
};

export const SubWorkflowNode: INodeHandler = {
  description,

  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    const workflowId = ctx.parameters.workflowId as string;
    const executionMode = (ctx.parameters.executionMode as string) || 'inline';
    const waitForCompletion = ctx.parameters.waitForCompletion !== false;
    const timeout = (ctx.parameters.timeout as number) || 300000;
    const inputMappingRaw = ctx.parameters.inputMapping;

    if (!workflowId) {
      throw new Error('Workflow ID is required to execute a sub-workflow');
    }

    // Parse inputMapping - it may be a string (from JSON property) or already an object
    let inputMapping: Record<string, string> | undefined;
    if (inputMappingRaw) {
      if (typeof inputMappingRaw === 'string') {
        try {
          const parsed = JSON.parse(inputMappingRaw);
          if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
            inputMapping = parsed;
          }
        } catch {
          throw new Error(
            `Invalid input mapping JSON: ${inputMappingRaw}. ` +
            'Must be a valid JSON object.'
          );
        }
      } else if (typeof inputMappingRaw === 'object') {
        inputMapping = inputMappingRaw as Record<string, string>;
      }
    }

    // Dynamically import to avoid circular dependencies
    const { WorkflowService } = await import('../../services/workflow.service');
    const { SubWorkflowEngine } = await import('../../engine/SubWorkflowEngine');

    const workflowService = new WorkflowService();
    const subWorkflowEngine = new SubWorkflowEngine();

    // Fetch the target workflow
    const targetWorkflow = await workflowService.getById(
      workflowId,
      ctx.context.tenantId
    );

    // Determine current depth from execution metadata
    // The depth is tracked via metadata passed through the context
    const currentDepth = ((ctx.context as any).depth as number) || 0;
    const nextDepth = currentDepth + 1;

    if (executionMode === 'inline') {
      // Execute the sub-workflow inline using SubWorkflowEngine
      const result = await subWorkflowEngine.executeInline(targetWorkflow, {
        parentExecutionId: ctx.context.executionId,
        parentWorkflowId: ctx.context.workflowId,
        tenantId: ctx.context.tenantId,
        depth: nextDepth,
        inputData: ctx.inputData,
        inputMapping,
        timeout,
      });

      if (!result.success) {
        const errorMsg =
          (result.data.metadata?.error as string) || 'Sub-workflow execution failed';
        throw new Error(
          `Sub-workflow '${targetWorkflow.name}' (${workflowId}) failed: ${errorMsg}`
        );
      }

      // Merge sub-workflow output with parent execution metadata
      const outputItems: INodeExecutionData[] = result.outputItems.map((item) => ({
        json: {
          ...item.json,
          _subWorkflow: {
            executionId: result.executionId,
            workflowId,
            workflowName: targetWorkflow.name,
            depth: result.depth,
          },
        },
        binary: item.binary,
      }));

      return {
        data: [outputItems.length > 0 ? outputItems : [{ json: {} }]],
        metadata: {
          subExecutionId: result.executionId,
          subWorkflowId: workflowId,
          subWorkflowName: targetWorkflow.name,
          mode: 'inline',
          depth: nextDepth,
        },
      };
    }

    // Queued mode: add to execution queue
    const { addExecutionJob } = await import('../../services/queue.service');
    const { ExecutionService } = await import('../../services/execution.service');
    const { generateId } = await import('../../utils/helpers');

    const executionService = new ExecutionService();
    const subExecutionId = generateId();

    // Create execution record
    await executionService.create(
      workflowId,
      ctx.context.tenantId,
      'sub_workflow',
      undefined
    );

    // Build trigger data from input with optional mapping
    const mappedInput = subWorkflowEngine.applyInputMapping(
      ctx.inputData,
      inputMapping
    );
    const triggerDataJson = mappedInput.length > 0 ? mappedInput[0].json : {};

    // Add to queue
    await addExecutionJob(
      {
        executionId: subExecutionId,
        workflowId,
        tenantId: ctx.context.tenantId,
        mode: 'sub_workflow',
        triggerData: triggerDataJson as Record<string, unknown>,
      },
      5 // Slightly higher priority for sub-workflows
    );

    if (waitForCompletion) {
      // Poll for completion
      const pollInterval = 500;
      const startTime = Date.now();

      while (Date.now() - startTime < timeout) {
        const execution = await executionService.getById(
          subExecutionId,
          ctx.context.tenantId
        );

        if (execution.status === 'success') {
          const outputItems: INodeExecutionData[] = [];

          if (execution.data && execution.data.nodeExecutionOrder) {
            // Extract output from last node
            const lastNodeId =
              execution.data.nodeExecutionOrder[
                execution.data.nodeExecutionOrder.length - 1
              ];
            const lastResult = execution.data.nodeResults[lastNodeId];

            if (lastResult?.data?.[0]) {
              outputItems.push(...lastResult.data[0]);
            }
          }

          const results = outputItems.map((item) => ({
            json: {
              ...item.json,
              _subWorkflow: {
                executionId: subExecutionId,
                workflowId,
                workflowName: targetWorkflow.name,
                mode: 'queued',
              },
            },
            binary: item.binary,
          }));

          return {
            data: [results.length > 0 ? results : [{ json: {} }]],
            metadata: {
              subExecutionId,
              subWorkflowId: workflowId,
              subWorkflowName: targetWorkflow.name,
              mode: 'queued',
              waited: true,
            },
          };
        }

        if (execution.status === 'error') {
          const errorMsg = execution.error?.message || 'Sub-workflow failed';
          throw new Error(
            `Queued sub-workflow '${targetWorkflow.name}' (${workflowId}) failed: ${errorMsg}`
          );
        }

        if (execution.status === 'cancelled') {
          throw new Error(
            `Queued sub-workflow '${targetWorkflow.name}' (${workflowId}) was cancelled`
          );
        }

        // Wait before polling again
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }

      throw new Error(
        `Queued sub-workflow '${targetWorkflow.name}' (${workflowId}) ` +
        `timed out after ${timeout}ms`
      );
    }

    // Fire-and-forget: return immediately with the execution ID
    return {
      data: [
        [
          {
            json: {
              subExecutionId,
              subWorkflowId: workflowId,
              subWorkflowName: targetWorkflow.name,
              status: 'queued',
              message: 'Sub-workflow queued for execution',
            },
          },
        ],
      ],
      metadata: {
        subExecutionId,
        subWorkflowId: workflowId,
        subWorkflowName: targetWorkflow.name,
        mode: 'queued',
        waited: false,
      },
    };
  },
};
