/**
 * PageIndex - Index Document Tool
 * Indexes a PDF file using PageIndex, building a hierarchical tree structure.
 */

import type { ToolExecutor } from '../../types/ai-types';

export class PageIndexIndexDocumentTool implements ToolExecutor {
  name = 'pageindex_index_document';
  description =
    'Index a PDF file using PageIndex — builds a hierarchical tree structure with section summaries. Returns a document_id used by all other pageindex tools. Only needs to be called once per document. This can take 30-60 seconds for large PDFs.';
  dangerous = false;

  async execute(args: { file_path: string }): Promise<string> {
    const { file_path } = args;
    if (!file_path) throw new Error('file_path is required');

    const response = await fetch('http://localhost:8080/pageindex/tools/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: 'pageindex_index_document', arguments: args }),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'pageindex_index_document failed');
    return data.result.content[0].text;
  }
}
