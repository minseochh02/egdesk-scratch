import { ipcMain } from 'electron';
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

