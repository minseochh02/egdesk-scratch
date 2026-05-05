import { ipcMain } from 'electron';
import { getSQLiteManager } from '../sqlite/manager';
import { RunStatus, ApprovalDecision } from '../sqlite/workflow-db';

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
}
