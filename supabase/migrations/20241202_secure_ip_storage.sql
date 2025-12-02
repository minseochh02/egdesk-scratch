-- 1. Change owner_ip to TEXT to support hashing
-- Note: If you have existing data that is valid INET, this might require a cast.
-- Since we are moving to hashes, existing INET data will be invalid/plaintext.
-- We will just cast it to text for now.
ALTER TABLE mcp_servers 
ALTER COLUMN owner_ip TYPE text USING owner_ip::text;

-- 2. Add owner_ip_salt column
ALTER TABLE mcp_servers 
ADD COLUMN IF NOT EXISTS owner_ip_salt text;

-- 3. Enable RLS (if not already enabled)
ALTER TABLE mcp_servers ENABLE ROW LEVEL SECURITY;

-- 4. Security: Restrict access to sensitive columns
-- Revoke direct UPDATE/INSERT access to these columns from authenticated users
-- The Edge Function (Service Role) will handle these fields.
REVOKE UPDATE (owner_ip, owner_ip_salt) ON TABLE mcp_servers FROM authenticated;
REVOKE INSERT (owner_ip, owner_ip_salt) ON TABLE mcp_servers FROM authenticated;

-- Ensure Service Role has full access
GRANT ALL ON TABLE mcp_servers TO service_role;
