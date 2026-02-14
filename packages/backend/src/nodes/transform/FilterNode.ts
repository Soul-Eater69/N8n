import { INodeHandler, INodeExecutionContext } from '../../engine/NodeRegistry';
import { INodeTypeDescription, INodeExecutionResult, INodeExecutionData } from '@flowforge/shared';

const description: INodeTypeDescription = {
  type: 'transform.filter',
  displayName: 'Filter',
  description: 'Filters items based on conditions',
  icon: 'filter',
  category: 'transform',
  version: 1,
  inputs: [{ name: 'main', type: 'main' }],
  outputs: [
    { name: 'kept', type: 'main', displayName: 'Kept' },
    { name: 'discarded', type: 'main', displayName: 'Discarded' },
  ],
  properties: [
    {
      name: 'field',
      displayName: 'Field',
      type: 'string',
      default: '',
      required: true,
    },
    {
      name: 'operation',
      displayName: 'Operation',
      type: 'options',
      default: 'exists',
      options: [
        { name: 'Exists', value: 'exists' },
        { name: 'Equals', value: 'equals' },
        { name: 'Not Equals', value: 'notEquals' },
        { name: 'Greater Than', value: 'greaterThan' },
        { name: 'Less Than', value: 'lessThan' },
        { name: 'Contains', value: 'contains' },
        { name: 'Regex', value: 'regex' },
      ],
    },
    {
      name: 'value',
      displayName: 'Value',
      type: 'string',
      default: '',
    },
  ],
  color: '#D63031',
};

export const FilterNode: INodeHandler = {
  description,
  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    const { field, operation, value } = ctx.parameters as Record<string, string>;

    const kept: INodeExecutionData[] = [];
    const discarded: INodeExecutionData[] = [];

    for (const item of ctx.inputData) {
      const fieldValue = field.split('.').reduce((obj: any, key: string) => obj?.[key], item.json);
      let match = false;

      switch (operation) {
        case 'exists': match = fieldValue !== undefined && fieldValue !== null; break;
        case 'equals': match = String(fieldValue) === value; break;
        case 'notEquals': match = String(fieldValue) !== value; break;
        case 'greaterThan': match = Number(fieldValue) > Number(value); break;
        case 'lessThan': match = Number(fieldValue) < Number(value); break;
        case 'contains': match = String(fieldValue).includes(value); break;
        case 'regex': match = new RegExp(value).test(String(fieldValue)); break;
      }

      (match ? kept : discarded).push(item);
    }

    return { data: [kept, discarded] };
  },
};
