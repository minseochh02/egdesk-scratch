# Scheduler Debug Guide

## Quick Diagnostic Steps

### Step 1: Check if Scheduler is Running
**Look for this log on startup:**
```
[FinanceHubScheduler] Started - Next sync at...
```

If missing → Scheduler disabled or failed to start

---

### Step 2: Check if Intents Are Being Created

**A. Check backfill (past 3 days):**
Look for:
```
[FinanceHubScheduler] Backfilling missing intents for last 3 days...
[FinanceHubScheduler] ✅ Backfilled X missing intent(s)
```

**B. Check today's scheduled intents:**
Look for:
```
[FinanceHubScheduler] card:nh scheduled for [date/time]
[FinanceHubScheduler] Scheduled X entities
```

If you see "Scheduled 0 entities" → No entities enabled in settings

---

### Step 3: Check Database Directly

**Open SQLite database:**
```bash
# Find database location
# Development: ./data/scheduler.db
# Production: ~/Library/Application Support/EGDesk/data/scheduler.db (Mac)
#            %APPDATA%/EGDesk/data/scheduler.db (Windows)

sqlite3 [path-to-db]/scheduler.db
```

**Query 1: Check if intents exist for today**
```sql
SELECT
  task_id,
  intended_date,
  intended_time,
  status,
  retry_count,
  error_message
FROM scheduler_execution_intents
WHERE intended_date = date('now')
ORDER BY intended_time;
```

**Expected:** Should see 14 rows (your entities) with status 'pending'

**Query 2: Check past 3 days**
```sql
SELECT
  intended_date,
  COUNT(*) as count,
  status
FROM scheduler_execution_intents
WHERE intended_date >= date('now', '-3 days')
GROUP BY intended_date, status
ORDER BY intended_date DESC;
```

**Expected:** Should see intents for today, yesterday, 2 days ago, 3 days ago

---

### Step 4: Check Recovery System

**Look for these logs 5 seconds after startup:**
```
🔄 Checking for missed scheduler executions...
[RecoveryService] 🔄 Starting recovery process...
[RecoveryService] Found X missed execution(s)
[RecoveryService] Deduplicated to Y unique entities
[RecoveryService] Will execute: Z, Will skip: W
```

**If you see "Found 0 missed executions":**
→ Either no intents exist OR they don't match the recovery query

---

### Step 5: Check Recovery Query Criteria

**Recovery only finds tasks where:**
1. `status IN ('pending', 'failed')` ✓
2. `intended_date >= [3 days ago]` ✓
3. `execution_window_end < now` ← **CHECK THIS!**
4. `retry_count < 5` ✓

**CRITICAL:** Recovery only finds tasks where the **execution window has passed**.

**For a task scheduled at 4:00 AM:**
- Execution window: 4:00 AM - 4:30 AM (30 minutes)
- Recovery will ONLY find it AFTER 4:30 AM

**If it's currently 3:00 AM:**
→ Today's 4:00 AM task won't be found (window hasn't passed yet)

---

### Step 6: Check hasRunToday Deduplication

**When a scheduled task runs, it checks:**
```typescript
const hasRun = await recoveryService.hasRunToday('financehub', entityKey);
if (hasRun) {
  console.log(`${entityKey} already synced today - skipping duplicate execution`);
  return;
}
```

**Look for this log:**
```
[FinanceHubScheduler] card:nh already synced today - skipping duplicate execution
```

If you see this → Task was already marked as 'completed' or 'running' for today

---

### Step 7: Manual Database Check for Today

**Check if today's intents exist and their status:**
```sql
SELECT
  task_id,
  intended_time,
  status,
  actual_started_at,
  actual_completed_at,
  error_message,
  execution_window_start,
  execution_window_end,
  datetime('now') as current_time
FROM scheduler_execution_intents
WHERE intended_date = date('now')
ORDER BY intended_time;
```

**Check each row:**
- If `status = 'completed'` → Already ran, won't retry ✓
- If `status = 'running'` → Stuck, should be reset to 'failed' after 1 hour
- If `status = 'pending'` AND `execution_window_end < current_time` → Should be in recovery
- If `status = 'pending'` AND `execution_window_end > current_time` → Waiting for scheduled time

---

## Common Issues

### Issue 1: "Recovery finds 0 tasks but I see pending intents"

**Likely Cause:** Execution window hasn't passed yet

**Check:**
```sql
SELECT
  task_id,
  intended_time,
  execution_window_end,
  datetime('now') as now,
  CASE
    WHEN execution_window_end < datetime('now') THEN 'Window passed ✓'
    ELSE 'Waiting for window'
  END as window_status
FROM scheduler_execution_intents
WHERE intended_date = date('now')
  AND status = 'pending';
```

---

### Issue 2: "Tasks scheduled but never execute"

**Check scheduler timer:**
- Look for: `[FinanceHubScheduler] Scheduled X entities`
- If X = 0 → Check settings, entities might be disabled

**Check if scheduler is actually running:**
```typescript
// Should see this every 30 minutes at scheduled times
[FinanceHubScheduler] Logging in to card:nh...
```

---

### Issue 3: "Tasks execute but fail immediately"

**Check for these errors:**
```
No saved credentials found for this card
Certificate not found in saved data
Login failed: ...
```

→ These are permanent errors, tasks will be marked 'skipped'

---

## Debug Commands to Run

**1. Check app logs:**
```bash
# Find log location based on platform
# Mac: ~/Library/Logs/EGDesk/
# Windows: %APPDATA%/EGDesk/logs/

tail -f [log-path]/main.log | grep -i scheduler
```

**2. Check database state:**
```bash
sqlite3 [db-path]/scheduler.db "SELECT COUNT(*), status FROM scheduler_execution_intents WHERE intended_date = date('now') GROUP BY status;"
```

**3. Force manual sync to test:**
Open app → Scheduler Status page → Click "Sync Now"

Watch logs for errors.

---

## What to Report Back

Please check and tell me:

1. **What time is it now?** (e.g., "3:00 PM")
2. **What's the scheduled time?** (e.g., "4:00 AM")
3. **Do you see backfill logs?** ("Backfilled X missing intents")
4. **Do you see recovery logs?** ("Found X missed executions")
5. **Database query results:** Run the "Check if intents exist for today" query
6. **Any error messages in logs?**

This will help me pinpoint exactly what's wrong!
