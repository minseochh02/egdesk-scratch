# Bank Certificate Authentication - Standalone Script

This standalone script provides a baseline implementation for logging into banks using certificate-based authentication. It supports both API-based (mTLS) and browser-based authentication methods.

## Features

- **Dual Authentication Methods**: API-based (mTLS) and browser-based (Playwright)
- **Certificate Support**: PFX/P12 and PEM certificate formats
- **Comprehensive Logging**: File and console logging with timestamps
- **Error Handling**: Robust error handling with screenshots for debugging
- **Easy to Modify**: Clean, well-documented code structure for AI editing

## Prerequisites

```bash
npm install axios https playwright
```

## Quick Start

### 1. Prepare Your Certificates

Place your bank certificate files in a `certificates` directory:

```
egdesk-scratch/
├── certificates/
│   ├── bank-cert.pfx          # PFX/P12 certificate (option 1)
│   ├── client-cert.pem        # OR client certificate (option 2)
│   ├── client-key.pem         # OR private key (option 2)
│   └── ca-cert.pem            # Certificate authority (optional)
├── screenshots/                # Auto-created for debugging
└── bank-cert-login-standalone.js
```

### 2. Configure the Script

Edit `bank-cert-login-standalone.js` and update the `CONFIG` object:

```javascript
const CONFIG = {
  // Bank API endpoint
  bankApiUrl: 'https://api.your-bank.com/auth/login',

  // Certificate configuration
  certificates: {
    pfxPath: './certificates/your-bank-cert.pfx',
    pfxPassword: 'your-certificate-password',
    // OR use PEM files instead
  },

  // Login credentials
  credentials: {
    userId: 'your-user-id',
    password: 'your-password',
    certificatePassword: 'cert-password', // For corporate accounts
    accountType: 'corporate', // 'personal' or 'corporate'
  },
};
```

### 3. Run the Script

**For API-based authentication (mTLS):**
```bash
node bank-cert-login-standalone.js api
```

**For browser-based authentication:**
```bash
node bank-cert-login-standalone.js browser
```

## Authentication Methods

### API-Based (mTLS)

Uses HTTPS client certificates for mutual TLS authentication. Best for:
- Banks that provide REST APIs
- Automated, headless operations
- High-frequency requests

```javascript
const apiAuth = new ApiCertificateAuth(CONFIG, logger);
const result = await apiAuth.login();

if (result.success) {
  // Make authenticated requests
  await apiAuth.makeAuthenticatedRequest(
    'https://api.bank.com/accounts',
    'GET',
    null,
    result.sessionToken
  );
}
```

### Browser-Based (Playwright)

Uses Playwright to automate browser login with certificate handling. Best for:
- Banks without public APIs
- Web-based certificate authentication
- Visual debugging needs

```javascript
const browserAuth = new BrowserCertificateAuth(CONFIG, logger);
await browserAuth.initialize();
await browserAuth.login('https://bank.com/login');
```

## Certificate Formats

### PFX/P12 Format (Recommended for Korean Banks)

Korean banks (Shinhan, NH, Kookmin) typically use PFX/P12 certificates (공동인증서):

```javascript
certificates: {
  pfxPath: './certificates/bank-cert.pfx',
  pfxPassword: 'your-cert-password',
}
```

### PEM Format

If you have separate certificate and key files:

```javascript
certificates: {
  certPath: './certificates/client-cert.pem',
  keyPath: './certificates/client-key.pem',
  caPath: './certificates/ca-cert.pem', // Optional
}
```

### Converting Between Formats

**PFX to PEM:**
```bash
# Extract certificate
openssl pkcs12 -in cert.pfx -clcerts -nokeys -out cert.pem

# Extract private key
openssl pkcs12 -in cert.pfx -nocerts -nodes -out key.pem
```

**PEM to PFX:**
```bash
openssl pkcs12 -export -out cert.pfx -inkey key.pem -in cert.pem
```

## Customization Guide for AI

This script is designed to be easily modified by AI assistants. Here's what you might want to customize:

### 1. Bank-Specific Login Flow

Modify the `BrowserCertificateAuth.login()` method:

```javascript
async login(bankUrl) {
  await this.page.goto(bankUrl);

  // Customize these selectors for your bank
  await this.page.fill('input[name="userId"]', this.credentials.userId);
  await this.page.fill('input[name="password"]', this.credentials.password);

  // Add bank-specific steps here:
  // - Virtual keyboard handling
  // - Security popup dismissal
  // - OTP input
  // - Certificate selection

  await this.page.click('button[type="submit"]');
  await this.page.waitForNavigation();
}
```

### 2. API Request Format

Update the `ApiCertificateAuth.login()` method:

```javascript
const response = await axios.post(
  this.config.bankApiUrl,
  {
    // Customize request body for your bank's API
    userId: this.config.credentials.userId,
    password: this.config.credentials.password,
    // Add additional fields as needed
  },
  { httpsAgent }
);
```

### 3. Success Detection

Customize `checkLoginSuccess()`:

```javascript
async checkLoginSuccess() {
  // Option 1: Check for specific element
  return await this.page.$('.dashboard-container');

  // Option 2: Check URL
  return this.page.url().includes('/main');

  // Option 3: Check for text
  return await this.page.locator('text=계좌조회').isVisible();
}
```

### 4. Add Custom Methods

```javascript
class BrowserCertificateAuth {
  // ... existing methods ...

  async getAccountBalance() {
    await this.page.click('a[href="/accounts"]');
    const balance = await this.page.$eval('.balance', el => el.textContent);
    return balance;
  }

  async downloadTransactions(startDate, endDate) {
    // Custom implementation
  }
}
```

## Integration with Existing Codebase

To integrate with your existing FinanceHub system:

1. **Import the classes:**
```javascript
const { ApiCertificateAuth, BrowserCertificateAuth } = require('./bank-cert-login-standalone');
```

2. **Use with existing automators:**
```javascript
// In your BaseBankAutomator or specific bank automators
const certAuth = new BrowserCertificateAuth(config, logger);
await certAuth.initialize();
await certAuth.login(this.config.loginUrl);
```

3. **Database integration:**
```javascript
// Load credentials from your encrypted storage
const credentials = await financehubDb.getCredentials(bankId);
CONFIG.credentials = {
  userId: credentials.userId,
  password: credentials.password,
  certificatePassword: credentials.metadata?.certificatePassword,
};
```

## Logging

Logs are written to both console and `bank-login.log`:

```json
{
  "timestamp": "2026-04-06T10:30:45.123Z",
  "level": "INFO",
  "message": "Starting API certificate authentication...",
  "data": { "userId": "user123" }
}
```

## Troubleshooting

### Certificate Not Found
```
Error: No valid certificate files found
```
- Check certificate paths in CONFIG
- Ensure files exist and have correct permissions

### Certificate Password Wrong
```
Error: Failed to load PFX certificate: mac verify failure
```
- Verify pfxPassword is correct
- Try opening certificate manually to test password

### SSL/TLS Errors
```
Error: unable to verify the first certificate
```
- For testing only, set `rejectUnauthorized: false` in https.Agent
- For production, include proper CA certificate

### Browser Certificate Issues
```
Note: Playwright has limited client certificate support
```
- Use API method if possible
- For full browser cert support, consider puppeteer with Chrome flags:
  ```javascript
  chromium.launch({
    args: ['--client-certificate=/path/to/cert.pfx']
  })
  ```

### Virtual Keyboard Banks
For banks with virtual keyboards (Shinhan, NH):
- Refer to existing automators: `src/main/financehub/banks/shinhan/ShinhanBankAutomator.js`
- Integrate Gemini Vision API for keyboard analysis
- Use coordinate-based clicking instead of text input

## Security Considerations

1. **Never commit certificates or passwords** to version control
2. **Encrypt sensitive data** at rest (use AES-256-CBC like existing code)
3. **Use environment variables** for sensitive configuration:
   ```javascript
   pfxPassword: process.env.BANK_CERT_PASSWORD,
   ```
4. **Limit certificate permissions** to only required scopes
5. **Rotate certificates** according to bank policies
6. **Log security events** but never log passwords or keys

## Example: Korean Bank Integration (NH Business)

```javascript
const CONFIG = {
  bankApiUrl: 'https://biz.nonghyup.com',

  certificates: {
    pfxPath: './certificates/nh-business-cert.pfx',
    pfxPassword: process.env.NH_CERT_PASSWORD,
  },

  credentials: {
    userId: '1234567890', // 사업자번호
    password: process.env.NH_PASSWORD,
    certificatePassword: process.env.NH_CERT_PASSWORD,
    accountType: 'corporate', // 법인
  },
};

async function nhBusinessLogin() {
  const browserAuth = new BrowserCertificateAuth(CONFIG, logger);
  await browserAuth.initialize();

  // Custom NH Business login flow
  const result = await browserAuth.login('https://biz.nonghyup.com/login');

  if (result.success) {
    // Scrape account data
    // ...
  }
}
```

## Next Steps

1. **Test with your bank**: Update CONFIG and run the script
2. **Add custom logic**: Modify login flow for your specific bank
3. **Integrate with main app**: Import classes into existing automators
4. **Add error recovery**: Implement retry logic and fallback mechanisms
5. **Monitor and log**: Set up proper logging and monitoring

## Related Files in Main Codebase

- `src/main/financehub/banks/nh-business/NHBusinessBankAutomator.js` - NH Business cert auth example
- `src/main/sqlite/financehub.ts` - Credential encryption/storage
- `src/main/migrations/tax-certificate-migration.ts` - Tax cert handling
- `src/main/auth/auth-service.ts` - OAuth patterns

## Support

For questions or issues:
1. Check existing bank automators for examples
2. Review logs in `bank-login.log`
3. Enable `headless: false` to debug browser automation
4. Take screenshots with `browserAuth.takeScreenshot('debug')`
