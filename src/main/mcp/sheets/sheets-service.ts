import { getAuthService } from '../../auth/auth-service';
import { getDriveService } from '../../drive-service';

// Singleton instance
let sheetsServiceInstance: SheetsService | null = null;

/**
 * Get or create the SheetsService singleton instance
 */
export function getSheetsService(): SheetsService {
  if (!sheetsServiceInstance) {
    sheetsServiceInstance = new SheetsService();
  }
  return sheetsServiceInstance;
}

export interface SheetInfo {
  sheetId: number;
  title: string;
  index: number;
  rowCount: number;
  columnCount: number;
}

export interface SpreadsheetMetadata {
  spreadsheetId: string;
  title: string;
  spreadsheetUrl: string;
  sheets: SheetInfo[];
}

export interface RangeData {
  range: string;
  values: string[][];
  headers?: string[];
}

/**
 * Helper function to format date string (YYYYMMDD or YYYY-MM-DD) to YYYY.MM.DD
 */
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const normalized = dateStr.replace(/-/g, '');
  if (normalized.length === 8) {
    return `${normalized.slice(0, 4)}.${normalized.slice(4, 6)}.${normalized.slice(6, 8)}`;
  }
  return dateStr;
}

/**
 * Google Sheets Service
 *
 * Provides access to Google Sheets API for reading spreadsheet data.
 * Uses OAuth tokens from AuthService.
 */
export class SheetsService {
  private baseUrl = 'https://sheets.googleapis.com/v4/spreadsheets';

  /**
   * Get OAuth access token from AuthService
   */
  private async getAccessToken(): Promise<string> {
    const authService = getAuthService();
    const token = await authService.getGoogleWorkspaceToken();
    
    if (!token?.access_token) {
      throw new Error('No Google OAuth token available. Please sign in with Google.');
    }
    
    return token.access_token;
  }

  /**
   * Make authenticated request to Google Sheets API
   */
  private async fetchSheets<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const accessToken = await this.getAccessToken();
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
      ...options,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Sheets API error: ${response.status} ${response.statusText}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorMessage;
      } catch {
        // Use default error message
      }
      
      throw new Error(errorMessage);
    }

    return response.json();
  }

  /**
   * Get spreadsheet metadata (title, sheets list, dimensions)
   */
  async getSpreadsheet(spreadsheetId: string): Promise<SpreadsheetMetadata> {
    // Include gridProperties to get row/column counts
    const endpoint = `/${spreadsheetId}?fields=spreadsheetId,properties.title,spreadsheetUrl,sheets.properties`;
    
    const data = await this.fetchSheets<any>(endpoint);
    
    return {
      spreadsheetId: data.spreadsheetId,
      title: data.properties?.title || 'Untitled Spreadsheet',
      spreadsheetUrl: data.spreadsheetUrl,
      sheets: (data.sheets || []).map((sheet: any) => ({
        sheetId: sheet.properties?.sheetId || 0,
        title: sheet.properties?.title || 'Sheet',
        index: sheet.properties?.index || 0,
        rowCount: sheet.properties?.gridProperties?.rowCount || 0,
        columnCount: sheet.properties?.gridProperties?.columnCount || 0,
      })),
    };
  }

  /**
   * Get values from a range
   * @param spreadsheetId The spreadsheet ID
   * @param range A1 notation range (e.g., "Sheet1!A1:D10" or just "Sheet1" for entire sheet)
   */
  async getRange(spreadsheetId: string, range: string): Promise<RangeData> {
    // URL encode the range
    const encodedRange = encodeURIComponent(range);
    const endpoint = `/${spreadsheetId}/values/${encodedRange}`;
    
    const data = await this.fetchSheets<any>(endpoint);
    
    const values = data.values || [];
    
    return {
      range: data.range || range,
      values: values,
      headers: values.length > 0 ? values[0] : undefined,
    };
  }

  /**
   * Get headers (first row) of a sheet
   */
  async getHeaders(spreadsheetId: string, sheetName: string = 'Sheet1'): Promise<string[]> {
    const range = `${sheetName}!1:1`;
    const data = await this.getRange(spreadsheetId, range);
    return data.headers || [];
  }

  /**
   * Get sample data (first N rows including headers)
   */
  async getSampleData(
    spreadsheetId: string, 
    sheetName: string = 'Sheet1', 
    rows: number = 5
  ): Promise<RangeData> {
    const range = `${sheetName}!1:${rows}`;
    return this.getRange(spreadsheetId, range);
  }

  /**
   * Get full context for AI: spreadsheet metadata + headers + sample data for each sheet
   */
  async getFullContext(spreadsheetId: string, sampleRows: number = 5): Promise<{
    metadata: SpreadsheetMetadata;
    sheetsData: Array<{
      sheetTitle: string;
      headers: string[];
      sampleData: string[][];
      rowCount: number;
      columnCount: number;
    }>;
  }> {
    // Get spreadsheet metadata
    const metadata = await this.getSpreadsheet(spreadsheetId);
    
    // Get sample data for each sheet
    const sheetsData = await Promise.all(
      metadata.sheets.map(async (sheet) => {
        try {
          const sampleData = await this.getSampleData(spreadsheetId, sheet.title, sampleRows);
          return {
            sheetTitle: sheet.title,
            headers: sampleData.headers || [],
            sampleData: sampleData.values.slice(1), // Exclude header row
            rowCount: sheet.rowCount,
            columnCount: sheet.columnCount,
          };
        } catch (error) {
          // If sheet is empty or inaccessible, return empty data
          console.warn(`Failed to get sample data for sheet "${sheet.title}":`, error);
          return {
            sheetTitle: sheet.title,
            headers: [],
            sampleData: [],
            rowCount: sheet.rowCount,
            columnCount: sheet.columnCount,
          };
        }
      })
    );
    
    return {
      metadata,
      sheetsData,
    };
  }

  /**
   * Create a new spreadsheet
   */
  async createSpreadsheet(title: string, data?: string[][]): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
    const body: any = {
      properties: {
        title,
      },
    };

    // If data is provided, configure the first sheet with data
    if (data && data.length > 0) {
      body.sheets = [{
        properties: {
          title: 'Sheet1',
          gridProperties: {
            rowCount: data.length,
            columnCount: data[0]?.length || 1,
          },
        },
      }];
    }

    const response = await this.fetchSheets<any>('', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    // If data is provided, write it to the sheet
    if (data && data.length > 0 && response.spreadsheetId) {
      await this.updateRange(response.spreadsheetId, 'Sheet1!A1', data);
    }

    return {
      spreadsheetId: response.spreadsheetId,
      spreadsheetUrl: response.spreadsheetUrl,
    };
  }

  /**
   * Update values in a range
   */
  async updateRange(spreadsheetId: string, range: string, values: string[][]): Promise<void> {
    const encodedRange = encodeURIComponent(range);
    const endpoint = `/${spreadsheetId}/values/${encodedRange}?valueInputOption=RAW`;

    await this.fetchSheets<any>(endpoint, {
      method: 'PUT',
      body: JSON.stringify({
        range,
        majorDimension: 'ROWS',
        values,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Append values to a sheet
   */
  async appendValues(spreadsheetId: string, range: string, values: string[][]): Promise<void> {
    const encodedRange = encodeURIComponent(range);
    const endpoint = `/${spreadsheetId}/values/${encodedRange}:append`;

    await this.fetchSheets<any>(endpoint, {
      method: 'POST',
      body: JSON.stringify({
        range,
        majorDimension: 'ROWS',
        values,
        valueInputOption: 'RAW',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Clear values in a range
   */
  async clearRange(spreadsheetId: string, range: string): Promise<void> {
    const encodedRange = encodeURIComponent(range);
    const endpoint = `/${spreadsheetId}/values/${encodedRange}:clear`;
    
    await this.fetchSheets<any>(endpoint, {
      method: 'POST',
      body: JSON.stringify({}),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Format sheet with headers
   */
  async formatHeaders(spreadsheetId: string, sheetName: string = 'Sheet1'): Promise<void> {
    try {
      // Get the spreadsheet metadata to find the correct sheet ID
      const metadata = await this.getSpreadsheet(spreadsheetId);
      const sheet = metadata.sheets.find(s => s.title === sheetName) || metadata.sheets[0];
      
      if (!sheet) {
        console.warn('No sheet found for formatting headers');
        return;
      }

      const requests = [
        {
          repeatCell: {
            range: {
              sheetId: sheet.sheetId,
              startRowIndex: 0,
              endRowIndex: 1,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 },
                textFormat: {
                  fontSize: 10,
                  bold: true,
                },
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)',
          },
        },
      ];

      await this.fetchSheets<any>(`/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        body: JSON.stringify({ requests }),
      });
    } catch (error) {
      console.warn('Failed to format headers:', error);
      // Don't throw error - formatting is not critical
    }
  }

  /**
   * Get or create a persistent transactions spreadsheet
   */
  async getOrCreateTransactionsSpreadsheet(
    transactions: any[],
    banks: Record<string, any>,
    accounts: any[],
    persistentSpreadsheetId?: string,
    customTitle?: string
  ): Promise<{ spreadsheetId: string; spreadsheetUrl: string; wasCreated: boolean }> {
    // Try to use existing spreadsheet if provided
    if (persistentSpreadsheetId) {
      try {
        // Check if spreadsheet still exists and is accessible
        await this.getSpreadsheet(persistentSpreadsheetId);

        // Update with new data
        await this.updateTransactionsData(persistentSpreadsheetId, transactions, banks, accounts);

        return {
          spreadsheetId: persistentSpreadsheetId,
          spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${persistentSpreadsheetId}/edit`,
          wasCreated: false
        };
      } catch (error) {
        console.warn('Persistent spreadsheet not accessible, creating new one:', error);
        // Fall through to create new spreadsheet
      }
    }

    // Generate title
    let title: string;

    if (customTitle) {
      // Use provided custom title (no date timestamp)
      title = customTitle;
    } else {
      // Default title for merged transactions (cards + banks combined)
      title = 'EGDesk 거래내역';
    }

    const result = await this.createTransactionsSpreadsheet(title, transactions, banks, accounts);

    return {
      ...result,
      wasCreated: true
    };
  }

  /**
   * Update existing spreadsheet with new transactions data
   */
  async updateTransactionsData(
    spreadsheetId: string,
    transactions: any[],
    banks: Record<string, any>,
    accounts: any[]
  ): Promise<void> {
    // Check if these are card transactions
    const isCardTransactions = transactions.length > 0 &&
      transactions[0].metadata &&
      (typeof transactions[0].metadata === 'string'
        ? JSON.parse(transactions[0].metadata).isCardTransaction
        : transactions[0].metadata.isCardTransaction);

    let headers: string[];
    let rows: any[][];

    if (isCardTransactions) {
      // Card transaction format (16 columns)
      headers = ['카드사', '본부명', '부서명', '카드번호', '카드구분', '카드소지자', '거래은행', '사용구분', '매출종류', '접수일시/(승인일시)', '청구일자', '승인번호', '가맹점명/국가명(도시명)', '이용금액', '(US $)', '비고'];

      rows = transactions.map(tx => {
        const metadata = typeof tx.metadata === 'string' ? JSON.parse(tx.metadata) : tx.metadata;
        const cardCompanyId = metadata?.cardCompanyId || tx.bankId;

        // Use combined datetime (YYYY/MM/DD HH:MM:SS) instead of date only
        const datetime = tx.datetime || (tx.date && tx.time ? tx.date.replace(/-/g, '/') + ' ' + tx.time : this.formatDateForExport(tx.date));

        return [
          this.extractCardCompany(cardCompanyId),
          this.extractHeadquarters(metadata, cardCompanyId),
          this.extractDepartment(metadata, cardCompanyId),
          metadata?.cardNumber || '',
          this.extractCardType(metadata, cardCompanyId),
          this.extractCardholder(metadata, cardCompanyId),
          this.extractTransactionBank(metadata, cardCompanyId),
          this.extractUsageType(metadata, cardCompanyId),
          this.extractSalesType(metadata, cardCompanyId),
          datetime,
          this.extractBillingDate(metadata, cardCompanyId),
          metadata?.approvalNumber || '',
          tx.description || tx.counterparty || '',
          this.formatAmount(tx.withdrawal, tx.deposit),
          this.calculateUSDAmount(metadata),
          this.generateNotes(metadata, tx)
        ];
      });
    } else {
      // Bank transaction format (10 columns - keep separate date/time for spreadsheet)
      headers = ['날짜', '시간', '은행', '계좌', '적요', '내용', '출금', '입금', '잔액', '지점'];

      rows = transactions.map(tx => {
        const bank = banks[tx.bankId] || { nameKo: 'Unknown' };
        const account = accounts.find(a => a.id === tx.accountId);
        return [
          formatDate(tx.date),
          tx.time || '',
          bank.nameKo || '',
          account?.accountNumber || '',
          tx.type || '',
          tx.description || '',
          tx.withdrawal > 0 ? tx.withdrawal.toString() : '',
          tx.deposit > 0 ? tx.deposit.toString() : '',
          tx.balance.toString(),
          tx.branch || '',
        ];
      });
    }

    // Combine headers and data
    const data = [headers, ...rows];

    // Clear existing data and add new data
    try {
      // Clear the entire sheet
      await this.clearRange(spreadsheetId, 'Sheet1');
    } catch (error) {
      console.warn('Failed to clear existing data, continuing anyway:', error);
    }

    // Add new data
    await this.updateRange(spreadsheetId, 'Sheet1!A1', data);

    // Format headers
    await this.formatHeaders(spreadsheetId, 'Sheet1');
  }

  /**
   * Create and open a spreadsheet from transactions data
   */
  async createTransactionsSpreadsheet(
    title: string,
    transactions: any[],
    banks: Record<string, any>,
    accounts: any[]
  ): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
    // Check if these are card transactions
    const isCardTransactions = transactions.length > 0 &&
      transactions[0].metadata &&
      (typeof transactions[0].metadata === 'string'
        ? JSON.parse(transactions[0].metadata).isCardTransaction
        : transactions[0].metadata.isCardTransaction);

    let headers: string[];
    let rows: any[][];

    if (isCardTransactions) {
      // Card transaction format (16 columns)
      headers = ['카드사', '본부명', '부서명', '카드번호', '카드구분', '카드소지자', '거래은행', '사용구분', '매출종류', '접수일시/(승인일시)', '청구일자', '승인번호', '가맹점명/국가명(도시명)', '이용금액', '(US $)', '비고'];

      rows = transactions.map(tx => {
        const metadata = typeof tx.metadata === 'string' ? JSON.parse(tx.metadata) : tx.metadata;
        const cardCompanyId = metadata?.cardCompanyId || tx.bankId;

        // Use combined datetime (YYYY/MM/DD HH:MM:SS) instead of date only
        const datetime = tx.datetime || (tx.date && tx.time ? tx.date.replace(/-/g, '/') + ' ' + tx.time : this.formatDateForExport(tx.date));

        return [
          this.extractCardCompany(cardCompanyId),
          this.extractHeadquarters(metadata, cardCompanyId),
          this.extractDepartment(metadata, cardCompanyId),
          metadata?.cardNumber || '',
          this.extractCardType(metadata, cardCompanyId),
          this.extractCardholder(metadata, cardCompanyId),
          this.extractTransactionBank(metadata, cardCompanyId),
          this.extractUsageType(metadata, cardCompanyId),
          this.extractSalesType(metadata, cardCompanyId),
          datetime,
          this.extractBillingDate(metadata, cardCompanyId),
          metadata?.approvalNumber || '',
          tx.description || tx.counterparty || '',
          this.formatAmount(tx.withdrawal, tx.deposit),
          this.calculateUSDAmount(metadata),
          this.generateNotes(metadata, tx)
        ];
      });
    } else {
      // Bank transaction format (10 columns - keep separate date/time for spreadsheet)
      headers = ['날짜', '시간', '은행', '계좌', '적요', '내용', '출금', '입금', '잔액', '지점'];

      rows = transactions.map(tx => {
        const bank = banks[tx.bankId] || { nameKo: 'Unknown' };
        const account = accounts.find(a => a.id === tx.accountId);
        return [
          formatDate(tx.date),
          tx.time || '',
          bank.nameKo || '',
          account?.accountNumber || '',
          tx.type || '',
          tx.description || '',
          tx.withdrawal > 0 ? tx.withdrawal.toString() : '',
          tx.deposit > 0 ? tx.deposit.toString() : '',
          tx.balance.toString(),
          tx.branch || '',
        ];
      });
    }

    // Combine headers and data
    const data = [headers, ...rows];

    // Create the spreadsheet
    const result = await this.createSpreadsheet(title, data);

    // Format the headers
    if (result.spreadsheetId) {
      await this.formatHeaders(result.spreadsheetId, 'Sheet1');
    }

    // Move to Transactions folder
    try {
      const driveService = getDriveService();
      await driveService.moveFileToFolder(result.spreadsheetId, 'Transactions');
      console.log('✅ Moved transactions spreadsheet to EGDesk/Transactions/');
    } catch (error) {
      console.warn('⚠️ Could not organize spreadsheet:', error);
      // Don't fail the entire operation if folder organization fails
    }

    return result;
  }

  /**
   * Export tax invoices to Google Spreadsheet
   * Exports all 33 columns from the database
   */
  async exportTaxInvoicesToSpreadsheet(
    invoices: any[],
    invoiceType: 'sales' | 'purchase',
    existingSpreadsheetUrl?: string
  ): Promise<{ success: boolean; spreadsheetId?: string; spreadsheetUrl?: string; error?: string }> {
    try {
      // Extract spreadsheet ID from URL if provided
      let spreadsheetId: string | undefined;
      if (existingSpreadsheetUrl) {
        const match = existingSpreadsheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (match) {
          spreadsheetId = match[1];

          // Try to update existing spreadsheet
          try {
            await this.getSpreadsheet(spreadsheetId);
            await this.updateTaxInvoicesData(spreadsheetId, invoices, invoiceType);

            return {
              success: true,
              spreadsheetId,
              spreadsheetUrl: existingSpreadsheetUrl
            };
          } catch (error) {
            console.warn('Existing spreadsheet not accessible, creating new one:', error);
            // Fall through to create new spreadsheet
          }
        }
      }

      // Create new spreadsheet
      const typeLabel = invoiceType === 'sales' ? '매출' : '매입';
      const title = `EGDesk ${typeLabel} 전자세금계산서 ${new Date().toISOString().slice(0, 10)}`;

      // All 33 columns from the Excel/database
      const headers = [
        '작성일자',
        '승인번호',
        '발급일자',
        '전송일자',
        '공급자사업자등록번호',
        '공급자종사업장번호',
        '공급자상호',
        '공급자대표자명',
        '공급자주소',
        '공급받는자사업자등록번호',
        '공급받는자종사업장번호',
        '공급받는자상호',
        '공급받는자대표자명',
        '공급받는자주소',
        '합계금액',
        '공급가액',
        '세액',
        '전자세금계산서분류',
        '전자세금계산서종류',
        '발급유형',
        '비고',
        '영수청구구분',
        '공급자이메일',
        '공급받는자이메일1',
        '공급받는자이메일2',
        '품목일자',
        '품목명',
        '품목규격',
        '품목수량',
        '품목단가',
        '품목공급가액',
        '품목세액',
        '품목비고',
        '사업자번호'
      ];

      // Prepare data rows with all columns
      const rows = invoices.map(inv => [
        inv.작성일자 || '',
        inv.승인번호 || '',
        inv.발급일자 || '',
        inv.전송일자 || '',
        inv.공급자사업자등록번호 || '',
        inv.공급자종사업장번호 || '',
        inv.공급자상호 || '',
        inv.공급자대표자명 || '',
        inv.공급자주소 || '',
        inv.공급받는자사업자등록번호 || '',
        inv.공급받는자종사업장번호 || '',
        inv.공급받는자상호 || '',
        inv.공급받는자대표자명 || '',
        inv.공급받는자주소 || '',
        inv.합계금액?.toString() || '0',
        inv.공급가액?.toString() || '0',
        inv.세액?.toString() || '0',
        inv.전자세금계산서분류 || '',
        inv.전자세금계산서종류 || '',
        inv.발급유형 || '',
        inv.비고 || '',
        inv.영수청구구분 || '',
        inv.공급자이메일 || '',
        inv.공급받는자이메일1 || '',
        inv.공급받는자이메일2 || '',
        inv.품목일자 || '',
        inv.품목명 || '',
        inv.품목규격 || '',
        inv.품목수량 || '',
        inv.품목단가 || '',
        inv.품목공급가액?.toString() || '0',
        inv.품목세액?.toString() || '0',
        inv.품목비고 || '',
        inv.business_number || ''
      ]);

      // Combine headers and data
      const data = [headers, ...rows];

      // Create the spreadsheet
      const result = await this.createSpreadsheet(title, data);

      // Format the headers
      if (result.spreadsheetId) {
        await this.formatHeaders(result.spreadsheetId, 'Sheet1');
      }

      // Move to Tax Invoices folder
      try {
        const driveService = getDriveService();
        await driveService.moveFileToFolder(result.spreadsheetId, 'Tax Invoices');
        console.log('✅ Moved tax invoice spreadsheet to EGDesk/Tax Invoices/');
      } catch (error) {
        console.warn('⚠️ Could not organize spreadsheet:', error);
        // Don't fail the entire operation if folder organization fails
      }

      return {
        success: true,
        ...result
      };
    } catch (error) {
      console.error('[SheetsService] Error exporting tax invoices:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update existing spreadsheet with new tax invoices data
   */
  async updateTaxInvoicesData(
    spreadsheetId: string,
    invoices: any[],
    invoiceType: 'sales' | 'purchase'
  ): Promise<void> {
    // All 33 columns from the Excel/database
    const headers = [
      '작성일자',
      '승인번호',
      '발급일자',
      '전송일자',
      '공급자사업자등록번호',
      '공급자종사업장번호',
      '공급자상호',
      '공급자대표자명',
      '공급자주소',
      '공급받는자사업자등록번호',
      '공급받는자종사업장번호',
      '공급받는자상호',
      '공급받는자대표자명',
      '공급받는자주소',
      '합계금액',
      '공급가액',
      '세액',
      '전자세금계산서분류',
      '전자세금계산서종류',
      '발급유형',
      '비고',
      '영수청구구분',
      '공급자이메일',
      '공급받는자이메일1',
      '공급받는자이메일2',
      '품목일자',
      '품목명',
      '품목규격',
      '품목수량',
      '품목단가',
      '품목공급가액',
      '품목세액',
      '품목비고',
      '사업자번호'
    ];

    // Prepare data rows with all columns
    const rows = invoices.map(inv => [
      inv.작성일자 || '',
      inv.승인번호 || '',
      inv.발급일자 || '',
      inv.전송일자 || '',
      inv.공급자사업자등록번호 || '',
      inv.공급자종사업장번호 || '',
      inv.공급자상호 || '',
      inv.공급자대표자명 || '',
      inv.공급자주소 || '',
      inv.공급받는자사업자등록번호 || '',
      inv.공급받는자종사업장번호 || '',
      inv.공급받는자상호 || '',
      inv.공급받는자대표자명 || '',
      inv.공급받는자주소 || '',
      inv.합계금액?.toString() || '0',
      inv.공급가액?.toString() || '0',
      inv.세액?.toString() || '0',
      inv.전자세금계산서분류 || '',
      inv.전자세금계산서종류 || '',
      inv.발급유형 || '',
      inv.비고 || '',
      inv.영수청구구분 || '',
      inv.공급자이메일 || '',
      inv.공급받는자이메일1 || '',
      inv.공급받는자이메일2 || '',
      inv.품목일자 || '',
      inv.품목명 || '',
      inv.품목규격 || '',
      inv.품목수량 || '',
      inv.품목단가 || '',
      inv.품목공급가액?.toString() || '0',
      inv.품목세액?.toString() || '0',
      inv.품목비고 || '',
      inv.business_number || ''
    ]);

    // Combine headers and data
    const data = [headers, ...rows];

    // Clear existing data and add new data
    try {
      // Clear the entire sheet
      await this.clearRange(spreadsheetId, 'Sheet1');
    } catch (error) {
      console.warn('Failed to clear existing data, continuing anyway:', error);
    }

    // Add new data
    await this.updateRange(spreadsheetId, 'Sheet1!A1', data);

    // Format headers
    await this.formatHeaders(spreadsheetId, 'Sheet1');
  }

  /**
   * Export cash receipts to Google Spreadsheet
   * Exports all 11 columns from the cash receipts database
   */
  async exportCashReceiptsToSpreadsheet(
    receipts: any[],
    existingSpreadsheetUrl?: string
  ): Promise<{ success: boolean; spreadsheetId?: string; spreadsheetUrl?: string; error?: string }> {
    try {
      // Extract spreadsheet ID from URL if provided
      let spreadsheetId: string | undefined;
      if (existingSpreadsheetUrl) {
        const match = existingSpreadsheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (match) {
          spreadsheetId = match[1];

          // Try to update existing spreadsheet
          try {
            await this.getSpreadsheet(spreadsheetId);
            await this.updateCashReceiptsData(spreadsheetId, receipts);

            return {
              success: true,
              spreadsheetId,
              spreadsheetUrl: existingSpreadsheetUrl
            };
          } catch (error) {
            console.warn('Existing spreadsheet not accessible, creating new one:', error);
            // Fall through to create new spreadsheet
          }
        }
      }

      // Create new spreadsheet
      const title = `EGDesk 현금영수증 ${new Date().toISOString().slice(0, 10)}`;

      // All 11 columns from the cash receipts database
      const headers = [
        '발행구분',
        '매출일시',
        '공급가액',
        '부가세',
        '봉사료',
        '총금액',
        '승인번호',
        '신분확인뒷4자리',
        '거래구분',
        '용도구분',
        '비고'
      ];

      // Prepare data rows with all columns
      const rows = receipts.map(receipt => [
        receipt.발행구분 || '',
        receipt.매출일시 || '',
        receipt.공급가액?.toString() || '0',
        receipt.부가세?.toString() || '0',
        receipt.봉사료?.toString() || '0',
        receipt.총금액?.toString() || '0',
        receipt.승인번호 || '',
        receipt.신분확인뒷4자리 || '',
        receipt.거래구분 || '',
        receipt.용도구분 || '',
        receipt.비고 || ''
      ]);

      // Combine headers and data
      const data = [headers, ...rows];

      // Create the spreadsheet
      const result = await this.createSpreadsheet(title, data);

      // Format the headers
      if (result.spreadsheetId) {
        await this.formatHeaders(result.spreadsheetId, 'Sheet1');
      }

      // Move to Tax Invoices folder (or create a separate Cash Receipts folder)
      try {
        const driveService = getDriveService();
        await driveService.moveFileToFolder(result.spreadsheetId, 'Tax Invoices');
        console.log('✅ Moved cash receipt spreadsheet to EGDesk/Tax Invoices/');
      } catch (error) {
        console.warn('⚠️ Could not organize spreadsheet:', error);
        // Don't fail the entire operation if folder organization fails
      }

      return {
        success: true,
        ...result
      };
    } catch (error) {
      console.error('[SheetsService] Error exporting cash receipts:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update existing spreadsheet with new cash receipts data
   */
  async updateCashReceiptsData(
    spreadsheetId: string,
    receipts: any[]
  ): Promise<void> {
    // All 11 columns from the cash receipts database
    const headers = [
      '발행구분',
      '매출일시',
      '공급가액',
      '부가세',
      '봉사료',
      '총금액',
      '승인번호',
      '신분확인뒷4자리',
      '거래구분',
      '용도구분',
      '비고'
    ];

    // Prepare data rows with all columns
    const rows = receipts.map(receipt => [
      receipt.발행구분 || '',
      receipt.매출일시 || '',
      receipt.공급가액?.toString() || '0',
      receipt.부가세?.toString() || '0',
      receipt.봉사료?.toString() || '0',
      receipt.총금액?.toString() || '0',
      receipt.승인번호 || '',
      receipt.신분확인뒷4자리 || '',
      receipt.거래구분 || '',
      receipt.용도구분 || '',
      receipt.비고 || ''
    ]);

    // Combine headers and data
    const data = [headers, ...rows];

    // Clear existing data and add new data
    try {
      // Clear the entire sheet
      await this.clearRange(spreadsheetId, 'Sheet1');
    } catch (error) {
      console.warn('Failed to clear existing data, continuing anyway:', error);
    }

    // Add new data
    await this.updateRange(spreadsheetId, 'Sheet1!A1', data);

    // Format headers
    await this.formatHeaders(spreadsheetId, 'Sheet1');
  }

  // ============================================
  // Card Transaction Helper Methods
  // ============================================

  private extractCardCompany(cardCompanyId: string): string {
    const cardCompanyNames: Record<string, string> = {
      'bc-card': 'BC카드',
      'kb-card': 'KB국민카드',
      'nh-card': 'NH농협카드',
      'shinhan-card': '신한카드',
      'samsung-card': '삼성카드',
      'hyundai-card': '현대카드',
      'lotte-card': '롯데카드',
      'hana-card': '하나카드'
    };
    return cardCompanyNames[cardCompanyId] || '';
  }

  private extractHeadquarters(metadata: any, cardCompanyId: string): string {
    return cardCompanyId === 'bc-card' ? (metadata?.headquartersName || '') : '';
  }

  private extractDepartment(metadata: any, cardCompanyId: string): string {
    if (cardCompanyId === 'bc-card') {
      return metadata?.departmentName || '';
    }
    if (cardCompanyId === 'kb-card') {
      // Combine 부서번호 + 부서명
      const deptNum = metadata?.departmentNumber || '';
      const deptName = metadata?.departmentName || '';
      if (deptNum && deptName) {
        return `${deptNum} ${deptName}`;
      }
      return deptNum || deptName;
    }
    return '';
  }

  private extractCardType(metadata: any, cardCompanyId: string): string {
    if (cardCompanyId === 'bc-card' && metadata?.cardType) {
      return metadata.cardType;
    }
    return '법인';
  }

  private extractCardholder(metadata: any, cardCompanyId: string): string {
    if (cardCompanyId === 'bc-card') {
      return metadata?.cardHolder || '';
    }
    if (cardCompanyId === 'kb-card') {
      return metadata?.userName || ''; // KB Card's 이용자명
    }
    return metadata?.userName || '';
  }

  private extractTransactionBank(metadata: any, cardCompanyId: string): string {
    return cardCompanyId === 'bc-card' ? (metadata?.transactionBank || '') : '';
  }

  private extractUsageType(metadata: any, cardCompanyId: string): string {
    if (cardCompanyId === 'bc-card') {
      return metadata?.transactionMethod || ''; // BC Card's usageType is stored as transactionMethod
    }
    if (cardCompanyId === 'kb-card') {
      return metadata?.approvalType || ''; // KB Card's 승인구분
    }
    if (cardCompanyId === 'nh-card') {
      return metadata?.domesticForeign || ''; // NH Card's 국내외구분
    }
    if (cardCompanyId === 'shinhan-card') {
      return metadata?.transactionType || '';
    }
    return metadata?.transactionMethod || '';
  }

  private extractSalesType(metadata: any, cardCompanyId: string): string {
    if (cardCompanyId === 'kb-card') {
      return metadata?.transactionMethod || '일반매출'; // KB Card's 결제방법 → 매출종류
    }
    if (cardCompanyId === 'nh-card') {
      return metadata?.salesType || '일반매출'; // NH Card's 매출종류
    }
    if (cardCompanyId === 'shinhan-card') {
      return metadata?.transactionType || '일반매출'; // Shinhan Card's 이용구분
    }
    return metadata?.salesType || '일반매출';
  }

  private extractBillingDate(metadata: any, cardCompanyId: string): string {
    if (metadata?.billingDate || metadata?.['결제일']) {
      const billingDate = metadata.billingDate || metadata['결제일'];
      return this.formatDateForExport(billingDate);
    }
    if (cardCompanyId === 'shinhan-card' && metadata?.paymentDueDate) {
      return this.formatDateForExport(metadata.paymentDueDate);
    }
    return '';
  }

  private calculateUSDAmount(metadata: any): string {
    if (metadata?.exchangeRate && metadata?.foreignAmountKRW) {
      const rate = parseFloat(metadata.exchangeRate);
      const krw = parseFloat(metadata.foreignAmountKRW);
      if (!isNaN(rate) && !isNaN(krw) && rate > 0) {
        return (krw / rate).toFixed(2);
      }
    }
    return '';
  }

  private generateNotes(metadata: any, transaction: any): string {
    const notes: string[] = [];

    if (metadata?.isCancelled) {
      notes.push('취소');
    }

    const installment = metadata?.installmentPeriod;
    if (installment && installment !== '00' && installment !== '0') {
      notes.push(`할부: ${installment}개월`);
    }

    // BC Card foreign transaction details
    if (metadata?.foreignAmountKRW) {
      notes.push(`해외승인원화금액: ${metadata.foreignAmountKRW}`);
    }

    if (metadata?.exchangeRate) {
      notes.push(`환율: ${metadata.exchangeRate}`);
    }

    return notes.join(' | ');
  }

  private formatAmount(withdrawal: number, deposit: number): string {
    if (deposit > 0) {
      return (-deposit).toString();
    }
    return (withdrawal || 0).toString();
  }

  private formatDateForExport(dateString: string): string {
    if (!dateString) return '';
    const cleaned = String(dateString).replace(/[-/]/g, '');
    if (cleaned.length === 8) {
      return cleaned;
    }
    return dateString;
  }
}

