/**
 * PageIndex - Index Document Tool
 * Indexes a PDF file using PageIndex, building a hierarchical tree structure.
 */

import type { ToolExecutor } from '../../types/ai-types';
import { getPageIndexService } from '../../pageindex/pageindex-service';

export class PageIndexIndexDocumentTool implements ToolExecutor {
  name = 'pageindex_index_document';
  description =
    'Index a PDF file using PageIndex — builds a hierarchical tree structure with section summaries. Returns a document_id used by all other pageindex tools. Only needs to be called once per document. This can take 30-60 seconds for large PDFs.';
  dangerous = false;

  async execute(args: { file_path: string }): Promise<string> {
    const { file_path } = args;
    if (!file_path) throw new Error('file_path is required');
    const service = getPageIndexService();
    const docId = await service.indexDocument(file_path);
    return JSON.stringify({
      success: true,
      doc_id: docId,
      message: `Document indexed successfully. Use doc_id "${docId}" with other pageindex tools.`,
    }, null, 2);
  }
}
