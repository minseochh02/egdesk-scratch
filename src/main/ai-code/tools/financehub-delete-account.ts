import type { ToolExecutor } from '../../types/ai-types';

export class FinanceHubDeleteAccountTool implements ToolExecutor {
  name = 'financehub_delete_account';
  description =
    'Delete a FinanceHub account and all its transactions/sync rows. Does not remove saved credentials.';
  dangerous = true;

  async execute(params: { bankId: string; accountNumber: string }): Promise<string> {
    const response = await fetch('http://localhost:8080/financehub/tools/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: 'financehub_delete_account', arguments: params })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Unknown error');
    return data.result.content[0].text;
  }
}
