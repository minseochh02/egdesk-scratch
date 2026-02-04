// ============================================
// Hometax Excel Parser
// Parse downloaded tax invoice Excel files
// ============================================

const XLSX = require('xlsx');
import path from 'path';
import fs from 'fs';

export interface TaxInvoiceData {
  작성일자: string;
  승인번호: string;
  발급일자: string;
  전송일자: string;
  공급자사업자등록번호: string;
  공급자종사업장번호: string;
  공급자상호: string;
  공급자대표자명: string;
  공급자주소: string;
  공급받는자사업자등록번호: string;
  공급받는자종사업장번호: string;
  공급받는자상호: string;
  공급받는자대표자명: string;
  공급받는자주소: string;
  합계금액: number;
  공급가액: number;
  세액: number;
  전자세금계산서분류: string;
  전자세금계산서종류: string;
  발급유형: string;
  비고: string;
  영수청구구분: string;
  공급자이메일: string;
  공급받는자이메일1: string;
  공급받는자이메일2: string;
  품목일자: string;
  품목명: string;
  품목규격: string;
  품목수량: string;
  품목단가: string;
  품목공급가액: number;
  품목세액: number;
  품목비고: string;
}

export interface ParsedExcelResult {
  success: boolean;
  businessNumber?: string;
  businessName?: string;
  representativeName?: string;
  invoices?: TaxInvoiceData[];
  totalAmount?: number;
  totalSupplyValue?: number;
  totalTax?: number;
  detectedType?: 'sales' | 'purchase'; // Detected from Excel file name/content
  error?: string;
}

/**
 * Parse Hometax tax invoice Excel file
 */
export function parseHometaxExcel(filePath: string): ParsedExcelResult {
  try {
    console.log('[Hometax Parser] Parsing Excel file:', filePath);

    // Detect invoice type from filename (매출 = sales, 매입 = purchase)
    const fileName = path.basename(filePath);
    let detectedType: 'sales' | 'purchase' | undefined;
    if (fileName.includes('매출')) {
      detectedType = 'sales';
      console.log('[Hometax Parser] Detected type from filename: 매출 (sales)');
    } else if (fileName.includes('매입')) {
      detectedType = 'purchase';
      console.log('[Hometax Parser] Detected type from filename: 매입 (purchase)');
    } else {
      console.warn('[Hometax Parser] Could not detect type from filename:', fileName);
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error('[Hometax Parser] File does not exist:', filePath);
      return {
        success: false,
        error: 'File not found: ' + filePath
      };
    }

    // Check file size (should be > 0)
    const stats = fs.statSync(filePath);
    console.log('[Hometax Parser] File size:', stats.size, 'bytes');

    if (stats.size === 0) {
      console.error('[Hometax Parser] File is empty');
      return {
        success: false,
        error: 'File is empty'
      };
    }

    // Read file as buffer to avoid permission issues
    console.log('[Hometax Parser] Reading file as buffer...');
    const buffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Convert to array of arrays
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

    // Extract business info from row 0
    const businessInfo = data[0] || [];
    const businessNumber = businessInfo[1] || '';
    const businessName = businessInfo[3] || '';
    const representativeName = businessInfo[5] || '';

    console.log('[Hometax Parser] Business:', businessName, businessNumber);

    // Extract totals from row 2
    const totals = data[2] || [];
    const totalAmountStr = totals[1] as string || '0';
    const totalSupplyValueStr = totals[3] as string || '0';
    const totalTaxStr = totals[5] as string || '0';

    // Parse numbers (remove commas)
    const totalAmount = parseInt(totalAmountStr.toString().replace(/,/g, '')) || 0;
    const totalSupplyValue = parseInt(totalSupplyValueStr.toString().replace(/,/g, '')) || 0;
    const totalTax = parseInt(totalTaxStr.toString().replace(/,/g, '')) || 0;

    // Headers are in row 5, data starts from row 6
    const invoices: TaxInvoiceData[] = [];

    for (let i = 6; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length < 33) continue; // Skip empty or incomplete rows

      // Parse numeric values (remove commas)
      const parseNumber = (val: any): number => {
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
          const cleaned = val.replace(/,/g, '');
          return parseInt(cleaned) || 0;
        }
        return 0;
      };

      const invoice: TaxInvoiceData = {
        작성일자: row[0] || '',
        승인번호: row[1] || '',
        발급일자: row[2] || '',
        전송일자: row[3] || '',
        공급자사업자등록번호: row[4] || '',
        공급자종사업장번호: row[5] || '',
        공급자상호: row[6] || '',
        공급자대표자명: row[7] || '',
        공급자주소: row[8] || '',
        공급받는자사업자등록번호: row[9] || '',
        공급받는자종사업장번호: row[10] || '',
        공급받는자상호: row[11] || '',
        공급받는자대표자명: row[12] || '',
        공급받는자주소: row[13] || '',
        합계금액: parseNumber(row[14]),
        공급가액: parseNumber(row[15]),
        세액: parseNumber(row[16]),
        전자세금계산서분류: row[17] || '',
        전자세금계산서종류: row[18] || '',
        발급유형: row[19] || '',
        비고: row[20] || '',
        영수청구구분: row[21] || '',
        공급자이메일: row[22] || '',
        공급받는자이메일1: row[23] || '',
        공급받는자이메일2: row[24] || '',
        품목일자: row[25] || '',
        품목명: row[26] || '',
        품목규격: row[27] || '',
        품목수량: row[28] || '',
        품목단가: row[29] || '',
        품목공급가액: parseNumber(row[30]),
        품목세액: parseNumber(row[31]),
        품목비고: row[32] || ''
      };

      invoices.push(invoice);
    }

    console.log(`[Hometax Parser] Parsed ${invoices.length} invoices`);

    return {
      success: true,
      businessNumber,
      businessName,
      representativeName,
      invoices,
      totalAmount,
      totalSupplyValue,
      totalTax,
      detectedType
    };

  } catch (error) {
    console.error('[Hometax Parser] Error parsing Excel:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
