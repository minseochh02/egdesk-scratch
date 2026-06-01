import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import Database from 'better-sqlite3';
import {
  findCascadeIdsForProject,
  findHubEntryForCascade,
  isHubEntryLinkedToProject,
  parseHubTitleFromHubEntry,
  reorderHubEntryToFront,
  removeHubEntryForCascade,
  upsertAgyHubSummary,
} from './agyhub-summaries';
import {
  addTrackedWorkspace,
  startCascade,
  waitForLanguageServerReady,
  type LanguageServerEndpoint,
} from './antigravity-language-server';
import {
  clearEgdeskChatCascadeId,
  getEgdeskChatCascadeId,
  isAntigravityRunning,
  saveEgdeskChatCascadeId,
} from './antigravity-session';

export const EGDesk_CHAT_TITLE = 'egdesk-chat';

export interface EgdeskChatContext {
  projectId: string;
  projectName: string;
  folderUri: string;
  folderPath: string;
  port: number;
  url: string;
  mode: 'dev' | 'production';
}

export interface EgdeskChatRegistrationResult {
  cascadeId: string;
  created: boolean;
  hubLinked: boolean;
  /** True when the cascade was registered with the running LS (has a server-side trajectory). */
  lsRegistered: boolean;
  error?: string;
}

function getAntigravityRoot(): string {
  return path.join(os.homedir(), '.gemini', 'antigravity');
}

function brainTranscriptPath(cascadeId: string): string {
  return path.join(
    getAntigravityRoot(),
    'brain',
    cascadeId,
    '.system_generated',
    'logs',
    'transcript.jsonl',
  );
}

export function hasEgdeskChatHistory(cascadeId: string): boolean {
  return fs.existsSync(brainTranscriptPath(cascadeId));
}

function hasConversationDb(cascadeId: string): boolean {
  return fs.existsSync(path.join(getAntigravityRoot(), 'conversations', `${cascadeId}.db`));
}

function hubHasEgdeskChatTitle(cascadeId: string): boolean {
  const entry = findHubEntryForCascade(cascadeId);
  if (!entry) return false;
  const title = parseHubTitleFromHubEntry(entry);
  return title === EGDesk_CHAT_TITLE || entry.includes(Buffer.from(EGDesk_CHAT_TITLE, 'utf-8'));
}

/** Hub row must include both project registry id and egdesk-chat title to nest under the project. */
export function isEgdeskChatHubLinked(cascadeId: string, projectId: string): boolean {
  return isHubEntryLinkedToProject(cascadeId, projectId) && hubHasEgdeskChatTitle(cascadeId);
}

export function buildEgdeskSeedUserMessage(context: EgdeskChatContext): string {
  const modeLabel = context.mode === 'dev' ? 'coding (dev)' : 'hosting (production)';
  return [
    `Hello! I just opened "${context.projectName}" in EGDesk.`,
    '',
    `Dev server: ${context.url} (port ${context.port}, ${modeLabel})`,
    'Do not use port 3000 for this project.',
    '',
    'For EGDesk user-data and MCP calls, use `egdesk-helpers.ts` in the project root',
    '(e.g. queryTable, searchTable) — it proxies to http://localhost:8080.',
    '',
    'Just reply "Got it, I\'m ready to help!" — no actions needed.',
  ].join('\n');
}

export function buildEgdeskSeedAgentMessage(context: EgdeskChatContext): string {
  return [
    "Got it, I'm ready to help!",
    '',
    `Dev server: ${context.url} (port ${context.port}).`,
    'I will use `egdesk-helpers.ts` for EGDesk MCP/user-data when needed.',
  ].join('\n');
}

function buildEgdeskChatTranscriptLines(context: EgdeskChatContext, createdAt: string): string {
  const userRequest = buildEgdeskSeedUserMessage(context);
  // Only write the user seed message — the real AI response comes via SendUserCascadeMessage
  // after Antigravity relaunches. Keeping this minimal avoids a stale/fake model reply.
  const lines = [
    {
      step_index: 0,
      source: 'USER_EXPLICIT',
      type: 'USER_INPUT',
      status: 'DONE',
      created_at: createdAt,
      content: [
        `<USER_REQUEST>\n${userRequest}\n</USER_REQUEST>`,
        '<ADDITIONAL_METADATA>',
        `Registered by EGDesk at ${createdAt}.`,
        '</ADDITIONAL_METADATA>',
      ].join('\n'),
    },
    {
      step_index: 1,
      source: 'SYSTEM',
      type: 'CONVERSATION_HISTORY',
      status: 'DONE',
      created_at: createdAt,
    },
  ];
  return `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`;
}

/** Insert brain transcript so Antigravity lists the thread in sidebar history. */
export function writeEgdeskChatHistory(context: EgdeskChatContext, cascadeId: string): void {
  const transcriptPath = brainTranscriptPath(cascadeId);
  const createdAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  fs.mkdirSync(path.dirname(transcriptPath), { recursive: true });
  fs.writeFileSync(transcriptPath, buildEgdeskChatTranscriptLines(context, createdAt), 'utf-8');
}

function refreshEgdeskChatHub(context: EgdeskChatContext, cascadeId: string): void {
  upsertAgyHubSummary({
    projectId: context.projectId,
    projectName: context.projectName,
    hubTitle: EGDesk_CHAT_TITLE,
    folderUri: context.folderUri,
    folderPath: context.folderPath,
    cascadeId,
  });
  reorderHubEntryToFront(cascadeId);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Register the cascade with the running LS via StartCascade so the LS creates its
 * trajectory state on disk. The new LS after relaunch will find it and serve the
 * conversation correctly. Only attempts LS registration if Antigravity is already
 * running — avoids a 20 s timeout on cold start.
 *
 * NOTE: do NOT call SendUserCascadeMessage after this — the LS rewrites the hub
 * entry during agent processing and strips the custom project link (field 17.18).
 */
async function registerCascadeWithLS(
  context: EgdeskChatContext,
  endpoint?: LanguageServerEndpoint,
): Promise<{ cascadeId: string; lsRegistered: boolean }> {
  if (!endpoint && !isAntigravityRunning()) {
    // LS is not up — fall back to a local UUID.  The thread will appear in the
    // sidebar (brain transcript exists) but won't load in the UI until a fresh
    // Antigravity session creates the trajectory on first user interaction.
    console.log('[egdesk-chat] Antigravity not running — using local cascade id');
    return { cascadeId: randomUUID(), lsRegistered: false };
  }
  try {
    const ls = endpoint ?? (await waitForLanguageServerReady(context.projectId, { timeoutMs: 10_000 }));
    await addTrackedWorkspace(ls, context.folderUri);
    const { cascadeId } = await startCascade(ls, {
      projectId: context.projectId,
      workspaceUris: [context.folderUri],
    });
    console.log(`[egdesk-chat] LS-registered cascade=${cascadeId}`);
    return { cascadeId, lsRegistered: true };
  } catch (error) {
    console.warn('[egdesk-chat] LS unavailable, using local cascade id:', error);
    return { cascadeId: randomUUID(), lsRegistered: false };
  }
}

/** Re-apply hub row until project link + title stick (Antigravity may reload hub asynchronously). */
export async function repairEgdeskChatHub(
  context: EgdeskChatContext,
  cascadeId: string,
): Promise<boolean> {
  for (const delayMs of [0, 300, 1000, 2500, 5000]) {
    if (delayMs > 0) await sleep(delayMs);
    refreshEgdeskChatHub(context, cascadeId);
    if (isEgdeskChatHubLinked(cascadeId, context.projectId)) {
      return true;
    }
  }
  return isEgdeskChatHubLinked(cascadeId, context.projectId);
}

/** Remove hub rows that never got a transcript OR a conversation db. */
export function cleanupOrphanEgdeskChatStubs(projectId: string): void {
  for (const cascadeId of findCascadeIdsForProject(projectId)) {
    if (!hubHasEgdeskChatTitle(cascadeId)) continue;
    if (hasEgdeskChatHistory(cascadeId)) continue;
    // Also guard on the .db file — if it exists the conversation has real content even
    // if the brain transcript was later overwritten or removed by Antigravity.
    if (hasConversationDb(cascadeId)) continue;
    if (removeHubEntryForCascade(cascadeId)) {
      console.log(`[egdesk-chat] Removed orphan hub stub cascade=${cascadeId}`);
    }
    if (getEgdeskChatCascadeId(projectId) === cascadeId) {
      clearEgdeskChatCascadeId(projectId);
    }
  }
}

/**
 * Insert a fresh egdesk-chat history row under this Antigravity project.
 * Always creates a new thread — does not open or focus it in the UI.
 */
export async function registerEgdeskChatHistory(
  context: EgdeskChatContext,
  endpoint?: LanguageServerEndpoint,
): Promise<EgdeskChatRegistrationResult> {
  cleanupOrphanEgdeskChatStubs(context.projectId);

  // Register with the running LS so it persists a trajectory to disk.
  // After Antigravity quits and relaunches, the new LS finds the trajectory and
  // serves the conversation correctly. We do NOT send a cascade message here —
  // SendUserCascadeMessage causes the LS to rewrite the hub entry and strips the
  // project link (field 17.18), making the thread appear under "all conversations"
  // instead of the project.
  const { cascadeId, lsRegistered } = await registerCascadeWithLS(context, endpoint);

  // Write our hub entry on top of whatever StartCascade wrote — this restores the
  // correct egdesk-chat title and project link that StartCascade strips.
  writeEgdeskChatHistory(context, cascadeId);
  refreshEgdeskChatHub(context, cascadeId);

  const hubLinked = await repairEgdeskChatHub(context, cascadeId);
  saveEgdeskChatCascadeId(context.projectId, cascadeId, context.folderPath);

  if (hubLinked) {
    console.log(
      `[egdesk-chat] Inserted linked "${EGDesk_CHAT_TITLE}" under ${context.projectName} (cascade=${cascadeId})`,
    );
  } else {
    console.warn(
      `[egdesk-chat] Inserted "${EGDesk_CHAT_TITLE}" but hub project link missing (cascade=${cascadeId}) — restart Antigravity to refresh sidebar`,
    );
  }

  return { cascadeId, created: true, hubLinked, lsRegistered };
}

/**
 * Run after Antigravity has been launched. Waits for the new LS to come up,
 * registers the cascade so Antigravity includes it in its hub rebuild, then
 * re-applies the project link (field 17.18) that StartCascade drops.
 *
 * When the cascade was created with a local UUID (LS timed out before launch),
 * it has no server-side trajectory. On Windows, Antigravity rebuilds its hub
 * entirely from LS state on startup — without an LS trajectory the cascade
 * never appears in the sidebar. This function fixes that by registering the
 * cascade with the freshly-started LS.
 *
 * Fire-and-forget: call without await and let errors be swallowed by the caller.
 */
export async function postLaunchRegistration(
  context: EgdeskChatContext,
  cascadeId: string,
  lsRegistered: boolean,
): Promise<void> {
  const ls = await waitForLanguageServerReady(context.projectId, { timeoutMs: 90_000 });

  let finalCascadeId = cascadeId;

  if (!lsRegistered) {
    // The cascade has no LS trajectory yet — register it now so Antigravity's
    // hub rebuild will include it. We pass cascadeId as a hint; some LS versions
    // honour it (returning the same ID), others ignore it (returning a new one).
    await addTrackedWorkspace(ls, context.folderUri);
    const { cascadeId: lsCascadeId } = await startCascade(ls, {
      projectId: context.projectId,
      workspaceUris: [context.folderUri],
      cascadeId,
    });
    finalCascadeId = lsCascadeId;

    if (finalCascadeId !== cascadeId) {
      // LS assigned a different cascade id — migrate all artifacts to the new id.
      console.log(`[egdesk-chat] LS assigned new cascade ${finalCascadeId} (was ${cascadeId}) — migrating`);
      writeEgdeskChatHistory(context, finalCascadeId);
      writeEgdeskChatConversation(
        finalCascadeId,
        buildEgdeskSeedUserMessage(context),
        buildEgdeskSeedAgentMessage(context),
      );
      removeHubEntryForCascade(cascadeId);
      const oldDb = path.join(os.homedir(), '.gemini', 'antigravity', 'conversations', `${cascadeId}.db`);
      if (fs.existsSync(oldDb)) {
        try { fs.rmSync(oldDb); } catch { /* best-effort */ }
      }
      saveEgdeskChatCascadeId(context.projectId, finalCascadeId, context.folderPath);
    }
  }

  // Re-apply the hub entry with the project link — StartCascade strips it.
  await repairEgdeskChatHub(context, finalCascadeId);
  console.log(`[egdesk-chat] Post-launch hub repair done (cascade=${finalCascadeId}, lsRegistered=${String(!lsRegistered && finalCascadeId !== cascadeId ? false : true)})`);
}

/** @deprecated */
export async function activateEgdeskChatThread(
  context: EgdeskChatContext,
  endpoint?: LanguageServerEndpoint,
): Promise<EgdeskChatRegistrationResult & { activated: boolean; needsActivation: boolean }> {
  const result = await registerEgdeskChatHistory(context, endpoint);
  return { ...result, lsRegistered: result.lsRegistered, activated: result.hubLinked, needsActivation: !result.hubLinked };
}

/** @deprecated */
export function refreshExistingEgdeskChatHub(_context: EgdeskChatContext): null {
  return null;
}

/** @deprecated */
export function cleanupBrokenEgdeskChatStub(projectId: string): null {
  cleanupOrphanEgdeskChatStubs(projectId);
  return null;
}

/** @deprecated */
export function conversationExists(cascadeId: string): boolean {
  return hasEgdeskChatHistory(cascadeId);
}

/** @deprecated */
export function isHealthyEgdeskConversation(cascadeId: string): boolean {
  return hasEgdeskChatHistory(cascadeId);
}

// ---------------------------------------------------------------------------
// Protobuf helpers (minimal subset for SQLite step_payload encoding)
// ---------------------------------------------------------------------------

function pbVarint(value: number): Buffer {
  const bytes: number[] = [];
  let v = value >>> 0;
  while (v >= 0x80) {
    bytes.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  bytes.push(v);
  return Buffer.from(bytes);
}

function pbFieldVarint(field: number, value: number): Buffer {
  return Buffer.concat([pbVarint((field << 3) | 0), pbVarint(value)]);
}

function pbFieldBytes(field: number, value: Buffer): Buffer {
  return Buffer.concat([pbVarint((field << 3) | 2), pbVarint(value.length), value]);
}

function buildUserInputPayload(userMessage: string): Buffer {
  const msgBuf = Buffer.from(userMessage, 'utf-8');
  const content = Buffer.concat([
    pbFieldBytes(2, msgBuf),
    pbFieldBytes(3, pbFieldBytes(1, msgBuf)),
  ]);
  return Buffer.concat([
    pbFieldVarint(1, 14),
    pbFieldVarint(4, 3),
    pbFieldBytes(19, content),
  ]);
}

function buildModelResponsePayload(agentMessage: string): Buffer {
  const msgBuf = Buffer.from(agentMessage, 'utf-8');
  const content = Buffer.concat([
    pbFieldBytes(1, msgBuf),
    pbFieldBytes(8, msgBuf),
    pbFieldVarint(12, 2),
  ]);
  return Buffer.concat([
    pbFieldVarint(1, 15),
    pbFieldVarint(4, 3),
    pbFieldBytes(20, content),
  ]);
}

/**
 * Write a fake two-turn conversation (user + agent) directly into the
 * Antigravity SQLite conversation database so the thread loads immediately
 * without triggering any AI agent execution.
 */
export function writeEgdeskChatConversation(
  cascadeId: string,
  userMessage: string,
  agentMessage: string,
): void {
  const conversationsDir = path.join(os.homedir(), '.gemini', 'antigravity', 'conversations');
  fs.mkdirSync(conversationsDir, { recursive: true });
  const dbPath = path.join(conversationsDir, `${cascadeId}.db`);

  const db = new Database(dbPath);
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS trajectory_meta (
        trajectory_id text,
        cascade_id text,
        trajectory_type integer,
        source integer,
        PRIMARY KEY (trajectory_id)
      );
      CREATE TABLE IF NOT EXISTS steps (
        idx integer,
        step_type integer NOT NULL DEFAULT 0,
        status integer NOT NULL DEFAULT 0,
        has_subtrajectory numeric NOT NULL DEFAULT false,
        metadata blob,
        error_details blob,
        permissions blob,
        task_details blob,
        render_info blob,
        step_payload blob,
        step_format integer NOT NULL DEFAULT 0,
        PRIMARY KEY (idx)
      );
      CREATE INDEX IF NOT EXISTS idx_steps_status ON steps(status);
      CREATE INDEX IF NOT EXISTS idx_steps_step_type ON steps(step_type);
      CREATE TABLE IF NOT EXISTS gen_metadata (
        idx integer, data blob, size integer NOT NULL DEFAULT 0, PRIMARY KEY (idx)
      );
      CREATE TABLE IF NOT EXISTS executor_metadata (idx integer, data blob, PRIMARY KEY (idx));
      CREATE TABLE IF NOT EXISTS parent_references (idx integer, data blob, PRIMARY KEY (idx));
      CREATE TABLE IF NOT EXISTS trajectory_metadata_blob (
        id text DEFAULT "main", data blob, PRIMARY KEY (id)
      );
      CREATE TABLE IF NOT EXISTS battle_mode_infos (idx integer, data blob, PRIMARY KEY (idx));
    `);

    const trajectoryId = randomUUID();
    db.prepare(
      'INSERT OR REPLACE INTO trajectory_meta (trajectory_id, cascade_id, trajectory_type, source) VALUES (?, ?, ?, ?)',
    ).run(trajectoryId, cascadeId, 4, 1);

    db.prepare(
      'INSERT OR REPLACE INTO steps (idx, step_type, status, has_subtrajectory, step_payload, step_format) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(0, 14, 3, 0, buildUserInputPayload(userMessage), 0);

    db.prepare(
      'INSERT OR REPLACE INTO steps (idx, step_type, status, has_subtrajectory, step_payload, step_format) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(1, 15, 3, 0, buildModelResponsePayload(agentMessage), 0);

    console.log(`[egdesk-chat] Wrote fake conversation db (cascade=${cascadeId})`);
  } finally {
    db.close();
  }
}
