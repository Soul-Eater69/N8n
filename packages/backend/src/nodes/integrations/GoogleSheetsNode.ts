import { INodeHandler, INodeExecutionContext } from '../../engine/NodeRegistry';
import { INodeTypeDescription, INodeExecutionResult, INodeExecutionData } from '@flowforge/shared';

const description: INodeTypeDescription = {
  type: 'integration.googleSheets',
  displayName: 'Google Sheets',
  description: 'Read, write, and manage Google Sheets spreadsheets',
  icon: 'table',
  category: 'integration',
  version: 1,
  inputs: [{ name: 'main', type: 'main' }],
  outputs: [{ name: 'main', type: 'main' }],
  properties: [
    {
      name: 'operation',
      displayName: 'Operation',
      type: 'options',
      default: 'readRows',
      required: true,
      options: [
        { name: 'Read Rows', value: 'readRows', description: 'Read rows from a sheet range' },
        { name: 'Append Row', value: 'appendRow', description: 'Append a row to the end of a sheet' },
        { name: 'Update Row', value: 'updateRow', description: 'Update values in a specific range' },
        { name: 'Clear Sheet', value: 'clearSheet', description: 'Clear values from a range' },
        { name: 'Get Sheet Info', value: 'getSheetInfo', description: 'Get spreadsheet metadata' },
        { name: 'Create Sheet', value: 'createSheet', description: 'Create a new sheet tab in the spreadsheet' },
      ],
    },
    {
      name: 'spreadsheetId',
      displayName: 'Spreadsheet ID',
      type: 'string',
      default: '',
      required: true,
      description: 'The ID of the spreadsheet (from the URL)',
      placeholder: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms',
    },
    {
      name: 'sheetName',
      displayName: 'Sheet Name',
      type: 'string',
      default: 'Sheet1',
      description: 'The name of the sheet tab',
      displayOptions: {
        show: { operation: ['readRows', 'appendRow', 'updateRow', 'clearSheet', 'createSheet'] },
      },
    },
    {
      name: 'range',
      displayName: 'Range',
      type: 'string',
      default: '',
      description: 'The A1 notation range (e.g. A1:D10). If empty, reads the entire sheet.',
      placeholder: 'A1:D10',
      displayOptions: {
        show: { operation: ['readRows', 'updateRow', 'clearSheet'] },
      },
    },
    {
      name: 'values',
      displayName: 'Values (JSON)',
      type: 'json',
      default: '[[]]',
      description: 'A 2D array of values: [["col1", "col2"], ["val1", "val2"]]',
      displayOptions: {
        show: { operation: ['appendRow', 'updateRow'] },
      },
    },
    {
      name: 'valueInputOption',
      displayName: 'Value Input Option',
      type: 'options',
      default: 'USER_ENTERED',
      description: 'How input data should be interpreted',
      options: [
        { name: 'Raw', value: 'RAW', description: 'Values are stored as-is' },
        { name: 'User Entered', value: 'USER_ENTERED', description: 'Values are parsed as if typed into the UI' },
      ],
      displayOptions: {
        show: { operation: ['appendRow', 'updateRow'] },
      },
    },
    {
      name: 'startRow',
      displayName: 'Start Row',
      type: 'number',
      default: 1,
      description: 'The starting row number (1-based)',
      displayOptions: {
        show: { operation: ['readRows'] },
      },
    },
    {
      name: 'endRow',
      displayName: 'End Row',
      type: 'number',
      default: 0,
      description: 'The ending row number (0 for all rows)',
      displayOptions: {
        show: { operation: ['readRows'] },
      },
    },
  ],
  credentials: [{ name: 'googleSheets', required: true }],
  color: '#0F9D58',
};

async function callSheetsApi(
  endpoint: string,
  accessToken: string,
  method: string = 'GET',
  body?: Record<string, unknown>,
  queryParams?: Record<string, string>,
): Promise<Record<string, unknown>> {
  let url = `https://sheets.googleapis.com/v4/spreadsheets${endpoint}`;

  if (queryParams) {
    const searchParams = new URLSearchParams(queryParams);
    url += `?${searchParams.toString()}`;
  }

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
  };

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);

  if (response.status === 204) {
    return { success: true, statusCode: 204 };
  }

  const data = await response.json() as Record<string, unknown>;

  if (!response.ok) {
    const errorData = data.error as Record<string, unknown> | undefined;
    const errorMessage = errorData?.message || response.statusText;
    const errorCode = errorData?.code || response.status;
    throw new Error(`Google Sheets API error (${errorCode}): ${errorMessage}`);
  }

  return data;
}

function buildRange(sheetName: string, range?: string): string {
  if (range) {
    return `${sheetName}!${range}`;
  }
  return sheetName;
}

export const GoogleSheetsNode: INodeHandler = {
  description,

  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    const params = ctx.parameters as Record<string, unknown>;
    const credentials = ctx.credentials as Record<string, Record<string, string>>;
    const accessToken = credentials.googleSheets?.accessToken;

    if (!accessToken) {
      throw new Error('Google Sheets access token is required. Please configure Google Sheets credentials.');
    }

    const operation = params.operation as string;
    const spreadsheetId = params.spreadsheetId as string;
    const sheetName = (params.sheetName as string) || 'Sheet1';
    const results: INodeExecutionData[] = [];

    if (!spreadsheetId) {
      throw new Error('Spreadsheet ID is required.');
    }

    for (const item of ctx.inputData) {
      try {
        let responseData: Record<string, unknown>;

        switch (operation) {
          case 'readRows': {
            const range = params.range as string;
            const fullRange = buildRange(sheetName, range);
            const encodedRange = encodeURIComponent(fullRange);

            responseData = await callSheetsApi(
              `/${spreadsheetId}/values/${encodedRange}`,
              accessToken,
              'GET',
              undefined,
              { majorDimension: 'ROWS' },
            );

            const allValues = (responseData.values as unknown[][]) || [];
            const startRow = (params.startRow as number) || 1;
            const endRow = (params.endRow as number) || 0;

            let filteredValues = allValues;
            if (startRow > 1 || endRow > 0) {
              const startIndex = Math.max(0, startRow - 1);
              const endIndex = endRow > 0 ? endRow : allValues.length;
              filteredValues = allValues.slice(startIndex, endIndex);
            }

            if (filteredValues.length > 0) {
              const headers = allValues[0] as string[];
              const dataRows = startRow <= 1 ? filteredValues.slice(1) : filteredValues;

              responseData = {
                range: responseData.range,
                majorDimension: responseData.majorDimension,
                headers,
                rows: dataRows.map((row) => {
                  const rowObj: Record<string, unknown> = {};
                  headers.forEach((header, index) => {
                    rowObj[header] = (row as unknown[])[index] ?? null;
                  });
                  return rowObj;
                }),
                rawValues: filteredValues,
                totalRows: filteredValues.length,
              };
            } else {
              responseData = {
                range: responseData.range,
                rows: [],
                rawValues: [],
                totalRows: 0,
              };
            }
            break;
          }

          case 'appendRow': {
            const range = buildRange(sheetName, 'A1');
            const encodedRange = encodeURIComponent(range);
            const valuesRaw = params.values as string;
            const values = typeof valuesRaw === 'string' ? JSON.parse(valuesRaw) : valuesRaw;
            const valueInputOption = (params.valueInputOption as string) || 'USER_ENTERED';

            responseData = await callSheetsApi(
              `/${spreadsheetId}/values/${encodedRange}:append`,
              accessToken,
              'POST',
              {
                range,
                majorDimension: 'ROWS',
                values: Array.isArray(values[0]) ? values : [values],
              },
              {
                valueInputOption,
                insertDataOption: 'INSERT_ROWS',
              },
            );
            break;
          }

          case 'updateRow': {
            const range = params.range as string;
            if (!range) {
              throw new Error('Range is required for updateRow operation (e.g. A1:D5)');
            }
            const fullRange = buildRange(sheetName, range);
            const encodedRange = encodeURIComponent(fullRange);
            const valuesRaw = params.values as string;
            const values = typeof valuesRaw === 'string' ? JSON.parse(valuesRaw) : valuesRaw;
            const valueInputOption = (params.valueInputOption as string) || 'USER_ENTERED';

            responseData = await callSheetsApi(
              `/${spreadsheetId}/values/${encodedRange}`,
              accessToken,
              'PUT',
              {
                range: fullRange,
                majorDimension: 'ROWS',
                values: Array.isArray(values[0]) ? values : [values],
              },
              { valueInputOption },
            );
            break;
          }

          case 'clearSheet': {
            const range = params.range as string;
            const fullRange = buildRange(sheetName, range || 'A1:ZZ');
            const encodedRange = encodeURIComponent(fullRange);

            responseData = await callSheetsApi(
              `/${spreadsheetId}/values/${encodedRange}:clear`,
              accessToken,
              'POST',
              {},
            );
            break;
          }

          case 'getSheetInfo': {
            responseData = await callSheetsApi(
              `/${spreadsheetId}`,
              accessToken,
              'GET',
              undefined,
              { includeGridData: 'false' },
            );
            break;
          }

          case 'createSheet': {
            responseData = await callSheetsApi(
              `/${spreadsheetId}:batchUpdate`,
              accessToken,
              'POST',
              {
                requests: [
                  {
                    addSheet: {
                      properties: {
                        title: sheetName,
                      },
                    },
                  },
                ],
              },
            );
            break;
          }

          default:
            throw new Error(`Unsupported Google Sheets operation: ${operation}`);
        }

        results.push({
          json: {
            success: true,
            operation,
            ...responseData,
          },
          pairedItem: { item: results.length },
        });
      } catch (error: any) {
        results.push({
          json: {
            success: false,
            operation,
            error: error.message,
          },
          pairedItem: { item: results.length },
        });
      }
    }

    return { data: [results] };
  },
};
