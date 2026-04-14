// ============================================
// Promissory Notes Page Component
// 어음 관리 (Promissory Note Management)
// ============================================

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFileInvoice,
  faFilter,
  faPlus,
  faDownload,
  faSync,
  faSpinner,
  faExclamationTriangle,
  faCheckCircle,
  faTimesCircle,
  faClock,
  faEdit,
  faChevronDown,
  faChevronUp,
  faBan,
  faExchangeAlt,
  faPercentage,
} from '@fortawesome/free-solid-svg-icons';
import './PromissoryNotesPage.css';
import { formatCurrency } from './utils';

// ============================================
// Types
// ============================================

interface PromissoryNote {
  id: string;
  accountId: string;
  bankId: string;
  bankName: string;
  accountNumber: string;
  noteNumber: string;
  noteType: 'issued' | 'received';
  issuerName: string;
  issuerRegistrationNumber?: string;
  payeeName: string;
  payeeRegistrationNumber?: string;
  amount: number;
  currency: string;
  issueDate: string;
  maturityDate: string;
  collectionDate?: string;
  status:
    | 'active'
    | 'collected'
    | 'dishonored'
    | 'cancelled'
    | 'endorsed'
    | 'discounted';
  processingBank?: string;
  bankBranch?: string;
  category?: string;
  memo?: string;
  isManual: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PromissoryNoteFilters {
  noteType: 'all' | 'issued' | 'received';
  status:
    | 'all'
    | 'active'
    | 'collected'
    | 'dishonored'
    | 'cancelled'
    | 'endorsed'
    | 'discounted';
  bankId: 'all' | string;
  startDate: string;
  endDate: string;
  searchText: string;
  urgency: 'all' | 'overdue' | 'maturing-7' | 'maturing-30';
}

export interface PromissoryNotesPageProps {
  /** Same handler as 계정 관리 → 어음 재동기화 (active automator + optional Excel import). */
  onSyncPromissoryNotes?: (bankId: string) => Promise<void>;
  syncingBankId?: string | null;
  /** Banks currently connected; used to choose which bank to sync. */
  promissorySyncBanks?: { bankId: string; displayName: string }[];
}

/** Map IPC / DB row (camelCase from main) to component model. */
const STATUS_SET = new Set<PromissoryNote['status']>([
  'active',
  'collected',
  'dishonored',
  'cancelled',
  'endorsed',
  'discounted',
]);

function mapDbRowToPromissoryNote(
  row: Record<string, unknown>,
): PromissoryNote {
  const st = String(row.status ?? 'active');
  const status = (
    STATUS_SET.has(st as PromissoryNote['status']) ? st : 'active'
  ) as PromissoryNote['status'];
  const nt = String(row.noteType ?? 'received');
  const noteType: PromissoryNote['noteType'] =
    nt === 'issued' ? 'issued' : 'received';
  return {
    id: String(row.id ?? ''),
    accountId: String(row.accountId ?? ''),
    bankId: String(row.bankId ?? ''),
    bankName: String(row.bankName ?? row.bankId ?? ''),
    accountNumber: String(row.accountNumber ?? ''),
    noteNumber: String(row.noteNumber ?? ''),
    noteType,
    issuerName: String(row.issuerName ?? ''),
    issuerRegistrationNumber:
      row.issuerRegistrationNumber != null
        ? String(row.issuerRegistrationNumber)
        : undefined,
    payeeName: String(row.payeeName ?? ''),
    payeeRegistrationNumber:
      row.payeeRegistrationNumber != null
        ? String(row.payeeRegistrationNumber)
        : undefined,
    amount: Number(row.amount) || 0,
    currency: String(row.currency ?? 'KRW'),
    issueDate: String(row.issueDate ?? ''),
    maturityDate: String(row.maturityDate ?? ''),
    collectionDate:
      row.collectionDate != null ? String(row.collectionDate) : undefined,
    status,
    processingBank:
      row.processingBank != null ? String(row.processingBank) : undefined,
    bankBranch: row.bankBranch != null ? String(row.bankBranch) : undefined,
    category: row.category != null ? String(row.category) : undefined,
    memo: row.memo != null ? String(row.memo) : undefined,
    isManual: Boolean(row.isManual),
    createdAt: String(row.createdAt ?? ''),
    updatedAt: String(row.updatedAt ?? ''),
  };
}

// ============================================
// Utility Functions
// ============================================

const getStatusColor = (status: PromissoryNote['status']): string => {
  const colors = {
    active: '#2196F3',
    collected: '#4CAF50',
    dishonored: '#F44336',
    cancelled: '#9E9E9E',
    endorsed: '#FF9800',
    discounted: '#9C27B0',
  };
  return colors[status] || '#757575';
};

const getStatusLabel = (status: PromissoryNote['status']): string => {
  const labels = {
    active: '정상',
    collected: '추심완료',
    dishonored: '부도',
    cancelled: '취소',
    endorsed: '배서',
    discounted: '할인',
  };
  return labels[status] || status;
};

const getStatusIcon = (status: PromissoryNote['status']) => {
  const icons = {
    active: faClock,
    collected: faCheckCircle,
    dishonored: faTimesCircle,
    cancelled: faBan,
    endorsed: faExchangeAlt,
    discounted: faPercentage,
  };
  return icons[status] || faClock;
};

const getDaysUntilMaturity = (maturityDate: string): number => {
  const today = new Date();
  const maturity = new Date(maturityDate);
  const diffTime = maturity.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

const getUrgencyClass = (note: PromissoryNote): string => {
  if (note.status !== 'active') return '';

  const daysUntil = getDaysUntilMaturity(note.maturityDate);

  if (daysUntil < 0) return 'overdue';
  if (daysUntil <= 7) return 'urgent';
  if (daysUntil <= 30) return 'warning';

  return '';
};

/** Active notes: surface maturity risk on the primary status chip (not just DB status). */
const getEffectiveStatusPresentation = (
  note: PromissoryNote,
): { label: string; backgroundColor: string; icon: IconDefinition } => {
  if (note.status !== 'active') {
    return {
      label: getStatusLabel(note.status),
      backgroundColor: getStatusColor(note.status),
      icon: getStatusIcon(note.status),
    };
  }
  const daysUntil = getDaysUntilMaturity(note.maturityDate);
  if (daysUntil < 0) {
    return {
      label: `연체 ${Math.abs(daysUntil)}일`,
      backgroundColor: '#DC2626',
      icon: faExclamationTriangle,
    };
  }
  if (daysUntil <= 7) {
    return {
      label: daysUntil === 0 ? '오늘 만기' : `만기 ${daysUntil}일 전`,
      backgroundColor: '#D97706',
      icon: faClock,
    };
  }
  return {
    label: getStatusLabel('active'),
    backgroundColor: getStatusColor('active'),
    icon: getStatusIcon('active'),
  };
};

// ============================================
// Main Component
// ============================================

function PromissoryNotesPage({
  onSyncPromissoryNotes,
  syncingBankId = null,
  promissorySyncBanks = [],
}: PromissoryNotesPageProps) {
  // ============================================
  // State
  // ============================================

  const [notes, setNotes] = useState<PromissoryNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [resyncBankId, setResyncBankId] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [filters, setFilters] = useState<PromissoryNoteFilters>({
    noteType: 'all',
    status: 'all',
    bankId: 'all',
    startDate: '',
    endDate: '',
    searchText: '',
    urgency: 'all',
  });

  // ============================================
  // Computed Values
  // ============================================

  const filteredNotes = useMemo(() => {
    let filtered = [...notes];

    // Note type filter
    if (filters.noteType !== 'all') {
      filtered = filtered.filter((note) => note.noteType === filters.noteType);
    }

    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter((note) => note.status === filters.status);
    }

    // Bank filter
    if (filters.bankId !== 'all') {
      filtered = filtered.filter((note) => note.bankId === filters.bankId);
    }

    // Date range filter
    if (filters.startDate) {
      filtered = filtered.filter(
        (note) => note.maturityDate >= filters.startDate,
      );
    }
    if (filters.endDate) {
      filtered = filtered.filter(
        (note) => note.maturityDate <= filters.endDate,
      );
    }

    // Search text filter
    if (filters.searchText) {
      const search = filters.searchText.toLowerCase();
      filtered = filtered.filter(
        (note) =>
          note.noteNumber.toLowerCase().includes(search) ||
          note.issuerName.toLowerCase().includes(search) ||
          note.payeeName.toLowerCase().includes(search) ||
          note.memo?.toLowerCase().includes(search),
      );
    }

    // Urgency filter
    if (filters.urgency !== 'all') {
      filtered = filtered.filter((note) => {
        if (note.status !== 'active') return false;
        const daysUntil = getDaysUntilMaturity(note.maturityDate);

        switch (filters.urgency) {
          case 'overdue':
            return daysUntil < 0;
          case 'maturing-7':
            return daysUntil >= 0 && daysUntil <= 7;
          case 'maturing-30':
            return daysUntil >= 0 && daysUntil <= 30;
          default:
            return true;
        }
      });
    }

    // Sort by maturity date (ascending for active, descending for others)
    filtered.sort((a, b) => {
      if (a.status === 'active' && b.status === 'active') {
        return (
          new Date(a.maturityDate).getTime() -
          new Date(b.maturityDate).getTime()
        );
      }
      return (
        new Date(b.maturityDate).getTime() - new Date(a.maturityDate).getTime()
      );
    });

    return filtered;
  }, [notes, filters]);

  // Summary statistics
  const stats = useMemo(() => {
    const activeNotes = notes.filter((n) => n.status === 'active');
    const issuedActive = activeNotes.filter((n) => n.noteType === 'issued');
    const receivedActive = activeNotes.filter((n) => n.noteType === 'received');
    const overdueNotes = activeNotes.filter(
      (n) => getDaysUntilMaturity(n.maturityDate) < 0,
    );
    const maturing7Days = activeNotes.filter((n) => {
      const days = getDaysUntilMaturity(n.maturityDate);
      return days >= 0 && days <= 7;
    });
    const maturing30Days = activeNotes.filter((n) => {
      const days = getDaysUntilMaturity(n.maturityDate);
      return days >= 0 && days <= 30;
    });

    return {
      totalActive: activeNotes.length,
      totalIssued: issuedActive.length,
      totalReceived: receivedActive.length,
      issuedAmount: issuedActive.reduce((sum, n) => sum + n.amount, 0),
      receivedAmount: receivedActive.reduce((sum, n) => sum + n.amount, 0),
      netAmount:
        receivedActive.reduce((sum, n) => sum + n.amount, 0) -
        issuedActive.reduce((sum, n) => sum + n.amount, 0),
      overdueCount: overdueNotes.length,
      maturing7Count: maturing7Days.length,
      maturing30Count: maturing30Days.length,
      totalCollected: notes.filter((n) => n.status === 'collected').length,
      totalDishonored: notes.filter((n) => n.status === 'dishonored').length,
    };
  }, [notes]);

  const loadPromissoryNotes = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await window.electron.financeHubDb.getPromissoryNotes();
      if (!res.success) {
        setLoadError(res.error || '목록을 불러오지 못했습니다.');
        setNotes([]);
        return;
      }
      const raw = Array.isArray(res.data) ? res.data : [];
      setNotes(
        raw.map((row) =>
          mapDbRowToPromissoryNote(row as Record<string, unknown>),
        ),
      );
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
      setNotes([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPromissoryNotes().catch(() => {});
  }, [loadPromissoryNotes]);

  useEffect(() => {
    if (promissorySyncBanks.length === 0) {
      setResyncBankId('');
      return;
    }
    setResyncBankId((prev) =>
      prev && promissorySyncBanks.some((b) => b.bankId === prev)
        ? prev
        : promissorySyncBanks[0].bankId,
    );
  }, [promissorySyncBanks]);

  // ============================================
  // Event Handlers
  // ============================================

  const handlePromissoryResync = async () => {
    if (!onSyncPromissoryNotes || !resyncBankId) return;
    try {
      await onSyncPromissoryNotes(resyncBankId);
    } finally {
      await loadPromissoryNotes();
    }
  };

  const handleResetFilters = () => {
    setFilters({
      noteType: 'all',
      status: 'all',
      bankId: 'all',
      startDate: '',
      endDate: '',
      searchText: '',
      urgency: 'all',
    });
  };

  const toggleNoteExpansion = (noteId: string) => {
    setExpandedNoteId(expandedNoteId === noteId ? null : noteId);
  };

  // ============================================
  // Render
  // ============================================

  return (
    <div className="promissory-notes-page">
      {/* Header */}
      <div className="promissory-notes-page-header">
        <div className="promissory-notes-page-header__title">
          <FontAwesomeIcon icon={faFileInvoice} />
          <h2>어음 관리</h2>
          <span className="promissory-notes-page-header__note-count">
            {filteredNotes.length}건
          </span>
        </div>
        <div className="promissory-notes-page-header__actions">
          <button
            type="button"
            className="promissory-notes-page-btn promissory-notes-page-btn--icon"
            onClick={() => setShowFilters(!showFilters)}
            title="필터"
          >
            <FontAwesomeIcon icon={faFilter} />
          </button>
          <button
            type="button"
            className="promissory-notes-page-btn promissory-notes-page-btn--icon"
            title="새로고침"
            disabled={isLoading}
            onClick={() => {
              loadPromissoryNotes().catch(() => {});
            }}
          >
            <FontAwesomeIcon icon={faSync} spin={isLoading} />
          </button>
          {onSyncPromissoryNotes && promissorySyncBanks.length > 0 && (
            <div className="promissory-notes-page-header__resync">
              <label className="promissory-notes-page-header__resync-label" htmlFor="promissory-resync-bank">
                은행
              </label>
              <select
                id="promissory-resync-bank"
                className="promissory-notes-page-header__resync-select"
                value={resyncBankId}
                onChange={(e) => setResyncBankId(e.target.value)}
                disabled={!!syncingBankId}
              >
                {promissorySyncBanks.map((b) => (
                  <option key={b.bankId} value={b.bankId}>
                    {b.displayName}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="promissory-notes-page-btn promissory-notes-page-btn--outline"
                title="은행 사이트에서 어음을 다시 받아 DB에 반영합니다"
                disabled={!resyncBankId || syncingBankId === resyncBankId}
                onClick={() => {
                  handlePromissoryResync().catch(() => {});
                }}
              >
                <FontAwesomeIcon
                  icon={syncingBankId === resyncBankId ? faSpinner : faSync}
                  spin={syncingBankId === resyncBankId}
                />
                <span>어음 재동기화</span>
              </button>
            </div>
          )}
          <button
            type="button"
            className="promissory-notes-page-btn promissory-notes-page-btn--primary"
            title="어음 추가"
          >
            <FontAwesomeIcon icon={faPlus} />
            <span>어음 추가</span>
          </button>
          <button
            type="button"
            className="promissory-notes-page-btn promissory-notes-page-btn--icon"
            title="내보내기"
          >
            <FontAwesomeIcon icon={faDownload} />
          </button>
        </div>
      </div>

      {loadError && (
        <div className="promissory-notes-page-load-error" role="alert">
          <FontAwesomeIcon icon={faExclamationTriangle} />
          <span>{loadError}</span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="promissory-notes-page-stats__cards">
        <div className="promissory-notes-page-stats__card">
          <div className="promissory-notes-page-stats__card-header">
            <span className="promissory-notes-page-stats__card-title">
              발행 어음
            </span>
            <span className="promissory-notes-page-stats__badge promissory-notes-page-stats__badge--issued">
              {stats.totalIssued}건
            </span>
          </div>
          <div className="promissory-notes-page-stats__amount promissory-notes-page-stats__amount--issued">
            {formatCurrency(stats.issuedAmount)}
          </div>
          <div className="promissory-notes-page-stats__card-footer">
            지급해야 할 금액
          </div>
        </div>

        <div className="promissory-notes-page-stats__card">
          <div className="promissory-notes-page-stats__card-header">
            <span className="promissory-notes-page-stats__card-title">
              받을 어음
            </span>
            <span className="promissory-notes-page-stats__badge promissory-notes-page-stats__badge--received">
              {stats.totalReceived}건
            </span>
          </div>
          <div className="promissory-notes-page-stats__amount promissory-notes-page-stats__amount--received">
            {formatCurrency(stats.receivedAmount)}
          </div>
          <div className="promissory-notes-page-stats__card-footer">
            받을 금액
          </div>
        </div>

        <div className="promissory-notes-page-stats__card">
          <div className="promissory-notes-page-stats__card-header">
            <span className="promissory-notes-page-stats__card-title">
              순 포지션
            </span>
          </div>
          <div
            className={`promissory-notes-page-stats__amount ${stats.netAmount >= 0 ? 'promissory-notes-page-stats__amount--positive' : 'promissory-notes-page-stats__amount--negative'}`}
          >
            {stats.netAmount >= 0 ? '+' : ''}
            {formatCurrency(stats.netAmount)}
          </div>
          <div className="promissory-notes-page-stats__card-footer">
            받을 어음 - 발행 어음
          </div>
        </div>

        <div className="promissory-notes-page-stats__card promissory-notes-page-stats__card--alert">
          <div className="promissory-notes-page-stats__card-header">
            <span className="promissory-notes-page-stats__card-title">
              주의 필요
            </span>
          </div>
          <div className="promissory-notes-page-stats__alerts">
            {stats.overdueCount > 0 && (
              <div className="promissory-notes-page-stats__alert-item promissory-notes-page-stats__alert-item--overdue">
                <FontAwesomeIcon icon={faExclamationTriangle} />
                <span>연체 {stats.overdueCount}건</span>
              </div>
            )}
            {stats.maturing7Count > 0 && (
              <div className="promissory-notes-page-stats__alert-item promissory-notes-page-stats__alert-item--urgent">
                <FontAwesomeIcon icon={faClock} />
                <span>7일내 만기 {stats.maturing7Count}건</span>
              </div>
            )}
            {stats.maturing30Count > 0 && (
              <div className="promissory-notes-page-stats__alert-item promissory-notes-page-stats__alert-item--warning">
                <FontAwesomeIcon icon={faClock} />
                <span>30일내 만기 {stats.maturing30Count}건</span>
              </div>
            )}
            {stats.overdueCount === 0 &&
              stats.maturing7Count === 0 &&
              stats.maturing30Count === 0 && (
                <div className="promissory-notes-page-stats__alert-item promissory-notes-page-stats__alert-item--ok">
                  <FontAwesomeIcon icon={faCheckCircle} />
                  <span>문제 없음</span>
                </div>
              )}
          </div>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="promissory-notes-page-filters">
          <div className="promissory-notes-page-filters__row">
            <div className="promissory-notes-page-filters__group">
              <label>구분</label>
              <select
                value={filters.noteType}
                onChange={(e) =>
                  setFilters({ ...filters, noteType: e.target.value as any })
                }
              >
                <option value="all">전체</option>
                <option value="issued">발행 어음</option>
                <option value="received">받을 어음</option>
              </select>
            </div>

            <div className="promissory-notes-page-filters__group">
              <label>상태</label>
              <select
                value={filters.status}
                onChange={(e) =>
                  setFilters({ ...filters, status: e.target.value as any })
                }
              >
                <option value="all">전체</option>
                <option value="active">정상</option>
                <option value="collected">추심완료</option>
                <option value="dishonored">부도</option>
                <option value="cancelled">취소</option>
                <option value="endorsed">배서</option>
                <option value="discounted">할인</option>
              </select>
            </div>

            <div className="promissory-notes-page-filters__group">
              <label>긴급도</label>
              <select
                value={filters.urgency}
                onChange={(e) =>
                  setFilters({ ...filters, urgency: e.target.value as any })
                }
              >
                <option value="all">전체</option>
                <option value="overdue">연체</option>
                <option value="maturing-7">7일내 만기</option>
                <option value="maturing-30">30일내 만기</option>
              </select>
            </div>

            <div className="promissory-notes-page-filters__group">
              <label>시작일</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) =>
                  setFilters({ ...filters, startDate: e.target.value })
                }
              />
            </div>

            <div className="promissory-notes-page-filters__group">
              <label>종료일</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) =>
                  setFilters({ ...filters, endDate: e.target.value })
                }
              />
            </div>

            <div className="promissory-notes-page-filters__group">
              <label>검색</label>
              <input
                type="text"
                placeholder="어음번호, 거래처명..."
                value={filters.searchText}
                onChange={(e) =>
                  setFilters({ ...filters, searchText: e.target.value })
                }
              />
            </div>

            <button
              type="button"
              className="promissory-notes-page-filters__btn-reset"
              onClick={handleResetFilters}
            >
              초기화
            </button>
          </div>
        </div>
      )}

      {/* Quick Filter Chips */}
      <div className="promissory-notes-page-quick-filters">
        <button
          type="button"
          className={`promissory-notes-page-quick-filters__chip ${filters.urgency === 'overdue' ? 'promissory-notes-page-quick-filters__chip--active' : ''}`}
          onClick={() =>
            setFilters({
              ...filters,
              urgency: filters.urgency === 'overdue' ? 'all' : 'overdue',
            })
          }
        >
          <FontAwesomeIcon icon={faExclamationTriangle} />
          연체 ({stats.overdueCount})
        </button>
        <button
          type="button"
          className={`promissory-notes-page-quick-filters__chip ${filters.urgency === 'maturing-7' ? 'promissory-notes-page-quick-filters__chip--active' : ''}`}
          onClick={() =>
            setFilters({
              ...filters,
              urgency: filters.urgency === 'maturing-7' ? 'all' : 'maturing-7',
            })
          }
        >
          <FontAwesomeIcon icon={faClock} />
          7일내 만기 ({stats.maturing7Count})
        </button>
        <button
          type="button"
          className={`promissory-notes-page-quick-filters__chip ${filters.noteType === 'issued' ? 'promissory-notes-page-quick-filters__chip--active' : ''}`}
          onClick={() =>
            setFilters({
              ...filters,
              noteType: filters.noteType === 'issued' ? 'all' : 'issued',
            })
          }
        >
          발행 어음 ({stats.totalIssued})
        </button>
        <button
          type="button"
          className={`promissory-notes-page-quick-filters__chip ${filters.noteType === 'received' ? 'promissory-notes-page-quick-filters__chip--active' : ''}`}
          onClick={() =>
            setFilters({
              ...filters,
              noteType: filters.noteType === 'received' ? 'all' : 'received',
            })
          }
        >
          받을 어음 ({stats.totalReceived})
        </button>
      </div>

      {/* Notes List */}
      <div className="promissory-notes-page-notes-list">
        {isLoading && (
          <div className="promissory-notes-page-empty-state">
            <FontAwesomeIcon icon={faSync} spin size="3x" />
            <h3>불러오는 중…</h3>
            <p>어음 목록을 가져오고 있습니다.</p>
          </div>
        )}
        {!isLoading && filteredNotes.length === 0 && (
          <div className="promissory-notes-page-empty-state">
            <FontAwesomeIcon icon={faFileInvoice} size="3x" />
            <h3>어음이 없습니다</h3>
            <p>필터 조건을 변경하거나 새로운 어음을 추가해보세요.</p>
          </div>
        )}
        {!isLoading &&
          filteredNotes.length > 0 &&
          filteredNotes.map((note) => {
            const isExpanded = expandedNoteId === note.id;
            const urgencyClass = getUrgencyClass(note);
            const statusPresentation = getEffectiveStatusPresentation(note);

            return (
              <div
                key={note.id}
                className={`promissory-notes-page-note-card ${urgencyClass ? `promissory-notes-page-note-card--${urgencyClass}` : ''} ${isExpanded ? 'promissory-notes-page-note-card--expanded' : ''}`}
              >
                <div
                  className="promissory-notes-page-note-card__header"
                  onClick={() => toggleNoteExpansion(note.id)}
                >
                  <div className="promissory-notes-page-note-card__main-info">
                    <div className="promissory-notes-page-note-card__type-indicator">
                      <span
                        className={`promissory-notes-page-note-card__type-badge promissory-notes-page-note-card__type-badge--${note.noteType}`}
                      >
                        {note.noteType === 'issued' ? '발행' : '받을'}
                      </span>
                    </div>

                    <div className="promissory-notes-page-note-card__core-info">
                      <div className="promissory-notes-page-note-card__note-number">
                        {note.noteNumber}
                      </div>
                      <div className="promissory-notes-page-note-card__counterparty">
                        {note.noteType === 'issued' ? (
                          <>수취인: {note.payeeName}</>
                        ) : (
                          <>발행인: {note.issuerName}</>
                        )}
                      </div>
                    </div>

                    <div className="promissory-notes-page-note-card__amount-section">
                      <div
                        className={`promissory-notes-page-note-card__amount promissory-notes-page-note-card__amount--${note.noteType}`}
                      >
                        {formatCurrency(note.amount)}
                      </div>
                      <div className="promissory-notes-page-note-card__bank-info">
                        {note.bankName}
                      </div>
                    </div>

                    <div className="promissory-notes-page-note-card__dates">
                      <div className="promissory-notes-page-note-card__date-item">
                        <span className="promissory-notes-page-note-card__date-label">
                          발행일
                        </span>
                        <span className="promissory-notes-page-note-card__date-value">
                          {note.issueDate}
                        </span>
                      </div>
                      <div className="promissory-notes-page-note-card__date-item">
                        <span className="promissory-notes-page-note-card__date-label">
                          만기일
                        </span>
                        <span className="promissory-notes-page-note-card__date-value">
                          {note.maturityDate}
                        </span>
                      </div>
                    </div>

                    <div className="promissory-notes-page-note-card__status-section">
                      <div
                        className="promissory-notes-page-note-card__status-badge"
                        style={{
                          backgroundColor: statusPresentation.backgroundColor,
                        }}
                      >
                        <FontAwesomeIcon icon={statusPresentation.icon} />
                        {statusPresentation.label}
                      </div>
                    </div>

                    <div className="promissory-notes-page-note-card__actions">
                      <button
                        type="button"
                        className="promissory-notes-page-btn promissory-notes-page-btn--icon-small"
                        title="수정"
                      >
                        <FontAwesomeIcon icon={faEdit} />
                      </button>
                      <button
                        type="button"
                        className="promissory-notes-page-btn promissory-notes-page-btn--expand"
                      >
                        <FontAwesomeIcon
                          icon={isExpanded ? faChevronUp : faChevronDown}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="promissory-notes-page-note-card__details">
                    <div className="promissory-notes-page-note-card__details-grid">
                      <div className="promissory-notes-page-note-card__detail-section">
                        <h4>발행인 정보</h4>
                        <div className="promissory-notes-page-note-card__detail-row">
                          <span className="promissory-notes-page-note-card__detail-label">
                            발행인:
                          </span>
                          <span className="promissory-notes-page-note-card__detail-value">
                            {note.issuerName}
                          </span>
                        </div>
                        {note.issuerRegistrationNumber && (
                          <div className="promissory-notes-page-note-card__detail-row">
                            <span className="promissory-notes-page-note-card__detail-label">
                              사업자번호:
                            </span>
                            <span className="promissory-notes-page-note-card__detail-value">
                              {note.issuerRegistrationNumber}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="promissory-notes-page-note-card__detail-section">
                        <h4>수취인 정보</h4>
                        <div className="promissory-notes-page-note-card__detail-row">
                          <span className="promissory-notes-page-note-card__detail-label">
                            수취인:
                          </span>
                          <span className="promissory-notes-page-note-card__detail-value">
                            {note.payeeName}
                          </span>
                        </div>
                        {note.payeeRegistrationNumber && (
                          <div className="promissory-notes-page-note-card__detail-row">
                            <span className="promissory-notes-page-note-card__detail-label">
                              사업자번호:
                            </span>
                            <span className="promissory-notes-page-note-card__detail-value">
                              {note.payeeRegistrationNumber}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="promissory-notes-page-note-card__detail-section">
                        <h4>은행 정보</h4>
                        <div className="promissory-notes-page-note-card__detail-row">
                          <span className="promissory-notes-page-note-card__detail-label">
                            계좌번호:
                          </span>
                          <span className="promissory-notes-page-note-card__detail-value">
                            {note.accountNumber}
                          </span>
                        </div>
                        {note.processingBank && (
                          <div className="promissory-notes-page-note-card__detail-row">
                            <span className="promissory-notes-page-note-card__detail-label">
                              추심은행:
                            </span>
                            <span className="promissory-notes-page-note-card__detail-value">
                              {note.processingBank}
                            </span>
                          </div>
                        )}
                        {note.bankBranch && (
                          <div className="promissory-notes-page-note-card__detail-row">
                            <span className="promissory-notes-page-note-card__detail-label">
                              지점:
                            </span>
                            <span className="promissory-notes-page-note-card__detail-value">
                              {note.bankBranch}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="promissory-notes-page-note-card__detail-section">
                        <h4>추가 정보</h4>
                        {note.category && (
                          <div className="promissory-notes-page-note-card__detail-row">
                            <span className="promissory-notes-page-note-card__detail-label">
                              분류:
                            </span>
                            <span className="promissory-notes-page-note-card__detail-value">
                              {note.category}
                            </span>
                          </div>
                        )}
                        {note.collectionDate && (
                          <div className="promissory-notes-page-note-card__detail-row">
                            <span className="promissory-notes-page-note-card__detail-label">
                              추심일:
                            </span>
                            <span className="promissory-notes-page-note-card__detail-value">
                              {note.collectionDate}
                            </span>
                          </div>
                        )}
                        <div className="promissory-notes-page-note-card__detail-row">
                          <span className="promissory-notes-page-note-card__detail-label">
                            입력방식:
                          </span>
                          <span className="promissory-notes-page-note-card__detail-value">
                            {note.isManual ? '수동입력' : '자동수집'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {note.memo && (
                      <div className="promissory-notes-page-note-card__detail-section promissory-notes-page-note-card__memo-section">
                        <h4>메모</h4>
                        <p>{note.memo}</p>
                      </div>
                    )}

                    <div className="promissory-notes-page-note-card__detail-actions">
                      {note.status === 'active' && (
                        <>
                          <button
                            type="button"
                            className="promissory-notes-page-btn promissory-notes-page-btn--action promissory-notes-page-btn--success"
                          >
                            <FontAwesomeIcon icon={faCheckCircle} />
                            추심완료 처리
                          </button>
                          <button
                            type="button"
                            className="promissory-notes-page-btn promissory-notes-page-btn--action promissory-notes-page-btn--danger"
                          >
                            <FontAwesomeIcon icon={faTimesCircle} />
                            부도 처리
                          </button>
                          <button
                            type="button"
                            className="promissory-notes-page-btn promissory-notes-page-btn--action"
                          >
                            <FontAwesomeIcon icon={faExchangeAlt} />
                            배서
                          </button>
                          <button
                            type="button"
                            className="promissory-notes-page-btn promissory-notes-page-btn--action"
                          >
                            <FontAwesomeIcon icon={faPercentage} />
                            할인
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        className="promissory-notes-page-btn promissory-notes-page-btn--action promissory-notes-page-btn--secondary"
                      >
                        <FontAwesomeIcon icon={faEdit} />
                        수정
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}

export default PromissoryNotesPage;
