import { randomUUID } from 'crypto';
import { Agent, fetch as undiciFetch } from 'undici';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const LS_CONNECT_PATH = '/exa.language_server_pb.LanguageServerService';
const TRAJECTORY_SOURCE = 'CORTEX_TRAJECTORY_SOURCE_CASCADE_CLIENT';

const insecureAgent = new Agent({
  connect: { rejectUnauthorized: false },
});

export interface LanguageServerEndpoint {
  baseUrl: string;
  port: number;
  csrfToken: string;
}

interface CascadeModelConfigEntry {
  isRecommended?: boolean;
  modelOrAlias?: { model?: string };
}

export function getAntigravityMainLogPath(): string {
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Logs', 'Antigravity', 'main.log');
  }
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(localAppData, 'Antigravity', 'logs', 'main.log');
  }
  return path.join(os.homedir(), '.config', 'Antigravity', 'logs', 'main.log');
}

export function getLanguageServerLogPath(): string {
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Logs', 'Antigravity', 'language_server.log');
  }
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(localAppData, 'Antigravity', 'logs', 'language_server.log');
  }
  return path.join(os.homedir(), '.config', 'Antigravity', 'logs', 'language_server.log');
}

/** Parse the most recent LS URL + CSRF token from Antigravity main.log. */
export function parseLatestLanguageServerEndpoint(logContent: string): LanguageServerEndpoint | null {
  const localMatches = [...logContent.matchAll(/Local:\s+https:\/\/127\.0\.0\.1:(\d+)\//g)];
  const csrfMatches = [...logContent.matchAll(/--csrf_token\s+([0-9a-f-]{36})/gi)];

  if (localMatches.length === 0 || csrfMatches.length === 0) return null;

  const port = Number.parseInt(localMatches[localMatches.length - 1][1], 10);
  const csrfToken = csrfMatches[csrfMatches.length - 1][1];
  if (!Number.isFinite(port) || !csrfToken) return null;

  return {
    baseUrl: `https://127.0.0.1:${port}`,
    port,
    csrfToken,
  };
}

function languageServerInitialized(logContent: string): boolean {
  return logContent.includes('initialized server successfully');
}

/** Wait until LS auth, models, and startup are complete. */
export async function waitForLanguageServerReady(
  projectId: string,
  options?: { timeoutMs?: number; pollMs?: number },
): Promise<LanguageServerEndpoint> {
  const timeoutMs = options?.timeoutMs ?? 90_000;
  const pollMs = options?.pollMs ?? 500;
  const mainLogPath = getAntigravityMainLogPath();
  const lsLogPath = getLanguageServerLogPath();
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    if (fs.existsSync(mainLogPath)) {
      const endpoint = parseLatestLanguageServerEndpoint(fs.readFileSync(mainLogPath, 'utf-8'));
      const lsLog = fs.existsSync(lsLogPath) ? fs.readFileSync(lsLogPath, 'utf-8') : '';
      if (endpoint && languageServerInitialized(lsLog)) {
        try {
          await getDefaultCascadePlanModel(endpoint, projectId);
          // Brief settle — cold LS rejects agent runs immediately after init.
          await sleep(2_000);
          return endpoint;
        } catch {
          // Auth/models not ready yet.
        }
      }
    }
    await sleep(pollMs);
  }

  throw new Error('Antigravity language server did not finish auth/model setup in time');
}

export async function getDefaultCascadePlanModel(
  endpoint: LanguageServerEndpoint,
  projectId: string,
): Promise<string> {
  const response = await connectPost(endpoint, 'GetCascadeModelConfigData', { projectId });
  const payload = await readConnectJson(response);
  if (!response.ok) {
    throw new Error(formatConnectError('GetCascadeModelConfigData', payload));
  }

  const configs = payload.clientModelConfigs as CascadeModelConfigEntry[] | undefined;
  if (!Array.isArray(configs) || configs.length === 0) {
    throw new Error('No cascade models available from Antigravity');
  }

  const chosen = configs.find((entry) => entry.isRecommended) ?? configs[0];
  const model = chosen.modelOrAlias?.model;
  if (!model) {
    throw new Error('Antigravity returned cascade models without planModel ids');
  }
  return model;
}

export async function addTrackedWorkspace(
  endpoint: LanguageServerEndpoint,
  folderUri: string,
): Promise<void> {
  try {
    const response = await connectPost(endpoint, 'AddTrackedWorkspace', { folderUri });
    if (!response.ok) {
      const payload = await readConnectJson(response);
      console.warn('[antigravity-ls] AddTrackedWorkspace:', formatConnectError('AddTrackedWorkspace', payload));
    }
  } catch (error) {
    console.warn('[antigravity-ls] AddTrackedWorkspace failed:', error);
  }
}

export interface StartCascadeParams {
  projectId: string;
  workspaceUris: string[];
  conversationTitle?: string;
}

export async function startCascade(
  endpoint: LanguageServerEndpoint,
  params: StartCascadeParams,
): Promise<{ cascadeId: string }> {
  const body: Record<string, unknown> = {
    source: TRAJECTORY_SOURCE,
    projectId: params.projectId,
    workspaceUris: params.workspaceUris,
  };
  if (params.conversationTitle) {
    body.conversationTitle = params.conversationTitle;
  }

  const response = await connectPost(endpoint, 'StartCascade', body);
  const payload = await readConnectJson(response);
  if (!response.ok) {
    throw new Error(formatConnectError('StartCascade', payload));
  }

  const cascadeId = typeof payload.cascadeId === 'string' ? payload.cascadeId : null;
  if (!cascadeId) {
    throw new Error('StartCascade did not return cascadeId');
  }
  return { cascadeId };
}

/** Ask the Antigravity UI to open/focus a conversation (best-effort). */
export async function setBrowserOpenConversation(
  endpoint: LanguageServerEndpoint,
  params: { cascadeId: string; projectId: string },
): Promise<void> {
  try {
    const response = await connectPost(endpoint, 'SetBrowserOpenConversation', {
      cascadeId: params.cascadeId,
      projectId: params.projectId,
    });
    if (!response.ok) {
      const payload = await readConnectJson(response);
      console.warn('[antigravity-ls] SetBrowserOpenConversation:', formatConnectError('SetBrowserOpenConversation', payload));
    }
  } catch (error) {
    console.warn('[antigravity-ls] SetBrowserOpenConversation failed:', error);
  }
}

export interface SendUserCascadeMessageParams {
  cascadeId: string;
  userMessage: string;
  planModel: string;
  messageId?: string;
}

/** Kick off agent execution for a cascade (best-effort — UI-created cascades work more reliably). */
export async function sendUserCascadeMessage(
  endpoint: LanguageServerEndpoint,
  params: SendUserCascadeMessageParams,
): Promise<void> {
  const response = await connectPost(endpoint, 'SendUserCascadeMessage', {
    cascadeId: params.cascadeId,
    messageId: params.messageId ?? randomUUID(),
    userMessage: params.userMessage,
    cascadeConfig: {
      plannerConfig: {
        planModel: params.planModel,
      },
    },
  });
  if (!response.ok) {
    const payload = await readConnectJson(response);
    throw new Error(formatConnectError('SendUserCascadeMessage', payload));
  }
}

async function connectPost(
  endpoint: LanguageServerEndpoint,
  method: string,
  body: Record<string, unknown>,
): Promise<Response> {
  return undiciFetch(`${endpoint.baseUrl}${LS_CONNECT_PATH}/${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Connect-Protocol-Version': '1',
      'x-codeium-csrf-token': endpoint.csrfToken,
    },
    body: JSON.stringify(body),
    dispatcher: insecureAgent,
  }) as Promise<Response>;
}

async function readConnectJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { message: text };
  }
}

function formatConnectError(method: string, payload: Record<string, unknown>): string {
  const code = typeof payload.code === 'string' ? payload.code : 'unknown';
  const message = typeof payload.message === 'string' ? payload.message : JSON.stringify(payload);
  return `${method} failed (${code}): ${message}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
