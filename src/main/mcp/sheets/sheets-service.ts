import { getAuthService } from '../../auth/auth-service';

export interface SheetInfo {
  sheetId: number;
  title: string;
  index: number;
  rowCount: number;
  columnCount: number;
}

export interface SpreadsheetMetadata {
  spreadsheetId: string;
  title: string;
  spreadsheetUrl: string;
  sheets: SheetInfo[];
}

export interface RangeData {
  range: string;
  values: string[][];
  headers?: string[];
}

/**
 * Google Sheets Service
 * 
 * Provides access to Google Sheets API for reading spreadsheet data.
 * Uses OAuth tokens from AuthService.
 */
export class SheetsService {
  private baseUrl = 'https://sheets.googleapis.com/v4/spreadsheets';

  /**
   * Get OAuth access token from AuthService
   */
  private async getAccessToken(): Promise<string> {
    const authService = getAuthService();
    const token = await authService.getGoogleWorkspaceToken();
    
    if (!token?.access_token) {
      throw new Error('No Google OAuth token available. Please sign in with Google.');
    }
    
    return token.access_token;
  }

  /**
   * Make authenticated request to Google Sheets API
   */
  private async fetchSheets<T>(endpoint: string): Promise<T> {
    const accessToken = await this.getAccessToken();
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Sheets API error: ${response.status} ${response.statusText}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorMessage;
      } catch {
        // Use default error message
      }
      
      throw new Error(errorMessage);
    }

    return response.json();
  }

  /**
   * Get spreadsheet metadata (title, sheets list, dimensions)
   */
  async getSpreadsheet(spreadsheetId: string): Promise<SpreadsheetMetadata> {
    // Include gridProperties to get row/column counts
    const endpoint = `/${spreadsheetId}?fields=spreadsheetId,properties.title,spreadsheetUrl,sheets.properties`;
    
    const data = await this.fetchSheets<any>(endpoint);
    
    return {
      spreadsheetId: data.spreadsheetId,
      title: data.properties?.title || 'Untitled Spreadsheet',
      spreadsheetUrl: data.spreadsheetUrl,
      sheets: (data.sheets || []).map((sheet: any) => ({
        sheetId: sheet.properties?.sheetId || 0,
        title: sheet.properties?.title || 'Sheet',
        index: sheet.properties?.index || 0,
        rowCount: sheet.properties?.gridProperties?.rowCount || 0,
        columnCount: sheet.properties?.gridProperties?.columnCount || 0,
      })),
    };
  }

  /**
   * Get values from a range
   * @param spreadsheetId The spreadsheet ID
   * @param range A1 notation range (e.g., "Sheet1!A1:D10" or just "Sheet1" for entire sheet)
   */
  async getRange(spreadsheetId: string, range: string): Promise<RangeData> {
    // URL encode the range
    const encodedRange = encodeURIComponent(range);
    const endpoint = `/${spreadsheetId}/values/${encodedRange}`;
    
    const data = await this.fetchSheets<any>(endpoint);
    
    const values = data.values || [];
    
    return {
      range: data.range || range,
      values: values,
      headers: values.length > 0 ? values[0] : undefined,
    };
  }

  /**
   * Get headers (first row) of a sheet
   */
  async getHeaders(spreadsheetId: string, sheetName: string = 'Sheet1'): Promise<string[]> {
    const range = `${sheetName}!1:1`;
    const data = await this.getRange(spreadsheetId, range);
    return data.headers || [];
  }

  /**
   * Get sample data (first N rows including headers)
   */
  async getSampleData(
    spreadsheetId: string, 
    sheetName: string = 'Sheet1', 
    rows: number = 5
  ): Promise<RangeData> {
    const range = `${sheetName}!1:${rows}`;
    return this.getRange(spreadsheetId, range);
  }

  /**
   * Get full context for AI: spreadsheet metadata + headers + sample data for each sheet
   */
  async getFullContext(spreadsheetId: string, sampleRows: number = 5): Promise<{
    metadata: SpreadsheetMetadata;
    sheetsData: Array<{
      sheetTitle: string;
      headers: string[];
      sampleData: string[][];
      rowCount: number;
      columnCount: number;
    }>;
  }> {
    // Get spreadsheet metadata
    const metadata = await this.getSpreadsheet(spreadsheetId);
    
    // Get sample data for each sheet
    const sheetsData = await Promise.all(
      metadata.sheets.map(async (sheet) => {
        try {
          const sampleData = await this.getSampleData(spreadsheetId, sheet.title, sampleRows);
          return {
            sheetTitle: sheet.title,
            headers: sampleData.headers || [],
            sampleData: sampleData.values.slice(1), // Exclude header row
            rowCount: sheet.rowCount,
            columnCount: sheet.columnCount,
          };
        } catch (error) {
          // If sheet is empty or inaccessible, return empty data
          console.warn(`Failed to get sample data for sheet "${sheet.title}":`, error);
          return {
            sheetTitle: sheet.title,
            headers: [],
            sampleData: [],
            rowCount: sheet.rowCount,
            columnCount: sheet.columnCount,
          };
        }
      })
    );
    
    return {
      metadata,
      sheetsData,
    };
  }
}

