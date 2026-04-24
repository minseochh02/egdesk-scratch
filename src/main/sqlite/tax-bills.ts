import Database from 'better-sqlite3';

/**
 * Import tax bill data into the database
 */
export function importTaxBillData(
  db: Database.Database,
  automationResult: any
): { success: boolean; inserted: number; updated: number; error?: string } {
  try {
    if (!automationResult.success || !automationResult.cards) {
      return { success: false, inserted: 0, updated: 0, error: 'Invalid automation result' };
    }

    let inserted = 0;
    let updated = 0;

    const transaction = db.transaction(() => {
      for (const card of automationResult.cards) {
        if (!card.scrapedBillData || !card.scrapedBillData.identifiedFields) continue;

        const fields = card.scrapedBillData.identifiedFields;
        const bizRegNo = fields.business_reg_no || '';
        const companyName = fields.business_name || '';

        if (!bizRegNo) continue;

        // 1. Upsert Tax Entity
        const entityResult = db.prepare(`
          INSERT INTO tax_entities (biz_reg_no, company_name, representative_name, address, updated_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(biz_reg_no) DO UPDATE SET
            company_name = excluded.company_name,
            representative_name = COALESCE(excluded.representative_name, tax_entities.representative_name),
            address = COALESCE(excluded.address, tax_entities.address),
            updated_at = CURRENT_TIMESTAMP
          RETURNING entity_id
        `).get(
          bizRegNo,
          companyName,
          null, // representative_name
          fields.business_address || null
        ) as { entity_id: number };

        const entityId = entityResult.entity_id;

        // 2. Upsert Tax Item
        const itemId = fields.tax_item_code || 'unknown';
        db.prepare(`
          INSERT INTO tax_items (item_id, tax_category, item_name, is_self_reported)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(item_id) DO UPDATE SET
            item_name = excluded.item_name
        `).run(
          itemId,
          'NATIONAL',
          fields.attribution_tax_item || card.title,
          fields.notice_type === '자진납부' ? 1 : 0
        );

        // 3. Parse Tax Period
        const fullPeriod = fields.tax_year || fields.attribution_period || '';
        const yearMatch = fullPeriod.match(/(\d{4})/);
        const periodYear = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
        const periodDetail = fullPeriod.replace(String(periodYear), '').trim();

        // 4. Map Status to ENUM
        let status = 'PENDING';
        if (card.status === '완납') status = 'PAID';
        else if (card.status === '결정취소') status = 'CANCELLED';
        // Add OVERDUE logic if current date > due_date
        const dueDate = fields.payment_deadline;
        if (status === 'PENDING' && dueDate) {
          const now = new Date().toISOString().split('T')[0];
          if (dueDate < now) status = 'OVERDUE';
        }

        // 5. Extract Education and Rural special taxes from breakdown
        const eduTax = (fields.tax_items_breakdown || []).find((t: any) => t.item.includes('교육세'))?.amount || 0;
        const ruralTax = (fields.tax_items_breakdown || []).find((t: any) => t.item.includes('농어촌'))?.amount || 0;

        // 6. Upsert Tax Document
        const docId = fields.e_payment_number || `GEN-${Date.now()}-${inserted + updated}`;
        
        const docResult = db.prepare(`
          INSERT INTO tax_documents (
            doc_id, entity_id, item_id, tax_category, period_year, period_detail,
            issue_date, due_date, tax_base_amount, main_tax_amount,
            edu_tax_amount, rural_tax_amount, total_amount,
            virtual_account, notice_number, bill_html_path, status, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(doc_id) DO UPDATE SET
            status = excluded.status,
            updated_at = CURRENT_TIMESTAMP
        `).run(
          docId,
          entityId,
          itemId,
          'NATIONAL',
          periodYear,
          periodDetail || null,
          fields.issue_date || null,
          fields.payment_deadline || '1970-01-01',
          fields.prev_period_tax_paid || 0,
          fields.calculated_tax_amount || 0,
          eduTax,
          ruralTax,
          fields.amount_due || 0,
          fields.virtual_account || fields.collection_account_no, // virtual_account
          fields.e_payment_number,
          card.htmlPath,
          status
        );

        if (docResult.changes > 0) {
          inserted++;
        } else {
          updated++;
        }

        // 7. Record Payment if status is 'PAID'
        if (status === 'PAID') {
          db.prepare(`
            INSERT INTO tax_payments (doc_id, paid_amount, status)
            VALUES (?, ?, ?)
          `).run(docId, fields.amount_due || 0, '완납');
        }
      }
    });

    transaction();

    return { success: true, inserted, updated };
  } catch (error) {
    console.error('[Hometax DB] Error importing tax bill data:', error);
    return {
      success: false,
      inserted: 0,
      updated: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get tax documents from the database
 */
export function getTaxDocuments(
  db: Database.Database,
  filters: {
    entity_id?: number;
    item_id?: string;
    status?: string;
    period_year?: number;
  }
): { success: boolean; data?: any[]; error?: string } {
  try {
    let query = `
      SELECT td.*, te.company_name, ti.item_name
      FROM tax_documents td
      JOIN tax_entities te ON td.entity_id = te.entity_id
      JOIN tax_items ti ON td.item_id = ti.item_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.entity_id) {
      query += ' AND td.entity_id = ?';
      params.push(filters.entity_id);
    }
    if (filters.item_id) {
      query += ' AND td.item_id = ?';
      params.push(filters.item_id);
    }
    if (filters.status) {
      query += ' AND td.status = ?';
      params.push(filters.status);
    }
    if (filters.period_year) {
      query += ' AND td.period_year = ?';
      params.push(filters.period_year);
    }

    query += ' ORDER BY td.due_date DESC';

    const results = db.prepare(query).all(...params);
    return { success: true, data: results };
  } catch (error) {
    console.error('[Hometax DB] Error getting tax documents:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
