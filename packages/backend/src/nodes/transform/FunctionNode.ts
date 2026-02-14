import { INodeHandler, INodeExecutionContext } from '../../engine/NodeRegistry';
import { INodeTypeDescription, INodeExecutionResult, INodeExecutionData } from '@flowforge/shared';

const description: INodeTypeDescription = {
  type: 'transform.function',
  displayName: 'Code',
  description: 'Run custom JavaScript code to transform data',
  icon: 'code',
  category: 'transform',
  version: 1,
  inputs: [{ name: 'main', type: 'main' }],
  outputs: [{ name: 'main', type: 'main' }],
  properties: [
    {
      name: 'code',
      displayName: 'JavaScript Code',
      type: 'string',
      default: '// Access input items via $input\n// Return an array of items\nreturn $input.map(item => {\n  return { json: item.json };\n});',
      required: true,
      typeOptions: {
        editor: 'code',
        language: 'javascript',
        rows: 15,
      },
    },
  ],
  color: '#636E72',
};

export const FunctionNode: INodeHandler = {
  description,
  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    const code = ctx.parameters.code as string;

    // Create a safe execution context
    const sandboxGlobals = {
      $input: ctx.inputData,
      $items: ctx.inputData,
      $json: ctx.inputData[0]?.json || {},
      console: {
        log: (..._args: unknown[]) => {},
        warn: (..._args: unknown[]) => {},
        error: (..._args: unknown[]) => {},
      },
      JSON,
      Math,
      Date,
      Array,
      Object,
      String,
      Number,
      Boolean,
      parseInt,
      parseFloat,
      encodeURIComponent,
      decodeURIComponent,
      isNaN,
      isFinite,
    };

    try {
      const fn = new Function(
        ...Object.keys(sandboxGlobals),
        `"use strict";\n${code}`
      );

      const result = await fn(...Object.values(sandboxGlobals));

      if (!Array.isArray(result)) {
        return { data: [[{ json: result }]] };
      }

      const items: INodeExecutionData[] = result.map((item: any) => {
        if (item.json) return item;
        return { json: item };
      });

      return { data: [items] };
    } catch (error: any) {
      throw new Error(`Code execution error: ${error.message}`);
    }
  },
};
