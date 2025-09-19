#!/usr/bin/env node

/**
 * SQLite Data Test Script
 * 
 * This script lists all data in the SQLite database tables for testing and debugging purposes.
 * It provides comprehensive information about conversations and messages stored in the database.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

class SQLiteDataTester {
  constructor() {
    this.db = null;
    this.dbPath = '';
  }

  /**
   * Initialize the database connection
   */
  async initialize() {
    try {
      console.log(`${colors.cyan}🔧 Initializing SQLite Data Tester...${colors.reset}`);
      
      // Determine database path based on OS
      let dataDir;
      if (process.platform === 'darwin') {
        dataDir = path.join(os.homedir(), 'Library', 'Application Support', 'EGDesk', 'ai-chat');
      } else if (process.platform === 'win32') {
        dataDir = path.join(os.homedir(), 'AppData', 'Roaming', 'EGDesk', 'ai-chat');
      } else {
        dataDir = path.join(os.homedir(), '.config', 'EGDesk', 'ai-chat');
      }

      this.dbPath = path.join(dataDir, 'ai-chat.db');
      
      // Check if database exists
      if (!fs.existsSync(this.dbPath)) {
        console.log(`${colors.yellow}⚠️  Database not found at: ${this.dbPath}${colors.reset}`);
        console.log(`${colors.dim}   Make sure the EGDesk application has been run at least once to create the database.${colors.reset}`);
        return false;
      }

      // Connect to database
      this.db = new Database(this.dbPath);
      console.log(`${colors.green}✅ Connected to database: ${this.dbPath}${colors.reset}`);
      
      return true;
    } catch (error) {
      console.error(`${colors.red}❌ Failed to initialize database:${colors.reset}`, error.message);
      return false;
    }
  }

  /**
   * Get database schema information
   */
  getSchemaInfo() {
    if (!this.db) return null;

    try {
      const tables = this.db.prepare(`
        SELECT name, sql 
        FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `).all();

      return tables;
    } catch (error) {
      console.error(`${colors.red}❌ Error getting schema info:${colors.reset}`, error.message);
      return null;
    }
  }

  /**
   * Get table row counts
   */
  getTableCounts() {
    if (!this.db) return {};

    try {
      const counts = {};
      const tables = ['conversations', 'messages'];
      
      for (const table of tables) {
        const result = this.db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
        counts[table] = result.count;
      }
      
      return counts;
    } catch (error) {
      console.error(`${colors.red}❌ Error getting table counts:${colors.reset}`, error.message);
      return {};
    }
  }

  /**
   * List all conversations
   */
  listConversations() {
    if (!this.db) return [];

    try {
      const conversations = this.db.prepare(`
        SELECT 
          id,
          title,
          created_at,
          updated_at,
          project_context,
          is_active,
          CASE 
            WHEN is_active = 1 THEN 'Active'
            ELSE 'Inactive'
          END as status
        FROM conversations 
        ORDER BY updated_at DESC
      `).all();

      return conversations;
    } catch (error) {
      console.error(`${colors.red}❌ Error listing conversations:${colors.reset}`, error.message);
      return [];
    }
  }

  /**
   * List all messages
   */
  listMessages(options = {}) {
    if (!this.db) return [];

    try {
      const { limit = 100, conversationId = null } = options;
      
      let query = `
        SELECT 
          m.id,
          m.conversation_id,
          m.role,
          SUBSTR(m.content, 1, 100) as content_preview,
          LENGTH(m.content) as content_length,
          m.timestamp,
          m.tool_call_id,
          m.tool_status,
          c.title as conversation_title
        FROM messages m
        LEFT JOIN conversations c ON m.conversation_id = c.id
      `;
      
      const params = [];
      if (conversationId) {
        query += ' WHERE m.conversation_id = ?';
        params.push(conversationId);
      }
      
      query += ' ORDER BY m.timestamp DESC LIMIT ?';
      params.push(limit);

      const messages = this.db.prepare(query).all(...params);
      return messages;
    } catch (error) {
      console.error(`${colors.red}❌ Error listing messages:${colors.reset}`, error.message);
      return [];
    }
  }

  /**
   * Get conversation statistics
   */
  getConversationStats() {
    if (!this.db) return null;

    try {
      const stats = this.db.prepare(`
        SELECT 
          COUNT(*) as total_conversations,
          SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_conversations,
          SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive_conversations,
          MIN(created_at) as oldest_conversation,
          MAX(updated_at) as latest_activity
        FROM conversations
      `).get();

      const messageStats = this.db.prepare(`
        SELECT 
          COUNT(*) as total_messages,
          COUNT(DISTINCT conversation_id) as conversations_with_messages,
          SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as user_messages,
          SUM(CASE WHEN role = 'model' THEN 1 ELSE 0 END) as model_messages,
          SUM(CASE WHEN role = 'tool' THEN 1 ELSE 0 END) as tool_messages,
          MIN(timestamp) as oldest_message,
          MAX(timestamp) as newest_message
        FROM messages
      `).get();

      return { ...stats, ...messageStats };
    } catch (error) {
      console.error(`${colors.red}❌ Error getting conversation stats:${colors.reset}`, error.message);
      return null;
    }
  }

  /**
   * Get detailed conversation with messages
   */
  getConversationDetails(conversationId) {
    if (!this.db) return null;

    try {
      const conversation = this.db.prepare(`
        SELECT * FROM conversations WHERE id = ?
      `).get(conversationId);

      if (!conversation) return null;

      const messages = this.db.prepare(`
        SELECT 
          id,
          role,
          content,
          timestamp,
          tool_call_id,
          tool_status,
          metadata
        FROM messages 
        WHERE conversation_id = ? 
        ORDER BY timestamp ASC
      `).all(conversationId);

      return { conversation, messages };
    } catch (error) {
      console.error(`${colors.red}❌ Error getting conversation details:${colors.reset}`, error.message);
      return null;
    }
  }

  /**
   * Format and display data
   */
  displayData() {
    console.log(`\n${colors.bright}${colors.blue}📊 SQLite Database Analysis${colors.reset}`);
    console.log(`${colors.dim}${'='.repeat(50)}${colors.reset}\n`);

    // Database info
    console.log(`${colors.bright}📁 Database Information:${colors.reset}`);
    console.log(`   Path: ${this.dbPath}`);
    console.log(`   Size: ${this.getDatabaseSize()} MB\n`);

    // Schema info
    const schema = this.getSchemaInfo();
    if (schema) {
      console.log(`${colors.bright}🏗️  Database Schema:${colors.reset}`);
      schema.forEach(table => {
        console.log(`   📋 Table: ${colors.cyan}${table.name}${colors.reset}`);
      });
      console.log();
    }

    // Table counts
    const counts = this.getTableCounts();
    console.log(`${colors.bright}📈 Table Row Counts:${colors.reset}`);
    Object.entries(counts).forEach(([table, count]) => {
      console.log(`   ${table}: ${colors.green}${count}${colors.reset} rows`);
    });
    console.log();

    // Statistics
    const stats = this.getConversationStats();
    if (stats) {
      console.log(`${colors.bright}📊 Statistics:${colors.reset}`);
      console.log(`   Total Conversations: ${colors.green}${stats.total_conversations}${colors.reset}`);
      console.log(`   Active Conversations: ${colors.green}${stats.active_conversations}${colors.reset}`);
      console.log(`   Inactive Conversations: ${colors.yellow}${stats.inactive_conversations}${colors.reset}`);
      console.log(`   Total Messages: ${colors.green}${stats.total_messages}${colors.reset}`);
      console.log(`   User Messages: ${colors.blue}${stats.user_messages}${colors.reset}`);
      console.log(`   Model Messages: ${colors.magenta}${stats.model_messages}${colors.reset}`);
      console.log(`   Tool Messages: ${colors.cyan}${stats.tool_messages}${colors.reset}`);
      console.log(`   Oldest Conversation: ${colors.dim}${stats.oldest_conversation || 'N/A'}${colors.reset}`);
      console.log(`   Latest Activity: ${colors.dim}${stats.latest_activity || 'N/A'}${colors.reset}`);
      console.log();
    }

    // List conversations
    const conversations = this.listConversations();
    if (conversations.length > 0) {
      console.log(`${colors.bright}💬 Conversations:${colors.reset}`);
      conversations.forEach((conv, index) => {
        console.log(`   ${index + 1}. ${colors.cyan}${conv.id}${colors.reset}`);
        console.log(`      Title: ${conv.title || colors.dim}Untitled${colors.reset}`);
        console.log(`      Status: ${conv.is_active ? colors.green + 'Active' : colors.yellow + 'Inactive' + colors.reset}`);
        console.log(`      Created: ${colors.dim}${conv.created_at}${colors.reset}`);
        console.log(`      Updated: ${colors.dim}${conv.updated_at}${colors.reset}`);
        if (conv.project_context) {
          try {
            const context = JSON.parse(conv.project_context);
            console.log(`      Project Context: ${colors.dim}${JSON.stringify(context, null, 2).replace(/\n/g, '\n      ')}${colors.reset}`);
          } catch (e) {
            console.log(`      Project Context: ${colors.dim}${conv.project_context}${colors.reset}`);
          }
        }
        console.log();
      });
    } else {
      console.log(`${colors.yellow}⚠️  No conversations found in database${colors.reset}\n`);
    }

    // List recent messages
    const messages = this.listMessages({ limit: 20 });
    if (messages.length > 0) {
      console.log(`${colors.bright}💭 Recent Messages (last 20):${colors.reset}`);
      messages.forEach((msg, index) => {
        console.log(`   ${index + 1}. ${colors.cyan}${msg.id}${colors.reset}`);
        console.log(`      Conversation: ${colors.blue}${msg.conversation_id}${colors.reset} ${msg.conversation_title ? `(${msg.conversation_title})` : ''}`);
        console.log(`      Role: ${this.getRoleColor(msg.role)}${msg.role}${colors.reset}`);
        console.log(`      Content: ${colors.dim}${msg.content_preview}${msg.content_length > 100 ? '...' : ''}${colors.reset}`);
        console.log(`      Length: ${msg.content_length} characters`);
        console.log(`      Timestamp: ${colors.dim}${msg.timestamp}${colors.reset}`);
        if (msg.tool_call_id) {
          console.log(`      Tool Call ID: ${colors.magenta}${msg.tool_call_id}${colors.reset}`);
        }
        if (msg.tool_status) {
          console.log(`      Tool Status: ${this.getToolStatusColor(msg.tool_status)}${msg.tool_status}${colors.reset}`);
        }
        console.log();
      });
    } else {
      console.log(`${colors.yellow}⚠️  No messages found in database${colors.reset}\n`);
    }
  }

  /**
   * Get role color for display
   */
  getRoleColor(role) {
    switch (role) {
      case 'user': return colors.blue;
      case 'model': return colors.magenta;
      case 'tool': return colors.cyan;
      default: return colors.white;
    }
  }

  /**
   * Get tool status color for display
   */
  getToolStatusColor(status) {
    switch (status) {
      case 'executing': return colors.yellow;
      case 'completed': return colors.green;
      case 'failed': return colors.red;
      default: return colors.white;
    }
  }

  /**
   * Get database size in MB
   */
  getDatabaseSize() {
    if (!fs.existsSync(this.dbPath)) return 0;
    const stats = fs.statSync(this.dbPath);
    return Math.round((stats.size / 1024 / 1024) * 100) / 100;
  }

  /**
   * Export data to JSON file
   */
  exportToJSON(filename = null) {
    if (!this.db) return false;

    try {
      const data = {
        export_timestamp: new Date().toISOString(),
        database_path: this.dbPath,
        database_size_mb: this.getDatabaseSize(),
        schema: this.getSchemaInfo(),
        table_counts: this.getTableCounts(),
        statistics: this.getConversationStats(),
        conversations: this.listConversations(),
        messages: this.listMessages({ limit: 1000 }) // Export more messages for analysis
      };

      const exportPath = filename || path.join(process.cwd(), `sqlite-export-${Date.now()}.json`);
      fs.writeFileSync(exportPath, JSON.stringify(data, null, 2));
      
      console.log(`${colors.green}✅ Data exported to: ${exportPath}${colors.reset}`);
      return true;
    } catch (error) {
      console.error(`${colors.red}❌ Error exporting data:${colors.reset}`, error.message);
      return false;
    }
  }

  /**
   * Clean up database connection
   */
  cleanup() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// Main execution
async function main() {
  const tester = new SQLiteDataTester();
  
  try {
    const initialized = await tester.initialize();
    if (!initialized) {
      process.exit(1);
    }

    // Display all data
    tester.displayData();

    // Check for export flag
    const exportFlag = process.argv.includes('--export');
    if (exportFlag) {
      const exportIndex = process.argv.indexOf('--export');
      const filename = process.argv[exportIndex + 1] || null;
      tester.exportToJSON(filename);
    }

    // Check for specific conversation flag
    const conversationFlag = process.argv.includes('--conversation');
    if (conversationFlag) {
      const convIndex = process.argv.indexOf('--conversation');
      const conversationId = process.argv[convIndex + 1];
      if (conversationId) {
        console.log(`${colors.bright}🔍 Conversation Details for: ${conversationId}${colors.reset}\n`);
        const details = tester.getConversationDetails(conversationId);
        if (details) {
          console.log(`${colors.bright}Conversation:${colors.reset}`);
          console.log(JSON.stringify(details.conversation, null, 2));
          console.log(`\n${colors.bright}Messages (${details.messages.length}):${colors.reset}`);
          details.messages.forEach((msg, index) => {
            console.log(`\n${index + 1}. [${msg.role}] ${msg.timestamp}`);
            console.log(msg.content);
            if (msg.tool_call_id) console.log(`Tool Call ID: ${msg.tool_call_id}`);
            if (msg.tool_status) console.log(`Tool Status: ${msg.tool_status}`);
          });
        } else {
          console.log(`${colors.red}❌ Conversation not found${colors.reset}`);
        }
      }
    }

  } catch (error) {
    console.error(`${colors.red}❌ Unexpected error:${colors.reset}`, error);
    process.exit(1);
  } finally {
    tester.cleanup();
  }
}

// Help text
function showHelp() {
  console.log(`
${colors.bright}SQLite Data Test Script${colors.reset}

Usage: node test-sqlite-data.js [options]

Options:
  --export [filename]    Export all data to JSON file
  --conversation <id>    Show detailed information for specific conversation
  --help                Show this help message

Examples:
  node test-sqlite-data.js
  node test-sqlite-data.js --export
  node test-sqlite-data.js --export my-data.json
  node test-sqlite-data.js --conversation conv_1234567890
`);
}

// Check for help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showHelp();
  process.exit(0);
}

// Run the script
main();
