export type NodeCategory =
  | 'triggers'
  | 'actions'
  | 'logic'
  | 'transform'
  | 'integration'
  | 'utility'
  | 'ai';

export type TriggerType = 'webhook' | 'cron' | 'event' | 'manual' | 'polling';

export type ParameterType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'options'
  | 'json'
  | 'collection'
  | 'expression'
  | 'credential';

export interface INodeTypeDescription {
  type: string;
  displayName: string;
  description: string;
  icon: string;
  category: NodeCategory;
  version: number;
  inputs: INodeIO[];
  outputs: INodeIO[];
  properties: INodeProperty[];
  credentials?: INodeCredentialDescription[];
  triggerType?: TriggerType;
  polling?: {
    interval: number;
  };
  subtitle?: string;
  color?: string;
  group?: string[];
  defaults?: Record<string, unknown>;
}

export interface INodeIO {
  name: string;
  type: 'main' | 'ai';
  displayName?: string;
  required?: boolean;
}

export interface INodeProperty {
  name: string;
  displayName: string;
  type: ParameterType;
  default?: unknown;
  description?: string;
  required?: boolean;
  options?: INodePropertyOption[];
  placeholder?: string;
  displayOptions?: {
    show?: Record<string, unknown[]>;
    hide?: Record<string, unknown[]>;
  };
  typeOptions?: Record<string, unknown>;
}

export interface INodePropertyOption {
  name: string;
  value: string | number | boolean;
  description?: string;
}

export interface INodeCredentialDescription {
  name: string;
  required: boolean;
}

export interface INodeExecutionData {
  json: Record<string, unknown>;
  binary?: Record<string, IBinaryData>;
  pairedItem?: { item: number };
}

export interface IBinaryData {
  data: string;
  mimeType: string;
  fileName?: string;
  fileSize?: number;
}

export interface INodeExecutionResult {
  data: INodeExecutionData[][];
  metadata?: Record<string, unknown>;
}
