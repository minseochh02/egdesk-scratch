/**
 * Internal Knowledge Get Snapshot Tool
 * Gets a specific business identity snapshot by ID
 */

import type { ToolExecutor } from '../../types/ai-types';

export class InternalKnowledgeGetSnapshotTool implements ToolExecutor {
  name = 'businessidentity_get_snapshot';
  description = 'Get a specific business identity snapshot by ID. Returns complete snapshot data including company info, SEO/SSL analysis, and services.';
  dangerous = false;

  async execute(args: { snapshotId: string }): Promise<string> {
    try {
      const response = await fetch('http://localhost:8080/internalknowledge/tools/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'businessidentity_get_snapshot',
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

      console.log(`📄 Retrieved business identity snapshot: ${args.snapshotId}`);
      return data.result.content[0].text;
    } catch (error) {
      const errorMsg = `Failed to get business identity snapshot: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }
}
