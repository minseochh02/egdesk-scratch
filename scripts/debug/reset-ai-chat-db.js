#!/usr/bin/env node

/**
 * Reset AI Chat SQLite Database
 * 
 * This script drops and recreates the AI chat database with the correct schema
 * that includes support for 'tool' role messages.
 * 
 * Usage: node scripts/debug/reset-ai-chat-db.js
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const os = require('os');

// Get the database path (same as in test-sqlite-data.js)
let dataDir;
if (process.platform === 'darwin') {
  dataDir = path.join(os.homedir(), 'Library', 'Application Support', 'EGDesk', 'ai-chat');
} else if (process.platform === 'win32') {
  dataDir = path.join(os.homedir(), 'AppData', 'Roaming', 'EGDesk', 'ai-chat');
} else {
  dataDir = path.join(os.homedir(), '.config', 'EGDesk', 'ai-chat');
}

const dbPath = path.join(dataDir, 'ai-chat.db');

console.log('🔧 AI Chat Database Reset Script');
console.log('================================');
console.log('📁 Database path:', dbPath);
console.log('📁 Data directory:', dataDir);

// Check if database exists
if (fs.existsSync(dbPath)) {
  console.log('✅ Database file exists');
  
  // Get file size
  const stats = fs.statSync(dbPath);
  console.log('📊 Database size:', (stats.size / 1024).toFixed(2), 'KB');
  
  // Backup the database before dropping
  const backupPath = dbPath + '.backup.' + Date.now();
  fs.copyFileSync(dbPath, backupPath);
  console.log('💾 Backup created:', backupPath);
} else {
  console.log('⚠️  Database file does not exist');
}

try {
  // Ensure data directory exists
  if (!fs.existsSync(dataDir)) {
    console.log('📁 Creating data directory...');
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Connect to database
  console.log('🔌 Connecting to database...');
  const db = new Database(dbPath);
  
  // Get current schema info
  console.log('📋 Current schema:');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('   Tables:', tables.map(t => t.name));
  
  // Check current role constraint
  const messagesSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='messages'").get();
  if (messagesSchema) {
    console.log('   Messages table schema:', messagesSchema.sql);
  }
  
  // Drop existing tables
  console.log('🗑️  Dropping existing tables...');
  db.exec('DROP TABLE IF EXISTS messages');
  db.exec('DROP TABLE IF EXISTS conversations');
  
  // Create new schema with correct role constraint
  console.log('🏗️  Creating new schema...');
  
  // Create conversations table
  db.exec(`
    CREATE TABLE conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      project_context TEXT, -- JSON string for project context
      is_active BOOLEAN DEFAULT 1
    )
  `);
  
  // Create messages table with correct role constraint
  db.exec(`
    CREATE TABLE messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'model', 'tool')),
      content TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      tool_call_id TEXT,
      tool_status TEXT CHECK (tool_status IN ('executing', 'completed', 'failed')),
      metadata TEXT, -- JSON string for additional data
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    )
  `);
  
  // Create indexes for better performance
  db.exec(`
    CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
    CREATE INDEX idx_messages_timestamp ON messages(timestamp);
    CREATE INDEX idx_messages_role ON messages(role);
    CREATE INDEX idx_messages_tool_call_id ON messages(tool_call_id);
    CREATE INDEX idx_conversations_created_at ON conversations(created_at);
    CREATE INDEX idx_conversations_is_active ON conversations(is_active);
  `);
  
  // Create triggers for updated_at
  db.exec(`
    CREATE TRIGGER update_conversations_timestamp 
    AFTER UPDATE ON conversations 
    BEGIN 
      UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; 
    END;
  `);
  
  // Verify the new schema
  console.log('✅ New schema created successfully');
  console.log('📋 New schema:');
  const newTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('   Tables:', newTables.map(t => t.name));
  
  const newMessagesSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='messages'").get();
  if (newMessagesSchema) {
    console.log('   Messages table schema:', newMessagesSchema.sql);
  }
  
  // Test inserting a tool message
  console.log('🧪 Testing tool role insertion...');
  try {
    const testConversation = db.prepare(`
      INSERT INTO conversations (id, title, project_context, is_active)
      VALUES (?, ?, ?, ?)
    `);
    testConversation.run('test-conversation', 'Test Conversation', '{}', 1);
    
    const testMessage = db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `);
    testMessage.run('test-msg', 'test-conversation', 'tool', 'Test tool message', new Date().toISOString());
    
    console.log('✅ Tool role insertion test passed');
    
    // Clean up test data
    db.exec('DELETE FROM messages WHERE id = "test-msg"');
    db.exec('DELETE FROM conversations WHERE id = "test-conversation"');
    
  } catch (testError) {
    console.error('❌ Tool role insertion test failed:', testError.message);
  }
  
  // Close database
  db.close();
  
  console.log('🎉 Database reset completed successfully!');
  console.log('💡 You can now restart your application to use the updated schema.');
  
} catch (error) {
  console.error('❌ Error resetting database:', error);
  process.exit(1);
}
