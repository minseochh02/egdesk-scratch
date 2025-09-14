/* eslint import/prefer-default-export: off */
import { URL } from 'url';
import path from 'path';
import { app } from 'electron';

export function resolveHtmlPath(htmlFileName: string) {
  if (process.env.NODE_ENV === 'development') {
    const port = process.env.PORT || 1212;
    const url = new URL(`http://localhost:${port}`);
    url.pathname = htmlFileName;
    return url.href;
  }
  
  // In production, when packaged as an app, the files are in app.asar
  // The structure is: app.asar/dist/renderer/index.html
  // We need to use app.getAppPath() to get the correct path to the app.asar
  const appPath = app.getAppPath();
  const filePath = path.join(appPath, 'dist', 'renderer', htmlFileName);
  
  // Log the resolved path for debugging
  console.log('Resolving HTML path:', {
    htmlFileName,
    appPath,
    filePath,
    isPackaged: app.isPackaged,
    platform: process.platform
  });
  
  // Cross-platform file URL creation
  // On Windows: C:\path\to\file -> file:///C:/path/to/file
  // On Unix: /path/to/file -> file:///path/to/file
  let fileUrl: string;
  if (process.platform === 'win32') {
    fileUrl = `file:///${filePath.replace(/\\/g, '/')}`;
  } else {
    fileUrl = `file://${filePath}`;
  }
  
  console.log('Final file URL:', fileUrl);
  return fileUrl;
}
