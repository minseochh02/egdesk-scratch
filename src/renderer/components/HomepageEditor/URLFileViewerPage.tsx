import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { URLFileViewer } from './URLFileViewer';

const URLFileViewerPage: React.FC = () => {
  const location = useLocation();
  const { filesToOpen } = useMemo(() => {
    try {
      // With HashRouter, query params are available via react-router's location.search
      const params = new URLSearchParams(location.search || '');
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
  }, [location.search]);

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      <URLFileViewer filesToOpen={filesToOpen} instanceId="url-viewer-page" />
    </div>
  );
};

export default URLFileViewerPage;


