/**
 * Company Research Get By ID Tool
 * Gets a specific company research record by ID
 */

import type { ToolExecutor } from '../../types/ai-types';

export class CompanyResearchGetByIdTool implements ToolExecutor {
  name = 'companyresearch_get_by_id';
  description = 'Get a specific company research record by ID. Returns complete research data including company info, analysis, and markdown report.';
  dangerous = false;

  async execute(args: { researchId: string }): Promise<string> {
    try {
      const response = await fetch('http://localhost:8080/internalknowledge/tools/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'companyresearch_get_by_id',
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

      console.log(`📊 Retrieved company research: ${args.researchId}`);
      return data.result.content[0].text;
    } catch (error) {
      const errorMsg = `Failed to get company research: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }
}
