-- ============================================================================
-- Add unique constraint for upsert operations
-- Migration Date: 2026-02-02
-- ============================================================================
-- This adds a UNIQUE constraint on (user_id, provider) to support upsert operations

-- Check if constraint already exists, if not add it
DO $$
BEGIN
  -- Check if the constraint exists
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_google_tokens_user_id_provider_key'
      AND conrelid = 'user_google_tokens'::regclass
  ) THEN
    -- Add the unique constraint
    ALTER TABLE user_google_tokens
    ADD CONSTRAINT user_google_tokens_user_id_provider_key
    UNIQUE(user_id, provider);

    RAISE NOTICE 'Added unique constraint: user_google_tokens_user_id_provider_key';
  ELSE
    RAISE NOTICE 'Unique constraint already exists: user_google_tokens_user_id_provider_key';
  END IF;
END $$;

-- Verify the constraint was added
DO $$
DECLARE
  constraint_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO constraint_count
  FROM pg_constraint
  WHERE conname = 'user_google_tokens_user_id_provider_key'
    AND conrelid = 'user_google_tokens'::regclass;

  IF constraint_count > 0 THEN
    RAISE NOTICE '✅ Verification passed: Unique constraint exists';
  ELSE
    RAISE EXCEPTION '❌ Verification failed: Unique constraint not found';
  END IF;
END $$;
