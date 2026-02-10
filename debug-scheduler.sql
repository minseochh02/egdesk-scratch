-- ============================================
-- SCHEDULER DEBUG QUERIES
-- ============================================
-- Run these queries in the scheduler database to diagnose issues
-- Database location:
--   Mac: ~/Library/Application Support/EGDesk/data/scheduler.db
--   Windows: %APPDATA%/EGDesk/data/scheduler.db

-- ============================================
-- QUERY 1: Check TODAY's tasks and their status
-- ============================================
SELECT
  task_id,
  intended_time,
  status,
  execution_window_end,
  datetime('now', 'localtime') as current_time,
  CASE
    WHEN execution_window_end < datetime('now') THEN '✓ Window passed - Should be in recovery'
    ELSE '⏳ Waiting for scheduled time'
  END as window_status,
  retry_count,
  error_message
FROM scheduler_execution_intents
WHERE intended_date = date('now')
ORDER BY intended_time;

-- ============================================
-- QUERY 2: Check MISSED tasks (should be recovered)
-- ============================================
SELECT
  task_id,
  intended_date,
  intended_time,
  status,
  retry_count,
  error_message,
  execution_window_end
FROM scheduler_execution_intents
WHERE status IN ('pending', 'failed')
  AND intended_date >= date('now', '-3 days')
  AND execution_window_end < datetime('now')
  AND COALESCE(retry_count, 0) < 5
ORDER BY intended_date ASC, intended_time ASC;

-- ============================================
-- QUERY 3: Count tasks by status (last 3 days)
-- ============================================
SELECT
  intended_date,
  status,
  COUNT(*) as count
FROM scheduler_execution_intents
WHERE intended_date >= date('now', '-3 days')
GROUP BY intended_date, status
ORDER BY intended_date DESC, status;

-- ============================================
-- QUERY 4: Check for stuck 'running' tasks
-- ============================================
SELECT
  task_id,
  intended_date,
  intended_time,
  actual_started_at,
  datetime('now') as current_time,
  ROUND((julianday('now') - julianday(actual_started_at)) * 24, 2) as hours_running
FROM scheduler_execution_intents
WHERE status = 'running'
ORDER BY actual_started_at;

-- ============================================
-- QUERY 5: Check if ANY intents exist (basic sanity check)
-- ============================================
SELECT COUNT(*) as total_intents FROM scheduler_execution_intents;

-- ============================================
-- QUERY 6: Check latest intents created
-- ============================================
SELECT
  task_id,
  intended_date,
  intended_time,
  status,
  created_at
FROM scheduler_execution_intents
ORDER BY created_at DESC
LIMIT 20;
