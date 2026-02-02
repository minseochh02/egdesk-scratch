/**
 * Token Storage Abstraction Layer
 *
 * This module provides a flexible abstraction for storing OAuth tokens,
 * supporting multiple backends (electron-store, Supabase) and migration strategies.
 *
 * Migration Phases:
 * - Phase 0: Electron-store only (legacy)
 * - Phase 1: Dual-write (write both, read electron-store)
 * - Phase 2: Supabase primary with fallback
 * - Phase 3: Supabase only (future)
 */

import { SupabaseClient } from '@supabase/supabase-js';
import Store from 'electron-store';

/**
 * Google Workspace OAuth token structure
 */
export interface GoogleWorkspaceToken {
  access_token: string;
  refresh_token?: string;
  expires_at: number; // Unix timestamp (seconds)
  scopes: string[];
  saved_at: number; // Unix timestamp (milliseconds)
}

/**
 * Token storage interface for different implementations
 */
export interface TokenStorage {
  /**
   * Save a Google OAuth token for a user
   * @param userId - User's unique identifier
   * @param token - Google Workspace token to save
   */
  saveGoogleToken(userId: string, token: GoogleWorkspaceToken): Promise<void>;

  /**
   * Get a Google OAuth token for a user
   * @param userId - User's unique identifier
   * @returns Token if found, null otherwise
   */
  getGoogleToken(userId: string): Promise<GoogleWorkspaceToken | null>;

  /**
   * Delete a Google OAuth token for a user
   * @param userId - User's unique identifier
   */
  deleteGoogleToken(userId: string): Promise<void>;
}

/**
 * Electron Store implementation (legacy/fallback)
 *
 * Stores tokens in encrypted local file:
 * ~/Library/Application Support/EGDesk-auth/config.json
 */
export class ElectronStoreTokenStorage implements TokenStorage {
  private store: Store;

  constructor(store: Store) {
    this.store = store;
  }

  async saveGoogleToken(userId: string, token: GoogleWorkspaceToken): Promise<void> {
    // Note: Current implementation stores a single token, not per-user
    // This is maintained for backward compatibility
    this.store.set('google_workspace_token', token);
    console.log('[ElectronStore] Saved Google Workspace token');
  }

  async getGoogleToken(userId: string): Promise<GoogleWorkspaceToken | null> {
    const token = this.store.get('google_workspace_token') as GoogleWorkspaceToken | undefined;

    if (!token) {
      console.log('[ElectronStore] No Google Workspace token found');
      return null;
    }

    return token;
  }

  async deleteGoogleToken(userId: string): Promise<void> {
    this.store.delete('google_workspace_token');
    console.log('[ElectronStore] Deleted Google Workspace token');
  }
}

/**
 * Supabase implementation (new, cloud-based)
 *
 * Stores tokens in Supabase database with:
 * - Cross-device sync
 * - Centralized management
 * - Audit trail
 * - In-memory caching (5-minute TTL)
 */
export class SupabaseTokenStorage implements TokenStorage {
  private supabase: SupabaseClient;
  private cache: Map<string, { token: GoogleWorkspaceToken; timestamp: number }>;
  private cacheMaxAge = 5 * 60 * 1000; // 5 minutes

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.cache = new Map();
  }

  /**
   * Note: This class assumes the Supabase client has the user's session set
   * before any operations. AuthService is responsible for calling
   * supabase.auth.setSession() before using this storage.
   */

  async saveGoogleToken(userId: string, token: GoogleWorkspaceToken): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('user_google_tokens')
        .upsert({
          user_id: userId,
          provider: 'google',
          access_token: token.access_token,
          refresh_token: token.refresh_token,
          expires_at: new Date(token.expires_at * 1000).toISOString(),
          scopes: token.scopes,
          is_active: true,
        }, {
          onConflict: 'user_id,provider',
        });

      if (error) {
        throw new Error(`Failed to save token to Supabase: ${error.message}`);
      }

      // Update cache
      this.cache.set(userId, { token, timestamp: Date.now() });
      console.log('[Supabase] Saved Google Workspace token');
    } catch (error: any) {
      console.error('[Supabase] Error saving token:', error);
      throw error;
    }
  }

  async getGoogleToken(userId: string): Promise<GoogleWorkspaceToken | null> {
    // Check cache first (performance optimization)
    const cached = this.cache.get(userId);
    if (cached && (Date.now() - cached.timestamp < this.cacheMaxAge)) {
      console.log('[Supabase] Using cached token');
      return cached.token;
    }

    try {
      // Fetch from Supabase
      // Note: RLS policy requires auth.uid() = user_id
      // AuthService sets the user session before calling this method
      const { data, error } = await this.supabase
        .from('user_google_tokens')
        .select('*')
        .eq('user_id', userId)
        .eq('provider', 'google')
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned - not an error, just no token
          console.log('[Supabase] No token found for user:', userId);
          return null;
        }
        console.error('[Supabase] Query error:', error);
        throw new Error(`Failed to fetch token from Supabase: ${error.message} (code: ${error.code})`);
      }

      if (!data) {
        console.log('[Supabase] No token found for user:', userId);
        return null;
      }

      const token: GoogleWorkspaceToken = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Math.floor(new Date(data.expires_at).getTime() / 1000),
        scopes: data.scopes || [],
        saved_at: Math.floor(new Date(data.created_at).getTime() / 1000),
      };

      // Update cache
      this.cache.set(userId, { token, timestamp: Date.now() });

      return token;
    } catch (error: any) {
      console.error('[Supabase] Error fetching token:', error);
      throw error;
    }
  }

  async deleteGoogleToken(userId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('user_google_tokens')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('provider', 'google');

      if (error) {
        throw new Error(`Failed to deactivate token in Supabase: ${error.message}`);
      }

      this.cache.delete(userId);
      console.log('[Supabase] Deactivated Google Workspace token');
    } catch (error: any) {
      console.error('[Supabase] Error deleting token:', error);
      throw error;
    }
  }

  /**
   * Clear the in-memory cache (useful for testing or manual refresh)
   */
  clearCache(): void {
    this.cache.clear();
    console.log('[Supabase] Cleared token cache');
  }
}

/**
 * Dual storage implementation (Phase 1 & 2)
 *
 * Supports migration from electron-store to Supabase:
 * - Phase 1: Write to both, read from electron-store (primary = electron-store)
 * - Phase 2: Write to both, read from Supabase with fallback (primary = Supabase)
 *
 * Auto-migration: If token found in fallback but not primary, copy to primary
 */
export class DualTokenStorage implements TokenStorage {
  private primary: TokenStorage;
  private fallback: TokenStorage;
  private writeToBoth: boolean;

  constructor(primary: TokenStorage, fallback: TokenStorage, writeToBoth = true) {
    this.primary = primary;
    this.fallback = fallback;
    this.writeToBoth = writeToBoth;
  }

  async saveGoogleToken(userId: string, token: GoogleWorkspaceToken): Promise<void> {
    // Always write to primary
    try {
      await this.primary.saveGoogleToken(userId, token);
    } catch (error) {
      console.error('[DualTokenStorage] Primary write failed:', error);
      throw error; // Primary write is critical
    }

    // Write to fallback if enabled (non-fatal if it fails)
    if (this.writeToBoth) {
      try {
        await this.fallback.saveGoogleToken(userId, token);
      } catch (error) {
        console.error('[DualTokenStorage] Fallback write failed (non-fatal):', error);
        // Continue - primary write succeeded
      }
    }
  }

  async getGoogleToken(userId: string): Promise<GoogleWorkspaceToken | null> {
    // Try primary first
    try {
      const token = await this.primary.getGoogleToken(userId);
      if (token) {
        return token;
      }
    } catch (error) {
      console.error('[DualTokenStorage] Primary read failed, trying fallback:', error);
    }

    // Fallback to secondary
    console.log('[DualTokenStorage] Using fallback storage');
    try {
      const token = await this.fallback.getGoogleToken(userId);

      if (!token) {
        return null;
      }

      // Auto-migrate: Write to primary if found in fallback
      try {
        await this.primary.saveGoogleToken(userId, token);
        console.log('[DualTokenStorage] Auto-migrated token to primary storage');
      } catch (error) {
        console.error('[DualTokenStorage] Auto-migration failed (non-fatal):', error);
        // Continue - we still have the token from fallback
      }

      return token;
    } catch (error) {
      console.error('[DualTokenStorage] Fallback read failed:', error);
      return null;
    }
  }

  async deleteGoogleToken(userId: string): Promise<void> {
    // Delete from both storages
    const errors: Error[] = [];

    try {
      await this.primary.deleteGoogleToken(userId);
    } catch (error: any) {
      console.error('[DualTokenStorage] Primary delete failed:', error);
      errors.push(error);
    }

    if (this.writeToBoth) {
      try {
        await this.fallback.deleteGoogleToken(userId);
      } catch (error: any) {
        console.error('[DualTokenStorage] Fallback delete failed:', error);
        errors.push(error);
      }
    }

    // Throw if both failed
    if (errors.length === 2) {
      throw new Error('Failed to delete from both storages');
    }
  }
}

/**
 * Factory function to create appropriate token storage based on migration phase
 *
 * @param store - Electron store instance
 * @param supabase - Supabase client instance (optional)
 * @param phase - Migration phase (0, 1, 2, or 3)
 * @returns TokenStorage implementation
 */
export function createTokenStorage(
  store: Store,
  supabase: SupabaseClient | null,
  phase: number = 1
): TokenStorage {
  const electronStore = new ElectronStoreTokenStorage(store);

  if (phase === 0 || !supabase) {
    // Phase 0: Electron-store only (legacy mode)
    console.log('🔧 Token Storage: Electron-store only (Phase 0)');
    return electronStore;
  }

  const supabaseStore = new SupabaseTokenStorage(supabase);

  if (phase === 1) {
    // Phase 1: Write to both, read from electron-store
    console.log('🔄 Token Storage: Phase 1 (Dual-write, electron-store primary)');
    return new DualTokenStorage(electronStore, supabaseStore, true);
  }

  if (phase === 2) {
    // Phase 2: Write to both, read from Supabase with fallback
    console.log('🔄 Token Storage: Phase 2 (Supabase primary with fallback)');
    return new DualTokenStorage(supabaseStore, electronStore, true);
  }

  if (phase === 3) {
    // Phase 3: Supabase only (future)
    console.log('☁️ Token Storage: Phase 3 (Supabase only)');
    return supabaseStore;
  }

  // Default: Phase 1
  console.log('🔄 Token Storage: Default Phase 1');
  return new DualTokenStorage(electronStore, supabaseStore, true);
}
