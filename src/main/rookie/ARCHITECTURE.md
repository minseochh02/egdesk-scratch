# Rookie Architecture - Learning from OpenClaw

## Overview
This document outlines the Rookie architecture based on learnings from OpenClaw's agent management system.

---

## OpenClaw's Agent Management Approach

### 1. **Session Management**
OpenClaw uses a comprehensive session system:

```typescript
type SessionEntry = {
  sessionId: string;
  updatedAt: number;
  sessionFile?: string;
  spawnedBy?: string;  // Parent session tracking

  // Execution context
  providerOverride?: string;
  modelOverride?: string;
  execHost?: string;

  // Usage tracking
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  compactionCount?: number;

  // State management
  abortedLastRun?: boolean;
  systemSent?: boolean;

  // Delivery/routing context
  deliveryContext?: DeliveryContext;
  lastChannel?: string;

  // CLI session tracking (for different providers)
  cliSessionIds?: Record<string, string>;
}
```

**Key Features:**
- File-based persistence (JSON5 format)
- In-memory caching with TTL (45 seconds default)
- Session metadata tracks execution state
- Support for multiple providers/backends
- Parent-child session tracking for sub-agents

### 2. **Session Storage**
```typescript
// Cache structure
type SessionStoreCacheEntry = {
  store: Record<string, SessionEntry>;
  loadedAt: number;
  storePath: string;
  mtimeMs?: number;
};

// Global cache with TTL
const SESSION_STORE_CACHE = new Map<string, SessionStoreCacheEntry>();
```

**Storage Strategy:**
- Sessions stored in `~/.openclaw/sessions/<sessionKey>.json`
- Cached in memory for performance
- File mtime checking to detect external changes
- Automatic cache invalidation after TTL

### 3. **Agent Execution Flow**
```
User Request
    ↓
CLI Runner (cli-runner.ts)
    ↓
Backend Resolution (claude-cli, aider, etc.)
    ↓
Session Resolution/Creation
    ↓
Pi Embedded Runner (pi-embedded-runner.ts)
    ↓
Agent Loop (with tools/streaming)
    ↓
Session Update + Response
```

**Key Components:**
- **CLI Runner**: Orchestrates execution, resolves config
- **Backend Config**: Provider-specific settings (Claude CLI, Aider, etc.)
- **Session Manager**: Loads/saves session state
- **Embedded Runner**: Actual agent loop with tools
- **Stream Handler**: Real-time response streaming

---

## Translating to Rookie Architecture

### Database Schema Design

Based on OpenClaw's session structure, here's a proposed Rookie schema:

```sql
-- Rook workflows (the automation definitions)
CREATE TABLE rooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,

  -- Goal file (Excel/PDF template)
  goal_file_path TEXT,
  goal_file_type TEXT CHECK (goal_file_type IN ('excel', 'pdf', 'both')),

  -- Workflow definition
  workflow_steps JSONB,  -- Array of step descriptions

  -- Resources (sites/apps used)
  resources JSONB,  -- Array of {name, type, url/path}

  -- Recording data
  recording_file_path TEXT,  -- Path to .rook file with screen recordings

  -- Execution state
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'failed', 'draft')),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,

  -- Analytics
  total_runs INTEGER DEFAULT 0,
  successful_runs INTEGER DEFAULT 0,
  failed_runs INTEGER DEFAULT 0,
  last_run_at TIMESTAMPTZ
);

-- Rook execution sessions (similar to OpenClaw's SessionEntry)
CREATE TABLE rook_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rook_id UUID REFERENCES rooks(id) ON DELETE CASCADE,

  -- Session identification
  session_key TEXT UNIQUE,  -- Human-readable key like "monthly-report-2024-02"

  -- Execution context
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),

  -- Recording/playback
  recording_data JSONB,  -- Screen recordings, mouse movements, clicks

  -- Error tracking
  error_message TEXT,
  error_stack TEXT,
  failed_at_step INTEGER,

  -- Output files
  output_file_path TEXT,
  output_file_url TEXT,

  -- Analytics
  duration_ms INTEGER,
  steps_completed INTEGER,

  -- Metadata
  triggered_by TEXT,  -- 'manual' | 'schedule' | 'api'
  metadata JSONB  -- Extra context
);

-- Rook session logs (detailed step-by-step logs)
CREATE TABLE rook_session_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES rook_sessions(id) ON DELETE CASCADE,

  -- Step tracking
  step_number INTEGER NOT NULL,
  step_description TEXT,

  -- Execution details
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'skipped')),

  -- Action details
  action_type TEXT,  -- 'click', 'type', 'navigate', 'wait', 'extract', etc.
  action_data JSONB,  -- {selector, value, screenshot_url, etc.}

  -- Error details
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Screenshots/evidence
  screenshot_before_url TEXT,
  screenshot_after_url TEXT,

  UNIQUE (session_id, step_number)
);

-- Rook schedules (for automated runs)
CREATE TABLE rook_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rook_id UUID REFERENCES rooks(id) ON DELETE CASCADE,

  -- Schedule definition
  cron_expression TEXT NOT NULL,  -- e.g., "0 9 * * 1" (every Monday at 9 AM)
  timezone TEXT DEFAULT 'UTC',

  -- Execution window
  enabled BOOLEAN DEFAULT true,
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,

  -- Notifications
  notify_on_success BOOLEAN DEFAULT false,
  notify_on_failure BOOLEAN DEFAULT true,
  notification_channels JSONB,  -- {email, slack, discord, etc.}

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_rooks_status ON rooks(status);
CREATE INDEX idx_rook_sessions_rook_id ON rook_sessions(rook_id);
CREATE INDEX idx_rook_sessions_status ON rook_sessions(status);
CREATE INDEX idx_rook_session_logs_session_id ON rook_session_logs(session_id);
CREATE INDEX idx_rook_schedules_next_run ON rook_schedules(next_run_at) WHERE enabled = true;
```

---

## Implementation Strategy

### Phase 1: Core Data Models (Current Phase)
✅ Database schema design (above)
- [ ] Create Supabase migrations
- [ ] Add TypeScript types matching schema
- [ ] Create CRUD operations for rooks

### Phase 2: Recording Integration
- [ ] Desktop recorder hooks (screen capture, mouse tracking)
- [ ] Save recordings to `.rook` files
- [ ] Associate recordings with rook_sessions
- [ ] Screenshot capture at each step

### Phase 3: Playback Engine
- [ ] Parse `.rook` recording files
- [ ] Desktop automation manager (similar to OpenClaw's cli-runner)
- [ ] Step-by-step execution with error handling
- [ ] Real-time progress updates to UI

### Phase 4: Scheduler & Monitoring
- [ ] Cron-based scheduler
- [ ] Session monitoring dashboard
- [ ] Error reporting & retry logic
- [ ] Success/failure notifications

---

## Key Differences from OpenClaw

| Aspect | OpenClaw | Rookie |
|--------|----------|--------|
| **Purpose** | CLI tool for AI conversations | Desktop automation for repetitive tasks |
| **Session Type** | Text-based chat sessions | Screen recording + playback sessions |
| **Storage** | File-based (JSON5) | Database (Supabase) |
| **Execution** | LLM API calls (Claude, etc.) | Desktop automation (clicks, typing, navigation) |
| **State** | Conversation history + metadata | Workflow steps + recording data |
| **Output** | Text responses | Excel/PDF files |

---

## Similarities We Can Leverage

1. **Session Management Pattern**
   - Use similar session lifecycle (created → running → completed/failed)
   - Track metadata (duration, status, errors)
   - Support session resumption

2. **Caching Strategy**
   - Cache frequently accessed rooks in memory
   - Use TTL-based invalidation
   - File mtime checking for external changes

3. **Error Handling**
   - Track failure reasons
   - Support retry logic
   - Log detailed error context

4. **Modular Architecture**
   - Separate concerns (recording, playback, storage)
   - Plugin-like resource handlers (web, desktop apps)
   - Extensible workflow steps

---

## Next Steps

1. **Create Database Migrations**
   ```bash
   supabase migration new create_rooks_tables
   ```

2. **Add TypeScript Types**
   ```typescript
   export interface Rook {
     id: string;
     name: string;
     goalFilePath?: string;
     // ... match schema
   }
   ```

3. **Build IPC Handlers**
   ```typescript
   ipcMain.handle('rookie:create-rook', async (event, data) => {
     // Insert into database
   });
   ```

4. **Connect Analysis UI to Backend**
   - Wire "Start Recording" button to IPC
   - Create rook in database
   - Launch desktop recorder

---

## References

- OpenClaw Session Types: `/openclaw/src/config/sessions/types.ts`
- OpenClaw Session Store: `/openclaw/src/config/sessions/store.ts`
- OpenClaw CLI Runner: `/openclaw/src/agents/cli-runner.ts`
