/**
 * PageIndex - Get Pages Tool
 */

import type { ToolExecutor } from '../../types/ai-types';
import { getPageIndexService } from '../../pageindex/pageindex-service';

export class PageIndexGetPagesTool implements ToolExecutor {
  name = 'pageindex_get_pages';
  description =
    'Get the raw text content of specific pages from an indexed document. Use pageindex_get_structure first to find relevant page ranges, then fetch only the pages you need. Pages format: "5" (single), "3,8" (specific), "5-7" (range), "1,3,5-7" (combined).';
  dangerous = false;

  async execute(args: { doc_id: string; pages: string }): Promise<string> {
    const { doc_id, pages } = args;
    if (!doc_id) throw new Error('doc_id is required');
    if (!pages) throw new Error('pages is required');
    const service = getPageIndexService();
    return service.getPageContent(doc_id, pages);
  }
}
