import React, { useMemo } from 'react';
import { URLFileViewer } from './URLFileViewer';

const URLFileViewerPage: React.FC = () => {
  const { filesToOpen } = useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const viewer = params.get('viewer');
      const filesParam = params.get('files');
      if (viewer === 'url' && filesParam) {
        const decoded = decodeURIComponent(filesParam);
        const files = decoded.split('|').filter(Boolean);
        return { filesToOpen: files };
      }
    } catch (e) {
      // ignore
    }
    return { filesToOpen: [] as string[] };
  }, []);

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      <URLFileViewer filesToOpen={filesToOpen} instanceId="url-viewer-page" />
    </div>
  );
};

export default URLFileViewerPage;


