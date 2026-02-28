/**
 * @egdesk/next-api-plugin
 *
 * Next.js plugin for EGDesk database proxy integration.
 * Provides middleware-based database access for Next.js applications.
 */

import {
  discoverTables,
  updateEnvLocal,
  generateConfigFile,
  type UserDataConfig,
  type UserDataTable
} from './setup-userdata';
import { generateMiddleware } from './generate-middleware';
import { generateProxy } from './generate-proxy';
import { generateHelpers } from './generate-helpers';
import { generateApiWrapper } from './generate-api-wrapper';

export interface SetupOptions {
  egdeskUrl?: string;
  apiKey?: string;
  useProxy?: boolean; // Use proxy.ts (Next.js 16+) instead of middleware.ts
}

/**
 * Main setup function for Next.js projects
 *
 * Discovers tables and generates all necessary files:
 * - proxy.ts or middleware.ts (proxy interceptor)
 * - egdesk.config.ts (table definitions)
 * - egdesk-helpers.ts (helper functions)
 * - .env.local (environment variables)
 */
export async function setupNextApiPlugin(
  projectPath: string,
  options: SetupOptions = {}
): Promise<void> {
  const { egdeskUrl = 'http://localhost:8080', apiKey, useProxy = true } = options;

  console.log('🔍 Discovering EGDesk user-data tables...');

  try {
    const tables = await discoverTables(egdeskUrl, apiKey);

    if (tables.length === 0) {
      console.warn('⚠️  No tables found. Import data in EGDesk first.');
      console.log('');
      console.log('Generating files anyway with empty table list...');
    } else {
      console.log(`✅ Found ${tables.length} table(s):`);
      tables.forEach((table, index) => {
        console.log(`   ${index + 1}. ${table.displayName} (${table.rowCount} rows)`);
      });
    }

    const config: UserDataConfig = {
      apiKey: apiKey || null,
      baseUrl: egdeskUrl,
      tables,
      generatedAt: new Date().toISOString()
    };

    // Generate all configuration files
    console.log('');
    console.log('📝 Generating configuration files...');

    // Use proxy.ts (Next.js 16+) or middleware.ts (legacy)
    if (useProxy) {
      console.log('🔄 Using proxy.ts (Next.js 16+ recommended)');
      generateProxy(projectPath);
    } else {
      console.log('🔄 Using middleware.ts (legacy)');
      generateMiddleware(projectPath);
    }

    generateConfigFile(projectPath, config);
    generateHelpers(projectPath);
    generateApiWrapper(projectPath);
    updateEnvLocal(projectPath, config);

    const proxyFile = useProxy ? 'proxy.ts' : 'middleware.ts';

    console.log('');
    console.log('✅ Setup complete! Files generated:');
    console.log(`   - ${proxyFile} (database proxy)`);
    console.log('   - egdesk.config.ts (type-safe config)');
    console.log('   - egdesk-helpers.ts (helper functions)');
    console.log('   - src/lib/api.ts (basePath-aware fetch wrapper)');
    console.log('   - .env.local (environment variables)');
    console.log('');
    console.log('📝 Next steps:');
    console.log('   1. Add .env.local to your .gitignore');
    console.log('   2. Restart your Next.js dev server');
    console.log('   3. Import and use helpers in your components:');
    console.log('      import { queryTable } from "./egdesk-helpers"');
    console.log('      import { TABLES } from "./egdesk.config"');
    console.log('      import { apiFetch } from "@/lib/api"');
    console.log('');
    console.log('Example usage:');
    console.log('   // Database queries');
    console.log('   const data = await queryTable(TABLES.table1.name, { limit: 10 });');
    console.log('   ');
    console.log('   // API routes (use apiFetch for basePath support)');
    console.log('   const response = await apiFetch("/api/transactions");');
  } catch (error) {
    console.error('❌ Setup failed:', error);
    throw error;
  }
}

// Export types and utilities
export type { UserDataTable, UserDataConfig } from './setup-userdata';
export { discoverTables } from './setup-userdata';
export { generateMiddleware } from './generate-middleware';
export { generateProxy } from './generate-proxy';
export { generateHelpers } from './generate-helpers';
export { generateApiWrapper } from './generate-api-wrapper';
