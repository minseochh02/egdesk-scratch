import type { ToolExecutor } from '../../types/ai-types';

export class FinanceHubDeleteImportedDataForBankTool implements ToolExecutor {
  name = 'financehub_delete_imported_data_for_bank';
  description =
    'Delete all accounts, transactions, and sync operations for a bankId. Does not remove credentials.';
  dangerous = true;

  async execute(params: { bankId: string }): Promise<string> {
    const response = await fetch('http://localhost:8080/financehub/tools/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: 'financehub_delete_imported_data_for_bank', arguments: params })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Unknown error');
    return data.result.content[0].text;
  }
}
