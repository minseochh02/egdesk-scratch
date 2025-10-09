# Google OAuth with Gmail Integration

## Overview

This integration provides Google OAuth 2.0 authentication with Gmail API access for the EGDesk Electron application. Users can sign in with their Google account and access Gmail features including reading messages and sending emails.

## Features

### Authentication
- **Google OAuth 2.0 Sign-In**: Secure authentication using Google's OAuth 2.0 flow
- **User Profile Access**: Retrieve user's email, name, and profile picture
- **Persistent Sessions**: Access and refresh tokens for maintaining authentication

### Gmail API Features
- **List Messages**: Fetch recent Gmail messages from the user's inbox
- **Read Messages**: Get detailed information about specific messages
- **Send Emails**: Send emails programmatically through the user's Gmail account
- **Full Gmail Access**: Includes read, send, compose, and modify permissions

## Setup

### 1. Google Cloud Console Setup

The OAuth credentials are already configured in the file:
```
client_secret_862784563181-30ua334k8egt3ufiivo273ldmbi9pqbb.apps.googleusercontent.com.json
```

**Client Configuration:**
- **Client ID**: `862784563181-30ua334k8egt3ufiivo273ldmbi9pqbb.apps.googleusercontent.com`
- **Project ID**: `egdesk-474603`
- **Redirect URI**: `http://localhost`

### 2. OAuth Scopes

The following scopes are requested during authentication:

```javascript
[
  'https://www.googleapis.com/auth/userinfo.profile',  // User profile
  'https://www.googleapis.com/auth/userinfo.email',     // User email
  'openid',                                              // OpenID Connect
  'https://www.googleapis.com/auth/gmail.readonly',     // Read Gmail
  'https://www.googleapis.com/auth/gmail.send',         // Send emails
  'https://www.googleapis.com/auth/gmail.compose',      // Compose emails
  'https://www.googleapis.com/auth/gmail.modify',       // Modify Gmail
]
```

## Architecture

### Files Structure

```
src/
├── main/
│   ├── google-auth-handler.ts    # Main OAuth & Gmail handler
│   ├── main.ts                    # IPC handlers for auth & Gmail
│   └── preload.ts                 # Exposed APIs to renderer
└── renderer/
    └── App.tsx                    # UI for Google sign-in and Gmail features
```

### Key Components

#### 1. GoogleAuthHandler Class (`src/main/google-auth-handler.ts`)

Main handler for Google OAuth and Gmail operations.

**Methods:**
- `signIn()`: Initiates OAuth flow and returns user info + tokens
- `signOut()`: Revokes tokens and signs out user
- `isSignedIn()`: Checks if user is currently authenticated
- `listMessages(maxResults)`: Lists recent Gmail messages
- `getMessage(messageId)`: Gets a specific message
- `sendEmail(to, subject, body)`: Sends an email via Gmail

#### 2. IPC Handlers (`src/main/main.ts`)

Electron IPC handlers that bridge renderer and main processes:

```typescript
// Authentication
'google-auth-sign-in'
'google-auth-sign-out'
'google-auth-is-signed-in'

// Gmail
'gmail-list-messages'
'gmail-get-message'
'gmail-send-email'
```

#### 3. Preload API (`src/main/preload.ts`)

Exposes secure APIs to the renderer process:

```typescript
window.electron.googleAuth.signIn()
window.electron.googleAuth.signOut()
window.electron.googleAuth.isSignedIn()

window.electron.gmail.listMessages(maxResults)
window.electron.gmail.getMessage(messageId)
window.electron.gmail.sendEmail(to, subject, body)
```

## Usage

### In the UI (Debug Modal)

The integration is accessible through the Debug Panel in the app:

1. **Sign In with Google**
   - Click "🔐 Sign in with Google"
   - A browser window opens for Google authentication
   - Grant the requested permissions
   - User profile displays upon successful sign-in

2. **List Recent Messages**
   - Available after signing in
   - Click "📬 Fetch Recent Messages"
   - Displays up to 10 recent message IDs and thread IDs

3. **Send Email**
   - Fill in recipient email, subject, and body
   - Click "📤 Send Email"
   - Confirmation shows message ID upon success

### Programmatic Usage

```typescript
// Sign in
const result = await window.electron.googleAuth.signIn();
if (result.success) {
  console.log('User:', result.user);
  console.log('Tokens:', result.tokens);
}

// List messages
const messages = await window.electron.gmail.listMessages(10);
if (messages.success) {
  console.log('Messages:', messages.messages);
  console.log('Total:', messages.resultSizeEstimate);
}

// Send email
const sent = await window.electron.gmail.sendEmail(
  'recipient@example.com',
  'Test Subject',
  'Email body content'
);
if (sent.success) {
  console.log('Sent! Message ID:', sent.messageId);
}

// Sign out
await window.electron.googleAuth.signOut();
```

## Security Features

1. **Context Isolation**: Electron's context isolation ensures secure IPC communication
2. **No Credentials in Renderer**: OAuth credentials remain in the main process
3. **Secure Token Storage**: Access tokens are managed in the main process
4. **OAuth 2.0 Flow**: Industry-standard authentication protocol
5. **User Consent**: Google's consent screen ensures users understand permissions

## OAuth Flow Diagram

```
1. User clicks "Sign in with Google"
   ↓
2. Electron creates BrowserWindow with Google auth URL
   ↓
3. User authenticates and grants permissions
   ↓
4. Google redirects to http://localhost with authorization code
   ↓
5. App exchanges code for access + refresh tokens
   ↓
6. App fetches user profile information
   ↓
7. Auth window closes, user is signed in
```

## Error Handling

The integration includes comprehensive error handling:

```typescript
// All methods return a result object
{
  success: boolean;
  error?: string;
  // ... additional data on success
}
```

**Common Errors:**
- "Google OAuth credentials not loaded" - Missing credentials file
- "Authorization code not found" - User canceled or redirect failed
- "User not authenticated" - Attempting Gmail operations without sign-in
- "Authentication window was closed by user" - User closed auth window

## Token Management

- **Access Token**: Used for API calls, expires after 1 hour
- **Refresh Token**: Used to obtain new access tokens (only received with `access_type: 'offline'`)
- **Token Expiry**: Automatically handled by Google APIs library

## Dependencies

```json
{
  "google-auth-library": "^10.4.0",
  "googleapis": "^161.0.0"
}
```

## Testing

Test the integration through the Debug Modal:

1. Open Debug Panel (Debug button in navigation)
2. Scroll to "🔐 Google OAuth Sign-In (with Gmail)" section
3. Click "Sign in with Google"
4. After successful sign-in, test Gmail features

## Troubleshooting

### Issue: "Google OAuth credentials not loaded"
**Solution**: Ensure the credentials JSON file exists in the project root

### Issue: OAuth window doesn't appear
**Solution**: Check console for errors, ensure Google Cloud project is properly configured

### Issue: "User not authenticated" when using Gmail
**Solution**: Sign in with Google before attempting Gmail operations

### Issue: Gmail API rate limits
**Solution**: Google has daily quota limits. See [Gmail API Usage Limits](https://developers.google.com/gmail/api/reference/quota)

## Future Enhancements

Potential improvements for the integration:

1. **Token Persistence**: Save tokens securely to electron-store for persistent sessions
2. **Email Templates**: Pre-defined email templates
3. **Attachment Support**: Send emails with file attachments
4. **Advanced Filters**: Search and filter Gmail messages
5. **Label Management**: Create and manage Gmail labels
6. **Draft Management**: Create and manage email drafts
7. **Calendar Integration**: Add Google Calendar API support

## References

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [Google Auth Library for Node.js](https://github.com/googleapis/google-auth-library-nodejs)
- [Google APIs Node.js Client](https://github.com/googleapis/google-api-nodejs-client)

## License

This integration is part of the EGDesk application and follows the same license.

