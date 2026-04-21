/**
 * Knowledge Delete Document Tool
 * Deletes a knowledge document by ID
 */

import type { ToolExecutor } from '../../types/ai-types';

export class KnowledgeDeleteDocumentTool implements ToolExecutor {
  name = 'knowledge_delete_document';
  description = 'Delete a knowledge document by ID. This operation cannot be undone. Returns success confirmation.';
  dangerous = true;
  requiresConfirmation = true;

  async execute(args: { documentId: string }): Promise<string> {
    try {
      const response = await fetch('http://localhost:8080/internalknowledge/tools/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'knowledge_delete_document',
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
      console.log(`🗑️ Deleted knowledge document: ${args.documentId}`);
      return data.result.content[0].text;
    } catch (error) {
      const errorMsg = `Failed to delete knowledge document: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }
}
