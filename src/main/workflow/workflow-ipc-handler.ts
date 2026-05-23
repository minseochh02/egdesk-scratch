import { ipcMain } from 'electron';
import { randomUUID } from 'crypto';
import { getSQLiteManager } from '../sqlite/manager';
import { RunStatus, ApprovalDecision } from '../sqlite/workflow-db';
import { TasksCalendarService } from '../sqlite/tasks-calendar-service';

export function registerWorkflowIPCHandlers(): void {
  // ── Workflow CRUD ────────────────────────────────────────────────────────

  ipcMain.handle('workflow:get-all', async () => {
    try {
      const data = getSQLiteManager().getWorkflowManager().getWorkflows();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get workflows' };
    }
  });

  ipcMain.handle('workflow:create', async (_event, workflowData: any) => {
    try {
      const data = getSQLiteManager().getWorkflowManager().createWorkflow(workflowData);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to create workflow' };
    }
  });

  ipcMain.handle('workflow:update', async (_event, id: string, updateData: any) => {
    try {
      const ok = getSQLiteManager().getWorkflowManager().updateWorkflow(id, updateData);
      return { success: ok };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update workflow' };
    }
  });

  ipcMain.handle('workflow:update-status', async (_event, id: string, status: string) => {
    try {
      const ok = getSQLiteManager().getWorkflowManager().updateStatus(
        id,
        status as 'active' | 'suggested' | 'draft',
      );
      return { success: ok };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update workflow status' };
    }
  });

  ipcMain.handle('workflow:delete', async (_event, id: string) => {
    try {
      const ok = getSQLiteManager().getWorkflowManager().deleteWorkflow(id);
      return { success: ok };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete workflow' };
    }
  });

  // ── Notify roles ─────────────────────────────────────────────────────────

  ipcMain.handle('workflow:set-notify', async (_event, workflowId: string, roles: string[]) => {
    try {
      getSQLiteManager().getWorkflowManager().setNotifyRoles(workflowId, roles);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to set notify roles' };
    }
  });

  // ── Action steps ─────────────────────────────────────────────────────────

  ipcMain.handle('workflow:add-action', async (
    _event,
    workflowId: string,
    actionId: string,
    params: Record<string, any>,
    stage: number,
    position: number,
  ) => {
    try {
      const data = getSQLiteManager().getWorkflowManager().addAction(workflowId, actionId, params, stage, position);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to add action' };
    }
  });

  ipcMain.handle('workflow:remove-action', async (_event, id: string) => {
    try {
      const ok = getSQLiteManager().getWorkflowManager().removeAction(id);
      return { success: ok };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to remove action' };
    }
  });

  ipcMain.handle('workflow:reorder-actions', async (_event, workflowId: string, orderedRowIds: string[]) => {
    try {
      getSQLiteManager().getWorkflowManager().reorderActions(workflowId, orderedRowIds);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to reorder actions' };
    }
  });

  // ── Run lifecycle ────────────────────────────────────────────────────────

  ipcMain.handle('workflow:create-run', async (
    _event,
    workflowId: string,
    inputData: Record<string, any>,
    sourceTable?: string | null,
    sourceRowId?: string | null,
  ) => {
    try {
      const data = getSQLiteManager().getWorkflowManager().createRun({ workflowId, inputData, sourceTable, sourceRowId });
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to create run' };
    }
  });

  ipcMain.handle('workflow:get-run', async (_event, runId: string) => {
    try {
      const data = getSQLiteManager().getWorkflowManager().getRun(runId);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get run' };
    }
  });

  ipcMain.handle('workflow:get-runs', async (_event, workflowId: string) => {
    try {
      const data = getSQLiteManager().getWorkflowManager().getRuns(workflowId);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get runs' };
    }
  });

  ipcMain.handle('workflow:update-run-status', async (_event, runId: string, status: RunStatus) => {
    try {
      const ok = getSQLiteManager().getWorkflowManager().updateRunStatus(runId, status);
      return { success: ok };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update run status' };
    }
  });

  ipcMain.handle('workflow:advance-run-stage', async (_event, runId: string, stage: number) => {
    try {
      const ok = getSQLiteManager().getWorkflowManager().advanceRunStage(runId, stage);
      return { success: ok };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to advance run stage' };
    }
  });

  // ── Approvals ────────────────────────────────────────────────────────────

  ipcMain.handle('workflow:create-approval', async (
    _event,
    runId: string,
    stage: number,
    chainPosition: number,
    role: string,
  ) => {
    try {
      const data = getSQLiteManager().getWorkflowManager().createApproval({ runId, stage, chainPosition, role });
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to create approval' };
    }
  });

  ipcMain.handle('workflow:get-approvals', async (_event, runId: string) => {
    try {
      const data = getSQLiteManager().getWorkflowManager().getApprovals(runId);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get approvals' };
    }
  });

  ipcMain.handle('workflow:record-approval-decision', async (
    _event,
    approvalId: string,
    decision: ApprovalDecision,
  ) => {
    try {
      const ok = getSQLiteManager().getWorkflowManager().recordApprovalDecision(approvalId, decision);
      return { success: ok };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to record decision' };
    }
  });

  // ── Tasks & Company Calendar (이중 저장소) IPC 핸들러 ──────────────────────

  // 1. 활성 실무 태스크 조회 (오늘 할 일 목록용)
  ipcMain.handle('tasks:get-active', async (_event, role?: string) => {
    try {
      const data = TasksCalendarService.getInstance().getActiveTasks(role);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get active tasks' };
    }
  });

  // 2. 전사 공유 비즈니스 데드라인 조회 (상태 없음)
  ipcMain.handle('calendar:get-events', async () => {
    try {
      const data = TasksCalendarService.getInstance().getCalendarEvents();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get calendar events' };
    }
  });

  // ── Test: 받을어음 수신 시뮬레이션 ────────────────────────────────────────
  // 1) 트리거 워크플로(경리직원→과장→이사)가 없으면 자동 생성 후 active 전환
  // 2) ibk_b2b_receivables에 가짜 행 INSERT → updateHook → WorkflowTriggerEngine 기동
  ipcMain.handle('test:simulate-receivable', async () => {
    try {
      const manager = getSQLiteManager();
      const wfManager = manager.getWorkflowManager();

      // ── 워크플로 준비 ───────────────────────────────────────────────────
      const TRIGGER_TABLE = 'ibk_b2b_receivables';
      const existing = wfManager
        .getWorkflows()
        .find(w => w.triggerTable === TRIGGER_TABLE && w.status === 'active');

      const NOTIFY_ROLES = ['사원', '경리직원', '과장', '이사'];
      let workflowId: string;
      if (existing) {
        workflowId = existing.id;
        // Always re-apply notify roles so IPC push fires even on workflow reuse
        wfManager.setNotifyRoles(workflowId, NOTIFY_ROLES);
        console.log(`[Test] Reusing existing workflow: ${workflowId}`);
      } else {
        const created = wfManager.createWorkflow({
          label: '받을어음 수신 결재',
          status: 'active',
          inputTypes: [],
          hints: [],
          outputTables: [],
          triggerTable: TRIGGER_TABLE,
          actions: [],
        });
        workflowId = created.id;
        // 결재 라인: 경리직원 → 과장 → 이사
        wfManager.setNotifyRoles(workflowId, NOTIFY_ROLES);
        console.log(`[Test] Created workflow: ${workflowId}`);
      }

      // ── 가짜 받을어음 INSERT (메인 프로세스 DB 커넥션 경유 → updateHook 발화) ──
      const financeHubDb = manager.getFinanceHubDatabase();
      const noteId = randomUUID();
      const maturityDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);

      financeHubDb
        .prepare(`
          INSERT INTO ibk_b2b_receivables (
            id, note_number, buyer_name, buyer_biz_no,
            kind, status,
            receivable_amount, original_note_amount,
            registered_date, maturity_date
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          noteId,
          `TEST-${Date.now()}`,
          '(주)테스트거래처',
          '123-45-67890',
          '전자어음',
          '정상',
          50_000_000,
          50_000_000,
          new Date().toISOString().slice(0, 10),
          maturityDate,
        );

      console.log(`[Test] Inserted fake receivable: ${noteId} (maturity: ${maturityDate})`);

      // updateHook fires synchronously inside .run(), but the Electron IPC handler's
      // async context can suppress hook-to-renderer propagation in some builds.
      // Directly invoke the trigger engine so the test always exercises the full chain.
      const { WorkflowTriggerEngine } = require('../workflow/workflow-trigger-engine');
      await WorkflowTriggerEngine.getInstance()._handleInsertPublic(
        'ibk_b2b_receivables',
        noteId,
        financeHubDb,
      );

      return { success: true, noteId, workflowId };
    } catch (error) {
      console.error('[Test] simulate-receivable failed:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // ── Test: 시뮬레이션 데이터 일괄 삭제 ────────────────────────────────────────
  // ibk_b2b_receivables의 TEST- 행, 연결된 workflow_runs, company_calendar 이벤트를 제거
  ipcMain.handle('test:clear-sim-data', async () => {
    try {
      const manager = getSQLiteManager();
      const financeHubDb = manager.getFinanceHubDatabase();
      const neuronDb = manager.getNeuronDatabase();

      // 1. 테스트 받을어음 ID 목록 수집 (note_number가 TEST- 로 시작하는 행)
      const testRows = financeHubDb
        .prepare(`SELECT id FROM ibk_b2b_receivables WHERE note_number LIKE 'TEST-%'`)
        .all() as { id: string }[];

      const testIds = testRows.map(r => r.id);
      console.log(`[Test] Clearing ${testIds.length} test receivable(s)`);

      // 2. 연결된 workflow_runs 수집 (source_table + source_row_id 기준)
      let runIds: string[] = [];
      if (testIds.length > 0) {
        const placeholders = testIds.map(() => '?').join(', ');
        const runs = neuronDb
          .prepare(
            `SELECT id FROM workflow_runs
             WHERE source_table = 'ibk_b2b_receivables'
               AND source_row_id IN (${placeholders})`,
          )
          .all(...testIds) as { id: string }[];
        runIds = runs.map(r => r.id);
      }

      console.log(`[Test] Clearing ${runIds.length} workflow run(s)`);

      // 3. company_calendar 이벤트 삭제 (run_id 연결)
      if (runIds.length > 0) {
        const placeholders = runIds.map(() => '?').join(', ');
        const calResult = neuronDb
          .prepare(`DELETE FROM company_calendar WHERE run_id IN (${placeholders})`)
          .run(...runIds);
        console.log(`[Test] Deleted ${calResult.changes} calendar event(s)`);
      }

      // 4. workflow_runs 삭제
      if (runIds.length > 0) {
        const placeholders = runIds.map(() => '?').join(', ');
        neuronDb
          .prepare(`DELETE FROM workflow_runs WHERE id IN (${placeholders})`)
          .run(...runIds);
      }

      // 5. ibk_b2b_receivables TEST 행 삭제
      const fhResult = financeHubDb
        .prepare(`DELETE FROM ibk_b2b_receivables WHERE note_number LIKE 'TEST-%'`)
        .run();
      console.log(`[Test] Deleted ${fhResult.changes} test receivable(s)`);

      return {
        success: true,
        deleted: { receivables: fhResult.changes, runs: runIds.length },
      };
    } catch (error) {
      console.error('[Test] clear-sim-data failed:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // 3. 실무 태스크 완료 처리 및 승인/반려 의사 결정 반영
  ipcMain.handle('tasks:complete-task', async (
    _event, 
    taskId: string, 
    isApproval: boolean, 
    approveStatus: 'completed' | 'approved' | 'rejected'
  ) => {
    try {
      TasksCalendarService.getInstance().updateTaskStatus(taskId, approveStatus);
      
      // 태스크의 상태 변이가 발생하였으므로, 알림 브로드캐스트가 유기적으로 작동하도록 유도
      const { NotificationManager } = require('../notification/notification-manager');
      await NotificationManager.getInstance().handleTaskEvent(taskId, `업무가 ${approveStatus} 상태로 변경되었습니다.`);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to complete task' };
    }
  });
}

