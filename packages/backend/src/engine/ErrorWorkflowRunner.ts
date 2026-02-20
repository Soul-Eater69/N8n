import { INodeExecutionData } from '@flowforge/shared';
import { generateId } from '../utils/helpers';
import { logger } from '../utils/logger';

export interface ErrorWorkflowData {
  /** The error message from the failed execution */
  message: string;
  /** The stack trace of the error, if available */
  stack?: string;
  /** The ID of the node that failed, if applicable */
  failedNodeId?: string;
  /** The name of the node that failed, if applicable */
  failedNodeName?: string;
  /** The type of the node that failed, if applicable */
  failedNodeType?: string;
  /** The execution ID of the failed workflow run */
  executionId: string;
  /** The workflow ID that failed */
  workflowId: string;
  /** The workflow name that failed */
  workflowName?: string;
  /** ISO timestamp of when the error occurred */
  timestamp: string;
  /** The execution mode that was active when the error occurred */
  executionMode?: string;
}

/**
 * ErrorWorkflowRunner handles the execution of error workflows when a
 * primary workflow fails.
 *
 * When a workflow has an `errorWorkflowId` configured in its settings,
 * this runner will trigger that error workflow with the error data,
 * allowing users to set up notifications, logging, or remediation
 * logic for workflow failures.
 *
 * Key design decisions:
 * - Error workflows are executed asynchronously (fire-and-forget) so
 *   they do not block or affect the original workflow's error handling.
 * - A registry of active error workflow IDs prevents recursive error
 *   handling (i.e., an error workflow failing and triggering itself).
 * - Error data is passed as trigger data to the error workflow's
 *   trigger node (typically an ErrorTriggerNode).
 */
export class ErrorWorkflowRunner {
  /**
   * Set of error workflow IDs currently being executed. Used to
   * prevent recursive loops where an error workflow's failure
   * triggers itself again.
   */
  private activeErrorWorkflows = new Set<string>();

  /**
   * Executes the designated error workflow for a failed workflow execution.
   *
   * This method is fire-and-forget: it does not throw errors and does
   * not return execution results. All failures during error workflow
   * execution are logged but silently swallowed to prevent cascading
   * failures.
   *
   * @param errorWorkflowId - The ID of the workflow to execute as the error handler
   * @param errorData - The error information from the failed workflow
   * @param tenantId - The tenant scope for fetching the error workflow
   */
  async executeErrorWorkflow(
    errorWorkflowId: string,
    errorData: ErrorWorkflowData,
    tenantId: string
  ): Promise<void> {
    // Guard against recursive error workflow execution
    if (this.activeErrorWorkflows.has(errorWorkflowId)) {
      logger.warn(
        {
          errorWorkflowId,
          originalExecutionId: errorData.executionId,
          originalWorkflowId: errorData.workflowId,
        },
        'Skipping error workflow execution to prevent recursion: ' +
        'this error workflow is already running'
      );
      return;
    }

    logger.info(
      {
        errorWorkflowId,
        originalExecutionId: errorData.executionId,
        originalWorkflowId: errorData.workflowId,
        errorMessage: errorData.message,
      },
      'Triggering error workflow'
    );

    this.activeErrorWorkflows.add(errorWorkflowId);

    // Fire and forget - do not await, do not throw
    this.runErrorWorkflow(errorWorkflowId, errorData, tenantId)
      .catch((err) => {
        logger.error(
          {
            errorWorkflowId,
            originalExecutionId: errorData.executionId,
            error: err.message,
          },
          'Error workflow execution failed'
        );
      })
      .finally(() => {
        this.activeErrorWorkflows.delete(errorWorkflowId);
      });
  }

  /**
   * Internal method that performs the actual error workflow execution.
   * Dynamically imports dependencies to avoid circular references.
   */
  private async runErrorWorkflow(
    errorWorkflowId: string,
    errorData: ErrorWorkflowData,
    tenantId: string
  ): Promise<void> {
    // Dynamic imports to avoid circular dependencies
    const { WorkflowService } = await import('../services/workflow.service');
    const { WorkflowEngine } = await import('./WorkflowEngine');
    const { ExecutionService } = await import('../services/execution.service');

    const workflowService = new WorkflowService();
    const executionService = new ExecutionService();
    const engine = new WorkflowEngine();

    // Fetch the error workflow
    let errorWorkflow;
    try {
      errorWorkflow = await workflowService.getById(errorWorkflowId, tenantId);
    } catch (fetchError: any) {
      logger.error(
        {
          errorWorkflowId,
          tenantId,
          error: fetchError.message,
        },
        'Failed to fetch error workflow - it may have been deleted'
      );
      return;
    }

    // Build the trigger data from the error information
    const triggerData: INodeExecutionData[] = [
      {
        json: {
          error: {
            message: errorData.message,
            stack: errorData.stack,
            timestamp: errorData.timestamp,
          },
          execution: {
            id: errorData.executionId,
            mode: errorData.executionMode,
          },
          workflow: {
            id: errorData.workflowId,
            name: errorData.workflowName,
          },
          node: errorData.failedNodeId
            ? {
                id: errorData.failedNodeId,
                name: errorData.failedNodeName,
                type: errorData.failedNodeType,
              }
            : undefined,
        },
      },
    ];

    const errorExecutionId = generateId();

    // Create an execution record for the error workflow
    await executionService.create(
      errorWorkflowId,
      tenantId,
      'trigger',
      undefined
    );

    // Execute the error workflow
    await engine.execute(errorWorkflow, {
      executionId: errorExecutionId,
      workflowId: errorWorkflowId,
      tenantId,
      mode: 'trigger',
      triggerData,
    });

    logger.info(
      {
        errorWorkflowId,
        errorExecutionId,
        originalExecutionId: errorData.executionId,
      },
      'Error workflow executed successfully'
    );
  }

  /**
   * Checks whether a given workflow ID is currently being executed as
   * an error workflow. Useful for the engine to decide whether to
   * trigger the error workflow for a failure.
   */
  isErrorWorkflowActive(workflowId: string): boolean {
    return this.activeErrorWorkflows.has(workflowId);
  }

  /**
   * Returns the number of error workflows currently being executed.
   */
  getActiveCount(): number {
    return this.activeErrorWorkflows.size;
  }

  /**
   * Builds the ErrorWorkflowData payload from an execution error.
   * This is a convenience method that can be called from the worker
   * or engine when a workflow fails.
   */
  static buildErrorData(params: {
    error: { message: string; stack?: string; nodeId?: string };
    executionId: string;
    workflowId: string;
    workflowName?: string;
    nodeName?: string;
    nodeType?: string;
    executionMode?: string;
  }): ErrorWorkflowData {
    return {
      message: params.error.message,
      stack: params.error.stack,
      failedNodeId: params.error.nodeId,
      failedNodeName: params.nodeName,
      failedNodeType: params.nodeType,
      executionId: params.executionId,
      workflowId: params.workflowId,
      workflowName: params.workflowName,
      timestamp: new Date().toISOString(),
      executionMode: params.executionMode,
    };
  }
}
