// Global type declarations for Electron API

declare global {
  interface Window {
    electronAPI: {
      openHTMLReport: (htmlContent: string, websiteUrl: string) => void;
      // Add other Electron API methods here as needed
    };
  }
}

export {};
