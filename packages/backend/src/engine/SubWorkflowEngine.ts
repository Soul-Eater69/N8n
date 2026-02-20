import { IWorkflow, INodeExecutionData, IExecutionData } from '@flowforge/shared';
import { ExecutionError } from '../utils/errors';
import { generateId } from '../utils/helpers';
import { logger } from '../utils/logger';

export interface SubWorkflowExecutionOptions {
  /** The parent execution ID for traceability */
  parentExecutionId: string;
  /** The parent workflow ID */
  parentWorkflowId: string;
  /** Tenant ID for multi-tenancy scoping */
  tenantId: string;
  /** The current nesting depth (starts at 1 for the first sub-workflow call) */
  depth: number;
  /** Input data to pass to the sub-workflow trigger node */
  inputData: INodeExecutionData[];
  /** Input mapping to transform parent data before passing to sub-workflow */
  inputMapping?: Record<string, string>;
  /** Timeout in milliseconds for the sub-workflow execution */
  timeout?: number;
}

export interface SubWorkflowResult {
  /** The execution ID assigned to the sub-workflow run */
  executionId: string;
  /** Whether the sub-workflow completed successfully */
  success: boolean;
  /** The full execution data from the sub-workflow */
  data: IExecutionData;
  /** The output items from the last executed node */
  outputItems: INodeExecutionData[];
  /** How deep this execution was in the call chain */
  depth: number;
}

/**
 * SubWorkflowEngine manages the execution of nested workflows.
 *
 * It enforces a maximum recursion depth to prevent infinite loops,
 * maps data between parent and child workflows, and tracks the
 * parent-child execution relationship for debugging and auditing.
 */
export class SubWorkflowEngine {
  /** Maximum allowed nesting depth to prevent infinite recursion */
  static readonly MAX_DEPTH = 5;

  /** Tracks active sub-workflow execution IDs to help with cancellation */
  private activeSubExecutions = new Map<string, Set<string>>();

  /**
   * Validates that the sub-workflow execution can proceed given the
   * current depth and configuration.
   */
  validateExecution(options: SubWorkflowExecutionOptions): void {
    if (options.depth > SubWorkflowEngine.MAX_DEPTH) {
      throw new ExecutionError(
        `Maximum sub-workflow depth of ${SubWorkflowEngine.MAX_DEPTH} exceeded. ` +
        `Current depth: ${options.depth}. This may indicate infinite recursion ` +
        `between workflows.`
      );
    }

    if (!options.tenantId) {
      throw new ExecutionError('Tenant ID is required for sub-workflow execution');
    }
  }

  /**
   * Applies input mapping to transform parent data into the format
   * expected by the sub-workflow. The inputMapping is a key-value object
   * where keys are the destination field names in the sub-workflow and
   * values are dot-notation paths into the source items.
   */
  applyInputMapping(
    items: INodeExecutionData[],
    inputMapping?: Record<string, string>
  ): INodeExecutionData[] {
    if (!inputMapping || Object.keys(inputMapping).length === 0) {
      return items;
    }

    return items.map((item) => {
      const mappedJson: Record<string, unknown> = {};

      for (const [destKey, sourcePath] of Object.entries(inputMapping)) {
        const value = this.getNestedValue(item.json, sourcePath);
        this.setNestedValue(mappedJson, destKey, value);
      }

      return {
        json: mappedJson,
        binary: item.binary,
      };
    });
  }

  /**
   * Executes a sub-workflow inline using a dynamically imported WorkflowEngine.
   *
   * This method dynamically imports WorkflowEngine to avoid circular dependency
   * issues since WorkflowEngine may reference nodes that reference SubWorkflowEngine.
   */
  async executeInline(
    workflow: IWorkflow,
    options: SubWorkflowExecutionOptions
  ): Promise<SubWorkflowResult> {
    this.validateExecution(options);

    const subExecutionId = generateId();

    logger.info(
      {
        subExecutionId,
        parentExecutionId: options.parentExecutionId,
        parentWorkflowId: options.parentWorkflowId,
        subWorkflowId: workflow.id,
        depth: options.depth,
      },
      'Starting inline sub-workflow execution'
    );

    // Track the sub-execution under the parent
    this.trackSubExecution(options.parentExecutionId, subExecutionId);

    // Apply input mapping to transform parent data for the sub-workflow
    const mappedInput = this.applyInputMapping(
      options.inputData,
      options.inputMapping
    );

    try {
      // Dynamic import to avoid circular dependencies
      const { WorkflowEngine } = await import('./WorkflowEngine');
      const { ExecutionService } = await import('../services/execution.service');

      const engine = new WorkflowEngine();
      const executionService = new ExecutionService();

      // Create the execution record for tracking
      await executionService.create(
        workflow.id,
        options.tenantId,
        'sub_workflow',
        undefined
      );

      // Set up a timeout if specified
      let timeoutHandle: NodeJS.Timeout | undefined;
      let timedOut = false;

      const executionPromise = engine.execute(workflow, {
        executionId: subExecutionId,
        workflowId: workflow.id,
        tenantId: options.tenantId,
        mode: 'sub_workflow',
        triggerData: mappedInput,
      });

      let resultData: IExecutionData;

      if (options.timeout && options.timeout > 0) {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(() => {
            timedOut = true;
            engine.cancelExecution(subExecutionId);
            reject(
              new ExecutionError(
                `Sub-workflow execution timed out after ${options.timeout}ms`
              )
            );
          }, options.timeout);
        });

        try {
          resultData = await Promise.race([executionPromise, timeoutPromise]);
        } finally {
          if (timeoutHandle) clearTimeout(timeoutHandle);
        }
      } else {
        resultData = await executionPromise;
      }

      // Extract output items from the last executed node
      const outputItems = this.extractOutputItems(resultData);

      logger.info(
        {
          subExecutionId,
          parentExecutionId: options.parentExecutionId,
          depth: options.depth,
          outputItemCount: outputItems.length,
        },
        'Sub-workflow execution completed successfully'
      );

      return {
        executionId: subExecutionId,
        success: true,
        data: resultData,
        outputItems,
        depth: options.depth,
      };
    } catch (error: any) {
      logger.error(
        {
          subExecutionId,
          parentExecutionId: options.parentExecutionId,
          depth: options.depth,
          error: error.message,
        },
        'Sub-workflow execution failed'
      );

      return {
        executionId: subExecutionId,
        success: false,
        data: {
          nodeExecutionOrder: [],
          nodeResults: {},
          metadata: { error: error.message },
        },
        outputItems: [],
        depth: options.depth,
      };
    } finally {
      this.untrackSubExecution(options.parentExecutionId, subExecutionId);
    }
  }

  /**
   * Extracts the output items from the last executed node in the
   * sub-workflow execution data. This is what gets passed back to
   * the parent workflow.
   */
  private extractOutputItems(executionData: IExecutionData): INodeExecutionData[] {
    const { nodeExecutionOrder, nodeResults } = executionData;

    if (nodeExecutionOrder.length === 0) {
      return [{ json: {} }];
    }

    // Walk backwards through execution order to find the last node with output data
    for (let i = nodeExecutionOrder.length - 1; i >= 0; i--) {
      const nodeId = nodeExecutionOrder[i];
      const result = nodeResults[nodeId];

      if (result && result.data && result.data.length > 0 && result.data[0].length > 0) {
        return result.data[0];
      }
    }

    return [{ json: {} }];
  }

  /**
   * Tracks a sub-execution under a parent execution so it can be
   * cancelled if the parent is cancelled.
   */
  private trackSubExecution(parentExecutionId: string, subExecutionId: string): void {
    let subs = this.activeSubExecutions.get(parentExecutionId);
    if (!subs) {
      subs = new Set();
      this.activeSubExecutions.set(parentExecutionId, subs);
    }
    subs.add(subExecutionId);
  }

  /**
   * Removes a sub-execution from tracking when it completes.
   */
  private untrackSubExecution(parentExecutionId: string, subExecutionId: string): void {
    const subs = this.activeSubExecutions.get(parentExecutionId);
    if (subs) {
      subs.delete(subExecutionId);
      if (subs.size === 0) {
        this.activeSubExecutions.delete(parentExecutionId);
      }
    }
  }

  /**
   * Returns the set of active sub-execution IDs for a given parent.
   */
  getActiveSubExecutions(parentExecutionId: string): string[] {
    const subs = this.activeSubExecutions.get(parentExecutionId);
    return subs ? Array.from(subs) : [];
  }

  /**
   * Retrieves a nested value from an object using dot notation.
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current: any, key) => {
      if (current === null || current === undefined) return undefined;
      return current[key];
    }, obj);
  }

  /**
   * Sets a nested value in an object using dot notation, creating
   * intermediate objects as needed.
   */
  private setNestedValue(
    obj: Record<string, unknown>,
    path: string,
    value: unknown
  ): void {
    const keys = path.split('.');
    let current: any = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }
}
