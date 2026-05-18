/**
 * FinanceHub MCP Service
 * Implements the IMCPService interface for FinanceHub database operations
 *
 * Provides read-only access to Korean bank accounts, transactions, and Hometax tables
 * All credential operations are explicitly excluded for security
 */

import Database from 'better-sqlite3';
import { IMCPService, MCPTool, MCPServerInfo, MCPCapabilities, MCPToolResult } from '../types/mcp-service';
import { FinanceHubDbManager } from '../../sqlite/financehub';

/**
 * FinanceHub MCP Service
 * Provides MCP tools for querying Korean bank accounts and transactions
 *
 * Security: Read-only access only, no credential operations exposed
 */
export class FinanceHubMCPService implements IMCPService {
  private manager: FinanceHubDbManager;

  constructor(database: Database.Database) {
    this.manager = new FinanceHubDbManager(database);
  }

  getServerInfo(): MCPServerInfo {
    return {
      name: 'financehub-mcp-server',
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
        name: 'financehub_list_banks',
        description: 'List all registered banks/cards with metadata. Returns: { totalBanks: number, banks: [{ id: string, name: string, nameKo: string, color: string, icon: string, supportsAutomation: boolean }] }',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'financehub_list_accounts',
        description: 'List bank accounts with balances, optionally filtered by bank or active status. Returns: { totalAccounts: number, accounts: [{ id: string, bankId: string, accountNumber: string, accountName: string, customerName: string, balance: number, availableBalance: number, currency: string, accountType: string, openDate: string|null, isActive: boolean, lastSyncedAt: string|null, createdAt: string, updatedAt: string }] }',
        inputSchema: {
          type: 'object',
          properties: {
            bankId: {
              type: 'string',
              description: 'Filter by specific bank ID (e.g., "shinhan", "kookmin")'
            },
            isActive: {
              type: 'boolean',
              description: 'Filter by active status (true = active accounts only)'
            }
          },
          required: []
        }
      },
      {
        name: 'financehub_query_transactions',
        description: 'Query bank transactions with filtering, sorting, and pagination. For card transactions, use financehub_query_card_transactions instead.',
        inputSchema: {
          type: 'object',
          properties: {
            accountId: {
              type: 'string',
              description: 'Filter by account ID'
            },
            bankId: {
              type: 'string',
              description: 'Filter by bank ID'
            },
            startDate: {
              type: 'string',
              description: 'Start date filter (YYYY-MM-DD format)'
            },
            endDate: {
              type: 'string',
              description: 'End date filter (YYYY-MM-DD format)'
            },
            category: {
              type: 'string',
              description: 'Filter by transaction category'
            },
            minAmount: {
              type: 'number',
              description: 'Minimum transaction amount (deposit or withdrawal)'
            },
            maxAmount: {
              type: 'number',
              description: 'Maximum transaction amount (deposit or withdrawal)'
            },
            searchText: {
              type: 'string',
              description: 'Search in description, memo, or counterparty fields'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of transactions to return (max 1000)',
              default: 100
            },
            offset: {
              type: 'number',
              description: 'Number of transactions to skip for pagination',
              default: 0
            },
            orderBy: {
              type: 'string',
              enum: ['date', 'amount', 'balance'],
              description: 'Column to sort by',
              default: 'date'
            },
            orderDir: {
              type: 'string',
              enum: ['asc', 'desc'],
              description: 'Sort direction',
              default: 'desc'
            }
          },
          required: []
        }
      },
      {
        name: 'financehub_query_card_transactions',
        description: 'Query card transactions with card-specific filtering (merchant, card number, approval date, etc.)',
        inputSchema: {
          type: 'object',
          properties: {
            accountId: {
              type: 'string',
              description: 'Filter by account ID'
            },
            cardCompanyId: {
              type: 'string',
              description: 'Filter by card company ID (e.g., "bc-card", "shinhan-card")'
            },
            cardNumber: {
              type: 'string',
              description: 'Filter by card number'
            },
            merchantName: {
              type: 'string',
              description: 'Search in merchant name'
            },
            startDate: {
              type: 'string',
              description: 'Start date filter (YYYY-MM-DD format)'
            },
            endDate: {
              type: 'string',
              description: 'End date filter (YYYY-MM-DD format)'
            },
            category: {
              type: 'string',
              description: 'Filter by transaction category'
            },
            minAmount: {
              type: 'number',
              description: 'Minimum transaction amount'
            },
            maxAmount: {
              type: 'number',
              description: 'Maximum transaction amount'
            },
            includeCancelled: {
              type: 'boolean',
              description: 'Include cancelled transactions (refunds)',
              default: true
            },
            limit: {
              type: 'number',
              description: 'Maximum number of transactions to return (max 1000)',
              default: 100
            },
            offset: {
              type: 'number',
              description: 'Number of transactions to skip for pagination',
              default: 0
            },
            orderBy: {
              type: 'string',
              enum: ['date', 'amount'],
              description: 'Column to sort by',
              default: 'date'
            },
            orderDir: {
              type: 'string',
              enum: ['asc', 'desc'],
              description: 'Sort direction',
              default: 'desc'
            }
          },
          required: []
        }
      },
      {
        name: 'financehub_get_statistics',
        description: 'Get transaction statistics (totals, counts, net change) with optional filters',
        inputSchema: {
          type: 'object',
          properties: {
            accountId: {
              type: 'string',
              description: 'Filter by account ID'
            },
            bankId: {
              type: 'string',
              description: 'Filter by bank ID'
            },
            startDate: {
              type: 'string',
              description: 'Start date filter (YYYY-MM-DD format)'
            },
            endDate: {
              type: 'string',
              description: 'End date filter (YYYY-MM-DD format)'
            }
          },
          required: []
        }
      },
      {
        name: 'financehub_get_monthly_summary',
        description: 'Get monthly breakdown of deposits/withdrawals per bank',
        inputSchema: {
          type: 'object',
          properties: {
            accountId: {
              type: 'string',
              description: 'Filter by account ID'
            },
            bankId: {
              type: 'string',
              description: 'Filter by bank ID'
            },
            year: {
              type: 'number',
              description: 'Filter by specific year (e.g., 2024)'
            },
            months: {
              type: 'number',
              description: 'Number of months to return (most recent first)',
              default: 12
            }
          },
          required: []
        }
      },
      {
        name: 'financehub_get_overall_stats',
        description: 'Get high-level overview of all banks, accounts, transactions, and balances',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'financehub_get_sync_history',
        description:
          'Get bank/card sync operation history (sync_operations table). For Hometax Excel syncs use financehub_get_hometax_sync_history.',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of sync operations to return',
              default: 50
            }
          },
          required: []
        }
      },
      {
        name: 'financehub_list_hometax_connections',
        description:
          'List Hometax business connections. Returns: { totalConnections: number, connections: [{ id, business_number, business_name, representative_name, business_type, connection_status, last_connected_at, sales_count, purchase_count, cash_receipt_count, sales_spreadsheet_url, purchase_spreadsheet_url, cash_receipt_spreadsheet_url, tax_exempt_sales_spreadsheet_url, tax_exempt_purchase_spreadsheet_url, created_at, updated_at }] }',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'financehub_query_tax_invoices',
        description:
          'Query tax invoices (세금계산서) synced from Hometax. Returns: { totalMatching: number, limit: number, offset: number, invoices: [{ id, business_number, invoice_type("sales"|"purchase"), 작성일자, 승인번호, 발급일자, 전송일자, 공급자사업자등록번호, 공급자종사업장번호, 공급자상호, 공급자대표자명, 공급자주소, 공급받는자사업자등록번호, 공급받는자종사업장번호, 공급받는자상호, 공급받는자대표자명, 공급받는자주소, 합계금액, 공급가액, 세액, 전자세금계산서분류, 전자세금계산서종류, 발급유형, 비고, 영수청구구분, 공급자이메일, 공급받는자이메일1, 공급받는자이메일2, 품목일자, 품목명, 품목규격, 품목수량, 품목단가, 품목공급가액, 품목세액, 품목비고, excel_file_path, created_at }] }',
        inputSchema: {
          type: 'object',
          properties: {
            businessNumber: {
              type: 'string',
              description: 'Filter by business registration number'
            },
            invoiceType: {
              type: 'string',
              enum: ['sales', 'purchase'],
              description: 'Sales or purchase invoices'
            },
            startDate: {
              type: 'string',
              description: 'Start date filter on 작성일자 (YYYY-MM-DD)'
            },
            endDate: {
              type: 'string',
              description: 'End date filter on 작성일자 (YYYY-MM-DD)'
            },
            limit: {
              type: 'number',
              description: 'Maximum rows to return (max 1000)',
              default: 100
            },
            offset: {
              type: 'number',
              description: 'Pagination offset',
              default: 0
            }
          },
          required: []
        }
      },
      {
        name: 'financehub_query_tax_exempt_invoices',
        description:
          'Query tax-exempt invoices (면세 전자계산서) synced from Hometax. Same column structure as financehub_query_tax_invoices except 세액 and 품목세액 are always 0. Returns: { totalMatching: number, limit: number, offset: number, invoices: [{ id, business_number, invoice_type("sales"|"purchase"), 작성일자, 승인번호, 발급일자, 전송일자, 공급자사업자등록번호, 공급자종사업장번호, 공급자상호, 공급자대표자명, 공급자주소, 공급받는자사업자등록번호, 공급받는자종사업장번호, 공급받는자상호, 공급받는자대표자명, 공급받는자주소, 합계금액, 공급가액, 세액(always 0), 전자세금계산서분류, 전자세금계산서종류, 발급유형, 비고, 영수청구구분, 공급자이메일, 공급받는자이메일1, 공급받는자이메일2, 품목일자, 품목명, 품목규격, 품목수량, 품목단가, 품목공급가액, 품목세액(always 0), 품목비고, excel_file_path, created_at }] }',
        inputSchema: {
          type: 'object',
          properties: {
            businessNumber: {
              type: 'string',
              description: 'Filter by business registration number'
            },
            invoiceType: {
              type: 'string',
              enum: ['sales', 'purchase'],
              description: 'Sales or purchase invoices'
            },
            startDate: {
              type: 'string',
              description: 'Start date filter on 작성일자 (YYYY-MM-DD)'
            },
            endDate: {
              type: 'string',
              description: 'End date filter on 작성일자 (YYYY-MM-DD)'
            },
            limit: {
              type: 'number',
              description: 'Maximum rows to return (max 1000)',
              default: 100
            },
            offset: {
              type: 'number',
              description: 'Pagination offset',
              default: 0
            }
          },
          required: []
        }
      },
      {
        name: 'financehub_query_cash_receipts',
        description: 'Query cash receipts (현금영수증 매출내역) synced from Hometax. Returns: { totalMatching: number, limit: number, offset: number, receipts: [{ id, business_number, 발행구분, 매출일시, 공급가액, 부가세, 봉사료, 총금액, 승인번호, 신분확인뒷4자리, 거래구분, 용도구분, 비고, excel_file_path, created_at }] }',
        inputSchema: {
          type: 'object',
          properties: {
            businessNumber: {
              type: 'string',
              description: 'Filter by business registration number'
            },
            startDate: {
              type: 'string',
              description: 'Start filter on 매출일시 (string compare as stored)'
            },
            endDate: {
              type: 'string',
              description: 'End filter on 매출일시'
            },
            limit: {
              type: 'number',
              description: 'Maximum rows to return (max 1000)',
              default: 100
            },
            offset: {
              type: 'number',
              description: 'Pagination offset',
              default: 0
            }
          },
          required: []
        }
      },
      {
        name: 'financehub_get_hometax_sync_history',
        description:
          'Get Hometax sync history (Excel import runs). Not the same as financehub_get_sync_history (banks/cards). Returns: { totalReturned: number, syncOperations: [{ id, business_number, status, start_date, end_date, sales_count, sales_new, sales_duplicate, purchase_count, purchase_new, purchase_duplicate, sales_excel_path, purchase_excel_path, sales_spreadsheet_url, purchase_spreadsheet_url, error_message, started_at, completed_at, duration }] }',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of operations to return (max 1000)',
              default: 50
            }
          },
          required: []
        }
      },
      {
        name: 'financehub_list_bank_product_tables',
        description:
          'List per-(bank, product) tables — bank-side product data downloaded from bank portals that isn\'t core deposit/card transactions (loans, receivables, e-bills, etc.). Examples: 외상매출채권, 대출거래내역, B2B 대출 실행내역. ALWAYS call this first to discover available tables and their columns before calling financehub_query_bank_product_table. Returns: { totalTables: number, tables: [{ slug: string, displayName: string, bankId: string, productLabel: string, columns: [{ name: string, type: string }], rowCount: number, migrated: boolean }] }',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'financehub_query_bank_product_table',
        description:
          'Generic safe query against any per-(bank, product) table from financehub_list_bank_product_tables. Filters use the table\'s exact column names (snake_case). Returns: { tableSlug: string, totalMatching: number, limit: number, offset: number, rows: object[] }',
        inputSchema: {
          type: 'object',
          properties: {
            tableSlug: {
              type: 'string',
              description:
                'Required. Table slug from financehub_list_bank_product_tables (e.g. "ibk_b2b_receivables", "ibk_loan_transactions", "woori_b2b_loan_executions").'
            },
            filters: {
              type: 'array',
              description:
                'Optional WHERE conditions, AND-ed together. Each: { column, op, value }. Column must be in the table\'s schema; op is one of =, !=, >, <, >=, <=, like, in. For "in", value is an array. For "like", use SQL wildcards (%) in value.',
              items: {
                type: 'object',
                properties: {
                  column: { type: 'string', description: 'Column name from the table schema (snake_case)' },
                  op: {
                    type: 'string',
                    enum: ['=', '!=', '>', '<', '>=', '<=', 'like', 'in'],
                    description: 'Comparison operator'
                  },
                  value: {
                    description:
                      'Filter value. For "in": array of strings/numbers. For "like": string with % wildcards. Otherwise: string or number.'
                  }
                },
                required: ['column', 'op', 'value']
              }
            },
            orderBy: {
              type: 'object',
              description:
                'Optional sort. Defaults to the table\'s natural order (e.g. maturity_date ASC for receivables, transaction_date DESC for loan transactions).',
              properties: {
                column: { type: 'string', description: 'Column to sort by (must be in schema)' },
                direction: { type: 'string', enum: ['ASC', 'DESC'], default: 'ASC' }
              },
              required: ['column']
            },
            limit: {
              type: 'number',
              description: 'Maximum rows (1-1000)',
              default: 100
            },
            offset: {
              type: 'number',
              description: 'Pagination offset',
              default: 0
            }
          },
          required: ['tableSlug']
        }
      }
    ];
  }

  async executeTool(name: string, args: Record<string, any>): Promise<MCPToolResult> {
    try {
      let result: any;

      switch (name) {
        case 'financehub_list_banks': {
          const banks = this.manager.getAllBanks();
          result = {
            totalBanks: banks.length,
            banks: banks.map((bank) => ({
              id: bank.id,
              name: bank.name,
              nameKo: bank.nameKo,
              color: bank.color,
              icon: bank.icon,
              supportsAutomation: bank.supportsAutomation
            }))
          };
          break;
        }

        case 'financehub_list_accounts': {
          const { bankId, isActive } = args;

          let accounts;
          if (bankId) {
            accounts = this.manager.getAccountsByBank(bankId);
          } else {
            accounts = this.manager.getAllAccounts();
          }

          // Filter by active status if specified
          if (isActive !== undefined) {
            accounts = accounts.filter(acc => acc.isActive === isActive);
          }

          result = {
            totalAccounts: accounts.length,
            accounts: accounts.map((acc: any) => ({
              id: acc.id,
              bankId: acc.bankId,
              accountNumber: acc.accountNumber,
              accountName: acc.accountName,
              customerName: acc.customerName,
              balance: acc.balance,
              availableBalance: acc.availableBalance,
              currency: acc.currency,
              accountType: acc.accountType,
              openDate: acc.openDate,
              isActive: acc.isActive,
              lastSyncedAt: acc.lastSyncedAt,
              createdAt: acc.createdAt,
              updatedAt: acc.updatedAt,
              metadata: (() => {
                if (!acc.metadata) return null;
                try {
                  return typeof acc.metadata === 'string' ? JSON.parse(acc.metadata) : acc.metadata;
                } catch (e) {
                  return acc.metadata;
                }
              })()
            }))
          };
          break;
        }

        case 'financehub_query_transactions': {
          const {
            accountId,
            bankId,
            startDate,
            endDate,
            category,
            minAmount,
            maxAmount,
            searchText,
            limit = 100,
            offset = 0,
            orderBy = 'date',
            orderDir = 'desc'
          } = args;

          // Enforce max limit of 1000
          const enforcedLimit = Math.min(limit, 1000);

          const transactions = this.manager.queryTransactions({
            accountId,
            bankId,
            startDate,
            endDate,
            category,
            minAmount,
            maxAmount,
            searchText,
            limit: enforcedLimit,
            offset,
            orderBy,
            orderDir
          });

          result = {
            totalReturned: transactions.length,
            limit: enforcedLimit,
            offset,
            transactions: transactions.map((tx) => ({
              id: tx.id,
              accountId: tx.accountId,
              bankId: tx.bankId,
              date: tx.date,
              time: tx.time,
              transaction_datetime: tx.transaction_datetime,
              type: tx.type,
              category: tx.category,
              withdrawal: tx.withdrawal,
              deposit: tx.deposit,
              description: tx.description,
              memo: tx.memo,
              balance: tx.balance,
              branch: tx.branch,
              counterparty: tx.counterparty,
              transactionId: tx.transactionId,
              createdAt: tx.createdAt
            }))
          };
          break;
        }

        case 'financehub_query_card_transactions': {
          const {
            accountId,
            cardCompanyId,
            cardNumber,
            merchantName,
            startDate,
            endDate,
            category,
            minAmount,
            maxAmount,
            includeCancelled = true,
            limit = 100,
            offset = 0,
            orderBy = 'date',
            orderDir = 'desc'
          } = args;

          // Enforce max limit of 1000
          const enforcedLimit = Math.min(limit, 1000);

          const cardTransactions = this.manager.queryCardTransactions({
            accountId,
            cardCompanyId,
            cardNumber,
            merchantName,
            startDate,
            endDate,
            category,
            minAmount,
            maxAmount,
            limit: enforcedLimit,
            offset,
            orderBy,
            orderDir
          });

          // Filter by includeCancelled if specified
          const filteredTransactions = includeCancelled
            ? cardTransactions
            : cardTransactions.filter(tx => !tx.isCancelled);

          result = {
            totalReturned: filteredTransactions.length,
            limit: enforcedLimit,
            offset,
            transactions: filteredTransactions.map((tx) => ({
              id: tx.id,
              accountId: tx.accountId,
              cardCompanyId: tx.cardCompanyId,
              headquartersName: tx.headquartersName,
              departmentName: tx.departmentName,
              cardNumber: tx.cardNumber,
              cardType: tx.cardType,
              cardholderName: tx.cardholderName,
              transactionBank: tx.transactionBank,
              usageType: tx.usageType,
              salesType: tx.salesType,
              approvalDatetime: tx.approvalDatetime,
              approvalDate: tx.approvalDate,
              billingDate: tx.billingDate,
              approvalNumber: tx.approvalNumber,
              merchantName: tx.merchantName,
              amount: tx.amount,
              foreignAmountUsd: tx.foreignAmountUsd,
              memo: tx.memo,
              category: tx.category,
              isCancelled: tx.isCancelled,
              createdAt: tx.createdAt,
              updatedAt: tx.updatedAt
            }))
          };
          break;
        }

        case 'financehub_get_statistics': {
          const { accountId, bankId, startDate, endDate } = args;

          const stats = this.manager.getTransactionStats({
            accountId,
            bankId,
            startDate,
            endDate
          });

          result = {
            totalTransactions: stats.totalTransactions,
            totalDeposits: stats.totalDeposits,
            totalWithdrawals: stats.totalWithdrawals,
            depositCount: stats.depositCount,
            withdrawalCount: stats.withdrawalCount,
            netChange: stats.netChange,
            filters: {
              accountId: accountId || null,
              bankId: bankId || null,
              startDate: startDate || null,
              endDate: endDate || null
            }
          };
          break;
        }

        case 'financehub_get_monthly_summary': {
          const { accountId, bankId, year, months = 12 } = args;

          const summary = this.manager.getMonthlySummary({
            accountId,
            bankId,
            year,
            months
          });

          result = {
            totalMonths: summary.length,
            summary: summary.map((item) => ({
              yearMonth: item.yearMonth,
              bankId: item.bankId,
              depositCount: item.depositCount,
              withdrawalCount: item.withdrawalCount,
              totalDeposits: item.totalDeposits,
              totalWithdrawals: item.totalWithdrawals,
              netChange: item.netChange
            }))
          };
          break;
        }

        case 'financehub_get_overall_stats': {
          const overallStats = this.manager.getOverallStats();

          result = {
            totalBanks: overallStats.totalBanks,
            totalAccounts: overallStats.totalAccounts,
            totalTransactions: overallStats.totalTransactions,
            totalBalance: overallStats.totalBalance,
            bankBreakdown: overallStats.bankBreakdown.map((item) => ({
              bankId: item.bankId,
              bankName: item.bankName,
              accountCount: item.accountCount,
              transactionCount: item.transactionCount,
              totalBalance: item.totalBalance
            }))
          };
          break;
        }

        case 'financehub_get_sync_history': {
          const { limit = 50 } = args;

          const capped = Math.min(Number(limit) || 50, 1000);
          const syncOps = this.manager.getRecentSyncOperations(capped);

          result = {
            totalReturned: syncOps.length,
            syncOperations: syncOps.map((op) => ({
              id: op.id,
              accountId: op.accountId,
              bankId: op.bankId,
              status: op.status,
              syncType: op.syncType,
              startedAt: op.startedAt,
              completedAt: op.completedAt,
              duration: op.duration,
              queryPeriodStart: op.queryPeriodStart,
              queryPeriodEnd: op.queryPeriodEnd,
              transactionsImported: op.transactionsImported,
              transactionsSkipped: op.transactionsSkipped,
              errorMessage: op.errorMessage
            }))
          };
          break;
        }

        case 'financehub_list_hometax_connections': {
          const rows = this.manager.listHometaxConnections();
          result = {
            totalConnections: rows.length,
            connections: rows
          };
          break;
        }

        case 'financehub_query_tax_invoices': {
          const {
            businessNumber,
            invoiceType,
            startDate,
            endDate,
            limit = 100,
            offset = 0
          } = args;

          const enforcedLimit = Math.min(Math.max(Number(limit) || 100, 1), 1000);
          const enforcedOffset = Math.max(Number(offset) || 0, 0);

          const q = this.manager.queryTaxInvoices({
            businessNumber,
            invoiceType,
            startDate,
            endDate,
            limit: enforcedLimit,
            offset: enforcedOffset
          });

          if (q.error) {
            throw new Error(q.error);
          }

          result = {
            totalMatching: q.total,
            limit: enforcedLimit,
            offset: enforcedOffset,
            invoices: q.invoices
          };
          break;
        }

        case 'financehub_query_tax_exempt_invoices': {
          const {
            businessNumber,
            invoiceType,
            startDate,
            endDate,
            limit = 100,
            offset = 0
          } = args;

          const enforcedLimit = Math.min(Math.max(Number(limit) || 100, 1), 1000);
          const enforcedOffset = Math.max(Number(offset) || 0, 0);

          const q = this.manager.queryTaxExemptInvoices({
            businessNumber,
            invoiceType,
            startDate,
            endDate,
            limit: enforcedLimit,
            offset: enforcedOffset
          });

          if (q.error) {
            throw new Error(q.error);
          }

          result = {
            totalMatching: q.total,
            limit: enforcedLimit,
            offset: enforcedOffset,
            invoices: q.invoices
          };
          break;
        }

        case 'financehub_query_cash_receipts': {
          const { businessNumber, startDate, endDate, limit = 100, offset = 0 } = args;

          const enforcedLimit = Math.min(Math.max(Number(limit) || 100, 1), 1000);
          const enforcedOffset = Math.max(Number(offset) || 0, 0);

          const q = this.manager.queryCashReceipts({
            businessNumber,
            startDate,
            endDate,
            limit: enforcedLimit,
            offset: enforcedOffset
          });

          if (q.error) {
            throw new Error(q.error);
          }

          result = {
            totalMatching: q.total,
            limit: enforcedLimit,
            offset: enforcedOffset,
            receipts: q.receipts
          };
          break;
        }

        case 'financehub_get_hometax_sync_history': {
          const { limit = 50 } = args;
          const capped = Math.min(Math.max(Number(limit) || 50, 1), 1000);
          const ops = this.manager.getHometaxSyncOperations(capped);

          result = {
            totalReturned: ops.length,
            syncOperations: ops
          };
          break;
        }

        case 'financehub_list_bank_product_tables': {
          const tables = this.manager.listBankProductTables();
          result = {
            totalTables: tables.length,
            tables
          };
          break;
        }

        case 'financehub_query_bank_product_table': {
          const { tableSlug, filters, orderBy, limit, offset } = args;
          if (!tableSlug || typeof tableSlug !== 'string') {
            throw new Error('tableSlug is required (string). Use financehub_list_bank_product_tables to discover.');
          }
          const q = this.manager.queryBankProductTable({
            tableSlug,
            filters,
            orderBy,
            limit,
            offset
          });
          if (q.error) {
            throw new Error(q.error);
          }
          result = {
            tableSlug: q.tableSlug,
            totalMatching: q.total,
            limit: q.limit,
            offset: q.offset,
            rows: q.rows
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
