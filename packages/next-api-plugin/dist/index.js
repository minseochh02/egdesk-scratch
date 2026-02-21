"use strict";
/**
 * @egdesk/next-api-plugin
 *
 * Next.js plugin for EGDesk database proxy integration.
 * Provides middleware-based database access for Next.js applications.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateHelpers = exports.generateProxy = exports.generateMiddleware = exports.discoverTables = void 0;
exports.setupNextApiPlugin = setupNextApiPlugin;
const setup_userdata_1 = require("./setup-userdata");
const generate_middleware_1 = require("./generate-middleware");
const generate_proxy_1 = require("./generate-proxy");
const generate_helpers_1 = require("./generate-helpers");
/**
 * Main setup function for Next.js projects
 *
 * Discovers tables and generates all necessary files:
 * - proxy.ts or middleware.ts (proxy interceptor)
 * - egdesk.config.ts (table definitions)
 * - egdesk-helpers.ts (helper functions)
 * - .env.local (environment variables)
 */
async function setupNextApiPlugin(projectPath, options = {}) {
    const { egdeskUrl = 'http://localhost:8080', apiKey, useProxy = true } = options;
    console.log('🔍 Discovering EGDesk user-data tables...');
    try {
        const tables = await (0, setup_userdata_1.discoverTables)(egdeskUrl, apiKey);
        if (tables.length === 0) {
            console.warn('⚠️  No tables found. Import data in EGDesk first.');
            console.log('');
            console.log('Generating files anyway with empty table list...');
        }
        else {
            console.log(`✅ Found ${tables.length} table(s):`);
            tables.forEach((table, index) => {
                console.log(`   ${index + 1}. ${table.displayName} (${table.rowCount} rows)`);
            });
        }
        const config = {
            apiKey: apiKey || null,
            baseUrl: egdeskUrl,
            tables,
            generatedAt: new Date().toISOString()
        };
        // Generate all configuration files
        console.log('');
        console.log('📝 Generating configuration files...');
        // Use proxy.ts (Next.js 16+) or middleware.ts (legacy)
        if (useProxy) {
            console.log('🔄 Using proxy.ts (Next.js 16+ recommended)');
            (0, generate_proxy_1.generateProxy)(projectPath);
        }
        else {
            console.log('🔄 Using middleware.ts (legacy)');
            (0, generate_middleware_1.generateMiddleware)(projectPath);
        }
        (0, setup_userdata_1.generateConfigFile)(projectPath, config);
        (0, generate_helpers_1.generateHelpers)(projectPath);
        (0, setup_userdata_1.updateEnvLocal)(projectPath, config);
        const proxyFile = useProxy ? 'proxy.ts' : 'middleware.ts';
        console.log('');
        console.log('✅ Setup complete! Files generated:');
        console.log(`   - ${proxyFile} (database proxy)`);
        console.log('   - egdesk.config.ts (type-safe config)');
        console.log('   - egdesk-helpers.ts (helper functions)');
        console.log('   - .env.local (environment variables)');
        console.log('');
        console.log('📝 Next steps:');
        console.log('   1. Add .env.local to your .gitignore');
        console.log('   2. Restart your Next.js dev server');
        console.log('   3. Import and use helpers in your components:');
        console.log('      import { queryTable } from "./egdesk-helpers"');
        console.log('      import { TABLES } from "./egdesk.config"');
        console.log('');
        console.log('Example usage in a component:');
        console.log('   const data = await queryTable(TABLES.table1.name, { limit: 10 });');
    }
    catch (error) {
        console.error('❌ Setup failed:', error);
        throw error;
    }
}
var setup_userdata_2 = require("./setup-userdata");
Object.defineProperty(exports, "discoverTables", { enumerable: true, get: function () { return setup_userdata_2.discoverTables; } });
var generate_middleware_2 = require("./generate-middleware");
Object.defineProperty(exports, "generateMiddleware", { enumerable: true, get: function () { return generate_middleware_2.generateMiddleware; } });
var generate_proxy_2 = require("./generate-proxy");
Object.defineProperty(exports, "generateProxy", { enumerable: true, get: function () { return generate_proxy_2.generateProxy; } });
var generate_helpers_2 = require("./generate-helpers");
Object.defineProperty(exports, "generateHelpers", { enumerable: true, get: function () { return generate_helpers_2.generateHelpers; } });
