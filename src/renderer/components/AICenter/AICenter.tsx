import React, { useState, useMemo } from 'react';
import './AICenter.css';
import { useWorkflows, WorkflowDef } from '../../hooks/useWorkflows';
import { useDataSources, DataSource, getProcessingState } from '../../hooks/useDataSources';

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

type ActiveTab = 'workflows' | 'actions' | 'sources';

const FIXED_ORIGIN_LABELS: Record<string, string> = {
  userdata:        'User Data',
  financehub:      'Finance Hub',
  companyresearch: 'Company Research',
};
const GROUPED_ORIGINS = new Set(['businessidentity']);

export function AICenter() {
  const { workflows, loading }                        = useWorkflows();
  const { sources, loading: sourcesLoading }          = useDataSources();
  const [activeTab, setActiveTab]                     = useState<ActiveTab>('workflows');
  const [selectedWorkflow, setSelected]               = useState<WorkflowDef | null>(null);
  const [statusFilter, setStatusFilter]               = useState<WorkflowDef['status'] | 'all'>('all');

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
