import { randomUUID } from 'crypto';
import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { isCascadeUuid, parseCascadeIdFromHubEntry } from './agyhub-summaries';

const META_PATH = path.join(os.homedir(), '.gemini', 'config', 'egdesk-antigravity-meta.json');

interface ProjectSessionMeta {
  /** Dedicated EGDesk context thread in Antigravity. */
  egdeskChatCascadeId?: string;
  /** @deprecated Legacy focus cascade — prefer egdeskChatCascadeId */
  cascadeId?: string;
  folderPath: string;
  updatedAt: string;
}

type MetaStore = Record<string, ProjectSessionMeta>;

function getAntigravityRoot(): string {
  return path.join(os.homedir(), '.gemini', 'antigravity');
}

function getConversationsDir(): string {
  return path.join(getAntigravityRoot(), 'conversations');
}

function getArchiveDir(): string {
  return path.join(getConversationsDir(), '.egdesk-archived');
}

function getBrainDir(): string {
  return path.join(getAntigravityRoot(), 'brain');
}

function readMetaStore(): MetaStore {
  if (!fs.existsSync(META_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(META_PATH, 'utf-8')) as MetaStore;
  } catch {
    return {};
  }
}

function writeMetaStore(store: MetaStore): void {
  fs.mkdirSync(path.dirname(META_PATH), { recursive: true });
  fs.writeFileSync(META_PATH, `${JSON.stringify(store, null, 2)}\n`, 'utf-8');
}

function movePath(from: string, to: string): void {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  if (fs.existsSync(to)) fs.rmSync(to, { force: true });
  fs.renameSync(from, to);
}

function transcriptPath(cascadeId: string): string {
  return path.join(
    getBrainDir(),
    cascadeId,
    '.system_generated',
    'logs',
    'transcript.jsonl',
  );
}

/** True if this cascade has brain logs referencing folderPath. */
export function cascadeBelongsToFolder(cascadeId: string, folderPath: string): boolean {
  const normalized = path.resolve(folderPath);
  const basename = path.basename(normalized);
  const transcript = transcriptPath(cascadeId);
  if (!fs.existsSync(transcript)) return false;
  try {
    const content = fs.readFileSync(transcript, 'utf-8');
    return content.includes(normalized) || content.includes(basename);
  } catch {
    return false;
  }
}

function conversationPbPath(cascadeId: string): string {
  return path.join(getConversationsDir(), `${cascadeId}.pb`);
}

function conversationDbPath(cascadeId: string): string {
  return path.join(getConversationsDir(), `${cascadeId}.db`);
}

function archivedConversationPbPath(cascadeId: string): string {
  return path.join(getArchiveDir(), cascadeId, `${cascadeId}.pb`);
}

function archivedConversationDbPath(cascadeId: string): string {
  return path.join(getArchiveDir(), cascadeId, `${cascadeId}.db`);
}

function getCascadeActivityMtime(cascadeId: string): number {
  let mtime = 0;
  for (const candidate of [
    conversationPbPath(cascadeId),
    conversationDbPath(cascadeId),
    archivedConversationPbPath(cascadeId),
    archivedConversationDbPath(cascadeId),
    transcriptPath(cascadeId),
  ]) {
    if (!fs.existsSync(candidate)) continue;
    try {
      mtime = Math.max(mtime, fs.statSync(candidate).mtimeMs);
    } catch {
      // skip
    }
  }
  return mtime;
}

/** All cascade ids Antigravity has ever used for this folder (brain / live / archived). */
export function findCascadeIdsForFolder(folderPath: string): string[] {
  const ids = new Set<string>();
  const brainDir = getBrainDir();

  if (fs.existsSync(brainDir)) {
    for (const cascadeId of fs.readdirSync(brainDir)) {
      if (cascadeBelongsToFolder(cascadeId, folderPath)) ids.add(cascadeId);
    }
  }

  const conversationsDir = getConversationsDir();
  if (fs.existsSync(conversationsDir)) {
    for (const file of fs.readdirSync(conversationsDir)) {
      if (!file.endsWith('.pb') && !file.endsWith('.db')) continue;
      const cascadeId = file.replace(/\.(pb|db)$/, '');
      if (cascadeBelongsToFolder(cascadeId, folderPath)) ids.add(cascadeId);
    }
  }

  const archiveRoot = getArchiveDir();
  if (fs.existsSync(archiveRoot)) {
    for (const cascadeId of fs.readdirSync(archiveRoot)) {
      if (cascadeBelongsToFolder(cascadeId, folderPath)) ids.add(cascadeId);
    }
  }

  return [...ids];
}

/** Pick the most recently active cascade for this folder, or null if none exist. */
export function resolveExistingCascadeId(folderPath: string): string | null {
  const candidates = findCascadeIdsForFolder(folderPath);
  if (candidates.length === 0) return null;

  return candidates.sort(
    (a, b) => getCascadeActivityMtime(b) - getCascadeActivityMtime(a),
  )[0];
}

export function resolveCascadeId(
  projectId: string,
  folderPath: string,
  previousHubEntry?: Buffer,
): string {
  const existingForFolder = resolveExistingCascadeId(folderPath);
  if (existingForFolder) return existingForFolder;

  const meta = readMetaStore();
  const stored = meta[projectId];
  const storedCascade = stored?.egdeskChatCascadeId ?? stored?.cascadeId;
  if (storedCascade && isCascadeUuid(storedCascade) && stored?.folderPath === path.resolve(folderPath)) {
    return storedCascade;
  }

  const fromHub = previousHubEntry ? parseCascadeIdFromHubEntry(previousHubEntry) : null;
  if (fromHub) return fromHub;

  return randomUUID();
}

export function sanitizeSessionMeta(): void {
  const store = readMetaStore();
  let changed = false;
  for (const [projectId, meta] of Object.entries(store)) {
    const cascade = meta.egdeskChatCascadeId ?? meta.cascadeId;
    if (cascade && !isCascadeUuid(cascade)) {
      delete store[projectId];
      changed = true;
    }
  }
  if (changed) writeMetaStore(store);
}

export function clearEgdeskChatCascadeId(projectId: string): void {
  const store = readMetaStore();
  if (!store[projectId]) return;
  delete store[projectId];
  writeMetaStore(store);
}

export function getEgdeskChatCascadeId(projectId: string): string | null {
  const meta = readMetaStore()[projectId];
  const id = meta?.egdeskChatCascadeId ?? meta?.cascadeId;
  return id && isCascadeUuid(id) ? id : null;
}

export function saveEgdeskChatCascadeId(
  projectId: string,
  cascadeId: string,
  folderPath: string,
): void {
  const store = readMetaStore();
  store[projectId] = {
    egdeskChatCascadeId: cascadeId,
    folderPath: path.resolve(folderPath),
    updatedAt: new Date().toISOString(),
  };
  writeMetaStore(store);
}

export function saveProjectSessionMeta(
  projectId: string,
  cascadeId: string,
  folderPath: string,
): void {
  saveEgdeskChatCascadeId(projectId, cascadeId, folderPath);
}

/**
 * Restore any previously archived conversations and leave all live conversations
 * in place. We no longer archive by project: archiving removes .db/.pb files while
 * leaving hub entries intact, which causes Antigravity to show "trajectory not found"
 * whenever the user navigates to a different project inside Antigravity without going
 * back through EGDesk first.
 */
export function isolateConversationsForFolder(
  folderPath: string,
  projectId?: string,
): { archived: string[]; restored: string[] } {
  const archived: string[] = [];
  const restored: string[] = [];
  const conversationsDir = getConversationsDir();
  const archiveRoot = getArchiveDir();

  fs.mkdirSync(conversationsDir, { recursive: true });

  // Restore everything that was previously archived so Antigravity can load it.
  if (fs.existsSync(archiveRoot)) {
    for (const cascadeId of fs.readdirSync(archiveRoot)) {
      for (const ext of ['pb', 'db'] as const) {
        const from = ext === 'pb'
          ? archivedConversationPbPath(cascadeId)
          : archivedConversationDbPath(cascadeId);
        const to = ext === 'pb' ? conversationPbPath(cascadeId) : conversationDbPath(cascadeId);
        if (fs.existsSync(from) && !fs.existsSync(to)) {
          movePath(from, to);
          if (!restored.includes(cascadeId)) restored.push(cascadeId);
        }
      }
    }
  }

  return { archived, restored };
}

const WINDOWS_PROCESS_NAMES = ['Antigravity.exe', 'Antigravity IDE.exe'] as const;

/** Resolve Antigravity 2.0 desktop executable for the current platform. */
export function getAntigravityDesktopExecutable(): string | null {
  if (process.platform === 'darwin') {
    for (const appName of ['Antigravity.app', 'Antigravity IDE.app']) {
      const exe = `/Applications/${appName}/Contents/MacOS/Antigravity`;
      if (fs.existsSync(exe)) return exe;
    }
    return null;
  }

  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
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

function isWindowsProcessRunning(): boolean {
  for (const imageName of WINDOWS_PROCESS_NAMES) {
    try {
      const output = execSync(`tasklist /FI "IMAGENAME eq ${imageName}" /FO CSV /NH`, {
        encoding: 'utf-8',
        windowsHide: true,
      });
      if (output.toLowerCase().includes(imageName.toLowerCase())) {
        return true;
      }
    } catch {
      // not running or tasklist unavailable
    }
  }
  return false;
}

function quitWindowsAntigravity(): void {
  for (const imageName of WINDOWS_PROCESS_NAMES) {
    try {
      execSync(`taskkill /IM "${imageName}" /T`, { stdio: 'ignore', windowsHide: true });
    } catch {
      // already exited
    }
  }
}

export function isAntigravityRunning(): boolean {
  if (process.platform === 'darwin') {
    try {
      execSync('pgrep -x Antigravity', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  if (process.platform === 'win32') {
    return isWindowsProcessRunning();
  }

  return false;
}

/** Quit Antigravity so the next launch re-reads hub + conversation state from disk. */
export function quitAntigravity(): Promise<void> {
  if (!isAntigravityRunning()) return Promise.resolve();

  return new Promise((resolve) => {
    console.log('[open-antigravity] Quitting running Antigravity before relaunch…');
    try {
      if (process.platform === 'darwin') {
        execSync('osascript -e \'tell application "Antigravity" to quit\'', { stdio: 'ignore' });
      } else if (process.platform === 'win32') {
        quitWindowsAntigravity();
      }
    } catch {
      // ignore
    }

    const started = Date.now();
    const poll = (): void => {
      if (!isAntigravityRunning() || Date.now() - started > 8000) {
        resolve();
        return;
      }
      setTimeout(poll, 200);
    };
    setTimeout(poll, 300);
  });
}

export async function relaunchAntigravity(env: NodeJS.ProcessEnv): Promise<{ pid?: number }> {
  await quitAntigravity();

  return launchAntigravityApp(env);
}

/** Launch or focus Antigravity desktop without quitting — preserves in-memory LS state. */
export function launchAntigravityApp(env: NodeJS.ProcessEnv): Promise<{ pid?: number }> {
  return new Promise((resolve, reject) => {
    if (process.platform === 'darwin') {
      const child = spawn('open', ['-a', 'Antigravity'], {
        detached: true,
        stdio: 'ignore',
        env,
      });
      child.on('error', reject);
      child.unref();
      resolve({ pid: child.pid });
      return;
    }

    if (process.platform === 'win32') {
      const executable = getAntigravityDesktopExecutable();
      if (!executable) {
        reject(new Error('Antigravity desktop executable not found'));
        return;
      }
      const child = spawn(executable, [], {
        detached: true,
        stdio: 'ignore',
        env,
        windowsHide: true,
      });
      child.on('error', reject);
      child.unref();
      resolve({ pid: child.pid });
      return;
    }

    reject(new Error(`Antigravity desktop launch is not supported on ${process.platform}`));
  });
}
