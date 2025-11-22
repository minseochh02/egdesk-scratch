# Authentication Setup Guide

This guide explains how to set up OAuth authentication for the EGDesk Electron application.

## Overview

EGDesk now includes Supabase OAuth authentication, similar to the egdesk-website. Users must sign in with Google or GitHub to access the application.

## Prerequisites

1. A Supabase account and project
2. OAuth providers configured in Supabase (Google and/or GitHub)

## Environment Variables

Create a `.env` file in the `egdesk-scratch` directory with the following variables:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
```

### Getting Your Supabase Credentials

1. Go to [Supabase Dashboard](https://app.supabase.io)
2. Select your project
3. Navigate to **Settings** → **API**
4. Copy the **Project URL** → use as `SUPABASE_URL`
5. Copy the **anon/public** key → use as `SUPABASE_ANON_KEY`

## Setting Up OAuth Providers in Supabase

### Google OAuth

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Providers**
3. Enable **Google** provider
4. Add the redirect URL: `egdesk://auth/callback`
5. Configure Google Cloud Console:
   - Create OAuth 2.0 credentials
   - Add authorized redirect URI: `https://your-project-ref.supabase.co/auth/v1/callback`
   - Copy Client ID and Client Secret to Supabase

### GitHub OAuth

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Providers**
3. Enable **GitHub** provider
4. Add the redirect URL: `egdesk://auth/callback`
5. Configure GitHub OAuth App:
   - Go to GitHub Settings → Developer settings → OAuth Apps
   - Create a new OAuth App
   - Set Authorization callback URL: `https://your-project-ref.supabase.co/auth/v1/callback`
   - Copy Client ID and Client Secret to Supabase

## Deep Link Protocol

The application uses the `egdesk://` protocol for OAuth callbacks. This is automatically registered when the app starts.

**Important for macOS:** The first time you sign in, macOS may ask for permission to open the app via the protocol.

## How It Works

1. User clicks "Sign in with Google" or "Sign in with GitHub"
2. External browser opens with OAuth provider's login page
3. After authentication, the browser redirects to `egdesk://auth/callback?code=...`
4. The application intercepts this deep link
5. Auth service exchanges the code for a session
6. User is automatically signed in

## Development

When running in development mode:

```bash
npm start
```

The protocol handler is registered automatically. Make sure your `.env` file is properly configured.

## Production

When building for production:

```bash
npm run package
```

The protocol handler is bundled with the application. Users will be prompted to allow the app to handle `egdesk://` URLs on first use.

## Troubleshooting

### "Supabase not initialized" error

- Check that your `.env` file exists and contains valid credentials
- Verify that `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set correctly
- Restart the application after updating `.env`

### OAuth callback not working

- Verify that the redirect URL in Supabase includes `egdesk://auth/callback`
- Check that the protocol handler is registered (should happen automatically)
- On macOS, check System Preferences → General → Allow apps to handle URLs

### Session not persisting

- Sessions are encrypted and stored locally using `electron-store`
- Check file permissions in your app data directory
- The auth service automatically refreshes expired sessions

## Security Notes

- Never commit your `.env` file to version control
- The `SUPABASE_ANON_KEY` is safe to use in client applications
- Sessions are encrypted locally using electron-store
- OAuth tokens are managed by Supabase and automatically refreshed

## Architecture

### Main Process (`src/main/auth/auth-service.ts`)
- Manages Supabase client
- Handles OAuth flow
- Stores encrypted sessions
- Provides IPC handlers for renderer

### Renderer Process
- `AuthContext` (`src/renderer/contexts/AuthContext.tsx`): React context for auth state
- `SignInPage` (`src/renderer/components/Auth/SignInPage.tsx`): Login UI
- `AuthButton` (`src/renderer/components/Auth/AuthButton.tsx`): Navigation auth button

### Flow
1. Main process registers IPC handlers
2. Renderer requests auth actions via IPC
3. Main process opens OAuth URL in external browser
4. Deep link callback handled by main process
5. Session stored and renderer notified via IPC event

