/**
 * Korean Law Search Tool
 * Searches laws, precedents, administrative rules, and municipal regulations
 * via the Ministry of Government Legislation (법제처) API.
 */

import type { ToolExecutor } from '../../types/ai-types';
import { lawFetch } from '../../korean-law-handlers';

const DEFAULT_OC_KEY = 'egdesk';

export class KoreanLawSearchTool implements ToolExecutor {
  name = 'korean_law_search';
  description = '법제처 API로 법령·판례·행정규칙·자치법규를 검색합니다. target: law=법령, prec=판례, admrul=행정규칙, ordin=자치법규. 판례(prec) 검색 시 사건명(evtNm)으로만 매칭되므로 "손해배상(기)", "채무불이행" 같은 법적 청구 유형으로 검색할 것. 사실 키워드("인수인계" 등)는 0건 반환됨. 0건이면 더 단순한 법률 개념어로 재시도.';
  dangerous = false;

  async execute(params: {
    query: string;
    target?: string;
    display?: number;
    page?: number;
  }): Promise<string> {
    const { query, target = 'law', display = 20, page = 1 } = params;
    if (!query?.trim()) throw new Error('검색어(query)가 필요합니다.');

    const data = await lawFetch('lawSearch.do', {
      OC: DEFAULT_OC_KEY,
      target,
      query: query.trim(),
      display: String(display),
      page: String(page),
    });

    return JSON.stringify(data, null, 2);
  }
}
