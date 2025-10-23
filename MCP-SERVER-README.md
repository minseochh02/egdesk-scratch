# MCP Server Architecture for EGDesk

## Overview

The MCP (Model Context Protocol) Server is a core component of EGDesk that enables users to securely connect their personal data (Gmail, desktop files, etc.) with AI assistants like Claude Desktop or our public server proxy service. The server acts as a secure bridge between user data and AI applications.

## Architecture

The system has two distinct paths for data access:

### Path 1: HTTPS Server with Supabase Tunnel Server
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   EGDesk App    │    │   Local SQLite   │    │   HTTPS Server  │    │   Supabase      │
│                 │    │                  │    │   (localhost)   │    │   (Tunnel + DB) │
│ • Folder Setup  │───►│ • User Configs   │◄──►│ • Data Access   │◄──►│ • WSS (Secure)  │
│ • Data Config   │    │ • Gmail Data     │    │ • Security      │    │ • Tunnel Server │
│ • OAuth Setup   │    │ • File Metadata  │    │ • Tool Registry │    │ • Database      │
└─────────────────┘    └──────────────────┘    └─────────────────┘    └─────────────────┘
```

### Path 2: Stdio Server for Claude Desktop
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   EGDesk App    │    │   Local SQLite   │    │   Stdio Server  │    │   Claude Desktop│
│                 │    │                  │    │   (MCP)         │    │   Application   │
│ • Folder Setup  │───►│ • User Configs   │◄──►│ • Data Access   │◄──►│ • Direct Access │
│ • Data Config   │    │ • Gmail Data     │    │ • Security      │    │ • Local Only    │
│ • OAuth Setup   │    │ • File Metadata  │    │ • Tool Registry │    │ • No Network    │
└─────────────────┘    └──────────────────┘    └─────────────────┘    └─────────────────┘
```

## How It Works

### 1. **User Setup in EGDesk Application**
- User installs EGDesk application
- User selects folders and configures data sources (Gmail, file paths, etc.)
- User authenticates with their services (Google OAuth, etc.)
- All configurations and data are saved to local SQLite database

### 2. **Two Deployment Paths**

#### **Path 1: HTTPS Server with Supabase Tunnel Server**
- EGDesk starts HTTPS server on localhost (e.g., port 8080)
- HTTPS server reads data from local SQLite database
- **EGDesk creates outbound WSS (secure WebSocket) connection** to Supabase
- **Supabase acts as tunnel server** - stores the WebSocket connection and provides public HTTPS URL
- **Public users access data** through Supabase's public HTTPS API, which forwards via secure WebSocket
- All data remains on user's machine, Supabase only forwards requests through the encrypted tunnel

#### **Path 2: Stdio Server for Claude Desktop**
- EGDesk starts stdio-based MCP server
- Stdio server reads data from local SQLite database
- Claude Desktop connects directly to the stdio server
- No network communication - everything stays local
- Direct integration with Claude Desktop application

### 3. **Data Flow & Security**
- **Path 1**: User data → SQLite → HTTPS server → WSS (secure WebSocket) → Supabase tunnel server → Public HTTPS API
- **Path 2**: User data → SQLite → Stdio server → Claude Desktop
- All data remains on user's machine in both paths
- All network communication is encrypted (HTTPS/WSS)
- User maintains full control over what data is accessible
- No data is sent to third parties without explicit user consent

## Server Types

### 1. **Stdio MCP Server (Claude Desktop)**
- **Type**: Stdio-based server
- **Purpose**: Direct integration with Claude Desktop
- **Transport**: Standard input/output streams
- **Data Source**: Local SQLite database
- **Security**: All data stays on user's machine
- **Network**: No network communication required

```json
{
  "type": "stdio",
  "name": "EGDesk MCP Server (Claude)",
  "transport": "stdio",
  "dataSource": "local_sqlite",
  "tools": ["fetch_emails", "send_email", "manage_labels", "read_files"]
}
```

### 2. **HTTPS Server with Supabase Tunnel Server**
- **Type**: HTTPS-based server with secure WebSocket tunneling
- **Purpose**: Public API access via Supabase tunnel server
- **Transport**: HTTPS REST API through secure WebSocket tunnel
- **Data Source**: Local SQLite database
- **Security**: End-to-end encrypted transmission, user authentication
- **Network**: Localhost HTTPS server + WSS + Supabase tunnel server

```json
{
  "type": "https",
  "name": "EGDesk HTTPS Server",
  "transport": "https",
  "port": 8080,
  "ssl": {
    "enabled": true,
    "cert": "path/to/cert.pem",
    "key": "path/to/key.pem"
  },
  "tunnel": {
    "enabled": true,
    "type": "wss",
    "server": "supabase",
    "public_url": "https://your-project.supabase.co/functions/v1/tunnel/abc123"
  },
  "endpoints": ["/api/gmail", "/api/files", "/api/health", "/api/config"]
}
```

## Tool Registry

All tools are declared and managed by EGDesk, but data is provided by users:

### **Gmail Tools**
```json
{
  "gmail": {
    "fetch_emails": {
      "description": "Fetch emails from user's Gmail account",
      "parameters": {
        "userEmail": "string",
        "maxResults": "number",
        "query": "string"
      },
      "dataSource": "user_gmail_account"
    },
    "send_email": {
      "description": "Send email via user's Gmail account",
      "parameters": {
        "to": "string",
        "subject": "string",
        "body": "string"
      },
      "dataSource": "user_gmail_account"
    },
    "manage_labels": {
      "description": "Manage Gmail labels",
      "parameters": {
        "action": "create|update|delete",
        "labelName": "string"
      },
      "dataSource": "user_gmail_account"
    }
  }
}
```

### **File System Tools**
```json
{
  "filesystem": {
    "fs_read_file": {
      "description": "Read file contents as text",
      "parameters": {
        "path": "string",
        "encoding": "string (optional, default: utf8)"
      },
      "dataSource": "user_local_files"
    },
    "fs_write_file": {
      "description": "Write content to a file (creates or overwrites)",
      "parameters": {
        "path": "string",
        "content": "string"
      },
      "dataSource": "user_local_files"
    },
    "fs_edit_file": {
      "description": "Edit file with multiple operations (search/replace, insert, delete)",
      "parameters": {
        "path": "string",
        "edits": "array of edit operations"
      },
      "dataSource": "user_local_files"
    },
    "fs_list_directory": {
      "description": "List directory contents",
      "parameters": {
        "path": "string"
      },
      "dataSource": "user_local_files"
    },
    "fs_create_directory": {
      "description": "Create a directory (optionally recursive)",
      "parameters": {
        "path": "string",
        "recursive": "boolean (optional, default: true)"
      },
      "dataSource": "user_local_files"
    },
    "fs_move_file": {
      "description": "Move or rename a file or directory",
      "parameters": {
        "source": "string",
        "destination": "string"
      },
      "dataSource": "user_local_files"
    },
    "fs_copy_file": {
      "description": "Copy a file",
      "parameters": {
        "source": "string",
        "destination": "string"
      },
      "dataSource": "user_local_files"
    },
    "fs_delete_file": {
      "description": "Delete a file or directory",
      "parameters": {
        "path": "string",
        "recursive": "boolean (optional, default: false)"
      },
      "dataSource": "user_local_files"
    },
    "fs_search_files": {
      "description": "Search for files matching a pattern (supports regex and content search)",
      "parameters": {
        "path": "string",
        "pattern": "string (regex)",
        "searchContent": "boolean (optional, default: false)",
        "maxResults": "number (optional, default: 100)"
      },
      "dataSource": "user_local_files"
    },
    "fs_get_file_info": {
      "description": "Get file metadata (size, dates, permissions)",
      "parameters": {
        "path": "string"
      },
      "dataSource": "user_local_files"
    },
    "fs_get_directory_tree": {
      "description": "Get directory tree structure",
      "parameters": {
        "path": "string",
        "maxDepth": "number (optional, default: 3)"
      },
      "dataSource": "user_local_files"
    },
    "fs_download_file": {
      "description": "Download a file as binary data (returns base64-encoded via tunnel)",
      "parameters": {
        "path": "string"
      },
      "dataSource": "user_local_files",
      "note": "File is sent as base64 through WebSocket tunnel - works for files up to ~100MB"
    }
  }
}
```

## User Data Configuration

### **Gmail Integration**
```json
{
  "gmail": {
    "enabled": true,
    "serviceAccountKey": {
      "type": "service_account",
      "project_id": "user-project",
      "client_email": "gmail-service@user-project.iam.gserviceaccount.com",
      "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
    },
    "scopes": [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send"
    ],
    "domainUsers": ["user@company.com", "admin@company.com"]
  }
}
```

### **File System Access**
```json
{
  "filesystem": {
    "enabled": true,
    "allowedPaths": [
      "/Users/username/Desktop",
      "/Users/username/Documents",
      "/Users/username/Projects"
    ],
    "restrictedPaths": [
      "/System",
      "/Library",
      "/Applications"
    ]
  }
}
```

## Security Model

### **Data Privacy**
- ✅ All user data remains on user's machine (local mode)
- ✅ No data is sent to EGDesk servers without explicit consent
- ✅ User controls what data is accessible to AI assistants
- ✅ All API keys and credentials are stored locally and encrypted

### **Access Control**
- ✅ User must explicitly grant access to each data source
- ✅ Granular permissions (read-only vs read-write)
- ✅ Time-limited access tokens
- ✅ Audit logging of all data access

### **Network Security**
- ✅ HTTPS encryption for all public API calls
- ✅ WSS (secure WebSocket) for tunnel connections
- ✅ End-to-end encryption from local server to public API
- ✅ OAuth 2.0 for service authentication
- ✅ Rate limiting to prevent abuse
- ✅ CORS protection for web access

## Installation & Setup

### **For End Users**

1. **Download EGDesk**
   ```bash
   # Download from our website or package manager
   npm install -g egdesk
   ```

2. **Configure Data Sources**
   ```bash
   egdesk configure gmail
   egdesk configure filesystem
   ```

3. **Start MCP Server**
   ```bash
   # Local mode (Claude Desktop)
   egdesk mcp start --local
   
   # Public mode (Web API)
   egdesk mcp start --public --port 8080
   ```

4. **Configure Claude Desktop** (if using local mode)
   ```bash
   egdesk mcp configure-claude
   ```

### **For Developers**

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Build MCP Server**
   ```bash
   npm run build:mcp
   ```

3. **Run Development Server**
   ```bash
   npm run dev:mcp
   ```

## API Endpoints

### **Health Check**
```http
GET /api/health
```
```json
{
  "message": "EGDesk HTTP Server is running",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0",
  "status": "healthy"
}
```

### **Gmail Data Access**
```http
GET /api/gmail
```
```json
{
  "success": true,
  "data": {
    "users": ["user@company.com"],
    "totalMessages": 1250,
    "unreadMessages": 45
  }
}
```

### **File System Access**
```http
GET /api/files?path=/Users/username/Documents
```
```json
{
  "success": true,
  "files": [
    {
      "name": "document.pdf",
      "path": "/Users/username/Documents/document.pdf",
      "size": 1024000,
      "modified": "2024-01-15T09:00:00.000Z"
    }
  ]
}
```

### **Configuration Access**
```http
GET /api/config
```
```json
{
  "success": true,
  "config": {
    "gmail": {
      "enabled": true,
      "users": ["user@company.com"]
    },
    "filesystem": {
      "enabled": true,
      "allowedPaths": ["/Users/username/Documents"]
    }
  }
}
```

## Monitoring & Management

### **Server Status**
```json
{
  "status": "running",
  "uptime": 3600,
  "memoryUsage": 45.2,
  "cpuUsage": 12.5,
  "healthCheck": {
    "status": "healthy",
    "lastCheck": "2024-01-15T11:30:00.000Z",
    "responseTime": 45
  }
}
```

### **Logs**
```json
{
  "timestamp": "2024-01-15T11:30:00.000Z",
  "level": "info",
  "message": "Gmail API request processed",
  "source": "gmail-api",
  "userId": "user@company.com"
}
```

## Use Cases

### **1. Personal AI Assistant**
- User connects their Gmail to Claude Desktop
- Claude can read and respond to emails
- All data stays on user's machine

### **2. Team Collaboration**
- Company admin sets up Gmail integration
- Team members can query company email data
- Access controlled by admin permissions

### **3. Public API Service**
- Developer integrates with our public API
- Access to user's data through secure proxy
- Rate-limited and authenticated access

### **4. Custom Applications**
- Developers build custom tools using our MCP server
- Access to user's data through standardized interface
- Easy integration with existing workflows

## Troubleshooting

### **Common Issues**

1. **Server Won't Start**
   - Check if port is available
   - Verify Node.js/TypeScript installation
   - Check file permissions

2. **Gmail Authentication Fails**
   - Verify service account key
   - Check OAuth scopes
   - Ensure domain delegation is set up

3. **HTTP Server Issues**
   - Check if port 8080 is available
   - Verify Node.js/TypeScript server is running
   - Check Supabase proxy configuration

4. **Claude Desktop Integration Issues**
   - Restart Claude Desktop after configuration
   - Check Claude config file location
   - Verify MCP server is running

### **Debug Mode**
```bash
egdesk mcp start --debug --verbose
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 📧 Email: support@egdesk.com
- 💬 Discord: [EGDesk Community](https://discord.gg/egdesk)
- 📖 Documentation: [docs.egdesk.com](https://docs.egdesk.com)
- 🐛 Issues: [GitHub Issues](https://github.com/egdesk/egdesk/issues)
