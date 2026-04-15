/**
 * After user-data tables change (e.g. CREATE TABLE), refresh egdesk.config.ts and helpers
 * for projects that are currently registered with the EGDesk dev server (Coding tab).
 *
 * Tunnel API key is supplied via setEgdeskConfigRegeneratorDeps (from main after store init)
 * so this module does not import storage (avoids circular deps with sqlite/user-data).
 */

import * as fs from 'fs';
import * as path from 'path';
import { getProjectRegistry, type RegisteredProject } from './project-registry';

const DEFAULT_EGDESK_URL = 'http://localhost:8080';

let tunnelApiKeyGetter: () => string | undefined = () => undefined;

export function setEgdeskConfigRegeneratorDeps(deps: {
  getTunnelApiKey: () => string | undefined;
}): void {
  tunnelApiKeyGetter = deps.getTunnelApiKey;
}

function loadNextSetup(
  projectPath: string,
): ((p: string, o: object) => Promise<void>) | null {
  const pluginPath = path.join(
    projectPath,
    'node_modules',
    '@egdesk',
    'next-api-plugin',
    'dist',
    'index.js',
  );
  if (!fs.existsSync(pluginPath)) {
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require, import/no-dynamic-require
    const plugin = require(pluginPath);
    return plugin.setupNextApiPlugin as (p: string, o: object) => Promise<void>;
  } catch {
    return null;
  }
}

function loadViteSetupUserData(
  projectPath: string,
): ((p: string, url?: string, key?: string) => Promise<void>) | null {
  const setupPath = path.join(
    projectPath,
    'node_modules',
    '@egdesk',
    'vite-api-plugin',
    'dist',
    'setup-userdata.js',
  );
  if (!fs.existsSync(setupPath)) {
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require, import/no-dynamic-require
    const mod = require(setupPath);
    return mod.setupUserData as (
      p: string,
      url?: string,
      key?: string,
    ) => Promise<void>;
  } catch {
    return null;
  }
}

function detectNextUseProxy(projectPath: string): boolean {
  const hasProxy = [
    path.join(projectPath, 'proxy.ts'),
    path.join(projectPath, 'src', 'proxy.ts'),
  ].some((p) => fs.existsSync(p));
  const hasMiddleware = [
    path.join(projectPath, 'middleware.ts'),
    path.join(projectPath, 'src', 'middleware.ts'),
  ].some((p) => fs.existsSync(p));
  if (hasProxy) {
    return true;
  }
  if (hasMiddleware) {
    return false;
  }
  return true;
}

function getProjectTypeFromPackageJson(
  projectPath: string,
): 'nextjs' | 'vite' | null {
  const pkgPath = path.join(projectPath, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return null;
  }
  let pkg: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  } catch {
    return null;
  }
  const all = { ...pkg.dependencies, ...pkg.devDependencies };
  if (all['@egdesk/next-api-plugin']) {
    return 'nextjs';
  }
  if (all['@egdesk/vite-api-plugin']) {
    return 'vite';
  }
  return null;
}

function resolveProjectKind(
  folderPath: string,
  registryType?: RegisteredProject['type'],
): 'nextjs' | 'vite' | null {
  if (registryType === 'nextjs' || registryType === 'vite') {
    return registryType;
  }
  return getProjectTypeFromPackageJson(folderPath);
}

async function refreshOneProject(
  folderPath: string,
  kind: 'nextjs' | 'vite',
  apiKey: string | undefined,
  egdeskUrl: string,
): Promise<void> {
  if (kind === 'nextjs') {
    const setup = loadNextSetup(folderPath);
    if (setup) {
      await setup(folderPath, {
        egdeskUrl,
        apiKey,
        useProxy: detectNextUseProxy(folderPath),
      });
      // eslint-disable-next-line no-console
      console.log(
        `[egdesk-config] Regenerated Next.js EGDesk config for ${folderPath}`,
      );
    }
    return;
  }
  const setupUserData = loadViteSetupUserData(folderPath);
  if (setupUserData) {
    await setupUserData(folderPath, egdeskUrl, apiKey);
    // eslint-disable-next-line no-console
    console.log(
      `[egdesk-config] Regenerated Vite EGDesk config for ${folderPath}`,
    );
  }
}

/**
 * Call after user-data gains a new table so linked app projects pick up TABLES in egdesk.config.ts
 * without a manual `npx egdesk-next-setup` / egdesk-setup.
 *
 * Only projects currently registered with the dev server (see ProjectRegistry) are updated.
 */
export async function notifyUserDataTablesChanged(): Promise<void> {
  const projects = getProjectRegistry().getAllProjects();
  if (projects.length === 0) {
    // eslint-disable-next-line no-console
    console.log(
      '[egdesk-config] No active dev-server projects; skip egdesk.config regeneration',
    );
    return;
  }

  const apiKey = tunnelApiKeyGetter();
  const egdeskUrl = DEFAULT_EGDESK_URL;

  await Promise.all(
    projects.map(({ folderPath, type }) => {
      const kind = resolveProjectKind(folderPath, type);
      if (!kind) {
        return Promise.resolve();
      }
      return refreshOneProject(folderPath, kind, apiKey, egdeskUrl).catch(
        (e) => {
          // eslint-disable-next-line no-console
          console.warn(`[egdesk-config] Failed to refresh ${folderPath}:`, e);
        },
      );
    }),
  );
}
