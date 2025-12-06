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
        description: 'List all available Apps Script projects with their bound spreadsheet information. Returns project ID, name, spreadsheetId, spreadsheetUrl, and file count.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'apps_script_get_project',
        description: 'Get detailed information about a specific Apps Script project, including the bound spreadsheet ID and URL.',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'The ID of the Apps Script project' }
          },
          required: ['projectId']
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
      },
      {
        name: 'apps_script_push_to_google',
        description: 'Push local changes to the actual Google Apps Script project. This will overwrite the cloud version with local changes.',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'The ID of the Apps Script project' }
          },
          required: ['projectId']
        }
      },
      {
        name: 'apps_script_pull_from_google',
        description: 'Pull the latest version from Google Apps Script and update local storage. This will overwrite local changes with the cloud version.',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'The ID of the Apps Script project' }
          },
          required: ['projectId']
        }
      },
      {
        name: 'apps_script_run_function',
        description: 'Execute a function in the Apps Script project remotely. Runs against the most recent saved version (devMode). Returns the function result or error.',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'The ID of the Apps Script project' },
            functionName: { type: 'string', description: 'Name of the function to execute (e.g., "myFunction", "doGet")' },
            parameters: { 
              type: 'array', 
              description: 'Optional array of parameters to pass to the function',
              items: { type: 'any' }
            }
          },
          required: ['projectId', 'functionName']
        }
      },
      {
        name: 'apps_script_create_version',
        description: 'Create a new immutable version (snapshot) of the Apps Script project. Useful before making major changes.',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'The ID of the Apps Script project' },
            description: { type: 'string', description: 'Optional description for this version' }
          },
          required: ['projectId']
        }
      },
      {
        name: 'apps_script_list_versions',
        description: 'List all versions (snapshots) of the Apps Script project.',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'The ID of the Apps Script project' }
          },
          required: ['projectId']
        }
      },
      {
        name: 'apps_script_list_deployments',
        description: 'List all deployments of the Apps Script project. Shows web app URLs, deployment IDs, and configuration.',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'The ID of the Apps Script project' }
          },
          required: ['projectId']
        }
      },
      {
        name: 'apps_script_get_metrics',
        description: 'Get execution metrics for the Apps Script project (total executions, active users, failed executions).',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'The ID of the Apps Script project' }
          },
          required: ['projectId']
        }
      },
      {
        name: 'apps_script_create_version',
        description: 'Create a new version (snapshot) of the Apps Script project. Versions are required before creating deployments.',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'The ID of the Apps Script project' },
            description: { type: 'string', description: 'Optional description for the version' }
          },
          required: ['projectId']
        }
      },
      {
        name: 'apps_script_create_deployment',
        description: 'Deploy the Apps Script project as a web app. Creates a new version if none specified. Returns the web app URL.',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'The ID of the Apps Script project' },
            versionNumber: { type: 'number', description: 'Optional version number to deploy (creates new version if not provided)' },
            description: { type: 'string', description: 'Optional description for the deployment' },
            access: { 
              type: 'string', 
              enum: ['MYSELF', 'DOMAIN', 'ANYONE', 'ANYONE_ANONYMOUS'],
              description: 'Who can access the web app. MYSELF=only you, DOMAIN=your organization, ANYONE=anyone with Google account, ANYONE_ANONYMOUS=anyone (no login required)'
            },
            executeAs: {
              type: 'string',
              enum: ['USER_ACCESSING', 'USER_DEPLOYING'],
              description: 'Who the script runs as. USER_ACCESSING=the user viewing the app, USER_DEPLOYING=you (the owner)'
            }
          },
          required: ['projectId']
        }
      },
      {
        name: 'apps_script_update_deployment',
        description: 'Update an existing deployment to use a new version. Useful for publishing code changes to an existing web app URL.',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'The ID of the Apps Script project' },
            deploymentId: { type: 'string', description: 'The deployment ID to update (from apps_script_list_deployments)' },
            versionNumber: { type: 'number', description: 'Optional version number to deploy (creates new version if not provided)' },
            description: { type: 'string', description: 'Optional new description for the deployment' }
          },
          required: ['projectId', 'deploymentId']
        }
      }
    ];
  }

  async executeTool(name: string, args: Record<string, any>): Promise<MCPToolResult> {
    try {
      let result: any;

      switch (name) {
        case 'apps_script_list_projects':
          // Return projects with full details including bound spreadsheet info
          const projectsWithDetails = this.service.listProjectsWithDetails();
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(projectsWithDetails, null, 2)
            }]
          };

        case 'apps_script_get_project':
          // Get detailed info about a specific project
          const projectDetails = this.service.getProjectDetails(args.projectId);
          if (!projectDetails) {
            throw new Error(`Project not found: ${args.projectId}`);
          }
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(projectDetails, null, 2)
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
          // Ensure result is a string (handle case where source was stored as object)
          const textContent = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);
          return {
            content: [{
              type: 'text',
              text: textContent
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

        case 'apps_script_push_to_google':
          const pushResult = await this.service.pushToGoogle(args.projectId);
          return {
            content: [{
              type: 'text',
              text: pushResult.message
            }]
          };

        case 'apps_script_pull_from_google':
          const pullResult = await this.service.pullFromGoogle(args.projectId);
          return {
            content: [{
              type: 'text',
              text: pullResult.message
            }]
          };

        case 'apps_script_run_function':
          const runResult = await this.service.runFunction(
            args.projectId, 
            args.functionName, 
            args.parameters
          );
          if (runResult.success) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  functionName: args.functionName,
                  result: runResult.result,
                  logs: runResult.logs,
                }, null, 2)
              }]
            };
          } else {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  functionName: args.functionName,
                  error: runResult.error,
                }, null, 2)
              }]
            };
          }

        case 'apps_script_create_version':
          const versionResult = await this.service.createVersion(args.projectId, args.description);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Created version ${versionResult.versionNumber}`,
                ...versionResult,
              }, null, 2)
            }]
          };

        case 'apps_script_list_versions':
          const versions = await this.service.listVersions(args.projectId);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                projectId: args.projectId,
                versionCount: versions.length,
                versions,
              }, null, 2)
            }]
          };

        case 'apps_script_list_deployments':
          const deployments = await this.service.listDeployments(args.projectId);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                projectId: args.projectId,
                deploymentCount: deployments.length,
                deployments,
              }, null, 2)
            }]
          };

        case 'apps_script_get_metrics':
          const metrics = await this.service.getMetrics(args.projectId);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                projectId: args.projectId,
                ...metrics,
              }, null, 2)
            }]
          };

        case 'apps_script_create_version':
          const newVersion = await this.service.createVersion(args.projectId, args.description);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                projectId: args.projectId,
                message: `Created version ${newVersion.versionNumber}`,
                version: newVersion,
              }, null, 2)
            }]
          };

        case 'apps_script_create_deployment':
          const deployment = await this.service.createDeployment(args.projectId, {
            versionNumber: args.versionNumber,
            description: args.description,
            access: args.access,
            executeAs: args.executeAs,
          });
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                projectId: args.projectId,
                message: deployment.webAppUrl 
                  ? `Deployed as web app: ${deployment.webAppUrl}`
                  : `Created deployment ${deployment.deploymentId}`,
                deployment,
              }, null, 2)
            }]
          };

        case 'apps_script_update_deployment':
          const updatedDeployment = await this.service.updateDeployment(
            args.projectId,
            args.deploymentId,
            {
              versionNumber: args.versionNumber,
              description: args.description,
            }
          );
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                projectId: args.projectId,
                message: updatedDeployment.webAppUrl 
                  ? `Updated deployment, web app: ${updatedDeployment.webAppUrl}`
                  : `Updated deployment ${updatedDeployment.deploymentId}`,
                deployment: updatedDeployment,
              }, null, 2)
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
