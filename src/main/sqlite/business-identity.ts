import Database from 'better-sqlite3';

export interface BusinessIdentitySnapshot {
  id: string;
  brandKey: string;
  sourceUrl: string | null;
  rawInput: string | null;
  identityJson: string;
  aiProvider: string | null;
  aiModel: string | null;
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
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `;

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

    this.db.exec(snapshotTable);
    this.db.exec(accountTable);
    this.db.exec(planTable);
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
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      data.brandKey,
      data.sourceUrl ?? null,
      data.rawInput ?? null,
      data.identityJson,
      data.aiProvider ?? null,
      data.aiModel ?? null,
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

  private mapSnapshot(row: any): BusinessIdentitySnapshot {
    return {
      id: row.id,
      brandKey: row.brand_key,
      sourceUrl: row.source_url ?? null,
      rawInput: row.raw_input ?? null,
      identityJson: row.identity_json,
      aiProvider: row.ai_provider ?? null,
      aiModel: row.ai_model ?? null,
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
}

