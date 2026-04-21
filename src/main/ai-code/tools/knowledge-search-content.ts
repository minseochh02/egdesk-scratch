/**
 * Knowledge Search Content Tool
 * Searches knowledge document content by text query
 */

import type { ToolExecutor } from '../../types/ai-types';

export class KnowledgeSearchContentTool implements ToolExecutor {
  name = 'knowledge_search_content';
  description = 'Search knowledge document content by text query. Searches in title and markdown content. Returns matching documents with highlighted excerpts.';
  dangerous = false;

  async execute(args: { snapshotId: string; query: string }): Promise<string> {
    try {
      const response = await fetch('http://localhost:8080/internalknowledge/tools/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'knowledge_search_content',
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
      console.log(`🔍 Found ${result.totalMatches} matching knowledge documents for query: "${args.query}"`);
      return data.result.content[0].text;
    } catch (error) {
      const errorMsg = `Failed to search knowledge content: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }
}
