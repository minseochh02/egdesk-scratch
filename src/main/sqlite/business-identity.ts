import Database from 'better-sqlite3';

export interface BusinessIdentitySnapshot {
  id: string;
  brandKey: string;
  sourceUrl: string | null;
  rawInput: string | null;
  identityJson: string;
  aiProvider: string | null;
  aiModel: string | null;
  seoAnalysisJson: string | null;
  sslAnalysisJson: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BusinessIdentitySnsAccount {
  id: string;
  snapshotId: string;
  channel: string;
  credentialJson: string | null;
  profilePath: string | null;
  status: string;
  lastValidatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface BusinessIdentitySnsPlan {
  id: string;
  snapshotId: string;
  channel: string;
  title: string;
  cadenceType: 'daily' | 'weekly' | 'monthly' | 'custom';
  cadenceValue: number | null;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  scheduledTime: string;
  topicsJson: string;
  assetsJson: string | null;
  enabled: boolean;
  lastRunAt?: Date;
  nextRunAt?: Date;
  runCount: number;
  successCount: number;
  failureCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBusinessIdentitySnapshot {
  brandKey: string;
  sourceUrl?: string | null;
  rawInput?: string | null;
  identityJson: string;
  aiProvider?: string | null;
  aiModel?: string | null;
}

export interface CreateBusinessIdentitySnsAccount {
  snapshotId: string;
  channel: string;
  credentialJson?: string | null;
  profilePath?: string | null;
  status?: string;
}

export interface CreateBusinessIdentitySnsPlan {
  snapshotId: string;
  channel: string;
  title: string;
  cadenceType: 'daily' | 'weekly' | 'monthly' | 'custom';
  cadenceValue?: number | null;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  scheduledTime: string;
  topics: string[];
  assets?: Record<string, any>;
  enabled?: boolean;
}

export interface BusinessIdentitySnsPlanExecution {
  id: string;
  planId: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  error?: string;
  output?: string;
  executionData?: Record<string, any>;
  createdAt: Date;
}

export interface CreateBusinessIdentitySnsPlanExecution {
  planId: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  error?: string;
  output?: string;
  executionData?: Record<string, any>;
}

export class SQLiteBusinessIdentityManager {
  private db: Database.Database;

  constructor(database: Database.Database) {
    this.db = database;
    this.ensureTables();
  }

  private ensureTables() {
    const snapshotTable = `
      CREATE TABLE IF NOT EXISTS business_identity_snapshots (
        id TEXT PRIMARY KEY,
        brand_key TEXT NOT NULL,
        source_url TEXT,
        raw_input TEXT,
        identity_json TEXT NOT NULL,
        ai_provider TEXT,
        ai_model TEXT,
        seo_analysis_json TEXT,
        ssl_analysis_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `;
    
    // Add columns if they don't exist (for migration)
    this.db.exec(snapshotTable);
    try {
      this.db.exec(`ALTER TABLE business_identity_snapshots ADD COLUMN seo_analysis_json TEXT`);
    } catch (e) {
      // Column already exists, ignore
    }
    try {
      this.db.exec(`ALTER TABLE business_identity_snapshots ADD COLUMN ssl_analysis_json TEXT`);
    } catch (e) {
      // Column already exists, ignore
    }

    const accountTable = `
      CREATE TABLE IF NOT EXISTS business_identity_sns_accounts (
        id TEXT PRIMARY KEY,
        snapshot_id TEXT NOT NULL,
        channel TEXT NOT NULL,
        credential_json TEXT,
        profile_path TEXT,
        status TEXT NOT NULL DEFAULT 'unknown',
        last_validated_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(snapshot_id) REFERENCES business_identity_snapshots(id) ON DELETE CASCADE
      )
    `;

    const planTable = `
      CREATE TABLE IF NOT EXISTS business_identity_sns_plans (
        id TEXT PRIMARY KEY,
        snapshot_id TEXT NOT NULL,
        channel TEXT NOT NULL,
        title TEXT NOT NULL,
        cadence_type TEXT NOT NULL,
        cadence_value INTEGER,
        day_of_week INTEGER,
        day_of_month INTEGER,
        scheduled_time TEXT NOT NULL,
        topics_json TEXT NOT NULL,
        assets_json TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        last_run_at TEXT,
        next_run_at TEXT,
        run_count INTEGER NOT NULL DEFAULT 0,
        success_count INTEGER NOT NULL DEFAULT 0,
        failure_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(snapshot_id) REFERENCES business_identity_snapshots(id) ON DELETE CASCADE
      )
    `;

    const executionTable = `
      CREATE TABLE IF NOT EXISTS business_identity_sns_plan_executions (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT,
        status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
        error TEXT,
        output TEXT,
        execution_data TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (plan_id) REFERENCES business_identity_sns_plans(id) ON DELETE CASCADE
      )
    `;

    this.db.exec(accountTable);
    this.db.exec(planTable);
    this.db.exec(executionTable);
  }

  private generateId(prefix: string) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  createSnapshot(data: CreateBusinessIdentitySnapshot): BusinessIdentitySnapshot {
    const id = this.generateId('bi_snapshot');
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO business_identity_snapshots (
        id, brand_key, source_url, raw_input, identity_json, ai_provider, ai_model,
        seo_analysis_json, ssl_analysis_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      data.brandKey,
      data.sourceUrl ?? null,
      data.rawInput ?? null,
      data.identityJson,
      data.aiProvider ?? null,
      data.aiModel ?? null,
      null,
      null,
      now,
      now
    );
    return this.getSnapshot(id)!;
  }

  getSnapshot(id: string): BusinessIdentitySnapshot | null {
    const row = this.db
      .prepare(`SELECT * FROM business_identity_snapshots WHERE id = ?`)
      .get(id) as any;
    if (!row) return null;
    return this.mapSnapshot(row);
  }

  listSnapshots(brandKey: string): BusinessIdentitySnapshot[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM business_identity_snapshots WHERE brand_key = ? ORDER BY created_at DESC`
      )
      .all(brandKey) as any[];
    return rows.map((row) => this.mapSnapshot(row));
  }

  createAccount(data: CreateBusinessIdentitySnsAccount): BusinessIdentitySnsAccount {
    const id = this.generateId('bi_account');
    const now = new Date().toISOString();
    this.db
      .prepare(`
        INSERT INTO business_identity_sns_accounts (
          id, snapshot_id, channel, credential_json, profile_path, status,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        data.snapshotId,
        data.channel,
        data.credentialJson ?? null,
        data.profilePath ?? null,
        data.status ?? 'unknown',
        now,
        now
      );
    return this.getAccount(id)!;
  }

  getAccount(id: string): BusinessIdentitySnsAccount | null {
    const row = this.db
      .prepare(`SELECT * FROM business_identity_sns_accounts WHERE id = ?`)
      .get(id) as any;
    if (!row) return null;
    return this.mapAccount(row);
  }

  listAccounts(snapshotId: string): BusinessIdentitySnsAccount[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM business_identity_sns_accounts WHERE snapshot_id = ? ORDER BY created_at DESC`
      )
      .all(snapshotId) as any[];
    return rows.map((row) => this.mapAccount(row));
  }

  createPlan(data: CreateBusinessIdentitySnsPlan): BusinessIdentitySnsPlan {
    const id = this.generateId('bi_plan');
    const now = new Date().toISOString();
    this.db
      .prepare(`
        INSERT INTO business_identity_sns_plans (
          id, snapshot_id, channel, title, cadence_type, cadence_value,
          day_of_week, day_of_month, scheduled_time, topics_json, assets_json,
          enabled, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        data.snapshotId,
        data.channel,
        data.title,
        data.cadenceType,
        data.cadenceValue ?? null,
        data.dayOfWeek ?? null,
        data.dayOfMonth ?? null,
        data.scheduledTime,
        JSON.stringify(data.topics),
        data.assets ? JSON.stringify(data.assets) : null,
        (data.enabled ?? true) ? 1 : 0,
        now,
        now
      );
    return this.getPlan(id)!;
  }

  getPlan(id: string): BusinessIdentitySnsPlan | null {
    const row = this.db
      .prepare(`SELECT * FROM business_identity_sns_plans WHERE id = ?`)
      .get(id) as any;
    if (!row) return null;
    return this.mapPlan(row);
  }

  listPlans(snapshotId: string): BusinessIdentitySnsPlan[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM business_identity_sns_plans WHERE snapshot_id = ? ORDER BY created_at DESC`
      )
      .all(snapshotId) as any[];
    return rows.map((row) => this.mapPlan(row));
  }

  deletePlansBySnapshot(snapshotId: string): void {
    this.db.prepare(`DELETE FROM business_identity_sns_plans WHERE snapshot_id = ?`).run(snapshotId);
  }

  replacePlans(
    snapshotId: string,
    plans: CreateBusinessIdentitySnsPlan[]
  ): BusinessIdentitySnsPlan[] {
    const run = this.db.transaction((entries: CreateBusinessIdentitySnsPlan[]) => {
      this.deletePlansBySnapshot(snapshotId);
      const savedPlans: BusinessIdentitySnsPlan[] = [];
      for (const plan of entries) {
        savedPlans.push(
          this.createPlan({
            ...plan,
            snapshotId,
          })
        );
      }
      return savedPlans;
    });

    if (!plans || plans.length === 0) {
      this.deletePlansBySnapshot(snapshotId);
      return [];
    }

    return run(plans);
  }

  updateAnalysisResults(snapshotId: string, seoAnalysis: any, sslAnalysis: any): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE business_identity_snapshots
      SET seo_analysis_json = ?, ssl_analysis_json = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(
      seoAnalysis ? JSON.stringify(seoAnalysis) : null,
      sslAnalysis ? JSON.stringify(sslAnalysis) : null,
      now,
      snapshotId
    );
  }

  private mapSnapshot(row: any): BusinessIdentitySnapshot {
    return {
      id: row.id,
      brandKey: row.brand_key,
      sourceUrl: row.source_url ?? null,
      rawInput: row.raw_input ?? null,
      identityJson: row.identity_json,
      aiProvider: row.ai_provider ?? null,
      aiModel: row.ai_model ?? null,
      seoAnalysisJson: row.seo_analysis_json ?? null,
      sslAnalysisJson: row.ssl_analysis_json ?? null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapAccount(row: any): BusinessIdentitySnsAccount {
    return {
      id: row.id,
      snapshotId: row.snapshot_id,
      channel: row.channel,
      credentialJson: row.credential_json ?? null,
      profilePath: row.profile_path ?? null,
      status: row.status,
      lastValidatedAt: row.last_validated_at ? new Date(row.last_validated_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapPlan(row: any): BusinessIdentitySnsPlan {
    return {
      id: row.id,
      snapshotId: row.snapshot_id,
      channel: row.channel,
      title: row.title,
      cadenceType: row.cadence_type,
      cadenceValue: row.cadence_value,
      dayOfWeek: row.day_of_week,
      dayOfMonth: row.day_of_month,
      scheduledTime: row.scheduled_time,
      topicsJson: row.topics_json,
      assetsJson: row.assets_json,
      enabled: Boolean(row.enabled),
      lastRunAt: row.last_run_at ? new Date(row.last_run_at) : undefined,
      nextRunAt: row.next_run_at ? new Date(row.next_run_at) : undefined,
      runCount: row.run_count,
      successCount: row.success_count,
      failureCount: row.failure_count,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  createExecution(data: CreateBusinessIdentitySnsPlanExecution): BusinessIdentitySnsPlanExecution {
    const id = this.generateId('bi_exec');
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO business_identity_sns_plan_executions (
        id, plan_id, start_time, end_time, status, error, output, execution_data, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      data.planId,
      data.startTime.toISOString(),
      data.endTime ? data.endTime.toISOString() : null,
      data.status,
      data.error ?? null,
      data.output ?? null,
      data.executionData ? JSON.stringify(data.executionData) : null,
      now
    );
    return this.getExecution(id)!;
  }

  getExecution(id: string): BusinessIdentitySnsPlanExecution | null {
    const row = this.db
      .prepare(`SELECT * FROM business_identity_sns_plan_executions WHERE id = ?`)
      .get(id) as any;
    if (!row) return null;
    return this.mapExecution(row);
  }

  updateExecution(id: string, updates: Partial<CreateBusinessIdentitySnsPlanExecution>): void {
    const updatesList: string[] = [];
    const values: any[] = [];

    if (updates.endTime !== undefined) {
      updatesList.push('end_time = ?');
      values.push(updates.endTime ? updates.endTime.toISOString() : null);
    }
    if (updates.status !== undefined) {
      updatesList.push('status = ?');
      values.push(updates.status);
    }
    if (updates.error !== undefined) {
      updatesList.push('error = ?');
      values.push(updates.error ?? null);
    }
    if (updates.output !== undefined) {
      updatesList.push('output = ?');
      values.push(updates.output ?? null);
    }
    if (updates.executionData !== undefined) {
      updatesList.push('execution_data = ?');
      values.push(updates.executionData ? JSON.stringify(updates.executionData) : null);
    }

    if (updatesList.length === 0) return;

    values.push(id);
    this.db.prepare(`UPDATE business_identity_sns_plan_executions SET ${updatesList.join(', ')} WHERE id = ?`).run(...values);
  }

  listExecutions(planId: string): BusinessIdentitySnsPlanExecution[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM business_identity_sns_plan_executions WHERE plan_id = ? ORDER BY created_at DESC`
      )
      .all(planId) as any[];
    return rows.map((row) => this.mapExecution(row));
  }

  private mapExecution(row: any): BusinessIdentitySnsPlanExecution {
    return {
      id: row.id,
      planId: row.plan_id,
      startTime: new Date(row.start_time),
      endTime: row.end_time ? new Date(row.end_time) : undefined,
      status: row.status,
      error: row.error ?? undefined,
      output: row.output ?? undefined,
      executionData: row.execution_data ? JSON.parse(row.execution_data) : undefined,
      createdAt: new Date(row.created_at),
    };
  }

  updatePlanStats(planId: string, success: boolean): void {
    const plan = this.getPlan(planId);
    if (!plan) return;

    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE business_identity_sns_plans
      SET
        last_run_at = ?,
        run_count = run_count + 1,
        success_count = success_count + ?,
        failure_count = failure_count + ?,
        updated_at = ?
      WHERE id = ?
    `);
    stmt.run(now, success ? 1 : 0, success ? 0 : 1, now, planId);
  }
}

