import { useState, useEffect, useCallback } from 'react';

// ─── Types (mirrored from workflow-db.ts — no main-process import) ─────────

export interface WorkflowAction {
  rowId: string;               // DB row id — for removeAction / reorderActions
  id: string;                  // action type: 'create_task' | 'approve' | 'update_status'
  params: Record<string, any>;
  stage: number;
  position: number;
}

export interface WorkflowStage {
  stage: number;
  actions: WorkflowAction[];
}

export interface WorkflowDef {
  id: string;
  label: string;
  status: 'active' | 'suggested' | 'draft';
  inputTypes: string[];
  hints: string[];
  outputTables: string[];
  suggestedBy: string | null;
  triggerTable: string | null;  // user-data table whose new rows trigger this workflow
  notify: string[];
  createdAt: string;
  updatedAt: string;
  stages: WorkflowStage[];
  actions: WorkflowAction[];  // flat — same data as stages[*].actions
}

export type RunStatus = '정상진행중' | '반려중' | '정상완료' | '취소완료';

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

export type ApprovalDecision = 'approved' | 'rejected' | 'cancelled';

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

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWorkflows() {
  const [workflows, setWorkflows] = useState<WorkflowDef[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke('workflow:get-all');
      if (!result.success) throw new Error(result.error ?? 'Failed to fetch workflows');
      setWorkflows(result.data as WorkflowDef[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Workflow CRUD ───────────────────────────────────────────────────────────

  const createWorkflow = useCallback(async (data: {
    label: string;
    status?: WorkflowDef['status'];
    inputTypes: string[];
    hints: string[];
    outputTables: string[];
    suggestedBy?: string | null;
    triggerTable?: string | null;
    notify?: string[];
    actions: Array<{ actionId: string; params: Record<string, any>; stage?: number; position?: number }>;
  }) => {
    const result = await window.electron.invoke('workflow:create', data);
    if (result.success) await fetchAll();
    return result;
  }, [fetchAll]);

  const updateWorkflow = useCallback(async (
    id: string,
    data: Partial<Pick<WorkflowDef, 'label' | 'status' | 'inputTypes' | 'hints' | 'outputTables' | 'triggerTable'>>,
  ) => {
    const result = await window.electron.invoke('workflow:update', id, data);
    if (result.success) await fetchAll();
    return result;
  }, [fetchAll]);

  const updateStatus = useCallback(async (id: string, status: WorkflowDef['status']) => {
    const result = await window.electron.invoke('workflow:update-status', id, status);
    if (result.success) await fetchAll();
    return result;
  }, [fetchAll]);

  const deleteWorkflow = useCallback(async (id: string) => {
    const result = await window.electron.invoke('workflow:delete', id);
    if (result.success) await fetchAll();
    return result;
  }, [fetchAll]);

  // ── Notify roles ────────────────────────────────────────────────────────────

  const setNotifyRoles = useCallback(async (workflowId: string, roles: string[]) => {
    const result = await window.electron.invoke('workflow:set-notify', workflowId, roles);
    if (result.success) await fetchAll();
    return result;
  }, [fetchAll]);

  // ── Action steps ────────────────────────────────────────────────────────────

  const addAction = useCallback(async (
    workflowId: string,
    actionId: string,
    params: Record<string, any>,
    stage: number,
    position: number,
  ) => {
    const result = await window.electron.invoke('workflow:add-action', workflowId, actionId, params, stage, position);
    if (result.success) await fetchAll();
    return result;
  }, [fetchAll]);

  const removeAction = useCallback(async (rowId: string) => {
    const result = await window.electron.invoke('workflow:remove-action', rowId);
    if (result.success) await fetchAll();
    return result;
  }, [fetchAll]);

  const reorderActions = useCallback(async (workflowId: string, orderedRowIds: string[]) => {
    const result = await window.electron.invoke('workflow:reorder-actions', workflowId, orderedRowIds);
    if (result.success) await fetchAll();
    return result;
  }, [fetchAll]);

  // ── Run lifecycle ───────────────────────────────────────────────────────────

  const createRun = useCallback(async (
    workflowId: string,
    inputData: Record<string, any>,
    sourceTable?: string | null,
    sourceRowId?: string | null,
  ) => {
    const result = await window.electron.invoke('workflow:create-run', workflowId, inputData, sourceTable, sourceRowId);
    return result as { success: boolean; data?: WorkflowRun; error?: string };
  }, []);

  const getRun = useCallback(async (runId: string) => {
    const result = await window.electron.invoke('workflow:get-run', runId);
    return result as { success: boolean; data?: WorkflowRun; error?: string };
  }, []);

  const getRuns = useCallback(async (workflowId: string) => {
    const result = await window.electron.invoke('workflow:get-runs', workflowId);
    return result as { success: boolean; data?: WorkflowRun[]; error?: string };
  }, []);

  const updateRunStatus = useCallback(async (runId: string, status: RunStatus) => {
    const result = await window.electron.invoke('workflow:update-run-status', runId, status);
    return result as { success: boolean; error?: string };
  }, []);

  const advanceRunStage = useCallback(async (runId: string, stage: number) => {
    const result = await window.electron.invoke('workflow:advance-run-stage', runId, stage);
    return result as { success: boolean; error?: string };
  }, []);

  // ── Approvals ───────────────────────────────────────────────────────────────

  const createApproval = useCallback(async (
    runId: string,
    stage: number,
    chainPosition: number,
    role: string,
  ) => {
    const result = await window.electron.invoke('workflow:create-approval', runId, stage, chainPosition, role);
    return result as { success: boolean; data?: WorkflowApproval; error?: string };
  }, []);

  const getApprovals = useCallback(async (runId: string) => {
    const result = await window.electron.invoke('workflow:get-approvals', runId);
    return result as { success: boolean; data?: WorkflowApproval[]; error?: string };
  }, []);

  const recordApprovalDecision = useCallback(async (approvalId: string, decision: ApprovalDecision) => {
    const result = await window.electron.invoke('workflow:record-approval-decision', approvalId, decision);
    return result as { success: boolean; error?: string };
  }, []);

  return {
    workflows,
    loading,
    error,
    fetchAll,
    // Workflow CRUD
    createWorkflow,
    updateWorkflow,
    updateStatus,
    deleteWorkflow,
    // Notify
    setNotifyRoles,
    // Actions
    addAction,
    removeAction,
    reorderActions,
    // Runs
    createRun,
    getRun,
    getRuns,
    updateRunStatus,
    advanceRunStage,
    // Approvals
    createApproval,
    getApprovals,
    recordApprovalDecision,
  };
}
