/**
 * FinanceHub MCP Service
 * Implements the IMCPService interface for FinanceHub database operations
 *
 * Provides read-only access to Korean bank accounts and transaction data
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
        description: 'List all registered banks/cards with metadata (name, color, icon, etc.)',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'financehub_list_accounts',
        description: 'List bank accounts with balances, optionally filtered by bank or active status',
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
        description: 'Get sync operation history with status and timing information',
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
            accounts: accounts.map((acc) => ({
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
              updatedAt: acc.updatedAt
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
              cardNumber: tx.cardNumber,
              cardholderName: tx.cardholderName,
              merchantName: tx.merchantName,
              approvalDate: tx.approvalDate,
              approvalDatetime: tx.approvalDatetime,
              approvalNumber: tx.approvalNumber,
              amount: tx.amount,
              isCancelled: tx.isCancelled,
              usageType: tx.usageType,
              salesType: tx.salesType,
              category: tx.category,
              memo: tx.memo,
              createdAt: tx.createdAt
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

          const syncOps = this.manager.getRecentSyncOperations(limit);

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
