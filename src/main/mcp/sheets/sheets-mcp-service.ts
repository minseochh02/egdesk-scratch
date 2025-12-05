import { IMCPService, MCPTool, MCPServerInfo, MCPCapabilities, MCPToolResult } from '../types/mcp-service';
import { SheetsService } from './sheets-service';

/**
 * Sheets MCP Service
 * 
 * Adapts the SheetsService to the IMCPService interface.
 * Provides tools for reading Google Sheets data.
 */
export class SheetsMCPService implements IMCPService {
  private service: SheetsService;

  constructor() {
    this.service = new SheetsService();
  }

  getServerInfo(): MCPServerInfo {
    return {
      name: 'sheets-mcp-server',
      version: '1.0.0'
    };
  }

  getCapabilities(): MCPCapabilities {
    return {
      tools: {},
      resources: {}
    };
  }

  listTools(): MCPTool[] {
    return [
      {
        name: 'sheets_get_spreadsheet',
        description: 'Get metadata about a Google Spreadsheet (title, sheet names, row/column counts). Use this to discover the structure of a spreadsheet before reading data.',
        inputSchema: {
          type: 'object',
          properties: {
            spreadsheetId: { 
              type: 'string', 
              description: 'The ID of the Google Spreadsheet (from the URL)' 
            }
          },
          required: ['spreadsheetId']
        }
      },
      {
        name: 'sheets_get_range',
        description: 'Read a range of cells from a Google Spreadsheet. Returns the values as a 2D array.',
        inputSchema: {
          type: 'object',
          properties: {
            spreadsheetId: { 
              type: 'string', 
              description: 'The ID of the Google Spreadsheet' 
            },
            range: { 
              type: 'string', 
              description: 'A1 notation range (e.g., "Sheet1!A1:D10", "Sheet1", or "A1:D10")' 
            }
          },
          required: ['spreadsheetId', 'range']
        }
      },
      {
        name: 'sheets_get_headers',
        description: 'Get the header row (first row) of a sheet. Useful for understanding column names.',
        inputSchema: {
          type: 'object',
          properties: {
            spreadsheetId: { 
              type: 'string', 
              description: 'The ID of the Google Spreadsheet' 
            },
            sheetName: { 
              type: 'string', 
              description: 'Name of the sheet (defaults to "Sheet1")' 
            }
          },
          required: ['spreadsheetId']
        }
      },
      {
        name: 'sheets_get_sample_data',
        description: 'Get sample data (first few rows) from a sheet. Includes headers. Use this to preview data structure.',
        inputSchema: {
          type: 'object',
          properties: {
            spreadsheetId: { 
              type: 'string', 
              description: 'The ID of the Google Spreadsheet' 
            },
            sheetName: { 
              type: 'string', 
              description: 'Name of the sheet (defaults to "Sheet1")' 
            },
            rows: { 
              type: 'number', 
              description: 'Number of rows to fetch (defaults to 5, max 20)' 
            }
          },
          required: ['spreadsheetId']
        }
      },
      {
        name: 'sheets_get_full_context',
        description: 'Get complete context for a spreadsheet: metadata + headers + sample data for ALL sheets. Best for understanding the full structure of a spreadsheet.',
        inputSchema: {
          type: 'object',
          properties: {
            spreadsheetId: { 
              type: 'string', 
              description: 'The ID of the Google Spreadsheet' 
            },
            sampleRows: { 
              type: 'number', 
              description: 'Number of sample rows per sheet (defaults to 5, max 10)' 
            }
          },
          required: ['spreadsheetId']
        }
      }
    ];
  }

  async executeTool(name: string, args: Record<string, any>): Promise<MCPToolResult> {
    try {
      let result: any;

      switch (name) {
        case 'sheets_get_spreadsheet': {
          const metadata = await this.service.getSpreadsheet(args.spreadsheetId);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(metadata, null, 2)
            }]
          };
        }

        case 'sheets_get_range': {
          const rangeData = await this.service.getRange(args.spreadsheetId, args.range);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(rangeData, null, 2)
            }]
          };
        }

        case 'sheets_get_headers': {
          const headers = await this.service.getHeaders(
            args.spreadsheetId, 
            args.sheetName || 'Sheet1'
          );
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ 
                spreadsheetId: args.spreadsheetId,
                sheetName: args.sheetName || 'Sheet1',
                headers 
              }, null, 2)
            }]
          };
        }

        case 'sheets_get_sample_data': {
          // Cap rows at 20 to avoid large responses
          const rows = Math.min(args.rows || 5, 20);
          const sampleData = await this.service.getSampleData(
            args.spreadsheetId, 
            args.sheetName || 'Sheet1',
            rows
          );
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                spreadsheetId: args.spreadsheetId,
                sheetName: args.sheetName || 'Sheet1',
                ...sampleData
              }, null, 2)
            }]
          };
        }

        case 'sheets_get_full_context': {
          // Cap sample rows at 10 for full context to avoid huge responses
          const sampleRows = Math.min(args.sampleRows || 5, 10);
          const fullContext = await this.service.getFullContext(args.spreadsheetId, sampleRows);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(fullContext, null, 2)
            }]
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Error executing ${name}: ${msg}`);
    }
  }
}

