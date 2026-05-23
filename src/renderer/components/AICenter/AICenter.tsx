import React, { useState, useMemo, useEffect, useCallback } from 'react';
import './AICenter.css';
import { useWorkflows, WorkflowDef } from '../../hooks/useWorkflows';
import { useDataSources, DataSource, getProcessingState } from '../../hooks/useDataSources';

interface NotificationToast {
  id: number;
  recipientRole: string;
  title: string;
  body: string;
  runId?: string;
  at: string;
}

interface ActionDef {
  id: string;
  params: string[];
}

interface ActionGroup {
  label: string;
  dot: string; // subtle dot color, muted
  actions: ActionDef[];
}

const ACTION_GROUPS: ActionGroup[] = [
  {
    label: 'Workflow',
    dot: '#4a90d9',
    actions: [
      { id: 'create_task',   params: ['title', 'role', 'dueDays?', 'deadline?'] },
      { id: 'approve',       params: ['title', 'approvalChain'] },
      { id: 'update_status', params: ['value'] },
    ],
  },
  {
    label: 'Knowledge',
    dot: '#9b7ee0',
    actions: [
      { id: 'lookup_company_knowledge', params: ['source'] },
    ],
  },
  {
    label: 'Communication',
    dot: '#4a90d9',
    actions: [
      { id: 'notify',       params: ['to', 'message', 'channel?'] },
      { id: 'request_info', params: ['fields', 'message?'] },
      { id: 'remind',       params: ['to', 'after', 'message'] },
    ],
  },
  {
    label: 'Data',
    dot: '#3aaa72',
    actions: [
      { id: 'create_row', params: ['table'] },
      { id: 'update_row', params: ['table', 'match_by'] },
      { id: 'delete_row', params: ['table', 'match_by'] },
    ],
  },
  {
    label: 'Review',
    dot: '#c88a20',
    actions: [
      { id: 'flag',         params: ['reason', 'threshold?'] },
      { id: 'escalate',     params: ['to', 'reason'] },
      { id: 'auto_approve', params: [] },
      { id: 'reject',       params: ['reason'] },
    ],
  },
  {
    label: 'State',
    dot: '#c06060',
    actions: [
      { id: 'set_status', params: ['status'] },
      { id: 'assign',     params: ['to'] },
      { id: 'archive',    params: [] },
    ],
  },
];

// ─── Action metadata ───────────────────────────────────────────────────────────

const ACTION_ICONS: Record<string, string> = {
  create_task:              '✔',
  approve:                  '◈',
  update_status:            '●',
  create_row:               '+',
  update_row:               '↺',
  delete_row:               '−',
  notify:                   '↗',
  request_info:             '?',
  remind:                   '◷',
  lookup_company_knowledge: '◈',
  flag:                     '⚑',
  escalate:                 '↑',
  auto_approve:             '✓',
  reject:                   '✗',
  set_status:               '●',
  assign:                   '⇢',
  archive:                  '⊡',
};

const ACTION_LABELS: Record<string, string> = {
  create_task:              'Create task',
  approve:                  'Approve',
  update_status:            'Update status',
  create_row:               'Create row',
  update_row:               'Update row',
  delete_row:               'Delete row',
  notify:                   'Notify',
  request_info:             'Request info',
  remind:                   'Remind',
  lookup_company_knowledge: 'Lookup knowledge',
  flag:                     'Flag',
  escalate:                 'Escalate',
  auto_approve:             'Auto-approve',
  reject:                   'Reject',
  set_status:               'Set status',
  assign:                   'Assign',
  archive:                  'Archive',
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getActionGroup(actionId: string): ActionGroup | undefined {
  return ACTION_GROUPS.find(g => g.actions.some(a => a.id === actionId));
}

function getActionGroupLabel(actionId: string): string {
  return getActionGroup(actionId)?.label ?? '';
}

function getActionDot(actionId: string): string {
  return getActionGroup(actionId)?.dot ?? '#b0b8c8';
}

const STATUS_LABEL: Record<WorkflowDef['status'], string> = {
  active:    'Active',
  suggested: 'Suggested',
  draft:     'Draft',
};

// ─── Sub-components ────────────────────────────────────────────────────────────

function ActionGroupCard({ group }: { group: ActionGroup }) {
  return (
    <div className="aic-action-group">
      <div className="aic-action-group-label">
        <span className="aic-action-group-dot" style={{ background: group.dot }} />
        {group.label}
      </div>
      {group.actions.map(a => (
        <div key={a.id} className="aic-action-row">
          <span className="aic-action-icon-badge" style={{ background: group.dot }}>
            {ACTION_ICONS[a.id] ?? '·'}
          </span>
          <div className="aic-action-info">
            <span className="aic-action-label">{ACTION_LABELS[a.id] ?? a.id}</span>
            {a.params.length > 0 && (
              <span className="aic-action-params">
                {a.params.map(p => (
                  <span key={p} className={`aic-action-param ${p.endsWith('?') ? 'optional' : ''}`}>
                    {p}
                  </span>
                ))}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function WorkflowCard({
  workflow,
  selected,
  onClick,
}: {
  workflow: WorkflowDef;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={`aic-workflow-card ${selected ? 'selected' : ''} aic-status-${workflow.status}`}
      onClick={onClick}
    >
      <div className="aic-workflow-card-header">
        <span className="aic-workflow-card-label">{workflow.label}</span>
        <span className={`aic-workflow-status-badge badge-${workflow.status}`}>
          {STATUS_LABEL[workflow.status]}
        </span>
      </div>
      <div className="aic-workflow-card-meta">
        {workflow.hints.map(h => (
          <span key={h} className="aic-hint-chip">{h}</span>
        ))}
      </div>
      <div className="aic-workflow-card-actions">
        {workflow.actions.map((a, i) => {
          const color = getActionDot(a.id);
          return (
            <span
              key={i}
              className="aic-workflow-action-chip"
              style={{
                background: `${color}18`,
                color,
                borderColor: `${color}38`,
              }}
            >
              <span className="aic-workflow-action-icon">{ACTION_ICONS[a.id] ?? '·'}</span>
              {ACTION_LABELS[a.id] ?? a.id}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function WorkflowDetail({ workflow }: { workflow: WorkflowDef }) {
  return (
    <div className="aic-detail-panel">
      <div className="aic-detail-header">
        <div>
          <div className="aic-detail-title">{workflow.label}</div>
          <div className="aic-detail-id">{workflow.id}</div>
        </div>
        <span className={`aic-workflow-status-badge badge-${workflow.status} large`}>
          {STATUS_LABEL[workflow.status]}
        </span>
      </div>

      <div className="aic-detail-section">
        <div className="aic-detail-section-title">Input</div>
        <div className="aic-detail-row">
          <span className="aic-detail-key">types</span>
          <span className="aic-detail-value">
            {workflow.inputTypes.map(t => (
              <span key={t} className="aic-tag">{t}</span>
            ))}
          </span>
        </div>
        <div className="aic-detail-row">
          <span className="aic-detail-key">hints</span>
          <span className="aic-detail-value">
            {workflow.hints.map(h => (
              <span key={h} className="aic-tag muted">{h}</span>
            ))}
          </span>
        </div>
      </div>

      <div className="aic-detail-section">
        <div className="aic-detail-section-title">Output</div>
        {workflow.outputTables.map(t => (
          <div key={t} className="aic-detail-row">
            <span className="aic-detail-key">table</span>
            <span className="aic-detail-value mono">{t}</span>
          </div>
        ))}
      </div>

      <div className="aic-detail-section">
        <div className="aic-detail-section-title">Actions</div>
        <div className="aic-pipeline">
          {workflow.actions.map((a, i) => {
            const color = getActionDot(a.id);
            const group = getActionGroupLabel(a.id);
            const icon  = ACTION_ICONS[a.id] ?? '·';
            const label = ACTION_LABELS[a.id] ?? a.id;
            const isLast = i === workflow.actions.length - 1;
            return (
              <div key={i} className="aic-pipeline-step">
                <div className="aic-pipeline-left">
                  <div className="aic-pipeline-icon" style={{ background: color }}>
                    {icon}
                  </div>
                  {!isLast && <div className="aic-pipeline-connector" />}
                </div>
                <div className={`aic-pipeline-body${isLast ? '' : ' has-connector'}`}>
                  <div className="aic-pipeline-header">
                    <span className="aic-pipeline-label">{label}</span>
                    {group && (
                      <span className="aic-pipeline-group" style={{ color, background: `${color}15` }}>
                        {group}
                      </span>
                    )}
                  </div>
                  {Object.keys(a.params).length > 0 && (
                    <div className="aic-pipeline-params">
                      {Object.entries(a.params).map(([k, v]) => (
                        <div key={k} className="aic-pipeline-param">
                          <span className="aic-detail-key">{k}</span>
                          <span className="aic-detail-value mono">{typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {workflow.status === 'suggested' && (
        <div className="aic-detail-suggested-hint">
          Suggested by Neuron Layer based on observed patterns. Confirm to activate.
        </div>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

type ActiveTab = 'workflows' | 'actions' | 'sources' | 'tasks' | 'calendar';

const FIXED_ORIGIN_LABELS: Record<string, string> = {
  userdata:        'User Data',
  financehub:      'Finance Hub',
  companyresearch: 'Company Research',
};
const GROUPED_ORIGINS = new Set(['businessidentity']);

export function AICenter() {
  const { workflows, loading }                        = useWorkflows();
  const { sources, loading: sourcesLoading }          = useDataSources();
  const [activeTab, setActiveTab]                     = useState<ActiveTab>('tasks'); // 기본 오늘 할 일 탭 활성화
  const [selectedWorkflow, setSelected]               = useState<WorkflowDef | null>(null);
  const [statusFilter, setStatusFilter]               = useState<WorkflowDef['status'] | 'all'>('all');

  // [이중 저장소] 1. Tasks 및 Company Calendar 데이터를 담을 상태 선언
  const [activeTasks, setActiveTasks]                 = useState<any[]>([]);
  const [calendarEvents, setCalendarEvents]             = useState<any[]>([]);
  const [tasksLoading, setTasksLoading]               = useState<boolean>(false);
  const [calendarLoading, setCalendarLoading]         = useState<boolean>(false);

  // [테스트] 받을어음 시뮬레이션 상태
  const [simulating, setSimulating]                   = useState(false);
  const [simResult, setSimResult]                     = useState<{ ok: boolean; msg: string } | null>(null);
  const [clearing, setClearing]                       = useState(false);
  const [toasts, setToasts]                           = useState<NotificationToast[]>([]);
  const toastId                                       = React.useRef(0);

  // [이중 저장소] 2. Tasks Fetcher
  const fetchActiveTasks = async () => {
    setTasksLoading(true);
    try {
      const res = await (window as any).electron.invoke('tasks:get-active');
      if (res && res.success) {
        setActiveTasks(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch active tasks:', err);
    } finally {
      setTasksLoading(false);
    }
  };

  // [이중 저장소] 3. Calendar Fetcher
  const fetchCalendarEvents = async () => {
    setCalendarLoading(true);
    try {
      const res = await (window as any).electron.invoke('calendar:get-events');
      if (res && res.success) {
        setCalendarEvents(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch calendar events:', err);
    } finally {
      setCalendarLoading(false);
    }
  };

  // notification:push 수신 구독 (전역 — 탭과 무관하게 항상 활성)
  useEffect(() => {
    const unsub = (window as any).electron.onNotificationPush(
      (data: { recipientRole: string; title: string; body: string; runId?: string }) => {
        const id = ++toastId.current;
        const now = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setToasts(prev => [{ id, at: now, ...data }, ...prev].slice(0, 20));
        // 캘린더 탭이 열려 있으면 이벤트 목록 자동 갱신
        setCalendarEvents(prev => prev); // trigger re-render hint; actual refresh below
        fetchCalendarEvents();
      }
    );
    return unsub;
  }, []);

  // 받을어음 수신 시뮬레이션 실행
  const handleSimulateReceivable = useCallback(async () => {
    setSimulating(true);
    setSimResult(null);
    try {
      const res = await (window as any).electron.simulateReceivable();
      if (res.success) {
        setSimResult({ ok: true, msg: `Run 기동 완료 · noteId: ${res.noteId?.slice(0, 8)}…` });
        // 캘린더 이벤트 목록 새로고침
        await fetchCalendarEvents();
      } else {
        setSimResult({ ok: false, msg: res.error ?? 'Unknown error' });
      }
    } catch (err: any) {
      setSimResult({ ok: false, msg: err?.message ?? String(err) });
    } finally {
      setSimulating(false);
    }
  }, []);

  // 시뮬레이션 데이터 일괄 삭제
  const handleClearSimData = useCallback(async () => {
    setClearing(true);
    setSimResult(null);
    try {
      const res = await (window as any).electron.clearSimData();
      if (res.success) {
        const { receivables = 0, runs = 0 } = res.deleted ?? {};
        setSimResult({ ok: true, msg: `삭제 완료 · 받을어음 ${receivables}건, Run ${runs}건` });
        setToasts([]);
        await fetchCalendarEvents();
      } else {
        setSimResult({ ok: false, msg: res.error ?? 'Unknown error' });
      }
    } catch (err: any) {
      setSimResult({ ok: false, msg: err?.message ?? String(err) });
    } finally {
      setClearing(false);
    }
  }, []);

  // 탭 기동 시 데이터 자동 Fetch
  React.useEffect(() => {
    if (activeTab === 'tasks') {
      fetchActiveTasks();
    } else if (activeTab === 'calendar') {
      fetchCalendarEvents();
    }
  }, [activeTab]);

  const displayGroups = useMemo(() => {
    const map = new Map<string, { title: string; items: DataSource[] }>();
    for (const origin of ['companyresearch', 'financehub', 'userdata']) {
      map.set(origin, { title: FIXED_ORIGIN_LABELS[origin], items: [] });
    }
    const biGroupOrder: string[] = [];
    const biGroupLabels: Record<string, string> = {};
    for (const s of sources) {
      if (GROUPED_ORIGINS.has(s.origin)) {
        const key = s.group ?? s.origin;
        const title = s.groupLabel ?? key;
        if (!biGroupLabels[key]) {
          biGroupLabels[key] = title;
          biGroupOrder.push(key);
          map.set(key, { title, items: [] });
        }
        map.get(key)!.items.push(s);
      } else {
        map.get(s.origin)?.items.push(s);
      }
    }
    const ordered = [
      ...biGroupOrder.map(k => [k, map.get(k)!] as [string, { title: string; items: DataSource[] }]),
      ...['companyresearch', 'financehub', 'userdata'].map(k => [k, map.get(k)!] as [string, { title: string; items: DataSource[] }]),
    ];
    return ordered.filter(([, v]) => v.items.length > 0).map(([key, v]) => ({ key, ...v }));
  }, [sources]);

  React.useEffect(() => {
    if (workflows.length > 0 && !selectedWorkflow) {
      setSelected(workflows[0]);
    }
  }, [workflows]);

  const filtered = workflows.filter(
    w => statusFilter === 'all' || w.status === statusFilter,
  );

  const activeCount    = workflows.filter(w => w.status === 'active').length;
  const suggestedCount = workflows.filter(w => w.status === 'suggested').length;

  return (
    <div className="aic-root">
      {/* ── Toolbar ── */}
      <div className="aic-toolbar">
        <div className="aic-tabs">
          <button
            className={`aic-tab ${activeTab === 'tasks' ? 'active' : ''}`}
            onClick={() => setActiveTab('tasks')}
          >
            📋 Tasks
            {activeTasks.length > 0 && (
              <span className="aic-tab-badge active-tasks-badge">{activeTasks.length}</span>
            )}
          </button>
          <button
            className={`aic-tab ${activeTab === 'calendar' ? 'active' : ''}`}
            onClick={() => setActiveTab('calendar')}
          >
            📅 Calendar
            {calendarEvents.length > 0 && (
              <span className="aic-tab-badge calendar-badge">{calendarEvents.length}</span>
            )}
          </button>
          <button
            className={`aic-tab ${activeTab === 'workflows' ? 'active' : ''}`}
            onClick={() => setActiveTab('workflows')}
          >
            Workflows
            <span className="aic-tab-badge">{workflows.length}</span>
          </button>
          <button
            className={`aic-tab ${activeTab === 'actions' ? 'active' : ''}`}
            onClick={() => setActiveTab('actions')}
          >
            Actions
            <span className="aic-tab-badge">
              {ACTION_GROUPS.reduce((n, g) => n + g.actions.length, 0)}
            </span>
          </button>
          <button
            className={`aic-tab ${activeTab === 'sources' ? 'active' : ''}`}
            onClick={() => setActiveTab('sources')}
          >
            Data Sources
            {sources.length > 0 && (
              <span className="aic-tab-badge">{sources.length}</span>
            )}
          </button>
        </div>

        {activeTab === 'workflows' && (
          <div className="aic-filter-row">
            {(['all', 'active', 'suggested', 'draft'] as const).map(s => (
              <button
                key={s}
                className={`aic-filter-chip ${statusFilter === s ? 'active' : ''}`}
                onClick={() => setStatusFilter(s)}
              >
                {s === 'all' ? 'All' : STATUS_LABEL[s]}
                {s === 'suggested' && suggestedCount > 0 && (
                  <span className="aic-filter-count">{suggestedCount}</span>
                )}
              </button>
            ))}
            <div className="aic-toolbar-stats">
              <span className="aic-stat">{activeCount} active</span>
              <span className="aic-stat-sep" />
              <span className="aic-stat">{suggestedCount} suggested</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div className="aic-body">
        {/* ── Tasks 탭 패널 (엔진 실행의 단일 진실) ── */}
        {activeTab === 'tasks' && (
          <div className="aic-tasks-panel">
            <div className="aic-panel-header-desc">
              <h3>📋 실무자 오늘 업무 이력 (Tasks DB — 실행의 단일 진실)</h3>
              <p>엔진이 읽고 쓰는 유일한 실행 데이터입니다. dependsOn 해소 및 승인 격상/반려 롤백 제어가 이 테이블 기준으로 작동합니다.</p>
            </div>
            {tasksLoading ? (
              <div className="aic-sources-loading"><div className="aic-sources-spinner" /></div>
            ) : activeTasks.length === 0 ? (
              <div className="aic-empty">오늘 대기 중이거나 처리할 업무가 없습니다. 평화롭습니다! 😊</div>
            ) : (
              <div className="aic-tasks-grid-list">
                {activeTasks.map(task => (
                  <div key={task.id} className={`aic-task-item-card task-type-${task.task_type}`}>
                    <div className="aic-task-card-header">
                      <span className={`aic-task-type-indicator badge-${task.task_type}`}>
                        {task.task_type === 'approval' ? '◈ 결재 승인' : '✔ 실무 수행'}
                      </span>
                      <span className="aic-task-time">{task.created_at}</span>
                    </div>
                    <div className="aic-task-card-body">
                      <h4>{task.title}</h4>
                      <div className="aic-task-meta-row">
                        <span className="aic-task-role-tag">담당 역할: <strong>{task.role}</strong></span>
                        <span className="aic-task-run-tag">Run ID: <small className="mono">{task.run_id.slice(0, 8)}...</small></span>
                      </div>
                    </div>
                    <div className="aic-task-card-actions-row">
                      {task.task_type === 'approval' ? (
                        <>
                          <button
                            className="aic-task-btn btn-approve"
                            onClick={async () => {
                              const res = await (window as any).electron.invoke('task:approve', { taskId: task.id, runId: task.run_id });
                              if (res) fetchActiveTasks();
                            }}
                          >
                            승인 (Approve)
                          </button>
                          <button
                            className="aic-task-btn btn-reject"
                            onClick={async () => {
                              const res = await (window as any).electron.invoke('task:reject', { taskId: task.id, runId: task.run_id });
                              if (res) fetchActiveTasks();
                            }}
                          >
                            반려 (Reject)
                          </button>
                        </>
                      ) : (
                        <button
                          className="aic-task-btn btn-complete"
                          onClick={async () => {
                            const res = await (window as any).electron.invoke('task:complete', { taskId: task.id, runId: task.run_id });
                            if (res) fetchActiveTasks();
                          }}
                        >
                          완료 보고 (Complete)
                        </button>
                      )}
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Company Calendar 탭 패널 (인간용 데드라인 뷰 — 상태 없음) ── */}
        {activeTab === 'calendar' && (
          <div className="aic-calendar-panel">
            <div className="aic-panel-header-desc">
              <h3>📅 전사 공유 비즈니스 데드라인 (Company Calendar — 인간용 뷰)</h3>
              <p>전사 공유 마일스톤과 데드라인을 시각화합니다. 상태(status) 필드가 없으며 엔진이 물리 처리에 읽지 않는 안전한 전사적 뷰입니다.</p>
            </div>

            {/* ── 받을어음 수신 시뮬레이션 테스트 패널 ── */}
            <div className="aic-sim-panel">
              <div className="aic-sim-panel-title">
                <span className="aic-sim-icon">⚡</span>
                받을어음 수신 시뮬레이션
                <span className="aic-sim-label-badge">Dev Test</span>
              </div>
              <p className="aic-sim-desc">
                IBK B2B 받을어음 테이블에 가짜 INSERT를 실행합니다. updateHook → WorkflowTriggerEngine → company_calendar 적재 + 역할별 notification:push 흐름을 검증합니다.
              </p>
              <div className="aic-sim-actions-row">
                <button
                  className="aic-sim-btn"
                  onClick={handleSimulateReceivable}
                  disabled={simulating || clearing}
                >
                  {simulating ? (
                    <><span className="aic-sim-spinner" /> 시뮬레이션 실행 중…</>
                  ) : (
                    '▶ 받을어음 수신 시뮬레이션'
                  )}
                </button>
                <button
                  className="aic-sim-btn clear"
                  onClick={handleClearSimData}
                  disabled={simulating || clearing}
                >
                  {clearing ? (
                    <><span className="aic-sim-spinner" /> 삭제 중…</>
                  ) : (
                    '✕ 테스트 데이터 삭제'
                  )}
                </button>
                {simResult && (
                  <span className={`aic-sim-result-badge ${simResult.ok ? 'ok' : 'err'}`}>
                    {simResult.ok ? '✓' : '✗'} {simResult.msg}
                  </span>
                )}
              </div>

              {toasts.length > 0 && (
                <div className="aic-sim-toasts">
                  <div className="aic-sim-toasts-title">수신된 notification:push ({toasts.length})</div>
                  {toasts.map(t => (
                    <div key={t.id} className="aic-sim-toast">
                      <div className="aic-sim-toast-header">
                        <span className="aic-sim-toast-role">{t.recipientRole}</span>
                        <span className="aic-sim-toast-title-text">{t.title}</span>
                        <span className="aic-sim-toast-time">{t.at}</span>
                      </div>
                      <div className="aic-sim-toast-body">{t.body}</div>
                      {t.runId && (
                        <div className="aic-sim-toast-run">Run: <span className="mono">{t.runId.slice(0, 8)}…</span></div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {calendarLoading ? (
              <div className="aic-sources-loading"><div className="aic-sources-spinner" /></div>
            ) : calendarEvents.length === 0 ? (
              <div className="aic-empty">등록된 회사 데드라인 및 공유 일정이 없습니다.</div>
            ) : (
              <div className="aic-calendar-timeline-flow">
                {calendarEvents.map(evt => (
                  <div key={evt.id} className="aic-cal-timeline-item">
                    <div className="aic-cal-timeline-date">
                      <span className="cal-icon">📅</span>
                      <strong>{evt.date}</strong>
                    </div>
                    <div className="aic-cal-timeline-card">
                      <h4>{evt.title}</h4>
                      {evt.description && <p className="cal-desc">{evt.description}</p>}
                      <div className="aic-cal-timeline-footer">
                        {evt.assignee_role && (
                          <span className="cal-role">역할 참조: <strong>{evt.assignee_role}</strong></span>
                        )}
                        {evt.run_id && (
                          <span className="cal-run">Run: <small className="mono">{evt.run_id.slice(0, 8)}</small></span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'workflows' && (
          <>
            <div className="aic-workflow-list">
              {loading ? (
                <div className="aic-empty">Loading workflows…</div>
              ) : filtered.length === 0 ? (
                <div className="aic-empty">No workflows match this filter.</div>
              ) : (
                filtered.map(w => (
                  <WorkflowCard
                    key={w.id}
                    workflow={w}
                    selected={selectedWorkflow?.id === w.id}
                    onClick={() => setSelected(w)}
                  />
                ))
              )}
            </div>

            <div className="aic-detail-wrap">
              {selectedWorkflow
                ? <WorkflowDetail workflow={selectedWorkflow} />
                : <div className="aic-empty centered">Select a workflow to view details.</div>
              }
            </div>
          </>
        )}

        {activeTab === 'actions' && (
          <div className="aic-actions-panel">
            <div className="aic-actions-intro">
              Global action registry — defined once, used by any workflow.
            </div>
            <div className="aic-actions-grid">
              {ACTION_GROUPS.map(g => (
                <ActionGroupCard key={g.label} group={g} />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'sources' && (
          <div className="aic-sources-panel">
            {sourcesLoading ? (
              <div className="aic-sources-loading">
                <div className="aic-sources-spinner" />
              </div>
            ) : sources.length === 0 ? (
              <div className="aic-sources-empty">
                <div className="aic-sources-empty-icon">⊞</div>
                <div className="aic-sources-empty-title">No data sources found</div>
                <div className="aic-sources-empty-body">
                  Import data from User Data, Finance Hub, or Business Identity to see sources here.
                </div>
              </div>
            ) : (
              displayGroups.map(({ key, title, items }) => (
                <div key={key} className="aic-sources-group">
                  <div className="aic-sources-group-title">{title}</div>
                  {items.map(source => {
                    const state = getProcessingState(source);
                    return (
                      <div key={source.id} className={`aic-source-item state-${state}`}>
                        <span className={`aic-source-state-dot dot-${state}`} title={
                          state === 'never'     ? 'Not yet processed' :
                          state === 'stale'     ? 'New rows since last processing' :
                          'Processed'
                        } />
                        <div className="aic-source-item-info">
                          <span className="aic-source-item-label">{source.label}</span>
                          <span className="aic-source-item-sublabel">{source.sublabel}</span>
                        </div>
                        {state === 'processed' && source.entityCount > 0 && (
                          <span className="aic-source-entity-count">
                            {source.entityCount} concepts
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
