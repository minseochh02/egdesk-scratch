export const exampleEgChattingData = {
  servers: [
    {
      id: 'server-gmail',
      name: 'Gmail MCP',
      description: 'Access Gmail workspace data, campaign threads, and status updates.',
      connection_url: 'mcp://gmail/local',
      is_active: true,
      tools: [
        {
          id: 'tool-list-messages',
          tool_name: 'list_messages',
          description: 'Lists recent Gmail messages that match a search query.',
          input_schema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Gmail search query, e.g. "label:marketing newer_than:7d".',
              },
              max_results: {
                type: 'number',
                description: 'Maximum number of messages to load.',
                default: 10,
              },
            },
            required: ['query'],
          },
        },
        {
          id: 'tool-fetch-message',
          tool_name: 'fetch_message',
          description: 'Retrieves a specific Gmail message by ID with metadata.',
          input_schema: {
            type: 'object',
            properties: {
              message_id: { type: 'string', description: 'The Gmail message ID.' },
              format: {
                type: 'string',
                enum: ['metadata', 'full', 'minimal'],
                description: 'Optional response format.',
              },
            },
            required: ['message_id'],
          },
        },
      ],
    },
    {
      id: 'server-filesystem',
      name: 'Local Filesystem MCP',
      description: 'Provides read/write access to local project files.',
      connection_url: 'mcp://filesystem/local',
      is_active: true,
      tools: [
        {
          id: 'tool-read-file',
          tool_name: 'read_file',
          description: 'Reads a file from disk.',
          input_schema: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Absolute or relative file path.' },
            },
            required: ['path'],
          },
        },
        {
          id: 'tool-write-file',
          tool_name: 'write_file',
          description: 'Writes content to a file.',
          input_schema: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              content: { type: 'string' },
            },
            required: ['path', 'content'],
          },
        },
      ],
    },
    {
      id: 'server-file-conversion',
      name: 'File Conversion MCP',
      description: 'Convert documents between formats and summarize large diffs.',
      connection_url: 'mcp://file-conversion/local',
      is_active: true,
      tools: [
        {
          id: 'tool-convert-to-pdf',
          tool_name: 'convert_to_pdf',
          description: 'Converts a supported document into a PDF file.',
          input_schema: {
            type: 'object',
            properties: {
              source_path: { type: 'string', description: 'Path to the source document.' },
              destination_path: {
                type: 'string',
                description: 'Optional destination path for the generated PDF.',
              },
            },
            required: ['source_path'],
          },
        },
        {
          id: 'tool-summarize-diff',
          tool_name: 'summarize_diff',
          description: 'Summarizes a diff or patch into a readable changelog.',
          input_schema: {
            type: 'object',
            properties: {
              diff_preview: {
                type: 'string',
                description: 'A short excerpt of the diff content.',
              },
              max_highlights: {
                type: 'number',
                description: 'Maximum number of highlights to include.',
                default: 3,
              },
            },
            required: ['diff_preview'],
          },
        },
      ],
    },
  ],

  conversations: [
    {
      id: 'conv-001',
      title: 'Code Review Session',
      summary: 'Assistant helped refactor the authentication flow and ran lint checks.',
      created_at: '2025-03-10T09:12:00Z',
      updated_at: '2025-03-10T09:35:00Z',
      metadata: {
        project: 'EGDesk',
        participants: ['alice', 'eg-assistant'],
      },
      messages: [
        {
          id: 'msg-001',
          role: 'user',
          content: 'Can you review the new AuthProvider implementation?',
          created_at: '2025-03-10T09:12:05Z',
        },
        {
          id: 'msg-002',
          role: 'assistant',
          content: 'Sure, let me scan the relevant files.',
          created_at: '2025-03-10T09:12:22Z',
        },
        {
          id: 'msg-003',
          role: 'assistant',
          content: 'I found a missing null check. I can apply a patch if you want.',
          created_at: '2025-03-10T09:13:11Z',
        },
        {
          id: 'msg-004',
          role: 'user',
          content: 'Yes, please patch it and run lint afterwards.',
          created_at: '2025-03-10T09:13:32Z',
        },
      ],
      toolCalls: [
        {
          id: 'toolcall-001',
          message_id: 'msg-002',
          server_id: 'server-filesystem',
          tool_id: 'tool-read-file',
          tool_name: 'read_file',
          input_params: {
            path: 'src/renderer/contexts/AuthContext.tsx',
          },
          output_result: {
            snippet_preview: 'export const AuthProvider = ({ children }: { children: ReactNode }) => {',
          },
          status: 'success',
          started_at: '2025-03-10T09:12:23Z',
          completed_at: '2025-03-10T09:12:24Z',
        },
        {
          id: 'toolcall-002',
          message_id: 'msg-003',
          server_id: 'server-filesystem',
          tool_id: 'tool-write-file',
          tool_name: 'write_file',
          input_params: {
            path: 'src/renderer/contexts/AuthContext.tsx',
            content: '// updated file content ...',
          },
          output_result: {
            bytes_written: 1843,
          },
          status: 'success',
          started_at: '2025-03-10T09:13:12Z',
          completed_at: '2025-03-10T09:13:13Z',
        },
        {
          id: 'toolcall-003',
          message_id: 'msg-003',
          server_id: 'server-file-conversion',
          tool_id: 'tool-summarize-diff',
          tool_name: 'summarize_diff',
          input_params: {
            diff_preview: '@@ -45,6 +45,9 @@ function AuthProvider() {...}',
            max_highlights: 2,
          },
          output_result: {
            highlights: [
              'Added null-check for session.user before accessing metadata.',
              'Updated error handler to guard against undefined tokens.',
            ],
          },
          status: 'success',
          started_at: '2025-03-10T09:13:20Z',
          completed_at: '2025-03-10T09:13:21Z',
        },
      ],
    },
    {
      id: 'conv-002',
      title: 'Marketing Dashboard Fix',
      summary: 'Investigated analytics discrepancy and verified warehouse sync.',
      created_at: '2025-03-09T14:01:00Z',
      updated_at: '2025-03-09T14:20:00Z',
      metadata: {
        project: 'Marketing Dashboard',
        participants: ['bob', 'eg-assistant'],
      },
      messages: [
        {
          id: 'msg-101',
          role: 'user',
          content: 'Our weekly active user numbers look wrong. Can you check the pipeline?',
          created_at: '2025-03-09T14:01:05Z',
        },
        {
          id: 'msg-102',
          role: 'assistant',
          content: 'I will query the latest warehouse import status.',
          created_at: '2025-03-09T14:01:15Z',
        },
        {
          id: 'msg-103',
          role: 'assistant',
          content:
            'The sync job completed successfully 2 hours ago. No errors reported. Should I rerun diagnostics?',
          created_at: '2025-03-09T14:03:41Z',
        },
        {
          id: 'msg-104',
          role: 'user',
          content: 'Yes, run diagnostics and compare with the backup data.',
          created_at: '2025-03-09T14:04:00Z',
        },
      ],
      toolCalls: [
        {
          id: 'toolcall-101',
          message_id: 'msg-102',
          server_id: 'server-gmail',
          tool_id: 'tool-list-messages',
          tool_name: 'list_messages',
          input_params: {
            query: 'label:marketing-dashboard status:update newer_than:2d',
            max_results: 20,
          },
          output_result: {
            messages: [
              { id: 'msg-45', subject: '[Sync] Marketing dashboard refresh complete', timestamp: '2025-03-09T12:15:00Z' },
              { id: 'msg-44', subject: '[Alert] KPI discrepancy resolved', timestamp: '2025-03-09T11:40:00Z' },
            ],
          },
          status: 'success',
          started_at: '2025-03-09T14:01:16Z',
          completed_at: '2025-03-09T14:01:17Z',
        },
        {
          id: 'toolcall-102',
          message_id: 'msg-103',
          server_id: 'server-gmail',
          tool_id: 'tool-fetch-message',
          tool_name: 'fetch_message',
          input_params: {
            message_id: 'msg-44',
            format: 'metadata',
          },
          output_result: {
            headers: {
              subject: '[Alert] KPI discrepancy resolved',
              from: 'alerts@egdesk.ai',
            },
            snippet: 'Diagnostics confirm parity with warehouse metrics. No follow-up needed.',
          },
          status: 'success',
          started_at: '2025-03-09T14:03:42Z',
          completed_at: '2025-03-09T14:03:43Z',
        },
        {
          id: 'toolcall-103',
          message_id: 'msg-104',
          server_id: 'server-filesystem',
          tool_id: 'tool-read-file',
          tool_name: 'read_file',
          input_params: {
            path: '/backups/warehouse/2025-03-02/weekly_active_users.json',
          },
          output_result: {
            snippet_preview: '{ "week": "2025-03-02", "wau": 42134 }',
          },
          status: 'success',
          started_at: '2025-03-09T14:04:05Z',
          completed_at: '2025-03-09T14:04:06Z',
        },
        {
          id: 'toolcall-104',
          message_id: 'msg-104',
          server_id: 'server-file-conversion',
          tool_id: 'tool-convert-to-pdf',
          tool_name: 'convert_to_pdf',
          input_params: {
            source_path: '/reports/marketing/dashboard-diagnostics.md',
            destination_path: '/reports/marketing/dashboard-diagnostics.pdf',
          },
          output_result: {
            destination_path: '/reports/marketing/dashboard-diagnostics.pdf',
            estimated_pages: 4,
          },
          status: 'success',
          started_at: '2025-03-09T14:04:10Z',
          completed_at: '2025-03-09T14:04:11Z',
        },
      ],
    },
  ],
};

