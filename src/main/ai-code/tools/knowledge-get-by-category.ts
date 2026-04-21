/**
 * Knowledge Get By Category Tool
 * Filters knowledge documents by category
 */

import type { ToolExecutor } from '../../types/ai-types';

export class KnowledgeGetByCategoryTool implements ToolExecutor {
  name = 'knowledge_get_by_category';
  description = 'Filter knowledge documents by category (hierarchy/process/policy/note). Returns all documents in the specified category.';
  dangerous = false;

  async execute(args: { snapshotId: string; category: string }): Promise<string> {
    try {
      const response = await fetch('http://localhost:8080/internalknowledge/tools/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'knowledge_get_by_category',
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
      console.log(`📁 Found ${result.totalDocuments} documents in category: ${args.category}`);
      return data.result.content[0].text;
    } catch (error) {
      const errorMsg = `Failed to get documents by category: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }
}
