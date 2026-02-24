/**
 * FinanceHub Query Transactions Tool
 * Query Korean bank transactions with filtering and pagination
 */

import type { ToolExecutor } from '../../types/ai-types';

export class FinanceHubQueryTransactionsTool implements ToolExecutor {
  name = 'financehub_query_transactions';
  description = 'Query Korean bank transactions with powerful filtering options. Supports date ranges, amount filters, text search, and pagination. Use this to analyze spending patterns, find specific transactions, or generate financial reports.';
  dangerous = false;

  async execute(params: {
    accountId?: string;
    bankId?: string;
    startDate?: string; // YYYY-MM-DD format
    endDate?: string; // YYYY-MM-DD format
    category?: string;
    minAmount?: number;
    maxAmount?: number;
    searchText?: string;
    limit?: number; // max 1000
    offset?: number;
    orderBy?: 'date' | 'amount' | 'balance';
    orderDir?: 'asc' | 'desc';
  }): Promise<string> {
    try {
      // Enforce max limit
      const args = {
        ...params,
        limit: Math.min(params.limit || 100, 1000)
      };

      const response = await fetch('http://localhost:8080/financehub/tools/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'financehub_query_transactions',
          arguments: args
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Unknown error');
      }

      console.log(`💰 Queried ${JSON.parse(data.result.content[0].text).totalReturned} transactions`);
      return data.result.content[0].text;
    } catch (error) {
      const errorMsg = `Failed to query transactions: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }
}
