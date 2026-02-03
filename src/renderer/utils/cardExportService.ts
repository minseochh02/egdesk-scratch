// ============================================================================
// CARD EXPORT SERVICE
// ============================================================================
// Frontend service for exporting card transactions to Excel format
// Uses XLSX library to generate standardized 15-column spreadsheet

import * as XLSX from 'xlsx';

// Import the mapper functions (we'll need to expose them from main process)
// For now, we'll duplicate the logic here since renderer can't directly import from main

interface CardExportOptions {
  accountId?: string;
  cardCompanyId?: string;
  startDate?: string;
  endDate?: string;
  includeRefunds?: boolean;
}

interface Transaction {
  id: string;
  account_id: string;
  bank_id: string;
  date: string;
  time: string | null;
  type: string;
  withdrawal: number;
  deposit: number;
  description: string;
  counterparty: string | null;
  metadata: string | Record<string, any>;
  account_name?: string;
  customer_name?: string;
}

/**
 * Export card transactions to Excel file
 */
export async function exportCardTransactions(options: CardExportOptions = {}): Promise<void> {
  try {
    // 1. Fetch transactions from database via IPC
    const result = await (window as any).electron.financeHub.exportCardTransactions(options);

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch transactions');
    }

    const transactions: Transaction[] = result.data || [];

    if (!transactions || transactions.length === 0) {
      alert('내보낼 거래 내역이 없습니다.');
      return;
    }

    // 2. Transform data using mapper
    const exportData = transactions.map(tx => mapTransactionToExportRow(tx));

    // 3. Create workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(exportData);

    // 4. Set column widths (15 columns)
    worksheet['!cols'] = [
      { wch: 12 }, // 본부명
      { wch: 15 }, // 부서명
      { wch: 20 }, // 카드번호
      { wch: 10 }, // 카드구분
      { wch: 12 }, // 카드소지자
      { wch: 12 }, // 거래은행
      { wch: 10 }, // 사용구분
      { wch: 10 }, // 매출종류
      { wch: 12 }, // 접수일자/(승인일자)
      { wch: 12 }, // 청구일자
      { wch: 15 }, // 승인번호
      { wch: 30 }, // 가맹점명/국가명(도시명)
      { wch: 12 }, // 이용금액
      { wch: 10 }, // (US $)
      { wch: 25 }, // 비고
    ];

    // 5. Force text format for card numbers (prevent scientific notation)
    if (worksheet['!ref']) {
      const range = XLSX.utils.decode_range(worksheet['!ref']);
      for (let R = range.s.r + 1; R <= range.e.r; ++R) {
        const cardNumCell = XLSX.utils.encode_cell({ r: R, c: 2 }); // Column 3 (카드번호)
        if (worksheet[cardNumCell]) {
          worksheet[cardNumCell].t = 's'; // Force string type
        }
      }
    }

    // 6. Add sheet and download
    XLSX.utils.book_append_sheet(workbook, worksheet, '카드 거래내역');

    const fileName = `카드_거래내역_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    console.log(`Exported ${transactions.length} card transactions to ${fileName}`);
    alert(`${transactions.length}건의 카드 거래내역을 엑셀로 내보냈습니다.`);
  } catch (error) {
    console.error('Card export error:', error);
    alert(`엑셀 내보내기 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    throw error;
  }
}

/**
 * Map transaction to 15-column export format
 * (Duplicated from main process mapper for renderer use)
 */
function mapTransactionToExportRow(transaction: Transaction): Record<string, any> {
  const metadata = typeof transaction.metadata === 'string'
    ? JSON.parse(transaction.metadata || '{}')
    : (transaction.metadata || {});

  const cardCompanyId = metadata.cardCompanyId || transaction.bank_id;

  return {
    '본부명': extractHeadquarters(metadata, cardCompanyId),
    '부서명': extractDepartment(metadata, cardCompanyId),
    '카드번호': metadata.cardNumber || '',
    '카드구분': extractCardType(metadata, cardCompanyId),
    '카드소지자': extractCardholder(metadata, cardCompanyId),
    '거래은행': extractTransactionBank(metadata, cardCompanyId),
    '사용구분': extractUsageType(metadata, cardCompanyId),
    '매출종류': metadata.salesType || '일반매출',
    '접수일자/(승인일자)': formatDateForExport(transaction.date),
    '청구일자': extractBillingDate(metadata, cardCompanyId),
    '승인번호': metadata.approvalNumber || '',
    '가맹점명/국가명(도시명)': transaction.description || transaction.counterparty || '',
    '이용금액': formatAmount(transaction.withdrawal, transaction.deposit),
    '(US $)': calculateUSDAmount(metadata),
    '비고': generateNotes(metadata, transaction)
  };
}

// Field extraction functions (duplicated from main process)

function extractHeadquarters(metadata: any, cardCompanyId: string): string {
  return cardCompanyId === 'bc-card' ? (metadata.headquartersName || '') : '';
}

function extractDepartment(metadata: any, cardCompanyId: string): string {
  if (cardCompanyId === 'bc-card' || cardCompanyId === 'kb-card') {
    return metadata.departmentName || '';
  }
  return '';
}

function extractCardType(metadata: any, cardCompanyId: string): string {
  if (cardCompanyId === 'bc-card' && metadata.cardType) {
    return metadata.cardType;
  }
  return '법인';
}

function extractCardholder(metadata: any, cardCompanyId: string): string {
  if (cardCompanyId === 'bc-card') {
    return metadata.cardHolder || '';
  }
  if (cardCompanyId === 'kb-card') {
    return metadata.representativeName || '';
  }
  return metadata.userName || '';
}

function extractTransactionBank(metadata: any, cardCompanyId: string): string {
  return cardCompanyId === 'bc-card' ? (metadata.transactionBank || '') : '';
}

function extractUsageType(metadata: any, cardCompanyId: string): string {
  if (cardCompanyId === 'bc-card') {
    return metadata.usageType || '';
  }
  if (cardCompanyId === 'kb-card') {
    return metadata.approvalType || '';
  }
  if (cardCompanyId === 'shinhan-card') {
    return metadata.transactionType || '';
  }
  return metadata.transactionMethod || '';
}

function extractBillingDate(metadata: any, cardCompanyId: string): string {
  if (metadata.billingDate || metadata['결제일']) {
    const billingDate = metadata.billingDate || metadata['결제일'];
    return formatDateForExport(billingDate);
  }
  if (cardCompanyId === 'shinhan-card' && metadata.paymentDueDate) {
    return formatDateForExport(metadata.paymentDueDate);
  }
  return '';
}

function calculateUSDAmount(metadata: any): string {
  if (metadata.exchangeRate && metadata.foreignAmountKRW) {
    const rate = parseFloat(metadata.exchangeRate);
    const krw = parseFloat(metadata.foreignAmountKRW);
    if (!isNaN(rate) && !isNaN(krw) && rate > 0) {
      return (krw / rate).toFixed(2);
    }
  }
  return '';
}

function generateNotes(metadata: any, transaction: Transaction): string {
  const notes: string[] = [];

  if (metadata.isCancelled) {
    notes.push('취소');
  }

  const installment = metadata.installmentPeriod;
  if (installment && installment !== '00' && installment !== '0') {
    notes.push(`${installment}개월 할부`);
  }

  if (metadata.foreignAmountKRW) {
    notes.push('해외결제');
  }

  return notes.join(', ');
}

function formatAmount(withdrawal: number, deposit: number): number {
  if (deposit > 0) {
    return -deposit;
  }
  return withdrawal || 0;
}

function formatDateForExport(dateString: string): string {
  if (!dateString) return '';
  const cleaned = String(dateString).replace(/[-/]/g, '');
  if (cleaned.length === 8) {
    return cleaned;
  }
  return dateString;
}
