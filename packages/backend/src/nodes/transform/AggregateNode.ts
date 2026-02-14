import { INodeHandler, INodeExecutionContext } from '../../engine/NodeRegistry';
import { INodeTypeDescription, INodeExecutionResult } from '@flowforge/shared';

const description: INodeTypeDescription = {
  type: 'transform.aggregate',
  displayName: 'Aggregate',
  description: 'Aggregates items into a single item with summary statistics',
  icon: 'bar-chart-2',
  category: 'transform',
  version: 1,
  inputs: [{ name: 'main', type: 'main' }],
  outputs: [{ name: 'main', type: 'main' }],
  properties: [
    {
      name: 'operation',
      displayName: 'Operation',
      type: 'options',
      default: 'count',
      options: [
        { name: 'Count', value: 'count' },
        { name: 'Sum', value: 'sum' },
        { name: 'Average', value: 'average' },
        { name: 'Min', value: 'min' },
        { name: 'Max', value: 'max' },
        { name: 'Collect', value: 'collect' },
        { name: 'Group By', value: 'groupBy' },
      ],
    },
    {
      name: 'field',
      displayName: 'Field',
      type: 'string',
      default: '',
      description: 'Field to aggregate on',
    },
    {
      name: 'groupField',
      displayName: 'Group By Field',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['groupBy'] } },
    },
  ],
  color: '#81ECEC',
};

export const AggregateNode: INodeHandler = {
  description,
  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    const { operation, field, groupField } = ctx.parameters as Record<string, string>;
    const items = ctx.inputData;

    const getVal = (item: any) => field ? field.split('.').reduce((o: any, k: string) => o?.[k], item.json) : item.json;

    let result: unknown;

    switch (operation) {
      case 'count':
        result = { count: items.length };
        break;
      case 'sum':
        result = { sum: items.reduce((acc, item) => acc + Number(getVal(item) || 0), 0) };
        break;
      case 'average': {
        const sum = items.reduce((acc, item) => acc + Number(getVal(item) || 0), 0);
        result = { average: items.length ? sum / items.length : 0 };
        break;
      }
      case 'min':
        result = { min: Math.min(...items.map((item) => Number(getVal(item) || Infinity))) };
        break;
      case 'max':
        result = { max: Math.max(...items.map((item) => Number(getVal(item) || -Infinity))) };
        break;
      case 'collect':
        result = { values: items.map((item) => getVal(item)) };
        break;
      case 'groupBy': {
        const groups: Record<string, unknown[]> = {};
        for (const item of items) {
          const key = String(groupField.split('.').reduce((o: any, k: string) => o?.[k], item.json) ?? 'undefined');
          if (!groups[key]) groups[key] = [];
          groups[key].push(item.json);
        }
        result = { groups };
        break;
      }
      default:
        result = { items: items.map((i) => i.json) };
    }

    return { data: [[{ json: result as Record<string, unknown> }]] };
  },
};
