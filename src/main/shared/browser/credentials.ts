/**
 * Unified credential resolution for all services
 * Replaces 4 duplicated credential functions across SNS modules
 */

import { ServiceType, Credentials, CredentialOptions } from './types';
import { CREDENTIAL_ENV_VARS } from './config';

/**
 * Resolve credentials for a service
 * Checks options first, then environment variables
 *
 * @param service Service name
 * @param options Credential options (optional overrides)
 * @returns Resolved credentials
 * @throws Error if credentials are not found
 *
 * @example
 * // From environment variables
 * const creds = resolveCredentials('youtube');
 *
 * // With explicit credentials
 * const creds = resolveCredentials('facebook', {
 *   username: 'user@example.com',
 *   password: 'secret'
 * });
 */
export function resolveCredentials(
  service: ServiceType,
  options: CredentialOptions = {}
): Credentials {
  const envVars = CREDENTIAL_ENV_VARS[service];

  if (!envVars) {
    throw new Error(
      `Unknown service: ${service}. Supported services: ${Object.keys(CREDENTIAL_ENV_VARS).join(', ')}`
    );
  }

  // Check options first, then environment variables
  const username = options.username ?? process.env[envVars.username];
  const password = options.password ?? process.env[envVars.password];

  if (!username || !password) {
    const serviceName = service.charAt(0).toUpperCase() + service.slice(1);
    throw new Error(
      `${serviceName} credentials are required. ` +
      `Provide username/password options or set ${envVars.username} and ${envVars.password} environment variables.`
    );
  }

  return { username, password };
}

/**
 * Check if credentials are available for a service
 *
 * @param service Service name
 * @param options Credential options (optional overrides)
 * @returns True if credentials are available
 */
export function hasCredentials(
  service: ServiceType,
  options: CredentialOptions = {}
): boolean {
  try {
    resolveCredentials(service, options);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get service-specific credential environment variable names
 *
 * @param service Service name
 * @returns Environment variable names
 */
export function getCredentialEnvVars(service: ServiceType): {
  username: string;
  password: string;
} {
  const envVars = CREDENTIAL_ENV_VARS[service];

  if (!envVars) {
    throw new Error(
      `Unknown service: ${service}. Supported services: ${Object.keys(CREDENTIAL_ENV_VARS).join(', ')}`
    );
  }

  return envVars;
}
