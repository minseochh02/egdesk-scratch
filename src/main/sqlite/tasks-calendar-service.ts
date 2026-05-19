import { SQLiteManager } from './manager';

export interface TaskRow {
  id: string;
  action_id: string;
  run_id: string;
  title: string;
  role: string;
  task_type: 'work' | 'approval';
  status: 'pending' | 'in_progress' | 'completed' | 'approved' | 'rejected' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface CalendarRow {
  id: string;
  title: string;
  description: string | null;
  date: string;
  assignee_role: string | null;
  run_id: string | null;
  created_at: string;
}

/**
 * TasksCalendarService
 *
 * [이중 저장소 분리 원칙]
 * 1. tasks: 엔진 실행의 유일한 단일 진실 공급원 (상태 존재, 의존성/승급선 등 제어 용도)
 * 2. company_calendar: 인간용 데드라인 시각화 뷰 (상태 없음, 엔진이 안 읽음)
 */
export class TasksCalendarService {
  private static instance: TasksCalendarService;

  private constructor() {}

  public static getInstance(): TasksCalendarService {
    if (!TasksCalendarService.instance) {
      TasksCalendarService.instance = new TasksCalendarService();
    }
    return TasksCalendarService.instance;
  }

  /**
   * 활성 상태인 물리 태스크 조회 (실무자 오늘 할 일 용도)
   * status가 'pending' 또는 'in_progress'인 태스크 대상
   */
  public getActiveTasks(role?: string): TaskRow[] {
    const db = SQLiteManager.getInstance().getNeuronDatabase();
    let query = "SELECT * FROM tasks WHERE status IN ('pending', 'in_progress')";
    const params: any[] = [];

    if (role) {
      query += ' AND role = ?';
      params.push(role);
    }
    query += ' ORDER BY created_at DESC';

    const rows = db.prepare(query).all(...params) as any[];
    return rows.map(r => ({
      id: r.id,
      action_id: r.action_id,
      run_id: r.run_id,
      title: r.title,
      role: r.role,
      task_type: r.task_type as 'work' | 'approval',
      status: r.status as any,
      created_at: r.created_at,
      updated_at: r.updated_at
    }));
  }

  /**
   * 전사 공유 비즈니스 데드라인 일정 조회 (인간용 뷰 - 상태 없음!)
   */
  public getCalendarEvents(): CalendarRow[] {
    const db = SQLiteManager.getInstance().getNeuronDatabase();
    const rows = db.prepare('SELECT * FROM company_calendar ORDER BY date ASC').all() as any[];
    return rows.map(r => ({
      id: r.id,
      title: r.title,
      description: r.description,
      date: r.date,
      assignee_role: r.assignee_role,
      run_id: r.run_id,
      created_at: r.created_at
    }));
  }

  /**
   * 태스크의 상태 변이 업데이트 (완료 / 승인 / 반려 등)
   */
  public updateTaskStatus(taskId: string, status: string): void {
    const db = SQLiteManager.getInstance().getNeuronDatabase();
    db.prepare(`
      UPDATE tasks 
      SET status = ?, updated_at = datetime('now') 
      WHERE id = ?
    `).run(status, taskId);
  }

  /**
   * 새 인간용 데드라인 일정을 수동 또는 AI에 의해 강제 적재 (상태 필드 없음!)
   */
  public addCalendarEvent(event: {
    title: string;
    description?: string;
    date: string;
    assignee_role?: string;
    run_id?: string;
  }): string {
    const db = SQLiteManager.getInstance().getNeuronDatabase();

    const id = crypto.randomUUID ? crypto.randomUUID() : require('crypto').randomUUID();
    db.prepare(`
      INSERT INTO company_calendar (id, title, description, date, assignee_role, run_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      event.title,
      event.description || null,
      event.date,
      event.assignee_role || null,
      event.run_id || null
    );
    return id;
  }
}
