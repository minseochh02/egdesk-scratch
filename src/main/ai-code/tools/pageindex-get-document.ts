/**
 * PageIndex - Get Document Tool
 */

import type { ToolExecutor } from '../../types/ai-types';
import { getPageIndexService } from '../../pageindex/pageindex-service';

export class PageIndexGetDocumentTool implements ToolExecutor {
  name = 'pageindex_get_document';
  description = 'Get metadata for a specific indexed document: name, description, type, and page count.';
  dangerous = false;

  async execute(args: { doc_id: string }): Promise<string> {
    const { doc_id } = args;
    if (!doc_id) throw new Error('doc_id is required');
    const service = getPageIndexService();
    return service.getDocument(doc_id);
  }
}
