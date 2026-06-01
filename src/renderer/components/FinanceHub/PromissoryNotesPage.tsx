// ============================================
// Per-(bank, product) flat tables. Each section mirrors its SQL schema 1:1.
// Add new tables by appending to TABLE_SECTIONS at the bottom.
// ============================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSync, faSpinner, faSyncAlt, faUpload } from '@fortawesome/free-solid-svg-icons';
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

export type BankProductSyncResult = {
  success?: boolean;
  error?: string;
  imported?: number;
  skipped?: number;
  importError?: string;
  filePath?: string;
  importWarnings?: string[];
};

type RunBankProductSyncFn = (
  bankId: string,
  syncFn: () => Promise<BankProductSyncResult>,
  label: string,
) => Promise<BankProductSyncResult>;

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
  /** Whether this section allows manual Excel upload. */
  canImportExcel?: boolean;
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

const IBK_ENDORSEMENTS_COLS: ColumnDef[] = [
  { key: 'noteNumber', sql: 'note_number' },
  { key: 'issuerName', sql: 'issuer_name' },
  { key: 'issuerBizNo', sql: 'issuer_biz_no' },
  { key: 'issueDate', sql: 'issue_date' },
  { key: 'maturityDate', sql: 'maturity_date' },
  { key: 'endorserName', sql: 'endorser_name' },
  { key: 'endorserIdNo', sql: 'endorser_id_no' },
  { key: 'status', sql: 'status' },
  { key: 'endorsementDate', sql: 'endorsement_date' },
  { key: 'unsecuredEndorsement', sql: 'unsecured_endorsement' },
  { key: 'endorsementProhibited', sql: 'endorsement_prohibited' },
  { key: 'guaranteed', sql: 'guaranteed' },
  { key: 'defaultDate', sql: 'default_date' },
  { key: 'finalPaymentDate', sql: 'final_payment_date' },
  { key: 'paymentBankBranchCode', sql: 'payment_bank_branch_code' },
  { key: 'paymentBankBranchName', sql: 'payment_bank_branch_name' },
  { key: 'issuerCheckingAccount', sql: 'issuer_checking_account' },
  { key: 'endorserDepositAccount', sql: 'endorser_deposit_account' },
  { key: 'splitNumber', sql: 'split_number' },
  { key: 'endorsementNumber', sql: 'endorsement_number' },
  { key: 'endorsementAmount', sql: 'endorsement_amount', align: 'right', format: 'currency' },
  { key: 'endorseeName', sql: 'endorsee_name' },
  { key: 'endorseeIdNo', sql: 'endorsee_id_no' },
  { key: 'endorseeDepositAccount', sql: 'endorsee_deposit_account' },
  { key: 'syncedAt', sql: 'synced_at' },
];

const IBK_LOAN_HISTORY_COLS: ColumnDef[] = [
  { key: 'accountNumber', sql: 'account_number' },
  { key: 'transactionDate', sql: 'transaction_date' },
  { key: 'description', sql: 'description' },
  { key: 'currency', sql: 'currency' },
  { key: 'amount', sql: 'amount', align: 'right', format: 'currency' },
  { key: 'interest', sql: 'interest', align: 'right', format: 'currency' },
  { key: 'fee', sql: 'fee', align: 'right', format: 'currency' },
  { key: 'balance', sql: 'balance', align: 'right', format: 'currency' },
  { key: 'interestStartDate', sql: 'interest_start_date' },
  { key: 'interestEndDate', sql: 'interest_end_date' },
  { key: 'interestRate', sql: 'interest_rate', align: 'right', format: 'rate' },
  { key: 'branch', sql: 'branch' },
  { key: 'syncedAt', sql: 'synced_at' },
];

const HANA_LOAN_HISTORY_COLS: ColumnDef[] = [
  { key: 'accountNumber', sql: 'account_number' },
  { key: 'transactionDate', sql: 'transaction_date' },
  { key: 'description', sql: 'description' },
  { key: 'currency', sql: 'currency' },
  { key: 'amount', sql: 'amount', align: 'right', format: 'currency' },
  { key: 'interest', sql: 'interest', align: 'right', format: 'currency' },
  { key: 'fee', sql: 'fee', align: 'right', format: 'currency' },
  { key: 'balance', sql: 'balance', align: 'right', format: 'currency' },
  { key: 'interestStartDate', sql: 'interest_start_date' },
  { key: 'interestEndDate', sql: 'interest_end_date' },
  { key: 'interestRate', sql: 'interest_rate', align: 'right', format: 'rate' },
  { key: 'branch', sql: 'branch' },
  { key: 'syncedAt', sql: 'synced_at' },
];

const IBK_FOREIGN_CURRENCY_HISTORY_COLS: ColumnDef[] = [
  { key: 'accountNumber', sql: 'account_number' },
  { key: 'transactionDatetime', sql: 'transaction_datetime' },
  { key: 'currency', sql: 'currency' },
  { key: 'credit', sql: 'credit', align: 'right', format: 'currency' },
  { key: 'debit', sql: 'debit', align: 'right', format: 'currency' },
  { key: 'balance', sql: 'balance', align: 'right', format: 'currency' },
  { key: 'memo', sql: 'memo' },
  { key: 'exportAccountNumber', sql: 'export_account_number' },
  { key: 'foreignBuyer', sql: 'foreign_buyer' },
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

function daysAgoYmd(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function oneYearAgoYmd(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

/** IBK 배서내역: inclusive 12-month max = 364 days back from today (not 365). */
function ibkEndorsementsStartYmd(): string {
  return daysAgoYmd(364);
}

function formatCell(value: unknown, format?: Format, currency?: string): string {
  if (value == null || value === '') return '';
  if (format === 'currency' && typeof value === 'number') {
    return formatCurrency(value, currency);
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
    subtitle: '전자결제 → B2B 대출(협력) → 대출신청 → 실행내역',
    bankId: 'woori',
    acceptsDateRange: true,
    defaultDateRange: () => ({ startDate: firstOfThisMonthYmd(), endDate: todayYmd() }),
    load: () => window.electron.financeHubDb.getWooriB2bLoanExecutions(),
    sync: async (opts) => {
      return await window.electron.financeHub.syncWooriB2bLoanExecutions(opts);
    },
    columns: WOORI_B2B_LOAN_EXECUTIONS_COLS,
  },
  {
    slug: 'ibk_endorsements',
    title: 'IBK 배서내역',
    subtitle: 'B2B → 전자어음 → 조회 → 배서내역조회 (최대 12개월, 364일)',
    bankId: 'ibk',
    acceptsDateRange: true,
    canImportExcel: true,
    defaultDateRange: () => ({ startDate: ibkEndorsementsStartYmd(), endDate: todayYmd() }),
    load: () => window.electron.financeHubDb.getIbkEndorsements(),
    sync: async (opts) => {
      return await window.electron.financeHub.syncIbkEndorsements(opts);
    },
    columns: IBK_ENDORSEMENTS_COLS,
  },
  {
    slug: 'ibk_loan_history',
    title: 'IBK 대출거래내역',
    subtitle: '뱅킹업무 → 대출 → 대출조회 → 거래내역조회',
    bankId: 'ibk',
    acceptsDateRange: true,
    canImportExcel: true,
    defaultDateRange: () => ({ startDate: oneYearAgoYmd(), endDate: todayYmd() }),
    load: () => window.electron.financeHubDb.getIbkLoanHistory(),
    sync: async (opts) => {
      return await window.electron.financeHub.syncIbkLoanHistory(opts);
    },
    columns: IBK_LOAN_HISTORY_COLS,
  },
  {
    slug: 'hana_loan_history',
    title: '하나 대출상세내역',
    subtitle: '상품가입•대출 → 대출조회 → 거래내역/대출계산서 조회',
    bankId: 'hana',
    acceptsDateRange: true,
    canImportExcel: true,
    defaultDateRange: () => ({ startDate: oneYearAgoYmd(), endDate: todayYmd() }),
    load: () => window.electron.financeHubDb.getHanaLoanHistory(),
    sync: async (opts) => {
      return await window.electron.financeHub.syncHanaLoanHistory(opts);
    },
    columns: HANA_LOAN_HISTORY_COLS,
  },
  {
    slug: 'ibk_foreign_currency_history',
    title: 'IBK 외화거래내역',
    subtitle: '뱅킹업무 → 대출 → 거래내역조회 → 외화 탭 (대출·신탁·펀드 포함 전체 sync)',
    bankId: 'ibk',
    acceptsDateRange: true,
    canImportExcel: true,
    defaultDateRange: () => ({ startDate: oneYearAgoYmd(), endDate: todayYmd() }),
    load: () => window.electron.financeHubDb.getIbkForeignCurrencyHistory(),
    sync: async (opts) => {
      // Foreign currency is synced inside syncLoanTransactions (외화 tab on 거래내역조회 page).
      const result = await window.electron.financeHub.syncIbkLoanHistory(opts);
      if (result && typeof result === 'object' && result.success) {
        const foreignImported =
          typeof (result as { foreign?: { imported?: number } }).foreign?.imported === 'number'
            ? (result as { foreign: { imported: number } }).foreign.imported
            : 0;
        return { ...result, imported: foreignImported };
      }
      return result;
    },
    columns: IBK_FOREIGN_CURRENCY_HISTORY_COLS,
  },
];

// ------- Section component -------

interface SectionProps {
  section: TableSection;
  /** Bank ids that have an active automator session (i.e. logged in). */
  connectedBankIds: Set<string>;
  onRunBankProductSync?: RunBankProductSyncFn;
  syncingBankId?: string | null;
}

function Section({ section, connectedBankIds, onRunBankProductSync, syncingBankId }: SectionProps) {
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
  const isSyncingThisBank = syncingBankId === section.bankId;

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
      const syncFn = async (): Promise<BankProductSyncResult> => {
        const raw = section.acceptsDateRange
          ? await section.sync({ startDate, endDate })
          : await section.sync();
        return (raw && typeof raw === 'object' ? raw : { success: false, error: '동기화 응답 없음' }) as BankProductSyncResult;
      };

      const result = onRunBankProductSync
        ? await onRunBankProductSync(section.bankId, syncFn, section.title)
        : await syncFn();

      if (!result.success) {
        setError(result.error || '동기화 실패');
        return;
      }

      if (result.importError) {
        setError(`DB 반영 실패: ${result.importError}`);
      }

      await load();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setSyncing(false);
    }
  }, [section, load, startDate, endDate, onRunBankProductSync]);

  const handleFileUpload = useCallback(async () => {
    setError(null);
    try {
      const { filePaths, canceled } = await window.electron.dialog.showOpenDialog({
        title: 'IBK 배서내역 Excel 파일 선택',
        filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }],
        properties: ['openFile'],
      });

      if (canceled || !filePaths || filePaths.length === 0) return;
      const filePath = filePaths[0];

      setLoading(true);
      let res: any;
      if (section.slug === 'ibk_endorsements') {
        res = await window.electron.financeHub.importIbkEndorsementsExcel(filePath);
      } else if (section.slug === 'ibk_loan_history') {
        res = await window.electron.financeHub.importIbkLoanHistoryExcel(filePath);
      } else if (section.slug === 'ibk_foreign_currency_history') {
        res = await window.electron.financeHub.importIbkForeignCurrencyExcel(filePath);
      } else if (section.slug === 'hana_loan_history') {
        res = await window.electron.financeHub.importHanaLoanHistoryExcel(filePath);
      } else {
        // Fallback or other tables if needed
        setError('이 테이블은 수동 업로드를 지원하지 않습니다.');
        return;
      }

      if (res?.success) {
        alert(`성공적으로 업로드되었습니다. (가져옴: ${res.imported}, 건너뜀: ${res.skipped})`);
        await load();
      } else {
        setError(res?.error || '업로드 중 오류가 발생했습니다.');
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [section, load]);

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
          {section.canImportExcel && (
            <button
              type="button"
              className="ibkrec-btn"
              onClick={() => void handleFileUpload()}
              disabled={loading}
              title="Excel 파일 업로드"
            >
              <FontAwesomeIcon icon={faUpload} />
              <span>Excel 업로드</span>
            </button>
          )}
          <button
            type="button"
            className="ibkrec-btn"
            onClick={() => void load()}
            disabled={loading}
            title="DB에서 다시 불러오기"
          >
            <FontAwesomeIcon icon={loading ? faSpinner : faSyncAlt} spin={loading} />
            <span>새로고침</span>
          </button>
          <button
            type="button"
            className="ibkrec-btn ibkrec-btn--primary"
            onClick={() => void handleSync()}
            disabled={syncing || isSyncingThisBank}
            title={
              isConnected
                ? '은행에서 동기화'
                : `${section.bankId.toUpperCase()} 로그인 후 동기화 (저장된 인증 정보로 자동 연결 시도)`
            }
          >
            <FontAwesomeIcon icon={syncing || isSyncingThisBank ? faSpinner : faSync} spin={syncing || isSyncingThisBank} />
            <span>{syncing || isSyncingThisBank ? '동기화 중...' : '동기화'}</span>
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
                      {formatCell(row[c.key], c.format, row.currency)}
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
  /** Login + sync + user feedback for all B2B product tables on this page. */
  onRunBankProductSync?: RunBankProductSyncFn;
  syncingBankId?: string | null;
  /** Banks currently connected (have active automator session). */
  promissorySyncBanks?: { bankId: string; displayName: string }[];
}

function PromissoryNotesPage({
  promissorySyncBanks = [],
  onRunBankProductSync,
  syncingBankId = null,
}: PromissoryNotesPageProps) {
  const connectedBankIds = useMemo(
    () => new Set(promissorySyncBanks.map((b) => b.bankId)),
    [promissorySyncBanks],
  );

  return (
    <div className="ibkrec-page">
      {TABLE_SECTIONS.map((section) => (
        <Section
          key={section.slug}
          section={section}
          connectedBankIds={connectedBankIds}
          onRunBankProductSync={onRunBankProductSync}
          syncingBankId={syncingBankId}
        />
      ))}
    </div>
  );
}

export default PromissoryNotesPage;
