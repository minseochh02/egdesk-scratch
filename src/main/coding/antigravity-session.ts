import { randomUUID } from 'crypto';
import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { findCascadeIdsForProject, isCascadeUuid, parseCascadeIdFromHubEntry } from './agyhub-summaries';

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
 * Hide other projects' conversations while restoring all conversations for folderPath.
 * Never archives cascades tied to projectId via hub index or EGDesk meta.
 */
export function isolateConversationsForFolder(
  folderPath: string,
  projectId?: string,
): { archived: string[]; restored: string[] } {
  const archived: string[] = [];
  const restored: string[] = [];
  const conversationsDir = getConversationsDir();
  const archiveRoot = getArchiveDir();

  const protectedIds = new Set<string>();
  if (projectId) {
    const meta = readMetaStore()[projectId];
    const metaCascade = meta?.egdeskChatCascadeId ?? meta?.cascadeId;
    if (metaCascade && isCascadeUuid(metaCascade)) {
      protectedIds.add(metaCascade);
    }
    for (const cascadeId of findCascadeIdsForProject(projectId)) {
      protectedIds.add(cascadeId);
    }
  }
  for (const cascadeId of findCascadeIdsForFolder(folderPath)) {
    protectedIds.add(cascadeId);
  }

  fs.mkdirSync(conversationsDir, { recursive: true });
  fs.mkdirSync(archiveRoot, { recursive: true });

  // Restore every archived conversation for this folder.
  if (fs.existsSync(archiveRoot)) {
    for (const cascadeId of fs.readdirSync(archiveRoot)) {
      const belongsToFolder = cascadeBelongsToFolder(cascadeId, folderPath);
      const isProtected = protectedIds.has(cascadeId);
      if (!belongsToFolder && !isProtected) continue;
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

  // Archive live conversations that belong to other projects only.
  if (fs.existsSync(conversationsDir)) {
    for (const file of fs.readdirSync(conversationsDir)) {
      if (!file.endsWith('.pb') && !file.endsWith('.db')) continue;
      const cascadeId = file.replace(/\.(pb|db)$/, '');
      if (protectedIds.has(cascadeId)) continue;
      if (cascadeBelongsToFolder(cascadeId, folderPath)) continue;

      const livePath = path.join(conversationsDir, file);
      const archivePath = path.join(getArchiveDir(), cascadeId, file);
      movePath(livePath, archivePath);
      if (!archived.includes(cascadeId)) archived.push(cascadeId);
    }
  }

  return { archived, restored };
}

export function isAntigravityRunning(): boolean {
  if (process.platform !== 'darwin') return false;
  try {
    execSync('pgrep -x Antigravity', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/** Quit Antigravity so the next launch re-reads hub + conversation state from disk. */
export function quitAntigravity(): Promise<void> {
  if (!isAntigravityRunning()) return Promise.resolve();

  return new Promise((resolve) => {
    console.log('[open-antigravity] Quitting running Antigravity before relaunch…');
    try {
      execSync('osascript -e \'tell application "Antigravity" to quit\'', { stdio: 'ignore' });
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

/** Focus Antigravity without quitting — preserves in-memory LS state. */
export function launchAntigravityApp(env: NodeJS.ProcessEnv): Promise<{ pid?: number }> {
  return new Promise((resolve, reject) => {
    const appName = process.platform === 'darwin' ? 'Antigravity' : 'Antigravity';
    const child = spawn('open', ['-a', appName], {
      detached: true,
      stdio: 'ignore',
      env,
    });
    child.on('error', reject);
    child.unref();
    resolve({ pid: child.pid });
  });
}
