/**
 * IPC handlers for the Korean Law search feature.
 * Calls the Ministry of Government Legislation (법제처) Open API at law.go.kr.
 * OC key 'egdesk' is registered with 0.0.0.0 (all IPs allowed).
 */
import { ipcMain } from 'electron';
import { getStore } from './storage';

const LAW_BASE = 'https://www.law.go.kr/DRF';
const DEFAULT_OC_KEY = 'egdesk';

function getOcKey(): string {
  try {
    const store = getStore();
    const stored = store?.get('korean-law-oc-key', '') as string;
    return stored?.trim() || DEFAULT_OC_KEY;
  } catch {
    return DEFAULT_OC_KEY;
  }
}

async function lawFetch(endpoint: string, params: Record<string, string>): Promise<any> {
  const url = new URL(`${LAW_BASE}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  url.searchParams.set('type', 'JSON');

  const resp = await fetch(url.toString(), {
    signal: AbortSignal.timeout(30_000),
    headers: { 'Accept': 'application/json, text/plain, */*' },
  });

  if (!resp.ok) throw new Error(`law.go.kr responded with HTTP ${resp.status}`);

  const text = await resp.text();
  if (text.trimStart().startsWith('<html') || text.trimStart().startsWith('<!')) {
    throw new Error('법제처 API가 오류 페이지를 반환했습니다.');
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`응답 파싱 실패: ${text.slice(0, 200)}`);
  }
}

export function registerKoreanLawHandlers(): void {
  ipcMain.handle(
    'korean-law:search',
    async (_event, { query, target = 'law', display = 20, page = 1 }:
      { query: string; target?: string; display?: number; page?: number }) => {
      try {
        if (!query?.trim()) return { success: false, error: '검색어를 입력하세요.' };
        const data = await lawFetch('lawSearch.do', {
          OC: getOcKey(), target, query: query.trim(),
          display: String(display), page: String(page),
        });
        return { success: true, data };
      } catch (e: any) {
        return { success: false, error: e.message ?? String(e) };
      }
    }
  );

  ipcMain.handle(
    'korean-law:get-text',
    async (_event, { id, target = 'law' }: { id: string; target?: string }) => {
      try {
        if (!id) return { success: false, error: '법령 ID가 필요합니다.' };
        const data = await lawFetch('lawService.do', { OC: getOcKey(), target, MST: id });
        return { success: true, data };
      } catch (e: any) {
        return { success: false, error: e.message ?? String(e) };
      }
    }
  );

  ipcMain.handle(
    'korean-law:get-decision-text',
    async (_event, { id, target = 'prec' }: { id: string; target?: string }) => {
      try {
        if (!id) return { success: false, error: '판례 ID가 필요합니다.' };
        const data = await lawFetch('lawService.do', { OC: getOcKey(), target, ID: id });
        return { success: true, data };
      } catch (e: any) {
        return { success: false, error: e.message ?? String(e) };
      }
    }
  );
}
