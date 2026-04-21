/**
 * Company Research Get By Domain Tool
 * Gets all company research for a specific domain
 */

import type { ToolExecutor } from '../../types/ai-types';

export class CompanyResearchGetByDomainTool implements ToolExecutor {
  name = 'companyresearch_get_by_domain';
  description = 'Get all company research records for a specific domain. Returns all research reports for the given company domain.';
  dangerous = false;

  async execute(args: { domain: string }): Promise<string> {
    try {
      const response = await fetch('http://localhost:8080/internalknowledge/tools/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'companyresearch_get_by_domain',
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
      console.log(`🌐 Found ${result.totalResearch} research records for domain: ${args.domain}`);
      return data.result.content[0].text;
    } catch (error) {
      const errorMsg = `Failed to get research by domain: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }
}
