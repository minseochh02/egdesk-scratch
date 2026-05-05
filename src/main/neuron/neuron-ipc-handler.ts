import { ipcMain } from 'electron';
import { getSQLiteManager } from '../sqlite/manager';

// Unified shape returned to the renderer
export interface DataSource {
  id: string;
  origin: 'userdata' | 'financehub' | 'businessidentity' | 'companyresearch';
  group?: string;       // when set, items with the same group render as their own section
  groupLabel?: string;  // display title for the group section
  label: string;
  sublabel: string;
  rowCount: number;
  processedAt: string | null;
  lastRowCount: number | null;
  entityCount: number;
}

/**
 * Neuron Layer IPC Handlers
 *
 * Handles IPC communication for neuron entity/relation/tag operations.
 */
export function registerNeuronIPCHandlers(): void {
  // ── Entities ──────────────────────────────────────────────────────────────

  ipcMain.handle('neuron:get-entities', async (_event, types?: string[]) => {
    try {
      const data = getSQLiteManager().getNeuronManager().getEntities(types);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get entities' };
    }
  });

  ipcMain.handle('neuron:create-entity', async (_event, entityData: any) => {
    try {
      const data = getSQLiteManager().getNeuronManager().createEntity(entityData);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to create entity' };
    }
  });

  ipcMain.handle('neuron:update-entity', async (_event, id: string, updateData: any) => {
    try {
      const ok = getSQLiteManager().getNeuronManager().updateEntity(id, updateData);
      return { success: ok };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update entity' };
    }
  });

  ipcMain.handle('neuron:delete-entity', async (_event, id: string) => {
    try {
      const ok = getSQLiteManager().getNeuronManager().deleteEntity(id);
      return { success: ok };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete entity' };
    }
  });

  // ── Relations ─────────────────────────────────────────────────────────────

  ipcMain.handle('neuron:get-relations', async (_event, fromId?: string) => {
    try {
      const data = getSQLiteManager().getNeuronManager().getRelations(fromId);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get relations' };
    }
  });

  ipcMain.handle('neuron:create-relation', async (_event, relationData: any) => {
    try {
      const data = getSQLiteManager().getNeuronManager().createRelation(relationData);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to create relation' };
    }
  });

  ipcMain.handle('neuron:delete-relation', async (_event, id: string) => {
    try {
      const ok = getSQLiteManager().getNeuronManager().deleteRelation(id);
      return { success: ok };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete relation' };
    }
  });

  // ── Tags ──────────────────────────────────────────────────────────────────

  ipcMain.handle('neuron:get-tags', async (_event, entityId?: string) => {
    try {
      const data = getSQLiteManager().getNeuronManager().getTags(entityId);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get tags' };
    }
  });

  ipcMain.handle('neuron:create-tag', async (_event, tagData: any) => {
    try {
      const data = getSQLiteManager().getNeuronManager().createTag(tagData);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to create tag' };
    }
  });

  ipcMain.handle('neuron:delete-tag', async (_event, id: string) => {
    try {
      const ok = getSQLiteManager().getNeuronManager().deleteTag(id);
      return { success: ok };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete tag' };
    }
  });

  // ── Data Sources ──────────────────────────────────────────────────────────

  ipcMain.handle('neuron:get-data-sources', async () => {
    try {
      const mgr = getSQLiteManager();
      const neuron = mgr.getNeuronManager();

      // Index source_registry by id for O(1) lookup
      const registry = neuron.getSourceRegistry();
      const regMap = new Map(registry.map(r => [r.id, r]));

      const sources: DataSource[] = [];

      // ── User Data ────────────────────────────────────────────────────────
      try {
        const tables = mgr.getUserDataManager().getAllTables();
        for (const t of tables) {
          const id = `userdata::${t.id}`;
          const reg = regMap.get(id);
          sources.push({
            id,
            origin: 'userdata',
            label: t.displayName,
            sublabel: `${t.rowCount.toLocaleString()} rows · ${t.columnCount} columns`,
            rowCount: t.rowCount,
            processedAt: reg?.processed_at ?? null,
            lastRowCount: reg?.last_row_count ?? null,
            entityCount: reg?.entity_count ?? 0,
          });
        }
      } catch (_) { /* user-data db may not be ready */ }

      // ── Finance Hub ───────────────────────────────────────────────────────
      try {
        const accounts = mgr.getFinanceHubManager().getAllAccounts();
        const banks = mgr.getFinanceHubManager().getAllBanks();
        const txCounts = mgr.getFinanceHubManager().getAccountTransactionCounts();
        const bankMap = new Map(banks.map(b => [b.id, b]));

        for (const acc of accounts) {
          const id = `financehub::${acc.id}`;
          const reg = regMap.get(id);
          const bank = bankMap.get(acc.bankId);
          const txCount = txCounts[acc.id] ?? 0;
          sources.push({
            id,
            origin: 'financehub',
            label: acc.accountName || acc.accountNumber,
            sublabel: `${bank?.nameKo ?? bank?.name ?? acc.bankId} · ${txCount.toLocaleString()} transactions`,
            rowCount: txCount,
            processedAt: reg?.processed_at ?? null,
            lastRowCount: reg?.last_row_count ?? null,
            entityCount: reg?.entity_count ?? 0,
          });
        }
      } catch (_) { /* financehub db may not be ready */ }

      // ── Business Identity — one group per brand ───────────────────────────
      try {
        const bim = mgr.getBusinessIdentityManager();

        const KNOWLEDGE_LABELS: Record<string, string> = {
          hierarchy: 'Org Hierarchy',
          process:   'Workflows & Processes',
          policy:    'Policies',
          note:      'Notes',
        };

        // Deduplicate snapshots by sourceUrl (or brandKey) — keep the most recent per brand
        const allSnapshots = bim.getAllSnapshots(); // already sorted DESC by created_at
        const seenBrandKey = new Set<string>();
        const snapshots = allSnapshots.filter(snap => {
          const key = snap.sourceUrl || snap.brandKey;
          if (seenBrandKey.has(key)) return false;
          seenBrandKey.add(key);
          return true;
        });

        for (const snap of snapshots) {
          // Resolve brand display name
          let brandName = snap.brandKey;
          try {
            const parsed = JSON.parse(snap.identityJson);
            if (parsed?.companyName) brandName = parsed.companyName;
            else if (parsed?.brandName) brandName = parsed.brandName;
          } catch (_) {}

          const groupKey = `businessidentity::${snap.id}`;

          // Identity snapshot itself
          const hasSeo = snap.seoAnalysisJson !== null;
          const hasSsl = snap.sslAnalysisJson !== null;
          const badges = [hasSeo ? 'SEO' : null, hasSsl ? 'SSL' : null].filter(Boolean).join(' · ');
          const snapRegId = `businessidentity::snapshot::${snap.id}`;
          const snapReg = regMap.get(snapRegId);
          sources.push({
            id: snapRegId,
            origin: 'businessidentity',
            group: groupKey,
            groupLabel: brandName,
            label: 'Identity Profile',
            sublabel: [snap.sourceUrl ?? snap.brandKey, badges].filter(Boolean).join(' · '),
            rowCount: 0,
            processedAt: snapReg?.processed_at ?? null,
            lastRowCount: snapReg?.last_row_count ?? null,
            entityCount: snapReg?.entity_count ?? 0,
          });

          // SNS plans for this snapshot
          const plans = bim.listPlans(snap.id);
          if (plans.length > 0) {
            const enabledCount = plans.filter(p => p.enabled).length;
            const id = `businessidentity::snsplans::${snap.id}`;
            const reg = regMap.get(id);
            sources.push({
              id,
              origin: 'businessidentity',
              group: groupKey,
              label: 'Scheduled Posts',
              sublabel: `${plans.length} plans · ${enabledCount} enabled`,
              rowCount: plans.length,
              processedAt: reg?.processed_at ?? null,
              lastRowCount: reg?.last_row_count ?? null,
              entityCount: reg?.entity_count ?? 0,
            });
          }

          // SNS accounts for this snapshot
          const accounts = bim.listAccounts(snap.id);
          if (accounts.length > 0) {
            const id = `businessidentity::snsaccounts::${snap.id}`;
            const reg = regMap.get(id);
            sources.push({
              id,
              origin: 'businessidentity',
              group: groupKey,
              label: 'SNS Accounts',
              sublabel: `${accounts.length} ${accounts.length === 1 ? 'account' : 'accounts'} · ${accounts.map(a => a.channel).join(', ')}`,
              rowCount: accounts.length,
              processedAt: reg?.processed_at ?? null,
              lastRowCount: reg?.last_row_count ?? null,
              entityCount: reg?.entity_count ?? 0,
            });
          }

          // Internal knowledge docs for this snapshot, per category
          const knowledgeDocs = bim.listKnowledgeDocuments(snap.id);
          const byCategory: Record<string, number> = {};
          for (const doc of knowledgeDocs) {
            byCategory[doc.category] = (byCategory[doc.category] ?? 0) + 1;
          }
          for (const [category, count] of Object.entries(byCategory)) {
            const id = `businessidentity::knowledge::${category}::${snap.id}`;
            const reg = regMap.get(id);
            sources.push({
              id,
              origin: 'businessidentity',
              group: groupKey,
              label: KNOWLEDGE_LABELS[category] ?? category,
              sublabel: `${count} ${count === 1 ? 'document' : 'documents'}`,
              rowCount: count,
              processedAt: reg?.processed_at ?? null,
              lastRowCount: reg?.last_row_count ?? null,
              entityCount: reg?.entity_count ?? 0,
            });
          }
        }
      } catch (_) { /* business identity db may not be ready */ }

      // ── Company Research — one item per researched company ───────────────
      try {
        const records = mgr.getCompanyResearchManager().getAllResearchMinimal();
        for (const rec of records) {
          const id = `companyresearch::${rec.id}`;
          const reg = regMap.get(id);
          const statusLabel = rec.status === 'completed' ? 'completed'
            : rec.status === 'in_progress' ? 'in progress'
            : rec.status;
          sources.push({
            id,
            origin: 'companyresearch',
            label: rec.companyName || rec.domain,
            sublabel: `${rec.companyName || rec.domain} · ${statusLabel}`,
            rowCount: 1,
            processedAt: reg?.processed_at ?? null,
            lastRowCount: reg?.last_row_count ?? null,
            entityCount: reg?.entity_count ?? 0,
          });
        }
      } catch (_) { /* company research db may not be ready */ }

      return { success: true, data: sources };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get data sources' };
    }
  });
}
