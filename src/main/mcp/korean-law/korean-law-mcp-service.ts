/**
 * Korean Law MCP Service
 * Implements the IMCPService interface for Korean legal data access
 *
 * Provides search and retrieval of laws, precedents, administrative rules,
 * and municipal regulations via the Ministry of Government Legislation (법제처) API.
 */

import { IMCPService, MCPTool, MCPServerInfo, MCPCapabilities, MCPToolResult } from '../types/mcp-service';
import { lawFetch } from '../../korean-law-handlers';

const DEFAULT_OC_KEY = 'egdesk';

export class KoreanLawMCPService implements IMCPService {
  getServerInfo(): MCPServerInfo {
    return {
      name: 'korean-law-mcp-server',
      version: '1.0.0'
    };
  }

  getCapabilities(): MCPCapabilities {
    return {
      tools: {},
      resources: {}
    };
  }

  listTools(): MCPTool[] {
    return [
      {
        name: 'korean_law_search',
        description:
          '법제처 API로 법령·판례·행정규칙·자치법규를 검색합니다. target: law=법령(기본), prec=판례, admrul=행정규칙, ordin=자치법규. 판례(prec) 검색 시 주의: 사건명(evtNm)으로만 매칭되며 판결 본문 전문 검색이 아님. "손해배상(기)", "채무불이행" 등 법적 청구 유형으로 검색해야 하며, 0건이면 더 단순한 법률 개념어로 재시도할 것.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: '검색어. 판례(prec) 검색 시 사건명 기준이므로 "손해배상(기)", "불법행위", "채무불이행" 같은 법적 청구 유형 사용. 일상 키워드("인수인계", "퇴사")는 0건 반환됨.'
            },
            target: {
              type: 'string',
              enum: ['law', 'prec', 'admrul', 'ordin'],
              description: '검색 대상. law=법령(기본), prec=판례, admrul=행정규칙, ordin=자치법규'
            },
            display: {
              type: 'number',
              description: '한 페이지 결과 수 (기본 20, 최대 100)'
            },
            page: {
              type: 'number',
              description: '페이지 번호 (기본 1)'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'korean_law_get_text',
        description:
          '법령·행정규칙·자치법규의 전문을 가져옵니다. id는 검색 결과의 MST 또는 법령ID 값입니다. target: law=법령(기본), admrul=행정규칙, ordin=자치법규',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: '법령 MST 또는 법령ID (korean_law_search 결과에서 획득)'
            },
            target: {
              type: 'string',
              enum: ['law', 'admrul', 'ordin'],
              description: '대상 종류. law=법령(기본), admrul=행정규칙, ordin=자치법규'
            }
          },
          required: ['id']
        }
      },
      {
        name: 'korean_law_get_decision',
        description:
          '판례의 전문을 가져옵니다. id는 검색 결과의 판례정보일련번호 또는 ID 값입니다.',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: '판례정보일련번호 또는 판례ID (korean_law_search target=prec 결과에서 획득)'
            }
          },
          required: ['id']
        }
      }
    ];
  }

  async executeTool(name: string, args: Record<string, any>): Promise<MCPToolResult> {
    switch (name) {
      case 'korean_law_search': {
        const { query, target = 'law', display = 20, page = 1 } = args;
        if (!query?.trim()) {
          throw new Error('검색어(query)가 필요합니다.');
        }
        const data = await lawFetch('lawSearch.do', {
          OC: DEFAULT_OC_KEY,
          target,
          query: query.trim(),
          display: String(display),
          page: String(page)
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
        };
      }

      case 'korean_law_get_text': {
        const { id, target = 'law' } = args;
        if (!id) {
          throw new Error('법령 id가 필요합니다.');
        }
        const data = await lawFetch('lawService.do', {
          OC: DEFAULT_OC_KEY,
          target,
          MST: id
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
        };
      }

      case 'korean_law_get_decision': {
        const { id } = args;
        if (!id) {
          throw new Error('판례 id가 필요합니다.');
        }
        const data = await lawFetch('lawService.do', {
          OC: DEFAULT_OC_KEY,
          target: 'prec',
          ID: id
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }
}
