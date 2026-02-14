export type WorkflowStatus = 'draft' | 'active' | 'inactive' | 'error';

export interface IWorkflow {
  id: string;
  name: string;
  description?: string;
  nodes: IWorkflowNode[];
  connections: IConnection[];
  settings: IWorkflowSettings;
  status: WorkflowStatus;
  tags: string[];
  tenantId: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface IWorkflowNode {
  id: string;
  type: string;
  name: string;
  position: { x: number; y: number };
  parameters: Record<string, unknown>;
  credentials?: Record<string, string>;
  disabled?: boolean;
  notes?: string;
  retryOnFail?: boolean;
  maxRetries?: number;
  retryInterval?: number;
  continueOnFail?: boolean;
}

export interface IConnection {
  id: string;
  sourceNodeId: string;
  sourceOutput: string;
  targetNodeId: string;
  targetInput: string;
}

export interface IWorkflowSettings {
  executionTimeout?: number;
  maxExecutionRetries?: number;
  saveExecutionData?: boolean;
  timezone?: string;
  errorWorkflowId?: string;
  callerPolicy?: 'any' | 'workflowsFromSameOwner' | 'none';
}

export interface IWorkflowCreateInput {
  name: string;
  description?: string;
  nodes?: IWorkflowNode[];
  connections?: IConnection[];
  settings?: Partial<IWorkflowSettings>;
  tags?: string[];
}

export interface IWorkflowUpdateInput {
  name?: string;
  description?: string;
  nodes?: IWorkflowNode[];
  connections?: IConnection[];
  settings?: Partial<IWorkflowSettings>;
  status?: WorkflowStatus;
  tags?: string[];
}
