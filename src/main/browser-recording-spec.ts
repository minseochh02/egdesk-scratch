/**
 * Parse RECORDED_ACTIONS from generated browser recorder *.spec.js files and
 * compute replay UI options / resolve dates for datePickerGroup steps.
 */
import * as fs from 'fs';

/** Matches the JSON embedded in the spec header comment */
export interface StoredRecordedAction {
  type: string;
  timestamp?: number;
  dateOffset?: number;
  dateComponents?: RecordedActionDateComponents;
  [key: string]: unknown;
}

export interface RecordedActionDateComponents {
  year?: {
    selector: string;
    xpath?: string;
    elementType: 'select' | 'button' | 'input';
    dropdownSelector?: string;
  };
  month?: {
    selector: string;
    xpath?: string;
    elementType: 'select' | 'button' | 'input';
    dropdownSelector?: string;
  };
  day?: {
    selector: string;
    xpath?: string;
    elementType: 'select' | 'button' | 'input';
    dropdownSelector?: string;
  };
}

export interface BrowserRecordingReplayParams {
  dateRange?: { start?: string; end?: string };
  datePickersByIndex?: (string | undefined)[];
}

export interface BrowserRecordingReplayOptionsResponse {
  ok: boolean;
  error?: string;
  datePickerGroupCount: number;
  ui: 'none' | 'singleDate' | 'dateRange';
}

/** Inclusive [start, end) slice indices of the JSON array in the spec file */
export function getRecordedActionsJsonRange(source: string): { start: number; end: number } | null {
  const marker = 'RECORDED_ACTIONS:';
  const idx = source.indexOf(marker);
  if (idx === -1) return null;

  let pos = idx + marker.length;
  while (pos < source.length && /\s/.test(source[pos])) pos++;

  while (pos < source.length && (source[pos] === '*' || source[pos] === ' ')) {
    if (source[pos] === '*') {
      pos++;
      while (pos < source.length && source[pos] === ' ') pos++;
    } else pos++;
  }

  if (pos >= source.length || source[pos] !== '[') return null;

  const startBracket = pos;
  let depth = 0;
  let inString = false;
  let stringQuote: string | null = null;
  let escape = false;

  for (let i = startBracket; i < source.length; i++) {
    const c = source[i];

    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === '\\') {
        escape = true;
        continue;
      }
      if (stringQuote && c === stringQuote) {
        inString = false;
        stringQuote = null;
      }
      continue;
    }

    if (c === '"' || c === "'") {
      inString = true;
      stringQuote = c;
      continue;
    }

    if (c === '[') depth++;
    if (c === ']') {
      depth--;
      if (depth === 0) {
        return { start: startBracket, end: i + 1 };
      }
    }
  }

  return null;
}

function extractRecordedActionsJson(source: string): string | null {
  const range = getRecordedActionsJsonRange(source);
  if (!range) return null;
  return source.slice(range.start, range.end);
}

/**
 * Merge updates into RECORDED_ACTIONS JSON inside a *.spec.js file (comment block).
 */
export function updateRecordedActionsInSpecFile(
  testFile: string,
  update: (actions: StoredRecordedAction[]) => void
): { ok: true } | { ok: false; error: string } {
  try {
    if (!fs.existsSync(testFile)) {
      return { ok: false, error: `File not found: ${testFile}` };
    }
    const raw = fs.readFileSync(testFile, 'utf8');
    const jsonStr = extractRecordedActionsJson(raw);
    if (!jsonStr) {
      return { ok: false, error: 'RECORDED_ACTIONS block not found in script' };
    }
    const actions = JSON.parse(jsonStr) as StoredRecordedAction[];
    if (!Array.isArray(actions)) {
      return { ok: false, error: 'RECORDED_ACTIONS is not a JSON array' };
    }
    update(actions);
    const newJson = JSON.stringify(actions);
    const range = getRecordedActionsJsonRange(raw);
    if (!range) {
      return { ok: false, error: 'RECORDED_ACTIONS block not found in script' };
    }
    const next = raw.slice(0, range.start) + newJson + raw.slice(range.end);
    fs.writeFileSync(testFile, next, 'utf8');
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export function parseRecordedActionsFromSpecFile(testFile: string):
  | { ok: true; actions: StoredRecordedAction[] }
  | { ok: false; error: string } {
  try {
    if (!fs.existsSync(testFile)) {
      return { ok: false, error: `File not found: ${testFile}` };
    }
    const raw = fs.readFileSync(testFile, 'utf8');
    const jsonStr = extractRecordedActionsJson(raw);
    if (!jsonStr) {
      return { ok: false, error: 'RECORDED_ACTIONS block not found in script' };
    }
    const actions = JSON.parse(jsonStr) as StoredRecordedAction[];
    if (!Array.isArray(actions)) {
      return { ok: false, error: 'RECORDED_ACTIONS is not a JSON array' };
    }
    return { ok: true, actions };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export function getReplayUiOptionsFromActions(actions: StoredRecordedAction[]): BrowserRecordingReplayOptionsResponse {
  const datePickerGroupCount = actions.filter(a => a.type === 'datePickerGroup').length;
  let ui: 'none' | 'singleDate' | 'dateRange' = 'none';
  if (datePickerGroupCount === 1) ui = 'singleDate';
  else if (datePickerGroupCount >= 2) ui = 'dateRange';

  return {
    ok: true,
    datePickerGroupCount,
    ui,
  };
}

function parseIsoDateLocal(iso: string): Date {
  const trimmed = iso.trim().replace(/\//g, '-');
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!m) {
    return new Date(trimmed);
  }
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10) - 1;
  const d = parseInt(m[3], 10);
  return new Date(y, mo, d, 12, 0, 0, 0);
}

export function resolveDateForDatePickerGroup(
  ordinal: number,
  dateOffset: number | undefined,
  params?: BrowserRecordingReplayParams
): Date {
  const byIdx = params?.datePickersByIndex?.[ordinal];
  if (byIdx && String(byIdx).trim() !== '') {
    return parseIsoDateLocal(String(byIdx));
  }

  const range = params?.dateRange;
  if (range) {
    if (ordinal === 0 && range.start && String(range.start).trim() !== '') {
      return parseIsoDateLocal(range.start);
    }
    if (ordinal === 1 && range.end && String(range.end).trim() !== '') {
      return parseIsoDateLocal(range.end);
    }
    if (ordinal === 0 && !range.start && range.end && String(range.end).trim() !== '') {
      return parseIsoDateLocal(range.end);
    }
  }

  const target = new Date();
  const off = dateOffset ?? 0;
  target.setDate(target.getDate() + off);
  return target;
}
