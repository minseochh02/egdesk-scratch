import React, { useState, useRef, useCallback } from 'react';
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
} from '@fortawesome/free-solid-svg-icons';
import './LawyerPage.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type SearchTarget = 'law' | 'prec' | 'admrul' | 'ordin';

interface SearchTargetOption {
  value: SearchTarget;
  label: string;
  icon: any;
  description: string;
}

type SearchResult = Record<string, any>;

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
          <h2 className="lawyer-title">법률 검색</h2>
          <p className="lawyer-subtitle">법제처 Open API — 법령·판례·행정규칙 통합 검색</p>
        </div>
      </div>

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
    </div>
  );
};

export default LawyerPage;
