import { INodeHandler, INodeExecutionContext } from '../../engine/NodeRegistry';
import { INodeTypeDescription, INodeExecutionResult } from '@flowforge/shared';
import { sleep } from '../../utils/helpers';

const description: INodeTypeDescription = {
  type: 'utility.delay',
  displayName: 'Wait',
  description: 'Waits for a specified amount of time before continuing',
  icon: 'clock',
  category: 'utility',
  version: 1,
  inputs: [{ name: 'main', type: 'main' }],
  outputs: [{ name: 'main', type: 'main' }],
  properties: [
    {
      name: 'duration',
      displayName: 'Duration',
      type: 'number',
      default: 1000,
      description: 'Wait time in milliseconds',
    },
    {
      name: 'unit',
      displayName: 'Unit',
      type: 'options',
      default: 'milliseconds',
      options: [
        { name: 'Milliseconds', value: 'milliseconds' },
        { name: 'Seconds', value: 'seconds' },
        { name: 'Minutes', value: 'minutes' },
      ],
    },
  ],
  color: '#B2BEC3',
};

export const DelayNode: INodeHandler = {
  description,
  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    const duration = ctx.parameters.duration as number;
    const unit = ctx.parameters.unit as string;

    let ms = duration;
    if (unit === 'seconds') ms = duration * 1000;
    else if (unit === 'minutes') ms = duration * 60 * 1000;

    // Cap at 5 minutes to prevent abuse
    ms = Math.min(ms, 300000);

    await sleep(ms);

    return { data: [ctx.inputData] };
  },
};
