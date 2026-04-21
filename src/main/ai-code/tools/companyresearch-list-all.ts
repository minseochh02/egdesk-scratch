/**
 * Company Research List All Tool
 * Lists all company research records for client companies
 */

import type { ToolExecutor } from '../../types/ai-types';

export class CompanyResearchListAllTool implements ToolExecutor {
  name = 'companyresearch_list_all';
  description = 'List all company research records for client companies. Optionally filter by status (pending/in_progress/completed). Returns research metadata and summary.';
  dangerous = false;

  async execute(args: { status?: string } = {}): Promise<string> {
    try {
      const response = await fetch('http://localhost:8080/internalknowledge/tools/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'companyresearch_list_all',
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

      const result = JSON.parse(data.result.content[0].text);
      console.log(`🔬 Listed ${result.totalResearch} company research records`);
      return data.result.content[0].text;
    } catch (error) {
      const errorMsg = `Failed to list company research: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }
}
