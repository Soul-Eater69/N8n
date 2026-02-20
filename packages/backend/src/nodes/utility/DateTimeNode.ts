import { INodeHandler, INodeExecutionContext } from '../../engine/NodeRegistry';
import { INodeTypeDescription, INodeExecutionResult, INodeExecutionData } from '@flowforge/shared';

const description: INodeTypeDescription = {
  type: 'utility.dateTime',
  displayName: 'Date & Time',
  description: 'Performs date and time operations such as formatting, parsing, adding/subtracting time, and computing differences',
  icon: 'calendar',
  category: 'utility',
  version: 1,
  inputs: [{ name: 'main', type: 'main' }],
  outputs: [{ name: 'main', type: 'main' }],
  properties: [
    {
      name: 'operation',
      displayName: 'Operation',
      type: 'options',
      default: 'now',
      required: true,
      options: [
        { name: 'Now', value: 'now', description: 'Get the current date and time' },
        { name: 'Format', value: 'format', description: 'Format a date into a string' },
        { name: 'Parse', value: 'parse', description: 'Parse a date string into a timestamp' },
        { name: 'Add', value: 'add', description: 'Add time to a date' },
        { name: 'Subtract', value: 'subtract', description: 'Subtract time from a date' },
        { name: 'Difference', value: 'diff', description: 'Calculate the difference between two dates' },
        { name: 'Start Of', value: 'startOf', description: 'Get the start of a time period' },
        { name: 'End Of', value: 'endOf', description: 'Get the end of a time period' },
      ],
    },
    {
      name: 'inputField',
      displayName: 'Input Field',
      type: 'string',
      default: 'date',
      description: 'The field containing the date value to operate on',
      displayOptions: {
        hide: {
          operation: ['now'],
        },
      },
    },
    {
      name: 'outputField',
      displayName: 'Output Field',
      type: 'string',
      default: 'result',
      description: 'The field to store the result in',
    },
    {
      name: 'format',
      displayName: 'Output Format',
      type: 'options',
      default: 'ISO',
      options: [
        { name: 'ISO 8601', value: 'ISO', description: 'e.g., 2024-01-15T10:30:00.000Z' },
        { name: 'Unix Timestamp (seconds)', value: 'Unix', description: 'e.g., 1705314600' },
        { name: 'Unix Timestamp (ms)', value: 'UnixMs', description: 'e.g., 1705314600000' },
        { name: 'Custom', value: 'custom', description: 'Use a custom format string' },
      ],
    },
    {
      name: 'customFormat',
      displayName: 'Custom Format',
      type: 'string',
      default: 'YYYY-MM-DD HH:mm:ss',
      description:
        'Custom format string. Supported tokens: YYYY, MM, DD, HH, mm, ss, SSS, ddd, dddd',
      placeholder: 'YYYY-MM-DD HH:mm:ss',
      displayOptions: {
        show: {
          format: ['custom'],
        },
      },
    },
    {
      name: 'amount',
      displayName: 'Amount',
      type: 'number',
      default: 1,
      description: 'The amount of time to add or subtract',
      displayOptions: {
        show: {
          operation: ['add', 'subtract'],
        },
      },
    },
    {
      name: 'unit',
      displayName: 'Unit',
      type: 'options',
      default: 'days',
      options: [
        { name: 'Seconds', value: 'seconds' },
        { name: 'Minutes', value: 'minutes' },
        { name: 'Hours', value: 'hours' },
        { name: 'Days', value: 'days' },
        { name: 'Weeks', value: 'weeks' },
        { name: 'Months', value: 'months' },
        { name: 'Years', value: 'years' },
      ],
      displayOptions: {
        show: {
          operation: ['add', 'subtract', 'diff', 'startOf', 'endOf'],
        },
      },
    },
    {
      name: 'timezone',
      displayName: 'Timezone',
      type: 'string',
      default: 'UTC',
      description: 'The timezone to use for the operation (IANA timezone name)',
      placeholder: 'e.g., America/New_York, Europe/London, UTC',
    },
  ],
  color: '#00CEC9',
  subtitle: '={{$parameter["operation"]}}',
};

/**
 * Converts a unit amount to milliseconds.
 */
function unitToMs(amount: number, unit: string): number {
  switch (unit) {
    case 'seconds': return amount * 1000;
    case 'minutes': return amount * 60 * 1000;
    case 'hours': return amount * 60 * 60 * 1000;
    case 'days': return amount * 24 * 60 * 60 * 1000;
    case 'weeks': return amount * 7 * 24 * 60 * 60 * 1000;
    default: return amount;
  }
}

/**
 * Adds or subtracts months from a date, handling month-end edge cases.
 */
function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const targetMonth = result.getMonth() + months;
  result.setMonth(targetMonth);
  // Handle month overflow (e.g., Jan 31 + 1 month should be Feb 28)
  if (result.getMonth() !== ((targetMonth % 12) + 12) % 12) {
    result.setDate(0); // Go to last day of previous month
  }
  return result;
}

/**
 * Adds or subtracts years from a date.
 */
function addYears(date: Date, years: number): Date {
  return addMonths(date, years * 12);
}

/**
 * Formats a date using a simple custom format string.
 * Supported tokens: YYYY, MM, DD, HH, mm, ss, SSS, ddd, dddd
 */
function formatDate(date: Date, formatStr: string, timezone: string): string {
  // Attempt to use Intl for timezone-aware formatting
  let d = date;
  if (timezone && timezone !== 'UTC') {
    try {
      const options: Intl.DateTimeFormatOptions = {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      };
      const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(date);
      const get = (type: string) =>
        parts.find((p) => p.type === type)?.value || '';

      const year = get('year');
      const month = get('month');
      const day = get('day');
      const hour = get('hour');
      const minute = get('minute');
      const second = get('second');

      // Reconstruct a date in the target timezone for token replacement
      d = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
    } catch {
      // Fall back to UTC if timezone is invalid
    }
  }

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayNamesShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const pad = (n: number, width = 2) => String(n).padStart(width, '0');

  let result = formatStr;
  result = result.replace('YYYY', String(d.getFullYear()));
  result = result.replace('MM', pad(d.getMonth() + 1));
  result = result.replace('DD', pad(d.getDate()));
  result = result.replace('HH', pad(d.getHours()));
  result = result.replace('mm', pad(d.getMinutes()));
  result = result.replace('ss', pad(d.getSeconds()));
  result = result.replace('SSS', pad(d.getMilliseconds(), 3));
  result = result.replace('dddd', dayNames[d.getDay()]);
  result = result.replace('ddd', dayNamesShort[d.getDay()]);

  return result;
}

/**
 * Formats a date value according to the specified output format.
 */
function formatOutput(date: Date, format: string, customFormat: string, timezone: string): string | number {
  switch (format) {
    case 'ISO':
      return date.toISOString();
    case 'Unix':
      return Math.floor(date.getTime() / 1000);
    case 'UnixMs':
      return date.getTime();
    case 'custom':
      return formatDate(date, customFormat || 'YYYY-MM-DD HH:mm:ss', timezone);
    default:
      return date.toISOString();
  }
}

/**
 * Parses a date value from various input formats.
 */
function parseDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'number') {
    // If the number is small enough, treat it as Unix seconds; otherwise ms
    return value < 1e12 ? new Date(value * 1000) : new Date(value);
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (isNaN(parsed.getTime())) {
      throw new Error(`Unable to parse date from string: "${value}"`);
    }
    return parsed;
  }
  throw new Error(`Cannot parse date from value of type ${typeof value}`);
}

/**
 * Gets a nested value from an object using dot notation.
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((current: any, key) => {
    if (current === null || current === undefined) return undefined;
    return current[key];
  }, obj);
}

/**
 * Sets a nested value in an object using dot notation.
 */
function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  let current: any = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in current) || typeof current[keys[i]] !== 'object' || current[keys[i]] === null) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
}

export const DateTimeNode: INodeHandler = {
  description,

  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    const operation = (ctx.parameters.operation as string) || 'now';
    const inputField = (ctx.parameters.inputField as string) || 'date';
    const outputField = (ctx.parameters.outputField as string) || 'result';
    const format = (ctx.parameters.format as string) || 'ISO';
    const customFormat = (ctx.parameters.customFormat as string) || 'YYYY-MM-DD HH:mm:ss';
    const amount = (ctx.parameters.amount as number) || 1;
    const unit = (ctx.parameters.unit as string) || 'days';
    const timezone = (ctx.parameters.timezone as string) || 'UTC';

    const outputItems: INodeExecutionData[] = [];

    for (const item of ctx.inputData) {
      const newJson = { ...item.json };

      switch (operation) {
        case 'now': {
          const now = new Date();
          setNestedValue(newJson, outputField, formatOutput(now, format, customFormat, timezone));
          break;
        }

        case 'format': {
          const rawValue = getNestedValue(item.json, inputField);
          if (rawValue === undefined || rawValue === null) {
            setNestedValue(newJson, outputField, null);
            break;
          }
          const date = parseDate(rawValue);
          setNestedValue(newJson, outputField, formatOutput(date, format, customFormat, timezone));
          break;
        }

        case 'parse': {
          const rawValue = getNestedValue(item.json, inputField);
          if (rawValue === undefined || rawValue === null) {
            setNestedValue(newJson, outputField, null);
            break;
          }
          const parsed = parseDate(rawValue);
          setNestedValue(newJson, outputField, formatOutput(parsed, format, customFormat, timezone));
          break;
        }

        case 'add': {
          const rawValue = getNestedValue(item.json, inputField);
          if (rawValue === undefined || rawValue === null) {
            setNestedValue(newJson, outputField, null);
            break;
          }
          let date = parseDate(rawValue);
          if (unit === 'months') {
            date = addMonths(date, amount);
          } else if (unit === 'years') {
            date = addYears(date, amount);
          } else {
            date = new Date(date.getTime() + unitToMs(amount, unit));
          }
          setNestedValue(newJson, outputField, formatOutput(date, format, customFormat, timezone));
          break;
        }

        case 'subtract': {
          const rawValue = getNestedValue(item.json, inputField);
          if (rawValue === undefined || rawValue === null) {
            setNestedValue(newJson, outputField, null);
            break;
          }
          let date = parseDate(rawValue);
          if (unit === 'months') {
            date = addMonths(date, -amount);
          } else if (unit === 'years') {
            date = addYears(date, -amount);
          } else {
            date = new Date(date.getTime() - unitToMs(amount, unit));
          }
          setNestedValue(newJson, outputField, formatOutput(date, format, customFormat, timezone));
          break;
        }

        case 'diff': {
          // Computes the difference between two dates.
          // inputField should be a path to an object with "start" and "end" properties,
          // or a comma-separated pair of field paths: "fieldA,fieldB"
          let startDate: Date;
          let endDate: Date;

          const rawValue = getNestedValue(item.json, inputField);
          if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
            const obj = rawValue as Record<string, unknown>;
            startDate = parseDate(obj.start);
            endDate = parseDate(obj.end);
          } else {
            // Try comma-separated field paths
            const parts = inputField.split(',').map((s) => s.trim());
            if (parts.length === 2) {
              const v1 = getNestedValue(item.json, parts[0]);
              const v2 = getNestedValue(item.json, parts[1]);
              startDate = parseDate(v1);
              endDate = parseDate(v2);
            } else {
              throw new Error(
                'For "diff" operation, inputField must be a path to an object with ' +
                '"start" and "end" properties, or two comma-separated field paths'
              );
            }
          }

          const diffMs = endDate.getTime() - startDate.getTime();
          let diffValue: number;

          switch (unit) {
            case 'seconds': diffValue = diffMs / 1000; break;
            case 'minutes': diffValue = diffMs / (60 * 1000); break;
            case 'hours': diffValue = diffMs / (60 * 60 * 1000); break;
            case 'days': diffValue = diffMs / (24 * 60 * 60 * 1000); break;
            case 'weeks': diffValue = diffMs / (7 * 24 * 60 * 60 * 1000); break;
            case 'months': diffValue = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth()); break;
            case 'years': diffValue = endDate.getFullYear() - startDate.getFullYear(); break;
            default: diffValue = diffMs; break;
          }

          setNestedValue(newJson, outputField, Math.round(diffValue * 100) / 100);
          break;
        }

        case 'startOf': {
          const rawValue = getNestedValue(item.json, inputField);
          if (rawValue === undefined || rawValue === null) {
            setNestedValue(newJson, outputField, null);
            break;
          }
          const date = parseDate(rawValue);
          let result: Date;

          switch (unit) {
            case 'seconds':
              result = new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds(), 0);
              break;
            case 'minutes':
              result = new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), 0, 0);
              break;
            case 'hours':
              result = new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), 0, 0, 0);
              break;
            case 'days':
              result = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
              break;
            case 'weeks': {
              const dayOfWeek = date.getDay();
              result = new Date(date.getFullYear(), date.getMonth(), date.getDate() - dayOfWeek, 0, 0, 0, 0);
              break;
            }
            case 'months':
              result = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
              break;
            case 'years':
              result = new Date(date.getFullYear(), 0, 1, 0, 0, 0, 0);
              break;
            default:
              result = date;
          }

          setNestedValue(newJson, outputField, formatOutput(result, format, customFormat, timezone));
          break;
        }

        case 'endOf': {
          const rawValue = getNestedValue(item.json, inputField);
          if (rawValue === undefined || rawValue === null) {
            setNestedValue(newJson, outputField, null);
            break;
          }
          const date = parseDate(rawValue);
          let result: Date;

          switch (unit) {
            case 'seconds':
              result = new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds(), 999);
              break;
            case 'minutes':
              result = new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), 59, 999);
              break;
            case 'hours':
              result = new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), 59, 59, 999);
              break;
            case 'days':
              result = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
              break;
            case 'weeks': {
              const dayOfWeek = date.getDay();
              const daysUntilSaturday = 6 - dayOfWeek;
              result = new Date(date.getFullYear(), date.getMonth(), date.getDate() + daysUntilSaturday, 23, 59, 59, 999);
              break;
            }
            case 'months':
              // Day 0 of next month = last day of current month
              result = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
              break;
            case 'years':
              result = new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);
              break;
            default:
              result = date;
          }

          setNestedValue(newJson, outputField, formatOutput(result, format, customFormat, timezone));
          break;
        }

        default:
          throw new Error(`Unknown operation: ${operation}`);
      }

      outputItems.push({ json: newJson, binary: item.binary });
    }

    return { data: [outputItems] };
  },
};
