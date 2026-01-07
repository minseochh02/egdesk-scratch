import React, { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook to check and request Full Disk Access on macOS
 */
export function useFullDiskAccess() {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if running on macOS
  const isMacOS = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  // Check Full Disk Access
  const checkAccess = useCallback(async () => {
    if (!isMacOS) {
      setHasAccess(true);
      return true;
    }

    setIsChecking(true);
    setError(null);

    try {
      const result = await window.electron.fullDiskAccess.check();
      if (result.success) {
        setHasAccess(result.hasAccess || false);
        return result.hasAccess || false;
      } else {
        setError(result.error || 'Failed to check Full Disk Access');
        return false;
      }
    } catch (err) {
      console.error('[useFullDiskAccess] Check error:', err);
      setError('Failed to check Full Disk Access');
      return false;
    } finally {
      setIsChecking(false);
    }
  }, [isMacOS]);

  // Request Full Disk Access
  const requestAccess = useCallback(async (): Promise<{ success: boolean; userOpened?: boolean; error?: string }> => {
    if (!isMacOS) {
      return { success: true, userOpened: false };
    }

    try {
      const result = await window.electron.fullDiskAccess.request();
      if (result.success && result.userOpened) {
        // User opened System Preferences, they'll need to restart the app
        return { success: true, userOpened: true };
      }
      return result;
    } catch (err) {
      console.error('[useFullDiskAccess] Request error:', err);
      return { success: false, error: 'Failed to request Full Disk Access' };
    }
  }, [isMacOS]);

  // Check on mount
  useEffect(() => {
    checkAccess();
  }, [checkAccess]);

  return {
    hasAccess,
    isChecking,
    error,
    checkAccess,
    requestAccess,
    isMacOS,
  };
}

/**
 * Component-friendly wrapper that shows a warning when Full Disk Access is not granted
 */
export function FullDiskAccessWarning({ onRequestAccess }: { onRequestAccess?: () => void }) {
  const { hasAccess, isChecking, requestAccess, isMacOS } = useFullDiskAccess();

  if (!isMacOS || isChecking || hasAccess === null || hasAccess) {
    return null;
  }

  const handleRequestAccess = async () => {
    const result = await requestAccess();
    if (result && result.userOpened) {
      onRequestAccess?.();
    }
  };

  return (
    <div style={{
      backgroundColor: '#fff3cd',
      border: '1px solid #ffeaa7',
      borderRadius: '4px',
      padding: '12px 16px',
      margin: '8px 0',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      fontSize: '14px',
      color: '#856404'
    }}>
      <span>⚠️</span>
      <span style={{ flex: 1 }}>
        Some features may not work properly without Full Disk Access.
      </span>
      <button
        onClick={handleRequestAccess}
        style={{
          backgroundColor: '#ffc107',
          color: '#212529',
          border: 'none',
          borderRadius: '4px',
          padding: '6px 12px',
          fontSize: '14px',
          cursor: 'pointer',
          fontWeight: '500'
        }}
      >
        Grant Access
      </button>
    </div>
  );
}