import { IMCPService, MCPTool, MCPServerInfo, MCPCapabilities, MCPToolResult } from '../types/mcp-service';
import { getSQLiteManager } from '../../sqlite/manager';
import type { DataSource } from '../../neuron/neuron-ipc-handler';

function ok(data: unknown): MCPToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

export class AICenterMCPService implements IMCPService {

  getServerInfo(): MCPServerInfo {
    return { name: 'ai-center-mcp-server', version: '1.0.0' };
  }

  getCapabilities(): MCPCapabilities {
    return { tools: {}, resources: {} };
  }

  listTools(): MCPTool[] {
    return [

      // ── Workflows ────────────────────────────────────────────────────────────

      {
        name: 'ai_center_list_workflows',
        description: 'List all AI workflows with their actions, status, and metadata',
        inputSchema: { type: 'object', properties: {}, required: [] },
      },
      {
        name: 'ai_center_get_workflow',
        description: 'Get a single workflow by ID including all action steps',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Workflow ID' },
          },
          required: ['id'],
        },
      },
      {
        name: 'ai_center_create_workflow',
        description: 'Create a new business process workflow with staged actions. Stages run sequentially; actions within a stage run in parallel. Use action types: create_task, approve, update_status.',
        inputSchema: {
          type: 'object',
          properties: {
            label:        { type: 'string',  description: 'Human-readable workflow name' },
            status:       { type: 'string',  enum: ['active', 'suggested', 'draft'], description: 'Initial status (default: draft)' },
            inputTypes:   { type: 'array',   items: { type: 'string' }, description: 'Input field names required to start a run, e.g. ["차량번호", "과태료_금액", "납부기한"]' },
            hints:        { type: 'array',   items: { type: 'string' }, description: 'Keyword hints for auto-matching' },
            outputTables:  { type: 'array',   items: { type: 'string' }, description: 'User-data table names this workflow writes to' },
            suggestedBy:   { type: 'string',  description: 'Origin: "neuron_layer" or "human"' },
            triggerTable:  { type: 'string',  description: 'User-data table name whose new rows trigger this workflow. Null if not table-triggered.' },
            notify:        { type: 'array',   items: { type: 'string' }, description: 'Roles subscribed to all run activity (status changes, approvals, task completions)' },
            actions: {
              type: 'array',
              description: 'Flat list of actions. Each must include stage (0-based) and position within that stage.',
              items: {
                type: 'object',
                properties: {
                  actionId: { type: 'string', description: 'Action type: "create_task" | "approve" | "update_status"' },
                  stage:    { type: 'number', description: 'Stage index (0-based). Actions with the same stage run in parallel.' },
                  position: { type: 'number', description: 'Order within the stage' },
                  params:   { type: 'object', description: 'Full action definition — e.g. { title, role, dueDays } for create_task; { title, approvalChain: [{role}] } for approve; { value } for update_status' },
                },
                required: ['actionId'],
              },
            },
          },
          required: ['label', 'inputTypes', 'hints', 'outputTables', 'actions'],
        },
      },
      {
        name: 'ai_center_update_workflow',
        description: 'Update metadata fields of an existing workflow',
        inputSchema: {
          type: 'object',
          properties: {
            id:           { type: 'string', description: 'Workflow ID' },
            label:        { type: 'string' },
            status:       { type: 'string', enum: ['active', 'suggested', 'draft'] },
            inputTypes:   { type: 'array',  items: { type: 'string' } },
            hints:        { type: 'array',  items: { type: 'string' } },
            outputTables: { type: 'array',  items: { type: 'string' } },
            triggerTable: { type: 'string', description: 'User-data table name whose new rows trigger this workflow. Pass null to clear.' },
          },
          required: ['id'],
        },
      },
      {
        name: 'ai_center_update_workflow_status',
        description: 'Change the status of a workflow (active / suggested / draft)',
        inputSchema: {
          type: 'object',
          properties: {
            id:     { type: 'string', description: 'Workflow ID' },
            status: { type: 'string', enum: ['active', 'suggested', 'draft'] },
          },
          required: ['id', 'status'],
        },
      },
      {
        name: 'ai_center_delete_workflow',
        description: 'Delete a workflow and all its action steps',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Workflow ID' },
          },
          required: ['id'],
        },
      },

      // ── Workflow actions ──────────────────────────────────────────────────────

      {
        name: 'ai_center_add_workflow_action',
        description: 'Add an action step to a workflow at a given stage and position',
        inputSchema: {
          type: 'object',
          properties: {
            workflowId: { type: 'string', description: 'Workflow ID' },
            actionId:   { type: 'string', description: 'Action type: "create_task" | "approve" | "update_status"' },
            params:     { type: 'object', description: 'Full action definition — title, role, dueDays, approvalChain, etc.' },
            stage:      { type: 'number', description: 'Stage index (0-based)' },
            position:   { type: 'number', description: 'Position within the stage (0-based)' },
          },
          required: ['workflowId', 'actionId', 'params', 'stage', 'position'],
        },
      },
      {
        name: 'ai_center_remove_workflow_action',
        description: 'Remove a single action step from a workflow by its row ID',
        inputSchema: {
          type: 'object',
          properties: {
            rowId: { type: 'string', description: 'The DB row id of the action step (from actions[].rowId)' },
          },
          required: ['rowId'],
        },
      },

      {
        name: 'ai_center_set_workflow_notify',
        description: 'Replace the notify role list for a workflow. These roles receive updates on every status change, task completion, and approval event for all runs.',
        inputSchema: {
          type: 'object',
          properties: {
            workflowId: { type: 'string', description: 'Workflow ID' },
            roles:      { type: 'array', items: { type: 'string' }, description: 'Full replacement list of role names' },
          },
          required: ['workflowId', 'roles'],
        },
      },

      // ── Workflow runs ─────────────────────────────────────────────────────────

      {
        name: 'ai_center_create_run',
        description: 'Start a new workflow run by providing the input field values. Status begins as 정상진행중.',
        inputSchema: {
          type: 'object',
          properties: {
            workflowId:  { type: 'string', description: 'Workflow ID' },
            inputData:   { type: 'object', description: 'Input field values, e.g. { "차량번호": "12가3456", "과태료_금액": 80000 }' },
            sourceTable: { type: 'string', description: 'User-data table name this run was triggered from' },
            sourceRowId: { type: 'string', description: 'Row ID in sourceTable that triggered this run' },
          },
          required: ['workflowId', 'inputData'],
        },
      },
      {
        name: 'ai_center_get_run',
        description: 'Get a workflow run by ID, including status and current stage',
        inputSchema: {
          type: 'object',
          properties: {
            runId: { type: 'string', description: 'Run ID' },
          },
          required: ['runId'],
        },
      },
      {
        name: 'ai_center_get_runs',
        description: 'List all runs for a workflow, newest first',
        inputSchema: {
          type: 'object',
          properties: {
            workflowId: { type: 'string', description: 'Workflow ID' },
          },
          required: ['workflowId'],
        },
      },
      {
        name: 'ai_center_update_run_status',
        description: 'Update the status of a workflow run. Valid values: 정상진행중 · 반려중 · 정상완료 · 취소완료',
        inputSchema: {
          type: 'object',
          properties: {
            runId:  { type: 'string', description: 'Run ID' },
            status: { type: 'string', enum: ['정상진행중', '반려중', '정상완료', '취소완료'] },
          },
          required: ['runId', 'status'],
        },
      },
      {
        name: 'ai_center_advance_run_stage',
        description: 'Advance a run to the next stage (set current_stage). Call after all actions in the current stage are complete.',
        inputSchema: {
          type: 'object',
          properties: {
            runId: { type: 'string', description: 'Run ID' },
            stage: { type: 'number', description: 'New stage index to advance to' },
          },
          required: ['runId', 'stage'],
        },
      },

      // ── Approvals ─────────────────────────────────────────────────────────────

      {
        name: 'ai_center_create_approval',
        description: 'Create a pending approval record for a role at a given stage and chain position in a run',
        inputSchema: {
          type: 'object',
          properties: {
            runId:         { type: 'string', description: 'Run ID' },
            stage:         { type: 'number', description: 'Stage index this approval belongs to' },
            chainPosition: { type: 'number', description: '0 = lowest approver (e.g. 과장), ascending toward 대표이사' },
            role:          { type: 'string', description: 'Role assigned to approve, e.g. "경영지원팀 과장"' },
          },
          required: ['runId', 'stage', 'chainPosition', 'role'],
        },
      },
      {
        name: 'ai_center_get_approvals',
        description: 'List all approval records for a run, ordered by stage and chain position',
        inputSchema: {
          type: 'object',
          properties: {
            runId: { type: 'string', description: 'Run ID' },
          },
          required: ['runId'],
        },
      },
      {
        name: 'ai_center_record_approval_decision',
        description: 'Record a decision on a pending approval. approved → moves chain up; rejected → steps back one level; cancelled → terminates the run.',
        inputSchema: {
          type: 'object',
          properties: {
            approvalId: { type: 'string', description: 'Approval record ID' },
            decision:   { type: 'string', enum: ['approved', 'rejected', 'cancelled'] },
          },
          required: ['approvalId', 'decision'],
        },
      },

      // ── Data Sources ─────────────────────────────────────────────────────────

      {
        name: 'ai_center_list_data_sources',
        description: 'List all data sources available for AI processing — user data tables, finance hub accounts, business identity snapshots, and company research records — with processing state (never / processed / stale)',
        inputSchema: { type: 'object', properties: {}, required: [] },
      },

      // ── Entities ─────────────────────────────────────────────────────────────

      {
        name: 'ai_center_list_entities',
        description: 'List all Neuron Layer entities (companies, people, products, etc.), optionally filtered by type',
        inputSchema: {
          type: 'object',
          properties: {
            types: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter by entity types, e.g. ["company", "person"]',
            },
          },
          required: [],
        },
      },
      {
        name: 'ai_center_create_entity',
        description: 'Create a new entity in the Neuron Layer',
        inputSchema: {
          type: 'object',
          properties: {
            id:         { type: 'string',  description: 'UUID — generate one if not provided' },
            type:       { type: 'string',  description: 'Entity type, e.g. "company", "person"' },
            name:       { type: 'string',  description: 'Display name' },
            raw:        { type: 'string',  description: 'JSON metadata blob, e.g. {"tables":["receipts"],"rowCount":42}' },
            source:     { type: 'string',  enum: ['ai', 'human'], description: 'How this entity was created' },
            confidence: { type: 'number',  description: 'Confidence score 0–1 (default 1.0)' },
          },
          required: ['type', 'name', 'source'],
        },
      },
      {
        name: 'ai_center_delete_entity',
        description: 'Delete an entity from the Neuron Layer',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Entity ID' },
          },
          required: ['id'],
        },
      },

      // ── Relations ─────────────────────────────────────────────────────────────

      {
        name: 'ai_center_list_relations',
        description: 'List all relations between entities, optionally filtered by source entity ID',
        inputSchema: {
          type: 'object',
          properties: {
            fromId: { type: 'string', description: 'Filter to relations originating from this entity ID' },
          },
          required: [],
        },
      },
      {
        name: 'ai_center_create_relation',
        description: 'Create a relation edge between two entities',
        inputSchema: {
          type: 'object',
          properties: {
            id:         { type: 'string', description: 'UUID — generate one if not provided' },
            from_type:  { type: 'string', description: 'Source entity type' },
            from_id:    { type: 'string', description: 'Source entity ID' },
            to_type:    { type: 'string', description: 'Target entity type' },
            to_id:      { type: 'string', description: 'Target entity ID' },
            relation:   { type: 'string', description: 'Relationship label, e.g. "vendor_of", "employs"' },
            source:     { type: 'string', enum: ['ai', 'human'] },
            confidence: { type: 'number', description: 'Confidence score 0–1 (default 1.0)' },
          },
          required: ['from_type', 'from_id', 'to_type', 'to_id', 'relation', 'source'],
        },
      },
      {
        name: 'ai_center_delete_relation',
        description: 'Delete a relation edge by ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Relation ID' },
          },
          required: ['id'],
        },
      },

      // ── Tags ─────────────────────────────────────────────────────────────────

      {
        name: 'ai_center_list_tags',
        description: 'List all tags/properties, optionally filtered by entity ID',
        inputSchema: {
          type: 'object',
          properties: {
            entityId: { type: 'string', description: 'Filter tags belonging to this entity ID' },
          },
          required: [],
        },
      },
      {
        name: 'ai_center_create_tag',
        description: 'Create a tag/property on an entity or document',
        inputSchema: {
          type: 'object',
          properties: {
            id:         { type: 'string', description: 'UUID — generate one if not provided' },
            doc_type:   { type: 'string', description: 'Document type, e.g. "row"' },
            doc_id:     { type: 'string', description: 'Document ID' },
            doc_ref:    { type: 'string', description: 'Optional human-readable reference' },
            namespace:  { type: 'string', description: 'Tag namespace/category, e.g. "status", "priority"' },
            value:      { type: 'string', description: 'Tag value' },
            entity_id:  { type: 'string', description: 'Entity this tag belongs to' },
            source:     { type: 'string', enum: ['ai', 'human'] },
            confidence: { type: 'number', description: 'Confidence score 0–1 (default 1.0)' },
          },
          required: ['doc_type', 'doc_id', 'namespace', 'value', 'source'],
        },
      },
      {
        name: 'ai_center_delete_tag',
        description: 'Delete a tag by ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Tag ID' },
          },
          required: ['id'],
        },
      },
    ];
  }

  async executeTool(name: string, args: Record<string, any>): Promise<MCPToolResult> {
    const manager = getSQLiteManager();
    const workflows = manager.getWorkflowManager();
    const neuron    = manager.getNeuronManager();

    switch (name) {

      // ── Workflows ──────────────────────────────────────────────────────────

      case 'ai_center_list_workflows':
        return ok(workflows.getWorkflows());

      case 'ai_center_get_workflow': {
        const w = workflows.getWorkflow(args.id);
        if (!w) throw new Error(`Workflow not found: ${args.id}`);
        return ok(w);
      }

      case 'ai_center_create_workflow': {
        const { label, status, inputTypes, hints, outputTables, suggestedBy, triggerTable, notify, actions } = args;
        if (!label)        throw new Error('Missing required: label');
        if (!inputTypes)   throw new Error('Missing required: inputTypes');
        if (!hints)        throw new Error('Missing required: hints');
        if (!outputTables) throw new Error('Missing required: outputTables');
        if (!actions)      throw new Error('Missing required: actions');
        const w = workflows.createWorkflow({ label, status, inputTypes, hints, outputTables, suggestedBy, triggerTable, notify, actions });
        return ok(w);
      }

      case 'ai_center_update_workflow': {
        const { id, ...data } = args;
        if (!id) throw new Error('Missing required: id');
        const changed = workflows.updateWorkflow(id, data);
        return ok({ updated: changed });
      }

      case 'ai_center_update_workflow_status': {
        const { id, status } = args;
        if (!id || !status) throw new Error('Missing required: id, status');
        const changed = workflows.updateStatus(id, status);
        return ok({ updated: changed });
      }

      case 'ai_center_delete_workflow': {
        if (!args.id) throw new Error('Missing required: id');
        const deleted = workflows.deleteWorkflow(args.id);
        return ok({ deleted });
      }

      case 'ai_center_add_workflow_action': {
        const { workflowId, actionId, params, stage, position } = args;
        if (!workflowId || !actionId) throw new Error('Missing required: workflowId, actionId');
        const row = workflows.addAction(workflowId, actionId, params ?? {}, stage ?? 0, position ?? 0);
        return ok(row);
      }

      case 'ai_center_remove_workflow_action': {
        if (!args.rowId) throw new Error('Missing required: rowId');
        const deleted = workflows.removeAction(args.rowId);
        return ok({ deleted });
      }

      case 'ai_center_set_workflow_notify': {
        const { workflowId, roles } = args;
        if (!workflowId || !Array.isArray(roles)) throw new Error('Missing required: workflowId, roles');
        workflows.setNotifyRoles(workflowId, roles);
        return ok({ updated: true });
      }

      // ── Workflow runs ────────────────────────────────────────────────────────

      case 'ai_center_create_run': {
        const { workflowId, inputData, sourceTable, sourceRowId } = args;
        if (!workflowId) throw new Error('Missing required: workflowId');
        const run = workflows.createRun({ workflowId, inputData: inputData ?? {}, sourceTable, sourceRowId });
        return ok(run);
      }

      case 'ai_center_get_run': {
        if (!args.runId) throw new Error('Missing required: runId');
        const run = workflows.getRun(args.runId);
        if (!run) throw new Error(`Run not found: ${args.runId}`);
        return ok(run);
      }

      case 'ai_center_get_runs': {
        if (!args.workflowId) throw new Error('Missing required: workflowId');
        return ok(workflows.getRuns(args.workflowId));
      }

      case 'ai_center_update_run_status': {
        const { runId, status } = args;
        if (!runId || !status) throw new Error('Missing required: runId, status');
        const updated = workflows.updateRunStatus(runId, status);
        return ok({ updated });
      }

      case 'ai_center_advance_run_stage': {
        const { runId, stage } = args;
        if (!runId || stage === undefined) throw new Error('Missing required: runId, stage');
        const updated = workflows.advanceRunStage(runId, stage);
        return ok({ updated });
      }

      // ── Approvals ────────────────────────────────────────────────────────────

      case 'ai_center_create_approval': {
        const { runId, stage, chainPosition, role } = args;
        if (!runId || stage === undefined || chainPosition === undefined || !role) {
          throw new Error('Missing required: runId, stage, chainPosition, role');
        }
        const approval = workflows.createApproval({ runId, stage, chainPosition, role });
        return ok(approval);
      }

      case 'ai_center_get_approvals': {
        if (!args.runId) throw new Error('Missing required: runId');
        return ok(workflows.getApprovals(args.runId));
      }

      case 'ai_center_record_approval_decision': {
        const { approvalId, decision } = args;
        if (!approvalId || !decision) throw new Error('Missing required: approvalId, decision');
        const updated = workflows.recordApprovalDecision(approvalId, decision);
        return ok({ updated });
      }

      // ── Data Sources ──────────────────────────────────────────────────────

      case 'ai_center_list_data_sources': {
        const mgr = getSQLiteManager();
        const neuron = mgr.getNeuronManager();
        const registry = neuron.getSourceRegistry();
        const regMap = new Map(registry.map(r => [r.id, r]));
        const sources: DataSource[] = [];

        try {
          const tables = mgr.getUserDataManager().getAllTables();
          for (const t of tables) {
            const id = `userdata::${t.id}`;
            const reg = regMap.get(id);
            sources.push({ id, origin: 'userdata', label: t.displayName,
              sublabel: `${t.rowCount.toLocaleString()} rows · ${t.columnCount} columns`,
              rowCount: t.rowCount, processedAt: reg?.processed_at ?? null,
              lastRowCount: reg?.last_row_count ?? null, entityCount: reg?.entity_count ?? 0 });
          }
        } catch (_) {}

        try {
          const accounts = mgr.getFinanceHubManager().getAllAccounts();
          const banks    = mgr.getFinanceHubManager().getAllBanks();
          const txCounts = mgr.getFinanceHubManager().getAccountTransactionCounts();
          const bankMap  = new Map(banks.map(b => [b.id, b]));
          for (const acc of accounts) {
            const id  = `financehub::${acc.id}`;
            const reg = regMap.get(id);
            const bank   = bankMap.get(acc.bankId);
            const txCount = txCounts[acc.id] ?? 0;
            sources.push({ id, origin: 'financehub',
              label: acc.accountName || acc.accountNumber,
              sublabel: `${bank?.nameKo ?? bank?.name ?? acc.bankId} · ${txCount.toLocaleString()} transactions`,
              rowCount: txCount, processedAt: reg?.processed_at ?? null,
              lastRowCount: reg?.last_row_count ?? null, entityCount: reg?.entity_count ?? 0 });
          }
        } catch (_) {}

        try {
          const bim = mgr.getBusinessIdentityManager();
          const KNOWLEDGE_LABELS: Record<string, string> = {
            hierarchy: 'Org Hierarchy', process: 'Workflows & Processes',
            policy: 'Policies', note: 'Notes',
          };
          const allSnapshots = bim.getAllSnapshots();
          const seenBrandKey = new Set<string>();
          const snapshots = allSnapshots.filter(snap => {
            const key = snap.sourceUrl || snap.brandKey;
            if (seenBrandKey.has(key)) return false;
            seenBrandKey.add(key); return true;
          });
          for (const snap of snapshots) {
            let brandName = snap.brandKey;
            try { const p = JSON.parse(snap.identityJson); if (p?.companyName) brandName = p.companyName; else if (p?.brandName) brandName = p.brandName; } catch (_) {}
            const groupKey = `businessidentity::${snap.id}`;
            const hasSeo = snap.seoAnalysisJson !== null;
            const hasSsl = snap.sslAnalysisJson !== null;
            const badges = [hasSeo ? 'SEO' : null, hasSsl ? 'SSL' : null].filter(Boolean).join(' · ');
            const snapRegId = `businessidentity::snapshot::${snap.id}`;
            const snapReg = regMap.get(snapRegId);
            sources.push({ id: snapRegId, origin: 'businessidentity', group: groupKey, groupLabel: brandName,
              label: 'Identity Profile', sublabel: [snap.sourceUrl ?? snap.brandKey, badges].filter(Boolean).join(' · '),
              rowCount: 0, processedAt: snapReg?.processed_at ?? null,
              lastRowCount: snapReg?.last_row_count ?? null, entityCount: snapReg?.entity_count ?? 0 });
            const plans = bim.listPlans(snap.id);
            if (plans.length > 0) {
              const id = `businessidentity::snsplans::${snap.id}`;
              const reg = regMap.get(id);
              sources.push({ id, origin: 'businessidentity', group: groupKey,
                label: 'Scheduled Posts', sublabel: `${plans.length} plans · ${plans.filter(p => p.enabled).length} enabled`,
                rowCount: plans.length, processedAt: reg?.processed_at ?? null,
                lastRowCount: reg?.last_row_count ?? null, entityCount: reg?.entity_count ?? 0 });
            }
            const accounts = bim.listAccounts(snap.id);
            if (accounts.length > 0) {
              const id = `businessidentity::snsaccounts::${snap.id}`;
              const reg = regMap.get(id);
              sources.push({ id, origin: 'businessidentity', group: groupKey,
                label: 'SNS Accounts', sublabel: `${accounts.length} ${accounts.length === 1 ? 'account' : 'accounts'} · ${accounts.map(a => a.channel).join(', ')}`,
                rowCount: accounts.length, processedAt: reg?.processed_at ?? null,
                lastRowCount: reg?.last_row_count ?? null, entityCount: reg?.entity_count ?? 0 });
            }
            const knowledgeDocs = bim.listKnowledgeDocuments(snap.id);
            const byCategory: Record<string, number> = {};
            for (const doc of knowledgeDocs) { byCategory[doc.category] = (byCategory[doc.category] ?? 0) + 1; }
            for (const [category, count] of Object.entries(byCategory)) {
              const id = `businessidentity::knowledge::${category}::${snap.id}`;
              const reg = regMap.get(id);
              sources.push({ id, origin: 'businessidentity', group: groupKey,
                label: KNOWLEDGE_LABELS[category] ?? category, sublabel: `${count} ${count === 1 ? 'document' : 'documents'}`,
                rowCount: count, processedAt: reg?.processed_at ?? null,
                lastRowCount: reg?.last_row_count ?? null, entityCount: reg?.entity_count ?? 0 });
            }
          }
        } catch (_) {}

        try {
          const records = mgr.getCompanyResearchManager().getAllResearchMinimal();
          for (const rec of records) {
            const id  = `companyresearch::${rec.id}`;
            const reg = regMap.get(id);
            const statusLabel = rec.status === 'completed' ? 'completed' : rec.status === 'in_progress' ? 'in progress' : rec.status;
            sources.push({ id, origin: 'companyresearch',
              label: rec.companyName || rec.domain,
              sublabel: `${rec.companyName || rec.domain} · ${statusLabel}`,
              rowCount: 1, processedAt: reg?.processed_at ?? null,
              lastRowCount: reg?.last_row_count ?? null, entityCount: reg?.entity_count ?? 0 });
          }
        } catch (_) {}

        return ok(sources);
      }

      // ── Entities ──────────────────────────────────────────────────────────

      case 'ai_center_list_entities':
        return ok(neuron.getEntities(args.types));

      case 'ai_center_create_entity': {
        const { id, type, name, raw, source, confidence } = args;
        if (!type || !name || !source) throw new Error('Missing required: type, name, source');
        const entity = neuron.createEntity({ id, type, name, raw, source, confidence });
        return ok(entity);
      }

      case 'ai_center_delete_entity': {
        if (!args.id) throw new Error('Missing required: id');
        const deleted = neuron.deleteEntity(args.id);
        return ok({ deleted });
      }

      // ── Relations ─────────────────────────────────────────────────────────

      case 'ai_center_list_relations':
        return ok(neuron.getRelations(args.fromId));

      case 'ai_center_create_relation': {
        const { id, from_type, from_id, to_type, to_id, relation, source, confidence } = args;
        if (!from_type || !from_id || !to_type || !to_id || !relation || !source) {
          throw new Error('Missing required: from_type, from_id, to_type, to_id, relation, source');
        }
        const rel = neuron.createRelation({ id, from_type, from_id, to_type, to_id, relation, source, confidence });
        return ok(rel);
      }

      case 'ai_center_delete_relation': {
        if (!args.id) throw new Error('Missing required: id');
        const deleted = neuron.deleteRelation(args.id);
        return ok({ deleted });
      }

      // ── Tags ──────────────────────────────────────────────────────────────

      case 'ai_center_list_tags':
        return ok(neuron.getTags(args.entityId));

      case 'ai_center_create_tag': {
        const { id, doc_type, doc_id, doc_ref, namespace, value, entity_id, source, confidence } = args;
        if (!doc_type || !doc_id || !namespace || !value || !source) {
          throw new Error('Missing required: doc_type, doc_id, namespace, value, source');
        }
        const tag = neuron.createTag({ id, doc_type, doc_id, doc_ref, namespace, value, entity_id, source, confidence });
        return ok(tag);
      }

      case 'ai_center_delete_tag': {
        if (!args.id) throw new Error('Missing required: id');
        const deleted = neuron.deleteTag(args.id);
        return ok({ deleted });
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }
}
