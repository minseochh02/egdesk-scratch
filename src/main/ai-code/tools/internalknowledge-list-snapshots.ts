/**
 * Internal Knowledge List Snapshots Tool
 * Lists all business identity snapshots (optionally filtered by brandKey)
 */

import type { ToolExecutor } from '../../types/ai-types';

export class InternalKnowledgeListSnapshotsTool implements ToolExecutor {
  name = 'businessidentity_list_snapshots';
  description = 'List all business identity snapshots with company information. Optionally filter by brandKey. Use this to discover available snapshots and their IDs.';
  dangerous = false;

  async execute(args: { brandKey?: string } = {}): Promise<string> {
    try {
      const response = await fetch('http://localhost:8080/internalknowledge/tools/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'businessidentity_list_snapshots',
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
      console.log(`📋 Listed ${result.totalSnapshots} business identity snapshots`);
      return data.result.content[0].text;
    } catch (error) {
      const errorMsg = `Failed to list business identity snapshots: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }
}
