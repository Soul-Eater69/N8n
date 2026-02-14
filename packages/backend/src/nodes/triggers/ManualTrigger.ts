import { INodeHandler, INodeExecutionContext } from '../../engine/NodeRegistry';
import { INodeTypeDescription, INodeExecutionResult } from '@flowforge/shared';

const description: INodeTypeDescription = {
  type: 'trigger.manual',
  displayName: 'Manual Trigger',
  description: 'Starts the workflow manually',
  icon: 'play-circle',
  category: 'triggers',
  version: 1,
  inputs: [],
  outputs: [{ name: 'main', type: 'main' }],
  properties: [],
  triggerType: 'manual',
  color: '#00B894',
};

export const ManualTriggerNode: INodeHandler = {
  description,
  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    return {
      data: [ctx.inputData],
    };
  },
};
