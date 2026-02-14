import { INodeHandler, INodeExecutionContext } from '../../engine/NodeRegistry';
import { INodeTypeDescription, INodeExecutionResult } from '@flowforge/shared';

const description: INodeTypeDescription = {
  type: 'trigger.cron',
  displayName: 'Schedule Trigger',
  description: 'Starts the workflow on a schedule',
  icon: 'clock',
  category: 'triggers',
  version: 1,
  inputs: [],
  outputs: [{ name: 'main', type: 'main' }],
  properties: [
    {
      name: 'cronExpression',
      displayName: 'Cron Expression',
      type: 'string',
      default: '0 * * * *',
      required: true,
      description: 'Cron expression for the schedule (e.g., "0 * * * *" for every hour)',
    },
    {
      name: 'timezone',
      displayName: 'Timezone',
      type: 'string',
      default: 'UTC',
      description: 'Timezone for the cron schedule',
    },
  ],
  triggerType: 'cron',
  color: '#FD79A8',
};

export const CronTriggerNode: INodeHandler = {
  description,
  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    return {
      data: [[{
        json: {
          timestamp: new Date().toISOString(),
          cronExpression: ctx.parameters.cronExpression,
          timezone: ctx.parameters.timezone,
        },
      }]],
    };
  },
};
