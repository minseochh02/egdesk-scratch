import React from 'react';
import { UserTable } from '../../hooks/useUserData';
import { ExcelDataWizard } from './wizards/ExcelDataWizard';

interface ExcelUploadDialogProps {
  table: UserTable;
  onClose: () => void;
  onComplete: () => void;
}

/**
 * ExcelUploadDialog - Thin wrapper around ExcelDataWizard in upload mode
 * Preserves existing API for zero breaking changes
 */
export const ExcelUploadDialog: React.FC<ExcelUploadDialogProps> = ({ table, onClose, onComplete }) => {
  return <ExcelDataWizard mode="upload" targetTable={table} onClose={onClose} onComplete={onComplete} />;
};
