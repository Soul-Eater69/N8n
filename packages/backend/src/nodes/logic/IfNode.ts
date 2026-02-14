import { INodeHandler, INodeExecutionContext } from '../../engine/NodeRegistry';
import { INodeTypeDescription, INodeExecutionResult, INodeExecutionData } from '@flowforge/shared';

const description: INodeTypeDescription = {
  type: 'logic.if',
  displayName: 'IF',
  description: 'Routes items based on a condition',
  icon: 'git-branch',
  category: 'logic',
  version: 1,
  inputs: [{ name: 'main', type: 'main' }],
  outputs: [
    { name: 'true', type: 'main', displayName: 'True' },
    { name: 'false', type: 'main', displayName: 'False' },
  ],
  properties: [
    {
      name: 'field',
      displayName: 'Field',
      type: 'string',
      default: '',
      required: true,
      description: 'The field to evaluate',
    },
    {
      name: 'operation',
      displayName: 'Operation',
      type: 'options',
      default: 'equals',
      options: [
        { name: 'Equals', value: 'equals' },
        { name: 'Not Equals', value: 'notEquals' },
        { name: 'Greater Than', value: 'greaterThan' },
        { name: 'Less Than', value: 'lessThan' },
        { name: 'Contains', value: 'contains' },
        { name: 'Not Contains', value: 'notContains' },
        { name: 'Is Empty', value: 'isEmpty' },
        { name: 'Is Not Empty', value: 'isNotEmpty' },
        { name: 'Exists', value: 'exists' },
        { name: 'Regex Match', value: 'regex' },
      ],
    },
    {
      name: 'value',
      displayName: 'Value',
      type: 'string',
      default: '',
      description: 'The value to compare against',
    },
  ],
  color: '#FDCB6E',
};

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((current: any, key) => current?.[key], obj);
}

function evaluateCondition(fieldValue: unknown, operation: string, compareValue: string): boolean {
  switch (operation) {
    case 'equals': return String(fieldValue) === compareValue;
    case 'notEquals': return String(fieldValue) !== compareValue;
    case 'greaterThan': return Number(fieldValue) > Number(compareValue);
    case 'lessThan': return Number(fieldValue) < Number(compareValue);
    case 'contains': return String(fieldValue).includes(compareValue);
    case 'notContains': return !String(fieldValue).includes(compareValue);
    case 'isEmpty': return fieldValue === '' || fieldValue === null || fieldValue === undefined;
    case 'isNotEmpty': return fieldValue !== '' && fieldValue !== null && fieldValue !== undefined;
    case 'exists': return fieldValue !== undefined;
    case 'regex': return new RegExp(compareValue).test(String(fieldValue));
    default: return false;
  }
}

export const IfNode: INodeHandler = {
  description,
  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    const { field, operation, value } = ctx.parameters as {
      field: string;
      operation: string;
      value: string;
    };

    const trueItems: INodeExecutionData[] = [];
    const falseItems: INodeExecutionData[] = [];

    for (const item of ctx.inputData) {
      const fieldValue = getNestedValue(item.json, field);
      if (evaluateCondition(fieldValue, operation, value)) {
        trueItems.push(item);
      } else {
        falseItems.push(item);
      }
    }

    return {
      data: [trueItems, falseItems],
    };
  },
};
