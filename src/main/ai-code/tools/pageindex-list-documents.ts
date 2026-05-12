/**
 * PageIndex - List Documents Tool
 */

import type { ToolExecutor } from '../../types/ai-types';
import { getPageIndexService } from '../../pageindex/pageindex-service';

export class PageIndexListDocumentsTool implements ToolExecutor {
  name = 'pageindex_list_documents';
  description = 'List all PDF documents that have been indexed with PageIndex, including their IDs, names, and descriptions.';
  dangerous = false;

  async execute(_args: Record<string, never>): Promise<string> {
    const service = getPageIndexService();
    const documents = service.listDocuments();
    return JSON.stringify({ total: documents.length, documents }, null, 2);
  }
}
