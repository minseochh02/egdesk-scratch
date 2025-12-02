import { IMCPService, MCPTool, MCPServerInfo, MCPCapabilities, MCPToolResult } from '../types/mcp-service';
import { AppsScriptService } from './apps-script-service';

/**
 * Apps Script MCP Service
 * Adapts the AppsScriptService to the IMCPService interface.
 * 
 * It intentionally mimics the File System MCP Server interface 
 * (fs_read_file, fs_write_file, etc.) but operates on the 
 * Virtual Filesystem of Apps Script projects.
 */
export class AppsScriptMCPService implements IMCPService {
  private service: AppsScriptService;

  constructor(dbPath: string) {
    this.service = new AppsScriptService(dbPath);
  }

  getServerInfo(): MCPServerInfo {
    return {
      name: 'apps-script-mcp-server',
      version: '1.0.0'
    };
  }

  getCapabilities(): MCPCapabilities {
    return {
      tools: {},
      resources: {
        // We could expose projects as resources too, but tools are primary for now
      }
    };
  }

  listTools(): MCPTool[] {
    // We reuse standard FS naming conventions where possible to make it easy for AI
    return [
      {
        name: 'fs_list_directory',
        description: 'List projects (at root /) or files in a project (at /{ProjectId}/).',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to list. Use "/" to see all projects.' }
          },
          required: ['path']
        }
      },
      {
        name: 'fs_read_file',
        description: 'Read content of an Apps Script file.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to file, e.g. /{ProjectId}/Code.gs' }
          },
          required: ['path']
        }
      },
      {
        name: 'fs_write_file',
        description: 'Write/Overwrite an Apps Script file.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to file, e.g. /{ProjectId}/Code.gs' },
            content: { type: 'string', description: 'New content of the file' }
          },
          required: ['path', 'content']
        }
      },
      {
        name: 'fs_delete_file',
        description: 'Delete an Apps Script file.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to file to delete' }
          },
          required: ['path']
        }
      }
    ];
  }

  async executeTool(name: string, args: Record<string, any>): Promise<MCPToolResult> {
    try {
      let result: any;

      switch (name) {
        case 'fs_list_directory':
          result = await this.service.listDirectory(args.path);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }]
          };

        case 'fs_read_file':
          result = await this.service.readFile(args.path);
          return {
            content: [{
              type: 'text',
              text: result
            }]
          };

        case 'fs_write_file':
          await this.service.writeFile(args.path, args.content);
          return {
            content: [{
              type: 'text',
              text: `Successfully wrote to ${args.path}`
            }]
          };

        case 'fs_delete_file':
          await this.service.deleteFile(args.path);
          return {
            content: [{
              type: 'text',
              text: `Successfully deleted ${args.path}`
            }]
          };

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      // Standardize error output
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Error executing ${name}: ${msg}`);
    }
  }
}

