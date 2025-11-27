/**
 * Google Workspace Business Card Service
 * Creates business card spreadsheets with Apps Script functionality
 */

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import Store from 'electron-store';
import { ipcMain } from 'electron';
import { getStore } from '../../../src/main/storage';
import { authorizeScriptWithPlaywright, listChromeProfilesWithEmail, testOpenChromeWithProfile, launchEGDeskChromeForLogin } from './playwright-authorization';

interface GoogleWorkspaceToken {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  scopes?: string[];
  saved_at?: number;
  supabase_session?: boolean;
  user_id?: string;
  email?: string;
}

export class BusinessCardService {
  private store: Store;
  private oauth2Client: OAuth2Client | null = null;

  constructor() {
    this.store = new Store({
      name: 'egdesk-auth',
      encryptionKey: 'egdesk-auth-encryption-key',
    });
  }

  /**
   * Get Google OAuth token from electron-store
   */
  private getGoogleToken(): GoogleWorkspaceToken | null {
    const token = this.store.get('google_workspace_token') as GoogleWorkspaceToken | undefined;
    return token || null;
  }

  /**
   * Get Gemini API key from electron-store
   */
  private getGeminiApiKey(): string | null {
    try {
      // First check environment variable
      if (process.env.GEMINI_API_KEY && typeof process.env.GEMINI_API_KEY === 'string') {
        return process.env.GEMINI_API_KEY.trim();
      }

      // Then check electron-store
      const store = getStore();
      if (!store) {
        return null;
      }

      const aiKeys = store.get('ai-keys', []) as any[];
      if (!Array.isArray(aiKeys)) {
        return null;
      }

      // Find Google/Gemini API key
      const preferred =
        aiKeys.find((k: any) => (k?.name || '').toLowerCase() === 'egdesk' && k?.providerId === 'google') ??
        aiKeys.find((k: any) => k?.providerId === 'google' && k?.isActive) ??
        aiKeys.find((k: any) => k?.providerId === 'google');

      const apiKey = preferred?.fields?.apiKey;
      if (typeof apiKey === 'string' && apiKey.trim().length > 0) {
        return apiKey.trim();
      }

      return null;
    } catch (error) {
      console.warn('Failed to get Gemini API key from store:', error);
      return null;
    }
  }

  /**
   * Initialize OAuth2 client with stored token
   * Automatically refreshes the access token if expired using the refresh token
   */
  private async initializeOAuthClient(): Promise<OAuth2Client> {
    const token = this.getGoogleToken();

    if (!token || !token.access_token) {
      throw new Error('Google OAuth token not found. Please grant permission first.');
    }

    // Create OAuth2 client
    // For token refresh, we need the actual Google OAuth client credentials
    // These should match the ones used in Supabase OAuth configuration
    // If not available, we'll try without them (refresh may fail, but API calls with valid token will work)
    const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
    const REDIRECT_URI = 'egdesk://auth/callback';

    // OAuth2Client requires client ID/secret for token refresh
    // If not available, create without them (refresh won't work, but valid tokens will)
    const oauth2Client = CLIENT_ID && CLIENT_SECRET
      ? new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)
      : new OAuth2Client();

    // Set credentials with the stored tokens
    oauth2Client.setCredentials({
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expiry_date: token.expires_at ? token.expires_at * 1000 : undefined,
    });

    // Check if token is expired and refresh if needed
    const isExpired = token.expires_at && token.expires_at * 1000 < Date.now();
    
    if (isExpired && token.refresh_token) {
      try {
        console.log('🔄 Access token expired, refreshing using refresh token...');
        const { credentials } = await oauth2Client.refreshAccessToken();
        
        // Update stored token with new credentials
        const updatedToken = {
          ...token,
          access_token: credentials.access_token!,
          refresh_token: credentials.refresh_token || token.refresh_token,
          expires_at: credentials.expiry_date ? Math.floor(credentials.expiry_date / 1000) : token.expires_at,
          saved_at: Date.now(),
        };
        
        this.store.set('google_workspace_token', updatedToken);
        console.log('✅ Access token refreshed successfully');
        
        // Update the client with new credentials
        oauth2Client.setCredentials(credentials);
      } catch (refreshError: any) {
        console.error('❌ Failed to refresh access token:', refreshError);
        throw new Error(`Failed to refresh access token: ${refreshError.message}. Please re-authorize.`);
      }
    } else if (isExpired && !token.refresh_token) {
      throw new Error('Google OAuth token has expired and no refresh token is available. Please re-authorize.');
    }

    this.oauth2Client = oauth2Client;
    return oauth2Client;
  }


  /**
   * Create a Google Drive folder
   * @param folderName - Name of the folder to create
   * @param parentFolderId - Optional parent folder ID (defaults to root)
   */
  async createDriveFolder(
    folderName: string,
    parentFolderId?: string
  ): Promise<{
    folderId: string;
    folderUrl: string;
  }> {
    try {
      const auth = await this.initializeOAuthClient();
      const drive = google.drive({ version: 'v3', auth });

      const folderMetadata: any = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      };

      if (parentFolderId) {
        folderMetadata.parents = [parentFolderId];
      }

      const response = await drive.files.create({
        requestBody: folderMetadata,
        fields: 'id, webViewLink',
      });

      if (!response.data.id) {
        throw new Error('Failed to create folder: No folder ID returned');
      }

      const folderId = response.data.id;
      const folderUrl = response.data.webViewLink || `https://drive.google.com/drive/folders/${folderId}`;

      console.log(`✅ Created Drive folder: ${folderName} (ID: ${folderId})`);

      return {
        folderId,
        folderUrl,
      };
    } catch (error: any) {
      console.error('Error creating Drive folder:', error);
      throw new Error(`Failed to create Drive folder: ${error.message}`);
    }
  }

  /**
   * Create a business card spreadsheet with Apps Script
   * @param driveFolderId - Optional Google Drive folder ID to monitor for business card files. If not provided, a folder will be created automatically.
   * @param sheetName - Name of the sheet to store business card information (default: "명함 정보")
   */
  async createBusinessCardSpreadsheet(
    driveFolderId?: string,
    sheetName: string = '명함 정보'
  ): Promise<{
    spreadsheetId: string;
    spreadsheetUrl: string;
    scriptId: string;
    folderId: string;
    folderUrl: string;
  }> {
    try {
      const auth = await this.initializeOAuthClient();
      const sheets = google.sheets({ version: 'v4', auth });
      const script = google.script({ version: 'v1', auth });

      // Create the spreadsheet
      const spreadsheetTitle = '명함 관리 시스템';
      const createResponse = await sheets.spreadsheets.create({
        requestBody: {
          properties: {
            title: spreadsheetTitle,
          },
        },
      });

      if (!createResponse.data.spreadsheetId) {
        throw new Error('Failed to create spreadsheet: No spreadsheet ID returned');
      }

      const spreadsheetId = createResponse.data.spreadsheetId;
      const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

      console.log(`✅ Created business card spreadsheet: ${spreadsheetTitle} (ID: ${spreadsheetId})`);

      // Create or use existing Drive folder
      let folderId: string;
      let folderUrl: string;

      if (driveFolderId) {
        // Use provided folder ID
        folderId = driveFolderId;
        const drive = google.drive({ version: 'v3', auth });
        try {
          const folderResponse = await drive.files.get({
            fileId: folderId,
            fields: 'id, webViewLink',
          });
          folderUrl = folderResponse.data.webViewLink || `https://drive.google.com/drive/folders/${folderId}`;
          console.log(`✅ Using existing Drive folder (ID: ${folderId})`);
        } catch (error: any) {
          console.warn(`Could not verify folder ${folderId}, creating new folder instead:`, error.message);
          // If folder doesn't exist or can't be accessed, create a new one
          const newFolder = await this.createDriveFolder('명함 파일', undefined);
          folderId = newFolder.folderId;
          folderUrl = newFolder.folderUrl;
        }
      } else {
        // Create a new folder for business card files
        const newFolder = await this.createDriveFolder('명함 파일', undefined);
        folderId = newFolder.folderId;
        folderUrl = newFolder.folderUrl;
      }

      // Get the first sheet (default sheet) and rename it
      const sheetResponse = await sheets.spreadsheets.get({
        spreadsheetId: spreadsheetId,
        fields: 'sheets.properties',
      });

      const firstSheet = sheetResponse.data.sheets?.[0];
      const sheetId = firstSheet?.properties?.sheetId || 0;

      // Rename the default sheet to match the expected sheet name
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: spreadsheetId,
        requestBody: {
          requests: [
            {
              updateSheetProperties: {
                properties: {
                  sheetId: sheetId,
                  title: sheetName,
                },
                fields: 'title',
              },
            },
          ],
        },
      });

      // Define column headers
      const columnHeaders = [
        '기록일시',
        '이름',
        '전화번호(휴대폰)',
        '영문 이름',
        '직함',
        '회사',
        '소속부서',
        '전화번호(사무실)',
        '이메일',
        '홈페이지',
        '참조 파일',
        '파일 보기',
      ];

      // Add header row to the spreadsheet
      await sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetId,
        range: 'A1:L1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [columnHeaders],
        },
      });

      // Format the header row
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: spreadsheetId,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId: sheetId,
                  startRowIndex: 0,
                  endRowIndex: 1,
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: {
                      red: 0.2,
                      green: 0.4,
                      blue: 0.8,
                    },
                    textFormat: {
                      foregroundColor: {
                        red: 1.0,
                        green: 1.0,
                        blue: 1.0,
                      },
                      bold: true,
                      fontSize: 11,
                    },
                  },
                },
                fields: 'userEnteredFormat(backgroundColor,textFormat)',
              },
            },
          ],
        },
      });

      // Create a table with the header row and column properties
      const columnProperties = [
        { columnIndex: 0, columnName: '기록일시', columnType: 'DATE' as const },
        { columnIndex: 1, columnName: '이름', columnType: 'TEXT' as const },
        { columnIndex: 2, columnName: '전화번호(휴대폰)', columnType: 'TEXT' as const },
        { columnIndex: 3, columnName: '영문 이름', columnType: 'TEXT' as const },
        { columnIndex: 4, columnName: '직함', columnType: 'TEXT' as const },
        { columnIndex: 5, columnName: '회사', columnType: 'TEXT' as const },
        { columnIndex: 6, columnName: '소속부서', columnType: 'TEXT' as const },
        { columnIndex: 7, columnName: '전화번호(사무실)', columnType: 'TEXT' as const },
        { columnIndex: 8, columnName: '이메일', columnType: 'TEXT' as const },
        { columnIndex: 9, columnName: '홈페이지', columnType: 'TEXT' as const },
        { columnIndex: 10, columnName: '참조 파일', columnType: 'TEXT' as const },
        { columnIndex: 11, columnName: '파일 보기', columnType: 'TEXT' as const },
      ];

      // Create the table (header row + space for data rows)
      // Table will start at row 0 (header) and extend to row 100 (for future data)
      await this.createTable(
        spreadsheetId,
        sheetId,
        '명함 정보',
        0, // startRowIndex (header row)
        100, // endRowIndex (space for 99 data rows)
        0, // startColumnIndex (column A)
        12, // endColumnIndex (column L)
        columnProperties
      );

      console.log(`✅ Created table with headers: ${columnHeaders.join(', ')}`);

      // Create Apps Script project for the spreadsheet
      const scriptTitle = '명함 관리 스크립트';
      const scriptCreateResponse = await script.projects.create({
        requestBody: {
          title: scriptTitle,
          parentId: spreadsheetId,
        },
      });

      if (!scriptCreateResponse.data.scriptId) {
        throw new Error('Failed to create Apps Script project: No script ID returned');
      }

      const scriptId = scriptCreateResponse.data.scriptId;

      // Get Gemini API key from electron-store
      const geminiApiKey = this.getGeminiApiKey();

      // Apps Script code for business card processing with Gemini AI
      const scriptCode = `/**
 * @OnlyCurrentDoc
 *
 * Google Drive의 특정 폴더에 새로 업로드되는 명함 파일을 감지합니다.
 * Gemini AI가 파일(이미지 포함)의 내용을 분석하여 이름, 회사, 연락처 등 명함 정보를 추출하고,
 * 이 스크립트가 연결된(bound) Google Sheet에 자동으로 기록합니다.
 * (이미지 파일 OCR 기능 포함)
 *
 * [스크립트 실행 방법]
 * 1. API 키는 electron-store에서 자동으로 가져와 설정됩니다. (또는 '명함 관리' > 'Gemini API 키 설정' 메뉴에서 수동 설정 가능)
 * 2. 자동 실행 (권장): Apps Script '트리거' 메뉴에서 'processNewFiles' 함수를 시간 기반(예: 5분마다)으로 실행되도록 설정합니다.
 * 3. 수동 실행: 파일 업로드 후 즉시 처리를 원할 경우, '명함 관리' > '새 명함 파일 처리' 메뉴를 클릭합니다.
 *
 * [프로젝트 설정 참고]
 * 이 스크립트가 정상적으로 작동하려면 이미지 OCR 기능을 위해 Drive 고급 서비스가 활성화되어 있어야 합니다.
 * (편집기 > 서비스 옆 '+' > Google Drive API 추가)
 */

// --- ⚙️ 사용자 설정 영역 -----------------------------------------
// 1. 모니터링할 Google Drive 폴더의 ID를 입력하세요.
const DRIVE_FOLDER_ID = "${folderId}"; // 👈 명함 파일을 업로드할 폴더 ID 입력

// 2. 명함 정보를 기록할 시트의 이름을 입력하세요.
const BIZCARD_SHEET_NAME = "${sheetName}";   // 👈 명함 정보가 기록될 시트 이름

// 3. Embedded Gemini API key (from electron-store, set automatically)
const EMBEDDED_GEMINI_API_KEY = "${geminiApiKey ? geminiApiKey : ''}";
// --- -----------------------------------------------------------------

/**
 * Initialize API key from embedded value if available and not already set
 */
function initializeApiKeyIfNeeded() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const existingKey = scriptProperties.getProperty('GEMINI_API_KEY');
  
  // Only set if not already configured and we have an embedded key
  if (!existingKey && EMBEDDED_GEMINI_API_KEY) {
    try {
      scriptProperties.setProperty('GEMINI_API_KEY', EMBEDDED_GEMINI_API_KEY);
      Logger.log('✅ Gemini API key initialized from electron-store');
    } catch (e) {
      Logger.log('⚠️ Failed to initialize API key: ' + e.toString());
    }
  }
}

/**
 * 스프레드시트가 열릴 때 커스텀 메뉴를 추가합니다.
 */
function onOpen() {
  // Initialize API key from embedded value if not already set
  initializeApiKeyIfNeeded();
  
  const ui = SpreadsheetApp.getUi();
  const menu = ui.createMenu('명함 관리');
  
  menu.addItem('새 명함 파일 처리', 'runNow');
  menu.addSeparator();

  // API 키 설정 상태에 따라 메뉴 이름 변경
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (apiKey) {
    menu.addItem('Gemini API 키 변경', 'promptForApiKey');
  } else {
    menu.addItem('Gemini API 키 설정', 'promptForApiKey');
  }
  
  menu.addToUi();
}

/**
 * [메뉴 실행] Gemini API 키를 입력받아 안전하게 저장합니다.
 */
function promptForApiKey() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    'Gemini API 키 설정',
    'Gemini API 키를 입력하세요:',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() == ui.Button.OK) {
    const apiKey = response.getResponseText().trim();
    if (apiKey) {
      PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', apiKey);
      ui.alert('성공', 'Gemini API 키가 성공적으로 저장되었습니다.', ui.ButtonSet.OK);
    } else {
      ui.alert('오류', '입력된 키가 없습니다.', ui.ButtonSet.OK);
    }
  }
}

/**
 * 지정된 폴더의 새 파일을 처리합니다.
 */
function processNewFiles() {
  try {
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    const files = folder.getFiles();
    const scriptProperties = PropertiesService.getScriptProperties();

    while (files.hasNext()) {
      const file = files.next();
      if (!scriptProperties.getProperty(file.getId())) {
        Logger.log(\`New file found: "\${file.getName()}" (\${file.getId()})\`);
        processSingleFile(file);
      }
    }
  } catch (e) {
    Logger.log(\`An error occurred: \${e.toString()}\`);
    SpreadsheetApp.getUi().alert(\`오류 발생: \${e.message}\`);
  }
}

/**
 * [메뉴 실행] 스크립트를 수동으로 실행합니다.
 * ★ 최신 수정: 작업 완료 토스트 메시지 추가
 */
function runNow() {
  Logger.log("Manual execution started.");
  
  try {
    processNewFiles(); // 핵심 로직 실행
    Logger.log("Manual execution finished.");
    
    // --- [추가] 작업 완료 토스트 메시지 ---
    SpreadsheetApp.getActiveSpreadsheet().toast('명함 파일 처리가 완료되었습니다.', '작업 완료', 5);
    // --- [추가] ---
    
  } catch (e) {
    // 혹시 모를 실행 오류에 대비해 UI에 오류 알림
    Logger.log(\`Manual execution failed: \${e.message}\`);
    SpreadsheetApp.getUi().alert(\`수동 실행 중 오류가 발생했습니다: \${e.message}\`);
  }
}

/**
 * Create a time-based trigger for processNewFiles function
 * This can be called programmatically via Apps Script API
 * @param {number} intervalMinutes - Interval in minutes (default: 5)
 */
function createProcessNewFilesTrigger(intervalMinutes) {
  const interval = intervalMinutes || 5;
  
  // Delete existing triggers for processNewFiles to avoid duplicates
  const allTriggers = ScriptApp.getProjectTriggers();
  for (const trigger of allTriggers) {
    if (trigger.getHandlerFunction() === 'processNewFiles') {
      ScriptApp.deleteTrigger(trigger);
      Logger.log('Deleted existing trigger for processNewFiles');
    }
  }
  
  // Create a new time-driven trigger
  // Note: Minimum interval is 1 minute, but Google may enforce higher minimums
  const trigger = ScriptApp.newTrigger('processNewFiles')
    .timeBased()
    .everyMinutes(interval)
    .create();
  
  Logger.log(\`✅ Created time-based trigger for processNewFiles (every \${interval} minutes)\`);
  return {
    success: true,
    triggerId: trigger.getUniqueId(),
    interval: interval
  };
}

/**
 * Delete all triggers for processNewFiles function
 */
function deleteProcessNewFilesTrigger() {
  const allTriggers = ScriptApp.getProjectTriggers();
  let deletedCount = 0;
  
  for (const trigger of allTriggers) {
    if (trigger.getHandlerFunction() === 'processNewFiles') {
      ScriptApp.deleteTrigger(trigger);
      deletedCount++;
      Logger.log(\`Deleted trigger: \${trigger.getUniqueId()}\`);
    }
  }
  
  Logger.log(\`✅ Deleted \${deletedCount} trigger(s) for processNewFiles\`);
  return {
    success: true,
    deletedCount: deletedCount
  };
}

/**
 * [Core Logic] Analyzes a single file and records the data.
 */
function processSingleFile(file) {
  const fileId = file.getId();
  const scriptProperties = PropertiesService.getScriptProperties();

  const content = getFileContent(file);
  if (!content) {
    Logger.log(\`Could not extract text from "\${file.getName()}". Skipping.\`);
    scriptProperties.setProperty(fileId, 'processed_failed_or_unsupported');
    return;
  }

  // --- [디버깅 로그 추가] ---
  // OCR이 어떤 텍스트를 추출했는지 확인합니다.
  Logger.log(\`[DEBUG] OCR Extracted Text: \\n---\\n\${content}\\n---\`);
  // --- [디버깅 로그 종료] ---

  // Extract business card details using AI
  const bizCardData = extractDetailsWithAI(content, getAiBizCardPrompt);
  if (bizCardData) {
    Logger.log(\`AI has extracted business card information.\`);
    addBizCardToGoogleSheet(bizCardData, file.getName(), file.getUrl());
  } else {
    Logger.log("No business card information was extracted.");
  }

  scriptProperties.setProperty(fileId, 'processed_success');
  Logger.log(\`Finished processing "\${file.getName()}".\`);
}

/**
 * Prompt for extracting business card details.
 */
const getAiBizCardPrompt = (text) => {
  return \`
    The following text was extracted from a business card. Extract the information for the items below and return it in a JSON object format.

    Items to extract:
    - "name": Name (in Korean)
    - "mobilePhone": Mobile phone number. If there are multiple, use the first one.
    - "englishName": English name
    - "title": Job title (e.g., CEO, Team Leader, Manager)
    - "company": Company name
    - "department": Department
    - "officePhone": Office phone number
    - "email": Email address
    - "website": Website address

    Instructions:
    - If information for any item cannot be found, set its value to "정보 없음" (Information not available).
    - You must return only the JSON object, with no other explanations.

    --- Text to Analyze Start ---
    \${text}
    --- Text to Analyze End ---
  \`;
};

/**
 * Extracts text content from a file object (includes OCR).
 */
function getFileContent(file) {
  const fileId = file.getId();
  const mimeType = file.getMimeType();
  let content = null;

  if (mimeType === MimeType.GOOGLE_DOCS) {
    content = DocumentApp.openById(fileId).getBody().getText();
  } else if (mimeType.startsWith('text/')) {
    content = file.getBlob().getDataAsString('UTF-8');
  } else if (mimeType.startsWith('image/')) {
    Logger.log(\`Image file detected: "\${file.getName()}". Attempting OCR.\`);
    const MAX_RETRIES = 5;
    for (let i = 0; i < MAX_RETRIES; i++) {
      try {
        // Drive 고급 서비스(v3)를 사용하여 OCR 수행
        const resource = { title: \`[OCR-Temp] \${file.getName()}\`, mimeType: MimeType.GOOGLE_DOCS };
        const tempDocFile = Drive.Files.copy(resource, fileId, { ocr: true }); // ocr: true 옵션이 중요
        const tempDocId = tempDocFile.id;
        
        if (tempDocId) {
          content = DocumentApp.openById(tempDocId).getBody().getText();
          Drive.Files.remove(tempDocId); // 임시 파일 즉시 삭제
          Logger.log(\`OCR successful. Temporary file deleted: \${tempDocId}\`);
          return content;
        } else {
          throw new Error("Failed to get temporary file ID after OCR.");
        }
      } catch (e) {
        const errorString = e.toString();
        if (errorString.includes('rate limit') || errorString.includes('User rate limit exceeded') || errorString.includes('Internal Error')) {
          const waitTime = Math.pow(2, i) * 1000 + Math.floor(Math.random() * 1000);
          
          const retryCount = \`(\${i + 1}/\${MAX_RETRIES})\`;
          Logger.log(\`API error detected (\${errorString}). Retrying in \${waitTime / 1000} seconds... \${retryCount}\`);
          
          Utilities.sleep(waitTime);
        } else {
          Logger.log(\`Unrecoverable error during OCR for '\${file.getName()}': \${errorString}\`);
          return null;
        }
      }
    }
    Logger.log(\`OCR processing for '\${file.getName()}' failed after all retries.\`);
    return null;
  }
  return content;
}

/**
 * Calls Gemini AI API to extract structured data from text using a given prompt.
 */
function extractDetailsWithAI(text, promptFunction) {
  const GEMINI_API_KEY = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  const ui = SpreadsheetApp.getUi();
  
  if (!GEMINI_API_KEY) {
    Logger.log("Gemini API 키가 설정되지 않았습니다. '명함 관리' 메뉴에서 키를 저장해주세요.");
    ui.alert('오류', "Gemini API 키가 설정되지 않았습니다. '명함 관리' > 'Gemini API 키 설정' 메뉴에서 키를 저장해주세요.", ui.ButtonSet.OK);
    return null;
  }
  
  const url = \`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=\${GEMINI_API_KEY}\`;
  const payload = { contents: [{ parts: [{ text: promptFunction(text) }] }] };
  const options = { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const resultText = response.getContentText();

    if (responseCode === 200) {
      const jsonResponse = JSON.parse(resultText);

      if (!jsonResponse.candidates || !jsonResponse.candidates[0].content || !jsonResponse.candidates[0].content.parts) {
        Logger.log(\`[DEBUG] AI response format is unexpected: \${resultText}\`);
        return null;
      }

      const aiContent = jsonResponse.candidates[0].content.parts[0].text;
      
      Logger.log(\`[DEBUG] Raw AI Response Text: \\n---\\n\${aiContent}\\n---\`);

      const cleanedText = aiContent.replace(/\\\`\\\`\\\`json/g, '').replace(/\\\`\\\`\\\`/g, '').trim();
      try {
        return JSON.parse(cleanedText);
      } catch(e) {
        Logger.log(\`Failed to parse the AI response as JSON. Error: \${e}. Retrying with regex.\`);
        const jsonMatch = cleanedText.match(/\\{[\\s\\S]*\\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
      
      Logger.log("Could not find a valid JSON object in the AI's response.");
      return null;
    } else {
      Logger.log(\`AI API Error (HTTP \${responseCode}): \${resultText}\`);
      return null;
    }
  } catch (e) {
    Logger.log(\`Exception during AI API call: \${e.toString()}\`);
    return null;
  }
}

/**
 * Adds the extracted business card information to the designated sheet.
 * ★ 최신 수정 사항: 전화번호 형식 (+82 -> (+82))
 */
function addBizCardToGoogleSheet(bizCardData, sourceFileName, fileUrl) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(BIZCARD_SHEET_NAME);

    if (!sheet) {
      sheet = ss.insertSheet(BIZCARD_SHEET_NAME);
      Logger.log(\`'\${BIZCARD_SHEET_NAME}' sheet has been created.\`);
      // Header row matches the table structure created by the API
      const header = ['기록일시', '이름', '전화번호(휴대폰)', '영문 이름', '직함', '회사', '소속부서', '전화번호(사무실)', '이메일', '홈페이지', '참조 파일', '파일 보기'];
      sheet.appendRow(header);
    }

    // bizCardData.name이 존재하면 모든 공백을 제거하고, 그렇지 않으면 '정보 없음'을 사용
    const processedName = bizCardData.name ? bizCardData.name.replace(/\\s/g, '') : '정보 없음';

    // --- [수정 시작] 전화번호 형식 변경 ---
    /**
     * 전화번호 형식을 변환합니다. (+82 10... -> (+82) 10...)
     * @param {string} phone - 원본 전화번호 문자열
     * @returns {string} - 변환된 전화번호 문자열
     */
    const formatPhoneNumber = (phone) => {
      const phoneStr = phone || '정보 없음';
      // 정규식 /^\\+82\\s/ 는 문자열이 정확히 '+82 '로 시작하는지 검사합니다.
      return phoneStr.replace(/^\\+82\\s/, '(+82) ');
    };
    
    const formattedMobile = formatPhoneNumber(bizCardData.mobilePhone);
    const formattedOffice = formatPhoneNumber(bizCardData.officePhone);
    // --- [수정 종료] ---

    // Column order matches the table structure: 기록일시, 이름, 전화번호(휴대폰), 영문 이름, 직함, 회사, 소속부서, 전화번호(사무실), 이메일, 홈페이지, 참조 파일, 파일 보기
    const newRow = [
      new Date(), // 기록일시
      processedName, // 이름
      formattedMobile, // 전화번호(휴대폰)
      bizCardData.englishName || '정보 없음', // 영문 이름
      bizCardData.title || '정보 없음', // 직함
      bizCardData.company || '정보 없음', // 회사
      bizCardData.department || '정보 없음', // 소속부서
      formattedOffice, // 전화번호(사무실)
      bizCardData.email || '정보 없음', // 이메일
      bizCardData.website || '정보 없음', // 홈페이지
      sourceFileName, // 참조 파일
      fileUrl // 파일 보기
    ];
    sheet.appendRow(newRow);
    Logger.log(\`Successfully added business card details to the sheet for: "\${processedName}"\`);
  } catch (e) {
    Logger.log(\`Error accessing or adding data to the business card sheet: \${e.toString()}\`);
  }
}`;

      // Update the script content with manifest
      await script.projects.updateContent({
        scriptId: scriptId,
        requestBody: {
          files: [
            {
              name: 'appsscript',
              type: 'JSON',
              source: JSON.stringify({
                timeZone: 'America/New_York',
                dependencies: {},
                exceptionLogging: 'STACKDRIVER',
                runtimeVersion: 'V8',
              }),
            },
            {
              name: 'Code',
              type: 'SERVER_JS',
              source: scriptCode,
            },
          ],
        },
      });

      console.log(`✅ Added Apps Script to business card spreadsheet (Script ID: ${scriptId})`);

      // Wait a moment for the script to be fully available (Google API propagation delay)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Use Playwright to automate authorization by visiting Apps Script editor
      // and executing a function to trigger the authorization dialog
      console.log('🤖 Attempting to authorize script using Playwright automation...');
      
      try {
        // Get selected Chrome profile from electron-store (if any)
        const store = getStore();
        let selectedProfile: string | undefined = undefined;
        
        if (store) {
          try {
            const storedValue = store.get('google-workspace-chrome-profile');
            console.log('🔍 Reading Chrome profile from store, raw value:', storedValue);
            
            if (storedValue && typeof storedValue === 'string' && storedValue.trim() !== '') {
              selectedProfile = storedValue;
              console.log(`🔐 Found user-selected Chrome profile in store: ${selectedProfile}`);
            } else {
              console.log('ℹ️  No Chrome profile selected in store (value:', storedValue, '), will use auto-detection');
            }
          } catch (error: any) {
            console.warn('⚠️  Failed to read Chrome profile from store:', error.message);
          }
        } else {
          console.warn('⚠️  Store not available');
        }
        
        console.log('📤 Passing Chrome profile to authorizeScriptWithPlaywright:', selectedProfile || '(undefined - will auto-detect)');
        
        const authResult = await authorizeScriptWithPlaywright(
          spreadsheetUrl, 
          scriptId,
          selectedProfile // Pass undefined if not found, not empty string
        );
        
        if (authResult.success) {
          console.log('✅ Script authorization completed via Playwright');
          
          // Wait a moment for authorization to propagate
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Try to create the trigger using API
          try {
            const triggerResult = await script.scripts.run({
              scriptId: scriptId,
              requestBody: {
                function: 'createProcessNewFilesTrigger',
                parameters: [5], // 5 minutes interval
              },
            });

            if (triggerResult.data.error) {
              console.warn('⚠️ Could not create trigger via API:', triggerResult.data.error);
              console.log('💡 Trigger may need to be created manually in Apps Script editor');
            } else {
              console.log(`✅ Created time-based trigger for automatic processing (every 5 minutes)`);
            }
          } catch (triggerError: any) {
            console.warn('⚠️ Could not create trigger via API:', triggerError.message);
            console.log('💡 You can manually create the trigger in Apps Script editor');
          }
        } else {
          console.warn('⚠️ Playwright authorization attempt completed with issues:', authResult.error);
          console.log('💡 You may need to manually authorize the script:');
          console.log(`   - Open Apps Script editor: https://script.google.com/home/projects/${scriptId}/edit`);
          console.log('   - Run any function to trigger authorization');
        }
      } catch (playwrightError: any) {
        console.warn('⚠️ Playwright automation failed:', playwrightError.message);
        console.log('💡 Manual authorization required:');
        console.log(`   - Open Apps Script editor: https://script.google.com/home/projects/${scriptId}/edit`);
        console.log('   - Run any function to trigger authorization');
      }

      return {
        spreadsheetId,
        spreadsheetUrl,
        scriptId,
        folderId,
        folderUrl,
      };
    } catch (error: any) {
      console.error('Error creating business card spreadsheet:', error);
      throw new Error(`Failed to create business card spreadsheet: ${error.message}`);
    }
  }

  /**
   * Create a table in a Google Sheet
   * This creates a structured table (like Command + Option + T in Google Sheets)
   * @param spreadsheetId - The ID of the spreadsheet
   * @param sheetId - The ID of the sheet (0 for first sheet)
   * @param tableName - Name of the table
   * @param startRowIndex - Starting row index (0-based)
   * @param endRowIndex - Ending row index (exclusive, 0-based)
   * @param startColumnIndex - Starting column index (0-based)
   * @param endColumnIndex - Ending column index (exclusive, 0-based)
   * @param columnProperties - Optional column properties (types, validation, etc.)
   */
  async createTable(
    spreadsheetId: string,
    sheetId: number,
    tableName: string,
    startRowIndex: number,
    endRowIndex: number,
    startColumnIndex: number,
    endColumnIndex: number,
    columnProperties?: Array<{
      columnIndex: number;
      columnName?: string;
      columnType?: 'TEXT' | 'NUMBER' | 'PERCENT' | 'CURRENCY' | 'DATE' | 'DROPDOWN';
      dataValidationRule?: {
        condition: {
          type: string;
          values?: Array<{ userEnteredValue: string }>;
        };
      };
    }>
  ): Promise<{ tableId: string }> {
    try {
      const auth = await this.initializeOAuthClient();
      const sheets = google.sheets({ version: 'v4', auth });

      // Generate a unique table ID
      const tableId = `table_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      const requestBody: any = {
        requests: [
          {
            addTable: {
              table: {
                name: tableName,
                tableId: tableId,
                range: {
                  sheetId: sheetId,
                  startRowIndex: startRowIndex,
                  endRowIndex: endRowIndex,
                  startColumnIndex: startColumnIndex,
                  endColumnIndex: endColumnIndex,
                },
              },
            },
          },
        ],
      };

      // Add column properties if provided
      if (columnProperties && columnProperties.length > 0) {
        requestBody.requests[0].addTable.table.columnProperties = columnProperties;
      }

      const response = await sheets.spreadsheets.batchUpdate({
        spreadsheetId: spreadsheetId,
        requestBody: requestBody,
      });

      if (!response.data.replies || !response.data.replies[0]?.addTable?.table) {
        throw new Error('Failed to create table: No table returned in response');
      }

      const createdTable = response.data.replies[0].addTable.table;
      console.log(`✅ Created table "${tableName}" with ID: ${createdTable.tableId}`);

      return {
        tableId: createdTable.tableId || tableId,
      };
    } catch (error: any) {
      console.error('Error creating table:', error);
      throw new Error(`Failed to create table: ${error.message}`);
    }
  }

  /**
   * Register IPC handlers for the renderer process
   */
  registerIPCHandlers(): void {
    ipcMain.handle('business-card:create-spreadsheet', async (_, driveFolderId?: string, sheetName?: string) => {
      try {
        const result = await this.createBusinessCardSpreadsheet(driveFolderId, sheetName);
        return {
          success: true,
          spreadsheetId: result.spreadsheetId,
          spreadsheetUrl: result.spreadsheetUrl,
          scriptId: result.scriptId,
          folderId: result.folderId,
          folderUrl: result.folderUrl,
        };
      } catch (error: any) {
        console.error('Error creating business card spreadsheet:', error);
        return {
          success: false,
          error: error.message || 'Unknown error occurred',
        };
      }
    });

    ipcMain.handle('business-card:create-folder', async (_, folderName: string, parentFolderId?: string) => {
      try {
        const result = await this.createDriveFolder(folderName, parentFolderId);
        return {
          success: true,
          folderId: result.folderId,
          folderUrl: result.folderUrl,
        };
      } catch (error: any) {
        console.error('Error creating Drive folder:', error);
        return {
          success: false,
          error: error.message || 'Unknown error occurred',
        };
      }
    });

    ipcMain.handle('business-card:create-table', async (_, spreadsheetId: string, sheetId: number, tableName: string, startRowIndex: number, endRowIndex: number, startColumnIndex: number, endColumnIndex: number, columnProperties?: any[]) => {
      try {
        const result = await this.createTable(
          spreadsheetId,
          sheetId,
          tableName,
          startRowIndex,
          endRowIndex,
          startColumnIndex,
          endColumnIndex,
          columnProperties
        );
        return {
          success: true,
          tableId: result.tableId,
        };
      } catch (error: any) {
        console.error('Error creating table:', error);
        return {
          success: false,
          error: error.message || 'Unknown error occurred',
        };
      }
    });

    ipcMain.handle('business-card:create-trigger', async (_, scriptId: string, intervalMinutes: number = 5) => {
      try {
        const auth = await this.initializeOAuthClient();
        const script = google.script({ version: 'v1', auth });

        const response = await script.scripts.run({
          scriptId: scriptId,
          requestBody: {
            function: 'createProcessNewFilesTrigger',
            parameters: [intervalMinutes],
          },
        });

        if (response.data.error) {
          return {
            success: false,
            error: response.data.error.details?.[0]?.errorMessage || 'Failed to create trigger',
          };
        }

        return {
          success: true,
          triggerId: response.data.response?.result?.triggerId,
          interval: response.data.response?.result?.interval,
        };
      } catch (error: any) {
        console.error('Error creating trigger:', error);
        return {
          success: false,
          error: error.message || 'Unknown error occurred',
        };
      }
    });

    ipcMain.handle('business-card:delete-trigger', async (_, scriptId: string) => {
      try {
        const auth = await this.initializeOAuthClient();
        const script = google.script({ version: 'v1', auth });

        const response = await script.scripts.run({
          scriptId: scriptId,
          requestBody: {
            function: 'deleteProcessNewFilesTrigger',
            parameters: [],
          },
        });

        if (response.data.error) {
          return {
            success: false,
            error: response.data.error.details?.[0]?.errorMessage || 'Failed to delete trigger',
          };
        }

        return {
          success: true,
          deletedCount: response.data.response?.result?.deletedCount || 0,
        };
      } catch (error: any) {
        console.error('Error deleting trigger:', error);
        return {
          success: false,
          error: error.message || 'Unknown error occurred',
        };
      }
    });

    ipcMain.handle('business-card:authorize-script', async (_, spreadsheetUrl: string, scriptId?: string, chromeProfilePath?: string) => {
      try {
        const result = await authorizeScriptWithPlaywright(spreadsheetUrl, scriptId, chromeProfilePath);
        return result;
      } catch (error: any) {
        console.error('Error authorizing script with Playwright:', error);
        return {
          success: false,
          authorized: false,
          error: error.message || 'Unknown error occurred',
        };
      }
    });

    ipcMain.handle('business-card:list-chrome-profiles', async () => {
      try {
        const profiles = listChromeProfilesWithEmail();
        return {
          success: true,
          profiles,
        };
      } catch (error: any) {
        console.error('Error listing Chrome profiles:', error);
        return {
          success: false,
          profiles: [],
          error: error.message || 'Unknown error occurred',
        };
      }
    });

    ipcMain.handle('business-card:test-open-chrome', async (_, chromeProfilePath?: string) => {
      try {
        const result = await testOpenChromeWithProfile(chromeProfilePath);
        return result;
      } catch (error: any) {
        console.error('Error testing Chrome profile:', error);
        return {
          success: false,
          error: error.message || 'Unknown error occurred',
        };
      }
    });

    ipcMain.handle('business-card:launch-egdesk-chrome-login', async () => {
      try {
        const result = await launchEGDeskChromeForLogin();
        return result;
      } catch (error: any) {
        console.error('Error launching EGDesk Chrome for login:', error);
        return {
          success: false,
          error: error.message || 'Unknown error occurred',
        };
      }
    });

    console.log('✅ Business Card Service IPC handlers registered');
  }
}

// Export singleton instance
export const businessCardService = new BusinessCardService();

