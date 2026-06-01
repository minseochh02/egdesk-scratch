/**
 * FinanceHub Upsert Bank Product Rows Tool
 */

import type { ToolExecutor } from '../../types/ai-types';

export class FinanceHubUpsertBankProductRowsTool implements ToolExecutor {
  name = 'financehub_upsert_bank_product_rows';
  description =
    'Insert or replace rows in a FinanceHub bank-product table (loans, receivables, endorsements, etc.). Call financehub_list_bank_product_tables first for tableSlug and column names. Max 500 rows per call.';
  dangerous = true;

  async execute(params: {
    tableSlug: string;
    rows: Array<Record<string, unknown>>;
  }): Promise<string> {
    const response = await fetch('http://localhost:8080/financehub/tools/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'financehub_upsert_bank_product_rows',
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
