#!/usr/bin/env node
/**
 * Build script for Gmail MCP Server
 * Compiles TypeScript to JavaScript for standalone execution
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('📦 Building Gmail MCP Server...');

// Create dist directory if it doesn't exist
const distDir = path.join(__dirname, 'dist-mcp');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Compile TypeScript
console.log('🔨 Compiling TypeScript...');
try {
  execSync('npx tsc src/main/mcp/server.ts --outDir dist-mcp --module commonjs --target es2020 --esModuleInterop --skipLibCheck --resolveJsonModule', {
    stdio: 'inherit',
  });
  console.log('✅ TypeScript compiled successfully');
} catch (error) {
  console.error('❌ TypeScript compilation failed');
  process.exit(1);
}

// Make the output executable
const serverPath = path.join(distDir, 'server.js');
if (fs.existsSync(serverPath)) {
  fs.chmodSync(serverPath, '755');
  console.log('✅ Made server executable');
}

console.log(`\n✨ Build complete!`);
console.log(`📍 MCP Server: ${serverPath}`);
console.log(`\n📖 Add this to your Claude Desktop config:`);
console.log(`\n{`);
console.log(`  "mcpServers": {`);
console.log(`    "gmail-sqlite": {`);
console.log(`      "command": "node",`);
console.log(`      "args": ["${serverPath}"]`);
console.log(`    }`);
console.log(`  }`);
console.log(`}\n`);

