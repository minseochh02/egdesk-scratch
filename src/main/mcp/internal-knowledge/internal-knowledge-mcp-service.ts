/**
 * Internal Knowledge MCP Service
 * Implements the IMCPService interface for Business Identity and Company Research operations
 *
 * Provides AI access to:
 * - Internal knowledge documents (hierarchies, processes, policies, notes)
 * - Business identity snapshots (company info, services/products)
 * - Company research data (client companies)
 */

import Database from 'better-sqlite3';
import { IMCPService, MCPTool, MCPServerInfo, MCPCapabilities, MCPToolResult } from '../types/mcp-service';
import { SQLiteBusinessIdentityManager } from '../../sqlite/business-identity';
import { SQLiteCompanyResearchManager } from '../../sqlite/company-research';

/**
 * Internal Knowledge MCP Service
 * Provides MCP tools for querying business identity data, knowledge documents, and company research
 *
 * Security: Read-only access to all data
 */
export class InternalKnowledgeMCPService implements IMCPService {
  private manager: SQLiteBusinessIdentityManager;
  private researchManager: SQLiteCompanyResearchManager;

  constructor(wordpressDatabase: Database.Database, conversationsDatabase: Database.Database) {
    this.manager = new SQLiteBusinessIdentityManager(wordpressDatabase);
    this.researchManager = new SQLiteCompanyResearchManager(conversationsDatabase);
  }

  getServerInfo(): MCPServerInfo {
    return {
      name: 'business-identity-mcp-server',
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
      // Knowledge Documents
      {
        name: 'knowledge_list_documents',
        description: 'List all internal knowledge documents for a business identity snapshot, optionally filtered by category',
        inputSchema: {
          type: 'object',
          properties: {
            snapshotId: {
              type: 'string',
              description: 'Business identity snapshot ID (required)'
            },
            category: {
              type: 'string',
              enum: ['hierarchy', 'process', 'policy', 'note'],
              description: 'Filter by document category'
            }
          },
          required: ['snapshotId']
        }
      },
      {
        name: 'knowledge_get_document',
        description: 'Get a specific knowledge document by ID, including full markdown content',
        inputSchema: {
          type: 'object',
          properties: {
            documentId: {
              type: 'string',
              description: 'Knowledge document ID'
            }
          },
          required: ['documentId']
        }
      },
      {
        name: 'knowledge_search_content',
        description: 'Search knowledge documents by text in title or content (markdown)',
        inputSchema: {
          type: 'object',
          properties: {
            snapshotId: {
              type: 'string',
              description: 'Business identity snapshot ID (required)'
            },
            searchText: {
              type: 'string',
              description: 'Text to search for in title and content'
            },
            category: {
              type: 'string',
              enum: ['hierarchy', 'process', 'policy', 'note'],
              description: 'Filter by document category'
            }
          },
          required: ['snapshotId', 'searchText']
        }
      },
      {
        name: 'knowledge_get_by_category',
        description: 'Get all documents of a specific category (hierarchy, process, policy, or note)',
        inputSchema: {
          type: 'object',
          properties: {
            snapshotId: {
              type: 'string',
              description: 'Business identity snapshot ID (required)'
            },
            category: {
              type: 'string',
              enum: ['hierarchy', 'process', 'policy', 'note'],
              description: 'Category to retrieve'
            }
          },
          required: ['snapshotId', 'category']
        }
      },
      {
        name: 'knowledge_create_document',
        description: 'Create a new knowledge document with title, category, and optional content',
        inputSchema: {
          type: 'object',
          properties: {
            snapshotId: {
              type: 'string',
              description: 'Business identity snapshot ID (required)'
            },
            title: {
              type: 'string',
              description: 'Document title (required)'
            },
            category: {
              type: 'string',
              enum: ['hierarchy', 'process', 'policy', 'note'],
              description: 'Document category (required)'
            },
            content: {
              type: 'string',
              description: 'Markdown content (optional, defaults to empty string)'
            }
          },
          required: ['snapshotId', 'title', 'category']
        }
      },
      {
        name: 'knowledge_update_document',
        description: 'Update an existing knowledge document\'s title, category, or content',
        inputSchema: {
          type: 'object',
          properties: {
            documentId: {
              type: 'string',
              description: 'Knowledge document ID (required)'
            },
            title: {
              type: 'string',
              description: 'New document title (optional)'
            },
            category: {
              type: 'string',
              enum: ['hierarchy', 'process', 'policy', 'note'],
              description: 'New document category (optional)'
            },
            content: {
              type: 'string',
              description: 'New markdown content (optional)'
            }
          },
          required: ['documentId']
        }
      },
      {
        name: 'knowledge_delete_document',
        description: 'Delete a knowledge document by ID',
        inputSchema: {
          type: 'object',
          properties: {
            documentId: {
              type: 'string',
              description: 'Knowledge document ID to delete (required)'
            }
          },
          required: ['documentId']
        }
      },

      // Business Identity Snapshots
      {
        name: 'businessidentity_list_snapshots',
        description: 'List all business identity snapshots for a brand, including basic metadata',
        inputSchema: {
          type: 'object',
          properties: {
            brandKey: {
              type: 'string',
              description: 'Brand key to filter snapshots (optional)'
            }
          },
          required: []
        }
      },
      {
        name: 'businessidentity_get_snapshot',
        description: 'Get a full business identity snapshot by ID, including all company data, services/products, SEO/SSL analysis',
        inputSchema: {
          type: 'object',
          properties: {
            snapshotId: {
              type: 'string',
              description: 'Business identity snapshot ID'
            }
          },
          required: ['snapshotId']
        }
      },
      {
        name: 'businessidentity_get_company_info',
        description: 'Extract company information (contact, structure, partners, target industries) from a snapshot',
        inputSchema: {
          type: 'object',
          properties: {
            snapshotId: {
              type: 'string',
              description: 'Business identity snapshot ID'
            }
          },
          required: ['snapshotId']
        }
      },
      {
        name: 'businessidentity_get_services_products',
        description: 'Extract services and products from a business identity snapshot',
        inputSchema: {
          type: 'object',
          properties: {
            snapshotId: {
              type: 'string',
              description: 'Business identity snapshot ID'
            }
          },
          required: ['snapshotId']
        }
      },

      // Company Research
      {
        name: 'companyresearch_list_all',
        description: 'List all company research records (client companies) with minimal data, ordered by creation date',
        inputSchema: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['completed', 'failed', 'in_progress'],
              description: 'Filter by research status (optional)'
            }
          },
          required: []
        }
      },
      {
        name: 'companyresearch_get_by_id',
        description: 'Get a specific company research record by ID, including full data (crawl, summary, research, reports)',
        inputSchema: {
          type: 'object',
          properties: {
            researchId: {
              type: 'string',
              description: 'Company research record ID'
            }
          },
          required: ['researchId']
        }
      },
      {
        name: 'companyresearch_get_by_domain',
        description: 'Get all research records for a specific domain, ordered by creation date',
        inputSchema: {
          type: 'object',
          properties: {
            domain: {
              type: 'string',
              description: 'Company domain (e.g., example.com)'
            }
          },
          required: ['domain']
        }
      },
      {
        name: 'companyresearch_search',
        description: 'Search company research records by company name or domain',
        inputSchema: {
          type: 'object',
          properties: {
            searchText: {
              type: 'string',
              description: 'Text to search in company name or domain'
            }
          },
          required: ['searchText']
        }
      }
    ];
  }

  async executeTool(name: string, args: Record<string, any>): Promise<MCPToolResult> {
    try {
      let result: any;

      switch (name) {
        case 'knowledge_list_documents': {
          const { snapshotId, category } = args;

          if (!snapshotId) {
            throw new Error('snapshotId is required');
          }

          let documents = this.manager.listKnowledgeDocuments(snapshotId);

          // Filter by category if specified
          if (category) {
            documents = documents.filter(doc => doc.category === category);
          }

          result = {
            totalDocuments: documents.length,
            snapshotId,
            category: category || 'all',
            documents: documents.map((doc) => ({
              id: doc.id,
              title: doc.title,
              category: doc.category,
              contentPreview: doc.content.substring(0, 200) + (doc.content.length > 200 ? '...' : ''),
              contentLength: doc.content.length,
              createdAt: doc.createdAt,
              updatedAt: doc.updatedAt
            }))
          };
          break;
        }

        case 'knowledge_get_document': {
          const { documentId } = args;

          if (!documentId) {
            throw new Error('documentId is required');
          }

          const doc = this.manager.getKnowledgeDocument(documentId);

          if (!doc) {
            throw new Error('Document not found');
          }

          result = {
            id: doc.id,
            snapshotId: doc.snapshotId,
            title: doc.title,
            category: doc.category,
            content: doc.content,
            contentLength: doc.content.length,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt
          };
          break;
        }

        case 'knowledge_search_content': {
          const { snapshotId, searchText, category } = args;

          if (!snapshotId) {
            throw new Error('snapshotId is required');
          }

          if (!searchText) {
            throw new Error('searchText is required');
          }

          let documents = this.manager.listKnowledgeDocuments(snapshotId);

          // Filter by category if specified
          if (category) {
            documents = documents.filter(doc => doc.category === category);
          }

          // Search in title and content
          const searchLower = searchText.toLowerCase();
          const matchingDocuments = documents.filter(doc =>
            doc.title.toLowerCase().includes(searchLower) ||
            doc.content.toLowerCase().includes(searchLower)
          );

          result = {
            totalMatches: matchingDocuments.length,
            snapshotId,
            searchText,
            category: category || 'all',
            documents: matchingDocuments.map((doc) => ({
              id: doc.id,
              title: doc.title,
              category: doc.category,
              content: doc.content,
              contentLength: doc.content.length,
              createdAt: doc.createdAt,
              updatedAt: doc.updatedAt
            }))
          };
          break;
        }

        case 'knowledge_get_by_category': {
          const { snapshotId, category } = args;

          if (!snapshotId) {
            throw new Error('snapshotId is required');
          }

          if (!category) {
            throw new Error('category is required');
          }

          const allDocuments = this.manager.listKnowledgeDocuments(snapshotId);
          const documents = allDocuments.filter(doc => doc.category === category);

          result = {
            totalDocuments: documents.length,
            snapshotId,
            category,
            documents: documents.map((doc) => ({
              id: doc.id,
              title: doc.title,
              category: doc.category,
              content: doc.content,
              contentLength: doc.content.length,
              createdAt: doc.createdAt,
              updatedAt: doc.updatedAt
            }))
          };
          break;
        }

        case 'knowledge_create_document': {
          const { snapshotId, title, category, content } = args;

          if (!snapshotId) {
            throw new Error('snapshotId is required');
          }

          if (!title) {
            throw new Error('title is required');
          }

          if (!category) {
            throw new Error('category is required');
          }

          const doc = this.manager.createKnowledgeDocument({
            snapshotId,
            title,
            category,
            content: content || ''
          });

          result = {
            success: true,
            document: {
              id: doc.id,
              snapshotId: doc.snapshotId,
              title: doc.title,
              category: doc.category,
              content: doc.content,
              contentLength: doc.content.length,
              createdAt: doc.createdAt,
              updatedAt: doc.updatedAt
            }
          };
          break;
        }

        case 'knowledge_update_document': {
          const { documentId, title, category, content } = args;

          if (!documentId) {
            throw new Error('documentId is required');
          }

          const updates: any = {};
          if (title !== undefined) updates.title = title;
          if (category !== undefined) updates.category = category;
          if (content !== undefined) updates.content = content;

          if (Object.keys(updates).length === 0) {
            throw new Error('At least one field (title, category, or content) must be provided for update');
          }

          const doc = this.manager.updateKnowledgeDocument(documentId, updates);

          if (!doc) {
            throw new Error('Document not found');
          }

          result = {
            success: true,
            document: {
              id: doc.id,
              snapshotId: doc.snapshotId,
              title: doc.title,
              category: doc.category,
              content: doc.content,
              contentLength: doc.content.length,
              createdAt: doc.createdAt,
              updatedAt: doc.updatedAt
            }
          };
          break;
        }

        case 'knowledge_delete_document': {
          const { documentId } = args;

          if (!documentId) {
            throw new Error('documentId is required');
          }

          // Check if document exists before deleting
          const doc = this.manager.getKnowledgeDocument(documentId);
          if (!doc) {
            throw new Error('Document not found');
          }

          this.manager.deleteKnowledgeDocument(documentId);

          result = {
            success: true,
            deletedDocumentId: documentId,
            message: `Document "${doc.title}" deleted successfully`
          };
          break;
        }

        // Business Identity Snapshots
        case 'businessidentity_list_snapshots': {
          const { brandKey } = args;

          let snapshots;
          if (brandKey) {
            // Filter by brand key
            snapshots = this.manager.listSnapshots(brandKey);
          } else {
            // Get all snapshots by querying database directly
            const stmt = this.manager['db'].prepare(
              'SELECT * FROM business_identity_snapshots ORDER BY created_at DESC'
            );
            const rows = stmt.all() as any[];
            snapshots = rows.map((row: any) => this.manager['mapSnapshot'](row));
          }

          result = {
            totalSnapshots: snapshots.length,
            brandKey: brandKey || 'all',
            snapshots: snapshots.map((snapshot) => ({
              id: snapshot.id,
              brandKey: snapshot.brandKey,
              sourceUrl: snapshot.sourceUrl,
              aiProvider: snapshot.aiProvider,
              aiModel: snapshot.aiModel,
              createdAt: snapshot.createdAt,
              updatedAt: snapshot.updatedAt
            }))
          };
          break;
        }

        case 'businessidentity_get_snapshot': {
          const { snapshotId } = args;

          if (!snapshotId) {
            throw new Error('snapshotId is required');
          }

          const snapshot = this.manager.getSnapshot(snapshotId);

          if (!snapshot) {
            throw new Error('Snapshot not found');
          }

          // Parse identityJson to extract data
          let identityData = null;
          let seoAnalysis = null;
          let sslAnalysis = null;

          try {
            identityData = snapshot.identityJson ? JSON.parse(snapshot.identityJson) : null;
            seoAnalysis = snapshot.seoAnalysisJson ? JSON.parse(snapshot.seoAnalysisJson) : null;
            sslAnalysis = snapshot.sslAnalysisJson ? JSON.parse(snapshot.sslAnalysisJson) : null;
          } catch (parseError) {
            console.error('Failed to parse JSON fields:', parseError);
          }

          result = {
            id: snapshot.id,
            brandKey: snapshot.brandKey,
            sourceUrl: snapshot.sourceUrl,
            rawInput: snapshot.rawInput,
            aiProvider: snapshot.aiProvider,
            aiModel: snapshot.aiModel,
            identityData,
            seoAnalysis,
            sslAnalysis,
            createdAt: snapshot.createdAt,
            updatedAt: snapshot.updatedAt
          };
          break;
        }

        case 'businessidentity_get_company_info': {
          const { snapshotId } = args;

          if (!snapshotId) {
            throw new Error('snapshotId is required');
          }

          const snapshot = this.manager.getSnapshot(snapshotId);

          if (!snapshot) {
            throw new Error('Snapshot not found');
          }

          let identityData = null;
          try {
            identityData = snapshot.identityJson ? JSON.parse(snapshot.identityJson) : null;
          } catch (parseError) {
            throw new Error('Failed to parse identity data');
          }

          result = {
            snapshotId: snapshot.id,
            brandKey: snapshot.brandKey,
            contactAndLegal: identityData?.contactAndLegal || null,
            companyStructure: identityData?.companyStructure || null,
            partnersAndNetwork: identityData?.partnersAndNetwork || null,
            targetIndustriesMentioned: identityData?.targetIndustriesMentioned || []
          };
          break;
        }

        case 'businessidentity_get_services_products': {
          const { snapshotId } = args;

          if (!snapshotId) {
            throw new Error('snapshotId is required');
          }

          const snapshot = this.manager.getSnapshot(snapshotId);

          if (!snapshot) {
            throw new Error('Snapshot not found');
          }

          let identityData = null;
          try {
            identityData = snapshot.identityJson ? JSON.parse(snapshot.identityJson) : null;
          } catch (parseError) {
            throw new Error('Failed to parse identity data');
          }

          const servicesAndProducts = identityData?.centralServicesAndProducts || [];

          result = {
            snapshotId: snapshot.id,
            brandKey: snapshot.brandKey,
            totalCount: servicesAndProducts.length,
            servicesAndProducts: servicesAndProducts.map((item: any) => ({
              name: item.name,
              kind: item.kind,
              oneLineSummary: item.oneLineSummary || null,
              canonicalLandingUrl: item.canonicalLandingUrl || null,
              canonicalHubUrl: item.canonicalHubUrl || null,
              imageUrls: item.imageUrls || [],
              pageUrls: item.pageUrls || []
            }))
          };
          break;
        }

        // Company Research
        case 'companyresearch_list_all': {
          const { status } = args;

          const allResearch = this.researchManager.getAllResearchMinimal();

          let filteredResearch = allResearch;
          if (status) {
            filteredResearch = allResearch.filter(r => r.status === status);
          }

          result = {
            totalRecords: filteredResearch.length,
            status: status || 'all',
            research: filteredResearch.map((r) => ({
              id: r.id,
              domain: r.domain,
              companyName: r.companyName,
              status: r.status,
              localReportPath: r.localReportPath || null,
              hasSummary: !!r.summaryData,
              hasDetailedReport: !!r.detailedReport,
              hasExecutiveSummary: !!r.executiveSummary,
              error: r.error || null,
              createdAt: r.createdAt,
              updatedAt: r.updatedAt
            }))
          };
          break;
        }

        case 'companyresearch_get_by_id': {
          const { researchId } = args;

          if (!researchId) {
            throw new Error('researchId is required');
          }

          const research = this.researchManager.getResearchById(researchId);

          if (!research) {
            throw new Error('Research record not found');
          }

          result = {
            id: research.id,
            domain: research.domain,
            companyName: research.companyName,
            status: research.status,
            crawlData: research.crawlData,
            summaryData: research.summaryData,
            researchData: research.researchData,
            detailedReport: research.detailedReport,
            executiveSummary: research.executiveSummary,
            localReportPath: research.localReportPath || null,
            inquiryData: research.inquiryData,
            error: research.error || null,
            createdAt: research.createdAt,
            updatedAt: research.updatedAt
          };
          break;
        }

        case 'companyresearch_get_by_domain': {
          const { domain } = args;

          if (!domain) {
            throw new Error('domain is required');
          }

          const researchRecords = this.researchManager.findByDomain(domain);

          result = {
            domain,
            totalRecords: researchRecords.length,
            research: researchRecords.map((r) => ({
              id: r.id,
              domain: r.domain,
              companyName: r.companyName,
              status: r.status,
              summaryData: r.summaryData,
              detailedReport: r.detailedReport,
              executiveSummary: r.executiveSummary,
              localReportPath: r.localReportPath || null,
              error: r.error || null,
              createdAt: r.createdAt,
              updatedAt: r.updatedAt
            }))
          };
          break;
        }

        case 'companyresearch_search': {
          const { searchText } = args;

          if (!searchText) {
            throw new Error('searchText is required');
          }

          const allResearch = this.researchManager.getAllResearchMinimal();
          const searchLower = searchText.toLowerCase();

          const matchingRecords = allResearch.filter(r =>
            r.companyName.toLowerCase().includes(searchLower) ||
            r.domain.toLowerCase().includes(searchLower)
          );

          result = {
            searchText,
            totalMatches: matchingRecords.length,
            research: matchingRecords.map((r) => ({
              id: r.id,
              domain: r.domain,
              companyName: r.companyName,
              status: r.status,
              localReportPath: r.localReportPath || null,
              hasSummary: !!r.summaryData,
              hasDetailedReport: !!r.detailedReport,
              hasExecutiveSummary: !!r.executiveSummary,
              error: r.error || null,
              createdAt: r.createdAt,
              updatedAt: r.updatedAt
            }))
          };
          break;
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to execute ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
