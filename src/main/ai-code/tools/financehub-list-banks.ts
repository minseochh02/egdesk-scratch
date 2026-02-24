/**
 * FinanceHub List Banks Tool
 * Lists all registered Korean banks/cards
 */

import type { ToolExecutor } from '../../types/ai-types';

export class FinanceHubListBanksTool implements ToolExecutor {
  name = 'financehub_list_banks';
  description = 'List all registered Korean banks and cards with metadata (name, color, icon, automation support). Use this to discover available bank IDs for querying accounts and transactions.';
  dangerous = false;

  async execute(): Promise<string> {
    try {
      const response = await fetch('http://localhost:8080/financehub/tools/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'financehub_list_banks',
          arguments: {}
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Unknown error');
      }

      console.log(`💳 Listed ${JSON.parse(data.result.content[0].text).totalBanks} banks`);
      return data.result.content[0].text;
    } catch (error) {
      const errorMsg = `Failed to list banks: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }
}
