/**
 * Internal Knowledge Get Company Info Tool
 * Extracts DetailedCompanyData from a business identity snapshot
 */

import type { ToolExecutor } from '../../types/ai-types';

export class InternalKnowledgeGetCompanyInfoTool implements ToolExecutor {
  name = 'businessidentity_get_company_info';
  description = 'Extract detailed company information from a business identity snapshot. Returns structured company data including contacts, products, hierarchy, partners, and financial info.';
  dangerous = false;

  async execute(args: { snapshotId: string }): Promise<string> {
    try {
      const response = await fetch('http://localhost:8080/internalknowledge/tools/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'businessidentity_get_company_info',
          arguments: args
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Unknown error');
      }

      console.log(`🏢 Retrieved company info for snapshot: ${args.snapshotId}`);
      return data.result.content[0].text;
    } catch (error) {
      const errorMsg = `Failed to get company info: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }
}
