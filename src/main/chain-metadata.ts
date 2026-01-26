import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export interface ChainMetadata {
  chainId: string;
  scripts: Array<{
    scriptPath: string;
    scriptName: string;
    order: number;  // 1 for download, 2 for upload, etc.
    timestamp: string;
    hasDownloads?: boolean;
    downloadedFile?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

class ChainMetadataStore {
  private metadataFile: string;
  private chains: Map<string, ChainMetadata>;

  constructor() {
    // Use the same output directory logic as chrome-handlers.ts
    const baseDir = app.isPackaged
      ? path.join(app.getPath('userData'), 'output')
      : path.join(process.cwd(), 'output');

    const outputDir = path.join(baseDir, 'browser-recorder-tests');

    // Ensure directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    this.metadataFile = path.join(outputDir, 'chain-metadata.json');
    this.chains = new Map();
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.metadataFile)) {
        const data = fs.readFileSync(this.metadataFile, 'utf8');
        const chainsArray = JSON.parse(data);
        this.chains = new Map(chainsArray.map((chain: ChainMetadata) => [chain.chainId, chain]));
        console.log(`📊 Loaded ${this.chains.size} chain(s) from metadata`);
      }
    } catch (error) {
      console.error('Error loading chain metadata:', error);
      this.chains = new Map();
    }
  }

  private save(): void {
    try {
      const chainsArray = Array.from(this.chains.values());
      fs.writeFileSync(this.metadataFile, JSON.stringify(chainsArray, null, 2), 'utf8');
      console.log(`💾 Saved ${this.chains.size} chain(s) to metadata`);
    } catch (error) {
      console.error('Error saving chain metadata:', error);
    }
  }

  addScriptToChain(chainId: string, scriptPath: string, scriptName: string, hasDownloads: boolean = false, downloadedFile?: string): void {
    let chain = this.chains.get(chainId);

    if (!chain) {
      // Create new chain
      chain = {
        chainId,
        scripts: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.chains.set(chainId, chain);
      console.log(`🔗 Created new chain: ${chainId}`);
    }

    // Determine order based on existing scripts
    const order = chain.scripts.length + 1;

    // Add script to chain
    chain.scripts.push({
      scriptPath,
      scriptName,
      order,
      timestamp: new Date().toISOString(),
      hasDownloads,
      downloadedFile
    });

    chain.updatedAt = new Date().toISOString();

    this.save();
    console.log(`➕ Added script to chain ${chainId}: ${scriptName} (order: ${order})`);
  }

  getChain(chainId: string): ChainMetadata | undefined {
    return this.chains.get(chainId);
  }

  getChainByScript(scriptPath: string): ChainMetadata | undefined {
    for (const chain of this.chains.values()) {
      if (chain.scripts.some(s => s.scriptPath === scriptPath)) {
        return chain;
      }
    }
    return undefined;
  }

  getAllChains(): ChainMetadata[] {
    return Array.from(this.chains.values());
  }

  deleteChain(chainId: string): boolean {
    const deleted = this.chains.delete(chainId);
    if (deleted) {
      this.save();
      console.log(`🗑️ Deleted chain: ${chainId}`);
    }
    return deleted;
  }

  // Clean up chains that reference deleted scripts
  cleanupDeletedScripts(existingScriptPaths: Set<string>): void {
    let changed = false;

    for (const [chainId, chain] of this.chains.entries()) {
      const validScripts = chain.scripts.filter(s => existingScriptPaths.has(s.scriptPath));

      if (validScripts.length === 0) {
        // All scripts deleted, remove chain
        this.chains.delete(chainId);
        changed = true;
        console.log(`🗑️ Removed chain ${chainId} (all scripts deleted)`);
      } else if (validScripts.length !== chain.scripts.length) {
        // Some scripts deleted, update chain
        chain.scripts = validScripts;
        chain.updatedAt = new Date().toISOString();
        changed = true;
        console.log(`🔄 Updated chain ${chainId} (removed deleted scripts)`);
      }
    }

    if (changed) {
      this.save();
    }
  }
}

// Singleton instance
let metadataStore: ChainMetadataStore | null = null;

export function getChainMetadataStore(): ChainMetadataStore {
  if (!metadataStore) {
    metadataStore = new ChainMetadataStore();
  }
  return metadataStore;
}
