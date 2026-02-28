/**
 * Generate API wrapper for handling basePath in client-side fetch calls
 *
 * Creates src/lib/api.ts that automatically prepends NEXT_PUBLIC_EGDESK_BASE_PATH
 * to relative URLs, solving the Next.js basePath limitation with client-side fetch.
 */
/**
 * Generate src/lib/api.ts file for basePath-aware fetch wrapper
 */
export declare function generateApiWrapper(projectPath: string): void;
