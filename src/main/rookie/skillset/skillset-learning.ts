/**
 * Learning and improvement logic for Skillset System
 * Handles confidence scoring, feedback processing, and auto-improvement
 */

import {
  getCapability,
  recordSuccess,
  recordFailure,
  updateConfidence,
  getCapabilities,
  updateWebsiteConfidence,
} from './skillset-manager';
import { ExecutionFeedback } from './types';

const LEARNING_RATE = 0.1;
const LOW_CONFIDENCE_THRESHOLD = 0.3;
const STALE_THRESHOLD_DAYS = 7;

/**
 * Process execution feedback from EXECUTOR
 */
export function processExecutionFeedback(feedback: ExecutionFeedback): void {
  console.log('[Skillset Learning] Processing feedback:', feedback);

  if (feedback.success) {
    recordSuccess(feedback.capabilityId, feedback.pathId);
  } else {
    recordFailure(feedback.capabilityId, feedback.pathId);

    // Check if we need to trigger re-verification
    const capability = getCapability(feedback.capabilityId);
    if (capability && shouldReVerify(capability)) {
      console.log('[Skillset Learning] Capability needs re-verification:', capability.section);
      // TODO: Trigger re-verification (Phase 5)
    }
  }

  // Update website overall confidence
  updateWebsiteConfidence(feedback.websiteId);
}

/**
 * Process multiple execution results at once
 */
export function processExecutionResults(results: ExecutionFeedback[]): void {
  for (const result of results) {
    processExecutionFeedback(result);
  }
}

/**
 * Determine if a capability should be re-verified
 */
function shouldReVerify(capability: any): boolean {
  // Re-verify if:
  // 1. Confidence dropped below threshold AND
  // 2. Has failed at least twice
  return (
    capability.confidence < LOW_CONFIDENCE_THRESHOLD &&
    capability.failedNavigations >= 2
  );
}

/**
 * Calculate new confidence score based on outcome
 */
export function calculateNewConfidence(
  currentConfidence: number,
  outcome: 'success' | 'failure'
): number {
  if (outcome === 'success') {
    // Asymptotic increase toward 1.0
    return currentConfidence + (1 - currentConfidence) * LEARNING_RATE;
  } else {
    // Faster decay
    return currentConfidence * (1 - LEARNING_RATE * 2);
  }
}

/**
 * Detect stale capabilities that need verification
 */
export function detectStaleCapabilities(websiteId: string): string[] {
  const capabilities = getCapabilities(websiteId);
  const now = Date.now();
  const staleThreshold = STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

  const staleCapabilityIds: string[] = [];

  for (const cap of capabilities) {
    if (!cap.lastVerifiedAt) {
      continue;
    }

    const timeSinceVerification = now - cap.lastVerifiedAt.getTime();

    if (
      timeSinceVerification > staleThreshold &&
      cap.confidence > LOW_CONFIDENCE_THRESHOLD
    ) {
      staleCapabilityIds.push(cap.id);
    }
  }

  console.log(
    `[Skillset Learning] Found ${staleCapabilityIds.length} stale capabilities`
  );

  return staleCapabilityIds;
}

/**
 * Get health status of a website's skillset
 */
export function getWebsiteHealth(websiteId: string): {
  status: 'excellent' | 'good' | 'needs-update' | 'poor';
  overallConfidence: number;
  staleCount: number;
  lowConfidenceCount: number;
  recentFailures: number;
} {
  const capabilities = getCapabilities(websiteId);

  if (capabilities.length === 0) {
    return {
      status: 'poor',
      overallConfidence: 0,
      staleCount: 0,
      lowConfidenceCount: 0,
      recentFailures: 0,
    };
  }

  const totalConfidence = capabilities.reduce((sum, cap) => sum + cap.confidence, 0);
  const overallConfidence = totalConfidence / capabilities.length;

  const now = Date.now();
  const staleThreshold = STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

  let staleCount = 0;
  let lowConfidenceCount = 0;
  let recentFailures = 0;

  for (const cap of capabilities) {
    // Check staleness
    if (cap.lastVerifiedAt) {
      const timeSinceVerification = now - cap.lastVerifiedAt.getTime();
      if (timeSinceVerification > staleThreshold) {
        staleCount++;
      }
    }

    // Check low confidence
    if (cap.confidence < LOW_CONFIDENCE_THRESHOLD) {
      lowConfidenceCount++;
    }

    // Check recent failures (failed more than succeeded)
    if (cap.failedNavigations > cap.successfulNavigations) {
      recentFailures++;
    }
  }

  let status: 'excellent' | 'good' | 'needs-update' | 'poor';
  if (overallConfidence >= 0.9 && staleCount === 0 && lowConfidenceCount === 0) {
    status = 'excellent';
  } else if (overallConfidence >= 0.7 && lowConfidenceCount <= 2) {
    status = 'good';
  } else if (overallConfidence >= 0.5 || staleCount > 5) {
    status = 'needs-update';
  } else {
    status = 'poor';
  }

  return {
    status,
    overallConfidence,
    staleCount,
    lowConfidenceCount,
    recentFailures,
  };
}

/**
 * Get recommendations for improving a website's skillset
 */
export function getImprovementRecommendations(websiteId: string): string[] {
  const health = getWebsiteHealth(websiteId);
  const recommendations: string[] = [];

  if (health.lowConfidenceCount > 0) {
    recommendations.push(
      `${health.lowConfidenceCount} capabilities have low confidence - consider re-verification`
    );
  }

  if (health.staleCount > 5) {
    recommendations.push(
      `${health.staleCount} capabilities haven't been verified recently - run verification check`
    );
  }

  if (health.recentFailures > 0) {
    recommendations.push(
      `${health.recentFailures} capabilities have more failures than successes - may need updating`
    );
  }

  if (health.overallConfidence < 0.5) {
    recommendations.push(
      'Overall confidence is low - consider full re-exploration'
    );
  }

  if (recommendations.length === 0) {
    recommendations.push('Skillset is healthy - no immediate action needed');
  }

  return recommendations;
}

/**
 * Calculate path stability score (0-1)
 * Higher score = more stable paths
 */
export function calculatePathStability(websiteId: string): number {
  const capabilities = getCapabilities(websiteId);

  if (capabilities.length === 0) return 0;

  let totalStability = 0;

  for (const cap of capabilities) {
    const total = cap.successfulNavigations + cap.failedNavigations;
    if (total === 0) {
      totalStability += 0.5; // Neutral for untested
    } else {
      const successRate = cap.successfulNavigations / total;
      totalStability += successRate;
    }
  }

  return totalStability / capabilities.length;
}

/**
 * Suggest when to re-explore a website
 */
export function shouldReExploreWebsite(websiteId: string): {
  shouldReExplore: boolean;
  reason?: string;
} {
  const health = getWebsiteHealth(websiteId);
  const capabilities = getCapabilities(websiteId);

  // Re-explore if overall confidence is very low
  if (health.overallConfidence < 0.4) {
    return {
      shouldReExplore: true,
      reason: 'Overall confidence is critically low',
    };
  }

  // Re-explore if more than 30% of capabilities have changed
  const changedCount = capabilities.filter((cap) => cap.hasChanged).length;
  const changeRate = changedCount / capabilities.length;

  if (changeRate > 0.3) {
    return {
      shouldReExplore: true,
      reason: `${Math.round(changeRate * 100)}% of capabilities have changed`,
    };
  }

  // Re-explore if most capabilities are stale
  if (health.staleCount > capabilities.length * 0.5) {
    return {
      shouldReExplore: true,
      reason: 'More than 50% of capabilities are stale',
    };
  }

  return { shouldReExplore: false };
}
