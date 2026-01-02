// ============================================================================
// useSessionManager Hook
// Manages bank session status monitoring in the frontend
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface SessionStatus {
  exists: boolean;
  status: 'none' | 'active' | 'extending' | 'expired' | 'error';
  isHealthy: boolean;
  userName?: string;
  accounts?: any[];
  createdAt?: number;
  lastActivityAt?: number;
  lastExtendedAt?: number;
  extendCount?: number;
  timeSinceExtendMs?: number;
  timeSinceActivityMs?: number;
  nextExtendInMs?: number;
}

export interface ConnectedBank {
  bankId: string;
  userName: string | null;
  accounts: any[];
  status: 'active' | 'extending' | 'expired' | 'error';
  isHealthy: boolean;
  createdAt: number;
  lastActivityAt: number;
  lastExtendedAt: number;
  extendCount: number;
}

export interface UseSessionManagerReturn {
  // Data
  sessions: Map<string, SessionStatus>;
  connectedBanks: ConnectedBank[];
  
  // Status checks
  isSessionActive: (bankId: string) => boolean;
  getSessionStatus: (bankId: string) => SessionStatus;
  
  // Actions
  refreshSessions: () => Promise<void>;
  extendSession: (bankId: string) => Promise<boolean>;
  
  // State
  isLoading: boolean;
  lastRefreshAt: number | null;
}

// ============================================================================
// Constants
// ============================================================================

const POLLING_INTERVAL_MS = 30 * 1000; // Poll every 30 seconds
const STALE_THRESHOLD_MS = 60 * 1000; // Consider data stale after 1 minute

// ============================================================================
// Hook Implementation
// ============================================================================

export function useSessionManager(): UseSessionManagerReturn {
  const [sessions, setSessions] = useState<Map<string, SessionStatus>>(new Map());
  const [connectedBanks, setConnectedBanks] = useState<ConnectedBank[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null);
  
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // ============================================================================
  // Session Status Fetching
  // ============================================================================

  /**
   * Fetch session status for a specific bank
   */
  const fetchSessionStatus = useCallback(async (bankId: string): Promise<SessionStatus> => {
    try {
      const status = await window.electron.financeHub.getSessionStatus(bankId);
      return status;
    } catch (error) {
      console.error(`[useSessionManager] Failed to fetch session status for ${bankId}:`, error);
      return {
        exists: false,
        status: 'error',
        isHealthy: false,
      };
    }
  }, []);

  /**
   * Fetch all connected banks
   */
  const fetchConnectedBanks = useCallback(async (): Promise<ConnectedBank[]> => {
    try {
      const banks = await window.electron.financeHub.getConnectedBanks();
      return banks || [];
    } catch (error) {
      console.error('[useSessionManager] Failed to fetch connected banks:', error);
      return [];
    }
  }, []);

  /**
   * Refresh all session data
   */
  const refreshSessions = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    setIsLoading(true);
    
    try {
      // Fetch connected banks
      const banks = await fetchConnectedBanks();
      
      if (!isMountedRef.current) return;
      
      setConnectedBanks(banks);
      
      // Build sessions map
      const newSessions = new Map<string, SessionStatus>();
      
      for (const bank of banks) {
        newSessions.set(bank.bankId, {
          exists: true,
          status: bank.status,
          isHealthy: bank.isHealthy,
          userName: bank.userName || undefined,
          accounts: bank.accounts,
          createdAt: bank.createdAt,
          lastActivityAt: bank.lastActivityAt,
          lastExtendedAt: bank.lastExtendedAt,
          extendCount: bank.extendCount,
        });
      }
      
      setSessions(newSessions);
      setLastRefreshAt(Date.now());
      
    } catch (error) {
      console.error('[useSessionManager] Refresh failed:', error);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [fetchConnectedBanks]);

  // ============================================================================
  // Session Checks
  // ============================================================================

  /**
   * Check if a session is active
   */
  const isSessionActive = useCallback((bankId: string): boolean => {
    const session = sessions.get(bankId);
    if (!session) return false;
    return session.isHealthy && (session.status === 'active' || session.status === 'extending');
  }, [sessions]);

  /**
   * Get session status for a bank
   */
  const getSessionStatus = useCallback((bankId: string): SessionStatus => {
    return sessions.get(bankId) || {
      exists: false,
      status: 'none',
      isHealthy: false,
    };
  }, [sessions]);

  // ============================================================================
  // Session Actions
  // ============================================================================

  /**
   * Manually extend a session
   */
  const extendSession = useCallback(async (bankId: string): Promise<boolean> => {
    try {
      const result = await window.electron.financeHub.extendSession(bankId);
      
      if (result.success) {
        // Update local state
        setSessions(prev => {
          const newSessions = new Map(prev);
          const session = newSessions.get(bankId);
          if (session) {
            newSessions.set(bankId, {
              ...session,
              status: 'active',
              lastExtendedAt: Date.now(),
              extendCount: (session.extendCount || 0) + 1,
            });
          }
          return newSessions;
        });
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`[useSessionManager] Failed to extend session for ${bankId}:`, error);
      return false;
    }
  }, []);

  // ============================================================================
  // Polling
  // ============================================================================

  /**
   * Start polling for session updates
   */
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    pollingIntervalRef.current = setInterval(() => {
      refreshSessions();
    }, POLLING_INTERVAL_MS);
    
    console.log('[useSessionManager] Started polling for session updates');
  }, [refreshSessions]);

  /**
   * Stop polling
   */
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      console.log('[useSessionManager] Stopped polling');
    }
  }, []);

  // ============================================================================
  // Lifecycle
  // ============================================================================

  useEffect(() => {
    isMountedRef.current = true;
    
    // Initial fetch
    refreshSessions();
    
    // Start polling
    startPolling();
    
    return () => {
      isMountedRef.current = false;
      stopPolling();
    };
  }, [refreshSessions, startPolling, stopPolling]);

  // ============================================================================
  // Return
  // ============================================================================

  return {
    sessions,
    connectedBanks,
    isSessionActive,
    getSessionStatus,
    refreshSessions,
    extendSession,
    isLoading,
    lastRefreshAt,
  };
}

export default useSessionManager;
