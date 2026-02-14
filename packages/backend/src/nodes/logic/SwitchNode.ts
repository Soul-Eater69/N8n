import { INodeHandler, INodeExecutionContext } from '../../engine/NodeRegistry';
import { INodeTypeDescription, INodeExecutionResult, INodeExecutionData } from '@flowforge/shared';

const description: INodeTypeDescription = {
  type: 'logic.switch',
  displayName: 'Switch',
  description: 'Routes items to different outputs based on field value',
  icon: 'shuffle',
  category: 'logic',
  version: 1,
  inputs: [{ name: 'main', type: 'main' }],
  outputs: [
    { name: 'output0', type: 'main', displayName: 'Output 0' },
    { name: 'output1', type: 'main', displayName: 'Output 1' },
    { name: 'output2', type: 'main', displayName: 'Output 2' },
    { name: 'fallback', type: 'main', displayName: 'Fallback' },
  ],
  properties: [
    {
      name: 'field',
      displayName: 'Field to Switch On',
      type: 'string',
      default: '',
      required: true,
    },
    {
      name: 'rules',
      displayName: 'Routing Rules',
      type: 'json',
      default: '[]',
      description: 'JSON array of rules: [{"value": "x", "output": 0}]',
    },
  ],
  color: '#E17055',
};

export const SwitchNode: INodeHandler = {
  description,
  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    const { field, rules: rulesStr } = ctx.parameters as { field: string; rules: string };
    const rules = typeof rulesStr === 'string' ? JSON.parse(rulesStr) : rulesStr;

    const outputs: INodeExecutionData[][] = [[], [], [], []];

    for (const item of ctx.inputData) {
      const fieldValue = String(field.split('.').reduce((obj: any, key) => obj?.[key], item.json));
      let matched = false;

      for (const rule of rules as Array<{ value: string; output: number }>) {
        if (String(fieldValue) === String(rule.value)) {
          const outputIndex = Math.min(rule.output, outputs.length - 2);
          outputs[outputIndex].push(item);
          matched = true;
          break;
        }
      }

      if (!matched) {
        outputs[outputs.length - 1].push(item);
      }
    }

    return { data: outputs };
  },
};
