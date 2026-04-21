/**
 * Internal Knowledge Get Services/Products Tool
 * Gets services and products array from a business identity snapshot
 */

import type { ToolExecutor } from '../../types/ai-types';

export class InternalKnowledgeGetServicesProductsTool implements ToolExecutor {
  name = 'businessidentity_get_services_products';
  description = 'Get all services and products from a business identity snapshot. Returns array of products with names, descriptions, categories, and specifications.';
  dangerous = false;

  async execute(args: { snapshotId: string }): Promise<string> {
    try {
      const response = await fetch('http://localhost:8080/internalknowledge/tools/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'businessidentity_get_services_products',
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
      console.log(`📦 Retrieved ${result.totalProducts} products/services for snapshot: ${args.snapshotId}`);
      return data.result.content[0].text;
    } catch (error) {
      const errorMsg = `Failed to get services/products: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }
}
