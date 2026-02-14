import { INodeHandler, INodeExecutionContext } from '../../engine/NodeRegistry';
import { INodeTypeDescription, INodeExecutionResult } from '@flowforge/shared';

const description: INodeTypeDescription = {
  type: 'utility.errorHandler',
  displayName: 'Error Handler',
  description: 'Catches and handles errors from connected nodes',
  icon: 'alert-triangle',
  category: 'utility',
  version: 1,
  inputs: [{ name: 'main', type: 'main' }],
  outputs: [
    { name: 'success', type: 'main', displayName: 'Success' },
    { name: 'error', type: 'main', displayName: 'Error' },
  ],
  properties: [
    {
      name: 'continueOnError',
      displayName: 'Continue on Error',
      type: 'boolean',
      default: true,
    },
    {
      name: 'errorMessage',
      displayName: 'Custom Error Message',
      type: 'string',
      default: '',
    },
  ],
  color: '#E74C3C',
};

export const ErrorHandlerNode: INodeHandler = {
  description,
  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    // Pass through data; error routing is handled by the engine
    return {
      data: [ctx.inputData, []],
    };
  },
};
