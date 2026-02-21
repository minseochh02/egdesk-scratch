/**
 * @egdesk/next-api-plugin
 *
 * Next.js plugin for EGDesk database proxy integration.
 * Provides middleware-based database access for Next.js applications.
 */
export interface SetupOptions {
    egdeskUrl?: string;
    apiKey?: string;
}
/**
 * Main setup function for Next.js projects
 *
 * Discovers tables and generates all necessary files:
 * - middleware.ts (proxy interceptor)
 * - egdesk.config.ts (table definitions)
 * - egdesk-helpers.ts (helper functions)
 * - .env.local (environment variables)
 */
export declare function setupNextApiPlugin(projectPath: string, options?: SetupOptions): Promise<void>;
export type { UserDataTable, UserDataConfig } from './setup-userdata';
export { discoverTables } from './setup-userdata';
export { generateMiddleware } from './generate-middleware';
export { generateHelpers } from './generate-helpers';
