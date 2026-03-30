# Firebird SQL Connection Test

This test script helps you verify connectivity to a Firebird database and list all tables.

## Prerequisites

1. Install the Firebird node module:
   ```bash
   npm install node-firebird
   ```

2. You need to know your Firebird database details:
   - Database file path (for embedded) OR host/port (for server)
   - Username (usually `SYSDBA`)
   - Password (often `masterkey`)

## Configuration

Edit `test-firebird-connection.js` and fill in your database details:

### For Local/Embedded Database:
```javascript
const config = {
  database: 'C:\\path\\to\\your\\database.fdb',
  user: 'SYSDBA',
  password: 'masterkey',
};
```

### For Remote Server:
```javascript
const config = {
  host: '192.168.1.100',      // Server IP
  port: 3050,                 // Firebird port
  database: 'C:\\DATABASE.FDB', // Path on server
  user: 'SYSDBA',
  password: 'masterkey',
};
```

## Finding Your Firebird Database

### Common Locations:

**Windows:**
- `C:\Program Files\YourApp\Database\DATABASE.FDB`
- `C:\ProgramData\YourApp\DATABASE.FDB`
- Check your application's settings/config files

**Finding the database file:**
1. Open your application
2. Look in: Settings → Database → Connection
3. Or check application installation folder
4. Or search for `*.fdb` files:
   ```
   Windows: Search "*.fdb" in File Explorer
   ```

### Connection String Format:
- Local: `C:\path\to\database.fdb`
- Remote: `192.168.1.100:C:\path\to\database.fdb`
- Remote (alternate): `192.168.1.100/3050:C:\path\to\database.fdb`

## Running the Test

```bash
node test-firebird-connection.js
```

## Expected Output

**Success:**
```
✅ Connected successfully!

📋 Tables found in database:

═══════════════════════════════════════
  1. CUSTOMERS
  2. ORDERS
  3. PRODUCTS
  4. INVOICES
═══════════════════════════════════════

Total: 4 table(s)
```

**Failure:**
```
❌ Connection Failed!
Error: I/O error during "open" operation for file "..."
```

## Troubleshooting

### Error: "I/O error during open operation"
- Database file doesn't exist
- Path is wrong
- No read permissions

### Error: "Unable to complete network request"
- Firebird server not running
- Wrong host/port
- Firewall blocking port 3050

### Error: "Your user name and password are not defined"
- Wrong username/password
- User doesn't have access to database

### Error: "unavailable database"
- Database file is locked by another process
- Database is corrupted

## What This Test Does

1. ✅ Connects to the Firebird database
2. ✅ Lists all user tables (not system tables)
3. ✅ Shows column details for the first table
4. ✅ Closes the connection cleanly

## Next Steps

Once this test succeeds, we can:
1. Integrate Firebird connectivity into EGDesk
2. Add database query actions to recordings
3. Build a UI for database operations
4. Create automation workflows that read/write database data

## Need Help?

Run the test and share:
1. The error message (if any)
2. Your application name
3. Where the application is installed
4. Whether it's a local or server database

I can help you find the correct database path and connection details!
