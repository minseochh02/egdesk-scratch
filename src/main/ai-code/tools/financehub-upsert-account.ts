/**
 * FinanceHub Upsert Account Tool
 */

import type { ToolExecutor } from '../../types/ai-types';

export class FinanceHubUpsertAccountTool implements ToolExecutor {
  name = 'financehub_upsert_account';
  description =
    'Create or update a FinanceHub bank/card account (no credentials). Use before importing transactions when the account may not exist yet.';
  dangerous = true;

  async execute(params: {
    bankId: string;
    accountNumber: string;
    accountName?: string;
    customerName?: string;
    balance?: number;
    availableBalance?: number;
    currency?: string;
    accountType?: string;
    openDate?: string;
    metadata?: Record<string, unknown>;
  }): Promise<string> {
    const response = await fetch('http://localhost:8080/financehub/tools/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'financehub_upsert_account',
        arguments: params
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Unknown error');
    }

    return data.result.content[0].text;
  }
}
