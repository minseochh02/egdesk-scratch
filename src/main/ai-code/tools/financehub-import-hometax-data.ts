/**
 * FinanceHub Import Hometax Data Tool
 */

import type { ToolExecutor } from '../../types/ai-types';

export class FinanceHubImportHometaxDataTool implements ToolExecutor {
  name = 'financehub_import_hometax_data';
  description =
    'Import Hometax tax invoices, tax-exempt invoices, or cash receipts (deduplicated). Max 1000 rows per call.';
  dangerous = true;

  async execute(params: {
    dataType: 'tax-invoice' | 'tax-exempt-invoice' | 'cash-receipt';
    businessNumber: string;
    invoiceType?: 'sales' | 'purchase';
    rows: Array<Record<string, unknown>>;
    excelFilePath?: string;
  }): Promise<string> {
    const response = await fetch('http://localhost:8080/financehub/tools/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'financehub_import_hometax_data',
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
