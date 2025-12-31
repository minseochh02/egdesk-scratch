# Token Storage and Management

## Overview

The EGDesk application uses **electron-store** with encryption to securely store OAuth tokens locally on the user's machine.

## Storage Location

**File Path:**
- **macOS:** `~/Library/Application Support/EGDesk-auth/config.json`
- **Windows:** `%APPDATA%/EGDesk-auth/config.json`
- **Linux:** `~/.config/EGDesk-auth/config.json`

The exact path can be obtained via:
```typescript
const { app } = require('electron');
const userDataPath = app.getPath('userData');
// Auth store is in: `${userDataPath}/../EGDesk-auth/config.json`
```

## Storage Mechanism

### Library: `electron-store`
- **Encryption:** Yes, using AES encryption
- **Encryption Key:** `'egdesk-auth-encryption-key'` (hardcoded in code)
- **Store Name:** `'egdesk-auth'`

```typescript
this.store = new Store({
  name: 'egdesk-auth',
  encryptionKey: 'egdesk-auth-encryption-key'
});
```

## What Tokens Are Stored

### 1. Supabase Session (`session` key)

Stores the complete Supabase authentication session:

```typescript
interface StoredSession {
  access_token: string;        // Supabase JWT access token
  refresh_token: string;       // Supabase refresh token
  expires_at?: number;         // Unix timestamp when token expires
  expires_in?: number;         // Token lifetime in seconds
  user: User;                  // Supabase user object (email, id, metadata, etc.)
  provider_token?: string;     // Google OAuth provider token (if available)
  provider_refresh_token?: string; // Google OAuth provider refresh token
}
```

**Storage Method:**
```typescript
this.store.set('session', storedSession);
```

### 2. Google Workspace Token (`google_workspace_token` key)

Stores Google OAuth tokens separately for direct Google API access:

```typescript
{
  access_token?: string;        // Google OAuth access token
  refresh_token?: string;      // Google OAuth refresh token
  expires_at?: number;         // Token expiration timestamp
  scopes?: string[];           // Granted OAuth scopes
  saved_at: number;            // When token was saved (timestamp)
  
  // OR if provider token not available:
  supabase_session?: boolean;  // Flag indicating Supabase session exists
  user_id?: string;            // Supabase user ID
}
```

**Storage Method:**
```typescript
this.store.set('google_workspace_token', googleToken);
```

## Token Lifecycle

### 1. **Save Session** (`saveSession()`)

Called after successful OAuth authentication:

```typescript
private saveSession(session: Session): void {
  // 1. Save Supabase session
  this.store.set('session', storedSession);
  this.currentSession = session;
  
  // 2. If Google auth, also save Google token separately
  if (isGoogleAuth) {
    this.store.set('google_workspace_token', googleToken);
  }
}
```

**When it's called:**
- After OAuth callback is processed
- After session refresh
- After successful authentication

### 2. **Load Session** (`loadSession()`)

Called when app starts or when session is needed:

```typescript
private async loadSession(): Promise<Session | null> {
  // 1. Get stored session from encrypted store
  const storedSession = this.store.get('session');
  
  // 2. Check if expired
  if (expired) {
    // 3. Try to refresh using refresh_token
    const { data } = await supabase.auth.refreshSession({
      refresh_token: storedSession.refresh_token
    });
    
    // 4. Save refreshed session
    this.saveSession(data.session);
    return data.session;
  }
  
  // 5. Return valid session
  return session;
}
```

**When it's called:**
- App startup
- When `getSession()` is called
- When checking authentication status

### 3. **Clear Session** (`clearSession()`)

Called when user signs out:

```typescript
private clearSession(): void {
  this.store.delete('session');
  this.store.delete('google_workspace_token');
  this.currentSession = null;
}
```

**When it's called:**
- User clicks "Sign Out"
- Session refresh fails
- Authentication error

## Token Refresh

### Automatic Refresh

The Supabase client is configured with `autoRefreshToken: true`, but since we use `persistSession: false`, we handle refresh manually:

```typescript
// In loadSession()
if (storedSession.expires_at && storedSession.expires_at < Date.now() / 1000) {
  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: storedSession.refresh_token,
  });
  
  if (error || !data.session) {
    this.clearSession(); // Clear if refresh fails
    return null;
  }
  
  this.saveSession(data.session); // Save refreshed session
  return data.session;
}
```

## Security Considerations

### ✅ Current Security Features

1. **Encryption at Rest:** All tokens are encrypted using AES encryption
2. **Local Storage Only:** Tokens never leave the user's machine
3. **Automatic Expiration:** Expired tokens are automatically refreshed or cleared
4. **Secure Storage Location:** Uses OS-specific secure application data directories

### ⚠️ Security Concerns

1. **Hardcoded Encryption Key:** The encryption key `'egdesk-auth-encryption-key'` is hardcoded in the source code
   - **Risk:** If someone has access to the source code, they can decrypt stored tokens
   - **Recommendation:** Use environment variable or keychain/credential store

2. **No Key Rotation:** Encryption key never changes
   - **Risk:** If key is compromised, all stored tokens are at risk
   - **Recommendation:** Implement key rotation mechanism

3. **Plain Text File:** Even though encrypted, the file exists as a JSON file
   - **Risk:** File could be copied and decrypted if key is known
   - **Recommendation:** Use OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service)

## Accessing Tokens

### From Main Process

```typescript
// Get Supabase session
const { session, user } = await authService.getSession();

// Get Google Workspace token
const googleToken = authService.getGoogleWorkspaceToken();
```

### From Renderer Process (via IPC)

```typescript
// Get session
const { session, user } = await window.electron.auth.getSession();

// Get Google Workspace token
const { token } = await window.electron.auth.getGoogleWorkspaceToken();
```

## Token Usage

### Supabase Session Token
- Used for: Supabase API calls, user authentication
- Scope: Supabase services only
- Lifetime: Typically 1 hour (refreshed automatically)

### Google Workspace Token
- Used for: Direct Google API calls (Gmail, Apps Script, etc.)
- Scope: Google services as requested in OAuth scopes
- Lifetime: Varies by Google (typically 1 hour, refreshable)

## File Structure Example

```json
{
  "session": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "v1.abc123...",
    "expires_at": 1234567890,
    "expires_in": 3600,
    "user": {
      "id": "uuid-here",
      "email": "user@example.com",
      "user_metadata": { ... }
    },
    "provider_token": "ya29.abc123...",
    "provider_refresh_token": "1//abc123..."
  },
  "google_workspace_token": {
    "access_token": "ya29.abc123...",
    "refresh_token": "1//abc123...",
    "expires_at": 1234567890,
    "scopes": [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/script.projects"
    ],
    "saved_at": 1234567890
  }
}
```

**Note:** In reality, this file is encrypted, so the contents appear as encrypted binary data.

## Best Practices

1. **Never log tokens:** Avoid logging access tokens or refresh tokens
2. **Handle expiration:** Always check token expiration before use
3. **Error handling:** Handle refresh failures gracefully (prompt re-authentication)
4. **Secure deletion:** When clearing tokens, ensure they're actually deleted from disk
5. **Key management:** Consider using OS keychain for encryption keys in production








