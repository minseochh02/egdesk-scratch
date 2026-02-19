/**
 * Coding Request Router
 *
 * Routes incoming tunneled requests to local development servers based on project name.
 *
 * URL Pattern: /p/{project_name}/{path}
 * Example: /p/my-nextjs-app/api/posts -> localhost:3000/api/posts
 */

import http from 'http';
import { URL } from 'url';
import { getProjectRegistry } from './project-registry';

export interface RouteResult {
  handled: boolean;
  projectName?: string;
  targetUrl?: string;
  error?: string;
}

export interface ProxyResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

/**
 * Parse request path to extract project name and remaining path
 * @param requestPath - The full request path (e.g., /p/my-app/api/users)
 * @returns Parsed route information or null if not a project route
 */
export function parseProjectRoute(requestPath: string): { projectName: string; path: string } | null {
  // Match pattern: /p/{project_name}/{path}
  const match = requestPath.match(/^\/p\/([^\/]+)(\/.*)?$/);

  if (!match) {
    return null;
  }

  const projectName = match[1];
  const path = match[2] || '/';

  return { projectName, path };
}

/**
 * Route request to appropriate project dev server
 * @param requestPath - The request path to route
 * @returns Route result with target URL or error
 */
export function routeRequest(requestPath: string): RouteResult {
  // Parse the route
  const route = parseProjectRoute(requestPath);

  if (!route) {
    return {
      handled: false,
      error: 'Not a project route (expected /p/{project_name}/{path})'
    };
  }

  const { projectName, path } = route;

  // Look up project in registry
  const projectRegistry = getProjectRegistry();
  const project = projectRegistry.getProject(projectName);

  if (!project) {
    return {
      handled: false,
      projectName,
      error: `Project '${projectName}' not found in registry`
    };
  }

  // Check if project is running
  if (project.status !== 'running') {
    return {
      handled: false,
      projectName,
      error: `Project '${projectName}' is not running (status: ${project.status})`
    };
  }

  // Construct target URL
  const targetUrl = `http://localhost:${project.port}${path}`;

  return {
    handled: true,
    projectName,
    targetUrl
  };
}

/**
 * Proxy request to local dev server
 * @param method - HTTP method
 * @param targetUrl - Target URL (e.g., http://localhost:3000/api/posts)
 * @param headers - Request headers
 * @param body - Request body (optional)
 * @param queryParams - Query parameters (optional)
 * @returns Promise with response data
 */
export async function proxyRequest(
  method: string,
  targetUrl: string,
  headers: Record<string, string>,
  body?: string,
  queryParams?: Record<string, string>
): Promise<ProxyResponse> {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(targetUrl);

      // Add query parameters if provided
      if (queryParams) {
        Object.entries(queryParams).forEach(([key, value]) => {
          parsedUrl.searchParams.append(key, value);
        });
      }

      const options: http.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 80,
        path: parsedUrl.pathname + parsedUrl.search,
        method,
        headers: {
          ...headers,
          // Ensure host header points to target
          'host': `${parsedUrl.hostname}:${parsedUrl.port}`
        },
      };

      console.log(`🔀 Proxying ${method} ${parsedUrl.pathname} to ${parsedUrl.hostname}:${parsedUrl.port}`);

      const req = http.request(options, (res) => {
        let responseBody = '';

        res.on('data', (chunk) => {
          responseBody += chunk;
        });

        res.on('end', () => {
          const responseHeaders: Record<string, string> = {};
          Object.entries(res.headers).forEach(([key, value]) => {
            if (typeof value === 'string') {
              responseHeaders[key] = value;
            } else if (Array.isArray(value)) {
              responseHeaders[key] = value.join(', ');
            }
          });

          console.log(`← ${res.statusCode} ${method} ${parsedUrl.pathname}`);

          resolve({
            statusCode: res.statusCode || 200,
            headers: responseHeaders,
            body: responseBody
          });
        });
      });

      req.on('error', (err) => {
        console.error(`❌ Proxy request error:`, err);
        reject(err);
      });

      // Send request body if present
      if (body) {
        req.write(body);
      }

      req.end();
    } catch (error) {
      console.error(`❌ Error creating proxy request:`, error);
      reject(error);
    }
  });
}

/**
 * Handle project request (route + proxy)
 * @param requestPath - Request path
 * @param method - HTTP method
 * @param headers - Request headers
 * @param body - Request body (optional)
 * @param queryParams - Query parameters (optional)
 * @param tunnelId - Tunnel ID for constructing full base path (optional)
 * @returns Promise with proxy response or error response
 */
export async function handleProjectRequest(
  requestPath: string,
  method: string,
  headers: Record<string, string>,
  body?: string,
  queryParams?: Record<string, string>,
  tunnelId?: string
): Promise<ProxyResponse> {
  // Route the request
  const route = routeRequest(requestPath);

  if (!route.handled) {
    // Return error response
    return {
      statusCode: route.error?.includes('not found') ? 404 : 503,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        error: route.error,
        projectName: route.projectName
      })
    };
  }

  // Proxy to target
  try {
    const response = await proxyRequest(method, route.targetUrl!, headers, body, queryParams);

    // Note: URL rewriting removed - Vite's --base flag handles this automatically
    return response;
  } catch (error) {
    console.error(`❌ Failed to proxy request to ${route.targetUrl}:`, error);

    return {
      statusCode: 502,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to proxy request to local dev server',
        details: error instanceof Error ? error.message : 'Unknown error',
        projectName: route.projectName,
        targetUrl: route.targetUrl
      })
    };
  }
}
