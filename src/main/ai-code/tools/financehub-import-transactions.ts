/**
 * FinanceHub Import Transactions Tool
 */

import type { ToolExecutor } from '../../types/ai-types';

export class FinanceHubImportTransactionsTool implements ToolExecutor {
  name = 'financehub_import_transactions';
  description =
    'Push bank or card transactions into the FinanceHub database (deduplicated). Upserts the account and records a sync operation. Max 1000 rows per call.';
  dangerous = true;

  async execute(params: {
    bankId: string;
    accountData: {
      accountNumber: string;
      accountName?: string;
      customerName?: string;
      balance?: number;
      availableBalance?: number;
      openDate?: string;
    };
    transactions: Array<Record<string, unknown>>;
    syncMetadata: {
      queryPeriodStart: string;
      queryPeriodEnd: string;
      filePath?: string;
    };
    isCard?: boolean;
  }): Promise<string> {
    const response = await fetch('http://localhost:8080/financehub/tools/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'financehub_import_transactions',
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
