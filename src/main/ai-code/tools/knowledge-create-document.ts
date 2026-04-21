/**
 * Knowledge Create Document Tool
 * Creates a new knowledge document for a business identity snapshot
 */

import type { ToolExecutor } from '../../types/ai-types';

export class KnowledgeCreateDocumentTool implements ToolExecutor {
  name = 'knowledge_create_document';
  description = 'Create a new internal knowledge document with title, category (hierarchy/process/policy/note), and optional markdown content. Returns the created document with ID.';
  dangerous = false;

  async execute(args: { snapshotId: string; title: string; category: string; content?: string }): Promise<string> {
    try {
      const response = await fetch('http://localhost:8080/internalknowledge/tools/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'knowledge_create_document',
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
      console.log(`📝 Created knowledge document: "${args.title}" (${args.category}) in snapshot ${args.snapshotId}`);
      return data.result.content[0].text;
    } catch (error) {
      const errorMsg = `Failed to create knowledge document: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }
}
