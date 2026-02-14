import { Queue, Worker, Job } from 'bullmq';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface ExecutionJobData {
  executionId: string;
  workflowId: string;
  tenantId: string;
  mode: string;
  triggerData?: Record<string, unknown>;
}

let executionQueue: Queue<ExecutionJobData>;
let scheduledQueue: Queue;
let executionWorker: Worker<ExecutionJobData>;

const redisConnection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  db: config.redis.db,
};

export function getExecutionQueue(): Queue<ExecutionJobData> {
  if (!executionQueue) {
    executionQueue = new Queue<ExecutionJobData>('workflow-executions', {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: config.queue.maxRetries,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });

    executionQueue.on('error', (err) => {
      logger.error({ err }, 'Execution queue error');
    });
  }
  return executionQueue;
}

export function getScheduledQueue(): Queue {
  if (!scheduledQueue) {
    scheduledQueue = new Queue('scheduled-workflows', {
      connection: redisConnection,
      defaultJobOptions: {
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    });
  }
  return scheduledQueue;
}

export function createExecutionWorker(
  processor: (job: Job<ExecutionJobData>) => Promise<void>
): Worker<ExecutionJobData> {
  executionWorker = new Worker<ExecutionJobData>(
    'workflow-executions',
    processor,
    {
      connection: redisConnection,
      concurrency: config.queue.concurrency,
      limiter: {
        max: config.execution.maxConcurrent,
        duration: 1000,
      },
    }
  );

  executionWorker.on('completed', (job) => {
    logger.info({ jobId: job.id, executionId: job.data.executionId }, 'Job completed');
  });

  executionWorker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, executionId: job?.data.executionId, err },
      'Job failed'
    );
  });

  executionWorker.on('error', (err) => {
    logger.error({ err }, 'Worker error');
  });

  return executionWorker;
}

export async function addExecutionJob(data: ExecutionJobData, priority = 0): Promise<string> {
  const queue = getExecutionQueue();
  const job = await queue.add('execute', data, {
    priority,
    jobId: data.executionId,
  });
  return job.id!;
}

export async function addScheduledJob(
  workflowId: string,
  tenantId: string,
  cronExpression: string
): Promise<void> {
  const queue = getScheduledQueue();
  await queue.add(
    `cron:${workflowId}`,
    { workflowId, tenantId },
    {
      repeat: { pattern: cronExpression },
      jobId: `cron:${workflowId}`,
    }
  );
  logger.info({ workflowId, cronExpression }, 'Scheduled job added');
}

export async function removeScheduledJob(workflowId: string): Promise<void> {
  const queue = getScheduledQueue();
  await queue.removeRepeatableByKey(`cron:${workflowId}`);
  logger.info({ workflowId }, 'Scheduled job removed');
}

export async function closeQueues(): Promise<void> {
  if (executionWorker) await executionWorker.close();
  if (executionQueue) await executionQueue.close();
  if (scheduledQueue) await scheduledQueue.close();
  logger.info('Queues closed');
}
