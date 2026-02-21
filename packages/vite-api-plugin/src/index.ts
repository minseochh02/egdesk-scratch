import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';
import { setupUserData, discoverTables, generateEnvFile, generateConfigFile, generateHelperFile } from './setup-userdata';
import type { UserDataConfig } from './setup-userdata';
import * as fs from 'fs';
import * as path from 'path';

export interface ApiRoute {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  handler: (req: IncomingMessage, res: ServerResponse, body?: any) => void | Promise<void>;
}

export interface ViteApiPluginOptions {
  /**
   * API routes to register
   * Can be provided directly or via a function that returns routes
   */
  routes?: ApiRoute[] | (() => ApiRoute[] | Promise<ApiRoute[]>);

  /**
   * Custom route matcher function
   * Return the API path if the request should be handled, otherwise return null
   */
  routeMatcher?: (url: string) => string | null;

  /**
   * Enable debug logging
   */
  debug?: boolean;

  /**
   * Automatically discover and setup EGDesk user-data tables
   * Default: true
   */
  autoSetupUserData?: boolean;

  /**
   * EGDesk HTTP server URL
   * Default: http://localhost:8080
   */
  egdeskUrl?: string;

  /**
   * API key for EGDesk HTTP server (optional)
   */
  egdeskApiKey?: string;
}

/**
 * Read API key from .env.local file
 */
function readEnvLocal(projectPath: string): { apiKey?: string; apiUrl?: string } {
  try {
    const envPath = path.join(projectPath, '.env.local');
    if (!fs.existsSync(envPath)) {
      return {};
    }

    const envContent = fs.readFileSync(envPath, 'utf-8');
    const lines = envContent.split('\n');
    const result: { apiKey?: string; apiUrl?: string } = {};

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('VITE_EGDESK_API_KEY=')) {
        result.apiKey = trimmed.split('=')[1].trim();
      }
      if (trimmed.startsWith('VITE_EGDESK_API_URL=')) {
        result.apiUrl = trimmed.split('=')[1].trim();
      }
    }

    return result;
  } catch (error) {
    console.error('[vite-api-plugin] Failed to read .env.local:', error);
    return {};
  }
}

/**
 * Default route matcher that handles both local and tunneled paths
 * Extracts /api/* from URLs like:
 * - /api/overview
 * - /t/{tunnel}/p/{project}/api/overview
 */
function defaultRouteMatcher(url: string): string | null {
  // Check if this is an API request
  const isApiRequest = url.startsWith('/api') || url.includes('/api/');

  if (!isApiRequest) {
    return null;
  }

  // Extract the API path
  if (url.includes('/api/')) {
    const apiPath = '/api' + url.split('/api')[1].split('?')[0]; // Remove query params
    return apiPath;
  }

  return null;
}

/**
 * Vite plugin for handling API routes in development
 * Automatically handles both local paths (/api/*) and tunneled paths (/t/{id}/p/{name}/api/*)
 */
export function viteApiPlugin(options: ViteApiPluginOptions = {}): Plugin {
  const {
    routes = [],
    routeMatcher = defaultRouteMatcher,
    debug = false,
    autoSetupUserData = true,
    egdeskUrl = process.env.VITE_EGDESK_API_URL || 'http://localhost:8080',
    egdeskApiKey = process.env.VITE_EGDESK_API_KEY
  } = options;

  let apiRoutes: Map<string, Map<string, ApiRoute['handler']>> = new Map();
  let userDataSetupComplete = false;

  const log = (...args: any[]) => {
    if (debug) {
      console.log('[vite-api-plugin]', ...args);
    }
  };

  return {
    name: '@egdesk/vite-api-plugin',

    async buildStart() {
      // Auto-setup user-data configuration on first build
      if (autoSetupUserData && !userDataSetupComplete) {
        try {
          log('🔍 Auto-discovering EGDesk user-data tables...');

          // Read API key from .env.local (Vite hasn't loaded env vars yet)
          const projectPath = process.cwd();
          const envVars = readEnvLocal(projectPath);
          const actualApiKey = envVars.apiKey || egdeskApiKey;
          const actualApiUrl = envVars.apiUrl || egdeskUrl;

          log(`Using API URL: ${actualApiUrl}`);
          log(`Using API Key: ${actualApiKey ? actualApiKey.substring(0, 8) + '...' : 'none'}`);

          const tables = await discoverTables(actualApiUrl, actualApiKey);

          if (tables.length > 0) {
            const projectPath = process.cwd();

            const config: UserDataConfig = {
              apiKey: actualApiKey || null,
              baseUrl: actualApiUrl,
              tables,
              generatedAt: new Date().toISOString()
            };

            // Generate config files
            generateEnvFile(projectPath, config);
            generateConfigFile(projectPath, config);
            generateHelperFile(projectPath);

            log(`✅ Auto-discovered ${tables.length} table(s) and generated config files`);
          } else {
            log('ℹ️  No user-data tables found - skipping config generation');
          }

          userDataSetupComplete = true;
        } catch (error) {
          // Silently skip if EGDesk is not running
          if (error instanceof Error && (
            error.message.includes('ECONNREFUSED') ||
            error.message.includes('fetch failed')
          )) {
            log('ℹ️  EGDesk HTTP server not running - skipping user-data setup');
          } else {
            log('⚠️  Failed to auto-setup user-data:', error);
          }
          userDataSetupComplete = true; // Don't retry
        }
      }
    },

    async configureServer(server: ViteDevServer) {
      // Load routes (support both static and dynamic routes)
      const routesList = typeof routes === 'function' ? await routes() : routes;

      // Build route map for fast lookup: path -> method -> handler
      for (const route of routesList) {
        if (!apiRoutes.has(route.path)) {
          apiRoutes.set(route.path, new Map());
        }
        apiRoutes.get(route.path)!.set(route.method, route.handler);
        log(`Registered route: ${route.method} ${route.path}`);
      }

      // Add middleware to handle API requests
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';

        // Check if this is a user-data proxy request (matches any path ending with __user_data_proxy)
        if (url.includes('__user_data_proxy')) {
          log(`Proxying user-data request: ${url}`);

          let body = '';
          req.on('data', chunk => {
            body += chunk.toString();
          });
          req.on('end', async () => {
            try {
              const headers: Record<string, string> = {
                'Content-Type': 'application/json'
              };

              // Read API key from .env.local
              const projectPath = process.cwd();
              const envVars = readEnvLocal(projectPath);
              const actualApiKey = envVars.apiKey || egdeskApiKey;
              const actualApiUrl = envVars.apiUrl || egdeskUrl;

              if (actualApiKey) {
                headers['X-Api-Key'] = actualApiKey;
              }

              const response = await fetch(`${actualApiUrl}/user-data/tools/call`, {
                method: 'POST',
                headers,
                body
              });

              const result = await response.json();

              res.statusCode = response.status;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(result));
            } catch (error) {
              console.error('[vite-api-plugin] Proxy error:', error);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                error: 'Proxy error',
                message: error instanceof Error ? error.message : String(error)
              }));
            }
          });
          return;
        }

        // Check if this is an API request
        const apiPath = routeMatcher(url);

        if (!apiPath) {
          return next();
        }

        log(`Incoming request: ${req.method} ${url} -> ${apiPath}`);

        // Find matching route
        const methodMap = apiRoutes.get(apiPath);

        if (!methodMap) {
          log(`No route found for: ${apiPath}`);
          return next();
        }

        const handler = methodMap.get(req.method as any);

        if (!handler) {
          log(`Method ${req.method} not allowed for: ${apiPath}`);
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        // Handle request
        try {
          // Parse body for POST/PUT/PATCH requests
          if (['POST', 'PUT', 'PATCH'].includes(req.method || '')) {
            let body = '';
            req.on('data', chunk => {
              body += chunk.toString();
            });
            req.on('end', async () => {
              let parsedBody: any = null;
              try {
                parsedBody = body ? JSON.parse(body) : null;
              } catch (e) {
                log(`Failed to parse JSON body: ${e}`);
              }

              log(`Executing handler for: ${req.method} ${apiPath}`);
              await handler(req, res, parsedBody);
            });
          } else {
            // GET/DELETE - no body
            log(`Executing handler for: ${req.method} ${apiPath}`);
            await handler(req, res);
          }
        } catch (error) {
          console.error('[vite-api-plugin] Error handling request:', error);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : String(error)
          }));
        }
      });

      log('API plugin configured successfully');
    }
  };
}

/**
 * Helper to create a JSON response
 */
export function jsonResponse(res: ServerResponse, data: any, statusCode = 200) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

export default viteApiPlugin;
