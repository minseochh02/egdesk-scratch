/**
 * FinanceHub List Accounts Tool
 * Lists bank accounts with balances
 */

import type { ToolExecutor } from '../../types/ai-types';

export class FinanceHubListAccountsTool implements ToolExecutor {
  name = 'financehub_list_accounts';
  description = 'List Korean bank accounts with current balances. Optionally filter by bank ID or active status. Returns account details including balance, account number, customer name, and last sync time.';
  dangerous = false;

  async execute(params: {
    bankId?: string;
    isActive?: boolean;
  }): Promise<string> {
    try {
      const response = await fetch('http://localhost:8080/financehub/tools/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'financehub_list_accounts',
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

      console.log(`🏦 Listed ${JSON.parse(data.result.content[0].text).totalAccounts} accounts`);
      return data.result.content[0].text;
    } catch (error) {
      const errorMsg = `Failed to list accounts: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }
}
