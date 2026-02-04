# OpenClaw Planning & Task Management Analysis

## Summary: How OpenClaw Handles Complex Tasks

OpenClaw **does NOT have a built-in todo/task management system** like Claude Code's TodoWrite tool. Instead, they use a different approach focused on:

1. **Sub-agents for complex work**
2. **Memory system for persistence**
3. **System prompts with clear guidance**

---

## 1. System Prompt Structure

### Core Philosophy
The system prompt is **intentionally compact** and uses fixed sections. OpenClaw builds a custom system prompt for every agent run.

### Key Sections

```
You are a personal assistant running inside OpenClaw.

## Tooling
- Tool availability (filtered by policy)
- read, write, edit, apply_patch, grep, find, ls
- exec: run shell commands (pty for TTY-required CLIs)
- process: manage background exec sessions
- browser: control web browser
- canvas: present/eval/snapshot
- nodes: paired devices
- cron: reminders and scheduled tasks
- sessions_spawn: spawn sub-agent sessions
- sessions_list: list other sessions
- sessions_send: send messages to other sessions

## Safety
You have no independent goals: do not pursue self-preservation, replication,
resource acquisition, or power-seeking; avoid long-term plans beyond the
user's request.

Prioritize safety and human oversight over completion; if instructions
conflict, pause and ask.

## Skills (when available)
Before replying: scan <available_skills> <description> entries.
- If exactly one skill clearly applies: read its SKILL.md, then follow it.
- If multiple could apply: choose the most specific one.
- If none clearly apply: do not read any SKILL.md.

## Memory Recall
Before answering anything about prior work, decisions, dates, people,
preferences, or todos: run memory_search on MEMORY.md + memory/*.md;
then use memory_get to pull only the needed lines.

## Documentation
OpenClaw docs: [local path]
Mirror: https://docs.openclaw.ai
For OpenClaw behavior, commands, config, or architecture: consult local
docs first.

## Workspace
Working directory: [path]
Bootstrap files injected: AGENTS.md, SOUL.md, TOOLS.md, IDENTITY.md, USER.md

## Current Date & Time
Time zone: [user timezone]

## Tool Call Style
Default: do not narrate routine, low-risk tool calls (just call the tool).
Narrate only when it helps: multi-step work, complex/challenging problems,
sensitive actions, or when the user explicitly asks.
Keep narration brief and value-dense.

**CRITICAL LINE:**
If a task is more complex or takes longer, spawn a sub-agent. It will do
the work for you and ping you when it's done. You can always check up on it.
```

### Prompt Modes

OpenClaw supports 3 prompt modes:
- **`full`** (default): All sections for main agent
- **`minimal`**: For sub-agents (omits Skills, Memory, Self-Update, etc.)
- **`none`**: Just the basic identity line

---

## 2. Sub-Agent System (Their "Planning" Approach)

### Tool: `sessions_spawn`

Instead of a task list, OpenClaw delegates complex work to **isolated sub-agent sessions**.

**Tool Schema:**
```typescript
{
  task: string;           // Required: The task description
  label?: string;         // Optional: Human-readable label
  agentId?: string;       // Optional: Which agent to spawn
  model?: string;         // Optional: Model override
  thinking?: string;      // Optional: Thinking level
  runTimeoutSeconds?: number;
  cleanup?: 'delete' | 'keep';  // Session cleanup
}
```

**Example Usage:**
```typescript
// Main agent decides: "This is complex, spawn a sub-agent"
sessions_spawn({
  task: "Research the latest React patterns and create a summary document",
  label: "React Research",
  thinking: "verbose",
  runTimeoutSeconds: 300
})

// Sub-agent runs independently
// When done, it announces back to the main session
```

**Key Features:**
- Sub-agents run in **isolated sessions**
- They have a **minimal system prompt** (less overhead)
- Sub-agents **cannot spawn more sub-agents** (prevents recursion)
- Results are **announced back** to the requester
- Sessions can be monitored with `sessions_list`
- Cross-session messaging with `sessions_send`

**Workflow:**
```
Main Agent
    ↓
  Recognizes complex task
    ↓
  sessions_spawn(task)
    ↓
  Sub-agent Session Created
    ↓
  Sub-agent works independently
    ↓
  Sub-agent announces completion
    ↓
  Main agent continues
```

---

## 3. Memory System (Persistent Task Tracking)

Instead of in-memory todos, OpenClaw uses **file-based memory**:

### Files
- `MEMORY.md` - Main memory file
- `memory/*.md` - Additional memory files

### Tools
- **`memory_search`** - Search memory files
- **`memory_get`** - Retrieve specific lines

### System Prompt Guidance
```
Before answering anything about prior work, decisions, dates, people,
preferences, or todos: run memory_search on MEMORY.md + memory/*.md;
then use memory_get to pull only the needed lines.
```

### Usage Pattern
```typescript
// 1. Agent searches memory for context
memory_search({ query: "todo items for project X" })

// 2. Agent retrieves relevant lines
memory_get({ path: "MEMORY.md", lines: [45, 46, 47] })

// 3. Agent updates memory with new info
write({
  path: "MEMORY.md",
  content: "## Todos\n- [ ] Implement feature Y\n- [x] Complete feature X"
})
```

---

## 4. Cron System (Scheduled Reminders)

For time-based tasks, OpenClaw uses the **`cron` tool**:

```typescript
cron({
  action: "add",
  schedule: "0 9 * * MON",  // Every Monday at 9 AM
  systemEvent: "Weekly reminder: Review open pull requests"
})
```

**System Prompt Guidance:**
```
cron: Manage cron jobs and wake events (use for reminders; when
scheduling a reminder, write the systemEvent text as something that
will read like a reminder when it fires, and mention that it is a
reminder depending on the time gap between setting and firing;
include recent context in reminder text if appropriate)
```

---

## 5. Bootstrap Files (Workspace Context)

OpenClaw injects workspace files into the system prompt automatically:

### Standard Files
- **`AGENTS.md`** - Agent behavior and guidelines
- **`SOUL.md`** - Agent personality/identity
- **`TOOLS.md`** - External tools documentation
- **`IDENTITY.md`** - Agent identity
- **`USER.md`** - User preferences
- **`HEARTBEAT.md`** - Heartbeat behavior
- **`BOOTSTRAP.md`** - Initial setup (new workspaces only)

### Injection Behavior
- Files are **trimmed and appended** under "Project Context"
- Large files are **truncated** (max: 20,000 chars per file)
- Missing files get a **missing-file marker**
- Hook: `agent:bootstrap` can intercept and mutate

---

## 6. Key Differences vs Claude Code

| Feature | OpenClaw | Claude Code |
|---------|----------|-------------|
| **Task Management** | Sub-agents + Memory files | TodoWrite tool (in-memory list) |
| **Complex Tasks** | `sessions_spawn` (isolated sessions) | Plan Mode (single session) |
| **Persistence** | Files (MEMORY.md) | Transcript-based |
| **Planning** | Implicit (agent decides to spawn) | Explicit (EnterPlanMode tool) |
| **Progress Tracking** | `sessions_list` + announcements | Todo status updates |
| **Narration** | Minimal (only when helpful) | Default verbose |
| **System Prompt** | Compact, section-based | Tool-based instructions |

---

## 7. What We Can Apply to Rookie

### For Desktop Automation (Rookie)

Rookie is fundamentally different from OpenClaw (chat-based AI) or Claude Code (coding assistant). However, we can borrow concepts:

#### ✅ **Session Management Pattern**
- Track execution state (running → completed/failed)
- Metadata tracking (duration, errors, steps)
- Session resumption support

#### ✅ **Clear System Instructions**
If we use AI to generate or modify workflows:
- Compact, section-based prompts
- Clear tool descriptions
- Safety guardrails

#### ✅ **Sub-task Delegation**
For complex Rookie workflows:
```
Main Rook Workflow
    ↓
Step 1: Login to bank (sub-workflow)
Step 2: Download transactions (sub-workflow)
Step 3: Process Excel (sub-workflow)
    ↓
Each step can be a separate recorded session
```

#### ✅ **Memory/Context Files**
For Rookie:
- **`ROOK_CONFIG.md`** - Workflow configuration
- **`RESOURCES.md`** - Available websites/apps
- **`CREDENTIALS.md`** - Encrypted credentials
- **`EXECUTION_LOG.md`** - Run history

#### ✅ **Scheduled Execution**
Like OpenClaw's cron:
```sql
CREATE TABLE rook_schedules (
  cron_expression TEXT,
  next_run_at TIMESTAMPTZ,
  ...
)
```

#### ❌ **Not Applicable**
- Sub-agents (Rookie doesn't need AI spawning)
- LLM-based planning (Rookie is pure automation)
- Chat-based interaction (Rookie is UI-driven)

---

## 8. Rookie-Specific Approach (Recommendation)

Based on OpenClaw's lessons, here's what Rookie should do:

### A. **Workflow Sessions** (like OpenClaw sessions)
```typescript
interface RookSession {
  id: string;
  rookId: string;
  status: 'running' | 'completed' | 'failed';

  // Execution context (like OpenClaw's SessionEntry)
  startedAt: Date;
  completedAt?: Date;
  duration?: number;

  // Error tracking
  error?: {
    message: string;
    step: number;
    screenshot: string;
  };

  // Step tracking
  steps: RookStep[];
}
```

### B. **Step-by-Step Execution** (like sub-agents)
```typescript
interface RookStep {
  number: number;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';

  // Action details
  action: 'click' | 'type' | 'navigate' | 'wait' | 'extract';
  selector?: string;
  value?: string;

  // Evidence
  screenshotBefore?: string;
  screenshotAfter?: string;
}
```

### C. **Resource Management** (like OpenClaw's bootstrap files)
```typescript
// Pre-configured resources
interface RookResource {
  id: string;
  name: string;
  type: 'web' | 'desktop';
  url?: string;
  credentials?: {
    username: string;
    password: string; // encrypted
  };
}
```

### D. **Execution Engine** (like OpenClaw's cli-runner)
```typescript
class RookExecutor {
  async execute(session: RookSession) {
    for (const step of session.steps) {
      try {
        await this.executeStep(step);
        step.status = 'completed';
      } catch (error) {
        step.status = 'failed';
        session.error = { message: error.message, step: step.number };
        throw error;
      }
    }
  }

  private async executeStep(step: RookStep) {
    switch (step.action) {
      case 'click':
        await this.desktopAutomation.click(step.selector);
        break;
      case 'type':
        await this.desktopAutomation.type(step.selector, step.value);
        break;
      // ... etc
    }
  }
}
```

---

## Conclusion

**OpenClaw's approach:** Sub-agents + Memory files + Compact prompts
**Claude Code's approach:** TodoWrite + Plan Mode + Verbose tracking
**Rookie's approach (recommended):** Session-based execution + Step tracking + Database persistence

Rookie doesn't need task planning like AI assistants do—it needs **workflow recording** and **reliable playback**. The lessons from OpenClaw are about:
1. **Session lifecycle management**
2. **Compact, clear instructions**
3. **Error handling and retry logic**
4. **Metadata tracking for debugging**

Use OpenClaw's **session patterns** but keep Rookie **domain-specific** for desktop automation.
