import { INodeHandler, INodeExecutionContext } from '../../engine/NodeRegistry';
import { INodeTypeDescription, INodeExecutionResult, INodeExecutionData } from '@flowforge/shared';

const description: INodeTypeDescription = {
  type: 'logic.merge',
  displayName: 'Merge',
  description: 'Merges data from multiple inputs',
  icon: 'git-merge',
  category: 'logic',
  version: 1,
  inputs: [
    { name: 'input1', type: 'main', displayName: 'Input 1' },
    { name: 'input2', type: 'main', displayName: 'Input 2' },
  ],
  outputs: [{ name: 'main', type: 'main' }],
  properties: [
    {
      name: 'mode',
      displayName: 'Mode',
      type: 'options',
      default: 'append',
      options: [
        { name: 'Append', value: 'append', description: 'Combine all items into one list' },
        { name: 'Merge by Index', value: 'mergeByIndex', description: 'Merge items by their position' },
        { name: 'Merge by Field', value: 'mergeByField', description: 'Merge items by matching field values' },
        { name: 'Keep Key Matches', value: 'keepKeyMatches', description: 'Only keep items that exist in both inputs' },
      ],
    },
    {
      name: 'mergeField',
      displayName: 'Merge Field',
      type: 'string',
      default: 'id',
      displayOptions: {
        show: { mode: ['mergeByField', 'keepKeyMatches'] },
      },
    },
  ],
  color: '#00CEC9',
};

export const MergeNode: INodeHandler = {
  description,
  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    const mode = ctx.parameters.mode as string;
    const items = ctx.inputData;

    // For simplicity, treat all input as one combined list
    switch (mode) {
      case 'append':
        return { data: [items] };

      case 'mergeByIndex': {
        const midpoint = Math.ceil(items.length / 2);
        const merged: INodeExecutionData[] = [];
        for (let i = 0; i < midpoint; i++) {
          const item1 = items[i]?.json || {};
          const item2 = items[i + midpoint]?.json || {};
          merged.push({ json: { ...item1, ...item2 } });
        }
        return { data: [merged] };
      }

      case 'mergeByField': {
        const field = ctx.parameters.mergeField as string;
        const map = new Map<string, Record<string, unknown>>();
        for (const item of items) {
          const key = String(item.json[field]);
          map.set(key, { ...(map.get(key) || {}), ...item.json });
        }
        return { data: [Array.from(map.values()).map((json) => ({ json }))] };
      }

      default:
        return { data: [items] };
    }
  },
};
