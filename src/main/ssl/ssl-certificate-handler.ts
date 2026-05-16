import { ipcMain } from 'electron';
import { SSLCertificateService } from './ssl-certificate-service';

export function registerSSLCertificateHandlers(): void {
  const service = SSLCertificateService.getInstance();

  ipcMain.handle('ssl-certificate-generate', async (_event, { domain, email }) => {
    try {
      const cert = await service.generateCertificate(domain, email);
      return { success: true, certificate: cert };
    } catch (error: any) {
      console.error('❌ Failed to generate SSL certificate:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('ssl-certificate-generate-force', async (_event, { domain, email }) => {
    try {
      // For now, same as generate, but could include logic to bypass cache
      const cert = await service.generateCertificate(domain, email);
      return { success: true, certificate: cert };
    } catch (error: any) {
      console.error('❌ Failed to force generate SSL certificate:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('ssl-certificate-generate-local', async (_event, { domain }) => {
    try {
      const cert = await service.generateTrustedLocal(domain || 'egdesk.local');
      return { success: true, certificate: cert };
    } catch (error: any) {
      console.error('❌ Failed to generate local trusted SSL certificate:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('ssl-certificate-list', async () => {
    try {
      const certs = service.listCertificates();
      return { success: true, certificates: certs };
    } catch (error: any) {
      console.error('❌ Failed to list SSL certificates:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('ssl-certificate-get', async (_event, id: string) => {
    try {
      const cert = service.getCertificate(id);
      return { success: true, certificate: cert };
    } catch (error: any) {
      console.error('❌ Failed to get SSL certificate:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('ssl-certificate-delete', async (_event, id: string) => {
    try {
      service.deleteCertificate(id);
      return { success: true };
    } catch (error: any) {
      console.error('❌ Failed to delete SSL certificate:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('ssl-certificate-cleanup', async () => {
    try {
      // Implement cleanup logic if needed (e.g. remove expired certs)
      return { success: true };
    } catch (error: any) {
      console.error('❌ Failed to cleanup SSL certificates:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('ssl-certificate-get-active-id', async () => {
    try {
      const id = service.getActiveCertificateId();
      return { success: true, id };
    } catch (error: any) {
      console.error('❌ Failed to get active SSL certificate ID:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('✅ SSL Certificate IPC handlers registered');
}
