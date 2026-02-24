/**
 * FinanceHub Get Statistics Tool
 * Get transaction statistics and summaries
 */

import type { ToolExecutor } from '../../types/ai-types';

export class FinanceHubGetStatisticsTool implements ToolExecutor {
  name = 'financehub_get_statistics';
  description = 'Get financial statistics including total deposits, withdrawals, transaction counts, and net change. Optionally filter by account, bank, or date range. Perfect for generating financial summaries and reports.';
  dangerous = false;

  async execute(params: {
    accountId?: string;
    bankId?: string;
    startDate?: string; // YYYY-MM-DD format
    endDate?: string; // YYYY-MM-DD format
  }): Promise<string> {
    try {
      const response = await fetch('http://localhost:8080/financehub/tools/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'financehub_get_statistics',
          arguments: params || {}
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Unknown error');
      }

      console.log(`📊 Retrieved statistics`);
      return data.result.content[0].text;
    } catch (error) {
      const errorMsg = `Failed to get statistics: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }
}
