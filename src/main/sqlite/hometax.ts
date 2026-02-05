// ============================================
// Hometax Database Operations
// ============================================

import Database from 'better-sqlite3';
import { TaxInvoiceData, CashReceiptData } from '../hometax-excel-parser';

/**
 * Import tax invoices into database
 */
export function importTaxInvoices(
  db: Database.Database,
  businessNumber: string,
  invoiceType: 'sales' | 'purchase',
  invoices: TaxInvoiceData[],
  excelFilePath: string
): { success: boolean; inserted: number; duplicate: number; error?: string } {
  try {
    console.log(`[Hometax DB] Importing ${invoices.length} ${invoiceType} invoices for ${businessNumber}`);

    const insertStmt = db.prepare(`
      INSERT INTO tax_invoices (
        business_number, invoice_type,
        작성일자, 승인번호, 발급일자, 전송일자,
        공급자사업자등록번호, 공급자종사업장번호, 공급자상호, 공급자대표자명, 공급자주소,
        공급받는자사업자등록번호, 공급받는자종사업장번호, 공급받는자상호, 공급받는자대표자명, 공급받는자주소,
        합계금액, 공급가액, 세액,
        전자세금계산서분류, 전자세금계산서종류, 발급유형, 비고, 영수청구구분,
        공급자이메일, 공급받는자이메일1, 공급받는자이메일2,
        품목일자, 품목명, 품목규격, 품목수량, 품목단가, 품목공급가액, 품목세액, 품목비고,
        excel_file_path
      ) VALUES (
        ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?
      )
      ON CONFLICT(business_number, 승인번호) DO NOTHING
    `);

    let inserted = 0;
    let duplicate = 0;

    const transaction = db.transaction((invoices: TaxInvoiceData[]) => {
      for (const invoice of invoices) {
        const result = insertStmt.run(
          businessNumber,
          invoiceType,
          invoice.작성일자,
          invoice.승인번호,
          invoice.발급일자,
          invoice.전송일자,
          invoice.공급자사업자등록번호,
          invoice.공급자종사업장번호,
          invoice.공급자상호,
          invoice.공급자대표자명,
          invoice.공급자주소,
          invoice.공급받는자사업자등록번호,
          invoice.공급받는자종사업장번호,
          invoice.공급받는자상호,
          invoice.공급받는자대표자명,
          invoice.공급받는자주소,
          invoice.합계금액,
          invoice.공급가액,
          invoice.세액,
          invoice.전자세금계산서분류,
          invoice.전자세금계산서종류,
          invoice.발급유형,
          invoice.비고,
          invoice.영수청구구분,
          invoice.공급자이메일,
          invoice.공급받는자이메일1,
          invoice.공급받는자이메일2,
          invoice.품목일자,
          invoice.품목명,
          invoice.품목규격,
          invoice.품목수량,
          invoice.품목단가,
          invoice.품목공급가액,
          invoice.품목세액,
          invoice.품목비고,
          excelFilePath
        );

        if (result.changes > 0) {
          inserted++;
        } else {
          duplicate++;
        }
      }
    });

    transaction(invoices);

    console.log(`[Hometax DB] Import complete: ${inserted} inserted, ${duplicate} duplicates`);

    return {
      success: true,
      inserted,
      duplicate
    };

  } catch (error) {
    console.error('[Hometax DB] Error importing invoices:', error);
    return {
      success: false,
      inserted: 0,
      duplicate: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Record sync operation
 */
export function recordSyncOperation(
  db: Database.Database,
  businessNumber: string,
  startDate: string,
  endDate: string,
  salesCount: number,
  salesNew: number,
  purchaseCount: number,
  purchaseNew: number,
  salesExcelPath: string,
  purchaseExcelPath: string,
  status: 'completed' | 'failed',
  errorMessage?: string
): { success: boolean; error?: string } {
  try {
    const stmt = db.prepare(`
      INSERT INTO hometax_sync_operations (
        business_number, status, start_date, end_date,
        sales_count, sales_new, sales_duplicate,
        purchase_count, purchase_new, purchase_duplicate,
        sales_excel_path, purchase_excel_path,
        error_message, completed_at, duration
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP,
        (julianday(CURRENT_TIMESTAMP) - julianday(started_at)) * 86400)
    `);

    stmt.run(
      businessNumber,
      status,
      startDate,
      endDate,
      salesCount,
      salesNew,
      salesCount - salesNew,
      purchaseCount,
      purchaseNew,
      purchaseCount - purchaseNew,
      salesExcelPath,
      purchaseExcelPath,
      errorMessage || null
    );

    return { success: true };
  } catch (error) {
    console.error('[Hometax DB] Error recording sync operation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get tax invoices with filters
 */
export function getTaxInvoices(
  db: Database.Database,
  filters: {
    businessNumber?: string;
    invoiceType?: 'sales' | 'purchase';
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }
): { success: boolean; data?: any[]; total?: number; error?: string } {
  try {
    let query = 'SELECT * FROM tax_invoices WHERE 1=1';
    const params: any[] = [];

    if (filters.businessNumber) {
      query += ' AND business_number = ?';
      params.push(filters.businessNumber);
    }

    if (filters.invoiceType) {
      query += ' AND invoice_type = ?';
      params.push(filters.invoiceType);
    }

    if (filters.startDate) {
      query += ' AND 작성일자 >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ' AND 작성일자 <= ?';
      params.push(filters.endDate);
    }

    // Get total count
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
    const countResult = db.prepare(countQuery).get(...params) as { total: number };
    const total = countResult.total;

    // Add pagination
    query += ' ORDER BY 작성일자 DESC, 승인번호 DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (filters.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }

    const stmt = db.prepare(query);
    const results = stmt.all(...params);

    return {
      success: true,
      data: results,
      total
    };

  } catch (error) {
    console.error('[Hometax DB] Error getting invoices:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Save spreadsheet URL for exported tax invoices
 */
export function saveSpreadsheetUrl(
  db: Database.Database,
  businessNumber: string,
  invoiceType: 'sales' | 'purchase',
  spreadsheetUrl: string
): { success: boolean; error?: string } {
  try {
    console.log(`[Hometax DB] Saving spreadsheet URL for ${businessNumber} (${invoiceType})`);

    const columnName = invoiceType === 'sales' ? 'sales_spreadsheet_url' : 'purchase_spreadsheet_url';

    // Update hometax_connections table
    const stmt = db.prepare(`
      UPDATE hometax_connections
      SET ${columnName} = ?, updated_at = CURRENT_TIMESTAMP
      WHERE business_number = ?
    `);

    const result = stmt.run(spreadsheetUrl, businessNumber);

    if (result.changes === 0) {
      console.warn(`[Hometax DB] No connection found for business ${businessNumber}, creating one`);

      // Insert if doesn't exist
      const insertStmt = db.prepare(`
        INSERT INTO hometax_connections (business_number, ${columnName})
        VALUES (?, ?)
        ON CONFLICT(business_number) DO UPDATE SET ${columnName} = excluded.${columnName}, updated_at = CURRENT_TIMESTAMP
      `);

      insertStmt.run(businessNumber, spreadsheetUrl);
    }

    console.log(`[Hometax DB] Spreadsheet URL saved successfully`);

    return { success: true };
  } catch (error) {
    console.error('[Hometax DB] Error saving spreadsheet URL:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get saved spreadsheet URL for a business and invoice type
 */
export function getSpreadsheetUrl(
  db: Database.Database,
  businessNumber: string,
  invoiceType: 'sales' | 'purchase'
): { success: boolean; spreadsheetUrl?: string; error?: string } {
  try {
    const columnName = invoiceType === 'sales' ? 'sales_spreadsheet_url' : 'purchase_spreadsheet_url';

    const stmt = db.prepare(`
      SELECT ${columnName} as spreadsheet_url
      FROM hometax_connections
      WHERE business_number = ?
    `);

    const result = stmt.get(businessNumber) as { spreadsheet_url: string | null } | undefined;

    return {
      success: true,
      spreadsheetUrl: result?.spreadsheet_url || undefined
    };
  } catch (error) {
    console.error('[Hometax DB] Error getting spreadsheet URL:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get saved cash receipt spreadsheet URL for a business
 */
export function getCashReceiptSpreadsheetUrl(
  db: Database.Database,
  businessNumber: string
): { success: boolean; spreadsheetUrl?: string; error?: string } {
  try {
    const stmt = db.prepare(`
      SELECT cash_receipt_spreadsheet_url as spreadsheet_url
      FROM hometax_connections
      WHERE business_number = ?
    `);

    const result = stmt.get(businessNumber) as { spreadsheet_url: string | null } | undefined;

    return {
      success: true,
      spreadsheetUrl: result?.spreadsheet_url || undefined
    };
  } catch (error) {
    console.error('[Hometax DB] Error getting cash receipt spreadsheet URL:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Save cash receipt spreadsheet URL for a business
 */
export function saveCashReceiptSpreadsheetUrl(
  db: Database.Database,
  businessNumber: string,
  spreadsheetUrl: string
): { success: boolean; error?: string } {
  try {
    console.log(`[Hometax DB] Saving cash receipt spreadsheet URL for ${businessNumber}`);

    // Update hometax_connections table
    const stmt = db.prepare(`
      UPDATE hometax_connections
      SET cash_receipt_spreadsheet_url = ?, updated_at = CURRENT_TIMESTAMP
      WHERE business_number = ?
    `);

    const result = stmt.run(spreadsheetUrl, businessNumber);

    if (result.changes === 0) {
      console.warn(`[Hometax DB] No connection found for business ${businessNumber}, creating one`);

      // Insert if doesn't exist
      const insertStmt = db.prepare(`
        INSERT INTO hometax_connections (business_number, cash_receipt_spreadsheet_url)
        VALUES (?, ?)
        ON CONFLICT(business_number) DO UPDATE SET cash_receipt_spreadsheet_url = excluded.cash_receipt_spreadsheet_url, updated_at = CURRENT_TIMESTAMP
      `);

      insertStmt.run(businessNumber, spreadsheetUrl);
    }

    console.log(`[Hometax DB] Cash receipt spreadsheet URL saved successfully`);

    return { success: true };
  } catch (error) {
    console.error('[Hometax DB] Error saving cash receipt spreadsheet URL:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Import cash receipts into database
 */
export function importCashReceipts(
  db: Database.Database,
  businessNumber: string,
  receipts: CashReceiptData[],
  excelFilePath: string
): { success: boolean; inserted: number; duplicate: number; error?: string } {
  try {
    console.log(`[Hometax DB] Importing ${receipts.length} cash receipts for ${businessNumber}`);

    const insertStmt = db.prepare(`
      INSERT INTO cash_receipts (
        business_number,
        발행구분, 매출일시, 공급가액, 부가세, 봉사료, 총금액,
        승인번호, 신분확인뒷4자리, 거래구분, 용도구분, 비고,
        excel_file_path
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
      ON CONFLICT(business_number, 승인번호, 매출일시) DO NOTHING
    `);

    let inserted = 0;
    let duplicate = 0;

    const transaction = db.transaction((receipts: CashReceiptData[]) => {
      for (const receipt of receipts) {
        const result = insertStmt.run(
          businessNumber,
          receipt.발행구분,
          receipt.매출일시,
          receipt.공급가액,
          receipt.부가세,
          receipt.봉사료,
          receipt.총금액,
          receipt.승인번호,
          receipt.신분확인뒷4자리,
          receipt.거래구분,
          receipt.용도구분,
          receipt.비고,
          excelFilePath
        );

        if (result.changes > 0) {
          inserted++;
        } else {
          duplicate++;
        }
      }
    });

    transaction(receipts);

    console.log(`[Hometax DB] Import complete: ${inserted} inserted, ${duplicate} duplicates`);

    return {
      success: true,
      inserted,
      duplicate
    };

  } catch (error) {
    console.error('[Hometax DB] Error importing cash receipts:', error);
    return {
      success: false,
      inserted: 0,
      duplicate: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get cash receipts with filters
 */
export function getCashReceipts(
  db: Database.Database,
  filters: {
    businessNumber?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }
): { success: boolean; data?: any[]; total?: number; error?: string } {
  try {
    let query = 'SELECT * FROM cash_receipts WHERE 1=1';
    const params: any[] = [];

    if (filters.businessNumber) {
      query += ' AND business_number = ?';
      params.push(filters.businessNumber);
    }

    if (filters.startDate) {
      query += ' AND 매출일시 >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ' AND 매출일시 <= ?';
      params.push(filters.endDate);
    }

    // Get total count
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
    const countResult = db.prepare(countQuery).get(...params) as { total: number };
    const total = countResult.total;

    // Add pagination
    query += ' ORDER BY 매출일시 DESC, 승인번호 DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (filters.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }

    const stmt = db.prepare(query);
    const results = stmt.all(...params);

    return {
      success: true,
      data: results,
      total
    };

  } catch (error) {
    console.error('[Hometax DB] Error getting cash receipts:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
