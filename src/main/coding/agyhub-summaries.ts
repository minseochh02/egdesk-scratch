import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/** Wire-format helpers for Antigravity's `agyhub_summaries_proto.pb` hub index. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isCascadeUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function writeVarint(value: number): Buffer {
  const bytes: number[] = [];
  let v = value >>> 0;
  while (v >= 0x80) {
    bytes.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  bytes.push(v);
  return Buffer.from(bytes);
}

function readVarint(data: Buffer, offset: number): { value: number; offset: number } {
  let value = 0;
  let shift = 0;
  let pos = offset;
  while (pos < data.length) {
    const byte = data[pos++];
    value |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) {
      return { value, offset: pos };
    }
    shift += 7;
  }
  throw new Error('Truncated protobuf varint');
}

function writeFieldVarint(fieldNumber: number, value: number): Buffer {
  const tag = (fieldNumber << 3) | 0;
  return Buffer.concat([writeVarint(tag), writeVarint(value)]);
}

function writeFieldBytes(fieldNumber: number, value: Buffer): Buffer {
  const tag = (fieldNumber << 3) | 2;
  return Buffer.concat([writeVarint(tag), writeVarint(value.length), value]);
}

function writeFieldString(fieldNumber: number, value: string): Buffer {
  return writeFieldBytes(fieldNumber, Buffer.from(value, 'utf-8'));
}

function writeMessage(fieldNumber: number, parts: Buffer[]): Buffer {
  return writeFieldBytes(fieldNumber, Buffer.concat(parts));
}

function writeTimestamp(fieldNumber: number, ms: number): Buffer {
  const seconds = Math.floor(ms / 1000);
  const nanos = (ms % 1000) * 1_000_000;
  return writeMessage(fieldNumber, [
    writeFieldVarint(1, seconds),
    writeFieldVarint(2, nanos),
  ]);
}

function writeNestedTimestampOuter(fieldNumber: number, ms: number): Buffer {
  const inner = writeMessage(7, [
    writeFieldVarint(1, Math.floor(ms / 1000)),
    writeFieldVarint(2, (ms % 1000) * 1_000_000),
  ]);
  return writeFieldBytes(fieldNumber, inner);
}

export function getAgyHubSummariesPath(): string {
  return path.join(os.homedir(), '.gemini', 'antigravity', 'agyhub_summaries_proto.pb');
}

function detectGitInfo(folderPath: string): { repo: string; url: string; branch?: string } | null {
  const gitDir = path.join(folderPath, '.git');
  if (!fs.existsSync(gitDir)) return null;

  let branch: string | undefined;
  try {
    const head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf-8').trim();
    if (head.startsWith('ref: refs/heads/')) {
      branch = head.replace('ref: refs/heads/', '');
    }
  } catch {
    // ignore
  }

  let remoteUrl: string | undefined;
  try {
    const config = fs.readFileSync(path.join(gitDir, 'config'), 'utf-8');
    const match = config.match(/\[remote "origin"\][\s\S]*?url = (.+)/);
    if (match) remoteUrl = match[1].trim();
  } catch {
    // ignore
  }

  if (!remoteUrl) return branch ? { repo: path.basename(folderPath), url: '', branch } : null;

  let repo = path.basename(folderPath);
  const githubHttps = remoteUrl.match(/github\.com[/:]([^/]+\/[^/.]+)/);
  const githubGit = remoteUrl.match(/git@github\.com:([^/]+\/[^/.]+)/);
  if (githubHttps) repo = githubHttps[1];
  else if (githubGit) repo = githubGit[1];

  return { repo, url: remoteUrl.endsWith('.git') ? remoteUrl : `${remoteUrl}.git`, branch };
}

function writeWorkspaceResource(folderUri: string, folderPath: string): Buffer {
  const parts: Buffer[] = [
    writeFieldString(1, folderUri),
    writeFieldString(2, folderUri),
  ];
  const git = detectGitInfo(folderPath);
  if (git?.url) {
    parts.push(
      writeMessage(3, [writeFieldString(1, git.repo), writeFieldString(2, git.url)]),
    );
  }
  if (git?.branch) {
    parts.push(writeFieldString(4, git.branch));
  }
  return Buffer.concat(parts);
}

export interface AgyHubSummaryInput {
  projectId: string;
  projectName: string;
  folderUri: string;
  folderPath: string;
  /** Hub sidebar title; defaults to projectName. */
  hubTitle?: string;
  /** Defaults to a new UUID per open. */
  cascadeId?: string;
}

/**
 * Build one hub summary entry (reverse-engineered from agyhub_summaries_proto.pb).
 *
 * Top-level file: repeated field 1
 *   entry.1 = cascade/conversation id
 *   entry.2 = summary
 *     .1  title
 *     .2  status (12 observed for active)
 *     .3  updated timestamp
 *     .4  session uuid
 *     .5  flag (1)
 *     .7  created timestamp
 *     .9  workspace resource
 *     .10 last activity timestamp
 *     .15 last-view wrapper
 *     .16 0
 *     .17 project link
 *       .1  workspace resource
 *       .2  timestamp
 *       .3  resource uuid
 *       .7  folder uri
 *       .18 project registry uuid
 *     .22 kind (4 observed)
 */
export function buildAgyHubSummaryEntry(input: AgyHubSummaryInput): Buffer {
  const now = Date.now();
  const cascadeId = input.cascadeId ?? randomUUID();
  const sessionId = randomUUID();
  const resourceId = randomUUID();
  const workspace = writeWorkspaceResource(input.folderUri, input.folderPath);

  const projectLink = writeMessage(17, [
    writeFieldBytes(1, workspace),
    writeTimestamp(2, now),
    writeFieldString(3, resourceId),
    writeFieldString(7, input.folderUri),
    writeFieldString(18, input.projectId),
  ]);

  const summary = Buffer.concat([
    writeFieldString(1, input.hubTitle ?? input.projectName),
    writeFieldVarint(2, 12),
    writeTimestamp(3, now + 11_000),
    writeFieldString(4, sessionId),
    writeFieldVarint(5, 1),
    writeTimestamp(7, now),
    writeFieldBytes(9, workspace),
    writeTimestamp(10, now),
    writeNestedTimestampOuter(15, now),
    writeFieldVarint(16, 0),
    projectLink,
    writeFieldVarint(22, 4),
  ]);

  return Buffer.concat([writeFieldString(1, cascadeId), writeFieldBytes(2, summary)]);
}

function parseTopLevelEntries(data: Buffer): Buffer[] {
  const entries: Buffer[] = [];
  let pos = 0;
  while (pos < data.length) {
    const tagResult = readVarint(data, pos);
    const fieldNumber = tagResult.value >> 3;
    const wireType = tagResult.value & 7;
    if (fieldNumber !== 1 || wireType !== 2) break;
    const lenResult = readVarint(data, tagResult.offset);
    const start = lenResult.offset;
    const end = start + lenResult.value;
    entries.push(data.subarray(start, end));
    pos = end;
  }
  return entries;
}

function encodeTopLevelFile(entries: Buffer[]): Buffer {
  return Buffer.concat(entries.map((entry) => writeFieldBytes(1, entry)));
}

function entryContainsProjectId(entry: Buffer, projectId: string): boolean {
  return entry.includes(Buffer.from(projectId, 'utf-8'));
}

function entryContainsCascadeId(entry: Buffer, cascadeId: string): boolean {
  const parsed = parseCascadeIdFromHubEntry(entry);
  return parsed === cascadeId;
}

export function findHubEntryForProject(projectId: string): Buffer | undefined {
  const filePath = getAgyHubSummariesPath();
  if (!fs.existsSync(filePath)) return undefined;
  return parseTopLevelEntries(fs.readFileSync(filePath)).find((entry) =>
    entryContainsProjectId(entry, projectId),
  );
}

export function findHubEntryForCascade(cascadeId: string): Buffer | undefined {
  const filePath = getAgyHubSummariesPath();
  if (!fs.existsSync(filePath)) return undefined;
  return parseTopLevelEntries(fs.readFileSync(filePath)).find((entry) =>
    entryContainsCascadeId(entry, cascadeId),
  );
}

export function findCascadeIdsForProject(projectId: string): string[] {
  const filePath = getAgyHubSummariesPath();
  if (!fs.existsSync(filePath)) return [];

  return parseTopLevelEntries(fs.readFileSync(filePath))
    .filter((entry) => entryContainsProjectId(entry, projectId))
    .map((entry) => parseCascadeIdFromHubEntry(entry))
    .filter((id): id is string => id !== null);
}

/** Extract sidebar title (summary field 1) from a hub entry blob. */
export function parseHubTitleFromHubEntry(entry: Buffer): string | null {
  try {
    let pos = 0;
    while (pos < entry.length) {
      const tag = readVarint(entry, pos);
      pos = tag.offset;
      const fieldNumber = tag.value >> 3;
      const wireType = tag.value & 7;
      if (wireType !== 2) break;
      const len = readVarint(entry, pos);
      pos = len.offset;
      const value = entry.subarray(pos, pos + len.value);
      pos += len.value;
      if (fieldNumber !== 2) continue;

      let summaryPos = 0;
      while (summaryPos < value.length) {
        const summaryTag = readVarint(value, summaryPos);
        summaryPos = summaryTag.offset;
        const summaryField = summaryTag.value >> 3;
        const summaryWire = summaryTag.value & 7;
        if (summaryWire !== 2) break;
        const summaryLen = readVarint(value, summaryPos);
        summaryPos = summaryLen.offset;
        const summaryValue = value.subarray(summaryPos, summaryPos + summaryLen.value);
        summaryPos += summaryLen.value;
        if (summaryField === 1) {
          const title = summaryValue.toString('utf-8').trim();
          return title.length > 0 ? title : null;
        }
      }
    }
  } catch {
    // skip
  }
  return null;
}

/** True when the hub row includes the Antigravity project registry id (required for sidebar grouping). */
export function isHubEntryLinkedToProject(cascadeId: string, projectId: string): boolean {
  const entry = findHubEntryForCascade(cascadeId);
  if (!entry) return false;
  return entryContainsProjectId(entry, projectId);
}

/** Remove a hub entry by cascade id. Returns true if an entry was removed. */
export function removeHubEntryForCascade(cascadeId: string): boolean {
  const filePath = getAgyHubSummariesPath();
  if (!fs.existsSync(filePath)) return false;

  const entries = parseTopLevelEntries(fs.readFileSync(filePath));
  const filtered = entries.filter((entry) => !entryContainsCascadeId(entry, cascadeId));
  if (filtered.length === entries.length) return false;

  if (filtered.length === 0) {
    fs.rmSync(filePath, { force: true });
  } else {
    fs.writeFileSync(filePath, encodeTopLevelFile(filtered));
  }
  return true;
}

/** Move an existing hub entry to the front without rewriting its contents. */
export function reorderHubEntryToFront(cascadeId: string): boolean {
  const filePath = getAgyHubSummariesPath();
  if (!fs.existsSync(filePath)) return false;

  const entries = parseTopLevelEntries(fs.readFileSync(filePath));
  const index = entries.findIndex((entry) => entryContainsCascadeId(entry, cascadeId));
  if (index < 0) return false;

  const [target] = entries.splice(index, 1);
  fs.writeFileSync(filePath, encodeTopLevelFile([target, ...entries]));
  return true;
}

/** Extract cascade id (field 1 string) from a hub entry blob. */
export function parseCascadeIdFromHubEntry(entry: Buffer): string | null {
  try {
    let pos = 0;
    const tag = readVarint(entry, pos);
    pos = tag.offset;
    if ((tag.value >> 3) !== 1 || (tag.value & 7) !== 2) return null;
    const len = readVarint(entry, pos);
    pos = len.offset;
    const cascadeId = entry.subarray(pos, pos + len.value).toString('utf-8');
    return isCascadeUuid(cascadeId) ? cascadeId : null;
  } catch {
    return null;
  }
}

/** Unwrap entries that were accidentally double-nested by an earlier EGDesk bug. */
function normalizeHubEntry(entry: Buffer): Buffer | null {
  const direct = parseCascadeIdFromHubEntry(entry);
  if (direct) return entry;

  try {
    let pos = 0;
    const tag = readVarint(entry, pos);
    pos = tag.offset;
    if ((tag.value >> 3) !== 1 || (tag.value & 7) !== 2) return null;
    const len = readVarint(entry, pos);
    const inner = entry.subarray(len.offset, len.offset + len.value);
    return parseCascadeIdFromHubEntry(inner) ? inner : null;
  } catch {
    return null;
  }
}

/** Drop corrupt hub entries written by earlier double-wrap / bad cascade id bugs. */
export function repairAgyHubSummaries(): { kept: number; dropped: number } {
  const filePath = getAgyHubSummariesPath();
  if (!fs.existsSync(filePath)) return { kept: 0, dropped: 0 };

  const raw = parseTopLevelEntries(fs.readFileSync(filePath));
  const normalized = raw
    .map((entry) => normalizeHubEntry(entry))
    .filter((entry): entry is Buffer => entry !== null);

  const dropped = raw.length - normalized.length;
  if (normalized.length === 0) {
    fs.rmSync(filePath, { force: true });
    return { kept: 0, dropped: raw.length };
  }

  fs.writeFileSync(filePath, encodeTopLevelFile(normalized));
  return { kept: normalized.length, dropped };
}

/**
 * Insert or replace the hub summary for projectId. New entries are placed first
 * so Antigravity treats them as most recent on cold start.
 */
export function upsertAgyHubSummary(input: AgyHubSummaryInput): {
  path: string;
  cascadeId: string;
  created: boolean;
  replaced: boolean;
  previousEntry?: Buffer;
} {
  const filePath = getAgyHubSummariesPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const cascadeId = input.cascadeId ?? randomUUID();
  const newEntry = buildAgyHubSummaryEntry({ ...input, cascadeId });

  let entries: Buffer[] = [];
  let replaced = false;
  let previousEntry: Buffer | undefined;

  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath);
    entries = parseTopLevelEntries(existing).filter((entry) => {
      if (entryContainsCascadeId(entry, cascadeId)) {
        replaced = true;
        previousEntry = entry;
        return false;
      }
      return true;
    });
  }

  const created = !replaced && entries.length === 0;
  const merged = encodeTopLevelFile([newEntry, ...entries]);
  fs.writeFileSync(filePath, merged);

  console.log(
    `[agyhub] ${replaced ? 'Updated' : created ? 'Created' : 'Added'} hub summary for ${input.projectName} (${input.projectId}) cascade=${cascadeId}`,
  );

  return { path: filePath, cascadeId, created: created && !replaced, replaced, previousEntry };
}
