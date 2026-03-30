/**
 * Find Firebird Database Files (.fdb, .gdb)
 *
 * This script searches common locations for Firebird database files
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Searching for Firebird database files...\n');

// Common locations to search
const searchPaths = [
  'C:\\Program Files (x86)\\',
  'C:\\Program Files\\',
  'C:\\ProgramData\\',
  'C:\\Users\\Public\\',
  'D:\\',
  'C:\\',
];

const extensions = ['.fdb', '.FDB', '.gdb', '.GDB'];
const foundDatabases = [];

// Function to search directory (non-recursive for speed)
function searchDirectory(dir, depth = 0) {
  if (depth > 3) return; // Limit depth to avoid taking too long

  try {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);

      try {
        const stat = fs.statSync(fullPath);

        if (stat.isFile()) {
          const ext = path.extname(item).toLowerCase();
          if (extensions.some(e => e.toLowerCase() === ext)) {
            const size = (stat.size / 1024 / 1024).toFixed(2); // Size in MB
            foundDatabases.push({
              path: fullPath,
              size: size,
              modified: stat.mtime
            });
            console.log(`✅ Found: ${fullPath}`);
            console.log(`   Size: ${size} MB`);
            console.log(`   Modified: ${stat.mtime.toLocaleString()}\n`);
          }
        } else if (stat.isDirectory() && depth < 3) {
          // Skip some common directories that won't have databases
          const skipDirs = ['Windows', 'System32', 'node_modules', 'AppData'];
          if (!skipDirs.some(skip => item === skip)) {
            searchDirectory(fullPath, depth + 1);
          }
        }
      } catch (err) {
        // Skip files/folders we can't access
      }
    }
  } catch (err) {
    // Skip directories we can't access
  }
}

console.log('Searching common locations (this may take a minute)...\n');

// Search each path
for (const searchPath of searchPaths) {
  if (fs.existsSync(searchPath)) {
    console.log(`📂 Searching ${searchPath}...`);
    searchDirectory(searchPath);
  }
}

console.log('\n═══════════════════════════════════════');
console.log(`Found ${foundDatabases.length} Firebird database file(s)`);
console.log('═══════════════════════════════════════\n');

if (foundDatabases.length === 0) {
  console.log('❌ No Firebird databases found in common locations.');
  console.log('\nTry these steps:');
  console.log('1. Open your ERP application');
  console.log('2. Look for database settings/configuration');
  console.log('3. Or manually search for *.fdb files in File Explorer');
  console.log('4. Check the ERP installation folder');
} else {
  console.log('💡 Next steps:');
  console.log('1. Copy one of the paths above');
  console.log('2. Edit test-firebird-connection.js');
  console.log('3. Set the "database" field to the path');
  console.log('4. Run: node test-firebird-connection.js\n');

  // Show a sample config
  if (foundDatabases.length > 0) {
    console.log('Example configuration:');
    console.log('─────────────────────────────────────');
    console.log('const config = {');
    console.log(`  database: '${foundDatabases[0].path.replace(/\\/g, '\\\\')}',`);
    console.log(`  user: 'SYSDBA',`);
    console.log(`  password: 'masterkey',`);
    console.log('};');
    console.log('─────────────────────────────────────\n');
  }
}
