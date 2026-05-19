import { SQLiteManager } from '../sqlite/manager';
import crypto from 'crypto';

export interface NotificationPayload {
  recipientRole: string;
  title: string;
  body: string;
  runId?: string;
}

/**
 * NotificationManager
 *
 * [이중 저장소 알림 설계 원칙]
 * - 알림 트리거는 캘린더 INSERT가 아닌 **Tasks 테이블의 상태 변이**입니다.
 * - 알림 수신 대상자는 복잡하게 쪼개지 않고, "Stages 내의 모든 실무 작업자 + approvalChain에 등록된 모든 승인자"의 합집합(Set) 단 하나로 구성합니다.
 */
export class NotificationManager {
  private static instance: NotificationManager;

  private constructor() {}

  public static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager();
    }
    return NotificationManager.instance;
  }

  /**
   * Tasks 테이블의 상태 변이가 발생했을 때 전체 결제 라인 임직원에게 브로드캐스트 전파
   */
  public async handleTaskEvent(taskId: string, message: string): Promise<void> {
    try {
      const sqliteManager = SQLiteManager.getInstance();
      const userDataDb = sqliteManager.getUserDataDatabase();
      const workflowDb = sqliteManager.getWorkflowManager();

      // 1. 태스크 레코드 조회
      const task = userDataDb.prepare(
        'SELECT * FROM tasks WHERE id = ?'
      ).get(taskId) as { run_id: string; role: string; title: string; status: string } | undefined;

      if (!task || !task.run_id) {
        console.warn(`⚠️ [Notification] 태스크를 찾을 수 없거나 runId가 없습니다: taskId=${taskId}`);
        return;
      }

      // 2. 런타임 정보 조회
      const run = workflowDb.getRun(task.run_id);
      if (!run) {
        console.warn(`⚠️ [Notification] 워크플로 Run을 찾을 수 없습니다: runId=${task.run_id}`);
        return;
      }

      // 3. 워크플로 명세 조회
      const workflow = workflowDb.getWorkflow(run.workflowId);
      if (!workflow) {
        console.warn(`⚠️ [Notification] 워크플로 명세를 찾을 수 없습니다: workflowId=${run.workflowId}`);
        return;
      }

      // 4. [수신자 단일 합집합 추출 알고리즘]
      const recipientSet = new Set<string>();

      // A. 자동 결재선(approvalChain)의 모든 역할군 편입
      if (workflow.approvalChain && Array.isArray(workflow.approvalChain)) {
        workflow.approvalChain.forEach((r: string) => recipientSet.add(r));
      }

      // B. stages 내 모든 실무 액션 작업자(Action Workers) 역할군 편입
      if (workflow.stages && Array.isArray(workflow.stages)) {
        workflow.stages.forEach((stage: any) => {
          if (stage.actions && Array.isArray(stage.actions)) {
            stage.actions.forEach((act: any) => {
              if (act.role) {
                recipientSet.add(act.role);
              }
            });
          }
        });
      }

      console.log(`🔔 [Notification] 태스크 변이 감지: ${task.title}. 결제 라인 전원 브로드캐스트 대상: ${Array.from(recipientSet).join(', ')}`);

      // 5. 결제 라인 구성원 전원에게 실시간 푸시 발송
      for (const role of recipientSet) {
        await this.sendPushNotification({
          recipientRole: role,
          title: `[${workflow.label || '비즈니스 워크플로'}]`,
          body: `${message} (담당: ${task.role}, 제목: ${task.title})`,
          runId: task.run_id
        });
      }
    } catch (err) {
      console.error('❌ [Notification] 알림 배포 중 에러 발생:', err);
    }
  }

  /**
   * 실질적인 인앱 activity_logs 적재 및 Electron Renderer 창 Push 전송
   */
  private async sendPushNotification(payload: NotificationPayload): Promise<void> {
    try {
      const db = SQLiteManager.getInstance().getConversationsDatabase();

      // 인앱 활동 로그 테이블에 적재 (activity_logs)
      db.prepare(`
        INSERT INTO activity_logs (id, recipient_role, title, body, run_id, is_read, created_at)
        VALUES (?, ?, ?, ?, ?, 0, datetime('now'))
      `).run(
        crypto.randomUUID ? crypto.randomUUID() : require('crypto').randomUUID(),
        payload.recipientRole,
        payload.title,
        payload.body,
        payload.runId || null
      );

      // Renderer UI로 실시간 IPC Push 전송
      const { BrowserWindow } = require('electron');
      const activeWindows = BrowserWindow.getAllWindows();
      activeWindows.forEach((win: any) => {
        if (!win.isDestroyed()) {
          win.webContents.send('notification:push', payload);
        }
      });
    } catch (err) {
      console.error('❌ [Notification] Push 전송 실패:', err);
    }
  }
}
