/**
 * Generate Next.js 16+ proxy for EGDesk database proxy
 *
 * Creates proxy.ts that intercepts __user_data_proxy requests
 * and forwards them to the EGDesk MCP server.
 *
 * This is the Next.js 16+ recommended approach (replaces middleware.ts)
 */
/**
 * Generate proxy.ts file in the correct location (root or src/)
 */
export declare function generateProxy(projectPath: string): void;
