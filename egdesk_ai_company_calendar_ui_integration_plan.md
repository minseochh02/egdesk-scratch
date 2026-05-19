# AI Center 회사 캘린더·태스크 UI 및 DB 통합 개발 계획서 (Company Calendar & Tasks UI Integration Plan)

EGDesk의 지능형 비즈니스 워크플로와 전사 협업 투명성을 보장하기 위한 **"이중 저장소 아키텍처(Tasks DB vs Company Calendar DB)"** 및 **"3대 논리 DB 파일 분할"** 환경을 **AI Center React UI 및 SQLite 데이터베이스(DB)**와 연계하여 통합하기 위한 단계별 구현 계획서입니다.

이 계획서는 사용자께서 최종 선언하신 **"철저한 이중 분리 원칙"**, **"stages 없는 dependsOn DAG 및 3대 DB 분할"** 설계 및 **"SQLite update_hook 기반 실시간 데이터 변경 이벤트 디스패처"** 사양을 100% 완벽히 반영합니다.

---

## 1. 아키텍처 개요 및 실시간 데이터 흐름 (Architecture & Live Data Flow)

물리 실행 및 결재 에스컬레이션은 오직 `ai-system.db` 내 `tasks`를 타고 흐르며, 백엔드의 SQLite `updateHook` 감지기가 이 변화를 탐지해 프론트엔드로 실시간 푸시하는 반응형(Reactive) 아키텍처입니다.

```mermaid
graph TD
    subgraph UI_Layer [AI Center UI (React)]
        T_TASKS[Tasks Tab] -->|Query Tasks| UI_TASK_LIST[Interactive Task Timeline]
        T_CAL[Company Calendar Tab] -->|Fetch Milestones| UI_CAL[Interactive Calendar Grid]
        UI_TASK_LIST -->|1. Complete/Approve/Reject| IPC_API[Electron IPC Bridge]
    end

    subgraph IPC_Bridge [실시간 디스패치 브릿지]
        IPC_API -->|2. Invoke Action| DB_WRITE[DB Write & Update]
        PUSH_EVENT[tasks:changed 푸시 이벤트] -->|5. 실시간 리렌더링 트리거| UI_TASK_LIST
    end

    subgraph DB_Layer [ai-system.db]
        TASKS_DB[(tasks - 실행의 단일 진실)]
        CAL_DB[(company_calendar - 데드라인 뷰)]
        
        DB_WRITE -->|3. 데이터 변이| TASKS_DB
        TASKS_DB -->|4. sqlite updateHook 트리거| DB_HOOK[Database Event Hook]
    end

    subgraph Workflow_Engine [엔진 및 디스패처]
        DB_HOOK -->|감지 & 파싱| DETECT_PARSER[DB Changed Event Parser]
        DETECT_PARSER -->|Event Dispatch| PUSH_EVENT
    end
```

---

## 2. 4단계 상세 구현 계획 (4-Step Implementation Plan)

### 1단계: DB 스키마 생성 및 IPC 핸들러 구축 (Database & IPC Layer)

`ai-system.db`에 `tasks` 테이블(단일 진실 공급원)과 `company_calendar` 테이블(데드라인 뷰)을 초기화하고, 이를 UI와 연계할 Electron IPC 핸들러를 구축합니다.

#### A. DB 초기화 정의 (`src/main/sqlite/ai-center-init.ts`)
```sql
-- 1. Tasks 테이블 (엔진 실행의 단일 진실)
CREATE TABLE IF NOT EXISTS tasks (
    id          TEXT PRIMARY KEY,
    action_id   TEXT NOT NULL,
    run_id      TEXT NOT NULL,
    title       TEXT NOT NULL,
    role        TEXT NOT NULL,
    task_type   TEXT NOT NULL DEFAULT 'work',  -- 'work' | 'approval'
    status      TEXT NOT NULL DEFAULT 'pending', -- 'pending'|'in_progress'|'completed'|'approved'|'rejected'|'cancelled'
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_run_id    ON tasks(run_id);
CREATE INDEX IF NOT EXISTS idx_tasks_action_id ON tasks(action_id, run_id);
CREATE INDEX IF NOT EXISTS idx_tasks_role      ON tasks(role);
CREATE INDEX IF NOT EXISTS idx_tasks_status    ON tasks(status);

-- 2. Company Calendar 테이블 (인간용 데드라인 뷰 - status 필드 없음)
CREATE TABLE IF NOT EXISTS company_calendar (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    description TEXT,
    date        TEXT NOT NULL, -- YYYY-MM-DD
    assignee_role TEXT,
    run_id      TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cal_date       ON company_calendar(date);
CREATE INDEX IF NOT EXISTS idx_cal_assignee   ON company_calendar(assignee_role);
```

---

### 2단계: SQLite update_hook 기반 실시간 이벤트 디스패처 구축 (Event Detection & Dispatch)

데이터베이스 파일(`ai-system.db`)에 쓰기/수정이 발생할 때 변경 이벤트를 실시간으로 가로채어 React UI로 송출해 주는 디스패처 파서를 탑재합니다.

#### A. DB 변경 감지기 파서 작성 (`src/main/sqlite/db-change-detector.ts`)
```typescript
import Database from 'better-sqlite3';
import { BrowserWindow } from 'electron';

export class DBChangeDetector {
  private static instance: DBChangeDetector;
  
  public static getInstance(): DBChangeDetector {
    if (!DBChangeDetector.instance) {
      DBChangeDetector.instance = new DBChangeDetector();
    }
    return DBChangeDetector.instance;
  }

  /**
   * SQLite update_hook을 연결하여 tasks 테이블의 변화를 감지하고 
   * 프론트엔드로 브로드캐스트 이벤트를 송출합니다.
   */
  public watch(db: Database.Database): void {
    db.updateHook((action, databaseName, tableName, rowId) => {
      // 오직 tasks 및 company_calendar의 변이만 정밀 파싱
      if (tableName === 'tasks' || tableName === 'company_calendar') {
        console.log(`[DB Event Detector] 🔔 Change detected: ${action} on ${tableName} (RowID: ${rowId})`);
        
        // 활성 윈도우들을 찾아 이벤트 디스패치
        const windows = BrowserWindow.getAllWindows();
        for (const win of windows) {
          if (!win.isDestroyed()) {
            win.webContents.send('db:changed', {
              tableName,
              action: action === 1 ? 'INSERT' : action === 3 ? 'UPDATE' : 'DELETE',
              rowId: rowId.toString()
            });
          }
        }
      }
    });
    console.log('✅ SQLite update_hook Event Detector initialized');
  }
}
```

#### B. Preload 브릿지에 수신 리스너 등록 (`src/main/preload.ts`)
```typescript
// Electron Preload API에 추가
export const electronAPI = {
  // DB 실시간 변이 리스너
  onDbChanged: (callback: (data: { tableName: string; action: string; rowId: string }) => void) => {
    const listener = (_event: any, data: any) => callback(data);
    ipcRenderer.on('db:changed', listener);
    return () => {
      ipcRenderer.removeListener('db:changed', listener);
    };
  }
};
```

---

### 3단계: AI Center UI 실시간 반응형 연동 (Reactive UI Binding)

React 컴포넌트(`AICenter.tsx`) 내부에서 백엔드 `update_hook`이 쏘아 올린 디스패치 이벤트를 구독하여 화면을 수동 조작 없이 실시간으로 리렌더링 처리합니다.

```tsx
// src/renderer/components/AICenter/AICenter.tsx
import React, { useEffect, useState } from 'react';

export function AICenter() {
  const [activeTasks, setActiveTasks] = useState<TaskRow[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarRow[]>([]);

  // 데이터 리로드 함수
  const fetchTasks = async () => { /* ... tasks:get-active 호출 ... */ };
  const fetchCalendar = async () => { /* ... calendar:get-events 호출 ... */ };

  useEffect(() => {
    // 1. 초기 로드
    fetchTasks();
    fetchCalendar();

    // 2. [실시간 디스패처 구독] 백엔드의 SQLite 변이 감지 신호 수신 시 즉시 화면 갱신!
    if ((window as any).electron && (window as any).electron.onDbChanged) {
      const unsubscribe = (window as any).electron.onDbChanged((event: any) => {
        console.log(`[AICenter Live Refresh] Received db change event:`, event);
        if (event.tableName === 'tasks') {
          fetchTasks(); // 실무 태스크 목록 갱신
        } else if (event.tableName === 'company_calendar') {
          fetchCalendar(); // 마일스톤 데드라인 목록 갱신
        }
      });

      return () => unsubscribe(); // 언마운트 시 구독 해제
    }
  }, []);

  return (
    <div className="aic-root">
      {/* 탭 및 업무 타임라인 렌더링 */}
    </div>
  );
}
```

---

### 4단계: AI 에이전트용 이중 데이터 조작 MCP 도구 추가

AI 에이전트가 `tasks` 테이블을 읽고 처리하거나 `company_calendar` 데드라인을 조회/추출하도록 지원하기 위해 MCP 도구도 분리 원칙에 따라 신설합니다.

```typescript
// src/main/mcp/ai-center/ai-center-mcp-service.ts
export class AICenterMCPService implements IMCPService {
  listTools(): MCPTool[] {
    return [
      {
        name: 'ai_center_get_active_tasks',
        description: 'Query active physical tasks from tasks database (The single source of truth for runtime)',
        inputSchema: {
          type: 'object',
          properties: {
            role: { type: 'string', description: 'Filter by assignee role' }
          }
        }
      },
      {
        name: 'ai_center_list_calendar_events',
        description: 'Retrieve company calendar events (human view only, status-less)',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ];
  }

  async executeTool(name: string, args: Record<string, any>): Promise<MCPToolResult> {
    switch (name) {
      case 'ai_center_get_active_tasks': {
        const data = TasksCalendarService.getInstance().getActiveTasks(args.role);
        return ok(data);
      }
      case 'ai_center_list_calendar_events': {
        const data = TasksCalendarService.getInstance().getCalendarEvents();
        return ok(data);
      }
    }
  }
}
```

---

## 3. 실시간 이벤트 디스패처의 아키텍처적 가치 (Reactive Architecture Value)

1. **완벽한 반응형 사용자 경험 (Reactive UX)**:
   * 실무자가 태스크를 완료하거나 승인 완료 단추를 누르는 즉시, 별도의 폴링(Polling) 기법 없이 **백엔드 DB 변이 신호가 다이렉트로 프론트엔드를 강타**하여 실시간으로 타임라인이 스포닝/제거됩니다.
2. **동기화 대기 시간의 전무화**:
   * SQLite `updateHook`은 DB 엔진 수준에서 작동하기 때문에, 물리적인 데이터 커밋과 동시에 디바이스 화면 갱신이 밀리초(ms) 단위로 일어나 오버헤드가 극도로 낮습니다.
3. **완벽한 도메인 정립**:
   * 백엔드는 DB 변화만을 모니터링하여 이벤트를 송출하고, UI는 그 송출 이벤트를 그대로 수신받아 다시 그림으로써 백엔드와 프론트엔드의 커플링(의존 결합도)이 극단적으로 완화됩니다.
