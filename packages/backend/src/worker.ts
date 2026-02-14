import { Job } from 'bullmq';
import { WorkflowEngine } from './engine/WorkflowEngine';
import { WorkflowService } from './services/workflow.service';
import { ExecutionService } from './services/execution.service';
import { ExecutionJobData, createExecutionWorker } from './services/queue.service';
import { emitToExecution, emitToTenant } from './services/websocket.service';
import { logger } from './utils/logger';

const workflowEngine = new WorkflowEngine();
const workflowService = new WorkflowService();
const executionService = new ExecutionService();

export function startWorker(): void {
  const worker = createExecutionWorker(processExecution);

  // Wire up engine events to WebSocket broadcasts
  workflowEngine.on('execution:started', ({ executionId, workflowId }) => {
    emitToExecution(executionId, 'execution:started', { executionId, workflowId });
  });

  workflowEngine.on('node:executing', ({ executionId, nodeId, nodeType }) => {
    emitToExecution(executionId, 'node:executing', { executionId, nodeId, nodeType });
  });

  workflowEngine.on('node:completed', ({ executionId, nodeId, status }) => {
    emitToExecution(executionId, 'node:completed', { executionId, nodeId, status });
  });

  workflowEngine.on('execution:completed', ({ executionId, status }) => {
    emitToExecution(executionId, 'execution:completed', { executionId, status });
  });

  workflowEngine.on('execution:error', ({ executionId, error }) => {
    emitToExecution(executionId, 'execution:error', { executionId, error });
  });

  logger.info('Execution worker started');
}

async function processExecution(job: Job<ExecutionJobData>): Promise<void> {
  const { executionId, workflowId, tenantId, mode, triggerData } = job.data;

  logger.info({ executionId, workflowId, mode }, 'Processing execution job');

  try {
    const workflow = await workflowService.getById(workflowId, tenantId);

    const triggerItems = triggerData
      ? [{ json: triggerData as Record<string, unknown> }]
      : undefined;

    await workflowEngine.execute(workflow, {
      executionId,
      workflowId,
      tenantId,
      mode,
      triggerData: triggerItems,
    });

    emitToTenant(tenantId, 'execution:completed', {
      executionId,
      workflowId,
      status: 'success',
    });
  } catch (error: any) {
    logger.error({ executionId, error: error.message }, 'Execution job failed');

    emitToTenant(tenantId, 'execution:error', {
      executionId,
      workflowId,
      error: error.message,
    });

    throw error; // Let BullMQ handle retries
  }
}
