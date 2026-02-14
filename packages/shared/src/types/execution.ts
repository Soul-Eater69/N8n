import { INodeExecutionData } from './node';

export type ExecutionStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'error'
  | 'cancelled'
  | 'waiting'
  | 'retry';

export type ExecutionMode = 'manual' | 'trigger' | 'webhook' | 'retry' | 'sub_workflow';

export interface IExecution {
  id: string;
  workflowId: string;
  status: ExecutionStatus;
  mode: ExecutionMode;
  startedAt: string;
  finishedAt?: string;
  data: IExecutionData;
  error?: IExecutionError;
  retryOf?: string;
  retrySuccessId?: string;
  tenantId: string;
  triggeredBy?: string;
  workerId?: string;
}

export interface IExecutionData {
  nodeExecutionOrder: string[];
  nodeResults: Record<string, INodeRunResult>;
  triggerData?: INodeExecutionData[];
  metadata?: Record<string, unknown>;
}

export interface INodeRunResult {
  nodeId: string;
  nodeType: string;
  startTime: number;
  endTime?: number;
  status: ExecutionStatus;
  data?: INodeExecutionData[][];
  error?: IExecutionError;
  retryCount?: number;
}

export interface IExecutionError {
  message: string;
  stack?: string;
  nodeId?: string;
  description?: string;
  code?: string;
}

export interface IExecutionFilters {
  workflowId?: string;
  status?: ExecutionStatus;
  mode?: ExecutionMode;
  startedAfter?: string;
  startedBefore?: string;
  limit?: number;
  offset?: number;
}

export interface IExecutionSummary {
  id: string;
  workflowId: string;
  workflowName: string;
  status: ExecutionStatus;
  mode: ExecutionMode;
  startedAt: string;
  finishedAt?: string;
  duration?: number;
  nodeCount: number;
  error?: string;
}
