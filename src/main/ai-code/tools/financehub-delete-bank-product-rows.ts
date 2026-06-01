import type { ToolExecutor } from '../../types/ai-types';

export class FinanceHubDeleteBankProductRowsTool implements ToolExecutor {
  name = 'financehub_delete_bank_product_rows';
  description =
    'Delete rows from a FinanceHub bank-product table by ids and/or filters (same filters as query). Requires at least one id or filter. Max 1000 rows.';
  dangerous = true;

  async execute(params: {
    tableSlug: string;
    ids?: string[];
    filters?: Array<{
      column: string;
      op: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'like' | 'in';
      value: string | number | Array<string | number>;
    }>;
  }): Promise<string> {
    const response = await fetch('http://localhost:8080/financehub/tools/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: 'financehub_delete_bank_product_rows', arguments: params })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Unknown error');
    return data.result.content[0].text;
  }
}
