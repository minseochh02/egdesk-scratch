import React, { useState, useRef, useCallback, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faGavel,
  faSearch,
  faSpinner,
  faArrowLeft,
  faBookOpen,
  faBalanceScale,
  faBuildingColumns,
  faFileLines,
  faRobot,
  faPaperPlane,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import { AIService } from '../../services/ai-service';
import { aiKeysStore } from '../AIKeysManager/store/aiKeysStore';
import type { AIStreamEvent } from '../../../main/types/ai-types';
import { AIEventType } from '../../../main/types/ai-types';
import './LawyerPage.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type PageMode = 'search' | 'chat';

type SearchTarget = 'law' | 'prec' | 'admrul' | 'ordin';

interface SearchTargetOption {
  value: SearchTarget;
  label: string;
  icon: any;
  description: string;
}

type SearchResult = Record<string, any>;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

const LAW_SYSTEM_PROMPT = `당신은 대한민국 법률 전문가 AI 어시스턴트입니다. 사용자의 법률 질문에 답변할 때 반드시 korean_law_search, korean_law_get_text, korean_law_get_decision 도구를 활용하여 실제 법령과 판례를 검색하고 인용하세요.

# 도구 사용 전략

## 법령 검색 (target: "law")
- 법령명 또는 핵심 키워드로 검색 → korean_law_get_text로 관련 조문 전문 확인
- 예: "근로기준법", "손해배상", "민법 불법행위"

## 판례 검색 (target: "prec") — 중요한 API 한계
**이 API는 판결 본문이 아니라 사건명(evtNm)만 검색합니다.**
- 사건명은 "손해배상(기)", "부당해고구제재심판정취소" 같은 법적 청구 유형으로 구성됨
- 실생활 키워드("인수인계", "퇴사", "야근")는 사건명에 등장하지 않으므로 0건이 나올 수 있음
- **올바른 판례 검색 전략 (반드시 아래 순서로 시도):**
  1. 법적 청구 유형으로 검색: "손해배상(기)", "채무불이행", "부당해고" 등
  2. 단일 법률 용어로 검색: "불법행위", "신의칙", "해고" 등
  3. 관련 법령명으로 검색: "근로기준법", "민법" 등
  4. 위 시도 후에도 0건이면 → 이 API의 한계임을 명시하고, 로앤비·대법원 종합법률정보에서 전문 검색 권고

## 검색 실패 시 처리 원칙
- **절대로 단 한 번의 검색으로 "판례가 없다"고 결론 내리지 말 것**
- 최소 3가지 다른 키워드/방식으로 재시도할 것
- 0건 결과 후에는 반드시 더 넓은 법적 개념으로 재검색
- 최종적으로 관련 판례를 찾지 못한 경우, 이 API가 판결 본문 전문 검색을 지원하지 않는다는 사실을 명시하고 다른 DB 이용을 권고

# 답변 형식
- 관련 법령은 조문 번호와 출처(법령명, 시행일) 명시
- 판례는 반드시 사건번호 + 법원명 + 선고일 형식으로 인용: 예) 대법원 2020. 5. 14. 선고 2016다239024 판결
- 일반인이 이해할 수 있는 쉬운 언어로 설명
- 법적 불확실성이 있는 경우 솔직하게 명시하고 전문가 상담 권고`;

// ─── Constants ────────────────────────────────────────────────────────────────

const SEARCH_TARGETS: SearchTargetOption[] = [
  { value: 'law',    label: '법령',     icon: faBookOpen,        description: '현행 법률·시행령·시행규칙' },
  { value: 'prec',   label: '판례',     icon: faBalanceScale,    description: '대법원·헌법재판소 판례' },
  { value: 'admrul', label: '행정규칙', icon: faBuildingColumns, description: '고시·훈령·예규' },
  { value: 'ordin',  label: '자치법규', icon: faFileLines,       description: '조례·규칙' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractItems(data: any, target: SearchTarget): SearchResult[] {
  if (!data) return [];
  const map: Record<string, [string, string]> = {
    law:    ['LawSearch',    'law'],
    prec:   ['PrecSearch',   'prec'],
    admrul: ['admRulSearch', 'admRul'],
    ordin:  ['OrdinSearch',  'ordin'],
  };
  const [wrapper, item] = map[target] ?? ['LawSearch', 'law'];
  const root = data[wrapper] ?? data;
  const items = root[item] ?? [];
  return Array.isArray(items) ? items : [items];
}

function getTotalCount(data: any, target: SearchTarget): number {
  const map: Record<string, string> = {
    law: 'LawSearch', prec: 'PrecSearch', admrul: 'admRulSearch', ordin: 'OrdinSearch',
  };
  const root = data?.[map[target]] ?? data ?? {};
  return parseInt(root['totalCnt'] ?? root['totalCount'] ?? '0', 10);
}

function getTitle(item: SearchResult): string {
  return item['법령명한글'] ?? item['법령명_한글'] ?? item['법령명']
    ?? item['사건명'] ?? item['제목'] ?? '(제목 없음)';
}

function getId(item: SearchResult): string {
  return item['MST'] ?? item['법령ID'] ?? item['판례정보일련번호'] ?? item['ID'] ?? '';
}

function getMeta(item: SearchResult): string[] {
  const parts: string[] = [];
  if (item['소관부처명']) parts.push(item['소관부처명']);
  if (item['법령구분명']) parts.push(item['법령구분명']);
  if (item['시행일자'])   parts.push(`시행 ${item['시행일자']}`);
  if (item['공포일자'])   parts.push(`공포 ${item['공포일자']}`);
  if (item['법원명'])     parts.push(item['법원명']);
  if (item['선고일자'])   parts.push(`선고 ${item['선고일자']}`);
  if (item['사건번호'])   parts.push(item['사건번호']);
  if (item['사건종류명']) parts.push(item['사건종류명']);
  return parts;
}

function extractText(data: any): string {
  if (!data) return '';
  const serviceKeys = ['LawService', 'PrecService', 'admRulService', 'OrdinService'];
  for (const k of serviceKeys) {
    if (!data[k]) continue;
    const svc = data[k];
    if (svc['조문']) {
      const arr = Array.isArray(svc['조문']) ? svc['조문'] : [svc['조문']];
      return arr.map((j: any) => {
        const num = j['조문번호'] ? `제${j['조문번호']}조` : '';
        return [num, j['조문내용'] ?? ''].filter(Boolean).join(' ');
      }).join('\n\n');
    }
    const flat = svc['법령본문'] ?? svc['판례내용'] ?? svc['내용'] ?? '';
    if (flat) return flat;
  }
  return JSON.stringify(data, null, 2);
}

// ─── Component ────────────────────────────────────────────────────────────────

const LawyerPage: React.FC = () => {
  const [pageMode, setPageMode] = useState<PageMode>('search');

  // ── Search state ────────────────────────────────────────────────────────────
  const [activeTarget, setActiveTarget] = useState<SearchTarget>('law');
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [searchError, setSearchError] = useState('');

  const [selectedItem, setSelectedItem] = useState<SearchResult | null>(null);
  const [itemText, setItemText] = useState('');
  const [isLoadingText, setIsLoadingText] = useState(false);
  const [textError, setTextError] = useState('');

  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── Chat state ──────────────────────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleChatSend = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || isChatLoading) return;

    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: text }]);
    setIsChatLoading(true);

    // Add streaming assistant placeholder
    setChatMessages(prev => [...prev, { role: 'assistant', content: '', isStreaming: true }]);

    try {
      // Auto-configure AI if not yet configured
      const isConfigured = await AIService.isConfigured();
      if (!isConfigured) {
        const googleKey = aiKeysStore.getState().keys.find(
          k => k.providerId === 'google' && k.isActive
        );
        const apiKey = (googleKey?.fields as any)?.apiKey || '';
        if (!apiKey) {
          throw new Error('Google AI 키가 설정되지 않았습니다. 설정에서 Gemini API 키를 추가하세요.');
        }
        await AIService.configure({ apiKey, model: 'gemini-2.5-flash' });
      }

      const { conversationId } = await AIService.startAutonomousConversation(
        text,
        {
          toolContext: 'korean-law',
          maxTurns: 10,
          context: { systemPrompt: LAW_SYSTEM_PROMPT },
        },
        (event: AIStreamEvent) => {
          if (event.type === AIEventType.Content) {
            const chunk = (event as any).content ?? '';
            setChatMessages(prev => {
              const msgs = [...prev];
              const last = msgs[msgs.length - 1];
              if (last?.role === 'assistant') {
                msgs[msgs.length - 1] = { ...last, content: last.content + chunk };
              }
              return msgs;
            });
          } else if (event.type === AIEventType.Finished || event.type === AIEventType.Error) {
            const errMsg = event.type === AIEventType.Error ? (event as any).error?.message : null;
            setChatMessages(prev => {
              const msgs = [...prev];
              const last = msgs[msgs.length - 1];
              if (last?.role === 'assistant') {
                msgs[msgs.length - 1] = {
                  ...last,
                  content: last.content || (errMsg ? `오류: ${errMsg}` : '(응답 없음)'),
                  isStreaming: false,
                };
              }
              return msgs;
            });
            setIsChatLoading(false);
            AIService.unregisterStreamEventListener(conversationId);
          }
        }
      );
    } catch (e: any) {
      setChatMessages(prev => {
        const msgs = [...prev];
        const last = msgs[msgs.length - 1];
        if (last?.role === 'assistant') {
          msgs[msgs.length - 1] = { ...last, content: `오류: ${e.message}`, isStreaming: false };
        }
        return msgs;
      });
      setIsChatLoading(false);
    }
  }, [chatInput, isChatLoading]);

  const handleSearch = useCallback(async (overridePage = 1) => {
    if (!query.trim()) { setSearchError('검색어를 입력하세요.'); return; }

    setIsSearching(true);
    setSearchError('');
    setSelectedItem(null);
    setItemText('');

    const result = await (window as any).electron.invoke('korean-law:search', {
      query: query.trim(),
      target: activeTarget,
      display: 20,
      page: overridePage,
    });

    setIsSearching(false);

    if (!result.success) {
      setSearchError(result.error ?? '검색 중 오류가 발생했습니다.');
      return;
    }

    const items = extractItems(result.data, activeTarget);
    setResults(items);
    setPage(overridePage);
    setTotalCount(getTotalCount(result.data, activeTarget));
    if (items.length === 0) setSearchError('검색 결과가 없습니다.');
  }, [query, activeTarget]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch(1);
  };

  const handleSelectItem = async (item: SearchResult) => {
    setSelectedItem(item);
    setItemText('');
    setTextError('');
    setIsLoadingText(true);

    const id = getId(item);
    if (!id) {
      setTextError('이 항목의 상세 ID를 찾을 수 없습니다.');
      setIsLoadingText(false);
      return;
    }

    const channel = activeTarget === 'prec'
      ? 'korean-law:get-decision-text'
      : 'korean-law:get-text';

    const result = await (window as any).electron.invoke(channel, {
      id,
      target: activeTarget,
    });

    setIsLoadingText(false);

    if (!result.success) {
      setTextError(result.error ?? '본문을 불러오지 못했습니다.');
      return;
    }

    setItemText(extractText(result.data));
  };

  const currentTarget = SEARCH_TARGETS.find(t => t.value === activeTarget)!;
  const totalPages = Math.ceil(totalCount / 20);

  return (
    <div className="lawyer-page">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="lawyer-header">
        <div className="lawyer-header-icon">
          <FontAwesomeIcon icon={faGavel} />
        </div>
        <div className="lawyer-header-content">
          <h2 className="lawyer-title">{pageMode === 'chat' ? 'AI 법률 상담' : '법률 검색'}</h2>
          <p className="lawyer-subtitle">법제처 Open API — 법령·판례·행정규칙 통합 검색</p>
        </div>
        {/* Mode toggle */}
        <div className="lawyer-mode-toggle">
          <button
            className={`lawyer-mode-btn ${pageMode === 'search' ? 'is-active' : ''}`}
            onClick={() => setPageMode('search')}
          >
            <FontAwesomeIcon icon={faSearch} />
            <span>검색</span>
          </button>
          <button
            className={`lawyer-mode-btn ${pageMode === 'chat' ? 'is-active' : ''}`}
            onClick={() => setPageMode('chat')}
          >
            <FontAwesomeIcon icon={faRobot} />
            <span>AI 상담</span>
          </button>
        </div>
      </div>

      {/* ── Chat Mode ──────────────────────────────────────────────────── */}
      {pageMode === 'chat' && (
        <div className="law-chat">
          <div className="law-chat-messages">
            {chatMessages.length === 0 && (
              <div className="law-chat-empty">
                <FontAwesomeIcon icon={faRobot} className="law-chat-empty-icon" />
                <p>법률 질문을 입력하면 AI가 관련 법령과 판례를 검색하여 답변드립니다.</p>
                <p className="law-chat-hint">예: "근로기준법상 연차휴가 일수는?", "교통사고 합의금 분쟁 판례"</p>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={`law-chat-msg law-chat-msg--${msg.role}`}>
                <div className="law-chat-bubble">
                  {msg.content || (msg.isStreaming ? <FontAwesomeIcon icon={faSpinner} spin /> : '')}
                </div>
              </div>
            ))}
            <div ref={chatBottomRef} />
          </div>
          <div className="law-chat-input-row">
            <button
              className="law-chat-clear-btn"
              onClick={() => setChatMessages([])}
              title="대화 초기화"
              disabled={isChatLoading}
            >
              <FontAwesomeIcon icon={faTrash} />
            </button>
            <input
              ref={chatInputRef}
              className="law-chat-input"
              type="text"
              placeholder="법률 질문을 입력하세요…"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) handleChatSend(); }}
              disabled={isChatLoading}
            />
            <button
              className="law-chat-send-btn"
              onClick={handleChatSend}
              disabled={isChatLoading || !chatInput.trim()}
            >
              {isChatLoading
                ? <FontAwesomeIcon icon={faSpinner} spin />
                : <FontAwesomeIcon icon={faPaperPlane} />}
            </button>
          </div>
        </div>
      )}

      {/* ── Search Mode ────────────────────────────────────────────────── */}
      {pageMode === 'search' && <>
      {/* ── Target Tabs ────────────────────────────────────────────────── */}
      <div className="lawyer-tabs">
        {SEARCH_TARGETS.map(t => (
          <button
            key={t.value}
            className={`lawyer-tab ${activeTarget === t.value ? 'is-active' : ''}`}
            onClick={() => {
              setActiveTarget(t.value);
              setResults([]);
              setSearchError('');
              setSelectedItem(null);
            }}
          >
            <FontAwesomeIcon icon={t.icon} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── Search Bar ─────────────────────────────────────────────────── */}
      <div className="lawyer-search-bar">
        <div className="lawyer-search-input-wrap">
          <FontAwesomeIcon icon={faSearch} className="lawyer-search-icon" />
          <input
            ref={searchInputRef}
            className="lawyer-search-input"
            type="text"
            placeholder={`${currentTarget.label} 검색 — ${currentTarget.description}`}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <button
          className="lawyer-search-btn"
          onClick={() => handleSearch(1)}
          disabled={isSearching}
        >
          {isSearching
            ? <FontAwesomeIcon icon={faSpinner} spin />
            : <FontAwesomeIcon icon={faSearch} />}
          검색
        </button>
      </div>

      {/* ── Error ──────────────────────────────────────────────────────── */}
      {searchError && <div className="lawyer-error">{searchError}</div>}

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="lawyer-body">
        {/* Results List */}
        {results.length > 0 && (
          <div className={`lawyer-results ${selectedItem ? 'lawyer-results--narrow' : ''}`}>
            <div className="lawyer-results-header">
              <span className="lawyer-results-count">총 {totalCount.toLocaleString()}건</span>
              {totalPages > 1 && (
                <div className="lawyer-pagination">
                  <button
                    className="lawyer-page-btn"
                    disabled={page <= 1}
                    onClick={() => handleSearch(page - 1)}
                  >이전</button>
                  <span className="lawyer-page-info">{page} / {totalPages}</span>
                  <button
                    className="lawyer-page-btn"
                    disabled={page >= totalPages}
                    onClick={() => handleSearch(page + 1)}
                  >다음</button>
                </div>
              )}
            </div>

            <ul className="lawyer-result-list">
              {results.map((item, i) => {
                const title = getTitle(item);
                const meta  = getMeta(item);
                const isSelected = selectedItem && getId(selectedItem) === getId(item);
                return (
                  <li
                    key={i}
                    className={`lawyer-result-item ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => handleSelectItem(item)}
                  >
                    <div className="lawyer-result-title">{title}</div>
                    {meta.length > 0 && (
                      <div className="lawyer-result-meta">
                        {meta.map((m, j) => <span key={j} className="lawyer-meta-tag">{m}</span>)}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Text Viewer */}
        {selectedItem && (
          <div className="lawyer-viewer">
            <div className="lawyer-viewer-header">
              <button
                className="lawyer-back-btn"
                onClick={() => { setSelectedItem(null); setItemText(''); }}
              >
                <FontAwesomeIcon icon={faArrowLeft} />
              </button>
              <h3 className="lawyer-viewer-title">{getTitle(selectedItem)}</h3>
            </div>
            <div className="lawyer-viewer-meta">
              {getMeta(selectedItem).map((m, i) => (
                <span key={i} className="lawyer-meta-tag">{m}</span>
              ))}
            </div>
            <div className="lawyer-viewer-body">
              {isLoadingText && (
                <div className="lawyer-viewer-loading">
                  <FontAwesomeIcon icon={faSpinner} spin />
                  <span>본문 불러오는 중…</span>
                </div>
              )}
              {textError && <div className="lawyer-error">{textError}</div>}
              {!isLoadingText && !textError && itemText && (
                <pre className="lawyer-viewer-text">{itemText}</pre>
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {results.length === 0 && !isSearching && !searchError && (
          <div className="lawyer-empty">
            <FontAwesomeIcon icon={faGavel} className="lawyer-empty-icon" />
            <h3>법률 검색</h3>
            <p>검색어를 입력하고 Enter를 누르거나 검색 버튼을 클릭하세요.</p>
          </div>
        )}
      </div>
      </>}
    </div>
  );
};

export default LawyerPage;
