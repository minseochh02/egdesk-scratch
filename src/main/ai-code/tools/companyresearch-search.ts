/**
 * Company Research Search Tool
 * Searches company research by company name or domain
 */

import type { ToolExecutor } from '../../types/ai-types';

export class CompanyResearchSearchTool implements ToolExecutor {
  name = 'companyresearch_search';
  description = 'Search company research by company name or domain. Performs partial text matching. Returns matching research records.';
  dangerous = false;

  async execute(args: { query: string }): Promise<string> {
    try {
      const response = await fetch('http://localhost:8080/internalknowledge/tools/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'companyresearch_search',
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
      console.log(`🔎 Found ${result.totalMatches} matching company research records for: "${args.query}"`);
      return data.result.content[0].text;
    } catch (error) {
      const errorMsg = `Failed to search company research: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }
}
