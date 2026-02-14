import { INodeExecutionData } from '@flowforge/shared';

export class ExpressionEvaluator {
  private expressionRegex = /\{\{(.*?)\}\}/g;

  resolveNodeParameters(
    parameters: Record<string, unknown>,
    inputData: INodeExecutionData[],
    nodeOutputs: Map<string, INodeExecutionData[][]>
  ): Record<string, unknown> {
    return this.resolveValue(parameters, inputData, nodeOutputs) as Record<string, unknown>;
  }

  private resolveValue(
    value: unknown,
    inputData: INodeExecutionData[],
    nodeOutputs: Map<string, INodeExecutionData[][]>
  ): unknown {
    if (typeof value === 'string') {
      return this.resolveExpression(value, inputData, nodeOutputs);
    }

    if (Array.isArray(value)) {
      return value.map((v) => this.resolveValue(v, inputData, nodeOutputs));
    }

    if (value !== null && typeof value === 'object') {
      const resolved: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        resolved[key] = this.resolveValue(val, inputData, nodeOutputs);
      }
      return resolved;
    }

    return value;
  }

  private resolveExpression(
    expression: string,
    inputData: INodeExecutionData[],
    nodeOutputs: Map<string, INodeExecutionData[][]>
  ): string | unknown {
    if (!expression.includes('{{')) return expression;

    // If the entire string is a single expression, return the raw value
    const fullMatch = expression.match(/^\{\{(.*?)\}\}$/);
    if (fullMatch) {
      return this.evaluateExpression(fullMatch[1].trim(), inputData, nodeOutputs);
    }

    // Otherwise, do string interpolation
    return expression.replace(this.expressionRegex, (_match, expr) => {
      const result = this.evaluateExpression(expr.trim(), inputData, nodeOutputs);
      return String(result ?? '');
    });
  }

  private evaluateExpression(
    expr: string,
    inputData: INodeExecutionData[],
    nodeOutputs: Map<string, INodeExecutionData[][]>
  ): unknown {
    // Create a sandboxed context with limited access
    const context: Record<string, unknown> = {
      $input: inputData,
      $item: inputData[0]?.json || {},
      $json: inputData[0]?.json || {},
      $binary: inputData[0]?.binary || {},
      $node: Object.fromEntries(
        Array.from(nodeOutputs.entries()).map(([nodeId, output]) => [
          nodeId,
          {
            data: output,
            json: output[0]?.[0]?.json || {},
          },
        ])
      ),
      $now: new Date().toISOString(),
      $today: new Date().toISOString().split('T')[0],
      $env: {}, // Sanitized - no real env vars
      Math,
      parseInt,
      parseFloat,
      String,
      Number,
      Boolean,
      JSON: { parse: JSON.parse, stringify: JSON.stringify },
      Array,
      Object: { keys: Object.keys, values: Object.values, entries: Object.entries },
      Date,
      encodeURIComponent,
      decodeURIComponent,
    };

    try {
      // Simple property access: $json.fieldName or $item.field
      const simpleAccess = expr.match(/^\$(\w+)\.(.+)$/);
      if (simpleAccess) {
        const [, root, path] = simpleAccess;
        const rootVal = context[`$${root}`];
        return this.getNestedValue(rootVal, path);
      }

      // Direct variable reference
      if (expr.startsWith('$') && !expr.includes('.')) {
        return context[expr];
      }

      // For more complex expressions, use Function constructor with sandboxing
      const fn = new Function(
        ...Object.keys(context),
        `"use strict"; return (${expr});`
      );
      return fn(...Object.values(context));
    } catch (error: any) {
      return `[Expression Error: ${error.message}]`;
    }
  }

  private getNestedValue(obj: unknown, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;

      const bracketMatch = part.match(/^(\w+)\[(\d+)\]$/);
      if (bracketMatch) {
        current = (current as any)[bracketMatch[1]];
        if (Array.isArray(current)) {
          current = current[parseInt(bracketMatch[2], 10)];
        }
      } else {
        current = (current as any)[part];
      }
    }

    return current;
  }
}
