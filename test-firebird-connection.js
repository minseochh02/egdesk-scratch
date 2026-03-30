/**
 * Firebird SQL Connection Test Script
 *
 * This script tests connection to a Firebird database and lists all tables.
 *
 * CONFIGURATION REQUIRED:
 * Fill in your database details below before running.
 */

const Firebird = require('node-firebird');

// ============================================================================
// CONFIGURE YOUR DATABASE HERE
// ============================================================================

const config = {
  // For local embedded database:
  // database: 'C:\\path\\to\\your\\database.fdb',

  // For remote server:
  host: 'localhost',           // Change to your server IP/hostname
  port: 3050,                  // Default Firebird port
  database: 'C:\\DATABASE.FDB', // Path on the server or full connection string

  user: 'SYSDBA',              // Default Firebird username
  password: 'masterkey',       // Default Firebird password

  // Optional settings:
  lowercase_keys: false,        // Convert column names to lowercase
  role: null,                   // Database role
  pageSize: 4096,              // Page size
};

// ============================================================================
// TEST SCRIPT
// ============================================================================

console.log('🔍 Firebird Database Connection Test\n');
console.log('Configuration:');
console.log(`  Host: ${config.host || 'embedded'}`);
console.log(`  Database: ${config.database}`);
console.log(`  User: ${config.user}`);
console.log(`  Port: ${config.port || 'default'}\n`);

console.log('Attempting to connect...\n');

Firebird.attach(config, (err, db) => {
  if (err) {
    console.error('❌ Connection Failed!');
    console.error('Error:', err.message);
    console.error('\nCommon issues:');
    console.error('  1. Database file path is incorrect');
    console.error('  2. Firebird server is not running');
    console.error('  3. Wrong username/password');
    console.error('  4. Database file doesn\'t exist');
    console.error('  5. No network access to server (if remote)');
    process.exit(1);
  }

  console.log('✅ Connected successfully!\n');
  console.log('Querying system tables...\n');

  // Query to get all user tables (excluding system tables)
  const query = `
    SELECT
      RDB$RELATION_NAME as TABLE_NAME
    FROM
      RDB$RELATIONS
    WHERE
      RDB$SYSTEM_FLAG = 0
      AND RDB$VIEW_BLR IS NULL
    ORDER BY
      RDB$RELATION_NAME
  `;

  db.query(query, (err, result) => {
    if (err) {
      console.error('❌ Query Failed!');
      console.error('Error:', err.message);
      db.detach();
      process.exit(1);
    }

    console.log('📋 Tables found in database:\n');
    console.log('═══════════════════════════════════════');

    if (result.length === 0) {
      console.log('  (No user tables found)');
    } else {
      result.forEach((row, index) => {
        const tableName = row.TABLE_NAME.trim();
        console.log(`  ${index + 1}. ${tableName}`);
      });
    }

    console.log('═══════════════════════════════════════');
    console.log(`\nTotal: ${result.length} table(s)\n`);

    // Get more details for each table
    console.log('Getting table details...\n');

    if (result.length > 0) {
      const tableName = result[0].TABLE_NAME.trim();
      console.log(`Sample: Details for table "${tableName}":\n`);

      const detailQuery = `
        SELECT
          RF.RDB$FIELD_NAME as COLUMN_NAME,
          F.RDB$FIELD_TYPE as FIELD_TYPE,
          F.RDB$FIELD_LENGTH as FIELD_LENGTH
        FROM
          RDB$RELATION_FIELDS RF
          JOIN RDB$FIELDS F ON RF.RDB$FIELD_SOURCE = F.RDB$FIELD_NAME
        WHERE
          RF.RDB$RELATION_NAME = '${tableName}'
        ORDER BY
          RF.RDB$FIELD_POSITION
      `;

      db.query(detailQuery, (err, columns) => {
        if (err) {
          console.error('Error getting columns:', err.message);
        } else {
          console.log('  Columns:');
          columns.forEach((col) => {
            const colName = col.COLUMN_NAME.trim();
            const fieldType = getFieldTypeName(col.FIELD_TYPE);
            console.log(`    - ${colName} (${fieldType})`);
          });
        }

        // Close connection
        db.detach((err) => {
          if (err) {
            console.error('\n⚠️  Warning: Error closing connection:', err.message);
          } else {
            console.log('\n✅ Connection closed successfully');
          }
          console.log('\n🎉 Test completed!');
        });
      });
    } else {
      // No tables, just close
      db.detach((err) => {
        if (err) {
          console.error('\n⚠️  Warning: Error closing connection:', err.message);
        } else {
          console.log('✅ Connection closed successfully');
        }
        console.log('\n🎉 Test completed!');
      });
    }
  });
});

// Helper function to convert Firebird field types to readable names
function getFieldTypeName(type) {
  const types = {
    7: 'SMALLINT',
    8: 'INTEGER',
    10: 'FLOAT',
    12: 'DATE',
    13: 'TIME',
    14: 'CHAR',
    16: 'BIGINT',
    27: 'DOUBLE',
    35: 'TIMESTAMP',
    37: 'VARCHAR',
    40: 'CSTRING',
    261: 'BLOB',
  };
  return types[type] || `UNKNOWN(${type})`;
}
