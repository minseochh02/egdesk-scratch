# User Data Tools - Quick Reference

## 🎯 When to Use

Your internal AI can now help with data analysis! Use these scenarios:

### ✅ Ask Your AI:
- "What tables do I have?"
- "Show me my customer data"
- "Find all orders from last month"
- "What's the average order value?"
- "Search for 'premium' customers"
- "Break down sales by region"
- "Create a dashboard for my data"
- "Generate a report from my Excel import"

---

## 📚 Available Tools

### 1. List Tables
```
AI Tool: user_data_list_tables
Usage: "What data tables do I have?"
       "List my imported Excel files"
```

### 2. Query Data
```
AI Tool: user_data_query
Usage: "Show me customers from New York"
       "Get the last 50 sales records"
       "Filter active accounts with balance > 1000"
```

### 3. Search Data
```
AI Tool: user_data_search
Usage: "Find customers mentioning 'premium'"
       "Search for order #12345"
       "Look for records containing 'urgent'"
```

### 4. Aggregate Data
```
AI Tool: user_data_aggregate
Usage: "What's the total revenue?"
       "Average order value?"
       "Count customers by region"
       "Sum sales by product category"
```

---

## 💡 Example Conversations

### Simple Query
```
You: "Show me my data"
AI: Lists all tables → Shows first 10 rows from each
```

### Filtered Analysis
```
You: "Active customers in California with orders > $1000"
AI: Queries with filters → Returns matching records
```

### Statistical Analysis
```
You: "Sales performance by region"
AI: Aggregates SUM grouped by region → Bar chart suggestion
```

### Code Generation
```
You: "Create an API endpoint for my products table"
AI: 
1. Checks product table schema
2. Generates Express/FastAPI endpoint code
3. Includes proper validation based on column types
4. Saves to project
```

---

## 🔒 Security

✅ **Read-only** - AI cannot modify your data
✅ **Local** - Data never leaves your machine  
✅ **Safe** - No dangerous SQL operations
✅ **Logged** - All queries logged to console

---

## 🚀 Getting Started

1. **Import data** via User Data page
2. **Open AI chat** in EGDesk
3. **Ask questions** about your data
4. **AI automatically** discovers and queries tables

That's it! No configuration needed. 🎉

---

## 🆚 Internal AI vs External MCP

| Feature | Internal AI | External MCP |
|---------|------------|--------------|
| **Access Method** | Built-in chat | HTTP API |
| **Speed** | ⚡ Instant | 🐌 HTTP overhead |
| **Setup** | Zero setup | Requires HTTP server |
| **Use Case** | Quick queries | Claude Desktop, Cursor |
| **Code editing** | ✅ Yes | ❌ No |
| **Data queries** | ✅ Yes | ✅ Yes |

**Recommendation:** Use **internal AI** for fast, integrated queries while coding!

---

## 📖 Full Documentation

- **Implementation Details:** `INTERNAL-AI-USER-DATA-INTEGRATION.md`
- **Security Analysis:** `AI-CHAT-MCP-SECURITY-ANALYSIS.md`
- **Architecture Diagrams:** `AI-CHAT-MCP-ARCHITECTURE-DIAGRAM.md`
- **MCP Integration:** `USER-DATA-MCP-INTEGRATION.md`
