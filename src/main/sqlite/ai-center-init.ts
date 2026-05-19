import Database from 'better-sqlite3';

/**
 * Initialize AI Center Database Schema (ai-system.db / Neuron DB)
 * 
 * [이중 저장소 분리 원칙 반영]
 * 1. tasks: 엔진 실행의 유일한 단일 진실 공급원 (상태 존재, dependsOn 의존 DAG 제어용)
 * 2. company_calendar: 인간용 데드라인 시각화 뷰 (상태 없음, 엔진이 처리 시 절대 읽지 않음)
 */
export function initializeNeuronSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS entities (
      id         TEXT PRIMARY KEY,
      type       TEXT,
      name       TEXT,
      raw        TEXT,
      embedding  BLOB,
      source     TEXT,
      confidence REAL,
      created_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
    CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);

    CREATE TABLE IF NOT EXISTS document_relations (
      id           TEXT PRIMARY KEY,
      from_type    TEXT,
      from_id      TEXT,
      to_type      TEXT,
      to_id        TEXT,
      relation     TEXT,
      vector_triple BLOB,
      confidence   REAL,
      source       TEXT,
      created_at   TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_relations_from ON document_relations(from_id);
    CREATE INDEX IF NOT EXISTS idx_relations_to   ON document_relations(to_id);

    CREATE TABLE IF NOT EXISTS tags (
      id         TEXT PRIMARY KEY,
      doc_type   TEXT,
      doc_id     TEXT,
      doc_ref    TEXT,
      namespace  TEXT,
      value      TEXT,
      entity_id  TEXT REFERENCES entities(id),
      embedding  BLOB,
      confidence REAL,
      source     TEXT,
      created_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_tags_entity_id       ON tags(entity_id);
    CREATE INDEX IF NOT EXISTS idx_tags_doc             ON tags(doc_type, doc_id);
    CREATE INDEX IF NOT EXISTS idx_tags_namespace_value ON tags(namespace, value);

    CREATE TABLE IF NOT EXISTS source_registry (
      id            TEXT PRIMARY KEY,
      origin        TEXT NOT NULL,
      label         TEXT NOT NULL,
      row_count     INTEGER NOT NULL DEFAULT 0,
      last_row_count INTEGER,
      processed_at  TEXT,
      entity_count  INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_source_registry_origin ON source_registry(origin);

    CREATE TABLE IF NOT EXISTS workflows (
      id            TEXT PRIMARY KEY,
      label         TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'draft',
      input_types   TEXT NOT NULL DEFAULT '[]',
      hints         TEXT NOT NULL DEFAULT '[]',
      output_tables TEXT NOT NULL DEFAULT '[]',
      suggested_by  TEXT,
      trigger_table TEXT,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);

    CREATE TABLE IF NOT EXISTS workflow_actions (
      id          TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
      stage       INTEGER NOT NULL DEFAULT 0,
      position    INTEGER NOT NULL,
      action_id   TEXT NOT NULL,
      params      TEXT NOT NULL DEFAULT '{}',
      created_at  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_workflow_actions_workflow ON workflow_actions(workflow_id, stage, position);

    CREATE TABLE IF NOT EXISTS workflow_notify (
      id          TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
      role        TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_workflow_notify_workflow ON workflow_notify(workflow_id);

    CREATE TABLE IF NOT EXISTS workflow_runs (
      id             TEXT PRIMARY KEY,
      workflow_id    TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
      input_json     TEXT NOT NULL DEFAULT '{}',
      status         TEXT NOT NULL DEFAULT '정상진행중'
                       CHECK (status IN ('정상진행중', '반려중', '정상완료', '취소완료')),
      current_stage  INTEGER NOT NULL DEFAULT 0,
      source_table   TEXT,
      source_row_id  TEXT,
      created_at     TEXT NOT NULL,
      updated_at     TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow ON workflow_runs(workflow_id);
    CREATE INDEX IF NOT EXISTS idx_workflow_runs_status   ON workflow_runs(status);

    CREATE TABLE IF NOT EXISTS workflow_approvals (
      id             TEXT PRIMARY KEY,
      run_id         TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
      stage          INTEGER NOT NULL,
      chain_position INTEGER NOT NULL,
      role           TEXT NOT NULL,
      decision       TEXT CHECK (decision IN ('approved', 'rejected', 'cancelled')),
      decided_at     TEXT,
      created_at     TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_workflow_approvals_run ON workflow_approvals(run_id);

    -- [AI Center 이중 저장소 분리] 1. Tasks 테이블 생성 (엔진 실행의 단일 진실 공급원)
    CREATE TABLE IF NOT EXISTS tasks (
      id          TEXT PRIMARY KEY,
      action_id   TEXT NOT NULL,
      run_id      TEXT NOT NULL,
      title       TEXT NOT NULL,
      role        TEXT NOT NULL,
      task_type   TEXT NOT NULL DEFAULT 'work',
      status      TEXT NOT NULL DEFAULT 'pending',
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_run_id    ON tasks(run_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_action_id ON tasks(action_id, run_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_role      ON tasks(role);
    CREATE INDEX IF NOT EXISTS idx_tasks_status    ON tasks(status);

    -- [AI Center 이중 저장소 분리] 2. Company Calendar 테이블 생성 (인간용 데드라인 뷰 - 상태 없음!)
    CREATE TABLE IF NOT EXISTS company_calendar (
      id            TEXT PRIMARY KEY,
      title         TEXT NOT NULL,
      description   TEXT,
      date          TEXT NOT NULL,
      assignee_role TEXT,
      run_id        TEXT,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_cal_date       ON company_calendar(date);
    CREATE INDEX IF NOT EXISTS idx_cal_assignee   ON company_calendar(assignee_role);
  `);

  // Migrate existing workflow_actions rows — add stage column if missing
  try {
    db.exec(`ALTER TABLE workflow_actions ADD COLUMN stage INTEGER NOT NULL DEFAULT 0`);
  } catch {
    // Column already exists
  }
}
