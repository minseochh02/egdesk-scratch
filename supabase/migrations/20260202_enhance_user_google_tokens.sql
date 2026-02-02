-- ============================================================================
-- Enhance user_google_tokens table for OAuth token migration
-- Migration Date: 2026-02-02
-- ============================================================================
-- This migration enhances the EXISTING user_google_tokens table with:
-- 1. Additional audit fields (last_refreshed_at, provider_email)
-- 2. Performance indexes
-- 3. Service role policy for Edge Functions
-- 4. Automatic updated_at trigger
--
-- NOTE: This assumes user_google_tokens table already exists with base fields:
--       id, user_id, provider, access_token, refresh_token, expires_at,
--       scopes, is_active, created_at, updated_at
-- ============================================================================

-- ============================================================================
-- Add missing columns (if not present)
-- ============================================================================

-- Core columns (ensure they exist)
ALTER TABLE user_google_tokens
ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();

ALTER TABLE user_google_tokens
ADD COLUMN IF NOT EXISTS user_id UUID;

ALTER TABLE user_google_tokens
ADD COLUMN IF NOT EXISTS access_token TEXT;

ALTER TABLE user_google_tokens
ADD COLUMN IF NOT EXISTS refresh_token TEXT;

ALTER TABLE user_google_tokens
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

ALTER TABLE user_google_tokens
ADD COLUMN IF NOT EXISTS scopes TEXT[];

ALTER TABLE user_google_tokens
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE user_google_tokens
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- New columns for migration
ALTER TABLE user_google_tokens
ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'google';

ALTER TABLE user_google_tokens
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

ALTER TABLE user_google_tokens
ADD COLUMN IF NOT EXISTS last_refreshed_at TIMESTAMPTZ;

ALTER TABLE user_google_tokens
ADD COLUMN IF NOT EXISTS provider_email TEXT;

-- Set id as primary key if not already set
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_google_tokens_pkey'
  ) THEN
    ALTER TABLE user_google_tokens ADD PRIMARY KEY (id);
  END IF;
END $$;

-- Add foreign key constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_google_tokens_user_id_fkey'
  ) THEN
    ALTER TABLE user_google_tokens
    ADD CONSTRAINT user_google_tokens_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add unique constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_google_tokens_user_id_provider_key'
  ) THEN
    ALTER TABLE user_google_tokens
    ADD CONSTRAINT user_google_tokens_user_id_provider_key
    UNIQUE(user_id, provider);
  END IF;
END $$;

-- ============================================================================
-- Add indexes for performance
-- ============================================================================

-- Index on expires_at for finding tokens that need refresh
CREATE INDEX IF NOT EXISTS idx_user_google_tokens_expires_at
  ON user_google_tokens(expires_at) WHERE is_active = true;

-- Index on user_id for faster lookups (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_user_google_tokens_user_id
  ON user_google_tokens(user_id) WHERE is_active = true;

-- Composite index for provider-specific queries
CREATE INDEX IF NOT EXISTS idx_user_google_tokens_user_provider
  ON user_google_tokens(user_id, provider) WHERE is_active = true;

-- ============================================================================
-- Row Level Security Policies
-- ============================================================================

-- Drop existing policies if they exist (to update them)
DROP POLICY IF EXISTS "Users can only access their own tokens" ON user_google_tokens;
DROP POLICY IF EXISTS "Service role full access" ON user_google_tokens;

-- Policy: Users can only access their own tokens
CREATE POLICY "Users can only access their own tokens"
  ON user_google_tokens
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Service role (Edge Functions) can access all tokens
CREATE POLICY "Service role full access"
  ON user_google_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Automatic updated_at trigger
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_google_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS set_user_google_tokens_updated_at ON user_google_tokens;

-- Create trigger
CREATE TRIGGER set_user_google_tokens_updated_at
  BEFORE UPDATE ON user_google_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_user_google_tokens_updated_at();

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE user_google_tokens IS 'Stores OAuth tokens for Google Workspace APIs (Sheets, Drive, Gmail)';
COMMENT ON COLUMN user_google_tokens.provider IS 'OAuth provider (google, github, etc.)';
COMMENT ON COLUMN user_google_tokens.access_token IS 'Short-lived OAuth access token';
COMMENT ON COLUMN user_google_tokens.refresh_token IS 'Long-lived refresh token for obtaining new access tokens';
COMMENT ON COLUMN user_google_tokens.expires_at IS 'Timestamp when access_token expires';
COMMENT ON COLUMN user_google_tokens.scopes IS 'Array of OAuth scopes granted';
COMMENT ON COLUMN user_google_tokens.is_active IS 'Whether this token is currently active';
COMMENT ON COLUMN user_google_tokens.last_refreshed_at IS 'Timestamp of last successful token refresh';
COMMENT ON COLUMN user_google_tokens.provider_email IS 'Email address from OAuth provider (for debugging)';

-- ============================================================================
-- Verification queries (for testing)
-- ============================================================================

-- Verify table structure
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'user_google_tokens'
-- ORDER BY ordinal_position;

-- Verify indexes
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'user_google_tokens';

-- Verify policies
-- SELECT policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'user_google_tokens';
