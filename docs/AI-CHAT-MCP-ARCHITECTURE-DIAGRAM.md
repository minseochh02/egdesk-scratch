# System Architecture: AI Chat vs MCP Server Access

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           EGDesk Application                             │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
                    ▼                             ▼
         ┌──────────────────────┐    ┌──────────────────────┐
         │  Internal AI Chat    │    │   MCP Server System  │
         │  (Code Assistant)    │    │  (External AI API)   │
         └──────────────────────┘    └──────────────────────┘
                    │                             │
         ┌──────────┴──────────┐       ┌─────────┴─────────┐
         │                     │       │                   │
         ▼                     ▼       ▼                   ▼
    ┌────────┐          ┌─────────┐ ┌──────┐        ┌──────────┐
    │  File  │          │ Apps    │ │Gmail │        │User Data │
    │ System │          │ Script  │ │ MCP  │        │   MCP    │
    │ Tools  │          │ Tools   │ │      │        │          │
    └────────┘          └─────────┘ └──────┘        └──────────┘
         │                     │       │                   │
         ▼                     ▼       ▼                   ▼
    ┌────────┐          ┌─────────┐ ┌──────┐        ┌──────────┐
    │Project │          │cloudmcp │ │Gmail │        │user_data │
    │ Files  │          │   .db   │ │ data │        │   .db    │
    └────────┘          └─────────┘ └──────┘        └──────────┘


═══════════════════════════════════════════════════════════════════════════
                         ACCESS PERMISSIONS
═══════════════════════════════════════════════════════════════════════════

INTERNAL AI CHAT (Code Assistant):
┌─────────────────────────────────────────────────────────────────────────┐
│ ✅ CAN ACCESS:                                                           │
│    • read_file, write_file (project files)                              │
│    • list_directory (browse project)                                    │
│    • shell_command (run commands)                                       │
│    • partial_edit (edit code)                                           │
│    • apps_script_* (Google Apps Script files in cloudmcp.db)           │
│                                                                          │
│ ❌ CANNOT ACCESS:                                                        │
│    • user_data.db (your imported Excel/CSV tables)                     │
│    • User Data MCP tools (query, search, aggregate)                    │
│    • Gmail MCP data                                                     │
│    • Sheets MCP data                                                    │
│    • SQL queries to user tables                                         │
└─────────────────────────────────────────────────────────────────────────┘


MCP SERVER SYSTEM (External AI Interface):
┌─────────────────────────────────────────────────────────────────────────┐
│ ✅ CAN ACCESS (when HTTP server running):                               │
│    • user_data_list_tables                                              │
│    • user_data_get_schema                                               │
│    • user_data_query (read-only)                                        │
│    • user_data_search                                                   │
│    • user_data_aggregate                                                │
│    • user_data_sql_query (SELECT only)                                  │
│    • user_data_export_preview                                           │
│    • Gmail tools (if enabled)                                           │
│    • Sheets tools (if enabled)                                          │
│    • File system tools (limited)                                        │
│                                                                          │
│ ❌ CANNOT DO:                                                            │
│    • Write/modify project code                                          │
│    • Execute shell commands                                             │
│    • INSERT/UPDATE/DELETE SQL operations                                │
│    • Access files outside allowed directories                           │
└─────────────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════
                          TYPICAL USE CASES
═══════════════════════════════════════════════════════════════════════════

INTERNAL AI CHAT (Gemini/Ollama):
┌─────────────────────────────────────────────────────────────────────────┐
│ User: "Add error handling to the authentication module"                 │
│   → AI reads auth files                                                 │
│   → AI edits code with try/catch blocks                                │
│   → AI runs tests                                                       │
│   → ✅ Done (no user data accessed)                                     │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ User: "Show me my customer data from the imported Excel file"           │
│   → ❌ AI cannot access user_data.db                                    │
│   → Would need to use MCP Server instead                               │
└─────────────────────────────────────────────────────────────────────────┘


MCP SERVER (Claude Desktop/Cursor):
┌─────────────────────────────────────────────────────────────────────────┐
│ User (to Claude Desktop): "Analyze my customer database"                │
│   → Claude connects via MCP protocol                                   │
│   → Calls user_data_list_tables                                        │
│   → Calls user_data_query on customers table                           │
│   → Returns analysis                                                   │
│   → ✅ Done (read-only access)                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ User (to Claude Desktop): "Edit the authentication code"                │
│   → ❌ Claude Desktop cannot edit project files via MCP               │
│   → Would need to use internal AI chat instead                        │
└─────────────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════
                          DATA FLOW DIAGRAM
═══════════════════════════════════════════════════════════════════════════

SCENARIO 1: Internal AI Chat (No User Data Access)
───────────────────────────────────────────────────

User: "Fix the bug in auth.ts"
        │
        ▼
  Gemini Client
        │
        ▼
  Tool: read_file("auth.ts")
        │
        ▼
  Project Files ─────────> Returns file content
        │
        ▼
  Tool: partial_edit(...)
        │
        ▼
  ✅ Code Updated
        
  ❌ user_data.db never accessed


SCENARIO 2: External AI via MCP (User Data Access)
──────────────────────────────────────────────────

User: "Query my sales data"
        │
        ▼
 Claude Desktop
        │
        ▼
 HTTP POST: /user-data/tools/call
        │
        ▼
LocalServerManager
        │
        ▼
UserDataMCPService
        │
        ▼
UserDataDbManager
        │
        ▼
  user_data.db ─────────> Returns query results
        │
        ▼
 ✅ Data Returned (read-only)
        
  ❌ Project files not accessible


═══════════════════════════════════════════════════════════════════════════
                       SECURITY BOUNDARIES
═══════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────┐
│                         SECURITY BOUNDARY 1                             │
│  ═══════════════════════════════════════════════════════════════════   │
│                                                                          │
│  Internal AI Chat ◄──────────X─────────► User Data                     │
│  (Code Assistant)        NO ACCESS       (user_data.db)                 │
│                                                                          │
│  Reason: Different tool registries, no imports, no handlers            │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                         SECURITY BOUNDARY 2                             │
│  ═══════════════════════════════════════════════════════════════════   │
│                                                                          │
│  MCP Server ◄──────────X─────────► Project Code                        │
│  (Data Interface)   NO WRITE ACCESS    (src/*, etc)                    │
│                                                                          │
│  Reason: Read-only tools, no shell execution, no file editing          │
└─────────────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════
                         KEY TAKEAWAYS
═══════════════════════════════════════════════════════════════════════════

1. ✅ Internal AI chat CANNOT see your imported SQL tables
2. ✅ User Data MCP is only for external AI assistants  
3. ✅ Both systems have different, non-overlapping tool sets
4. ✅ Read-only design prevents data modification via MCP
5. ✅ You can disable MCP servers at any time
6. ✅ Architecture follows principle of least privilege

YOUR SQL DATA IS NOT VISIBLE TO THE INTERNAL AI CHAT SYSTEM! ✅
```
