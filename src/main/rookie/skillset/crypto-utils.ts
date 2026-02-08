/**
 * Credential encryption utilities for Skillset System
 * Provides secure encryption/decryption for stored credentials
 */

import * as crypto from 'crypto';
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

let encryptionKey: Buffer | null = null;

/**
 * Get or create encryption key
 * Stores key securely in userData directory
 */
function getEncryptionKey(): Buffer {
  if (encryptionKey) {
    return encryptionKey;
  }

  const keyPath = app.isPackaged
    ? path.join(app.getPath('userData'), '.rookie-key')
    : path.join(process.cwd(), '.rookie-key');

  try {
    if (fs.existsSync(keyPath)) {
      // Load existing key
      encryptionKey = fs.readFileSync(keyPath);

      if (encryptionKey.length !== KEY_LENGTH) {
        throw new Error('Invalid key length');
      }
    } else {
      // Generate new key
      encryptionKey = crypto.randomBytes(KEY_LENGTH);

      // Save key securely
      fs.writeFileSync(keyPath, encryptionKey, { mode: 0o600 });
      console.log('[Crypto] Generated new encryption key');
    }

    return encryptionKey;
  } catch (error) {
    console.error('[Crypto] Error managing encryption key:', error);
    throw new Error('Failed to initialize encryption');
  }
}

/**
 * Encrypt a value
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Combine IV + AuthTag + Encrypted data
  const result = Buffer.concat([
    iv,
    authTag,
    Buffer.from(encrypted, 'hex'),
  ]);

  return result.toString('base64');
}

/**
 * Decrypt a value
 */
export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey();
  const buffer = Buffer.from(encryptedData, 'base64');

  // Extract IV, AuthTag, and encrypted data
  const iv = buffer.subarray(0, IV_LENGTH);
  const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Encrypt credentials object
 */
export function encryptCredentials(credentials: Record<string, string>): string {
  const jsonString = JSON.stringify(credentials);
  return encrypt(jsonString);
}

/**
 * Decrypt credentials object
 */
export function decryptCredentials(encryptedData: string): Record<string, string> {
  const jsonString = decrypt(encryptedData);
  return JSON.parse(jsonString);
}

/**
 * Test encryption/decryption
 */
export function testEncryption(): boolean {
  try {
    const testData = { username: 'test', password: 'secret123' };
    const encrypted = encryptCredentials(testData);
    const decrypted = decryptCredentials(encrypted);

    return (
      decrypted.username === testData.username &&
      decrypted.password === testData.password
    );
  } catch (error) {
    console.error('[Crypto] Encryption test failed:', error);
    return false;
  }
}
