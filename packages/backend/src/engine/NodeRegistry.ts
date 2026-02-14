import { INodeTypeDescription, INodeExecutionData, INodeExecutionResult } from '@flowforge/shared';
import { logger } from '../utils/logger';

export interface INodeHandler {
  description: INodeTypeDescription;
  execute(context: INodeExecutionContext): Promise<INodeExecutionResult>;
}

export interface INodeExecutionContext {
  node: any;
  inputData: INodeExecutionData[];
  parameters: Record<string, unknown>;
  credentials: Record<string, unknown>;
  context: {
    executionId: string;
    workflowId: string;
    tenantId: string;
    mode: string;
  };
}

export class NodeRegistry {
  private static instance: NodeRegistry;
  private nodes = new Map<string, INodeHandler>();

  private constructor() {}

  static getInstance(): NodeRegistry {
    if (!NodeRegistry.instance) {
      NodeRegistry.instance = new NodeRegistry();
    }
    return NodeRegistry.instance;
  }

  register(handler: INodeHandler): void {
    const { type } = handler.description;
    if (this.nodes.has(type)) {
      logger.warn({ nodeType: type }, 'Overwriting existing node registration');
    }
    this.nodes.set(type, handler);
    logger.info({ nodeType: type }, 'Node registered');
  }

  getHandler(type: string): INodeHandler {
    const handler = this.nodes.get(type);
    if (!handler) {
      throw new Error(`Node type '${type}' not found in registry`);
    }
    return handler;
  }

  getDescription(type: string): INodeTypeDescription {
    return this.getHandler(type).description;
  }

  getAllDescriptions(): INodeTypeDescription[] {
    return Array.from(this.nodes.values()).map((n) => n.description);
  }

  getByCategory(category: string): INodeTypeDescription[] {
    return this.getAllDescriptions().filter((d) => d.category === category);
  }

  has(type: string): boolean {
    return this.nodes.has(type);
  }

  getCount(): number {
    return this.nodes.size;
  }
}
