// ============================================
// Per-(bank, product) flat tables. Each section mirrors its SQL schema 1:1.
// Add new tables by appending to TABLE_SECTIONS at the bottom.
// ============================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSync, faSpinner, faRotateRight } from '@fortawesome/free-solid-svg-icons';
import './PromissoryNotesPage.css';
import { formatCurrency } from './utils';

type Format = 'currency' | 'rate';

interface ColumnDef {
  key: string;
  sql: string;
  align?: 'right';
  format?: Format;
}

type LoadFn = () => Promise<{ success: boolean; data?: any[]; error?: string }>;
type SyncFn = (opts?: { startDate?: string; endDate?: string }) => Promise<unknown>;

interface TableSection {
  /** SQL slug (matches the table name). */
  slug: string;
  /** Bank-friendly title to display. */
  title: string;
  /** Optional sub-title (e.g. menu path). */
  subtitle?: string;
  /** Bank id used to gate the sync button. */
  bankId: string;
  /** Whether this section's sync needs a user-supplied date range. */
  acceptsDateRange?: boolean;
  /** Default date range when acceptsDateRange is true. */
  defaultDateRange?: () => { startDate: string; endDate: string };
  load: LoadFn;
  sync: SyncFn;
  columns: ColumnDef[];
}

// ------- Column definitions -------

const IBK_B2B_RECEIVABLES_COLS: ColumnDef[] = [
  { key: 'noteNumber', sql: 'note_number' },
  { key: 'serialNumber', sql: 'serial_number' },
  { key: 'buyerName', sql: 'buyer_name' },
  { key: 'buyerBizNo', sql: 'buyer_biz_no' },
  { key: 'kind', sql: 'kind' },
  { key: 'status', sql: 'status' },
  { key: 'cancellationRequested', sql: 'cancellation_requested' },
  { key: 'cashEquivalent', sql: 'cash_equivalent' },
  { key: 'receivableAmount', sql: 'receivable_amount', align: 'right', format: 'currency' },
  { key: 'originalNoteAmount', sql: 'original_note_amount', align: 'right', format: 'currency' },
  { key: 'registeredDate', sql: 'registered_date' },
  { key: 'maturityDate', sql: 'maturity_date' },
  { key: 'paymentDate', sql: 'payment_date' },
  { key: 'taxIssuedDate', sql: 'tax_issued_date' },
  { key: 'loanAvailableDate', sql: 'loan_available_date' },
  { key: 'loanExecuted', sql: 'loan_executed' },
  { key: 'loanAmount', sql: 'loan_amount', align: 'right', format: 'currency' },
  { key: 'depositAccountNumber', sql: 'deposit_account_number' },
  { key: 'paymentBranch', sql: 'payment_branch' },
  { key: 'seizureAmount', sql: 'seizure_amount', align: 'right', format: 'currency' },
  { key: 'seizureClaimant', sql: 'seizure_claimant' },
  { key: 'syncedAt', sql: 'synced_at' },
];

const WOORI_B2B_LOAN_EXECUTIONS_COLS: ColumnDef[] = [
  { key: 'transactionNumber', sql: 'transaction_number' },
  { key: 'receivableNumber', sql: 'receivable_number' },
  { key: 'vendor', sql: 'vendor' },
  { key: 'receivedDate', sql: 'received_date' },
  { key: 'depositDate', sql: 'deposit_date' },
  { key: 'receivableMaturityDate', sql: 'receivable_maturity_date' },
  { key: 'loanMaturityDate', sql: 'loan_maturity_date' },
  { key: 'appliedAmount', sql: 'applied_amount', align: 'right', format: 'currency' },
  { key: 'interestAmount', sql: 'interest_amount', align: 'right', format: 'currency' },
  { key: 'depositAmount', sql: 'deposit_amount', align: 'right', format: 'currency' },
  { key: 'receivableAmount', sql: 'receivable_amount', align: 'right', format: 'currency' },
  { key: 'loanBalance', sql: 'loan_balance', align: 'right', format: 'currency' },
  { key: 'loanInterestRate', sql: 'loan_interest_rate', align: 'right', format: 'rate' },
  { key: 'syncedAt', sql: 'synced_at' },
];

// ------- Helpers -------

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function firstOfThisMonthYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}01`;
}

function formatCell(value: unknown, format?: Format): string {
  if (value == null || value === '') return '';
  if (format === 'currency' && typeof value === 'number') {
    return formatCurrency(value);
  }
  if (format === 'rate' && typeof value === 'number') {
    return `${value.toFixed(2)}%`;
  }
  return String(value);
}

// ------- Section definitions (append new tables here) -------

const TABLE_SECTIONS: TableSection[] = [
  {
    slug: 'ibk_b2b_receivables',
    title: 'IBK 외상매출채권',
    subtitle: 'B2B → 판매기업 → 외상매출채권 → 채권조회/취소신청',
    bankId: 'ibk',
    load: () => window.electron.financeHubDb.getIbkB2bReceivables(),
    sync: async () => {
      return await window.electron.financeHub.syncPromissoryNotes('ibk');
    },
    columns: IBK_B2B_RECEIVABLES_COLS,
  },
  {
    slug: 'woori_b2b_loan_executions',
    title: 'Woori B2B대출(협력) 실행내역',
    subtitle: '전자결제 → B2B대출(협력) → 대출_신청 → 실행내역',
    bankId: 'woori',
    acceptsDateRange: true,
    defaultDateRange: () => ({ startDate: firstOfThisMonthYmd(), endDate: todayYmd() }),
    load: () => window.electron.financeHubDb.getWooriB2bLoanExecutions(),
    sync: async (opts) => {
      return await window.electron.financeHub.syncWooriB2bLoanExecutions(opts);
    },
    columns: WOORI_B2B_LOAN_EXECUTIONS_COLS,
  },
];

// ------- Section component -------

interface SectionProps {
  section: TableSection;
  /** Bank ids that have an active automator session (i.e. logged in). */
  connectedBankIds: Set<string>;
}

function Section({ section, connectedBankIds }: SectionProps) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialRange = useRef<{ startDate: string; endDate: string }>(
    section.acceptsDateRange && section.defaultDateRange
      ? section.defaultDateRange()
      : { startDate: '', endDate: '' },
  );
  const [startDate, setStartDate] = useState<string>(initialRange.current.startDate);
  const [endDate, setEndDate] = useState<string>(initialRange.current.endDate);

  const isConnected = connectedBankIds.has(section.bankId);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await section.load();
      if (res?.success && Array.isArray(res.data)) {
        setRows(res.data);
      } else {
        setError(res?.error || `Failed to load ${section.slug}`);
        setRows([]);
      }
    } catch (e: any) {
      setError(e?.message || String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [section]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSync = useCallback(async () => {
    setError(null);
    if (section.acceptsDateRange) {
      const today = todayYmd();
      if (!/^\d{8}$/.test(startDate) || !/^\d{8}$/.test(endDate)) {
        setError('날짜는 YYYYMMDD 형식이어야 합니다.');
        return;
      }
      if (startDate > endDate) {
        setError('시작일이 종료일보다 늦습니다.');
        return;
      }
      if (startDate > today || endDate > today) {
        setError(`미래 날짜는 조회할 수 없습니다 (오늘: ${today}).`);
        return;
      }
    }
    setSyncing(true);
    try {
      if (section.acceptsDateRange) {
        await section.sync({ startDate, endDate });
      } else {
        await section.sync();
      }
      await load();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setSyncing(false);
    }
  }, [section, load, startDate, endDate]);

  return (
    <div className="ibkrec-section">
      <div className="ibkrec-toolbar">
        <div className="ibkrec-title">
          <span className="ibkrec-title-main">{section.slug}</span>
          <span className="ibkrec-title-sub">
            {section.title} · {rows.length} rows
            {section.subtitle ? ` · ${section.subtitle}` : ''}
          </span>
        </div>
        <div className="ibkrec-actions">
          {section.acceptsDateRange && (
            <>
              <input
                className="ibkrec-input"
                type="text"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="YYYYMMDD"
                title="조회 시작일 (YYYYMMDD)"
              />
              <span className="ibkrec-dash">~</span>
              <input
                className="ibkrec-input"
                type="text"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="YYYYMMDD"
                title="조회 종료일 (YYYYMMDD)"
              />
            </>
          )}
          <button
            type="button"
            className="ibkrec-btn"
            onClick={() => void load()}
            disabled={loading}
            title="DB에서 다시 불러오기"
          >
            <FontAwesomeIcon icon={loading ? faSpinner : faRotateRight} spin={loading} />
            <span>새로고침</span>
          </button>
          <button
            type="button"
            className="ibkrec-btn ibkrec-btn--primary"
            onClick={() => void handleSync()}
            disabled={!isConnected || syncing}
            title={isConnected ? '은행에서 동기화' : `${section.bankId.toUpperCase()}에 먼저 로그인해 주세요`}
          >
            <FontAwesomeIcon icon={syncing ? faSpinner : faSync} spin={syncing} />
            <span>{syncing ? '동기화 중...' : '동기화'}</span>
          </button>
        </div>
      </div>

      {error && <div className="ibkrec-error">{error}</div>}

      <div className="ibkrec-table-wrap">
        <table className="ibkrec-table">
          <thead>
            <tr>
              {section.columns.map((c) => (
                <th key={c.key} className={c.align === 'right' ? 'ibkrec-cell--right' : undefined}>
                  {c.sql}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading ? (
              <tr>
                <td colSpan={section.columns.length} className="ibkrec-empty">
                  데이터 없음. 동기화를 실행해 주세요.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  {section.columns.map((c) => (
                    <td key={c.key} className={c.align === 'right' ? 'ibkrec-cell--right' : undefined}>
                      {formatCell(row[c.key], c.format)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ------- Page -------

export interface PromissoryNotesPageProps {
  /** Same handler as 계정 관리 → 어음 재동기화 (active automator + Excel import). Used for IBK. */
  onSyncPromissoryNotes?: (bankId: string) => Promise<void>;
  syncingBankId?: string | null;
  /** Banks currently connected (have active automator session). */
  promissorySyncBanks?: { bankId: string; displayName: string }[];
}

function PromissoryNotesPage({ promissorySyncBanks = [] }: PromissoryNotesPageProps) {
  const connectedBankIds = useMemo(
    () => new Set(promissorySyncBanks.map((b) => b.bankId)),
    [promissorySyncBanks],
  );

  return (
    <div className="ibkrec-page">
      {TABLE_SECTIONS.map((section) => (
        <Section key={section.slug} section={section} connectedBankIds={connectedBankIds} />
      ))}
    </div>
  );
}

export default PromissoryNotesPage;
