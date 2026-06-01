/**
 * Tool Execution System
 * Handles tool registration, validation, and execution
 * Based on Gemini CLI patterns but simplified for EGDesk
 */

import type { 
  ToolDefinition, 
  ToolCallRequestInfo, 
  ToolCallResponseInfo,
  ToolCallConfirmationDetails,
  ToolExecutor
} from '../types/ai-types';
import { 
  ReadFileTool,
  WriteFileTool,
  ListDirectoryTool,
  ShellCommandTool,
  AnalyzeProjectTool,
  InitProjectTool,
  PartialEditTool,
  MoveFileTool,
  AppsScriptListFilesTool,
  AppsScriptReadFileTool,
  AppsScriptWriteFileTool,
  AppsScriptPartialEditTool,
  AppsScriptRenameFileTool,
  AppsScriptDeleteFileTool,
  AppsScriptDocsTool,
  AppsScriptDocsListTool,
  AppsScriptPushToDevTool,
  AppsScriptPullFromDevTool,
  AppsScriptPushDevToProdTool,
  AppsScriptPullProdToDevTool,
  UserDataListTablesTool,
  UserDataQueryTool,
  UserDataSearchTool,
  UserDataAggregateTool,
  FinanceHubListBanksTool,
  FinanceHubListAccountsTool,
  FinanceHubQueryTransactionsTool,
  FinanceHubGetStatisticsTool,
  FinanceHubUpsertAccountTool,
  FinanceHubImportTransactionsTool,
  FinanceHubUpsertBankProductRowsTool,
  FinanceHubDeleteAccountTool,
  FinanceHubDeleteImportedDataForBankTool,
  FinanceHubDeleteTransactionsTool,
  FinanceHubDeleteBankProductRowsTool,
  FinanceHubImportHometaxDataTool,
  FinanceHubDeleteHometaxDataTool,
  FinanceHubDeleteImportedHometaxForBusinessTool,
  InternalKnowledgeListSnapshotsTool,
  InternalKnowledgeGetSnapshotTool,
  InternalKnowledgeGetCompanyInfoTool,
  InternalKnowledgeGetServicesProductsTool,
  KnowledgeListDocumentsTool,
  KnowledgeGetDocumentTool,
  KnowledgeSearchContentTool,
  KnowledgeGetByCategoryTool,
  KnowledgeCreateDocumentTool,
  KnowledgeUpdateDocumentTool,
  KnowledgeDeleteDocumentTool,
  CompanyResearchListAllTool,
  CompanyResearchGetByIdTool,
  CompanyResearchGetByDomainTool,
  CompanyResearchSearchTool,
  KoreanLawSearchTool,
  KoreanLawGetTextTool,
  KoreanLawGetDecisionTool,
  PageIndexIndexDocumentTool,
  PageIndexListDocumentsTool,
  PageIndexGetDocumentTool,
  PageIndexGetStructureTool,
  PageIndexGetPagesTool,
} from './tools';


export class ToolRegistry {
  private tools = new Map<string, ToolExecutor>();
  private pendingConfirmations = new Map<string, ToolCallRequestInfo>();

  constructor() {
    this.registerBuiltinTools();
  }

  /**
   * Register a tool executor
   */
  registerTool(tool: ToolExecutor): void {
    this.tools.set(tool.name, tool);
    console.log(`🔧 Registered tool: ${tool.name}`);
  }

  /**
   * Get all registered tools as definitions for AI
   */
  getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: this.getParameterSchema(tool.name),
      dangerous: tool.dangerous,
      requiresConfirmation: tool.requiresConfirmation
    }));
  }

  /**
   * Get parameter schema for a specific tool
   */
  private getParameterSchema(toolName: string): any {
    switch (toolName) {
      case 'read_file':
        return {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'The path to the file to read. Can be relative to current directory or absolute path.'
            }
          },
          required: ['file_path']
        };
      
      case 'write_file':
        return {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'The path where to create/write the file. Can be relative to current directory or absolute path.'
            },
            content: {
              type: 'string',
              description: 'The content to write to the file'
            }
          },
          required: ['file_path', 'content']
        };
      
      case 'list_directory':
        return {
          type: 'object',
          properties: {
            dir_path: {
              type: 'string',
              description: 'The path to the directory to list. If not provided, lists the current project directory.'
            }
          },
          required: []
        };
      
      case 'shell_command':
        return {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'The shell command to execute'
            },
            cwd: {
              type: 'string',
              description: 'Optional: Working directory for the command'
            }
          },
          required: ['command']
        };
      
      case 'analyze_project':
        return {
          type: 'object',
          properties: {
            project_path: {
              type: 'string',
              description: 'Optional: Path to the project to analyze. Defaults to current directory.'
            }
          },
          required: []
        };
      
      case 'init_project':
        return {
          type: 'object',
          properties: {
            folder_path: {
              type: 'string',
              description: 'The folder path where to initialize the new project'
            }
          },
          required: ['folder_path']
        };
      
      case 'partial_edit':
        return {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'The path to the file to edit. Can be relative to current directory or absolute path.'
            },
            old_string: {
              type: 'string',
              description: 'The exact text to replace. Must match exactly including whitespace and indentation.'
            },
            new_string: {
              type: 'string',
              description: 'The text to replace old_string with.'
            },
            expected_replacements: {
              type: 'number',
              description: 'Number of occurrences to replace. Defaults to 1 if not specified.'
            },
            instruction: {
              type: 'string',
              description: 'Optional instruction describing what needs to be changed for better context.'
            },
            flexible_matching: {
              type: 'boolean',
              description: 'Whether to use flexible matching that tolerates whitespace differences. Defaults to true.'
            }
          },
          required: ['file_path', 'old_string', 'new_string']
        };
      
      case 'apps_script_list_files':
        return {
          type: 'object',
          properties: {
            script_id: {
              type: 'string',
              description: 'The AppsScript project ID (stored in cloudmcp.db SQLite database)'
            }
          },
          required: ['script_id']
        };
      
      case 'apps_script_read_file':
        return {
          type: 'object',
          properties: {
            script_id: {
              type: 'string',
              description: 'The AppsScript project ID (stored in cloudmcp.db SQLite database)'
            },
            file_name: {
              type: 'string',
              description: 'The name of the file to read (e.g., "Code.gs", "MyFunction.gs")'
            }
          },
          required: ['script_id', 'file_name']
        };
      
      case 'apps_script_write_file':
        return {
          type: 'object',
          properties: {
            script_id: {
              type: 'string',
              description: 'The AppsScript project ID (stored in cloudmcp.db SQLite database)'
            },
            file_name: {
              type: 'string',
              description: 'The name of the file to write'
            },
            content: {
              type: 'string',
              description: 'The content to write to the file'
            },
            file_type: {
              type: 'string',
              description: 'Optional: File type (default: "SERVER_JS")'
            }
          },
          required: ['script_id', 'file_name', 'content']
        };
      
      case 'apps_script_partial_edit':
        return {
          type: 'object',
          properties: {
            script_id: {
              type: 'string',
              description: 'The AppsScript project ID (stored in cloudmcp.db SQLite database)'
            },
            file_name: {
              type: 'string',
              description: 'The name of the file to edit'
            },
            old_string: {
              type: 'string',
              description: 'The exact text to replace'
            },
            new_string: {
              type: 'string',
              description: 'The text to replace old_string with'
            },
            expected_replacements: {
              type: 'number',
              description: 'Number of occurrences to replace (default: 1)'
            },
            flexible_matching: {
              type: 'boolean',
              description: 'Whether to use flexible matching (default: true)'
            }
          },
          required: ['script_id', 'file_name', 'old_string', 'new_string']
        };
      
      case 'apps_script_rename_file':
        return {
          type: 'object',
          properties: {
            script_id: {
              type: 'string',
              description: 'The AppsScript project ID (stored in cloudmcp.db SQLite database)'
            },
            old_file_name: {
              type: 'string',
              description: 'The current name of the file'
            },
            new_file_name: {
              type: 'string',
              description: 'The new name for the file'
            }
          },
          required: ['script_id', 'old_file_name', 'new_file_name']
        };
      
      case 'apps_script_delete_file':
        return {
          type: 'object',
          properties: {
            script_id: {
              type: 'string',
              description: 'The AppsScript project ID (stored in cloudmcp.db SQLite database)'
            },
            file_name: {
              type: 'string',
              description: 'The name of the file to delete'
            }
          },
          required: ['script_id', 'file_name']
        };
      
      case 'apps_script_docs':
        return {
          type: 'object',
          properties: {
            service: {
              type: 'string',
              description: 'The Apps Script service name (e.g., "spreadsheet", "document", "drive", "gmail", "calendar")'
            },
            class_name: {
              type: 'string',
              description: 'The class name to get documentation for (e.g., "Spreadsheet", "Sheet", "Range", "Document")'
            },
            method_filter: {
              type: 'string',
              description: 'Optional: Filter methods by name pattern (e.g., "getValue*" or "set*"). Supports wildcards.'
            }
          },
          required: ['service', 'class_name']
        };
      
      case 'apps_script_docs_list':
        return {
          type: 'object',
          properties: {
            service: {
              type: 'string',
              description: 'Optional: The Apps Script service name to list classes for. If not provided, lists all available documentation.'
            }
          },
          required: []
        };
      
      case 'user_data_list_tables':
        return {
          type: 'object',
          properties: {},
          required: []
        };
      
      case 'user_data_query':
        return {
          type: 'object',
          properties: {
            table_name: {
              type: 'string',
              description: 'The name of the user-imported table to query'
            },
            filters: {
              type: 'object',
              description: 'Optional: Filter conditions as key-value pairs (e.g., {"status": "active", "age": ">30"}). Supports operators: =, >, <, >=, <=, !='
            },
            limit: {
              type: 'number',
              description: 'Optional: Maximum number of rows to return (default: 100, max: 1000)'
            },
            offset: {
              type: 'number',
              description: 'Optional: Number of rows to skip for pagination (default: 0)'
            },
            order_by: {
              type: 'string',
              description: 'Optional: Column name to sort by'
            },
            order_direction: {
              type: 'string',
              description: 'Optional: Sort direction (ASC or DESC, default: ASC)'
            }
          },
          required: ['table_name']
        };
      
      case 'user_data_search':
        return {
          type: 'object',
          properties: {
            table_name: {
              type: 'string',
              description: 'The name of the user-imported table to search'
            },
            search_query: {
              type: 'string',
              description: 'The text to search for across all columns in the table'
            },
            limit: {
              type: 'number',
              description: 'Optional: Maximum number of results to return (default: 100, max: 1000)'
            }
          },
          required: ['table_name', 'search_query']
        };
      
      case 'user_data_aggregate':
        return {
          type: 'object',
          properties: {
            table_name: {
              type: 'string',
              description: 'The name of the user-imported table'
            },
            column: {
              type: 'string',
              description: 'The column name to aggregate'
            },
            function: {
              type: 'string',
              description: 'The aggregation function: SUM, AVG, COUNT, MIN, or MAX'
            },
            filters: {
              type: 'object',
              description: 'Optional: Filter conditions to apply before aggregation'
            },
            group_by: {
              type: 'string',
              description: 'Optional: Column name to group results by'
            }
          },
          required: ['table_name', 'column', 'function']
        };

      case 'financehub_list_banks':
        return {
          type: 'object',
          properties: {},
          required: []
        };

      case 'financehub_list_accounts':
        return {
          type: 'object',
          properties: {
            bankId: {
              type: 'string',
              description: 'Optional: Filter by specific bank ID (e.g., "shinhan", "kookmin")'
            },
            isActive: {
              type: 'boolean',
              description: 'Optional: Filter by active status (true = active accounts only)'
            }
          },
          required: []
        };

      case 'financehub_query_transactions':
        return {
          type: 'object',
          properties: {
            accountId: {
              type: 'string',
              description: 'Optional: Filter by account ID'
            },
            bankId: {
              type: 'string',
              description: 'Optional: Filter by bank ID'
            },
            startDate: {
              type: 'string',
              description: 'Optional: Start date filter (YYYY-MM-DD format)'
            },
            endDate: {
              type: 'string',
              description: 'Optional: End date filter (YYYY-MM-DD format)'
            },
            category: {
              type: 'string',
              description: 'Optional: Filter by transaction category'
            },
            minAmount: {
              type: 'number',
              description: 'Optional: Minimum transaction amount'
            },
            maxAmount: {
              type: 'number',
              description: 'Optional: Maximum transaction amount'
            },
            searchText: {
              type: 'string',
              description: 'Optional: Search in description, memo, or counterparty fields'
            },
            limit: {
              type: 'number',
              description: 'Optional: Maximum number of transactions to return (default: 100, max: 1000)'
            },
            offset: {
              type: 'number',
              description: 'Optional: Number of transactions to skip for pagination'
            },
            orderBy: {
              type: 'string',
              enum: ['date', 'amount', 'balance'],
              description: 'Optional: Column to sort by (default: date)'
            },
            orderDir: {
              type: 'string',
              enum: ['asc', 'desc'],
              description: 'Optional: Sort direction (default: desc)'
            }
          },
          required: []
        };

      case 'financehub_get_statistics':
        return {
          type: 'object',
          properties: {
            accountId: {
              type: 'string',
              description: 'Optional: Filter by account ID'
            },
            bankId: {
              type: 'string',
              description: 'Optional: Filter by bank ID'
            },
            startDate: {
              type: 'string',
              description: 'Optional: Start date filter (YYYY-MM-DD format)'
            },
            endDate: {
              type: 'string',
              description: 'Optional: End date filter (YYYY-MM-DD format)'
            }
          },
          required: []
        };

      case 'financehub_upsert_account':
        return {
          type: 'object',
          properties: {
            bankId: { type: 'string', description: 'Bank or card company id' },
            accountNumber: { type: 'string', description: 'Account or card number' },
            accountName: { type: 'string' },
            customerName: { type: 'string' },
            balance: { type: 'number' },
            availableBalance: { type: 'number' },
            currency: { type: 'string' },
            accountType: { type: 'string' },
            openDate: { type: 'string', description: 'YYYY-MM-DD' },
            metadata: { type: 'object' }
          },
          required: ['bankId', 'accountNumber']
        };

      case 'financehub_import_transactions':
        return {
          type: 'object',
          properties: {
            bankId: { type: 'string' },
            isCard: { type: 'boolean' },
            accountData: {
              type: 'object',
              properties: {
                accountNumber: { type: 'string' },
                accountName: { type: 'string' },
                customerName: { type: 'string' },
                balance: { type: 'number' },
                availableBalance: { type: 'number' },
                openDate: { type: 'string' }
              },
              required: ['accountNumber']
            },
            transactions: { type: 'array', items: { type: 'object' } },
            syncMetadata: {
              type: 'object',
              properties: {
                queryPeriodStart: { type: 'string' },
                queryPeriodEnd: { type: 'string' },
                filePath: { type: 'string' }
              },
              required: ['queryPeriodStart', 'queryPeriodEnd']
            }
          },
          required: ['bankId', 'accountData', 'transactions', 'syncMetadata']
        };

      case 'financehub_upsert_bank_product_rows':
        return {
          type: 'object',
          properties: {
            tableSlug: { type: 'string', description: 'From financehub_list_bank_product_tables' },
            rows: { type: 'array', items: { type: 'object' } }
          },
          required: ['tableSlug', 'rows']
        };

      case 'financehub_delete_account':
        return {
          type: 'object',
          properties: {
            bankId: { type: 'string' },
            accountNumber: { type: 'string' }
          },
          required: ['bankId', 'accountNumber']
        };

      case 'financehub_delete_imported_data_for_bank':
        return {
          type: 'object',
          properties: {
            bankId: { type: 'string' }
          },
          required: ['bankId']
        };

      case 'financehub_delete_transactions':
        return {
          type: 'object',
          properties: {
            accountId: { type: 'string' },
            bankId: { type: 'string' },
            accountNumber: { type: 'string' },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
            transactionIds: { type: 'array', items: { type: 'string' } },
            isCard: { type: 'boolean' }
          },
          required: []
        };

      case 'financehub_delete_bank_product_rows':
        return {
          type: 'object',
          properties: {
            tableSlug: { type: 'string' },
            ids: { type: 'array', items: { type: 'string' } },
            filters: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  column: { type: 'string' },
                  op: { type: 'string' },
                  value: {}
                },
                required: ['column', 'op', 'value']
              }
            }
          },
          required: ['tableSlug']
        };

      case 'financehub_import_hometax_data':
        return {
          type: 'object',
          properties: {
            dataType: {
              type: 'string',
              enum: ['tax-invoice', 'tax-exempt-invoice', 'cash-receipt']
            },
            businessNumber: { type: 'string' },
            invoiceType: { type: 'string', enum: ['sales', 'purchase'] },
            rows: { type: 'array', items: { type: 'object' } },
            excelFilePath: { type: 'string' }
          },
          required: ['dataType', 'businessNumber', 'rows']
        };

      case 'financehub_delete_hometax_data':
        return {
          type: 'object',
          properties: {
            dataType: {
              type: 'string',
              enum: ['tax-invoice', 'tax-exempt-invoice', 'cash-receipt']
            },
            businessNumber: { type: 'string' },
            invoiceType: { type: 'string', enum: ['sales', 'purchase'] },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
            ids: { type: 'array', items: { type: 'number' } }
          },
          required: ['dataType', 'businessNumber']
        };

      case 'financehub_delete_imported_hometax_for_business':
        return {
          type: 'object',
          properties: {
            businessNumber: { type: 'string' }
          },
          required: ['businessNumber']
        };

      case 'businessidentity_list_snapshots':
        return {
          type: 'object',
          properties: {
            brandKey: {
              type: 'string',
              description: 'Optional: Filter by specific brand key'
            }
          },
          required: []
        };

      case 'businessidentity_get_snapshot':
        return {
          type: 'object',
          properties: {
            snapshotId: {
              type: 'string',
              description: 'The ID of the business identity snapshot to retrieve'
            }
          },
          required: ['snapshotId']
        };

      case 'businessidentity_get_company_info':
        return {
          type: 'object',
          properties: {
            snapshotId: {
              type: 'string',
              description: 'The ID of the business identity snapshot'
            }
          },
          required: ['snapshotId']
        };

      case 'businessidentity_get_services_products':
        return {
          type: 'object',
          properties: {
            snapshotId: {
              type: 'string',
              description: 'The ID of the business identity snapshot'
            }
          },
          required: ['snapshotId']
        };

      case 'knowledge_list_documents':
        return {
          type: 'object',
          properties: {
            snapshotId: {
              type: 'string',
              description: 'The ID of the business identity snapshot'
            },
            category: {
              type: 'string',
              description: 'Optional: Filter by category (hierarchy/process/policy/note)'
            }
          },
          required: ['snapshotId']
        };

      case 'knowledge_get_document':
        return {
          type: 'object',
          properties: {
            documentId: {
              type: 'string',
              description: 'The ID of the knowledge document to retrieve'
            }
          },
          required: ['documentId']
        };

      case 'knowledge_search_content':
        return {
          type: 'object',
          properties: {
            snapshotId: {
              type: 'string',
              description: 'The ID of the business identity snapshot'
            },
            query: {
              type: 'string',
              description: 'Search query to match in title or content'
            }
          },
          required: ['snapshotId', 'query']
        };

      case 'knowledge_get_by_category':
        return {
          type: 'object',
          properties: {
            snapshotId: {
              type: 'string',
              description: 'The ID of the business identity snapshot'
            },
            category: {
              type: 'string',
              description: 'The category to filter by (hierarchy/process/policy/note)'
            }
          },
          required: ['snapshotId', 'category']
        };

      case 'knowledge_create_document':
        return {
          type: 'object',
          properties: {
            snapshotId: {
              type: 'string',
              description: 'The ID of the business identity snapshot'
            },
            title: {
              type: 'string',
              description: 'Document title'
            },
            category: {
              type: 'string',
              description: 'Document category (hierarchy/process/policy/note)'
            },
            content: {
              type: 'string',
              description: 'Optional: Markdown content (defaults to empty string)'
            }
          },
          required: ['snapshotId', 'title', 'category']
        };

      case 'knowledge_update_document':
        return {
          type: 'object',
          properties: {
            documentId: {
              type: 'string',
              description: 'The ID of the knowledge document to update'
            },
            title: {
              type: 'string',
              description: 'Optional: New document title'
            },
            category: {
              type: 'string',
              description: 'Optional: New document category (hierarchy/process/policy/note)'
            },
            content: {
              type: 'string',
              description: 'Optional: New markdown content'
            }
          },
          required: ['documentId']
        };

      case 'knowledge_delete_document':
        return {
          type: 'object',
          properties: {
            documentId: {
              type: 'string',
              description: 'The ID of the knowledge document to delete'
            }
          },
          required: ['documentId']
        };

      case 'companyresearch_list_all':
        return {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              description: 'Optional: Filter by research status (pending/in_progress/completed)'
            }
          },
          required: []
        };

      case 'companyresearch_get_by_id':
        return {
          type: 'object',
          properties: {
            researchId: {
              type: 'string',
              description: 'The ID of the company research record'
            }
          },
          required: ['researchId']
        };

      case 'companyresearch_get_by_domain':
        return {
          type: 'object',
          properties: {
            domain: {
              type: 'string',
              description: 'The company domain (e.g., "example.com")'
            }
          },
          required: ['domain']
        };

      case 'companyresearch_search':
        return {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query to match company name or domain'
            }
          },
          required: ['query']
        };

      case 'korean_law_search':
        return {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: `검색어. 검색 대상(target)에 따라 전략이 다름:
- law/admrul/ordin: 법령명 또는 키워드 (예: "근로기준법", "손해배상", "환경부")
- prec(판례): 사건명(evtNm)으로만 매칭 — 판결 본문 전문 검색이 아님.
  판결 내용의 사실 키워드("인수인계", "퇴사")는 사건명에 없으므로 0건이 나옴.
  반드시 법적 청구 유형으로 검색: "손해배상(기)", "채무불이행", "부당해고", "불법행위" 등.
  0건이면 더 단순한 법률 개념어로 재시도할 것. 단 한 번 시도로 "판례 없음" 결론 금지.`
            },
            target: {
              type: 'string',
              enum: ['law', 'prec', 'admrul', 'ordin'],
              description: '검색 대상: law=법령(기본), prec=판례, admrul=행정규칙, ordin=자치법규'
            },
            display: {
              type: 'number',
              description: '반환할 결과 수 (기본 20, 최대 100)'
            },
            page: {
              type: 'number',
              description: '페이지 번호 (기본 1)'
            }
          },
          required: ['query']
        };

      case 'korean_law_get_text':
        return {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: '법령의 MST 또는 법령ID (korean_law_search 결과에서 획득)'
            },
            target: {
              type: 'string',
              enum: ['law', 'admrul', 'ordin'],
              description: '대상 유형: law=법령(기본), admrul=행정규칙, ordin=자치법규'
            }
          },
          required: ['id']
        };

      case 'korean_law_get_decision':
        return {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: '판례의 판례정보일련번호 또는 ID (korean_law_search 결과에서 획득)'
            }
          },
          required: ['id']
        };

      case 'pageindex_index_document':
        return {
          type: 'object',
          properties: {
            file_path: { type: 'string', description: 'Absolute path to the PDF file to index' }
          },
          required: ['file_path']
        };

      case 'pageindex_list_documents':
        return { type: 'object', properties: {}, required: [] };

      case 'pageindex_get_document':
        return {
          type: 'object',
          properties: {
            doc_id: { type: 'string', description: 'Document ID returned by pageindex_index_document or pageindex_list_documents' }
          },
          required: ['doc_id']
        };

      case 'pageindex_get_structure':
        return {
          type: 'object',
          properties: {
            doc_id: { type: 'string', description: 'Document ID' }
          },
          required: ['doc_id']
        };

      case 'pageindex_get_pages':
        return {
          type: 'object',
          properties: {
            doc_id: { type: 'string', description: 'Document ID' },
            pages: { type: 'string', description: 'Pages to retrieve: "5", "3,8", "5-7", "1,3,5-7"' }
          },
          required: ['doc_id', 'pages']
        };

      default:
        return {
          type: 'object',
          properties: {},
          required: []
        };
    }
  }

  /**
   * Execute a tool call
   */
  async executeToolCall(request: ToolCallRequestInfo, signal?: AbortSignal): Promise<ToolCallResponseInfo> {
    const startTime = Date.now();
    const tool = this.tools.get(request.name);

    if (!tool) {
      return {
        id: request.id,
        success: false,
        error: `Tool '${request.name}' not found`,
        executionTime: Date.now() - startTime,
        timestamp: new Date()
      };
    }

    try {
      // Convert snake_case parameters to camelCase for backward compatibility with internal tools
      const mappedParams = this.mapParameterNames(request.parameters);

      // Auto-approve: bypass user confirmation and proceed to execute
      // Previously, this block would require user confirmation and return early.
      // Now, we intentionally skip creating pending confirmations and continue.
      if (tool.requiresConfirmation && tool.shouldConfirm) {
        try {
          await tool.shouldConfirm(mappedParams);
        } catch {}
      }

      // Execute the tool with mapped parameters
      const result = await tool.execute(mappedParams, signal, request.conversationId);
      
      return {
        id: request.id,
        success: true,
        result,
        executionTime: Date.now() - startTime,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        id: request.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
        timestamp: new Date()
      };
    }
  }

  /**
   * Confirm a pending tool execution
   */
  async confirmToolExecution(requestId: string, approved: boolean): Promise<ToolCallResponseInfo | null> {
    const request = this.pendingConfirmations.get(requestId);
    if (!request) return null;

    this.pendingConfirmations.delete(requestId);

    if (!approved) {
      return {
        id: request.id,
        success: false,
        error: 'Tool execution cancelled by user',
        executionTime: 0,
        timestamp: new Date()
      };
    }

    // Execute the approved tool
    return this.executeToolCall(request);
  }

  /**
   * Map parameter names from snake_case (Gemini) to camelCase (internal tools)
   */
  private mapParameterNames(params: Record<string, any>): Record<string, any> {
    const mappedParams: Record<string, any> = {};
    
    // Specific parameter mappings for known tools
    const parameterMappings: Record<string, string> = {
      'file_path': 'filePath',
      'dir_path': 'dirPath',
      'project_path': 'projectPath',
      'folder_path': 'folderPath',
      'old_string': 'oldString',
      'new_string': 'newString',
      'expected_replacements': 'expectedReplacements',
      'flexible_matching': 'flexibleMatching',
      'table_name': 'tableName',
      'search_query': 'searchQuery',
      'order_by': 'orderBy',
      'order_direction': 'orderDirection',
      'group_by': 'groupBy'
    };
    
    for (const [key, value] of Object.entries(params)) {
      // Use specific mapping if available
      if (parameterMappings[key]) {
        mappedParams[parameterMappings[key]] = value;
      } else {
        // Convert snake_case to camelCase as fallback
        const camelCaseKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        mappedParams[camelCaseKey] = value;
      }
      
      // Also keep original key for backward compatibility
      mappedParams[key] = value;
    }
    
    return mappedParams;
  }

  /**
   * Register built-in tools
   */
  private registerBuiltinTools(): void {
    // File System Tools
    this.registerTool(new ReadFileTool());
    this.registerTool(new WriteFileTool());
    this.registerTool(new ListDirectoryTool());
    this.registerTool(new MoveFileTool());
    this.registerTool(new PartialEditTool());
    
    // Shell Tools
    this.registerTool(new ShellCommandTool());
    
    // Project Tools
    this.registerTool(new AnalyzeProjectTool());
    this.registerTool(new InitProjectTool());
    
    // AppsScript Tools
    this.registerTool(new AppsScriptListFilesTool());
    this.registerTool(new AppsScriptReadFileTool());
    this.registerTool(new AppsScriptWriteFileTool());
    this.registerTool(new AppsScriptPartialEditTool());
    this.registerTool(new AppsScriptRenameFileTool());
    this.registerTool(new AppsScriptDeleteFileTool());
    
    // AppsScript Documentation Tools
    this.registerTool(new AppsScriptDocsTool());
    this.registerTool(new AppsScriptDocsListTool());
    
    // AppsScript Push/Pull Tools (DEV/PROD workflow)
    this.registerTool(new AppsScriptPushToDevTool());
    this.registerTool(new AppsScriptPullFromDevTool());
    this.registerTool(new AppsScriptPushDevToProdTool());
    this.registerTool(new AppsScriptPullProdToDevTool());
    
    // User Data Tools
    this.registerTool(new UserDataListTablesTool());
    this.registerTool(new UserDataQueryTool());
    this.registerTool(new UserDataSearchTool());
    this.registerTool(new UserDataAggregateTool());

    // FinanceHub Tools
    this.registerTool(new FinanceHubListBanksTool());
    this.registerTool(new FinanceHubListAccountsTool());
    this.registerTool(new FinanceHubQueryTransactionsTool());
    this.registerTool(new FinanceHubGetStatisticsTool());
    this.registerTool(new FinanceHubUpsertAccountTool());
    this.registerTool(new FinanceHubImportTransactionsTool());
    this.registerTool(new FinanceHubUpsertBankProductRowsTool());
    this.registerTool(new FinanceHubDeleteAccountTool());
    this.registerTool(new FinanceHubDeleteImportedDataForBankTool());
    this.registerTool(new FinanceHubDeleteTransactionsTool());
    this.registerTool(new FinanceHubDeleteBankProductRowsTool());
    this.registerTool(new FinanceHubImportHometaxDataTool());
    this.registerTool(new FinanceHubDeleteHometaxDataTool());
    this.registerTool(new FinanceHubDeleteImportedHometaxForBusinessTool());

    // Business Identity & Internal Knowledge Tools
    this.registerTool(new InternalKnowledgeListSnapshotsTool());
    this.registerTool(new InternalKnowledgeGetSnapshotTool());
    this.registerTool(new InternalKnowledgeGetCompanyInfoTool());
    this.registerTool(new InternalKnowledgeGetServicesProductsTool());
    this.registerTool(new KnowledgeListDocumentsTool());
    this.registerTool(new KnowledgeGetDocumentTool());
    this.registerTool(new KnowledgeSearchContentTool());
    this.registerTool(new KnowledgeGetByCategoryTool());
    this.registerTool(new KnowledgeCreateDocumentTool());
    this.registerTool(new KnowledgeUpdateDocumentTool());
    this.registerTool(new KnowledgeDeleteDocumentTool());

    // Company Research Tools
    this.registerTool(new CompanyResearchListAllTool());
    this.registerTool(new CompanyResearchGetByIdTool());
    this.registerTool(new CompanyResearchGetByDomainTool());
    this.registerTool(new CompanyResearchSearchTool());

    // Korean Law Tools (법제처 Open API)
    this.registerTool(new KoreanLawSearchTool());
    this.registerTool(new KoreanLawGetTextTool());
    this.registerTool(new KoreanLawGetDecisionTool());

    // PageIndex Tools (vectorless PDF RAG)
    this.registerTool(new PageIndexIndexDocumentTool());
    this.registerTool(new PageIndexListDocumentsTool());
    this.registerTool(new PageIndexGetDocumentTool());
    this.registerTool(new PageIndexGetStructureTool());
    this.registerTool(new PageIndexGetPagesTool());
  }
}


// Export singleton instance
export const toolRegistry = new ToolRegistry();

/**
 * Get filesystem tools for local file operations
 */
export function getFilesystemTools(): ToolExecutor[] {
  return [
    new ReadFileTool(),
    new WriteFileTool(),
    new ListDirectoryTool(),
    new MoveFileTool(),
    new PartialEditTool(),
    new ShellCommandTool(),
    new AnalyzeProjectTool(),
    new InitProjectTool(),
  ];
}

/**
 * Get Apps Script tools for database operations
 */
export function getAppsScriptTools(): ToolExecutor[] {
  return [
    new AppsScriptListFilesTool(),
    new AppsScriptReadFileTool(),
    new AppsScriptWriteFileTool(),
    new AppsScriptPartialEditTool(),
    new AppsScriptRenameFileTool(),
    new AppsScriptDeleteFileTool(),
    new AppsScriptDocsTool(),
    new AppsScriptDocsListTool(),
    new AppsScriptPushToDevTool(),
    new AppsScriptPullFromDevTool(),
    new AppsScriptPushDevToProdTool(),
    new AppsScriptPullProdToDevTool(),
  ];
}

/**
 * Get User Data tools for querying imported tables
 */
export function getUserDataTools(): ToolExecutor[] {
  return [
    new UserDataListTablesTool(),
    new UserDataQueryTool(),
    new UserDataSearchTool(),
    new UserDataAggregateTool(),
  ];
}

/**
 * Get Korean Law tools for legal assistant context
 */
export function getKoreanLawTools(): ToolExecutor[] {
  return [
    new KoreanLawSearchTool(),
    new KoreanLawGetTextTool(),
    new KoreanLawGetDecisionTool(),
  ];
}

/**
 * Get PageIndex tools for document RAG context
 */
export function getPageIndexTools(): ToolExecutor[] {
  return [
    new PageIndexListDocumentsTool(),
    new PageIndexGetDocumentTool(),
    new PageIndexGetStructureTool(),
    new PageIndexGetPagesTool(),
  ];
}

/**
 * Get tool names for a specific context
 */
export function getToolNamesForContext(context: 'filesystem' | 'apps-script' | 'user-data' | 'korean-law' | 'pageindex' | 'all'): string[] {
  switch (context) {
    case 'filesystem':
      return getFilesystemTools().map(t => t.name);
    case 'apps-script':
      return getAppsScriptTools().map(t => t.name);
    case 'user-data':
      return getUserDataTools().map(t => t.name);
    case 'korean-law':
      return getKoreanLawTools().map(t => t.name);
    case 'pageindex':
      return getPageIndexTools().map(t => t.name);
    case 'all':
    default:
      return Array.from(toolRegistry['tools'].keys());
  }
}

/**
 * Register IPC handlers for AppsScript tools
 */
export function registerAppsScriptToolHandlers(): void {
  const { ipcMain } = require('electron');
  
  // Import tools
  const { AppsScriptListFilesTool } = require('./tools/apps-script-list-files');
  const { AppsScriptReadFileTool } = require('./tools/apps-script-read-file');
  const { AppsScriptWriteFileTool } = require('./tools/apps-script-write-file');
  const { AppsScriptPartialEditTool } = require('./tools/apps-script-partial-edit');
  const { AppsScriptRenameFileTool } = require('./tools/apps-script-rename-file');
  const { AppsScriptDeleteFileTool } = require('./tools/apps-script-delete-file');
  
  const listFilesTool = new AppsScriptListFilesTool();
  const readFileTool = new AppsScriptReadFileTool();
  const writeFileTool = new AppsScriptWriteFileTool();
  const partialEditTool = new AppsScriptPartialEditTool();
  const renameFileTool = new AppsScriptRenameFileTool();
  const deleteFileTool = new AppsScriptDeleteFileTool();
  
  // List AppsScript files
  ipcMain.handle('apps-script-list-files', async (event, scriptId: string) => {
    try {
      const result = await listFilesTool.execute({ scriptId });
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Read AppsScript file
  ipcMain.handle('apps-script-read-file', async (event, scriptId: string, fileName: string) => {
    try {
      const result = await readFileTool.execute({ scriptId, fileName });
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Write AppsScript file
  ipcMain.handle('apps-script-write-file', async (event, scriptId: string, fileName: string, content: string, fileType?: string, conversationId?: string) => {
    try {
      const result = await writeFileTool.execute({ scriptId, fileName, content, fileType }, undefined, conversationId);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Partial edit AppsScript file
  ipcMain.handle('apps-script-partial-edit', async (event, scriptId: string, fileName: string, oldString: string, newString: string, expectedReplacements?: number, flexibleMatching?: boolean, conversationId?: string) => {
    try {
      const result = await partialEditTool.execute({ scriptId, fileName, oldString, newString, expectedReplacements, flexibleMatching }, undefined, conversationId);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Rename AppsScript file
  ipcMain.handle('apps-script-rename-file', async (event, scriptId: string, oldFileName: string, newFileName: string, conversationId?: string) => {
    try {
      const result = await renameFileTool.execute({ scriptId, oldFileName, newFileName }, undefined, conversationId);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Delete AppsScript file
  ipcMain.handle('apps-script-delete-file', async (event, scriptId: string, fileName: string, conversationId?: string) => {
    try {
      const result = await deleteFileTool.execute({ scriptId, fileName }, undefined, conversationId);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Push to Google Apps Script
  ipcMain.handle('apps-script-push-to-google', async (event, projectId: string, createVersion?: boolean, versionDescription?: string) => {
    try {
      const { AppsScriptService } = require('../mcp/apps-script/apps-script-service');
      const service = AppsScriptService.getInstance();
      const result = await service.pushToGoogle(projectId, createVersion, versionDescription);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Pull from Google Apps Script
  ipcMain.handle('apps-script-pull-from-google', async (event, projectId: string) => {
    try {
      const { AppsScriptService } = require('../mcp/apps-script/apps-script-service');
      const service = AppsScriptService.getInstance();
      const result = await service.pullFromGoogle(projectId);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // List versions of a script
  ipcMain.handle('apps-script-list-versions', async (event, projectId: string) => {
    try {
      const { AppsScriptService } = require('../mcp/apps-script/apps-script-service');
      const service = AppsScriptService.getInstance();
      const result = await service.listVersions(projectId);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Get content at a specific version
  ipcMain.handle('apps-script-get-version-content', async (event, projectId: string, versionNumber: number) => {
    try {
      const { AppsScriptService } = require('../mcp/apps-script/apps-script-service');
      const service = AppsScriptService.getInstance();
      const result = await service.getVersionContent(projectId, versionNumber);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Run a function in the Apps Script project
  ipcMain.handle('apps-script-run-function', async (event, scriptId: string, functionName: string, parameters?: any[]) => {
    try {
      const { AppsScriptService } = require('../mcp/apps-script/apps-script-service');
      const service = AppsScriptService.getInstance();
      const result = await service.runFunction(scriptId, functionName, parameters);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // List triggers for a script
  ipcMain.handle('apps-script-list-triggers', async (event, projectId: string) => {
    try {
      const { AppsScriptService } = require('../mcp/apps-script/apps-script-service');
      const service = AppsScriptService.getInstance();
      const result = await service.listTriggers(projectId);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Clone script to create dev environment
  ipcMain.handle('apps-script-clone-for-dev', async (event, projectId: string) => {
    try {
      const { AppsScriptService } = require('../mcp/apps-script/apps-script-service');
      const service = AppsScriptService.getInstance();
      const result = await service.cloneScriptForDev(projectId);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Push to Dev Apps Script (Local → Dev)
  ipcMain.handle('apps-script-push-to-dev', async (event, projectId: string, createVersion?: boolean, versionDescription?: string) => {
    try {
      const { AppsScriptService } = require('../mcp/apps-script/apps-script-service');
      const service = AppsScriptService.getInstance();
      const result = await service.pushToDev(projectId, createVersion, versionDescription);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Pull from Dev Apps Script (Dev → Local)
  ipcMain.handle('apps-script-pull-from-dev', async (event, projectId: string) => {
    try {
      const { AppsScriptService } = require('../mcp/apps-script/apps-script-service');
      const service = AppsScriptService.getInstance();
      const result = await service.pullFromDev(projectId);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Push Dev to Production (Dev → Prod) - DANGEROUS
  ipcMain.handle('apps-script-push-dev-to-prod', async (event, projectId: string, createVersion?: boolean, versionDescription?: string) => {
    try {
      const { AppsScriptService } = require('../mcp/apps-script/apps-script-service');
      const service = AppsScriptService.getInstance();
      const result = await service.pushDevToProd(projectId, createVersion, versionDescription);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Pull Production to Dev (Prod → Dev)
  ipcMain.handle('apps-script-pull-prod-to-dev', async (event, projectId: string) => {
    try {
      const { AppsScriptService } = require('../mcp/apps-script/apps-script-service');
      const service = AppsScriptService.getInstance();
      const result = await service.pullProdToDev(projectId);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Apps Script Documentation lookup
  ipcMain.handle('apps-script-docs', async (event, service: string, className: string, methodFilter?: string) => {
    try {
      const { AppsScriptDocsTool } = require('./tools/apps-script-docs');
      const docsTool = new AppsScriptDocsTool();
      const result = await docsTool.execute({ service, className, methodFilter });
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Apps Script Documentation list
  ipcMain.handle('apps-script-docs-list', async (event, service?: string) => {
    try {
      const { AppsScriptDocsListTool } = require('./tools/apps-script-docs');
      const docsListTool = new AppsScriptDocsListTool();
      const result = await docsListTool.execute({ service });
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  console.log('✅ AppsScript tool IPC handlers registered');
}
