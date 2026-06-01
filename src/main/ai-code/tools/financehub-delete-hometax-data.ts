/**
 * FinanceHub Delete Hometax Data Tool
 */

import type { ToolExecutor } from '../../types/ai-types';

export class FinanceHubDeleteHometaxDataTool implements ToolExecutor {
  name = 'financehub_delete_hometax_data';
  description =
    'Delete Hometax rows by businessNumber and ids or date range. Use financehub_delete_imported_hometax_for_business to wipe all imported data for a business.';
  dangerous = true;

  async execute(params: {
    dataType: 'tax-invoice' | 'tax-exempt-invoice' | 'cash-receipt';
    businessNumber: string;
    invoiceType?: 'sales' | 'purchase';
    startDate?: string;
    endDate?: string;
    ids?: number[];
  }): Promise<string> {
    const response = await fetch('http://localhost:8080/financehub/tools/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'financehub_delete_hometax_data',
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

export class FinanceHubDeleteImportedHometaxForBusinessTool implements ToolExecutor {
  name = 'financehub_delete_imported_hometax_for_business';
  description =
    'Delete all imported Hometax rows and sync history for a business number. Does not remove the hometax_connections registry row.';
  dangerous = true;

  async execute(params: { businessNumber: string }): Promise<string> {
    const response = await fetch('http://localhost:8080/financehub/tools/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'financehub_delete_imported_hometax_for_business',
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
