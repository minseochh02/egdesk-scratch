/**
 * Knowledge Get Document Tool
 * Gets a specific internal knowledge document by ID
 */

import type { ToolExecutor } from '../../types/ai-types';

export class KnowledgeGetDocumentTool implements ToolExecutor {
  name = 'knowledge_get_document';
  description = 'Get a specific internal knowledge document by ID. Returns document title, category, markdown content, and metadata.';
  dangerous = false;

  async execute(args: { documentId: string }): Promise<string> {
    try {
      const response = await fetch('http://localhost:8080/internalknowledge/tools/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'knowledge_get_document',
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

      console.log(`📖 Retrieved knowledge document: ${args.documentId}`);
      return data.result.content[0].text;
    } catch (error) {
      const errorMsg = `Failed to get knowledge document: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }
}
