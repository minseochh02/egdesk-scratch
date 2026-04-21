/**
 * Knowledge List Documents Tool
 * Lists all internal knowledge documents for a business identity snapshot
 */

import type { ToolExecutor } from '../../types/ai-types';

export class KnowledgeListDocumentsTool implements ToolExecutor {
  name = 'knowledge_list_documents';
  description = 'List all internal knowledge documents for a business identity snapshot. Optionally filter by category (hierarchy/process/policy/note).';
  dangerous = false;

  async execute(args: { snapshotId: string; category?: string }): Promise<string> {
    try {
      const response = await fetch('http://localhost:8080/internalknowledge/tools/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'knowledge_list_documents',
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
      console.log(`📚 Listed ${result.totalDocuments} knowledge documents`);
      return data.result.content[0].text;
    } catch (error) {
      const errorMsg = `Failed to list knowledge documents: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }
}
