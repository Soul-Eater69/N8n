import { INodeHandler, INodeExecutionContext } from '../../engine/NodeRegistry';
import { INodeTypeDescription, INodeExecutionResult, INodeExecutionData } from '@flowforge/shared';

const description: INodeTypeDescription = {
  type: 'logic.loop',
  displayName: 'Loop',
  description: 'Iterates over items and processes them individually',
  icon: 'repeat',
  category: 'logic',
  version: 1,
  inputs: [{ name: 'main', type: 'main' }],
  outputs: [{ name: 'main', type: 'main' }],
  properties: [
    {
      name: 'batchSize',
      displayName: 'Batch Size',
      type: 'number',
      default: 1,
      description: 'Number of items to process in each batch',
    },
  ],
  color: '#A29BFE',
};

export const LoopNode: INodeHandler = {
  description,
  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    const batchSize = (ctx.parameters.batchSize as number) || 1;
    const items = ctx.inputData;
    const results: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      results.push(...batch.map((item, idx) => ({
        json: {
          ...item.json,
          _loopIndex: i + idx,
          _batchIndex: Math.floor(i / batchSize),
          _isFirst: i + idx === 0,
          _isLast: i + idx === items.length - 1,
        },
      })));
    }

    return { data: [results] };
  },
};
