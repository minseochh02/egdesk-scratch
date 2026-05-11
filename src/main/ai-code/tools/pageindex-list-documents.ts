/**
 * PageIndex - List Documents Tool
 */

import type { ToolExecutor } from '../../types/ai-types';

export class PageIndexListDocumentsTool implements ToolExecutor {
  name = 'pageindex_list_documents';
  description = 'List all PDF documents that have been indexed with PageIndex, including their IDs, names, and descriptions.';
  dangerous = false;

  async execute(_args: Record<string, never>): Promise<string> {
    const response = await fetch('http://localhost:8080/pageindex/tools/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: 'pageindex_list_documents', arguments: {} }),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'pageindex_list_documents failed');
    return data.result.content[0].text;
  }
}
