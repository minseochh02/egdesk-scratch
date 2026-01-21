// ============================================
// Hometax Database Operations
// ============================================

import Database from 'better-sqlite3';
import { TaxInvoiceData } from '../hometax-excel-parser';

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
