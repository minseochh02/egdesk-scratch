#!/usr/bin/env node

/**
 * Standalone Bank Certificate Authentication Script
 *
 * This script demonstrates certificate-based authentication for bank logins.
 * It supports both:
 * 1. Client certificate authentication (mTLS) for API-based bank connections
 * 2. Browser automation with certificate handling for web-based logins
 *
 * Usage:
 *   node bank-cert-login-standalone.js
 *
 * Requirements:
 *   npm install axios https playwright
 */

const fs = require('fs');
const https = require('https');
const axios = require('axios');
const { chromium } = require('playwright');

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  // Bank API endpoint (if using API-based authentication)
  bankApiUrl: 'https://api.example-bank.com/auth/login',

  // Certificate paths
  certificates: {
    // PFX/P12 certificate (contains both private key and certificate)
    pfxPath: './certificates/bank-cert.pfx',
    pfxPassword: 'your-cert-password',

    // OR use separate PEM files
    certPath: './certificates/client-cert.pem',
    keyPath: './certificates/client-key.pem',
    caPath: './certificates/ca-cert.pem', // Certificate authority (optional)
  },

  // Bank login credentials
  credentials: {
    userId: 'your-user-id',
    password: 'your-password',
    certificatePassword: 'your-cert-password', // For web-based cert authentication
    accountType: 'corporate', // 'personal' or 'corporate'
  },

  // Browser automation settings
  browser: {
    headless: false, // Set to true for production
    slowMo: 100, // Slow down by 100ms for debugging
  },

  // Logging
  logging: {
    enabled: true,
    logFile: './bank-login.log',
  },
};

// =============================================================================
// LOGGING UTILITY
// =============================================================================

class Logger {
  constructor(config) {
    this.enabled = config.enabled;
    this.logFile = config.logFile;
  }

  log(level, message, data = null) {
    if (!this.enabled) return;

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...(data && { data }),
    };

    // Console output
    console.log(`[${timestamp}] [${level}] ${message}`);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }

    // File output
    try {
      fs.appendFileSync(
        this.logFile,
        JSON.stringify(logEntry) + '\n',
        'utf8'
      );
    } catch (error) {
      console.error('Failed to write to log file:', error.message);
    }
  }

  info(message, data) {
    this.log('INFO', message, data);
  }

  error(message, data) {
    this.log('ERROR', message, data);
  }

  success(message, data) {
    this.log('SUCCESS', message, data);
  }

  warn(message, data) {
    this.log('WARN', message, data);
  }
}

// =============================================================================
// CERTIFICATE LOADER
// =============================================================================

class CertificateLoader {
  /**
   * Load PFX certificate (includes both cert and private key)
   */
  static loadPfx(pfxPath, password) {
    try {
      const pfx = fs.readFileSync(pfxPath);
      return {
        pfx,
        passphrase: password,
      };
    } catch (error) {
      throw new Error(`Failed to load PFX certificate: ${error.message}`);
    }
  }

  /**
   * Load separate PEM certificate and key files
   */
  static loadPem(certPath, keyPath, caPath = null) {
    try {
      const cert = fs.readFileSync(certPath, 'utf8');
      const key = fs.readFileSync(keyPath, 'utf8');
      const ca = caPath ? fs.readFileSync(caPath, 'utf8') : null;

      return {
        cert,
        key,
        ...(ca && { ca }),
      };
    } catch (error) {
      throw new Error(`Failed to load PEM certificates: ${error.message}`);
    }
  }

  /**
   * Load certificates based on configuration
   */
  static load(config) {
    // Try PFX first
    if (fs.existsSync(config.pfxPath)) {
      return this.loadPfx(config.pfxPath, config.pfxPassword);
    }

    // Fall back to PEM
    if (fs.existsSync(config.certPath) && fs.existsSync(config.keyPath)) {
      return this.loadPem(
        config.certPath,
        config.keyPath,
        config.caPath
      );
    }

    throw new Error('No valid certificate files found');
  }
}

// =============================================================================
// API-BASED CERTIFICATE AUTHENTICATION
// =============================================================================

class ApiCertificateAuth {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * Login to bank API using client certificate (mTLS)
   */
  async login() {
    this.logger.info('Starting API certificate authentication...');

    try {
      // Load certificates
      const certConfig = CertificateLoader.load(this.config.certificates);

      // Create HTTPS agent with certificate
      const httpsAgent = new https.Agent({
        ...certConfig,
        rejectUnauthorized: true, // Set to false for self-signed certs (NOT recommended for production)
      });

      // Make authenticated request
      const response = await axios.post(
        this.config.bankApiUrl,
        {
          userId: this.config.credentials.userId,
          password: this.config.credentials.password,
          accountType: this.config.credentials.accountType,
        },
        {
          httpsAgent,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'BankCertAuth/1.0',
          },
          timeout: 30000, // 30 second timeout
        }
      );

      this.logger.success('API authentication successful', {
        status: response.status,
        data: response.data,
      });

      return {
        success: true,
        sessionToken: response.data.sessionToken,
        accountInfo: response.data.accountInfo,
      };
    } catch (error) {
      this.logger.error('API authentication failed', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Make an authenticated API request with certificate
   */
  async makeAuthenticatedRequest(endpoint, method = 'GET', data = null, sessionToken = null) {
    try {
      const certConfig = CertificateLoader.load(this.config.certificates);
      const httpsAgent = new https.Agent(certConfig);

      const requestConfig = {
        method,
        url: endpoint,
        httpsAgent,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'BankCertAuth/1.0',
          ...(sessionToken && { Authorization: `Bearer ${sessionToken}` }),
        },
        timeout: 30000,
      };

      if (data && (method === 'POST' || method === 'PUT')) {
        requestConfig.data = data;
      }

      const response = await axios(requestConfig);

      this.logger.info(`${method} request to ${endpoint} successful`, {
        status: response.status,
      });

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      this.logger.error(`${method} request failed`, {
        endpoint,
        error: error.message,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }
}

// =============================================================================
// BROWSER-BASED CERTIFICATE AUTHENTICATION (Playwright)
// =============================================================================

class BrowserCertificateAuth {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  /**
   * Initialize browser with certificate
   */
  async initialize() {
    this.logger.info('Initializing browser with certificate...');

    try {
      // Load certificates
      const certConfig = CertificateLoader.load(this.config.certificates);

      // Launch browser
      this.browser = await chromium.launch({
        headless: this.config.browser.headless,
        slowMo: this.config.browser.slowMo,
      });

      // Create context with client certificate
      // Note: Playwright has limited support for client certificates
      // For full cert support, you may need to use Chrome with --client-certificate flag
      this.context = await this.browser.newContext({
        ignoreHTTPSErrors: false,
        // Client certificate configuration (limited support)
        clientCertificates: certConfig.pfx ? [
          {
            origin: this.config.bankApiUrl,
            pfx: certConfig.pfx,
            passphrase: certConfig.passphrase,
          }
        ] : undefined,
      });

      this.page = await this.context.newPage();

      this.logger.success('Browser initialized successfully');

      return true;
    } catch (error) {
      this.logger.error('Browser initialization failed', {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Login to bank website using certificate
   * This is a template - customize for your specific bank's login flow
   */
  async login(bankUrl) {
    this.logger.info('Starting browser-based certificate login...');

    try {
      // Navigate to bank login page
      await this.page.goto(bankUrl, { waitUntil: 'networkidle' });
      this.logger.info('Navigated to bank login page');

      // Example: Fill in user ID
      await this.page.fill('input[name="userId"]', this.config.credentials.userId);
      this.logger.info('Filled user ID');

      // Example: Fill in password
      await this.page.fill('input[name="password"]', this.config.credentials.password);
      this.logger.info('Filled password');

      // If corporate account, may need to enter certificate password
      if (this.config.credentials.accountType === 'corporate') {
        const certPasswordField = await this.page.$('input[name="certificatePassword"]');
        if (certPasswordField) {
          await certPasswordField.fill(this.config.credentials.certificatePassword);
          this.logger.info('Filled certificate password');
        }
      }

      // Click login button
      await this.page.click('button[type="submit"]');
      this.logger.info('Clicked login button');

      // Wait for navigation or success indicator
      await this.page.waitForNavigation({ timeout: 30000 });

      // Check if login was successful
      const isLoggedIn = await this.checkLoginSuccess();

      if (isLoggedIn) {
        this.logger.success('Browser-based login successful');
        return { success: true };
      } else {
        this.logger.error('Login verification failed');
        return { success: false, error: 'Login verification failed' };
      }
    } catch (error) {
      this.logger.error('Browser-based login failed', {
        error: error.message,
      });

      // Take screenshot for debugging
      await this.takeScreenshot('login-error');

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Check if login was successful
   * Customize this based on your bank's success indicators
   */
  async checkLoginSuccess() {
    try {
      // Example: Check for dashboard element
      const dashboardElement = await this.page.$('.dashboard, #main-content, [data-testid="dashboard"]');
      return !!dashboardElement;

      // Alternative: Check URL
      // return this.page.url().includes('/dashboard');

      // Alternative: Check for specific text
      // return await this.page.locator('text=Welcome').isVisible();
    } catch (error) {
      return false;
    }
  }

  /**
   * Take screenshot for debugging
   */
  async takeScreenshot(name) {
    try {
      const filename = `./screenshots/${name}-${Date.now()}.png`;
      await this.page.screenshot({ path: filename, fullPage: true });
      this.logger.info(`Screenshot saved: ${filename}`);
    } catch (error) {
      this.logger.warn('Failed to take screenshot', { error: error.message });
    }
  }

  /**
   * Close browser
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.logger.info('Browser closed');
    }
  }
}

// =============================================================================
// MAIN EXECUTION
// =============================================================================

async function main() {
  const logger = new Logger(CONFIG.logging);

  logger.info('=================================================');
  logger.info('Bank Certificate Authentication Script');
  logger.info('=================================================');

  // Choose authentication method
  const authMethod = process.argv[2] || 'api'; // 'api' or 'browser'

  if (authMethod === 'api') {
    // API-based certificate authentication
    logger.info('Using API-based certificate authentication');

    const apiAuth = new ApiCertificateAuth(CONFIG, logger);
    const loginResult = await apiAuth.login();

    if (loginResult.success) {
      logger.success('Login successful!', loginResult);

      // Example: Make additional authenticated requests
      const accountResult = await apiAuth.makeAuthenticatedRequest(
        'https://api.example-bank.com/accounts',
        'GET',
        null,
        loginResult.sessionToken
      );

      if (accountResult.success) {
        logger.success('Account data retrieved', accountResult.data);
      }
    } else {
      logger.error('Login failed', loginResult);
      process.exit(1);
    }
  } else if (authMethod === 'browser') {
    // Browser-based certificate authentication
    logger.info('Using browser-based certificate authentication');

    const browserAuth = new BrowserCertificateAuth(CONFIG, logger);

    // Initialize browser
    const initialized = await browserAuth.initialize();
    if (!initialized) {
      logger.error('Browser initialization failed');
      process.exit(1);
    }

    // Perform login
    const loginResult = await browserAuth.login('https://bank.example.com/login');

    if (loginResult.success) {
      logger.success('Login successful!');

      // Keep browser open for manual inspection (optional)
      logger.info('Browser will remain open for 30 seconds...');
      await new Promise(resolve => setTimeout(resolve, 30000));
    } else {
      logger.error('Login failed', loginResult);
    }

    // Close browser
    await browserAuth.close();

    if (!loginResult.success) {
      process.exit(1);
    }
  } else {
    logger.error(`Unknown authentication method: ${authMethod}`);
    logger.info('Usage: node bank-cert-login-standalone.js [api|browser]');
    process.exit(1);
  }

  logger.info('=================================================');
  logger.info('Script execution completed');
  logger.info('=================================================');
}

// =============================================================================
// ERROR HANDLING
// =============================================================================

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\nScript interrupted by user');
  process.exit(0);
});

// =============================================================================
// RUN
// =============================================================================

if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

// Export for use as module
module.exports = {
  ApiCertificateAuth,
  BrowserCertificateAuth,
  CertificateLoader,
  Logger,
};
