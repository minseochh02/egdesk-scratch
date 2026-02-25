#!/usr/bin/env node

/**
 * Force expire JWT tokens for testing
 *
 * This script modifies the stored tokens to have expired timestamps,
 * allowing you to test token refresh logic.
 */

const path = require('path');
const os = require('os');

// We need to use conf directly since electron-store requires electron
const Conf = require('conf').default || require('conf');

console.log('🔧 Token Expiration Script\n');

// Use conf with the exact same settings as the app
const store = new Conf({
  projectName: 'EGDesk', // This is derived from app name
  configName: 'egdesk-auth',
  encryptionKey: 'egdesk-auth-encryption-key',
  cwd: path.join(os.homedir(), 'Library/Application Support/EGDesk')
});

// Get current values
let session = store.get('session');
const accounts = store.get('accounts');
const googleToken = store.get('google_workspace_token');

console.log('🔍 Debug - Store contents:');
console.log('  Has session:', !!session);
console.log('  Has accounts:', !!accounts);
console.log('  Accounts:', accounts ? Object.keys(accounts) : 'N/A');
console.log('  Has googleToken:', !!googleToken);

// If no active session but accounts exist, use first account
if (!session && accounts && Object.keys(accounts).length > 0) {
  const userId = Object.keys(accounts)[0];
  session = accounts[userId];
  console.log(`  Using session from accounts[${userId}]`);
}

if (!session && !googleToken) {
  console.log('❌ No tokens found in store');
  process.exit(0);
}

console.log('📋 Current token state:');
if (session) {
  const expiresAt = session.expires_at;
  const now = Math.floor(Date.now() / 1000);
  const isExpired = expiresAt < now;

  console.log(`\n  Supabase JWT:`);
  console.log(`    User: ${session.user?.email || 'Unknown'}`);
  console.log(`    Expires at: ${new Date(expiresAt * 1000).toISOString()}`);
  console.log(`    Currently: ${isExpired ? '❌ EXPIRED' : '✅ Valid'}`);
  console.log(`    Time until expiry: ${isExpired ? 'Already expired' : `${Math.floor((expiresAt - now) / 60)} minutes`}`);
}

if (googleToken) {
  const expiresAt = googleToken.expires_at;
  const now = Math.floor(Date.now() / 1000);
  const isExpired = expiresAt < now;

  console.log(`\n  Google OAuth Token:`);
  console.log(`    Expires at: ${new Date(expiresAt * 1000).toISOString()}`);
  console.log(`    Currently: ${isExpired ? '❌ EXPIRED' : '✅ Valid'}`);
  console.log(`    Time until expiry: ${isExpired ? 'Already expired' : `${Math.floor((expiresAt - now) / 60)} minutes`}`);
  console.log(`    Has refresh token: ${googleToken.refresh_token ? '✅ Yes' : '❌ No'}`);
  console.log(`    Scopes: ${googleToken.scopes?.length || 0} scopes`);
}

console.log('\n' + '='.repeat(60));

// Expire tokens by setting expires_at to 1 hour ago
const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;

if (session) {
  session.expires_at = oneHourAgo;
  session.expires_in = -3600; // Negative to indicate it expired an hour ago
  store.set('session', session);
  console.log('✅ Expired Supabase JWT in session (set to 1 hour ago)');
}

// Also expire all accounts
if (accounts && Object.keys(accounts).length > 0) {
  for (const userId of Object.keys(accounts)) {
    accounts[userId].expires_at = oneHourAgo;
    accounts[userId].expires_in = -3600;
  }
  store.set('accounts', accounts);
  console.log(`✅ Expired Supabase JWT in ${Object.keys(accounts).length} account(s)`);
}

if (googleToken) {
  googleToken.expires_at = oneHourAgo;
  store.set('google_workspace_token', googleToken);
  console.log('✅ Expired Google OAuth token (set to 1 hour ago)');
}

console.log('\n📋 Updated token state:');
if (session) {
  console.log(`  Supabase JWT expires at: ${new Date(oneHourAgo * 1000).toISOString()}`);
}
if (googleToken) {
  console.log(`  Google OAuth expires at: ${new Date(oneHourAgo * 1000).toISOString()}`);
}

console.log('\n✅ Tokens have been forcibly expired!');
console.log('💡 Restart your app to test token refresh logic.\n');
