import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { app } from 'electron';
import log from 'electron-log';
import mysql from 'mysql2/promise';
import extract from 'extract-zip';
import fetch from 'node-fetch';
import { spawn, ChildProcess } from 'child_process';

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface DatabaseTable {
  name: string;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    key: string;
    default: string | null;
  }>;
}

export interface DatabaseConnection {
  mysql?: mysql.Connection;
}

export class DatabaseManager {
  private static instance: DatabaseManager;

  private appDataPath: string;

  private databasePath: string;

  private mysqlDataPath: string;

  private mysqlBinaryPath: string;

  private mysqlProcess: ChildProcess | null = null;

  private connection: DatabaseConnection = {};

  private isInitialized = false;

  private constructor() {
    this.appDataPath = app.getPath('userData');
    this.databasePath = path.join(this.appDataPath, 'database');
    this.mysqlDataPath = path.join(this.databasePath, 'mysql');
    this.mysqlBinaryPath = path.join(this.mysqlDataPath, 'bin');
  }

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  /**
   * Initialize the database system
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      log.info('Initializing database manager...');

      // Create necessary directories
      await this.createDirectories();

      // Initialize MySQL only
      await this.initializeMySQL();

      this.isInitialized = true;
      log.info('Database manager initialized successfully');
    } catch (error) {
      log.error('Failed to initialize database manager:', error);
      throw error;
    }
  }

  /**
   * Create necessary directories for database files
   */
  private async createDirectories(): Promise<void> {
    const dirs = [
      this.databasePath,
      this.mysqlDataPath,
      this.mysqlBinaryPath,
      path.join(this.mysqlDataPath, 'data'),
      path.join(this.mysqlDataPath, 'logs'),
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        log.info(`Created directory: ${dir}`);
      }
    }
  }

  /**
   * Get MySQL download URL based on platform
   */
  private getMySQLDownloadInfo(): { url: string; filename: string } {
    const platform = os.platform();
    const arch = os.arch();

    // MySQL 8.0.33 Community Server downloads
    if (platform === 'darwin') {
      if (arch === 'arm64') {
        return {
          url: 'https://dev.mysql.com/get/Downloads/MySQL-8.0/mysql-8.0.33-macos13-arm64.tar.gz',
          filename: 'mysql-8.0.33-macos13-arm64.tar.gz',
        };
      }
      return {
        url: 'https://dev.mysql.com/get/Downloads/MySQL-8.0/mysql-8.0.33-macos13-x86_64.tar.gz',
        filename: 'mysql-8.0.33-macos13-x86_64.tar.gz',
      };
    }
    if (platform === 'win32') {
      return {
        url: 'https://dev.mysql.com/get/Downloads/MySQL-8.0/mysql-8.0.33-winx64.zip',
        filename: 'mysql-8.0.33-winx64.zip',
      };
    }
    // Linux
    return {
      url: 'https://dev.mysql.com/get/Downloads/MySQL-8.0/mysql-8.0.33-linux-glibc2.28-x86_64.tar.xz',
      filename: 'mysql-8.0.33-linux-glibc2.28-x86_64.tar.xz',
    };
  }

  /**
   * Download MySQL binary if not exists
   */
  private async downloadMySQL(): Promise<void> {
    const downloadInfo = this.getMySQLDownloadInfo();
    const downloadPath = path.join(this.databasePath, downloadInfo.filename);

    // Check if already downloaded
    if (fs.existsSync(downloadPath)) {
      log.info('MySQL binary already downloaded');
      return;
    }

    log.info(`Downloading MySQL from: ${downloadInfo.url}`);

    try {
      const response = await fetch(downloadInfo.url);
      if (!response.ok) {
        throw new Error(`Failed to download MySQL: ${response.statusText}`);
      }

      const buffer = await response.buffer();
      fs.writeFileSync(downloadPath, buffer);

      log.info(`MySQL downloaded successfully: ${downloadPath}`);
    } catch (error) {
      log.error('Failed to download MySQL:', error);
      throw error;
    }
  }

  /**
   * Extract MySQL binary
   */
  private async extractMySQL(): Promise<void> {
    const downloadInfo = this.getMySQLDownloadInfo();
    const downloadPath = path.join(this.databasePath, downloadInfo.filename);
    const extractPath = this.mysqlDataPath;

    // Check if already extracted
    const mysqldPath = path.join(
      this.mysqlBinaryPath,
      os.platform() === 'win32' ? 'mysqld.exe' : 'mysqld',
    );
    if (fs.existsSync(mysqldPath)) {
      log.info('MySQL binary already extracted');
      return;
    }

    log.info(`Extracting MySQL to: ${extractPath}`);

    try {
      if (downloadInfo.filename.endsWith('.zip')) {
        await extract(downloadPath, { dir: extractPath });
      } else {
        // For tar.gz and tar.xz files, we'll use a simple approach
        // In production, you might want to use a proper tar extraction library
        const { spawn } = require('child_process');
        await new Promise((resolve, reject) => {
          const tar = spawn('tar', [
            '-xf',
            downloadPath,
            '-C',
            extractPath,
            '--strip-components=1',
          ]);
          tar.on('close', (code) => {
            if (code === 0) {
              resolve(code);
            } else {
              reject(new Error(`tar extraction failed with code ${code}`));
            }
          });
        });
      }

      log.info('MySQL extracted successfully');
    } catch (error) {
      log.error('Failed to extract MySQL:', error);
      throw error;
    }
  }

  /**
   * Initialize MySQL database (portable)
   */
  private async initializeMySQL(): Promise<void> {
    try {
      // Check if portable MySQL is already running
      if (await this.isPortableMySQLRunning()) {
        log.info('Portable MySQL is already running');
      } else {
        // Download MySQL binary if needed
        await this.downloadMySQL();

        // Extract MySQL binary if needed
        await this.extractMySQL();

        // Initialize MySQL data directory if needed
        await this.initializeMySQLData();

        // Start portable MySQL server
        await this.startPortableMySQL();
      }

      // Wait a moment for MySQL to be ready
      await this.waitForMySQL();

      // Connect to the portable MySQL server
      const config: DatabaseConfig = {
        host: 'localhost',
        port: 3307, // Use different port to avoid conflicts
        user: 'root',
        password: '',
        database: 'egdesk',
      };

      this.connection.mysql = await mysql.createConnection(config);

      // Create database if it doesn't exist
      await this.connection.mysql.execute(
        'CREATE DATABASE IF NOT EXISTS egdesk',
      );
      await this.connection.mysql.execute('USE egdesk');

      // Create tables
      await this.createMySQLTables();

      log.info('Portable MySQL database initialized successfully');
    } catch (error) {
      log.error('Failed to initialize portable MySQL:', error);
      throw error;
    }
  }

  /**
   * Initialize MySQL data directory
   */
  private async initializeMySQLData(): Promise<void> {
    const dataDir = path.join(this.mysqlDataPath, 'data');
    const mysqldPath = path.join(
      this.mysqlBinaryPath,
      os.platform() === 'win32' ? 'mysqld.exe' : 'mysqld',
    );

    // Check if data directory is already initialized
    if (fs.existsSync(path.join(dataDir, 'mysql'))) {
      log.info('MySQL data directory already initialized');
      return;
    }

    log.info('Initializing MySQL data directory...');

    try {
      await new Promise((resolve, reject) => {
        const mysqld = spawn(mysqldPath, [
          '--initialize-insecure',
          `--datadir=${dataDir}`,
          `--basedir=${this.mysqlDataPath}`,
          '--default-authentication-plugin=mysql_native_password',
        ]);

        mysqld.stdout?.on('data', (data) => {
          log.info(`MySQL init stdout: ${data}`);
        });

        mysqld.stderr?.on('data', (data) => {
          log.info(`MySQL init stderr: ${data}`);
        });

        mysqld.on('close', (code) => {
          if (code === 0) {
            log.info('MySQL data directory initialized successfully');
            resolve(code);
          } else {
            reject(new Error(`MySQL initialization failed with code ${code}`));
          }
        });
      });
    } catch (error) {
      log.error('Failed to initialize MySQL data directory:', error);
      throw error;
    }
  }

  /**
   * Check if portable MySQL is already running
   */
  private async isPortableMySQLRunning(): Promise<boolean> {
    try {
      const testConnection = await mysql.createConnection({
        host: 'localhost',
        port: 3307,
        user: 'root',
        password: '',
        connectTimeout: 1000,
      });
      await testConnection.end();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Start portable MySQL server
   */
  private async startPortableMySQL(): Promise<void> {
    try {
      const mysqldPath = path.join(
        this.mysqlBinaryPath,
        os.platform() === 'win32' ? 'mysqld.exe' : 'mysqld',
      );
      const dataDir = path.join(this.mysqlDataPath, 'data');
      const logDir = path.join(this.mysqlDataPath, 'logs');
      const errorLogPath = path.join(logDir, 'error.log');
      const pidFilePath = path.join(logDir, 'mysql.pid');
      const socketPath = path.join(logDir, 'mysql.sock');

      log.info('Starting portable MySQL server...');

      const args = [
        `--datadir=${dataDir}`,
        `--basedir=${this.mysqlDataPath}`,
        `--port=3307`,
        `--socket=${socketPath}`,
        `--pid-file=${pidFilePath}`,
        `--log-error=${errorLogPath}`,
        '--skip-networking=false',
        '--bind-address=127.0.0.1',
        '--default-authentication-plugin=mysql_native_password',
        '--skip-grant-tables', // Allow connections without password initially
      ];

      this.mysqlProcess = spawn(mysqldPath, args, {
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.mysqlProcess.stdout?.on('data', (data) => {
        log.info(`MySQL stdout: ${data}`);
      });

      this.mysqlProcess.stderr?.on('data', (data) => {
        log.info(`MySQL stderr: ${data}`);
      });

      this.mysqlProcess.on('close', (code) => {
        log.info(`MySQL process exited with code ${code}`);
        this.mysqlProcess = null;
      });

      this.mysqlProcess.on('error', (error) => {
        log.error('MySQL process error:', error);
        this.mysqlProcess = null;
      });

      log.info('Portable MySQL server started on port 3307');

      // Give MySQL a moment to start
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      log.error('Failed to start portable MySQL:', error);
      throw error;
    }
  }

  /**
   * Wait for MySQL to be ready
   */
  private async waitForMySQL(): Promise<void> {
    const maxAttempts = 30;
    const delay = 1000; // 1 second

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const testConnection = await mysql.createConnection({
          host: 'localhost',
          port: 3307,
          user: 'root',
          password: '',
          connectTimeout: 1000,
        });
        await testConnection.end();
        log.info(`MySQL ready after ${attempt} attempts`);
        return;
      } catch (error) {
        if (attempt === maxAttempts) {
          throw new Error('MySQL failed to start within timeout');
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Create MySQL tables
   */
  private async createMySQLTables(): Promise<void> {
    if (!this.connection.mysql) return;

    const tables = [
      `CREATE TABLE IF NOT EXISTS wordpress_connections (
        id VARCHAR(255) PRIMARY KEY,
        url VARCHAR(500) NOT NULL,
        username VARCHAR(255),
        password VARCHAR(500),
        api_key VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS sync_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        connection_id VARCHAR(255) NOT NULL,
        sync_type VARCHAR(100) NOT NULL,
        status VARCHAR(100) NOT NULL,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP NULL,
        files_processed INT DEFAULT 0,
        error_message TEXT,
        FOREIGN KEY (connection_id) REFERENCES wordpress_connections (id)
      )`,
      `CREATE TABLE IF NOT EXISTS app_settings (
        \`key\` VARCHAR(255) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`,
    ];

    for (const table of tables) {
      await this.connection.mysql.execute(table);
    }
  }

  /**
   * Get database connection
   */
  public getConnection(): DatabaseConnection {
    return this.connection;
  }

  /**
   * Execute a query (MySQL only)
   */
  public async executeQuery(query: string, params: any[] = []): Promise<any> {
    try {
      if (this.connection.mysql) {
        const [rows] = await this.connection.mysql.execute(query, params);
        return rows;
      }
      throw new Error('MySQL connection not available');
    } catch (error) {
      log.error('Query execution failed:', error);
      throw error;
    }
  }

  /**
   * Save WordPress connection
   */
  public async saveWordPressConnection(connection: any): Promise<any> {
    const query = `INSERT INTO wordpress_connections (id, url, username, password, api_key, created_at, updated_at) 
                   VALUES (?, ?, ?, ?, ?, NOW(), NOW())
                   ON DUPLICATE KEY UPDATE 
                   username = VALUES(username), password = VALUES(password), api_key = VALUES(api_key), updated_at = NOW()`;

    const params = [
      connection.id,
      connection.url,
      connection.username,
      connection.password,
      connection.api_key,
    ];

    return this.executeQuery(query, params);
  }

  /**
   * Get WordPress connections
   */
  public async getWordPressConnections(): Promise<any[]> {
    const query =
      'SELECT * FROM wordpress_connections ORDER BY created_at DESC';
    return this.executeQuery(query);
  }

  /**
   * Save sync history
   */
  public async saveSyncHistory(syncData: any): Promise<any> {
    const query = `INSERT INTO sync_history (connection_id, sync_type, status, started_at, completed_at, files_processed, error_message) 
                   VALUES (?, ?, ?, NOW(), ?, ?, ?)`;

    const params = [
      syncData.connection_id,
      syncData.sync_type,
      syncData.status,
      syncData.completed_at,
      syncData.files_processed || 0,
      syncData.error_message || null,
    ];

    return this.executeQuery(query, params);
  }

  /**
   * Get sync history
   */
  public async getSyncHistory(connectionId?: string): Promise<any[]> {
    let query = 'SELECT * FROM sync_history';
    const params: any[] = [];

    if (connectionId) {
      query += ' WHERE connection_id = ?';
      params.push(connectionId);
    }

    query += ' ORDER BY started_at DESC';
    return this.executeQuery(query, params);
  }

  /**
   * Save app setting
   */
  public async saveAppSetting(key: string, value: string): Promise<any> {
    const query = `INSERT INTO app_settings (\`key\`, value, updated_at) VALUES (?, ?, NOW())
                   ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()`;

    return this.executeQuery(query, [key, value]);
  }

  /**
   * Get app setting
   */
  public async getAppSetting(key: string): Promise<string | null> {
    const query = 'SELECT value FROM app_settings WHERE key = ?';
    const result = await this.executeQuery(query, [key]);

    if (result && result.length > 0) {
      return result[0].value;
    }
    return null;
  }

  /**
   * Close database connections
   */
  public async close(): Promise<void> {
    try {
      if (this.connection.mysql) {
        await this.connection.mysql.end();
        log.info('MySQL connection closed');
      }

      // Stop MySQL process if it's running
      if (this.mysqlProcess) {
        log.info('Stopping MySQL server...');
        this.mysqlProcess.kill('SIGTERM');

        // Wait for process to exit
        await new Promise((resolve) => {
          if (this.mysqlProcess) {
            this.mysqlProcess.on('close', resolve);
            // Force kill after 5 seconds
            setTimeout(() => {
              if (this.mysqlProcess) {
                this.mysqlProcess.kill('SIGKILL');
                resolve(null);
              }
            }, 5000);
          } else {
            resolve(null);
          }
        });

        this.mysqlProcess = null;
        log.info('MySQL server stopped');
      }

      this.isInitialized = false;
    } catch (error) {
      log.error('Error closing database connections:', error);
    }
  }

  /**
   * Get database status
   */
  public getStatus(): { mysql: boolean; initialized: boolean } {
    return {
      mysql: !!this.connection.mysql,
      initialized: this.isInitialized,
    };
  }

  /**
   * Get database schema information
   */
  public async getSchemaInfo(): Promise<DatabaseTable[]> {
    try {
      if (this.connection.mysql) {
        return await this.getMySQLSchemaInfo();
      }
      return [];
    } catch (error) {
      log.error('Error getting schema info:', error);
      return [];
    }
  }

  /**
   * Get MySQL schema information
   */
  private async getMySQLSchemaInfo(): Promise<DatabaseTable[]> {
    if (!this.connection.mysql) return [];

    try {
      // Get table names
      const [tablesResult] = await this.connection.mysql.execute(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'egdesk'",
      );

      const tables: DatabaseTable[] = [];

      for (const tableRow of tablesResult as any[]) {
        const tableName = tableRow.table_name;

        // Get column information
        const [columnsResult] = await this.connection.mysql.execute(
          `SELECT 
            column_name, 
            data_type, 
            is_nullable, 
            column_key, 
            column_default
          FROM information_schema.columns 
          WHERE table_schema = 'egdesk' AND table_name = ?`,
          [tableName],
        );

        const columns = (columnsResult as any[]).map((col) => ({
          name: col.column_name,
          type: col.data_type,
          nullable: col.is_nullable === 'YES',
          key: col.column_key || '',
          default: col.column_default,
        }));

        tables.push({
          name: tableName,
          columns,
        });
      }

      return tables;
    } catch (error) {
      log.error('Error getting MySQL schema info:', error);
      return [];
    }
  }

  /**
   * Get connection information
   */
  public async getConnectionInfo(): Promise<{
    mysql?: {
      host: string;
      port: number;
      database: string;
      version?: string;
    };
  }> {
    const info: any = {};

    try {
      if (this.connection.mysql) {
        const [versionResult] = await this.connection.mysql.execute(
          'SELECT VERSION() as version',
        );
        info.mysql = {
          host: 'localhost',
          port: 3307,
          database: 'egdesk',
          version: (versionResult as any[])[0]?.version,
        };
      }
    } catch (error) {
      log.error('Error getting connection info:', error);
    }

    return info;
  }
}

export default DatabaseManager;
