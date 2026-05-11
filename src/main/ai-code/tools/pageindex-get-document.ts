/**
 * PageIndex - Get Document Tool
 */

import type { ToolExecutor } from '../../types/ai-types';

export class PageIndexGetDocumentTool implements ToolExecutor {
  name = 'pageindex_get_document';
  description = 'Get metadata for a specific indexed document: name, description, type, and page count.';
  dangerous = false;

  async execute(args: { doc_id: string }): Promise<string> {
    const { doc_id } = args;
    if (!doc_id) throw new Error('doc_id is required');

    const response = await fetch('http://localhost:8080/pageindex/tools/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: 'pageindex_get_document', arguments: args }),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'pageindex_get_document failed');
    return data.result.content[0].text;
  }
}
