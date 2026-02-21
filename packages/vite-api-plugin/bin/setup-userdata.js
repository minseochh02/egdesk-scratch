#!/usr/bin/env node
/**
 * EGDesk User Data Setup CLI
 *
 * Run this to manually generate user-data configuration for your Vite project.
 *
 * Usage:
 *   npx @egdesk/vite-api-plugin setup-userdata
 *   npx @egdesk/vite-api-plugin setup-userdata --api-key YOUR_KEY
 *   npx @egdesk/vite-api-plugin setup-userdata --url http://localhost:8080
 */

const { setupUserData } = require('../dist/setup-userdata.js');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  apiKey: undefined,
  url: 'http://localhost:8080'
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--api-key' && args[i + 1]) {
    options.apiKey = args[i + 1];
    i++;
  } else if (args[i] === '--url' && args[i + 1]) {
    options.url = args[i + 1];
    i++;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
EGDesk User Data Setup

Automatically discovers EGDesk user-data tables and generates configuration files.

Usage:
  npx @egdesk/vite-api-plugin setup-userdata [options]

Options:
  --api-key KEY    API key for EGDesk HTTP server (optional)
  --url URL        EGDesk HTTP server URL (default: http://localhost:8080)
  --help, -h       Show this help message

Generated Files:
  .env.egdesk          Environment variables (table names, API key)
  egdesk.config.ts     Type-safe table definitions
  egdesk-helpers.ts    Helper functions for querying data

Examples:
  npx @egdesk/vite-api-plugin setup-userdata
  npx @egdesk/vite-api-plugin setup-userdata --api-key my-secret-key
  npx @egdesk/vite-api-plugin setup-userdata --url http://192.168.1.100:8080
    `);
    process.exit(0);
  }
}

// Run setup
const projectPath = process.cwd();

console.log('🚀 EGDesk User Data Setup');
console.log('');
console.log('📁 Project:', projectPath);
console.log('🌐 EGDesk URL:', options.url);
console.log('🔑 API Key:', options.apiKey ? '***' : 'none');
console.log('');

setupUserData(projectPath, options.url, options.apiKey)
  .then(() => {
    console.log('');
    console.log('✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('');
    console.error('❌ Setup failed:', error.message);
    console.error('');
    console.error('Troubleshooting:');
    console.error('  1. Ensure EGDesk HTTP server is running');
    console.error('  2. Check the server URL is correct');
    console.error('  3. Verify user-data MCP server is enabled in EGDesk');
    console.error('  4. Import data tables in EGDesk first');
    console.error('');
    process.exit(1);
  });
