/**
 * TypeScript interfaces for the Skillset System
 * Persistent website knowledge base for ROOKIE
 */

export interface WebsiteSkillset {
  id: string;
  url: string;
  domain: string;
  siteName: string;
  siteType?: string;

  // Authentication
  loginMethod?: LoginMethod;

  // Timestamps
  createdAt: Date;
  lastExploredAt?: Date;
  lastUsedAt?: Date;

  // Counters
  explorationCount: number;
  usageCount: number;

  // Health metrics
  overallConfidence: number;
  staleCount: number;

  // User annotations
  tags?: string[];
  notes?: string;
}

export interface LoginMethod {
  type: 'multi-field' | 'simple' | 'sso';
  fields: LoginField[];
  submitButtonSignature?: ElementSignature;
}

export interface LoginField {
  name: string;
  type: 'text' | 'password';
  elementSignature: ElementSignature;
}

/**
 * Stored credential with selector information
 */
export interface StoredCredential {
  fieldName: string;
  value: string;
  selector: {
    elementId?: string;
    role?: string;
    name?: string;
    type: string;
    xpath?: string;
  };
}

/**
 * Complete credential storage structure
 */
export interface CredentialStorage {
  credentials: StoredCredential[];
  submitButton?: {
    elementId?: string;
    role?: string;
    name?: string;
  };
}

export interface CapabilityRecord {
  id: string;
  websiteId: string;

  // What this capability provides
  section: string;
  description: string;
  dataAvailable: string[];

  // Discovery info
  discoveredAt: Date;
  discoveredBy: 'EXPLORER' | 'RESEARCHER' | 'MANUAL';

  // Learning metrics
  confidence: number;
  successfulNavigations: number;
  failedNavigations: number;
  lastAccessedAt?: Date;
  lastVerifiedAt?: Date;

  // Change tracking
  hasChanged: boolean;

  // Usage context
  usedInReports?: string[];
}

export interface NavigationPath {
  id: string;
  capabilityId: string;

  // The path
  steps: NavigationStep[];

  // Reliability
  confidence: number;
  successCount: number;
  failureCount: number;
  lastSuccessAt?: Date;
  lastFailureAt?: Date;

  // Context
  requiresFilters: boolean;
  filterInstructions?: string;
  estimatedTimeMs?: number;

  // Ranking
  isPrimary: boolean;
  isDeprecated: boolean;
}

export interface NavigationStep {
  order: number;
  action: 'click' | 'fill' | 'wait';
  elementSignature: ElementSignature;
  expectedResult: string;
}

export interface ElementSignature {
  // Semantic locators (preferred - most stable)
  role?: string;
  name?: string;
  ariaLabel?: string;

  // Fallback locators (less stable)
  xpath?: string;
  cssSelector?: string;

  // Alternative signatures
  alternates?: Array<{
    role?: string;
    name?: string;
    confidence: number;
  }>;

  // Reliability metrics
  reliability: number;
  lastWorkedAt?: Date;
  lastFailedAt?: Date;
}

export interface ExplorationLog {
  id: string;
  websiteId: string;
  exploredAt: Date;
  method: 'EXPLORER' | 'RESEARCHER' | 'VERIFICATION';
  capabilitiesFound: number;
  toolCallsUsed: number;
  executionTimeMs: number;
  newCapabilities: number;
  updatedCapabilities: number;
  removedCapabilities: number;
  logFilePath?: string;
}

// Query options
export interface CapabilityQueryOptions {
  websiteId?: string;
  section?: string;
  minConfidence?: number;
  maxConfidence?: number;
  hasChanged?: boolean;
  orderBy?: 'confidence' | 'lastAccessed' | 'section';
  orderDirection?: 'ASC' | 'DESC';
  limit?: number;
}

// Learning feedback
export interface ExecutionFeedback {
  websiteId: string;
  capabilityId: string;
  pathId: string;
  success: boolean;
  errorMessage?: string;
  executionTimeMs?: number;
}

// For EXPLORER integration
export interface ExplorerCapability {
  section: string;
  description: string;
  path: string;
  dataAvailable: string[];
  excelDownloadAvailable?: boolean;
  excelButtonSelector?: string;
}

export interface ExplorerResult {
  siteName: string;
  siteType: string;
  loginFields: LoginField[];
  capabilities: ExplorerCapability[];
  totalToolCalls: number;
  executionTimeMs: number;
}
