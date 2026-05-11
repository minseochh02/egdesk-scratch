/**
 * IPC handlers for PageIndex — vectorless RAG over indexed PDFs.
 * These let the renderer call PageIndex operations directly without
 * needing the MCP HTTP server to be running.
 */

import { ipcMain, dialog, BrowserWindow } from 'electron';
import { getPageIndexService } from './pageindex/pageindex-service';

export function registerPageIndexHandlers(): void {
  // Pick a PDF file via native dialog
  ipcMain.handle('pageindex:pick-file', async () => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    const result = win
      ? await dialog.showOpenDialog(win, {
          title: 'Select PDF to Index',
          filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
          properties: ['openFile'],
        })
      : await dialog.showOpenDialog({
          title: 'Select PDF to Index',
          filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
          properties: ['openFile'],
        });

    return { canceled: result.canceled, filePath: result.filePaths[0] ?? null };
  });

  // Index a PDF document
  ipcMain.handle('pageindex:index-document', async (_event, { filePath, title, description }: {
    filePath: string;
    title?: string;
    description?: string;
  }) => {
    const service = getPageIndexService();
    const docId = await service.indexDocument(filePath, title, description);
    return { success: true, doc_id: docId };
  });

  // List all indexed documents
  ipcMain.handle('pageindex:list-documents', async () => {
    const service = getPageIndexService();
    return service.listDocuments();
  });

  // Get structure (tree) of a document
  ipcMain.handle('pageindex:get-structure', async (_event, { docId }: { docId: string }) => {
    const service = getPageIndexService();
    return JSON.parse(service.getDocumentStructure(docId));
  });

  // Get raw page content
  ipcMain.handle('pageindex:get-pages', async (_event, { docId, pages }: { docId: string; pages: string }) => {
    const service = getPageIndexService();
    return JSON.parse(service.getPageContent(docId, pages));
  });

  // Delete a document
  ipcMain.handle('pageindex:delete-document', async (_event, { docId }: { docId: string }) => {
    const service = getPageIndexService();
    const deleted = service.deleteDocument(docId);
    return { success: deleted };
  });

  console.log('✅ PageIndex IPC handlers registered');
}
