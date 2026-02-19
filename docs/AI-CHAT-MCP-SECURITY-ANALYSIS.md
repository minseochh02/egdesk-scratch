# Security Analysis: AI Chat System and MCP Server Access

## Executive Summary

**✅ GOOD NEWS: Your internal AI chat system does NOT have direct access to the User Data MCP Server or your user-imported SQL tables.**

The AI chat system and the MCP server infrastructure are **completely separate systems** with different tool sets and no cross-access.

---

## Architecture Separation

### 1. **Internal AI Chat System** (Autonomous Gemini Client)
- **Location:** `src/main/ai-code/gemini-autonomous-client.ts`
- **Purpose:** Code assistance, project analysis, file editing
- **Tools Available:** File system operations, shell commands, AppsScript operations
- **Database Access:** Only its own conversation history (`conversations.db`)

### 2. **MCP Server System** (External AI Access)
- **Location:** `src/main/mcp/server-creator/local-server-manager.ts`
- **Purpose:** Expose data to external AI assistants (Claude Desktop, Cursor, etc.)
- **Tools Available:** Gmail, Sheets, File System, User Data queries
- **Database Access:** User-imported tables (`user_data.db`), Gmail data, etc.

---

## What the Internal AI Chat Can Access

### ✅ **ALLOWED** - File System Tools
```typescript
// Tools available to internal AI chat:
- read_file          // Read project files
- write_file         // Write/edit project files
- list_directory     // Browse directories
- partial_edit       // Make precise edits
- move_file          // Move/organize files
- shell_command      // Run terminal commands
- analyze_project    // Project analysis
```

### ✅ **ALLOWED** - AppsScript Tools
```typescript
// Database: cloudmcp.db (Google Apps Script projects only)
- apps_script_list_files
- apps_script_read_file
- apps_script_write_file
- apps_script_partial_edit
- apps_script_rename_file
- apps_script_delete_file
```

### ❌ **NOT ALLOWED** - User Data Access
```typescript
// NO access to:
- user_data.db (your imported Excel/CSV tables)
- User Data MCP tools (query, search, aggregate, etc.)
- Direct SQL queries to user tables
- Import operations metadata
```

---

## Evidence of Separation

### 1. **Tool Registry Analysis**
File: `src/main/ai-code/tool-executor.ts`

```typescript
// Only registers filesystem and AppsScript tools
export class ToolRegistry {
  constructor() {
    this.registerBuiltinTools();  // File system + AppsScript only
  }
}

// No mention of user-data tools
export function getToolNamesForContext(context: 'filesystem' | 'apps-script' | 'all'): string[] {
  // Only supports: filesystem, apps-script contexts
  // NO 'user-data' context
}
```

### 2. **System Prompt Analysis**
File: `src/main/ai-code/prompts/system-prompt.ts`

```typescript
export function getEGDeskSystemPrompt(projectContext?: string): string {
  // Defines available tools:
  // - File System Tools (read, write, list)
  // - Editing Tool (partial_edit)
  // - Execution Tools (shell_command)
  // - Analysis Tools (analyze_project)
  
  // NO mention of:
  // - User Data MCP
  // - SQL queries
  // - Database access to user tables
}
```

### 3. **No Import Statements**
The AI chat system does NOT import:
- `UserDataMCPService`
- `UserDataDbManager`
- `user-data-init`
- Any user data related modules

---

## MCP Server Access Control

### Who CAN Access User Data MCP?

1. **External AI Assistants** (when HTTP server is running)
   - Claude Desktop
   - Cursor AI
   - Any MCP-compatible client
   - **Requirement:** Must connect via HTTP to `localhost:3100/user-data/*`

2. **Access Requirements:**
   - HTTP server must be started by user
   - User-data MCP server must be enabled (it is by default)
   - Must know the correct endpoint and protocol

### Security Layers

```
External AI Request
      ↓
HTTP Server Check (must be running)
      ↓
MCP Server Enabled Check (can be disabled)
      ↓
Tool Authentication
      ↓
UserDataMCPService (read-only tools)
      ↓
UserDataDbManager (SQL validation)
      ↓
user_data.db (SQLite)
```

---

## SQL Visibility Analysis

### ❌ **Internal AI Chat CANNOT see:**
- User-imported table data
- Table schemas from Excel/CSV imports
- SQL queries to user_data.db
- Import operation history
- User Data MCP server status

### ✅ **Internal AI Chat CAN see:**
- Your project code files
- Configuration files (if you ask it to read them)
- Shell command outputs
- AppsScript project files in cloudmcp.db

### ⚠️ **Potential Indirect Exposure:**
If you explicitly ask the internal AI to:
1. "Read the user_data.db file" - It could read the raw SQLite database file
2. "Show me the user-data MCP service code" - It could read the source code
3. "Run a shell command to query the database" - It could execute SQL via shell

However, it **cannot** automatically or directly query your user data tables through the MCP interface.

---

## Comparison Table

| Feature | Internal AI Chat | External AI (MCP) |
|---------|------------------|-------------------|
| File system access | ✅ Yes | ✅ Yes (limited) |
| Shell commands | ✅ Yes | ❌ No |
| User data queries | ❌ No | ✅ Yes (read-only) |
| SQL query tools | ❌ No | ✅ Yes (SELECT only) |
| Code editing | ✅ Yes | ❌ No |
| AppsScript access | ✅ Yes | ✅ Yes |
| Gmail data | ❌ No | ✅ Yes |
| Sheets data | ❌ No | ✅ Yes |

---

## Recommendations

### ✅ **Current Security Posture is Good**

1. **Principle of Least Privilege:** Internal AI only has tools for its job (coding)
2. **Separation of Concerns:** Data access and code editing are separate
3. **User Control:** MCP servers can be disabled, HTTP server can be stopped
4. **Read-Only by Design:** User Data MCP tools are all read-only

### 🔒 **Additional Security Measures (If Needed)**

1. **Disable User-Data MCP Server:**
   ```typescript
   await window.electron.invoke('mcp-server-disable', 'user-data');
   ```

2. **Stop HTTP Server:**
   ```typescript
   await window.electron.invoke('https-server-stop');
   ```

3. **File System Protection:**
   Add user_data.db to `.cursorignore` or similar to prevent AI from reading raw database:
   ```
   # .cursorignore or .gitignore
   database/user_data.db
   ```

4. **Monitor Access:**
   All MCP tool calls are logged with `console.log('🗄️ Calling User Data tool: ...')

### 🎯 **Best Practices**

1. **Don't ask internal AI to:**
   - Query user_data.db directly
   - Read raw database files
   - Execute SQL commands on user tables

2. **Use MCP for:**
   - Controlled, read-only access to user data
   - External AI assistants that need data analysis
   - Structured queries with built-in safety

3. **Use Internal AI for:**
   - Code editing and project work
   - File system operations
   - Build/test automation

---

## Conclusion

**Your SQL data is safe from the internal AI chat system.** The architecture is properly separated:

- **Internal AI** = Code assistant (no user data access)
- **MCP Servers** = Data interface for external AIs (controlled access)

The User Data MCP server is designed for **external AI assistants** (like Claude Desktop) to query your imported data, not for the internal coding AI. Your user-imported Excel/CSV tables are not exposed to the internal chat system unless you explicitly instruct it to read the raw database file.

This is a secure, well-designed architecture that follows the principle of separation of concerns. ✅
