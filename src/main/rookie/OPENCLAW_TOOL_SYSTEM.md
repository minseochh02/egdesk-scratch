# How OpenClaw Tells the AI Which Tools It Has

## TL;DR

**OpenClaw has a sophisticated multi-layer tool filtering system:**

1. **Tool Registry** - All available tools are created
2. **Policy Filtering** - 7 layers of policy filters (profile → global → agent → group → sandbox → subagent)
3. **System Prompt** - Filtered tool names + descriptions are injected into system prompt
4. **Tool Execution** - When AI calls a tool, OpenClaw executes it via the tool handler

---

## 1. Tool Creation (Registry)

### Core Tool Set

OpenClaw creates all possible tools first, then filters them:

```typescript
// From pi-tools.ts
const tools: AnyAgentTool[] = [
  // Base coding tools (from pi-coding-agent library)
  ...codingTools,  // read, write, edit, grep, find, ls

  // OpenClaw-specific exec tools
  execTool,        // exec: run shell commands
  processTool,     // process: manage background processes

  // Optional tools
  applyPatchTool,  // apply_patch: multi-file patches (OpenAI only)

  // Sandbox-specific variants (if sandboxed)
  createSandboxedReadTool(),
  createSandboxedWriteTool(),
  createSandboxedEditTool(),

  // Channel-specific tools (Discord, Telegram, etc.)
  ...listChannelAgentTools(),

  // OpenClaw system tools
  ...createOpenClawTools({
    // browser, canvas, nodes, cron, message, gateway,
    // sessions_*, session_status, memory_*, web_*, image
  })
];
```

### Tool Groups (Organized by Category)

```typescript
const TOOL_GROUPS = {
  "group:memory": ["memory_search", "memory_get"],
  "group:web": ["web_search", "web_fetch"],
  "group:fs": ["read", "write", "edit", "apply_patch"],
  "group:runtime": ["exec", "process"],
  "group:sessions": [
    "sessions_list",
    "sessions_history",
    "sessions_send",
    "sessions_spawn",
    "session_status"
  ],
  "group:ui": ["browser", "canvas"],
  "group:automation": ["cron", "gateway"],
  "group:messaging": ["message"],
  "group:nodes": ["nodes"],
  "group:openclaw": [/* all OpenClaw-specific tools */]
};
```

---

## 2. Tool Policy System (7 Layers of Filtering)

OpenClaw applies **7 layers** of tool policies in this order:

### Layer 1: Tool Profile
```json
{
  "tools": {
    "profile": "coding"  // or "minimal", "messaging", "full"
  }
}
```

**Predefined Profiles:**
```typescript
{
  "minimal": {
    "allow": ["session_status"]
  },
  "coding": {
    "allow": ["group:fs", "group:runtime", "group:sessions", "group:memory", "image"]
  },
  "messaging": {
    "allow": ["group:messaging", "sessions_list", "sessions_history", "sessions_send", "session_status"]
  },
  "full": {}  // No restrictions
}
```

### Layer 2: Provider-Specific Profile
```json
{
  "tools": {
    "byProvider": {
      "anthropic": {
        "profile": "full"
      },
      "openai": {
        "profile": "coding"
      }
    }
  }
}
```

### Layer 3: Global Allow/Deny
```json
{
  "tools": {
    "allow": ["read", "write", "exec"],
    "deny": ["gateway"]
  }
}
```

### Layer 4: Global Provider-Specific
```json
{
  "tools": {
    "byProvider": {
      "anthropic": {
        "allow": ["browser", "canvas"],
        "deny": ["exec"]
      }
    }
  }
}
```

### Layer 5: Agent-Specific Policy
```json
{
  "agents": {
    "list": [
      {
        "id": "main",
        "tools": {
          "allow": ["group:fs", "group:runtime", "browser"],
          "deny": ["gateway"]
        }
      }
    ]
  }
}
```

### Layer 6: Group/Channel Policy
```json
{
  "groups": {
    "entries": {
      "my-discord-server": {
        "tools": {
          "allow": ["group:messaging", "read", "write"]
        }
      }
    }
  }
}
```

### Layer 7a: Sandbox Policy
If running in sandbox:
```json
{
  "sandbox": {
    "tools": {
      "deny": ["exec", "process"]  // No host execution in sandbox
    }
  }
}
```

### Layer 7b: Subagent Policy
If this is a sub-agent session:
```json
{
  "subagents": {
    "tools": {
      "deny": ["sessions_spawn", "gateway"]  // Sub-agents can't spawn more sub-agents
    }
  }
}
```

---

## 3. Policy Resolution Flow

```typescript
// From pi-tools.ts (simplified)

// 1. Create all possible tools
const tools = [
  ...codingTools,
  execTool,
  processTool,
  ...channelTools,
  ...openclawTools
];

// 2. Apply policies in order (each layer filters the previous result)
const profileFiltered = filterToolsByPolicy(tools, profilePolicy);
const providerProfileFiltered = filterToolsByPolicy(profileFiltered, providerProfilePolicy);
const globalFiltered = filterToolsByPolicy(providerProfileFiltered, globalPolicy);
const globalProviderFiltered = filterToolsByPolicy(globalFiltered, globalProviderPolicy);
const agentFiltered = filterToolsByPolicy(globalProviderFiltered, agentPolicy);
const agentProviderFiltered = filterToolsByPolicy(agentFiltered, agentProviderPolicy);
const groupFiltered = filterToolsByPolicy(agentProviderFiltered, groupPolicy);
const sandboxFiltered = filterToolsByPolicy(groupFiltered, sandboxPolicy);
const finalTools = filterToolsByPolicy(sandboxFiltered, subagentPolicy);

// 3. Return filtered tools
return finalTools;
```

### Policy Precedence

**Most restrictive wins:**
```
Subagent > Sandbox > Group > Agent Provider > Agent > Global Provider > Global > Provider Profile > Profile
```

If ANY layer denies a tool, it's blocked.

---

## 4. How Tools Are Sent to the AI

### A. Tool List in System Prompt

After filtering, OpenClaw builds a **human-readable tool list** for the system prompt:

```typescript
// From system-prompt.ts

const coreToolSummaries = {
  read: "Read file contents",
  write: "Create or overwrite files",
  edit: "Make precise edits to files",
  exec: "Run shell commands (pty available for TTY-required CLIs)",
  browser: "Control web browser",
  sessions_spawn: "Spawn a sub-agent session",
  // ... etc
};

// Get tool names from filtered tools
const toolNames = finalTools.map(tool => tool.name);

// Build tool list with descriptions
const toolLines = toolNames.map(name => {
  const summary = coreToolSummaries[name] ?? externalToolSummaries.get(name);
  return summary ? `- ${name}: ${summary}` : `- ${name}`;
});

// Inject into system prompt
const systemPrompt = `
You are a personal assistant running inside OpenClaw.

## Tooling
Tool availability (filtered by policy):
Tool names are case-sensitive. Call tools exactly as listed.
${toolLines.join('\n')}
...
`;
```

**Example Output in System Prompt:**
```
## Tooling
Tool availability (filtered by policy):
Tool names are case-sensitive. Call tools exactly as listed.
- read: Read file contents
- write: Create or overwrite files
- edit: Make precise edits to files
- grep: Search file contents for patterns
- find: Find files by glob pattern
- ls: List directory contents
- exec: Run shell commands (pty available for TTY-required CLIs)
- process: Manage background exec sessions
- browser: Control web browser
- sessions_spawn: Spawn a sub-agent session
- session_status: Show a /status-equivalent status card
```

### B. Tool Schemas Sent to LLM API

OpenClaw also sends **full JSON schemas** to the LLM API (not in the text prompt):

```typescript
// Actual tool definitions sent to Anthropic/OpenAI API
{
  "name": "read",
  "description": "Read file contents from the workspace",
  "input_schema": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "description": "Absolute or relative file path"
      }
    },
    "required": ["path"]
  }
}
```

The AI receives:
1. **Text list** in system prompt (for context/awareness)
2. **JSON schemas** via API (for structured tool calling)

---

## 5. Plugin Tools

OpenClaw also supports **plugin tools** from extensions:

### Plugin Tool Registration

```typescript
// In extension code
export function register() {
  return {
    tools: [
      {
        name: "llm_task",
        description: "Run a JSON-only LLM task",
        parameters: { /* TypeBox schema */ },
        execute: async (toolCallId, args) => {
          // ... execute logic
        },
        optional: true  // Requires explicit allowlist
      }
    ]
  };
}
```

### Plugin Tool Policy

```json
{
  "plugins": {
    "entries": {
      "llm-task": {
        "enabled": true
      }
    }
  },
  "agents": {
    "list": [
      {
        "id": "main",
        "tools": {
          "allow": ["llm_task"]  // Must explicitly allow
        }
      }
    ]
  }
}
```

---

## 6. Special Cases

### Provider-Specific Tool Behavior

**OpenAI:** `apply_patch` tool is only enabled for OpenAI models
```typescript
const applyPatchEnabled =
  isOpenAIProvider(modelProvider) &&
  isApplyPatchAllowedForModel({ modelId, allowModels });
```

**Anthropic OAuth:** Tool names are remapped to Claude Code-style names on the wire
```typescript
// Internal: "exec"
// API wire: "bash"  (for Claude Code compatibility)
```

### Sandbox Tools

When sandboxed, tools execute inside Docker:
- **Read/Write/Edit** - Sandboxed versions with path restrictions
- **Exec** - Runs in container, not on host
- **Browser** - Connects to sandbox browser via bridge URL

### Sub-agent Tool Restrictions

Sub-agents automatically have certain tools blocked:
```typescript
const subagentPolicy = {
  deny: [
    "sessions_spawn",  // Can't spawn more sub-agents
    "gateway"          // Can't restart gateway
  ]
};
```

---

## 7. Tool Execution Flow

```
1. AI decides to call a tool
   ↓
2. AI sends tool call: { name: "exec", arguments: { command: "ls" } }
   ↓
3. OpenClaw receives tool call
   ↓
4. OpenClaw finds tool in filtered tools list
   ↓
5. OpenClaw validates arguments against schema
   ↓
6. OpenClaw executes tool handler
   ↓
7. Tool returns result
   ↓
8. OpenClaw sends result back to AI
   ↓
9. AI continues with tool result
```

---

## 8. Configuration Examples

### Example 1: Minimal Agent (Read-only)
```json
{
  "agents": {
    "list": [
      {
        "id": "viewer",
        "tools": {
          "allow": ["read", "grep", "find", "ls", "session_status"]
        }
      }
    ]
  }
}
```

### Example 2: Coding Agent (Full File + Exec)
```json
{
  "agents": {
    "list": [
      {
        "id": "coder",
        "tools": {
          "profile": "coding"  // Equivalent to:
          // "allow": ["group:fs", "group:runtime", "group:sessions", "group:memory", "image"]
        }
      }
    ]
  }
}
```

### Example 3: Messaging Agent
```json
{
  "agents": {
    "list": [
      {
        "id": "messenger",
        "tools": {
          "profile": "messaging"  // Messaging tools only
        }
      }
    ]
  }
}
```

### Example 4: Mixed Policies
```json
{
  "tools": {
    "profile": "coding",  // Base: coding tools
    "alsoAllow": ["browser", "canvas"]  // Add UI tools
  },
  "agents": {
    "list": [
      {
        "id": "main",
        "tools": {
          "deny": ["exec"]  // But block exec for this agent
        }
      }
    ]
  }
}
```

---

## Summary: How OpenClaw Tells AI About Tools

1. ✅ **Create all possible tools** (coding + system + plugin)
2. ✅ **Apply 7 layers of policy filtering** (most restrictive wins)
3. ✅ **Build human-readable tool list** with descriptions
4. ✅ **Inject tool list into system prompt** (text)
5. ✅ **Send JSON schemas to LLM API** (for tool calling)
6. ✅ **Execute tools when called** by AI

**Key Insight:**
OpenClaw doesn't have "free reign" - it has a **highly configurable policy system** that can restrict tools at multiple levels (global, agent, group, sandbox, subagent).

The system prompt shows the AI **exactly which tools are available** after all filtering is applied.

---

## What Rookie Can Learn

For Rookie, we don't need this level of complexity (no multi-agent, no chat channels), but we can borrow:

### ✅ **Relevant for Rookie**
1. **Tool registry pattern** - Define all possible automation actions
2. **Simple filtering** - Allow/deny certain actions per workflow
3. **Clear documentation** - Show user which actions are available

### ❌ **Not Needed for Rookie**
1. Multi-layer policies (we're not multi-tenant)
2. Provider-specific filtering (we're not LLM-based)
3. Channel-specific tools (we're desktop automation)
4. Subagent restrictions (we don't have sub-workflows yet)

### Rookie's Tool System (Simplified)

```typescript
// Rookie's automation actions
const ROOK_ACTIONS = {
  // Mouse actions
  click: { description: "Click at coordinates or element" },
  doubleClick: { description: "Double-click at coordinates or element" },
  rightClick: { description: "Right-click at coordinates or element" },

  // Keyboard actions
  type: { description: "Type text" },
  press: { description: "Press key combination" },

  // Navigation
  navigate: { description: "Navigate to URL" },
  scroll: { description: "Scroll page" },

  // Wait actions
  wait: { description: "Wait for duration or element" },
  waitForElement: { description: "Wait for element to appear" },

  // Data extraction
  extract: { description: "Extract text or data from element" },
  screenshot: { description: "Take screenshot" },

  // Application control
  openApp: { description: "Open desktop application" },
  closeApp: { description: "Close desktop application" },
  switchWindow: { description: "Switch to window" }
};

// Simple per-workflow filtering
interface RookConfig {
  allowedActions?: string[];  // If specified, only these actions allowed
  deniedActions?: string[];   // Explicitly blocked actions
}
```

This is much simpler than OpenClaw's 7-layer policy system, but follows the same **registry + filter + document** pattern.
