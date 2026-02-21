#!/usr/bin/env node
/**
 * CLI entry point for @egdesk/next-api-plugin
 *
 * Usage:
 *   npx egdesk-next-setup
 *   npx egdesk-next-setup --url http://localhost:8080 --api-key YOUR_KEY
 */

import { setupNextApiPlugin } from './index';
import * as path from 'path';

async function main() {
  const args = process.argv.slice(2);

  // Parse command line arguments
  let egdeskUrl = 'http://localhost:8080';
  let apiKey: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' && i + 1 < args.length) {
      egdeskUrl = args[i + 1];
      i++;
    } else if (args[i] === '--api-key' && i + 1 < args.length) {
      apiKey = args[i + 1];
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log('Usage: egdesk-next-setup [options]');
      console.log('');
      console.log('Options:');
      console.log('  --url <url>        EGDesk server URL (default: http://localhost:8080)');
      console.log('  --api-key <key>    API key for authentication');
      console.log('  --help, -h         Show this help message');
      console.log('');
      console.log('Example:');
      console.log('  egdesk-next-setup --url http://localhost:8080 --api-key mykey');
      process.exit(0);
    }
  }

  // Get current working directory (project root)
  const projectPath = process.cwd();

  console.log('🚀 EGDesk Next.js Setup');
  console.log(`📂 Project: ${projectPath}`);
  console.log(`🔗 EGDesk URL: ${egdeskUrl}`);
  console.log('');

  try {
    await setupNextApiPlugin(projectPath, { egdeskUrl, apiKey });
    process.exit(0);
  } catch (error) {
    console.error('Setup failed:', error);
    process.exit(1);
  }
}

main();
