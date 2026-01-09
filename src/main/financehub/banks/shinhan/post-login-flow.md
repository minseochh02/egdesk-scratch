# Shinhan Bank Post-Login Flow Documentation

## Overview
This document describes what happens after a successful login in the Shinhan Bank automation system.

## 1. Login Completion Process

### 1.1 Initial Login Verification
```javascript
// After clicking login button
await this.handleSecurityPopup(page); // Handle any security warnings
await this.handleIdLoginAlert(page);   // Handle ID login popup
```

### 1.2 Login Status Check
```javascript
const loginStatus = await this.checkLoginStatus(page);
// Looks for user profile elements:
// - XPath: //div[@class="user-nm"]
// - CSS: .user-nm
// - Text containing "님"
```

### 1.3 Return Value
```javascript
{
  success: true,
  isLoggedIn: true,
  userName: "김철수",  // Extracted from profile element
  keyboardAnalysis: {
    // Virtual keyboard analysis data
    lowerAnalysis: {...},
    upperAnalysis: {...},
    keyboardJSON: {...}
  },
  typingResult: {
    success: true,
    totalChars: 8,
    typedChars: 8,
    failedChars: []
  }
}
```

## 2. Session Management

### 2.1 Keep-Alive Mechanism
```javascript
// Started automatically after successful login
startSessionKeepAlive() {
  this.sessionKeepAliveInterval = setInterval(() => {
    this.extendSession();
  }, 5 * 60 * 1000);  // Every 5 minutes
}
```

### 2.2 Session Extension
- Clicks the "연장" (Extend) button to prevent timeout
- Located via XPath: `//button[contains(text(), '연장') or contains(@class, 'extend')]`
- Runs silently in background every 5 minutes

## 3. Post-Login Navigation

### 3.1 Smart Navigation Strategy
- Login redirects to: `https://bank.shinhan.com/index.jsp#010101100010`
- This is the transaction inquiry page
- No additional navigation needed for most operations

### 3.2 Available Pages
```javascript
// Configuration URLs
loginUrl: 'https://bank.shinhan.com/index.jsp#010101100010',
inquiryUrl: 'https://bank.shinhan.com/index.jsp#100201010010',
transactionUrl: 'https://bank.shinhan.com/index.jsp#100202010010'
```

## 4. Available Operations After Login

### 4.1 Get Accounts
```javascript
const accounts = await shinhanAutomator.getAccounts();
// Returns: [{ accountNumber: "110-XXX-XXXXXX", accountName: "신한 주거래 통장" }, ...]
```

**Process:**
1. Navigates to inquiry page (if needed)
2. Waits for account list to load
3. Extracts accounts using multiple strategies:
   - Dropdown options
   - Account list elements
   - Visible account information

### 4.2 Get Transactions
```javascript
const result = await shinhanAutomator.getTransactions({
  accountNumber: "110-XXX-XXXXXX",
  startDate: "2024-01-01",
  endDate: "2024-12-31"
});
// Returns: { success: true, filePath: "path/to/excel", transactions: [...] }
```

**Process:**
1. Navigates to inquiry page
2. Selects specified account
3. Sets date range (defaults to 10 years)
4. Clicks inquiry button
5. Waits for transaction data to load
6. Extracts transaction HTML
7. Parses transactions
8. Creates Excel file
9. Returns file path and data

### 4.3 Combined Operations
```javascript
// Login and get accounts in one call
const result = await loginAndGetAccounts({
  userId: "USER_ID",
  password: "PASSWORD"
});
// Returns: { success: true, accounts: [...], isLoggedIn: true }
```

## 5. Error Handling

### 5.1 Common Error Scenarios
- **Session Timeout**: Automatically handled by keep-alive
- **Security Popups**: Automatically dismissed
- **Page Load Failures**: Retries with extended timeouts
- **Element Not Found**: Returns detailed error with screenshot

### 5.2 Recovery Strategy
- Browser session persists on error
- Can retry operations without re-login
- Screenshots saved for debugging

## 6. Browser Session Management

### 6.1 Session Persistence
```javascript
// Browser stays open by default
this.keepOpen = true;

// Cached in global Map
activeAutomators.set('shinhan_userId', automatorInstance);
```

### 6.2 Reusing Sessions
- Subsequent calls check for existing automator
- Reuses browser if already logged in
- No re-authentication needed

## 7. IPC Integration

### 7.1 Available IPC Channels
```javascript
// From renderer to main process
'finance-hub:login'              // Login only
'finance-hub:get-accounts'       // Get accounts (auto-login if needed)
'finance-hub:get-transactions'   // Get transactions with options
'finance-hub:login-and-get-accounts' // Combined operation
```

### 7.2 Response Format
```javascript
// Success
{ 
  success: true, 
  bank: 'shinhan',
  data: {...}
}

// Error
{ 
  success: false, 
  error: 'Error message',
  details: {...}
}
```

## 8. Best Practices

### 8.1 Session Management
- Let the keep-alive mechanism handle session extension
- Don't manually navigate away from banking pages
- Use the provided methods for all operations

### 8.2 Error Recovery
- Check `isLoggedIn` before operations
- Handle session timeouts gracefully
- Save transaction data immediately after retrieval

### 8.3 Performance
- Reuse existing sessions when possible
- Batch operations to minimize navigation
- Use date ranges to limit transaction data

## 9. Cleanup

### 9.1 Automatic Cleanup
```javascript
// On browser close or error
stopSessionKeepAlive() {
  if (this.sessionKeepAliveInterval) {
    clearInterval(this.sessionKeepAliveInterval);
    this.sessionKeepAliveInterval = null;
  }
}
```

### 9.2 Manual Cleanup
```javascript
// Close browser and cleanup
await shinhanAutomator.browser?.close();
activeAutomators.delete('shinhan_userId');
```

## Conclusion

The Shinhan Bank automation provides a robust post-login flow with:
- Automatic session management
- Multiple data retrieval options
- Error recovery mechanisms
- Efficient session reuse

This design enables reliable, long-running automation tasks while maintaining security and stability.