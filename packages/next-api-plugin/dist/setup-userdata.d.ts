/**
 * User Data Setup Utility for Next.js
 *
 * Automatically discovers EGDesk user-data tables and generates configuration
 * for Next.js projects to access them.
 */
export interface UserDataTable {
    id: string;
    tableName: string;
    displayName: string;
    description?: string;
    rowCount: number;
    columnCount: number;
    columns: string[];
}
export interface UserDataConfig {
    apiKey: string | null;
    baseUrl: string;
    tables: UserDataTable[];
    generatedAt: string;
}
/**
 * Fetch available tables from EGDesk
 */
export declare function discoverTables(egdeskUrl?: string, apiKey?: string): Promise<UserDataTable[]>;
/**
 * Read existing .env.local file or return empty object
 */
export declare function readEnvLocal(projectPath: string): Record<string, string>;
/**
 * Update .env.local file with Next.js environment variables
 */
export declare function updateEnvLocal(projectPath: string, config: UserDataConfig): void;
/**
 * Generate TypeScript config file with table definitions
 */
export declare function generateConfigFile(projectPath: string, config: UserDataConfig): void;
