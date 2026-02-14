import { INodeHandler, INodeExecutionContext } from '../../engine/NodeRegistry';
import { INodeTypeDescription, INodeExecutionResult, INodeExecutionData } from '@flowforge/shared';

const description: INodeTypeDescription = {
  type: 'transform.set',
  displayName: 'Set',
  description: 'Sets values on each item',
  icon: 'edit-3',
  category: 'transform',
  version: 1,
  inputs: [{ name: 'main', type: 'main' }],
  outputs: [{ name: 'main', type: 'main' }],
  properties: [
    {
      name: 'mode',
      displayName: 'Mode',
      type: 'options',
      default: 'manual',
      options: [
        { name: 'Manual', value: 'manual' },
        { name: 'JSON', value: 'json' },
      ],
    },
    {
      name: 'fields',
      displayName: 'Fields to Set',
      type: 'json',
      default: '{}',
      description: 'JSON object of field names and values to set',
    },
    {
      name: 'keepOnlySet',
      displayName: 'Keep Only Set Fields',
      type: 'boolean',
      default: false,
    },
  ],
  color: '#00B894',
};

export const SetNode: INodeHandler = {
  description,
  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    const { fields: fieldsStr, keepOnlySet } = ctx.parameters;
    const fields = typeof fieldsStr === 'string' ? JSON.parse(fieldsStr as string) : fieldsStr || {};

    const results: INodeExecutionData[] = ctx.inputData.map((item) => ({
      json: keepOnlySet ? { ...fields } : { ...item.json, ...fields },
      binary: item.binary,
    }));

    return { data: [results] };
  },
};
