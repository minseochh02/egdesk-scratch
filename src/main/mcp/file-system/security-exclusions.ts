/**
 * Security Exclusions for File System MCP Server
 * 
 * This file contains lists of files, directories, and patterns that should be
 * excluded from file system operations for security and safety purposes.
 */

/**
 * Executable file extensions that should be blocked
 */
export const BLOCKED_EXTENSIONS = [
  // Windows executables
  '.exe',
  '.dll',
  '.bat',
  '.cmd',
  '.com',
  '.msi',
  '.scr',
  '.vbs',
  '.wsf',
  '.ps1',
  
  // macOS executables
  '.app',
  '.dmg',
  '.pkg',
  '.dylib',
  
  // Linux executables
  '.so',
  '.deb',
  '.rpm',
  '.run',
  
  // Scripts that can execute
  '.sh',
  '.bash',
  '.zsh',
  '.csh',
  
  // Binary files
  '.bin',
  '.dat',
  '.o',
  '.a',
  
  // Compiled code
  '.pyc',
  '.pyo',
  '.class',
];

/**
 * System directories that should be blocked (absolute paths)
 * These are critical system directories that should never be modified
 */
export const BLOCKED_SYSTEM_DIRECTORIES = [
  // Windows system directories
  'C:\\Windows',
  'C:\\Program Files',
  'C:\\Program Files (x86)',
  'C:\\ProgramData',
  'C:\\System Volume Information',
  
  // macOS system directories
  '/System',
  '/Library',
  '/private',
  '/usr',
  '/bin',
  '/sbin',
  '/etc',
  '/var',
  '/tmp',
  '/dev',
  '/proc',
  
  // Linux system directories
  '/boot',
  '/root',
  '/sys',
];

/**
 * Application directories (partial matches)
 * These patterns will be checked as substring matches
 */
export const BLOCKED_APP_DIRECTORIES = [
  '/Applications/',
  '\\Applications\\',
  '/Program Files/',
  '/Program Files (x86)/',
  '\\Program Files\\',
  '\\Program Files (x86)\\',
];

/**
 * Sensitive file patterns
 * Files that contain credentials, keys, or sensitive data
 */
export const BLOCKED_SENSITIVE_FILES = [
  // Environment and config files with secrets
  '.env',
  '.env.local',
  '.env.production',
  '.env.development',
  
  // Private keys and certificates
  '.pem',
  '.key',
  '.p12',
  '.pfx',
  '.cer',
  '.crt',
  
  // SSH keys
  'id_rsa',
  'id_dsa',
  'id_ecdsa',
  'id_ed25519',
  'known_hosts',
  'authorized_keys',
  
  // Database files
  '.db',
  '.sqlite',
  '.sqlite3',
  
  // Credential files
  'credentials.json',
  'service-account-key.json',
  '.netrc',
  '.npmrc',
  '.pypirc',
];

/**
 * Directory names that should be blocked (anywhere in path)
 */
export const BLOCKED_DIRECTORY_NAMES = [
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  '__pycache__',
  'venv',
  'virtualenv',
  '.venv',
  'env',
  '.DS_Store',
  'Thumbs.db',
];

/**
 * Check if a file path should be blocked
 */
export function isPathBlocked(filePath: string): { blocked: boolean; reason?: string } {
  const normalizedPath = filePath.replace(/\\/g, '/');
  const fileName = normalizedPath.split('/').pop() || '';
  const fileExt = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')).toLowerCase() : '';
  
  // Check file extension
  if (BLOCKED_EXTENSIONS.includes(fileExt)) {
    return { blocked: true, reason: `Blocked file extension: ${fileExt}` };
  }
  
  // Check system directories (absolute paths)
  for (const sysDir of BLOCKED_SYSTEM_DIRECTORIES) {
    const normalizedSysDir = sysDir.replace(/\\/g, '/');
    if (normalizedPath.startsWith(normalizedSysDir)) {
      return { blocked: true, reason: `System directory access blocked: ${sysDir}` };
    }
  }
  
  // Check application directories
  for (const appDir of BLOCKED_APP_DIRECTORIES) {
    const normalizedAppDir = appDir.replace(/\\/g, '/');
    if (normalizedPath.includes(normalizedAppDir)) {
      return { blocked: true, reason: `Application directory access blocked` };
    }
  }
  
  // Check sensitive files
  for (const sensitiveFile of BLOCKED_SENSITIVE_FILES) {
    if (fileName === sensitiveFile || fileName.endsWith(sensitiveFile)) {
      return { blocked: true, reason: `Sensitive file blocked: ${sensitiveFile}` };
    }
  }
  
  // Check blocked directory names
  const pathParts = normalizedPath.split('/');
  for (const blockedDir of BLOCKED_DIRECTORY_NAMES) {
    if (pathParts.includes(blockedDir)) {
      return { blocked: true, reason: `Blocked directory in path: ${blockedDir}` };
    }
  }
  
  return { blocked: false };
}

/**
 * Security configuration options
 */
export interface SecurityConfig {
  enableExtensionBlocking?: boolean;
  enableSystemDirBlocking?: boolean;
  enableAppDirBlocking?: boolean;
  enableSensitiveFileBlocking?: boolean;
  enableDirectoryNameBlocking?: boolean;
  additionalBlockedPaths?: string[];
  additionalBlockedExtensions?: string[];
}

/**
 * Check if a path should be blocked with custom security config
 */
export function isPathBlockedWithConfig(
  filePath: string,
  config: SecurityConfig = {}
): { blocked: boolean; reason?: string } {
  const {
    enableExtensionBlocking = true,
    enableSystemDirBlocking = true,
    enableAppDirBlocking = true,
    enableSensitiveFileBlocking = true,
    enableDirectoryNameBlocking = true,
    additionalBlockedPaths = [],
    additionalBlockedExtensions = [],
  } = config;
  
  const normalizedPath = filePath.replace(/\\/g, '/');
  const fileName = normalizedPath.split('/').pop() || '';
  const fileExt = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')).toLowerCase() : '';
  
  // Check additional blocked paths first
  for (const blockedPath of additionalBlockedPaths) {
    const normalizedBlockedPath = blockedPath.replace(/\\/g, '/');
    if (normalizedPath.startsWith(normalizedBlockedPath)) {
      return { blocked: true, reason: `Custom blocked path: ${blockedPath}` };
    }
  }
  
  // Check additional extensions
  if (enableExtensionBlocking && additionalBlockedExtensions.includes(fileExt)) {
    return { blocked: true, reason: `Custom blocked extension: ${fileExt}` };
  }
  
  // Check standard extension blocking
  if (enableExtensionBlocking && BLOCKED_EXTENSIONS.includes(fileExt)) {
    return { blocked: true, reason: `Blocked file extension: ${fileExt}` };
  }
  
  // Check system directories
  if (enableSystemDirBlocking) {
    for (const sysDir of BLOCKED_SYSTEM_DIRECTORIES) {
      const normalizedSysDir = sysDir.replace(/\\/g, '/');
      if (normalizedPath.startsWith(normalizedSysDir)) {
        return { blocked: true, reason: `System directory access blocked: ${sysDir}` };
      }
    }
  }
  
  // Check application directories
  if (enableAppDirBlocking) {
    for (const appDir of BLOCKED_APP_DIRECTORIES) {
      const normalizedAppDir = appDir.replace(/\\/g, '/');
      if (normalizedPath.includes(normalizedAppDir)) {
        return { blocked: true, reason: `Application directory access blocked` };
      }
    }
  }
  
  // Check sensitive files
  if (enableSensitiveFileBlocking) {
    for (const sensitiveFile of BLOCKED_SENSITIVE_FILES) {
      if (fileName === sensitiveFile || fileName.endsWith(sensitiveFile)) {
        return { blocked: true, reason: `Sensitive file blocked: ${sensitiveFile}` };
      }
    }
  }
  
  // Check blocked directory names
  if (enableDirectoryNameBlocking) {
    const pathParts = normalizedPath.split('/');
    for (const blockedDir of BLOCKED_DIRECTORY_NAMES) {
      if (pathParts.includes(blockedDir)) {
        return { blocked: true, reason: `Blocked directory in path: ${blockedDir}` };
      }
    }
  }
  
  return { blocked: false };
}

