/**
 * SkillsetManager - Core business logic for Skillset System
 * Handles CRUD operations for websites, capabilities, and navigation paths
 */

import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, execute, transaction } from './skillset-database';
import {
  WebsiteSkillset,
  CapabilityRecord,
  NavigationPath,
  ExplorationLog,
  CapabilityQueryOptions,
  ExecutionFeedback,
  ExplorerResult,
  ExplorerCapability,
  NavigationStep,
} from './types';

/**
 * Create a new website in the Skillset library
 */
export function createWebsite(params: {
  url: string;
  siteName: string;
  siteType?: string;
  loginMethod?: any;
}): WebsiteSkillset {
  const id = uuidv4();
  const domain = new URL(params.url).hostname;

  execute(
    `INSERT INTO skillset_websites
     (id, url, domain, site_name, site_type, login_method, created_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      id,
      params.url,
      domain,
      params.siteName,
      params.siteType || null,
      params.loginMethod ? JSON.stringify(params.loginMethod) : null,
    ]
  );

  console.log('[SkillsetManager] Created website:', params.siteName, id);

  return getWebsite(id)!;
}

/**
 * Get a website by ID
 */
export function getWebsite(id: string): WebsiteSkillset | null {
  const row = queryOne<any>(
    `SELECT * FROM skillset_websites WHERE id = ?`,
    [id]
  );

  if (!row) return null;

  return rowToWebsite(row);
}

/**
 * Get a website by URL
 */
export function getWebsiteByUrl(url: string): WebsiteSkillset | null {
  const row = queryOne<any>(
    `SELECT * FROM skillset_websites WHERE url = ?`,
    [url]
  );

  if (!row) return null;

  return rowToWebsite(row);
}

/**
 * List all websites in the library
 */
export function listWebsites(): WebsiteSkillset[] {
  const rows = query<any>(
    `SELECT * FROM skillset_websites ORDER BY last_used_at DESC`
  );

  return rows.map(rowToWebsite);
}

/**
 * Update website metadata
 */
export function updateWebsite(
  id: string,
  updates: Partial<WebsiteSkillset>
): void {
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.siteName) {
    fields.push('site_name = ?');
    values.push(updates.siteName);
  }
  if (updates.siteType) {
    fields.push('site_type = ?');
    values.push(updates.siteType);
  }
  if (updates.notes !== undefined) {
    fields.push('notes = ?');
    values.push(updates.notes);
  }
  if (updates.tags) {
    fields.push('tags = ?');
    values.push(JSON.stringify(updates.tags));
  }

  if (fields.length === 0) return;

  values.push(id);

  execute(
    `UPDATE skillset_websites SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
}

/**
 * Delete a website and all its capabilities
 */
export function deleteWebsite(id: string): void {
  execute(`DELETE FROM skillset_websites WHERE id = ?`, [id]);
  console.log('[SkillsetManager] Deleted website:', id);
}

/**
 * Update last used timestamp
 */
export function updateLastUsed(websiteId: string): void {
  execute(
    `UPDATE skillset_websites
     SET last_used_at = datetime('now'), usage_count = usage_count + 1
     WHERE id = ?`,
    [websiteId]
  );
}

/**
 * Update last explored timestamp
 */
export function updateLastExplored(websiteId: string): void {
  execute(
    `UPDATE skillset_websites
     SET last_explored_at = datetime('now'), exploration_count = exploration_count + 1
     WHERE id = ?`,
    [websiteId]
  );
}

/**
 * Add a capability to a website
 */
export function addCapability(params: {
  websiteId: string;
  section: string;
  description: string;
  dataAvailable: string[];
  discoveredBy: 'EXPLORER' | 'RESEARCHER' | 'MANUAL';
  path?: string;
}): CapabilityRecord {
  const id = uuidv4();

  transaction(() => {
    // Insert capability
    execute(
      `INSERT INTO skillset_capabilities
       (id, website_id, section, description, data_available, discovered_by, discovered_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        id,
        params.websiteId,
        params.section,
        params.description,
        JSON.stringify(params.dataAvailable),
        params.discoveredBy,
      ]
    );

    // Add primary navigation path if provided
    if (params.path) {
      const pathId = uuidv4();
      const steps = parsePathToSteps(params.path);

      execute(
        `INSERT INTO skillset_navigation_paths
         (id, capability_id, steps, is_primary)
         VALUES (?, ?, ?, TRUE)`,
        [pathId, id, JSON.stringify(steps)]
      );
    }
  });

  console.log('[SkillsetManager] Added capability:', params.section);

  return getCapability(id)!;
}

/**
 * Get a capability by ID
 */
export function getCapability(id: string): CapabilityRecord | null {
  const row = queryOne<any>(
    `SELECT * FROM skillset_capabilities WHERE id = ?`,
    [id]
  );

  if (!row) return null;

  return rowToCapability(row);
}

/**
 * Get all capabilities for a website
 */
export function getCapabilities(
  websiteId: string,
  options?: CapabilityQueryOptions
): CapabilityRecord[] {
  let sql = `SELECT * FROM skillset_capabilities WHERE website_id = ?`;
  const params: any[] = [websiteId];

  // Apply filters
  if (options?.section) {
    sql += ` AND section = ?`;
    params.push(options.section);
  }

  if (options?.minConfidence !== undefined) {
    sql += ` AND confidence >= ?`;
    params.push(options.minConfidence);
  }

  if (options?.maxConfidence !== undefined) {
    sql += ` AND confidence <= ?`;
    params.push(options.maxConfidence);
  }

  if (options?.hasChanged !== undefined) {
    sql += ` AND has_changed = ?`;
    params.push(options.hasChanged ? 1 : 0);
  }

  // Apply ordering
  if (options?.orderBy) {
    const orderCol = {
      confidence: 'confidence',
      lastAccessed: 'last_accessed_at',
      section: 'section',
    }[options.orderBy];

    const direction = options.orderDirection || 'DESC';
    sql += ` ORDER BY ${orderCol} ${direction}`;
  }

  // Apply limit
  if (options?.limit) {
    sql += ` LIMIT ?`;
    params.push(options.limit);
  }

  const rows = query<any>(sql, params);
  return rows.map(rowToCapability);
}

/**
 * Query capabilities across all websites
 */
export function queryCapabilities(
  options: CapabilityQueryOptions
): CapabilityRecord[] {
  let sql = `SELECT * FROM skillset_capabilities WHERE 1=1`;
  const params: any[] = [];

  if (options.websiteId) {
    sql += ` AND website_id = ?`;
    params.push(options.websiteId);
  }

  if (options.section) {
    sql += ` AND section LIKE ?`;
    params.push(`%${options.section}%`);
  }

  if (options.minConfidence !== undefined) {
    sql += ` AND confidence >= ?`;
    params.push(options.minConfidence);
  }

  if (options.maxConfidence !== undefined) {
    sql += ` AND confidence <= ?`;
    params.push(options.maxConfidence);
  }

  if (options.hasChanged !== undefined) {
    sql += ` AND has_changed = ?`;
    params.push(options.hasChanged ? 1 : 0);
  }

  if (options.orderBy) {
    const orderCol = {
      confidence: 'confidence',
      lastAccessed: 'last_accessed_at',
      section: 'section',
    }[options.orderBy];

    const direction = options.orderDirection || 'DESC';
    sql += ` ORDER BY ${orderCol} ${direction}`;
  }

  if (options.limit) {
    sql += ` LIMIT ?`;
    params.push(options.limit);
  }

  const rows = query<any>(sql, params);
  return rows.map(rowToCapability);
}

/**
 * Update capability confidence
 */
export function updateConfidence(id: string, delta: number): void {
  execute(
    `UPDATE skillset_capabilities
     SET confidence = MIN(1.0, MAX(0.0, confidence + ?))
     WHERE id = ?`,
    [delta, id]
  );
}

/**
 * Record successful navigation
 */
export function recordSuccess(capabilityId: string, pathId?: string): void {
  transaction(() => {
    // Update capability
    execute(
      `UPDATE skillset_capabilities
       SET successful_navigations = successful_navigations + 1,
           last_accessed_at = datetime('now'),
           last_verified_at = datetime('now')
       WHERE id = ?`,
      [capabilityId]
    );

    // Increase confidence using learning rate
    const capability = getCapability(capabilityId);
    if (capability) {
      const LEARNING_RATE = 0.1;
      const newConfidence =
        capability.confidence + (1 - capability.confidence) * LEARNING_RATE;
      execute(
        `UPDATE skillset_capabilities SET confidence = ? WHERE id = ?`,
        [newConfidence, capabilityId]
      );
    }

    // Update path if specified
    if (pathId) {
      execute(
        `UPDATE skillset_navigation_paths
         SET success_count = success_count + 1,
             last_success_at = datetime('now')
         WHERE id = ?`,
        [pathId]
      );
    }
  });

  console.log('[SkillsetManager] Recorded success for:', capabilityId);
}

/**
 * Record failed navigation
 */
export function recordFailure(capabilityId: string, pathId?: string): void {
  transaction(() => {
    // Update capability
    execute(
      `UPDATE skillset_capabilities
       SET failed_navigations = failed_navigations + 1,
           last_accessed_at = datetime('now')
       WHERE id = ?`,
      [capabilityId]
    );

    // Decrease confidence (faster decay)
    const capability = getCapability(capabilityId);
    if (capability) {
      const LEARNING_RATE = 0.1;
      const newConfidence = capability.confidence * (1 - LEARNING_RATE * 2);
      execute(
        `UPDATE skillset_capabilities SET confidence = ? WHERE id = ?`,
        [newConfidence, capabilityId]
      );

      // Flag for re-verification if confidence drops too low
      if (newConfidence < 0.3 && capability.failedNavigations >= 1) {
        execute(
          `UPDATE skillset_capabilities SET has_changed = TRUE WHERE id = ?`,
          [capabilityId]
        );
      }
    }

    // Update path if specified
    if (pathId) {
      execute(
        `UPDATE skillset_navigation_paths
         SET failure_count = failure_count + 1,
             last_failure_at = datetime('now')
         WHERE id = ?`,
        [pathId]
      );
    }
  });

  console.log('[SkillsetManager] Recorded failure for:', capabilityId);
}

/**
 * Save EXPLORER results to Skillset
 */
export function saveExplorationResults(
  url: string,
  result: ExplorerResult
): WebsiteSkillset {
  let website = getWebsiteByUrl(url);

  if (!website) {
    // Create new website
    website = createWebsite({
      url,
      siteName: result.siteName,
      siteType: result.siteType,
      loginMethod: result.loginFields.length > 0 ? {
        type: 'multi-field',
        fields: result.loginFields,
      } : undefined,
    });
  } else {
    // Update existing website
    updateLastExplored(website.id);
  }

  // Add/update capabilities
  let newCount = 0;
  let updatedCount = 0;

  for (const cap of result.capabilities) {
    const existing = getCapabilities(website.id).find(
      (c) => c.section === cap.section && c.description === cap.description
    );

    if (existing) {
      // Update existing capability
      execute(
        `UPDATE skillset_capabilities
         SET data_available = ?,
             last_verified_at = datetime('now')
         WHERE id = ?`,
        [JSON.stringify(cap.dataAvailable), existing.id]
      );
      updatedCount++;
    } else {
      // Add new capability
      addCapability({
        websiteId: website.id,
        section: cap.section,
        description: cap.description,
        dataAvailable: cap.dataAvailable,
        discoveredBy: 'EXPLORER',
        path: cap.path,
      });
      newCount++;
    }
  }

  // Log exploration
  const logId = uuidv4();
  execute(
    `INSERT INTO skillset_exploration_logs
     (id, website_id, method, capabilities_found, tool_calls_used, execution_time_ms,
      new_capabilities, updated_capabilities)
     VALUES (?, ?, 'EXPLORER', ?, ?, ?, ?, ?)`,
    [
      logId,
      website.id,
      result.capabilities.length,
      result.totalToolCalls,
      result.executionTimeMs,
      newCount,
      updatedCount,
    ]
  );

  // Update website confidence
  updateWebsiteConfidence(website.id);

  console.log(
    `[SkillsetManager] Saved exploration: ${newCount} new, ${updatedCount} updated`
  );

  return getWebsite(website.id)!;
}

/**
 * Update overall website confidence based on capabilities
 */
export function updateWebsiteConfidence(websiteId: string): void {
  const result = queryOne<{ avgConfidence: number; staleCount: number }>(
    `SELECT
       AVG(confidence) as avgConfidence,
       SUM(CASE WHEN has_changed = TRUE THEN 1 ELSE 0 END) as staleCount
     FROM skillset_capabilities
     WHERE website_id = ?`,
    [websiteId]
  );

  if (result) {
    execute(
      `UPDATE skillset_websites
       SET overall_confidence = ?,
           stale_count = ?
       WHERE id = ?`,
      [result.avgConfidence || 0.5, result.staleCount || 0, websiteId]
    );
  }
}

/**
 * Get navigation paths for a capability
 */
export function getNavigationPaths(capabilityId: string): NavigationPath[] {
  const rows = query<any>(
    `SELECT * FROM skillset_navigation_paths
     WHERE capability_id = ?
     ORDER BY is_primary DESC, confidence DESC`,
    [capabilityId]
  );

  return rows.map(rowToNavigationPath);
}

/**
 * Parse path string to navigation steps
 */
function parsePathToSteps(pathString: string): NavigationStep[] {
  const parts = pathString.split('>').map((p) => p.trim());
  return parts.map((part, index) => ({
    order: index,
    action: 'click' as const,
    elementSignature: {
      role: 'link',
      name: part,
      reliability: 0.5,
    },
    expectedResult: `Navigated to ${part}`,
  }));
}

/**
 * Convert database row to WebsiteSkillset
 */
function rowToWebsite(row: any): WebsiteSkillset {
  return {
    id: row.id,
    url: row.url,
    domain: row.domain,
    siteName: row.site_name,
    siteType: row.site_type,
    loginMethod: row.login_method ? JSON.parse(row.login_method) : undefined,
    createdAt: new Date(row.created_at),
    lastExploredAt: row.last_explored_at
      ? new Date(row.last_explored_at)
      : undefined,
    lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : undefined,
    explorationCount: row.exploration_count,
    usageCount: row.usage_count,
    overallConfidence: row.overall_confidence,
    staleCount: row.stale_count,
    tags: row.tags ? JSON.parse(row.tags) : undefined,
    notes: row.notes,
  };
}

/**
 * Convert database row to CapabilityRecord
 */
function rowToCapability(row: any): CapabilityRecord {
  return {
    id: row.id,
    websiteId: row.website_id,
    section: row.section,
    description: row.description,
    dataAvailable: JSON.parse(row.data_available),
    discoveredAt: new Date(row.discovered_at),
    discoveredBy: row.discovered_by,
    confidence: row.confidence,
    successfulNavigations: row.successful_navigations,
    failedNavigations: row.failed_navigations,
    lastAccessedAt: row.last_accessed_at
      ? new Date(row.last_accessed_at)
      : undefined,
    lastVerifiedAt: row.last_verified_at
      ? new Date(row.last_verified_at)
      : undefined,
    hasChanged: Boolean(row.has_changed),
    usedInReports: row.used_in_reports
      ? JSON.parse(row.used_in_reports)
      : undefined,
  };
}

/**
 * Convert database row to NavigationPath
 */
function rowToNavigationPath(row: any): NavigationPath {
  return {
    id: row.id,
    capabilityId: row.capability_id,
    steps: JSON.parse(row.steps),
    confidence: row.confidence,
    successCount: row.success_count,
    failureCount: row.failure_count,
    lastSuccessAt: row.last_success_at
      ? new Date(row.last_success_at)
      : undefined,
    lastFailureAt: row.last_failure_at
      ? new Date(row.last_failure_at)
      : undefined,
    requiresFilters: Boolean(row.requires_filters),
    filterInstructions: row.filter_instructions,
    estimatedTimeMs: row.estimated_time_ms,
    isPrimary: Boolean(row.is_primary),
    isDeprecated: Boolean(row.is_deprecated),
  };
}

/**
 * ==========================================
 * Credential Management
 * ==========================================
 */

import { v4 as uuidv4 } from 'uuid';
import { encryptCredentials, decryptCredentials } from './crypto-utils';

/**
 * Save credentials for a website
 */
export function saveCredentials(
  websiteId: string,
  credentials: Record<string, string>
): void {
  const encryptedData = encryptCredentials(credentials);

  // Check if credentials already exist
  const existing = queryOne<{ id: string }>(
    `SELECT id FROM skillset_credentials WHERE website_id = ?`,
    [websiteId]
  );

  if (existing) {
    // Update existing
    execute(
      `UPDATE skillset_credentials
       SET encrypted_credentials = ?,
           last_verified_at = datetime('now'),
           is_valid = TRUE,
           last_error = NULL
       WHERE website_id = ?`,
      [encryptedData, websiteId]
    );
    console.log('[SkillsetManager] Updated credentials for website:', websiteId);
  } else {
    // Insert new
    const id = uuidv4();
    execute(
      `INSERT INTO skillset_credentials
       (id, website_id, encrypted_credentials, is_valid)
       VALUES (?, ?, ?, TRUE)`,
      [id, websiteId, encryptedData]
    );
    console.log('[SkillsetManager] Saved credentials for website:', websiteId);
  }
}

/**
 * Get credentials for a website
 */
export function getCredentials(websiteId: string): Record<string, string> | null {
  const row = queryOne<{ encrypted_credentials: string; is_valid: number }>(
    `SELECT encrypted_credentials, is_valid
     FROM skillset_credentials
     WHERE website_id = ?`,
    [websiteId]
  );

  if (!row || !row.is_valid) {
    return null;
  }

  try {
    const credentials = decryptCredentials(row.encrypted_credentials);
    
    // Update last used timestamp
    execute(
      `UPDATE skillset_credentials
       SET last_used_at = datetime('now')
       WHERE website_id = ?`,
      [websiteId]
    );

    return credentials;
  } catch (error) {
    console.error('[SkillsetManager] Failed to decrypt credentials:', error);
    return null;
  }
}

/**
 * Check if credentials exist for a website
 */
export function hasCredentials(websiteId: string): boolean {
  const row = queryOne<{ count: number }>(
    `SELECT COUNT(*) as count
     FROM skillset_credentials
     WHERE website_id = ? AND is_valid = TRUE`,
    [websiteId]
  );

  return (row?.count || 0) > 0;
}

/**
 * Delete credentials for a website
 */
export function deleteCredentials(websiteId: string): void {
  execute(
    `DELETE FROM skillset_credentials WHERE website_id = ?`,
    [websiteId]
  );
  console.log('[SkillsetManager] Deleted credentials for website:', websiteId);
}

/**
 * Mark credentials as invalid (e.g., after login failure)
 */
export function invalidateCredentials(websiteId: string, error?: string): void {
  execute(
    `UPDATE skillset_credentials
     SET is_valid = FALSE,
         last_error = ?
     WHERE website_id = ?`,
    [error || 'Login failed', websiteId]
  );
  console.log('[SkillsetManager] Invalidated credentials for website:', websiteId);
}

/**
 * Get credential status for a website
 */
export function getCredentialStatus(websiteId: string): {
  hasCredentials: boolean;
  isValid: boolean;
  lastUsed?: Date;
  lastError?: string;
} | null {
  const row = queryOne<{
    is_valid: number;
    last_used_at: string;
    last_error: string;
  }>(
    `SELECT is_valid, last_used_at, last_error
     FROM skillset_credentials
     WHERE website_id = ?`,
    [websiteId]
  );

  if (!row) {
    return null;
  }

  return {
    hasCredentials: true,
    isValid: Boolean(row.is_valid),
    lastUsed: row.last_used_at ? new Date(row.last_used_at) : undefined,
    lastError: row.last_error || undefined,
  };
}
