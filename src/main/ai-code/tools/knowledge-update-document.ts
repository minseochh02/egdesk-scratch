/**
 * Knowledge Update Document Tool
 * Updates an existing knowledge document's title, category, or content
 */

import type { ToolExecutor } from '../../types/ai-types';

export class KnowledgeUpdateDocumentTool implements ToolExecutor {
  name = 'knowledge_update_document';
  description = 'Update an existing knowledge document. Can update title, category (hierarchy/process/policy/note), and/or markdown content. Returns the updated document.';
  dangerous = false;

  async execute(args: { documentId: string; title?: string; category?: string; content?: string }): Promise<string> {
    try {
      const response = await fetch('http://localhost:8080/internalknowledge/tools/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'knowledge_update_document',
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
      console.log(`✏️ Updated knowledge document: ${args.documentId}`);
      return data.result.content[0].text;
    } catch (error) {
      const errorMsg = `Failed to update knowledge document: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }
}
