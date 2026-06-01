import type { ToolExecutor } from '../../types/ai-types';

export class FinanceHubDeleteTransactionsTool implements ToolExecutor {
  name = 'financehub_delete_transactions';
  description =
    'Delete FinanceHub transactions by account + date range and/or transaction ids (max 500 ids). Use financehub_delete_account to remove an entire account.';
  dangerous = true;

  async execute(params: {
    accountId?: string;
    bankId?: string;
    accountNumber?: string;
    startDate?: string;
    endDate?: string;
    transactionIds?: string[];
    isCard?: boolean;
  }): Promise<string> {
    const response = await fetch('http://localhost:8080/financehub/tools/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: 'financehub_delete_transactions', arguments: params })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Unknown error');
    return data.result.content[0].text;
  }
}
