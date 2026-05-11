/**
 * PageIndex - Get Structure Tool
 */

import type { ToolExecutor } from '../../types/ai-types';

export class PageIndexGetStructureTool implements ToolExecutor {
  name = 'pageindex_get_structure';
  description =
    'Get the hierarchical tree structure of an indexed document. Returns section titles, page ranges, and AI-generated summaries — without full page text to save tokens. Use this to understand document layout and find which pages cover a topic, then fetch only those pages with pageindex_get_pages.';
  dangerous = false;

  async execute(args: { doc_id: string }): Promise<string> {
    const { doc_id } = args;
    if (!doc_id) throw new Error('doc_id is required');

    const response = await fetch('http://localhost:8080/pageindex/tools/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: 'pageindex_get_structure', arguments: args }),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'pageindex_get_structure failed');
    return data.result.content[0].text;
  }
}
