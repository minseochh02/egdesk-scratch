/**
 * Browser Recording MCP Service — list saved tests, replay options, and run replays with optional dates.
 */
import * as fs from 'fs';
import * as path from 'path';
import { IMCPService, MCPTool, MCPServerInfo, MCPCapabilities, MCPToolResult } from '../types/mcp-service';
import {
  parseRecordedActionsFromSpecFile,
  getReplayUiOptionsFromActions,
  type BrowserRecordingReplayParams,
} from '../../browser-recording-spec';
import { runBrowserRecordingReplayForAutomation } from '../../chrome-handlers';
import { getBrowserRecorderTestsDir, resolveBrowserRecordingTestFileInput } from '../../browser-recording-paths';

export { assertAllowedBrowserRecordingSpecPath } from '../../browser-recording-paths';

function toReplayDateParam(raw: string | undefined): string | undefined {
  if (raw == null) return undefined;
  const t = String(raw).trim();
  if (!t) return undefined;
  return t.replace(/\//g, '-');
}

function buildReplayParams(args: Record<string, any>): BrowserRecordingReplayParams {
  const datePickersByIndex = args.datePickersByIndex;
  if (Array.isArray(datePickersByIndex) && datePickersByIndex.length > 0) {
    return {
      datePickersByIndex: datePickersByIndex.map((x: unknown) =>
        x == null || String(x).trim() === '' ? undefined : toReplayDateParam(String(x))
      ),
    };
  }
  const start = toReplayDateParam(args.startDate);
  const end = toReplayDateParam(args.endDate);
  if (start || end) {
    return { dateRange: { start, end } };
  }
  return {};
}

export class BrowserRecordingMCPService implements IMCPService {
  getServerInfo(): MCPServerInfo {
    return {
      name: 'browser-recording-mcp-server',
      version: '1.0.0',
    };
  }

  getCapabilities(): MCPCapabilities {
    return { tools: {} };
  }

  listTools(): MCPTool[] {
    return [
      {
        name: 'browser_recording_list_saved_tests',
        description:
          'List saved browser recorder tests (*.spec.js) in the EGDesk output folder with path and metadata.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'browser_recording_get_replay_options',
        description:
          'Inspect a saved spec: returns datePickerGroup count and UI hint (none, singleDate, or dateRange).',
        inputSchema: {
          type: 'object',
          properties: {
            testFile: {
              type: 'string',
              description:
                'Absolute path to a .spec.js under browser-recorder-tests, or bare filename only (e.g. myflow.spec.js)',
            },
          },
          required: ['testFile'],
        },
      },
      {
        name: 'browser_recording_run',
        description:
          'Run a saved recording in Chrome (action replay). Optional startDate/endDate (YYYY/MM/DD or YYYY-MM-DD) map to first/second date pickers, or pass datePickersByIndex for per-picker overrides. Empty dates use recorded offsets.',
        inputSchema: {
          type: 'object',
          properties: {
            testFile: {
              type: 'string',
              description:
                'Absolute path to .spec.js under browser-recorder-tests, or bare filename only (e.g. myflow.spec.js)',
            },
            startDate: { type: 'string', description: 'Optional; first date picker / start of range' },
            endDate: { type: 'string', description: 'Optional; second date picker / end of range' },
            datePickersByIndex: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional explicit ISO-like dates per 0-based datePickerGroup index',
            },
          },
          required: ['testFile'],
        },
      },
    ];
  }

  async executeTool(name: string, args: Record<string, any>): Promise<MCPToolResult> {
    const text = (payload: unknown) =>
      JSON.stringify(payload, null, 2);

    try {
      switch (name) {
        case 'browser_recording_list_saved_tests': {
          const dir = getBrowserRecorderTestsDir();
          if (!fs.existsSync(dir)) {
            return { content: [{ type: 'text', text: text({ tests: [], outputDir: dir, note: 'Directory does not exist yet' }) }] };
          }
          const files = fs.readdirSync(dir).filter((f) => f.endsWith('.spec.js'));
          const tests = files.map((file) => {
            const filePath = path.join(dir, file);
            const stats = fs.statSync(filePath);
            return {
              name: file,
              path: filePath,
              size: stats.size,
              createdAt: stats.birthtime.toISOString(),
            };
          });
          tests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          return { content: [{ type: 'text', text: text({ outputDir: dir, tests }) }] };
        }

        case 'browser_recording_get_replay_options': {
          const testFile = args.testFile as string;
          if (!testFile || typeof testFile !== 'string') {
            throw new Error('testFile is required');
          }
          const safe = resolveBrowserRecordingTestFileInput(testFile);
          if (!fs.existsSync(safe)) {
            throw new Error(`File not found: ${safe}`);
          }
          const parsed = parseRecordedActionsFromSpecFile(safe);
          if (!parsed.ok) {
            return {
              content: [
                {
                  type: 'text',
                  text: text({ ok: false, error: parsed.error, testFile: safe }),
                },
              ],
            };
          }
          const opts = getReplayUiOptionsFromActions(parsed.actions);
          return {
            content: [
              {
                type: 'text',
                text: text({ ok: true, testFile: safe, ...opts }),
              },
            ],
          };
        }

        case 'browser_recording_run': {
          const testFile = args.testFile as string;
          if (!testFile || typeof testFile !== 'string') {
            throw new Error('testFile is required');
          }
          const safe = resolveBrowserRecordingTestFileInput(testFile);
          if (!fs.existsSync(safe)) {
            throw new Error(`File not found: ${safe}`);
          }
          const replayParams = buildReplayParams(args);
          const result = await runBrowserRecordingReplayForAutomation(safe, replayParams);
          return {
            content: [
              {
                type: 'text',
                text: text({
                  testFile: safe,
                  replayParams,
                  ...result,
                }),
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: text({
              success: false,
              error: error?.message || String(error),
            }),
          },
        ],
      };
    }
  }
}
