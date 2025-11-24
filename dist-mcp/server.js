#!/usr/bin/env node
'use strict';
/**
 * Gmail MCP Server
 *
 * Provides Model Context Protocol server for accessing Gmail data from SQLite database.
 * This server acts as a bridge between Claude Desktop and the Gmail/SQLite backend.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Database path helper
function getDatabasePath() {
    if (electron_1.app) {
        return path_1.default.join(electron_1.app.getPath('userData'), 'database', 'conversations.db');
    }
    // Fallback for standalone mode
    return '/Users/minseocha/Library/Application Support/egdesk/database/conversations.db';
}
// Initialize database connection
let db = null;
function getDatabase() {
    if (!db) {
        const dbPath = getDatabasePath();
        if (!fs_1.default.existsSync(dbPath)) {
            throw new Error(`Database not found at ${dbPath}. Please run the Electron app first.`);
        }
        db = new better_sqlite3_1.default(dbPath);
    }
    return db;
}
// Create MCP server
const server = new index_js_1.Server({
    name: 'gmail-sqlite-server',
    version: '1.0.0',
}, {
    capabilities: {
        tools: {},
        resources: {},
    },
});
// List available tools
server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: 'gmail_list_users',
                description: 'List all domain users from the Gmail database',
                inputSchema: {
                    type: 'object',
                    properties: {},
                },
            },
            {
                name: 'gmail_get_user_messages',
                description: 'Get Gmail messages for a specific user',
                inputSchema: {
                    type: 'object',
                    properties: {
                        email: {
                            type: 'string',
                            description: 'The email address of the user',
                        },
                        limit: {
                            type: 'number',
                            description: 'Maximum number of messages to return (default: 50)',
                            default: 50,
                        },
                        offset: {
                            type: 'number',
                            description: 'Number of messages to skip (for pagination)',
                            default: 0,
                        },
                    },
                    required: ['email'],
                },
            },
            {
                name: 'gmail_get_user_stats',
                description: 'Get Gmail statistics for a specific user',
                inputSchema: {
                    type: 'object',
                    properties: {
                        email: {
                            type: 'string',
                            description: 'The email address of the user',
                        },
                    },
                    required: ['email'],
                },
            },
            {
                name: 'gmail_search_messages',
                description: 'Search Gmail messages by subject or content',
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: {
                            type: 'string',
                            description: 'Search query (searches subject, from, to, and snippet)',
                        },
                        email: {
                            type: 'string',
                            description: 'Optional: filter by specific user email',
                        },
                        limit: {
                            type: 'number',
                            description: 'Maximum number of messages to return (default: 50)',
                            default: 50,
                        },
                    },
                    required: ['query'],
                },
            },
            {
                name: 'db_get_stats',
                description: 'Get database statistics (total users, messages, etc.)',
                inputSchema: {
                    type: 'object',
                    properties: {},
                },
            },
            {
                name: 'db_get_path',
                description: 'Get the database file path',
                inputSchema: {
                    type: 'object',
                    properties: {},
                },
            },
        ],
    };
});
// Handle tool calls
server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        const database = getDatabase();
        switch (name) {
            case 'gmail_list_users': {
                const stmt = database.prepare(`
          SELECT id, email, name, display_name, is_admin, is_suspended, last_login_time, created_at, updated_at
          FROM domain_users
          ORDER BY email ASC
        `);
                const users = stmt.all();
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                success: true,
                                count: users.length,
                                users: users.map((user) => ({
                                    id: user.id,
                                    email: user.email,
                                    name: user.name,
                                    displayName: user.display_name,
                                    isAdmin: Boolean(user.is_admin),
                                    isSuspended: Boolean(user.is_suspended),
                                    lastLoginTime: user.last_login_time,
                                    createdAt: user.created_at,
                                    updatedAt: user.updated_at,
                                })),
                            }, null, 2),
                        },
                    ],
                };
            }
            case 'gmail_get_user_messages': {
                const { email, limit = 50, offset = 0 } = args;
                const stmt = database.prepare(`
          SELECT id, user_email, subject, from_email, to_email, date, snippet,
                 is_read, is_important, labels, thread_id, created_at, updated_at
          FROM gmail_messages
          WHERE user_email = ?
          ORDER BY date DESC
          LIMIT ? OFFSET ?
        `);
                const messages = stmt.all(email, limit, offset);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                success: true,
                                count: messages.length,
                                userEmail: email,
                                messages: messages.map((msg) => ({
                                    id: msg.id,
                                    subject: msg.subject,
                                    from: msg.from_email,
                                    to: msg.to_email,
                                    date: msg.date,
                                    snippet: msg.snippet,
                                    isRead: Boolean(msg.is_read),
                                    isImportant: Boolean(msg.is_important),
                                    labels: JSON.parse(msg.labels || '[]'),
                                    threadId: msg.thread_id,
                                    createdAt: msg.created_at,
                                    updatedAt: msg.updated_at,
                                })),
                            }, null, 2),
                        },
                    ],
                };
            }
            case 'gmail_get_user_stats': {
                const { email } = args;
                const stmt = database.prepare(`
          SELECT id, user_email, total_messages, unread_messages, important_messages,
                 sent_messages, recent_activity, created_at, updated_at
          FROM gmail_stats
          WHERE user_email = ?
          ORDER BY updated_at DESC
          LIMIT 1
        `);
                const stats = stmt.get(email);
                if (!stats) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify({
                                    success: false,
                                    error: 'Stats not found for user',
                                }),
                            },
                        ],
                    };
                }
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                success: true,
                                userEmail: email,
                                stats: {
                                    totalMessages: stats.total_messages,
                                    unreadMessages: stats.unread_messages,
                                    importantMessages: stats.important_messages,
                                    sentMessages: stats.sent_messages,
                                    recentActivity: stats.recent_activity,
                                    updatedAt: stats.updated_at,
                                },
                            }, null, 2),
                        },
                    ],
                };
            }
            case 'gmail_search_messages': {
                const { query, email, limit = 50 } = args;
                let sql = `
          SELECT id, user_email, subject, from_email, to_email, date, snippet,
                 is_read, is_important, labels, thread_id, created_at, updated_at
          FROM gmail_messages
          WHERE (subject LIKE ? OR from_email LIKE ? OR to_email LIKE ? OR snippet LIKE ?)
        `;
                const params = [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`];
                if (email) {
                    sql += ' AND user_email = ?';
                    params.push(email);
                }
                sql += ' ORDER BY date DESC LIMIT ?';
                params.push(limit);
                const stmt = database.prepare(sql);
                const messages = stmt.all(...params);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                success: true,
                                count: messages.length,
                                query,
                                messages: messages.map((msg) => ({
                                    id: msg.id,
                                    userEmail: msg.user_email,
                                    subject: msg.subject,
                                    from: msg.from_email,
                                    to: msg.to_email,
                                    date: msg.date,
                                    snippet: msg.snippet,
                                    isRead: Boolean(msg.is_read),
                                    isImportant: Boolean(msg.is_important),
                                    labels: JSON.parse(msg.labels || '[]'),
                                    threadId: msg.thread_id,
                                })),
                            }, null, 2),
                        },
                    ],
                };
            }
            case 'db_get_stats': {
                const userCount = database.prepare('SELECT COUNT(*) as count FROM domain_users').get();
                const messageCount = database.prepare('SELECT COUNT(*) as count FROM gmail_messages').get();
                const statsCount = database.prepare('SELECT COUNT(*) as count FROM gmail_stats').get();
                const lastUpdated = database.prepare('SELECT MAX(updated_at) as last_updated FROM gmail_messages').get();
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                success: true,
                                databaseStats: {
                                    totalUsers: userCount.count,
                                    totalMessages: messageCount.count,
                                    totalStats: statsCount.count,
                                    lastUpdated: lastUpdated.last_updated,
                                },
                            }, null, 2),
                        },
                    ],
                };
            }
            case 'db_get_path': {
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                success: true,
                                databasePath: getDatabasePath(),
                                exists: fs_1.default.existsSync(getDatabasePath()),
                            }, null, 2),
                        },
                    ],
                };
            }
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    }
    catch (error) {
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    }),
                },
            ],
            isError: true,
        };
    }
});
// List available resources
server.setRequestHandler(types_js_1.ListResourcesRequestSchema, async () => {
    return {
        resources: [
            {
                uri: 'gmail://database/info',
                name: 'Database Information',
                description: 'Information about the Gmail SQLite database',
                mimeType: 'application/json',
            },
        ],
    };
});
// Read resource
server.setRequestHandler(types_js_1.ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    if (uri === 'gmail://database/info') {
        try {
            const database = getDatabase();
            const userCount = database.prepare('SELECT COUNT(*) as count FROM domain_users').get();
            const messageCount = database.prepare('SELECT COUNT(*) as count FROM gmail_messages').get();
            return {
                contents: [
                    {
                        uri,
                        mimeType: 'application/json',
                        text: JSON.stringify({
                            databasePath: getDatabasePath(),
                            totalUsers: userCount.count,
                            totalMessages: messageCount.count,
                            status: 'connected',
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            return {
                contents: [
                    {
                        uri,
                        mimeType: 'application/json',
                        text: JSON.stringify({
                            error: error instanceof Error ? error.message : 'Unknown error',
                            status: 'error',
                        }),
                    },
                ],
            };
        }
    }
    throw new Error(`Unknown resource: ${uri}`);
});
// Start the server
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error('Gmail MCP Server running on stdio');
}
main().catch((error) => {
    console.error('Server error:', error);
    process.exit(1);
});
