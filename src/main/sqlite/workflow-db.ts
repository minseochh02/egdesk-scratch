import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WorkflowRow {
  id: string;
  label: string;
  status: 'active' | 'suggested' | 'draft';
  input_types: string;    // JSON array — input field names required to start a run
  hints: string;          // JSON array
  output_tables: string;  // JSON array
  suggested_by: string | null;
  trigger_table: string | null;  // user-data table whose new rows trigger this workflow
  created_at: string;
  updated_at: string;
}

export interface WorkflowActionRow {
  id: string;
  workflow_id: string;
  stage: number;          // 0-based stage index; actions with same stage run in parallel
  position: number;       // ordering within a stage
  action_id: string;      // action type: 'create_task' | 'approve' | 'update_status'
  params: string;         // JSON blob — full action definition (title, role, dueDays, approvalChain, …)
  depends_on: string;     // JSON array — IDs of actions this action depends on
  created_at: string;
}

export interface WorkflowNotifyRow {
  id: string;
  workflow_id: string;
  role: string;           // role subscribed to all activity updates for this workflow's runs
}

export type RunStatus = '정상진행중' | '반려중' | '정상완료' | '취소완료';

export interface WorkflowRunRow {
  id: string;
  workflow_id: string;
  input_json: string;     // JSON object — input field values supplied when run was started
  status: RunStatus;
  current_stage: number;
  source_table: string | null;   // user-data table that triggered this run
  source_row_id: string | null;  // specific row ID in that table
  created_at: string;
  updated_at: string;
}

export type ApprovalDecision = 'approved' | 'rejected' | 'cancelled';

export interface WorkflowApprovalRow {
  id: string;
  run_id: string;
  stage: number;
  chain_position: number; // 0 = lowest (e.g. 과장), ascending toward 대표이사
  role: string;
  decision: ApprovalDecision | null;
  decided_at: string | null;
  created_at: string;
}

// ─── Composed types ───────────────────────────────────────────────────────────

export interface WorkflowAction {
  rowId: string;               // DB row id — used for removeAction / reorderActions
  id: string;                  // action type: 'create_task' | 'approve' | 'update_status'
  params: Record<string, any>;
  stage: number;
  position: number;
  dependsOn: string[];
}

export interface WorkflowStage {
  stage: number;
  actions: WorkflowAction[];
}

export interface WorkflowWithActions {
  id: string;
  label: string;
  status: 'active' | 'suggested' | 'draft';
  inputTypes: string[];
  hints: string[];
  outputTables: string[];
  suggestedBy: string | null;
  triggerTable: string | null;  // user-data table whose new rows trigger this workflow
  notify: string[];            // roles subscribed to all run activity
  createdAt: string;
  updatedAt: string;
  stages: WorkflowStage[];     // actions grouped by stage, ordered
  actions: WorkflowAction[];   // flat list — convenience alias for stages[*].actions
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  inputData: Record<string, any>;
  status: RunStatus;
  currentStage: number;
  sourceTable: string | null;   // user-data table that triggered this run
  sourceRowId: string | null;   // specific row ID in that table
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowApproval {
  id: string;
  runId: string;
  stage: number;
  chainPosition: number;
  role: string;
  decision: ApprovalDecision | null;
  decidedAt: string | null;
  createdAt: string;
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const SEED_WORKFLOWS: Array<{
  id: string;
  label: string;
  status: 'active' | 'suggested' | 'draft';
  inputTypes: string[];
  hints: string[];
  outputTables: string[];
  suggestedBy: string;
  notify: string[];
  stages: Array<{ actions: Array<{ actionId: string; params: Record<string, any> }> }>;
}> = [
  {
    id: 'expense-receipt',
    label: 'Expense Receipt',
    status: 'active',
    inputTypes: ['image', 'pdf'],
    hints: ['receipt', 'amount', 'vendor'],
    outputTables: ['receipts'],
    suggestedBy: 'human',
    notify: [],
    stages: [
      {
        actions: [
          { actionId: 'create_row', params: { table: 'receipts' } },
          { actionId: 'notify',     params: { to: 'manager', channel: 'in_app' } },
        ],
      },
    ],
  },
  {
    id: 'vendor-invoice',
    label: 'Vendor Invoice',
    status: 'active',
    inputTypes: ['pdf', 'excel'],
    hints: ['invoice', 'due date', 'vendor'],
    outputTables: ['invoices'],
    suggestedBy: 'human',
    notify: [],
    stages: [
      {
        actions: [
          { actionId: 'create_row', params: { table: 'invoices' } },
          { actionId: 'flag',       params: { reason: 'amount > 500000', threshold: '500000' } },
        ],
      },
    ],
  },
  {
    id: 'business-card',
    label: 'Business Card',
    status: 'active',
    inputTypes: ['image'],
    hints: ['name', 'phone', 'company'],
    outputTables: ['contacts'],
    suggestedBy: 'human',
    notify: [],
    stages: [
      {
        actions: [
          { actionId: 'create_row',               params: { table: 'contacts' } },
          { actionId: 'lookup_company_knowledge', params: { source: 'hierarchy' } },
        ],
      },
    ],
  },
  {
    id: 'tool-request',
    label: 'Tool / Software Request',
    status: 'suggested',
    inputTypes: ['excel', 'pdf'],
    hints: ['request', 'tool', 'license'],
    outputTables: ['tool_requests'],
    suggestedBy: 'neuron_layer',
    notify: [],
    stages: [
      {
        actions: [
          { actionId: 'create_row',   params: { table: 'tool_requests' } },
          { actionId: 'request_info', params: { fields: 'justification, budget' } },
        ],
      },
      {
        actions: [
          { actionId: 'escalate', params: { to: 'it_manager', reason: 'new software' } },
        ],
      },
    ],
  },
  {
    id: 'contract-review',
    label: 'Contract Review',
    status: 'suggested',
    inputTypes: ['pdf'],
    hints: ['contract', 'agreement', 'terms'],
    outputTables: ['contracts'],
    suggestedBy: 'neuron_layer',
    notify: [],
    stages: [
      {
        actions: [
          { actionId: 'create_row', params: { table: 'contracts' } },
          { actionId: 'flag',       params: { reason: 'legal review required' } },
        ],
      },
      {
        actions: [
          { actionId: 'assign', params: { to: 'legal_team' } },
        ],
      },
    ],
  },
];

// ─── Manager ──────────────────────────────────────────────────────────────────

export class WorkflowDbManager {
  constructor(private db: Database.Database) {}

  // ── Helpers ───────────────────────────────────────────────────────────────

  private rowToWorkflow(
    row: WorkflowRow,
    actions: WorkflowActionRow[],
    notifyRoles: string[],
  ): WorkflowWithActions {
    const flatActions: WorkflowAction[] = actions.map(a => ({
      rowId: a.id,
      id: a.action_id,
      params: JSON.parse(a.params),
      stage: a.stage,
      position: a.position,
      dependsOn: JSON.parse(a.depends_on || '[]'),
    }));

    // Group by stage, preserving stage order
    const stageMap = new Map<number, WorkflowAction[]>();
    for (const a of flatActions) {
      if (!stageMap.has(a.stage)) stageMap.set(a.stage, []);
      stageMap.get(a.stage)!.push(a);
    }
    const stages: WorkflowStage[] = Array.from(stageMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([stage, stageActions]) => ({ stage, actions: stageActions }));

    return {
      id: row.id,
      label: row.label,
      status: row.status,
      inputTypes: JSON.parse(row.input_types),
      hints: JSON.parse(row.hints),
      outputTables: JSON.parse(row.output_tables),
      suggestedBy: row.suggested_by,
      triggerTable: row.trigger_table,
      notify: notifyRoles,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      stages,
      actions: flatActions,
    };
  }

  private getNotifyRoles(workflowId: string): string[] {
    const rows = this.db
      .prepare('SELECT role FROM workflow_notify WHERE workflow_id = ?')
      .all(workflowId) as { role: string }[];
    return rows.map(r => r.role);
  }

  private rowToRun(row: WorkflowRunRow): WorkflowRun {
    return {
      id: row.id,
      workflowId: row.workflow_id,
      inputData: JSON.parse(row.input_json),
      status: row.status,
      currentStage: row.current_stage,
      sourceTable: row.source_table,
      sourceRowId: row.source_row_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private rowToApproval(row: WorkflowApprovalRow): WorkflowApproval {
    return {
      id: row.id,
      runId: row.run_id,
      stage: row.stage,
      chainPosition: row.chain_position,
      role: row.role,
      decision: row.decision,
      decidedAt: row.decided_at,
      createdAt: row.created_at,
    };
  }

  // ── Workflow read ─────────────────────────────────────────────────────────

  getWorkflows(): WorkflowWithActions[] {
    const rows = this.db
      .prepare('SELECT * FROM workflows ORDER BY created_at')
      .all() as WorkflowRow[];

    return rows.map(w => {
      const actions = this.db
        .prepare('SELECT * FROM workflow_actions WHERE workflow_id = ? ORDER BY stage, position')
        .all(w.id) as WorkflowActionRow[];
      return this.rowToWorkflow(w, actions, this.getNotifyRoles(w.id));
    });
  }

  getWorkflow(id: string): WorkflowWithActions | null {
    const row = this.db
      .prepare('SELECT * FROM workflows WHERE id = ?')
      .get(id) as WorkflowRow | undefined;
    if (!row) return null;
    const actions = this.db
      .prepare('SELECT * FROM workflow_actions WHERE workflow_id = ? ORDER BY stage, position')
      .all(id) as WorkflowActionRow[];
    return this.rowToWorkflow(row, actions, this.getNotifyRoles(id));
  }

  // ── Workflow write ────────────────────────────────────────────────────────

  createWorkflow(data: {
    id?: string;
    label: string;
    status?: 'active' | 'suggested' | 'draft';
    inputTypes: string[];
    hints: string[];
    outputTables: string[];
    suggestedBy?: string | null;
    triggerTable?: string | null;
    notify?: string[];
    /** Flat list — each action must include stage (0-based) and position within that stage */
    actions: Array<{ actionId: string; params: Record<string, any>; stage?: number; position?: number }>;
  }): WorkflowWithActions {
    const id = data.id ?? randomUUID();
    const now = new Date().toISOString();

    const insertWorkflow = this.db.prepare(`
      INSERT INTO workflows (id, label, status, input_types, hints, output_tables, suggested_by, trigger_table, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertAction = this.db.prepare(`
      INSERT INTO workflow_actions (id, workflow_id, stage, position, action_id, params, depends_on, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertNotify = this.db.prepare(`
      INSERT INTO workflow_notify (id, workflow_id, role) VALUES (?, ?, ?)
    `);

    const tx = this.db.transaction(() => {
      insertWorkflow.run(
        id, data.label, data.status ?? 'draft',
        JSON.stringify(data.inputTypes),
        JSON.stringify(data.hints),
        JSON.stringify(data.outputTables),
        data.suggestedBy ?? null,
        data.triggerTable ?? null,
        now, now,
      );
      data.actions.forEach((a, i) => {
        const dependsOn = (a as any).dependsOn ?? a.params?.dependsOn ?? [];
        insertAction.run(
          randomUUID(), id,
          a.stage ?? 0,
          a.position ?? i,
          a.actionId, JSON.stringify(a.params), 
          JSON.stringify(dependsOn),
          now,
        );
      });
      for (const role of data.notify ?? []) {
        insertNotify.run(randomUUID(), id, role);
      }
    });
    tx();

    return this.getWorkflow(id)!;
  }

  updateWorkflow(id: string, data: {
    label?: string;
    status?: 'active' | 'suggested' | 'draft';
    inputTypes?: string[];
    hints?: string[];
    outputTables?: string[];
    triggerTable?: string | null;
  }): boolean {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.label        !== undefined) { fields.push('label = ?');         values.push(data.label); }
    if (data.status       !== undefined) { fields.push('status = ?');        values.push(data.status); }
    if (data.inputTypes   !== undefined) { fields.push('input_types = ?');   values.push(JSON.stringify(data.inputTypes)); }
    if (data.hints        !== undefined) { fields.push('hints = ?');         values.push(JSON.stringify(data.hints)); }
    if (data.outputTables !== undefined) { fields.push('output_tables = ?'); values.push(JSON.stringify(data.outputTables)); }
    if (data.triggerTable !== undefined) { fields.push('trigger_table = ?'); values.push(data.triggerTable); }

    if (fields.length === 0) return false;
    fields.push('updated_at = ?');
    values.push(new Date().toISOString(), id);

    const result = this.db
      .prepare(`UPDATE workflows SET ${fields.join(', ')} WHERE id = ?`)
      .run(...values);
    return result.changes > 0;
  }

  updateStatus(id: string, status: 'active' | 'suggested' | 'draft'): boolean {
    const result = this.db
      .prepare('UPDATE workflows SET status = ?, updated_at = ? WHERE id = ?')
      .run(status, new Date().toISOString(), id);
    return result.changes > 0;
  }

  deleteWorkflow(id: string): boolean {
    const result = this.db.prepare('DELETE FROM workflows WHERE id = ?').run(id);
    return result.changes > 0;
  }

  // ── Notify roles ──────────────────────────────────────────────────────────

  setNotifyRoles(workflowId: string, roles: string[]): void {
    const del = this.db.prepare('DELETE FROM workflow_notify WHERE workflow_id = ?');
    const ins = this.db.prepare('INSERT INTO workflow_notify (id, workflow_id, role) VALUES (?, ?, ?)');
    const tx = this.db.transaction(() => {
      del.run(workflowId);
      for (const role of roles) ins.run(randomUUID(), workflowId, role);
    });
    tx();
  }

  // ── Action steps ──────────────────────────────────────────────────────────

  addAction(
    workflowId: string,
    actionId: string,
    params: Record<string, any>,
    stage: number,
    position: number,
    dependsOn: string[] = [],
  ): WorkflowActionRow {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO workflow_actions (id, workflow_id, stage, position, action_id, params, depends_on, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, workflowId, stage, position, actionId, JSON.stringify(params), JSON.stringify(dependsOn), now);
    return this.db
      .prepare('SELECT * FROM workflow_actions WHERE id = ?')
      .get(id) as WorkflowActionRow;
  }

  removeAction(id: string): boolean {
    const result = this.db.prepare('DELETE FROM workflow_actions WHERE id = ?').run(id);
    return result.changes > 0;
  }

  reorderActions(workflowId: string, orderedRowIds: string[]): void {
    const update = this.db.prepare(
      'UPDATE workflow_actions SET position = ? WHERE id = ? AND workflow_id = ?',
    );
    const tx = this.db.transaction(() => {
      orderedRowIds.forEach((rowId, i) => update.run(i, rowId, workflowId));
    });
    tx();
  }

  // ── Run lifecycle ─────────────────────────────────────────────────────────

  createRun(data: {
    id?: string;
    workflowId: string;
    inputData: Record<string, any>;
    sourceTable?: string | null;
    sourceRowId?: string | null;
  }): WorkflowRun {
    const id = data.id ?? randomUUID();
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO workflow_runs (id, workflow_id, input_json, status, current_stage, source_table, source_row_id, created_at, updated_at)
      VALUES (?, ?, ?, '정상진행중', 0, ?, ?, ?, ?)
    `).run(id, data.workflowId, JSON.stringify(data.inputData), data.sourceTable ?? null, data.sourceRowId ?? null, now, now);
    return this.getRun(id)!;
  }

  getRun(id: string): WorkflowRun | null {
    const row = this.db
      .prepare('SELECT * FROM workflow_runs WHERE id = ?')
      .get(id) as WorkflowRunRow | undefined;
    return row ? this.rowToRun(row) : null;
  }

  getRuns(workflowId: string): WorkflowRun[] {
    const rows = this.db
      .prepare('SELECT * FROM workflow_runs WHERE workflow_id = ? ORDER BY created_at DESC')
      .all(workflowId) as WorkflowRunRow[];
    return rows.map(r => this.rowToRun(r));
  }

  updateRunStatus(id: string, status: RunStatus): boolean {
    const result = this.db
      .prepare('UPDATE workflow_runs SET status = ?, updated_at = ? WHERE id = ?')
      .run(status, new Date().toISOString(), id);
    return result.changes > 0;
  }

  advanceRunStage(id: string, stage: number): boolean {
    const result = this.db
      .prepare('UPDATE workflow_runs SET current_stage = ?, updated_at = ? WHERE id = ?')
      .run(stage, new Date().toISOString(), id);
    return result.changes > 0;
  }

  // ── Approvals ────────────────────────────────────────────────────────────

  createApproval(data: {
    runId: string;
    stage: number;
    chainPosition: number;
    role: string;
  }): WorkflowApproval {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO workflow_approvals (id, run_id, stage, chain_position, role, decision, decided_at, created_at)
      VALUES (?, ?, ?, ?, ?, NULL, NULL, ?)
    `).run(id, data.runId, data.stage, data.chainPosition, data.role, now);
    return this.rowToApproval(
      this.db.prepare('SELECT * FROM workflow_approvals WHERE id = ?').get(id) as WorkflowApprovalRow,
    );
  }

  getApprovals(runId: string): WorkflowApproval[] {
    const rows = this.db
      .prepare('SELECT * FROM workflow_approvals WHERE run_id = ? ORDER BY stage, chain_position')
      .all(runId) as WorkflowApprovalRow[];
    return rows.map(r => this.rowToApproval(r));
  }

  recordApprovalDecision(id: string, decision: ApprovalDecision): boolean {
    const result = this.db
      .prepare('UPDATE workflow_approvals SET decision = ?, decided_at = ? WHERE id = ?')
      .run(decision, new Date().toISOString(), id);
    return result.changes > 0;
  }

  // ── Seed ──────────────────────────────────────────────────────────────────

  seedIfEmpty(): void {
    const { n } = this.db
      .prepare('SELECT COUNT(*) as n FROM workflows')
      .get() as { n: number };
    if (n > 0) return;

    const now = new Date().toISOString();
    const insertWorkflow = this.db.prepare(`
      INSERT INTO workflows (id, label, status, input_types, hints, output_tables, suggested_by, trigger_table, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertAction = this.db.prepare(`
      INSERT INTO workflow_actions (id, workflow_id, stage, position, action_id, params, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertNotify = this.db.prepare(`
      INSERT INTO workflow_notify (id, workflow_id, role) VALUES (?, ?, ?)
    `);

    const tx = this.db.transaction(() => {
      for (const w of SEED_WORKFLOWS) {
        insertWorkflow.run(
          w.id, w.label, w.status,
          JSON.stringify(w.inputTypes), JSON.stringify(w.hints), JSON.stringify(w.outputTables),
          w.suggestedBy, null, now, now,
        );
        for (const role of w.notify) {
          insertNotify.run(randomUUID(), w.id, role);
        }
        w.stages.forEach((stage, stageIdx) => {
          stage.actions.forEach((a, pos) => {
            insertAction.run(
              randomUUID(), id, 
              stageIdx, pos, 
              a.actionId, JSON.stringify(a.params), 
              JSON.stringify((a as any).dependsOn ?? []),
              now
            );
          });
        });
      }
    });
    tx();

    console.log('✅ Workflow seed data inserted (5 workflows)');
  }
}
