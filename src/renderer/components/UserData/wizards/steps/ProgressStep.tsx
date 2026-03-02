import React from 'react';
import { BaseStepProps } from '../types';

/**
 * ProgressStep - Shows progress spinner during import/upload
 * 100% duplicate code elimination from ImportWizard and ExcelUploadDialog
 * Mode-aware messaging ("Importing" vs "Uploading")
 */
export const ProgressStep: React.FC<BaseStepProps> = ({ mode }) => {
  const action = mode === 'import' ? 'Importing' : 'Uploading';

  return (
    <div className="progress-section">
      <div className="progress-spinner"></div>
      <p className="progress-message">{action} data...</p>
      <p style={{ color: '#999', fontSize: '14px' }}>Please wait while we process your Excel file</p>
    </div>
  );
};
