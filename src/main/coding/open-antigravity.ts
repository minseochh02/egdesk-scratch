import { randomUUID } from 'crypto';
import { spawn, execSync } from 'child_process';
import { ipcMain, shell } from 'electron';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { CODING_PORTS } from '../../shared/coding-ports';
import { repairAgyHubSummaries } from './agyhub-summaries';
import { EGDesk_CHAT_TITLE, cleanupOrphanEgdeskChatStubs, registerEgdeskChatHistory } from './egdesk-antigravity-chat';
import {
  isolateConversationsForFolder,
  isAntigravityRunning,
  launchAntigravityApp,
  sanitizeSessionMeta,
} from './antigravity-session';

export const ANTIGRAVITY_INSTALL_URL = 'https://antigravity.google/download';

export interface AntigravityOpenOptions {
  folderPath: string;
  port?: number;
  mode?: 'dev' | 'production';
  url?: string;
  projectName?: string;
}

export interface AntigravityOpenResult {
  success: boolean;
  error?: string;
  method?: string;
  port?: number;
  needsInstall?: boolean;
  projectId?: string;
  egdeskChatCascadeId?: string;
  /** egdesk-chat exists on disk but user must send a message in Antigravity. */
  egdeskChatNeedsActivation?: boolean;
  /** Seed message + trajectory persisted successfully. */
  egdeskChatActivated?: boolean;
  egdeskChatError?: string;
}

const EGDESK_CONTEXT_BEGIN = '<!-- BEGIN:egdesk-dev-context -->';
const EGDESK_CONTEXT_END = '<!-- END:egdesk-dev-context -->';

const DEFAULT_PROJECT_SETTINGS = {
  fileAccessPolicy: 'AGENT_SETTING_POLICY_ASK',
  internetPolicy: 'AGENT_SETTING_POLICY_ASK',
  autoExecutionPolicy: 'CASCADE_COMMANDS_AUTO_EXECUTION_OFF',
  artifactReviewMode: 'ARTIFACT_REVIEW_MODE_ALWAYS',
} as const;

function commandExists(cmd: string): boolean {
  try {
    execSync(process.platform === 'win32' ? `where ${cmd}` : `which ${cmd}`, {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

function pushIfExists(candidates: string[], candidate: string): void {
  if (candidate && fs.existsSync(candidate)) {
    candidates.push(candidate);
  }
}

/** VS Code-style IDE launcher (Antigravity IDE / pre-2.0), not the 2.0 desktop app. */
function getIdeLauncherCandidates(): string[] {
  const candidates: string[] = [];

  if (process.platform === 'darwin') {
    for (const appName of ['Antigravity IDE.app', 'Antigravity.app']) {
      const appRoot = `/Applications/${appName}/Contents/Resources/app/bin`;
      pushIfExists(candidates, path.join(appRoot, 'antigravity'));
      pushIfExists(candidates, path.join(appRoot, 'agy'));
    }
  } else if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || '';
    for (const root of [
      path.join(localAppData, 'Programs', 'Antigravity IDE'),
      path.join(localAppData, 'Programs', 'Antigravity'),
      path.join(localAppData, 'Programs', 'antigravity'),
    ]) {
      pushIfExists(candidates, path.join(root, 'bin', 'antigravity.cmd'));
      pushIfExists(candidates, path.join(root, 'bin', 'antigravity'));
      pushIfExists(candidates, path.join(root, 'bin', 'agy.cmd'));
      pushIfExists(candidates, path.join(root, 'bin', 'agy'));
    }
  } else {
    for (const candidate of [
      '/usr/bin/antigravity',
      '/usr/local/bin/antigravity',
      path.join(os.homedir(), '.local', 'bin', 'antigravity'),
      path.join(os.homedir(), '.local', 'bin', 'agy'),
    ]) {
      pushIfExists(candidates, candidate);
    }
  }

  if (commandExists('antigravity')) candidates.push('antigravity');
  if (commandExists('agy')) candidates.push('agy');

  return [...new Set(candidates)];
}

function resolveIdeLauncher(): string | null {
  const candidates = getIdeLauncherCandidates();
  return candidates.length > 0 ? candidates[0] : null;
}

function getGeminiProjectsDir(): string {
  return path.join(os.homedir(), '.gemini', 'config', 'projects');
}

function getAppStoragePath(): string {
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'Antigravity', 'app_storage.json');
  }
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(localAppData, 'Antigravity', 'app_storage.json');
  }
  return path.join(os.homedir(), '.config', 'Antigravity', 'app_storage.json');
}

function toFolderUri(absPath: string): string {
  return pathToFileURL(absPath).href;
}

function normalizeFolderUri(uri: string): string {
  try {
    const parsed = new URL(uri);
    if (parsed.protocol === 'file:') {
      return path.resolve(decodeURIComponent(parsed.pathname));
    }
  } catch {
    // fall through
  }
  return uri.replace(/\/+$/, '');
}

function readResourceFolderUri(resource: Record<string, unknown>): string | null {
  for (const key of ['gitFolder', 'localFolder', 'folder']) {
    const entry = resource[key];
    if (entry && typeof entry === 'object' && 'folderUri' in entry) {
      const folderUri = (entry as { folderUri?: string }).folderUri;
      if (typeof folderUri === 'string') return folderUri;
    }
  }
  return null;
}

function detectDefaultBranch(folderPath: string): string | undefined {
  const headPath = path.join(folderPath, '.git', 'HEAD');
  if (!fs.existsSync(headPath)) return undefined;
  try {
    const head = fs.readFileSync(headPath, 'utf-8').trim();
    if (head.startsWith('ref: refs/heads/')) {
      return head.replace('ref: refs/heads/', '');
    }
  } catch {
    // ignore
  }
  return 'main';
}

function findExistingProjectId(folderUri: string): string | null {
  const projectsDir = getGeminiProjectsDir();
  if (!fs.existsSync(projectsDir)) return null;

  const targetPath = normalizeFolderUri(folderUri);
  for (const file of fs.readdirSync(projectsDir)) {
    if (!file.endsWith('.json')) continue;
    try {
      const data = JSON.parse(fs.readFileSync(path.join(projectsDir, file), 'utf-8'));
      const resources: unknown[] = data?.projectResources?.resources ?? [];
      for (const resource of resources) {
        if (!resource || typeof resource !== 'object') continue;
        const uri = readResourceFolderUri(resource as Record<string, unknown>);
        if (uri && normalizeFolderUri(uri) === targetPath) {
          return typeof data.id === 'string' ? data.id : null;
        }
      }
    } catch {
      // skip invalid project files
    }
  }
  return null;
}

function writeProjectRegistryEntry(
  projectId: string,
  projectName: string,
  folderUri: string,
  folderPath: string,
): void {
  const projectsDir = getGeminiProjectsDir();
  fs.mkdirSync(projectsDir, { recursive: true });

  const gitFolder: Record<string, string> = { folderUri };
  const defaultBranch = detectDefaultBranch(folderPath);
  if (defaultBranch) {
    gitFolder.defaultBranch = defaultBranch;
  }

  const projectJson = {
    id: projectId,
    name: projectName,
    projectResources: {
      resources: [{ gitFolder }],
    },
    settings: { ...DEFAULT_PROJECT_SETTINGS },
  };

  fs.writeFileSync(
    path.join(projectsDir, `${projectId}.json`),
    `${JSON.stringify(projectJson, null, 2)}\n`,
    'utf-8',
  );
}

function setLastCreatedProjectId(projectId: string): void {
  const storagePath = getAppStoragePath();
  fs.mkdirSync(path.dirname(storagePath), { recursive: true });

  let data: Record<string, unknown> = {};
  if (fs.existsSync(storagePath)) {
    try {
      data = JSON.parse(fs.readFileSync(storagePath, 'utf-8'));
    } catch {
      data = {};
    }
  }

  data.lastCreatedProjectId = projectId;
  fs.writeFileSync(storagePath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
}

/** Register (or reuse) an Antigravity 2.0 project pointing at folderPath. */
export function registerAntigravityProject(
  folderPath: string,
  projectName: string,
): { projectId: string; folderUri: string; created: boolean } {
  const resolvedPath = path.resolve(folderPath);
  const folderUri = toFolderUri(resolvedPath);
  const existingId = findExistingProjectId(folderUri);

  if (existingId) {
    writeProjectRegistryEntry(existingId, projectName, folderUri, resolvedPath);
    setLastCreatedProjectId(existingId);
    return { projectId: existingId, folderUri, created: false };
  }

  const projectId = randomUUID();
  writeProjectRegistryEntry(projectId, projectName, folderUri, resolvedPath);
  setLastCreatedProjectId(projectId);
  return { projectId, folderUri, created: true };
}

function getMacAppNames(): string[] {
  const names: string[] = [];
  for (const appName of ['Antigravity.app', 'Antigravity IDE.app']) {
    if (fs.existsSync(`/Applications/${appName}`)) {
      names.push(appName.replace('.app', ''));
    }
  }
  return names;
}

function getDesktopExecutable(): string | null {
  if (process.platform === 'darwin') {
    const exe = '/Applications/Antigravity.app/Contents/MacOS/Antigravity';
    return fs.existsSync(exe) ? exe : null;
  }

  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || '';
    const candidates = [
      path.join(localAppData, 'Programs', 'Antigravity', 'Antigravity.exe'),
      path.join(localAppData, 'Programs', 'Antigravity', 'Antigravity IDE.exe'),
      path.join(localAppData, 'Programs', 'Antigravity IDE', 'Antigravity IDE.exe'),
      path.join(localAppData, 'Programs', 'antigravity', 'Antigravity.exe'),
    ];
    return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
  }

  return null;
}

function getAntigravityAppPath(): string | null {
  if (process.platform === 'darwin') {
    for (const appName of ['Antigravity.app', 'Antigravity IDE.app']) {
      const appPath = `/Applications/${appName}`;
      if (fs.existsSync(appPath)) return appPath;
    }
    return null;
  }

  return getDesktopExecutable();
}

export function isAntigravityAvailable(): boolean {
  if (resolveIdeLauncher()) return true;
  return getAntigravityAppPath() !== null;
}

export async function openAntigravityInstallPage(): Promise<{ success: boolean; error?: string }> {
  try {
    await shell.openExternal(ANTIGRAVITY_INSTALL_URL);
    return { success: true };
  } catch (error: any) {
    console.error('[open-antigravity] Failed to open install page:', error);
    return { success: false, error: error.message || String(error) };
  }
}

function buildLaunchEnv(port: number, url: string, mode: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    EGDESK_DEV_PORT: String(port),
    EGDESK_DEV_URL: url,
    EGDESK_DEV_MODE: mode,
  };
}

function spawnDetached(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  useShell = false,
): { pid?: number } {
  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
    shell: useShell,
    env,
  });
  child.on('error', (error) => {
    console.error(`[open-antigravity] Launch error (${command}):`, error);
  });
  child.unref();
  return { pid: child.pid };
}

function launchWithIdeBinary(
  launcher: string,
  resolvedPath: string,
  env: NodeJS.ProcessEnv,
): AntigravityOpenResult {
  const args = ['--new-window', resolvedPath];
  const useShell = process.platform === 'win32' && launcher.endsWith('.cmd');
  const method = `${launcher} ${args.join(' ')}`;

  try {
    console.log(`[open-antigravity] Launching IDE: ${method}`);
    const { pid } = spawnDetached(launcher, args, env, useShell);
    console.log(`[open-antigravity] IDE launch spawned (pid=${pid ?? 'unknown'})`);
    return { success: true, method };
  } catch (error: any) {
    console.warn('[open-antigravity] IDE launcher failed:', launcher, error);
    return { success: false, error: error.message || String(error) };
  }
}

function launchAntigravityDesktop(
  projectId: string,
  env: NodeJS.ProcessEnv,
): Promise<AntigravityOpenResult> {
  const running = isAntigravityRunning();
  const method = running ? 'open -a "Antigravity" (focus)' : 'open -a "Antigravity" (launch)';

  return launchAntigravityApp(env)
    .then(({ pid }) => {
      console.log(
        `[open-antigravity] Desktop ${running ? 'focus' : 'launch'} spawned (pid=${pid ?? 'unknown'}, projectId=${projectId})`,
      );
      return { success: true, method, projectId };
    })
    .catch((error: any) => ({
      success: false,
      error: error.message || String(error),
    }));
}

function buildContextMarkdown(options: Required<Pick<AntigravityOpenOptions, 'port' | 'mode' | 'url'>> & {
  projectName?: string;
}): string {
  const modeLabel = options.mode === 'dev' ? 'coding (dev)' : 'hosting (production)';
  const hostingNote =
    options.mode === 'dev'
      ? `- Do **not** assume the default Next.js port 3000 — EGDesk coding uses the **${CODING_PORTS.dev.range.start}–${CODING_PORTS.dev.range.end}** range.`
      : `- Production/hosting mode uses the **${CODING_PORTS.production.range.start}–${CODING_PORTS.production.range.end}** range (default ${CODING_PORTS.production.preferred}).`;

  return `# EGDesk Development Context

This project was opened from **EGDesk**. The local dev server port is managed by EGDesk — use the values below.

## Active server

- **Dev server port:** ${options.port}
- **Local preview URL:** ${options.url}
- **Server mode:** ${modeLabel}
${options.projectName ? `- **Project:** ${options.projectName}\n` : ''}- **EGDesk MCP/API:** http://localhost:8080

## Rules for agents

${hostingNote}
- When running \`npm run dev\`, \`next dev\`, or opening the app in a browser, use **port ${options.port}** (\`${options.url}\`).
- Do not start a second dev server on a different port unless the user asks.
- EGDesk user-data helpers talk to MCP at \`http://localhost:8080\` (see \`egdesk-helpers.ts\` / \`.env.local\`).

_Updated automatically by EGDesk when this project is opened._
`;
}

function buildAgentsSection(options: Required<Pick<AntigravityOpenOptions, 'port' | 'mode' | 'url'>>): string {
  const modeLabel = options.mode === 'dev' ? 'coding (dev)' : 'hosting (production)';
  return [
    EGDESK_CONTEXT_BEGIN,
    '## EGDesk Development Context',
    '',
    `EGDesk opened this project with the dev server on **port ${options.port}** (${options.url}, ${modeLabel}).`,
    `Do not assume port 3000. Use port ${options.port} for local preview and dev commands.`,
    'EGDesk MCP/API runs at http://localhost:8080.',
    '',
    'See `.agents/rules/egdesk-dev-context.md` for full details.',
    EGDESK_CONTEXT_END,
  ].join('\n');
}

export function writeAntigravityContext(
  folderPath: string,
  options: Pick<AntigravityOpenOptions, 'port' | 'mode' | 'url' | 'projectName'>,
): void {
  const port = options.port ?? CODING_PORTS.dev.preferred;
  const mode = options.mode ?? 'dev';
  const url = options.url ?? `http://localhost:${port}`;
  const normalized = { port, mode, url, projectName: options.projectName };

  const rulesDir = path.join(folderPath, '.agents', 'rules');
  fs.mkdirSync(rulesDir, { recursive: true });
  fs.writeFileSync(
    path.join(rulesDir, 'egdesk-dev-context.md'),
    buildContextMarkdown(normalized),
    'utf-8',
  );

  const agentsPath = path.join(folderPath, 'AGENTS.md');
  const section = buildAgentsSection({ port, mode, url });
  const sectionRegex = new RegExp(
    `${EGDESK_CONTEXT_BEGIN}[\\s\\S]*?${EGDESK_CONTEXT_END}\\n?`,
    'g',
  );

  if (fs.existsSync(agentsPath)) {
    const existing = fs.readFileSync(agentsPath, 'utf-8');
    const stripped = existing.replace(sectionRegex, '').trimEnd();
    const separator = stripped.length > 0 ? '\n\n' : '';
    fs.writeFileSync(agentsPath, `${stripped}${separator}${section}\n`, 'utf-8');
  } else {
    fs.writeFileSync(
      agentsPath,
      `# Project Agent Rules\n\n${section}\n`,
      'utf-8',
    );
  }
}

export async function openAntigravityFolder(
  options: AntigravityOpenOptions,
): Promise<AntigravityOpenResult> {
  const { folderPath } = options;
  if (!folderPath || !fs.existsSync(folderPath)) {
    return { success: false, error: 'Project folder not found' };
  }

  const resolvedPath = path.resolve(folderPath);
  const port = options.port ?? CODING_PORTS.dev.preferred;
  const mode = options.mode ?? 'dev';
  const url = options.url ?? `http://localhost:${port}`;
  const projectName = options.projectName ?? path.basename(resolvedPath);
  const launchEnv = buildLaunchEnv(port, url, mode);

  writeAntigravityContext(resolvedPath, { port, mode, url, projectName });

  if (!isAntigravityAvailable()) {
    return {
      success: false,
      error: 'Antigravity is not installed.',
      needsInstall: true,
    };
  }

  const { projectId, folderUri } = registerAntigravityProject(resolvedPath, projectName);
  console.log(`[open-antigravity] Registered project ${projectId} → ${resolvedPath}`);

  let egdeskChatCascadeId: string | undefined;
  let egdeskChatNeedsActivation = false;
  let egdeskChatActivated = false;
  let egdeskChatError: string | undefined;

  const egdeskChatContext = {
    projectId,
    projectName,
    folderUri,
    folderPath: resolvedPath,
    port,
    url,
    mode,
  };

  try {
    sanitizeSessionMeta();
    const repaired = repairAgyHubSummaries();
    if (repaired.dropped > 0) {
      console.log(`[open-antigravity] Repaired hub file (kept ${repaired.kept}, dropped ${repaired.dropped})`);
    }

    const isolation = isolateConversationsForFolder(resolvedPath, projectId);
    if (isolation.archived.length > 0) {
      console.log(`[open-antigravity] Archived other-project conversations: ${isolation.archived.join(', ')}`);
    }
    if (isolation.restored.length > 0) {
      console.log(`[open-antigravity] Restored conversations: ${isolation.restored.join(', ')}`);
    }

    cleanupOrphanEgdeskChatStubs(projectId);
  } catch (error: any) {
    console.warn('[open-antigravity] Failed to prepare Antigravity session:', error);
  }

  const buildResult = (result: AntigravityOpenResult): AntigravityOpenResult => ({
    ...result,
    port,
    projectId,
    egdeskChatCascadeId,
    egdeskChatNeedsActivation,
    egdeskChatActivated,
    egdeskChatError,
  });

  const finishOpen = async (result: AntigravityOpenResult): Promise<AntigravityOpenResult> => {
    if (!result.success) return buildResult(result);

    try {
      const egdeskChat = await registerEgdeskChatHistory(egdeskChatContext);
      egdeskChatCascadeId = egdeskChat.cascadeId;
      egdeskChatActivated = true;
      egdeskChatNeedsActivation = false;
      egdeskChatError = egdeskChat.error;

      console.log(
        egdeskChat.hubLinked
          ? `[open-antigravity] Inserted linked "${EGDesk_CHAT_TITLE}" under ${projectName} (cascade=${egdeskChat.cascadeId})`
          : `[open-antigravity] Inserted "${EGDesk_CHAT_TITLE}" — hub link pending, restart Antigravity if sidebar missing (cascade=${egdeskChat.cascadeId})`,
      );
    } catch (error: any) {
      egdeskChatNeedsActivation = true;
      egdeskChatActivated = false;
      egdeskChatError = error.message || String(error);
      console.warn('[open-antigravity] Failed to activate egdesk-chat via language server:', error);
    }

    return buildResult(result);
  };

  const ideLauncher = resolveIdeLauncher();
  const desktopExecutable = getDesktopExecutable();
  console.log(
    `[open-antigravity] Launchers: ide=${ideLauncher ?? 'none'}, desktop=${desktopExecutable ?? 'none'}`,
  );

  if (ideLauncher) {
    const result = launchWithIdeBinary(ideLauncher, resolvedPath, launchEnv);
    if (result.success) {
      console.log(`[open-antigravity] Opened via IDE (${result.method})`);
      return finishOpen({ ...result, port, projectId, egdeskChatCascadeId, egdeskChatNeedsActivation, egdeskChatActivated, egdeskChatError });
    }
    console.warn('[open-antigravity] IDE launch failed, trying desktop…', result.error);
  }

  const desktopResult = await launchAntigravityDesktop(projectId, launchEnv);
  if (desktopResult.success) {
    console.log(`[open-antigravity] Opened via desktop (${desktopResult.method})`);
    return finishOpen({ ...desktopResult, port, projectId, egdeskChatCascadeId, egdeskChatNeedsActivation, egdeskChatActivated, egdeskChatError });
  }

  console.error('[open-antigravity] All launch attempts failed:', desktopResult.error);
  return {
    success: false,
    error: desktopResult.error || 'Failed to launch Antigravity.',
    needsInstall: !isAntigravityAvailable(),
  };
}

export function registerOpenAntigravityHandlers(): void {
  ipcMain.handle('coding:check-antigravity', async () => ({
    available: isAntigravityAvailable(),
    installUrl: ANTIGRAVITY_INSTALL_URL,
    launcher: resolveIdeLauncher(),
    desktopExecutable: getDesktopExecutable(),
  }));

  ipcMain.handle('coding:open-antigravity-install', async () => openAntigravityInstallPage());

  ipcMain.handle('coding:open-antigravity', async (_event, arg: AntigravityOpenOptions | string) => {
    try {
      const options: AntigravityOpenOptions =
        typeof arg === 'string' ? { folderPath: arg } : arg;
      return await openAntigravityFolder(options);
    } catch (error: any) {
      console.error('[coding:open-antigravity] Error:', error);
      return { success: false, error: error.message || String(error) };
    }
  });
}
