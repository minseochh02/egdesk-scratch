/**
 * Shared Google OAuth scopes for EGDesk
 */
export const GOOGLE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/script.projects',
  'https://www.googleapis.com/auth/script.scriptapp',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/script.deployments',
  'https://www.googleapis.com/auth/script.external_request',
  'https://www.googleapis.com/auth/script.webapp.deploy',
  'https://www.googleapis.com/auth/drive.scripts',
  'openid',
];

export const GOOGLE_OAUTH_SCOPES_STRING = GOOGLE_OAUTH_SCOPES.join(' ');

