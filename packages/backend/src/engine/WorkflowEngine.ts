import { IWorkflow, INodeExecutionData, IExecutionData, INodeRunResult, ExecutionStatus } from '@flowforge/shared';
import { toposort, sleep } from '../utils/helpers';
import { ExecutionError } from '../utils/errors';
import { logger } from '../utils/logger';
import { NodeRegistry } from './NodeRegistry';
import { ExpressionEvaluator } from './ExpressionEvaluator';
import { ExecutionService } from '../services/execution.service';
import { CredentialService } from '../services/credential.service';
import { EventEmitter } from 'events';

export interface ExecutionContext {
  executionId: string;
  workflowId: string;
  tenantId: string;
  mode: string;
  triggerData?: INodeExecutionData[];
  abortSignal?: AbortSignal;
}

export class WorkflowEngine extends EventEmitter {
  private nodeRegistry: NodeRegistry;
  private expressionEvaluator: ExpressionEvaluator;
  private executionService: ExecutionService;
  private credentialService: CredentialService;
  private activeExecutions = new Map<string, AbortController>();

  constructor() {
    super();
    this.nodeRegistry = NodeRegistry.getInstance();
    this.expressionEvaluator = new ExpressionEvaluator();
    this.executionService = new ExecutionService();
    this.credentialService = new CredentialService();
  }

  async execute(workflow: IWorkflow, context: ExecutionContext): Promise<IExecutionData> {
    const { executionId, tenantId } = context;
    const abortController = new AbortController();
    this.activeExecutions.set(executionId, abortController);

    const executionData: IExecutionData = {
      nodeExecutionOrder: [],
      nodeResults: {},
      triggerData: context.triggerData,
    };

    try {
      await this.executionService.updateStatus(executionId, 'running');
      this.emit('execution:started', { executionId, workflowId: workflow.id });

      // Build DAG and get execution order
      const executionOrder = this.getExecutionOrder(workflow);
      logger.info({ executionId, nodeCount: executionOrder.length }, 'Starting workflow execution');

      // Execute nodes in topological order
      const nodeOutputs = new Map<string, INodeExecutionData[][]>();

      for (const nodeId of executionOrder) {
        if (abortController.signal.aborted) {
          throw new ExecutionError('Execution was cancelled', nodeId);
        }

        const node = workflow.nodes.find((n) => n.id === nodeId);
        if (!node) continue;
        if (node.disabled) {
          logger.info({ executionId, nodeId }, 'Skipping disabled node');
          continue;
        }

        const nodeResult = await this.executeNode(
          node,
          workflow,
          nodeOutputs,
          context,
          tenantId
        );

        executionData.nodeExecutionOrder.push(nodeId);
        executionData.nodeResults[nodeId] = nodeResult;

        if (nodeResult.data) {
          nodeOutputs.set(nodeId, nodeResult.data);
        }

        this.emit('node:completed', {
          executionId,
          nodeId,
          status: nodeResult.status,
        });

        if (nodeResult.status === 'error' && !node.continueOnFail) {
          throw new ExecutionError(
            nodeResult.error?.message || 'Node execution failed',
            nodeId
          );
        }
      }

      await this.executionService.updateStatus(executionId, 'success', executionData);
      this.emit('execution:completed', { executionId, status: 'success' });

      logger.info({ executionId }, 'Workflow execution completed successfully');
      return executionData;
    } catch (error: any) {
      const errorInfo = {
        message: error.message,
        nodeId: error instanceof ExecutionError ? error.nodeId : undefined,
        stack: error.stack,
      };

      await this.executionService.setError(executionId, errorInfo);
      this.emit('execution:error', { executionId, error: errorInfo });

      logger.error({ executionId, error: errorInfo }, 'Workflow execution failed');
      throw error;
    } finally {
      this.activeExecutions.delete(executionId);
    }
  }

  private async executeNode(
    node: any,
    workflow: IWorkflow,
    nodeOutputs: Map<string, INodeExecutionData[][]>,
    context: ExecutionContext,
    tenantId: string
  ): Promise<INodeRunResult> {
    const startTime = Date.now();

    this.emit('node:executing', {
      executionId: context.executionId,
      nodeId: node.id,
      nodeType: node.type,
    });

    try {
      // Get input data from connected nodes
      const inputData = this.getNodeInputData(node.id, workflow, nodeOutputs, context);

      // Resolve expressions in parameters
      const resolvedParams = this.expressionEvaluator.resolveNodeParameters(
        node.parameters,
        inputData,
        nodeOutputs
      );

      // Resolve credentials
      let credentials: Record<string, unknown> = {};
      if (node.credentials) {
        for (const [key, credId] of Object.entries(node.credentials)) {
          credentials[key] = await this.credentialService.getDecryptedData(
            credId as string,
            tenantId
          );
        }
      }

      // Get the node handler and execute
      const handler = this.nodeRegistry.getHandler(node.type);
      const result = await handler.execute({
        node,
        inputData,
        parameters: resolvedParams,
        credentials,
        context: {
          executionId: context.executionId,
          workflowId: workflow.id,
          tenantId,
          mode: context.mode,
        },
      });

      return {
        nodeId: node.id,
        nodeType: node.type,
        startTime,
        endTime: Date.now(),
        status: 'success',
        data: result.data,
      };
    } catch (error: any) {
      logger.error({ nodeId: node.id, error: error.message }, 'Node execution failed');

      // Retry logic
      if (node.retryOnFail && node.maxRetries) {
        for (let attempt = 1; attempt <= node.maxRetries; attempt++) {
          try {
            await sleep(node.retryInterval || 1000);
            const inputData = this.getNodeInputData(node.id, workflow, nodeOutputs, context);
            const handler = this.nodeRegistry.getHandler(node.type);
            const result = await handler.execute({
              node,
              inputData,
              parameters: node.parameters,
              credentials: {},
              context: {
                executionId: context.executionId,
                workflowId: workflow.id,
                tenantId,
                mode: context.mode,
              },
            });

            return {
              nodeId: node.id,
              nodeType: node.type,
              startTime,
              endTime: Date.now(),
              status: 'success',
              data: result.data,
              retryCount: attempt,
            };
          } catch {
            if (attempt === node.maxRetries) break;
          }
        }
      }

      return {
        nodeId: node.id,
        nodeType: node.type,
        startTime,
        endTime: Date.now(),
        status: 'error',
        error: {
          message: error.message,
          nodeId: node.id,
          stack: error.stack,
        },
      };
    }
  }

  private getNodeInputData(
    nodeId: string,
    workflow: IWorkflow,
    nodeOutputs: Map<string, INodeExecutionData[][]>,
    context: ExecutionContext
  ): INodeExecutionData[] {
    const incomingConnections = workflow.connections.filter(
      (c) => c.targetNodeId === nodeId
    );

    if (incomingConnections.length === 0) {
      // Trigger node - use trigger data
      return context.triggerData || [{ json: {} }];
    }

    const inputData: INodeExecutionData[] = [];
    for (const conn of incomingConnections) {
      const sourceOutput = nodeOutputs.get(conn.sourceNodeId);
      if (sourceOutput && sourceOutput[0]) {
        inputData.push(...sourceOutput[0]);
      }
    }

    return inputData.length > 0 ? inputData : [{ json: {} }];
  }

  private getExecutionOrder(workflow: IWorkflow): string[] {
    const nodeIds = workflow.nodes.map((n) => n.id);
    const edges: [string, string][] = workflow.connections.map((c) => [
      c.sourceNodeId,
      c.targetNodeId,
    ]);

    return toposort(nodeIds, edges);
  }

  cancelExecution(executionId: string): boolean {
    const controller = this.activeExecutions.get(executionId);
    if (controller) {
      controller.abort();
      return true;
    }
    return false;
  }

  getActiveExecutionCount(): number {
    return this.activeExecutions.size;
  }
}
