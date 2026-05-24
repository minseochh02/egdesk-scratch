import { BrowserWindow } from 'electron';
import Database from 'better-sqlite3';

/**
 * WorkflowTriggerEngine
 *
 * FinanceHub DB의 updateHook 이벤트를 받아 trigger_table 이 일치하는
 * 활성 워크플로를 자동으로 기동(run_spawn)합니다.
 *
 * 기동 시 수행하는 3가지 작업:
 *  1. workflow_runs 레코드 생성 (createRun)
 *  2. company_calendar 이벤트 적재 — 어음 만기일 기준, 상태 없음 (인간용 뷰)
 *  3. notify 역할군 전원에게 notification:push IPC 브로드캐스트
 *
 * updateHook 콜백은 SQLite 내부에서 동기 호출되므로, 실제 처리는
 * setImmediate 로 defer 합니다.
 */
export class WorkflowTriggerEngine {
  private static instance: WorkflowTriggerEngine;

  private constructor() {}

  public static getInstance(): WorkflowTriggerEngine {
    if (!WorkflowTriggerEngine.instance) {
      WorkflowTriggerEngine.instance = new WorkflowTriggerEngine();
    }
    return WorkflowTriggerEngine.instance;
  }

  /**
   * DBChangeDetector.watchFinanceHub 의 updateHook에서 호출.
   * INSERT 이벤트만 처리하며, 무거운 로직은 setImmediate 로 defer.
   */
  public onFinanceHubChange(
    tableName: string,
    action: string,
    rowId: string,
    financeHubDb: Database.Database,
  ): void {
    if (action !== 'INSERT') return;

    setImmediate(() => {
      this._handleInsert(tableName, rowId, financeHubDb).catch(err => {
        console.error('[WorkflowTriggerEngine] ❌ Error:', err);
      });
    });
  }

  /**
   * 태스크 완료 또는 승인 상태 변이가 발생할 때마다 호출됩니다.
   * 실무 DAG 해소와 승인 격상을 담당합니다.
   */
  public async evaluateDependencies(runId: string): Promise<void> {
    const { getSQLiteManager } = await import('../sqlite/manager');
    const { TasksCalendarService } = await import('../sqlite/tasks-calendar-service');
    const { NotificationManager } = await import('../notification/notification-manager');

    const manager = getSQLiteManager();
    const workflowManager = manager.getWorkflowManager();
    const run = workflowManager.getRun(runId);
    if (!run) return;

    const workflow = workflowManager.getWorkflow(run.workflowId);
    if (!workflow) return;

    const tasks = TasksCalendarService.getInstance().getTasksForRun(runId);
    const completedActionIds = new Set(
      tasks.filter(t => t.status === 'completed' || t.status === 'approved').map(t => t.action_id)
    );

    // 1. [실무 DAG 해소]
    const pendingActions = workflow.actions.filter(a => {
      // 아직 tasks에 존재하지 않고
      const alreadyCreated = tasks.some(t => t.action_id === a.rowId);
      if (alreadyCreated) return false;

      // dependsOn의 모든 항목이 completed인 액션
      return a.dependsOn.every(depId => completedActionIds.has(depId));
    });

    for (const action of pendingActions) {
      if (action.id === 'create_task') {
        const taskTitle = action.params.title || `[${workflow.label}] ${workflow.label} 처리`;
        const taskRole = action.params.role || (workflow.notify[0] ?? '사원');
        
        TasksCalendarService.getInstance().addTask({
          action_id: action.rowId,
          run_id: runId,
          title: taskTitle,
          role: taskRole,
          task_type: 'work',
          status: 'pending'
        });
        
        // Use runId for notification context
        await NotificationManager.getInstance().sendPushNotification({
          recipientRole: taskRole,
          title: `[${workflow.label}] 새 태스크 배정`,
          body: taskTitle,
          runId: runId
        });
        console.log(`[WorkflowTriggerEngine] ✅ Next task created: ${taskTitle} (Role: ${taskRole})`);
      }
    }

    // 2. [승인 격상 조건 확인]
    // 모든 task_type='work' 태스크가 completed인지 확인
    const allWorkTasks = tasks.filter(t => t.task_type === 'work');
    const allWorkCompleted = allWorkTasks.length > 0 && allWorkTasks.every(t => t.status === 'completed');

    if (allWorkCompleted) {
      // 3. [현재 승인 위치 추론]
      const approvalTasks = tasks.filter(t => t.task_type === 'approval');
      const approvedIndices = approvalTasks
        .filter(t => t.status === 'approved')
        .map(t => parseInt(t.action_id.replace('approval_', '')))
        .sort((a, b) => b - a);
      
      const currentN = approvedIndices.length > 0 ? approvedIndices[0] : -1;
      const nextN = currentN + 1;

      // approvalChain = ["경리직원", "과장", "이사"]
      // index 0 (기안자) -> index 1 (과장) -> index 2 (이사)
      const approvalChain = workflow.notify; // Use notify roles as approval chain for now if not explicitly defined
      
      if (nextN < approvalChain.length) {
        const nextRole = approvalChain[nextN];
        const actionId = `approval_${nextN}`;
        
        // Check if next approval already exists
        if (!approvalTasks.some(t => t.action_id === actionId)) {
          TasksCalendarService.getInstance().addTask({
            action_id: actionId,
            run_id: runId,
            title: `[승인] ${workflow.label} (${nextRole})`,
            role: nextRole,
            task_type: 'approval',
            status: 'pending'
          });
          
          await NotificationManager.getInstance().sendPushNotification({
            recipientRole: nextRole,
            title: `[${workflow.label}] 승인 대기`,
            body: `실무 완료. ${nextRole} 승인 대기 중입니다.`,
            runId: runId
          });
          console.log(`[WorkflowTriggerEngine] 🚀 Approval spawned for ${nextRole} (index ${nextN})`);
        }
      } else {
        // 최종 완료
        workflowManager.updateRunStatus(runId, '정상완료');
        
        // Notify all roles in the workflow about completion
        const allRoles = new Set([...workflow.notify, ...workflow.actions.map(a => a.params.role).filter(Boolean)]);
        for (const role of allRoles) {
          await NotificationManager.getInstance().sendPushNotification({
            recipientRole: role,
            title: `[${workflow.label}] 완료`,
            body: `워크플로가 최종 완료되었습니다.`,
            runId: runId
          });
        }
        console.log(`[WorkflowTriggerEngine] 🎉 Workflow Run ${runId} completed!`);
      }
    }
  }

  /**
   * 테스트/시뮬레이션용 직접 호출 진입점.
   * updateHook 경유 없이 test IPC 핸들러에서 직접 호출합니다.
   * rowId 대신 UUID id로 행을 조회합니다.
   */
  public async _handleInsertPublic(
    tableName: string,
    id: string,
    financeHubDb: Database.Database,
  ): Promise<void> {
    // rowid 대신 uuid id로 조회 후 실제 rowid 획득
    const row = financeHubDb
      .prepare(`SELECT rowid, * FROM "${tableName}" WHERE id = ?`)
      .get(id) as (Record<string, any> & { rowid: number }) | null;

    if (!row) {
      console.warn(`[WorkflowTriggerEngine] _handleInsertPublic: row not found for id=${id}`);
      return;
    }

    await this._handleInsert(tableName, String(row.rowid), financeHubDb);
  }

  private async _handleInsert(
    tableName: string,
    rowId: string,
    financeHubDb: Database.Database,
  ): Promise<void> {
    // Dynamic import to avoid circular-dependency issues at startup
    const { getSQLiteManager } = await import('../sqlite/manager');
    const { TasksCalendarService } = await import('../sqlite/tasks-calendar-service');

    const workflowManager = getSQLiteManager().getWorkflowManager();

    // 1. trigger_table 이 일치하는 활성 워크플로 탐색
    const workflows = workflowManager.getWorkflows();
    const triggered = workflows.filter(
      w => w.triggerTable === tableName && w.status === 'active',
    );

    if (triggered.length === 0) {
      console.log(`[WorkflowTriggerEngine] No active workflow for table "${tableName}"`);
      return;
    }

    // 2. 신규 행 읽기 (maturity_date 등 메타데이터 추출)
    let sourceRow: Record<string, any> | null = null;
    try {
      sourceRow = financeHubDb
        .prepare(`SELECT * FROM "${tableName}" WHERE rowid = ?`)
        .get(rowId) as Record<string, any> | null;
    } catch (e) {
      console.warn(`[WorkflowTriggerEngine] Could not read source row: ${e}`);
    }

    for (const workflow of triggered) {
      try {
        console.log(`[WorkflowTriggerEngine] 🚀 Spawning run for workflow "${workflow.label}" (id: ${workflow.id})`);

        // ── Step 1: Run 생성 ─────────────────────────────────────────────────
        const run = workflowManager.createRun({
          workflowId: workflow.id,
          inputData: { sourceTable: tableName, sourceRowId: rowId, ...(sourceRow ?? {}) },
          sourceTable: tableName,
          sourceRowId: rowId,
        });

        console.log(`[WorkflowTriggerEngine] ✅ Run created: ${run.id}`);

        // ── Step 2: company_calendar 이벤트 적재 (인간용 뷰, 상태 없음) ───────
        const deadlineDate = this._resolveDeadlineDate(sourceRow);
        const notifyRoles: string[] = workflow.notify;
        const assigneeRole = notifyRoles[0] ?? undefined;

        TasksCalendarService.getInstance().addCalendarEvent({
          title: `[${workflow.label}] 신규 받을어음 수신`,
          description: [
            `결재 라인: ${notifyRoles.join(' → ')}`,
            sourceRow?.buyer_name ? `매출처: ${sourceRow.buyer_name}` : null,
            sourceRow?.receivable_amount
              ? `어음금액: ${Number(sourceRow.receivable_amount).toLocaleString()}원`
              : null,
            `Run ID: ${run.id}`,
          ]
            .filter(Boolean)
            .join(' | '),
          date: deadlineDate,
          assignee_role: assigneeRole,
          run_id: run.id,
        });

        console.log(`[WorkflowTriggerEngine] 📅 Calendar event added (deadline: ${deadlineDate})`);

        // ── Step 3: notify 역할군 전원에게 알림 발송 및 적재 ─────────────────
        const { NotificationManager } = await import('../notification/notification-manager');
        const body = [
          '신규 받을어음이 수신되었습니다. 결재를 확인해 주세요.',
          sourceRow?.buyer_name ? `매출처: ${sourceRow.buyer_name}` : null,
          sourceRow?.receivable_amount
            ? `금액: ${Number(sourceRow.receivable_amount).toLocaleString()}원`
            : null,
          `만기일: ${deadlineDate}`,
        ]
          .filter(Boolean)
          .join(' · ');

        for (const role of notifyRoles) {
          await NotificationManager.getInstance().sendPushNotification({
            recipientRole: role,
            title: `[${workflow.label}]`,
            body,
            runId: run.id,
          });
        }

        console.log(`[WorkflowTriggerEngine] 🔔 Notifications dispatched and persisted for roles: ${notifyRoles.join(', ')}`);

        // ── Step 4: 초기 태스크 자동 생성 (dependsOn = [] 인 액션들 활성화) ────────
        const initialActions = workflow.actions.filter(a => a.dependsOn.length === 0);
        for (const action of initialActions) {
          if (action.id === 'create_task') {
            const taskTitle = action.params.title || `[${workflow.label}] ${workflow.label} 처리`;
            const taskRole = action.params.role || (notifyRoles[0] ?? '사원');
            
            TasksCalendarService.getInstance().addTask({
              action_id: action.rowId,
              run_id: run.id,
              title: taskTitle,
              role: taskRole,
              task_type: 'work',
              status: 'pending'
            });
            console.log(`[WorkflowTriggerEngine] ✅ Initial task created: ${taskTitle} (Role: ${taskRole})`);
          }
        }

        // ── Step 5: Push to ExcelToDB via ai_center_push_notification ────────
        // Fire-and-forget — non-critical if ExcelToDB is not running
        fetch('http://localhost:8080/ai-center/tools/call', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': '44c9e9ba-d732-42c1-9ad5-d0344ee1705c',
          },
          body: JSON.stringify({
            tool: 'ai_center_push_notification',
            arguments: {
              roles: notifyRoles,
              title: `[${workflow.label}]`,
              message: body,
              link: '/notifications',
              type: 'INFO',
            },
          }),
        }).then(r => {
          if (!r.ok) r.text().then(t => console.warn(`[WorkflowTriggerEngine] push_notification non-OK: ${t}`));
          else console.log(`[WorkflowTriggerEngine] 📬 ExcelToDB notification push OK`);
        }).catch(e => console.warn(`[WorkflowTriggerEngine] push_notification fetch failed:`, e));

        // Also push to any connected SSE MCP clients (Cursor, direct HTTP integrations)
        try {
          const { broadcastSSENotification } = await import('../mcp/server-creator/sse-handler');
          broadcastSSENotification('egdesk/notification', {
            event: 'workflow_triggered',
            workflowId: workflow.id,
            workflowLabel: workflow.label,
            runId: run.id,
            notifyRoles,
            body,
            deadlineDate,
          });
        } catch (_) { /* non-critical — renderer/stdio clients use polling */ }
      } catch (err) {
        console.error(`[WorkflowTriggerEngine] Failed for workflow "${workflow.label}":`, err);
      }
    }
  }

  /**
   * 어음 만기일(maturity_date)을 우선 사용하고, 없으면 오늘 +90일을 기본값으로 반환.
   */
  private _resolveDeadlineDate(row: Record<string, any> | null): string {
    if (row?.maturity_date && typeof row.maturity_date === 'string') {
      // YYYY-MM-DD 형식 앞 10자만 사용
      return row.maturity_date.slice(0, 10);
    }
    const d = new Date();
    d.setDate(d.getDate() + 90);
    return d.toISOString().slice(0, 10);
  }
}
