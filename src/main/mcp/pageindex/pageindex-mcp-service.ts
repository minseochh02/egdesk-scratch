/**
 * PageIndex MCP Service
 * Exposes PageIndex document indexing and retrieval as MCP tools.
 *
 * Tools:
 *   pageindex_index_document  - Index a PDF file and build the hierarchical tree
 *   pageindex_list_documents  - List all indexed documents
 *   pageindex_get_document    - Get metadata for a specific document
 *   pageindex_get_structure   - Get the hierarchical tree structure (no text, saves tokens)
 *   pageindex_get_pages       - Get raw page content for specific pages
 */

import { IMCPService, MCPTool, MCPServerInfo, MCPCapabilities, MCPToolResult } from '../types/mcp-service';
import { getPageIndexService } from '../../pageindex/pageindex-service';

export class PageIndexMCPService implements IMCPService {
  getServerInfo(): MCPServerInfo {
    return { name: 'pageindex-mcp-server', version: '1.0.0' };
  }

  getCapabilities(): MCPCapabilities {
    return { tools: {} };
  }

  listTools(): MCPTool[] {
    return [
      {
        name: 'pageindex_index_document',
        description:
          'Index a PDF file using PageIndex — builds a hierarchical tree structure with section summaries. Returns a document_id used by all other pageindex tools. Only needs to be called once per document.',
        inputSchema: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'Absolute path to the PDF file to index',
            },
          },
          required: ['file_path'],
        },
      },
      {
        name: 'pageindex_list_documents',
        description: 'List all PDF documents that have been indexed with PageIndex, including their IDs, names, and descriptions.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'pageindex_get_document',
        description: 'Get metadata for a specific indexed document: name, description, type, and page count.',
        inputSchema: {
          type: 'object',
          properties: {
            doc_id: {
              type: 'string',
              description: 'Document ID returned by pageindex_index_document',
            },
          },
          required: ['doc_id'],
        },
      },
      {
        name: 'pageindex_get_structure',
        description:
          'Get the hierarchical tree structure of an indexed document. Returns section titles, page ranges, and summaries — without full page text to save tokens. Use this to understand document layout before fetching specific pages.',
        inputSchema: {
          type: 'object',
          properties: {
            doc_id: {
              type: 'string',
              description: 'Document ID returned by pageindex_index_document',
            },
          },
          required: ['doc_id'],
        },
      },
      {
        name: 'pageindex_get_pages',
        description:
          'Get the raw text content of specific pages from an indexed document. Use pageindex_get_structure first to find relevant page ranges, then fetch only the pages you need.',
        inputSchema: {
          type: 'object',
          properties: {
            doc_id: {
              type: 'string',
              description: 'Document ID returned by pageindex_index_document',
            },
            pages: {
              type: 'string',
              description: 'Pages to retrieve. Examples: "5" (single page), "3,8" (specific pages), "5-7" (range), "1,3,5-7" (combined)',
            },
          },
          required: ['doc_id', 'pages'],
        },
      },
      {
        name: 'pageindex_delete_document',
        description: 'Delete an indexed document and its stored data from the PageIndex workspace.',
        inputSchema: {
          type: 'object',
          properties: {
            doc_id: {
              type: 'string',
              description: 'Document ID to delete',
            },
          },
          required: ['doc_id'],
        },
      },
    ];
  }

  async executeTool(name: string, args: Record<string, any>): Promise<MCPToolResult> {
    try {
      const service = getPageIndexService();
      let result: any;

      switch (name) {
        case 'pageindex_index_document': {
          const { file_path } = args;
          if (!file_path) throw new Error('file_path is required');

          const docId = await service.indexDocument(file_path);
          result = {
            success: true,
            doc_id: docId,
            message: `Document indexed successfully. Use doc_id "${docId}" with other pageindex tools.`,
          };
          break;
        }

        case 'pageindex_list_documents': {
          const documents = service.listDocuments();
          result = {
            total: documents.length,
            documents,
          };
          break;
        }

        case 'pageindex_get_document': {
          const { doc_id } = args;
          if (!doc_id) throw new Error('doc_id is required');
          result = JSON.parse(service.getDocument(doc_id));
          break;
        }

        case 'pageindex_get_structure': {
          const { doc_id } = args;
          if (!doc_id) throw new Error('doc_id is required');
          result = JSON.parse(service.getDocumentStructure(doc_id));
          break;
        }

        case 'pageindex_get_pages': {
          const { doc_id, pages } = args;
          if (!doc_id) throw new Error('doc_id is required');
          if (!pages) throw new Error('pages is required');
          result = JSON.parse(service.getPageContent(doc_id, pages));
          break;
        }

        case 'pageindex_delete_document': {
          const { doc_id } = args;
          if (!doc_id) throw new Error('doc_id is required');
          const deleted = service.deleteDocument(doc_id);
          result = { success: deleted, doc_id };
          break;
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to execute ${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
