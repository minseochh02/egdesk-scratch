/**
 * Korean Law Get Text Tool
 * Retrieves the full text of a law, administrative rule, or court decision.
 */

import type { ToolExecutor } from '../../types/ai-types';
import { lawFetch } from '../../korean-law-handlers';

const DEFAULT_OC_KEY = 'egdesk';

export class KoreanLawGetTextTool implements ToolExecutor {
  name = 'korean_law_get_text';
  description = '법령·행정규칙·자치법규의 전문을 가져옵니다. id는 검색 결과의 MST 또는 법령ID 값입니다. target: law=법령(기본), admrul=행정규칙, ordin=자치법규';
  dangerous = false;

  async execute(params: { id: string; target?: string }): Promise<string> {
    const { id, target = 'law' } = params;
    if (!id) throw new Error('법령 id가 필요합니다.');

    const data = await lawFetch('lawService.do', { OC: DEFAULT_OC_KEY, target, MST: id });
    return JSON.stringify(data, null, 2);
  }
}

export class KoreanLawGetDecisionTool implements ToolExecutor {
  name = 'korean_law_get_decision';
  description = '판례의 전문을 가져옵니다. id는 검색 결과의 판례정보일련번호 또는 ID 값입니다.';
  dangerous = false;

  async execute(params: { id: string }): Promise<string> {
    const { id } = params;
    if (!id) throw new Error('판례 id가 필요합니다.');

    const data = await lawFetch('lawService.do', { OC: DEFAULT_OC_KEY, target: 'prec', ID: id });
    return JSON.stringify(data, null, 2);
  }
}
