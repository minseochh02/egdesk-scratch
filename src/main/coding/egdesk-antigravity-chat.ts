import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
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
  waitForLanguageServerReady,
  type LanguageServerEndpoint,
} from './antigravity-language-server';
import {
  clearEgdeskChatCascadeId,
  getEgdeskChatCascadeId,
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
    `[EGDesk] Opened "${context.projectName}" from EGDesk.`,
    '',
    `Dev server: ${context.url} (port ${context.port}, ${modeLabel})`,
    'EGDesk MCP/API: http://localhost:8080',
    '',
    'Do not use port 3000. See AGENTS.md and .agents/rules/egdesk-dev-context.md.',
  ].join('\n');
}

function buildEgdeskChatTranscriptLines(context: EgdeskChatContext, createdAt: string): string {
  const modeLabel = context.mode === 'dev' ? 'coding (dev)' : 'hosting (production)';
  const userRequest = buildEgdeskSeedUserMessage(context);
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
    {
      step_index: 2,
      source: 'MODEL',
      type: 'PLANNER_RESPONSE',
      status: 'DONE',
      created_at: createdAt,
      content: [
        `EGDesk context loaded for **${context.projectName}**.`,
        '',
        `- **Dev server:** ${context.url} (port **${context.port}**, ${modeLabel})`,
        '- **EGDesk MCP/API:** http://localhost:8080',
        '- **Do not assume port 3000** — use the port above for dev commands and previews.',
        '',
        'See `AGENTS.md` and `.agents/rules/egdesk-dev-context.md` for full details.',
      ].join('\n'),
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

/** Write hub + transcript locally. Do not use StartCascade — LS overwrites title/project link. */
function insertEgdeskChatHistoryLocally(context: EgdeskChatContext): string {
  const cascadeId = randomUUID();
  writeEgdeskChatHistory(context, cascadeId);
  refreshEgdeskChatHub(context, cascadeId);
  return cascadeId;
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

/** Remove hub rows that never got a transcript. */
export function cleanupOrphanEgdeskChatStubs(projectId: string): void {
  for (const cascadeId of findCascadeIdsForProject(projectId)) {
    if (!hubHasEgdeskChatTitle(cascadeId)) continue;
    if (hasEgdeskChatHistory(cascadeId)) continue;
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

  const cascadeId = insertEgdeskChatHistoryLocally(context);

  try {
    const ls = endpoint ?? (await waitForLanguageServerReady(context.projectId, { timeoutMs: 20_000 }));
    await addTrackedWorkspace(ls, context.folderUri);
  } catch (error) {
    console.warn('[egdesk-chat] Skipped LS workspace registration:', error);
  }

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

  return { cascadeId, created: true, hubLinked };
}

/** @deprecated */
export async function activateEgdeskChatThread(
  context: EgdeskChatContext,
  endpoint?: LanguageServerEndpoint,
): Promise<EgdeskChatRegistrationResult & { activated: boolean; needsActivation: boolean }> {
  const result = await registerEgdeskChatHistory(context, endpoint);
  return { ...result, activated: result.hubLinked, needsActivation: !result.hubLinked };
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
