# Coding AI Chat - MVP Specification

## Vision

An AI coding assistant in the Coding component (`src/renderer/components/Coding/AIChat.tsx`) that can read/write project files and access EGDesk SQLite databases to automatically build data-driven UIs.

## MVP Scope

**OUT OF SCOPE for MVP:**
- ❌ Chat conversation persistence (no SQLite storage)
- ❌ Chat history UI
- ❌ Project-based chat organization

**IN SCOPE for MVP:**
- ✅ Tool access (read, write, edit files)
- ✅ Access to user-data SQLite databases
- ✅ Single-session chat interface
- ✅ Ability to generate complete data-driven features

## User Workflow (MVP)

### 1. Setup
User selects a Vite/React project folder → DeveloperWindow starts dev server → Opens AI Chat

### 2. User Request
User: **"Show me my sales data from the database in a table"**

### 3. AI Execution
AI automatically:

1. **Discover Data**
   ```javascript
   // Calls: user_data_list_tables
   // Gets: { tables: [{ tableName: 'sales_data', rowCount: 6718, ... }] }
   ```

2. **Get Schema**
   ```javascript
   // Calls: user_data_get_schema('sales_data')
   // Gets: { columns: ['id', 'date', 'customer', 'amount', ...] }
   ```

3. **Generate Backend** - Edit `vite.config.js`:
   ```javascript
   import { viteApiPlugin, jsonResponse } from '@egdesk/vite-api-plugin';
   import { queryTable } from './egdesk-helpers';
   import { TABLES } from './egdesk.config';

   export default defineConfig({
     plugins: [
       viteApiPlugin({
         routes: [
           {
             path: '/api/sales',
             method: 'GET',
             handler: async (req, res) => {
               const data = await queryTable(TABLES.table1.name, {
                 limit: 100,
                 offset: 0
               });
               jsonResponse(res, data);
             }
           }
         ]
       })
     ]
   });
   ```

4. **Generate Component** - Create `src/components/SalesTable.jsx`:
   ```javascript
   import { useState, useEffect } from 'react';

   export default function SalesTable() {
     const [sales, setSales] = useState([]);
     const [loading, setLoading] = useState(true);

     useEffect(() => {
       fetch('/api/sales')
         .then(res => res.json())
         .then(data => {
           setSales(data.rows);
           setLoading(false);
         });
     }, []);

     if (loading) return <div>Loading...</div>;

     return (
       <table>
         <thead>
           <tr>
             <th>Date</th>
             <th>Customer</th>
             <th>Amount</th>
           </tr>
         </thead>
         <tbody>
           {sales.map(row => (
             <tr key={row.id}>
               <td>{row.date}</td>
               <td>{row.customer}</td>
               <td>{row.amount}</td>
             </tr>
           ))}
         </tbody>
       </table>
     );
   }
   ```

5. **Update App** - Edit `src/App.jsx`:
   ```javascript
   import SalesTable from './components/SalesTable';

   function App() {
     return (
       <div>
         <h1>Sales Dashboard</h1>
         <SalesTable />
       </div>
     );
   }
   ```

### 4. Result
User's Vite project now displays live database data - no manual coding required.

## Required Tools

The AI needs access to:

### File System Tools (Already Exist)
- `read_file` - Read any file in the project
- `write_file` - Create new files
- `partial_edit` - Edit specific parts of existing files
- `list_directory` - Browse project structure

### User Data Tools (Already Exist)
- `user_data_list_tables` - Discover available tables
- `user_data_get_schema` - Get column definitions
- `user_data_query` - Query data with filters/pagination
- `user_data_search` - Full-text search
- `user_data_aggregate` - Compute SUM/AVG/etc.

### Project Context
- AI needs to know which folder it's working in
- Use the folder path from `localStorage.getItem('selected-project-folder')`

## Architecture Changes Needed

### 1. Connect AI Chat to Tool Registry

**Current State:**
- `src/renderer/components/Coding/AIChat.tsx` is just a placeholder
- No connection to `toolRegistry` or `gemini-autonomous-client`

**Needed:**
```typescript
// src/renderer/components/Coding/AIChat.tsx

const AIChat: React.FC = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const projectPath = localStorage.getItem('selected-project-folder');

  const sendMessage = async (text: string) => {
    // Call IPC to send message to AI
    const result = await window.electron.ipcRenderer.invoke('ai-chat-send', {
      message: text,
      projectPath: projectPath,
      context: 'coding' // Tell AI it's in coding mode
    });

    // Handle streaming responses
    // Display AI replies
  };

  return (
    <div className="ai-chat-container">
      <div className="messages">
        {messages.map(msg => <Message key={msg.id} {...msg} />)}
      </div>
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyPress={e => e.key === 'Enter' && sendMessage(input)}
      />
    </div>
  );
};
```

### 2. Add IPC Handler for Coding AI

**Location:** `src/main/ai-code/gemini-autonomous-client.ts`

**New Handler:**
```typescript
ipcMain.handle('ai-chat-send', async (event, { message, projectPath, context }) => {
  // Set working directory context to projectPath
  // Enable tools: file operations + user_data queries
  // Stream responses back to renderer

  const options = {
    projectPath, // Working directory for file operations
    tools: toolRegistry.getToolDefinitions(), // All tools available
    autoExecuteTools: true // Auto-execute without confirmation
  };

  return autonomousClient.sendMessage(message, options);
});
```

### 3. Tool Context Awareness

**Problem:** File tools need to know they're operating in the project folder, not system-wide.

**Solution:** Pass `projectPath` as working directory:

```typescript
// tools/read-file.ts
async execute(params: { filePath: string }, signal?: AbortSignal, projectPath?: string) {
  // Resolve relative paths to project folder
  const fullPath = path.isAbsolute(params.filePath)
    ? params.filePath
    : path.join(projectPath, params.filePath);

  return fs.readFileSync(fullPath, 'utf-8');
}
```

## UI Components (MVP)

### Simple Chat Interface

```
┌─────────────────────────────────────────┐
│  AI Assistant                            │
├─────────────────────────────────────────┤
│                                          │
│  User: Show sales data                  │
│                                          │
│  AI: I found a table "sales_data" with  │
│      6,718 rows. I'll create a table... │
│                                          │
│      [Executing: read_file vite.config] │
│      [Executing: partial_edit ...]      │
│      [Executing: write_file SalesTable] │
│                                          │
│  AI: Done! Your sales data is now       │
│      displayed at /sales                │
│                                          │
├─────────────────────────────────────────┤
│  Type a message...              [Send]  │
└─────────────────────────────────────────┘
```

**Features:**
- Show user messages
- Show AI messages
- Show tool execution status (optional, nice to have)
- Input field + send button
- Auto-scroll to bottom

**NOT needed for MVP:**
- Conversation history
- Multiple conversations
- Message editing/deletion
- File attachments
- Code syntax highlighting (nice to have but not critical)

## Example Use Cases

### 1. Create Data Table
**User:** "Show my customer data in a table"
**AI:** Creates table component with pagination, sorting

### 2. Create Dashboard
**User:** "Create a sales dashboard with total revenue and top customers"
**AI:** Creates multiple components with aggregations

### 3. Add Search
**User:** "Add a search bar to filter customers"
**AI:** Adds search input, implements search API route, updates component

### 4. Update Styling
**User:** "Make the table look nicer with alternating row colors"
**AI:** Edits CSS or adds Tailwind classes

## Technical Implementation Notes

### 1. Project Path Handling
```typescript
// DeveloperWindow stores path when project starts
localStorage.setItem('selected-project-folder', folderPath);

// AIChat reads it
const projectPath = localStorage.getItem('selected-project-folder');

// All file operations are relative to this path
```

### 2. Tool Execution
```typescript
// AI wants to edit vite.config.js
{
  tool: 'partial_edit',
  args: {
    filePath: 'vite.config.js', // Relative path
    oldString: '...',
    newString: '...'
  }
}

// Backend resolves to full path
const fullPath = path.join(projectPath, 'vite.config.js');
```

### 3. User Data Access
```typescript
// AI can query any user-imported table
{
  tool: 'user_data_query',
  args: {
    tableName: 'sales_data',
    limit: 100,
    filters: { status: 'active' }
  }
}

// Returns data that AI can use to generate code
```

## Benefits of MVP Approach

**For Users:**
- Instant data-driven UIs without manual coding
- Natural language interface to build features
- Works with any SQLite data imported to EGDesk

**For Development:**
- No database migrations needed (no chat persistence)
- Reuses existing tool infrastructure
- Simpler scope, faster to ship

**For Future:**
- Easy to add chat persistence later
- Foundation for more advanced features
- Proves the concept before investing in full architecture

## Next Steps After MVP

Once MVP is working:

1. **Add chat persistence** - Store conversations in SQLite
2. **Project association** - Link chats to specific projects
3. **Chat history UI** - Browse previous conversations
4. **Multi-turn context** - AI remembers previous changes
5. **Undo/Redo** - Revert AI changes
6. **Templates** - "Create a CRUD app for this table"
7. **Better UX** - Syntax highlighting, diff view, etc.

## Success Criteria

MVP is successful when:

✅ User can select a Vite project folder
✅ User can chat with AI in the Coding interface
✅ AI can discover EGDesk user-data tables
✅ AI can read/write/edit project files
✅ AI can generate complete features (API + UI)
✅ Generated code works in the live dev server
✅ User sees changes reflected in their running app

**Example Test:**
1. Import CSV with sales data
2. Create new Vite React project
3. Tell AI: "Show my sales data in a table"
4. AI generates code
5. Open browser to localhost:5173
6. See sales data displayed ✓
