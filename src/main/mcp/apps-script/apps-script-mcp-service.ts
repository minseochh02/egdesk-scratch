import { IMCPService, MCPTool, MCPServerInfo, MCPCapabilities, MCPToolResult } from '../types/mcp-service';
import { AppsScriptService } from './apps-script-service';

/**
 * Apps Script MCP Service
 * Adapts the AppsScriptService to the IMCPService interface.
 * 
 * Exposes Apps Script specific tools instead of generic filesystem tools.
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
    return [
      {
        name: 'apps_script_list_projects',
        description: 'List all available Apps Script projects.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'apps_script_list_files',
        description: 'List files in a specific Apps Script project.',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'The ID of the Apps Script project' }
          },
          required: ['projectId']
        }
      },
      {
        name: 'apps_script_read_file',
        description: 'Read content of an Apps Script file.',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'The ID of the Apps Script project' },
            fileName: { type: 'string', description: 'Name of the file to read (e.g., "Code" or "Code.gs")' }
          },
          required: ['projectId', 'fileName']
        }
      },
      {
        name: 'apps_script_write_file',
        description: 'Write/Overwrite an Apps Script file.',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'The ID of the Apps Script project' },
            fileName: { type: 'string', description: 'Name of the file to write' },
            content: { type: 'string', description: 'New content of the file' }
          },
          required: ['projectId', 'fileName', 'content']
        }
      },
      {
        name: 'apps_script_delete_file',
        description: 'Delete an Apps Script file.',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'The ID of the Apps Script project' },
            fileName: { type: 'string', description: 'Name of the file to delete' }
          },
          required: ['projectId', 'fileName']
        }
      }
    ];
  }

  async executeTool(name: string, args: Record<string, any>): Promise<MCPToolResult> {
    try {
      let result: any;

      switch (name) {
        case 'apps_script_list_projects':
          // Reuse listDirectory with root path which lists projects
          const projects = await this.service.listDirectory('/');
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(projects, null, 2)
            }]
          };

        case 'apps_script_list_files':
          // Reuse listDirectory with project ID
          // Expecting args.projectId
          const files = await this.service.listDirectory(`/${args.projectId}/`);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(files, null, 2)
            }]
          };

        case 'apps_script_read_file':
          // Construct path from projectId and fileName
          const readPath = `/${args.projectId}/${args.fileName}`;
          result = await this.service.readFile(readPath);
          return {
            content: [{
              type: 'text',
              text: result
            }]
          };

        case 'apps_script_write_file':
          const writePath = `/${args.projectId}/${args.fileName}`;
          await this.service.writeFile(writePath, args.content);
          return {
            content: [{
              type: 'text',
              text: `Successfully wrote to ${args.fileName} in project ${args.projectId}`
            }]
          };

        case 'apps_script_delete_file':
          const deletePath = `/${args.projectId}/${args.fileName}`;
          await this.service.deleteFile(deletePath);
          return {
            content: [{
              type: 'text',
              text: `Successfully deleted ${args.fileName} in project ${args.projectId}`
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
