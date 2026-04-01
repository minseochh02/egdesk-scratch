import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faDownload,
  faUpload,
  faDatabase,
  faExclamationTriangle,
  faCheckCircle,
  faSpinner,
  faTrash,
  faHistory,
} from '@fortawesome/free-solid-svg-icons';
import './DataManagementTab.css';

interface BackupInfo {
  id: string;
  filePath: string;
  createdAt: string;
  size: number;
  recordCount?: number;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
  meta?: {
    version: string;
    schemaVersion: string;
    exportedAt: string;
    exportedBy: string;
    includesCredentials: boolean;
    tableCount: number;
    totalRecords: number;
  };
}

export const DataManagementTab: React.FC = () => {
  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [includeCredentials, setIncludeCredentials] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  // Import state
  const [isImporting, setIsImporting] = useState(false);
  const [importFile, setImportFile] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Backup state
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);

  // Load backups on mount
  useEffect(() => {
    loadBackups();
  }, []);

  // ============================================
  // Backup Functions
  // ============================================

  const loadBackups = async () => {
    setLoadingBackups(true);
    try {
      const result = await window.electron.financeHubTransfer.listBackups();
      if (result.success && result.backups) {
        setBackups(result.backups);
      } else {
        console.error('Failed to load backups:', result.error);
      }
    } catch (error) {
      console.error('Failed to load backups:', error);
    } finally {
      setLoadingBackups(false);
    }
  };

  const handleCreateBackup = async () => {
    if (
      !window.confirm(
        '현재 데이터베이스의 백업을 생성하시겠습니까?'
      )
    ) {
      return;
    }

    setCreatingBackup(true);
    try {
      const result = await window.electron.financeHubTransfer.createBackup();
      if (result.success) {
        alert('✅ 백업이 생성되었습니다.');
        await loadBackups();
      } else {
        alert(`❌ 백업 생성 실패: ${result.error}`);
      }
    } catch (error: any) {
      alert(`❌ 백업 생성 중 오류 발생: ${error.message}`);
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleRestoreBackup = async (backupId: string) => {
    if (
      !window.confirm(
        '⚠️ 경고: 현재 데이터베이스가 선택한 백업으로 완전히 대체됩니다.\n' +
          '현재 데이터의 백업이 자동으로 생성됩니다.\n\n' +
          '계속하시겠습니까?'
      )
    ) {
      return;
    }

    try {
      const result = await window.electron.financeHubTransfer.restoreBackup(backupId);
      if (result.success) {
        alert(
          '✅ 백업 복원 완료!\n' +
            '변경사항을 적용하려면 앱을 재시작해주세요.'
        );
        // Optionally reload the page
        window.location.reload();
      } else {
        alert(`❌ 백업 복원 실패: ${result.error}`);
      }
    } catch (error: any) {
      alert(`❌ 백업 복원 중 오류 발생: ${error.message}`);
    }
  };

  const handleDeleteBackup = async (backupId: string) => {
    if (!window.confirm('이 백업을 삭제하시겠습니까?')) {
      return;
    }

    try {
      const result = await window.electron.financeHubTransfer.deleteBackup(backupId);
      if (result.success) {
        await loadBackups();
      } else {
        alert(`❌ 백업 삭제 실패: ${result.error}`);
      }
    } catch (error: any) {
      alert(`❌ 백업 삭제 중 오류 발생: ${error.message}`);
    }
  };

  // ============================================
  // Export Functions
  // ============================================

  const handleExport = async () => {
    if (includeCredentials) {
      if (
        !window.confirm(
          '⚠️ 보안 경고\n\n' +
            '자격 증명을 포함하면 은행 로그인 정보(아이디/비밀번호)가\n' +
            '내보내기 파일에 포함됩니다.\n\n' +
            '파일은 압축되지만, 악의적인 접근으로부터 완전히 보호되지 않습니다.\n' +
            '파일을 안전한 장소에 보관하고, 전송 시 암호화된 채널을 사용하세요.\n\n' +
            '계속하시겠습니까?'
        )
      ) {
        return;
      }
    }

    setIsExporting(true);
    setExportStatus('내보내는 중...');
    try {
      const result = await window.electron.financeHubTransfer.exportDatabase(
        includeCredentials
      );
      if (result.success) {
        setExportStatus(
          `✅ 내보내기 성공!\n` +
            `파일: ${result.filePath}\n` +
            `크기: ${formatBytes(result.size || 0)}\n` +
            `레코드 수: ${result.recordCount?.toLocaleString() || 0}`
        );
        setTimeout(() => setExportStatus(null), 5000);
      } else {
        setExportStatus(`❌ 내보내기 실패: ${result.error}`);
        setTimeout(() => setExportStatus(null), 5000);
      }
    } catch (error: any) {
      setExportStatus(`❌ 내보내기 중 오류 발생: ${error.message}`);
      setTimeout(() => setExportStatus(null), 5000);
    } finally {
      setIsExporting(false);
    }
  };

  // ============================================
  // Import Functions
  // ============================================

  const handleSelectImportFile = async () => {
    try {
      const result = await window.electron.financeHubTransfer.selectImportFile();
      if (!result.canceled && result.filePath) {
        setImportFile(result.filePath);
        setValidationResult(null);
        setImportStatus(null);

        // Automatically validate the selected file
        await handleValidateFile(result.filePath);
      }
    } catch (error: any) {
      alert(`❌ 파일 선택 중 오류 발생: ${error.message}`);
    }
  };

  const handleValidateFile = async (filePath: string) => {
    setIsValidating(true);
    try {
      const result = await window.electron.financeHubTransfer.validateImportFile(filePath);
      setValidationResult(result);

      if (!result.valid) {
        setImportStatus(`❌ 파일 검증 실패: ${result.error}`);
      } else {
        setImportStatus('✅ 파일 검증 완료. 가져오기를 진행할 수 있습니다.');
      }
    } catch (error: any) {
      setValidationResult({ valid: false, error: error.message });
      setImportStatus(`❌ 검증 중 오류 발생: ${error.message}`);
    } finally {
      setIsValidating(false);
    }
  };

  const handleImport = async () => {
    if (!validationResult || !validationResult.valid) {
      alert('먼저 파일을 선택하고 검증해주세요.');
      return;
    }

    if (!importFile) {
      alert('가져올 파일이 선택되지 않았습니다.');
      return;
    }

    const meta = validationResult.meta;
    if (!meta) {
      alert('파일 메타데이터를 읽을 수 없습니다.');
      return;
    }

    const message =
      `다음 데이터를 가져오시겠습니까?\n\n` +
      `테이블 수: ${meta.tableCount}\n` +
      `총 레코드: ${meta.totalRecords.toLocaleString()}\n` +
      `자격 증명 포함: ${meta.includesCredentials ? '예' : '아니오'}\n` +
      `내보낸 날짜: ${new Date(meta.exportedAt).toLocaleString()}\n` +
      `내보낸 버전: ${meta.exportedBy}\n\n` +
      `⚠️ 자동 백업이 생성됩니다.`;

    if (!window.confirm(message)) {
      return;
    }

    setIsImporting(true);
    setImportStatus('가져오는 중... (자동 백업 생성 중)');
    try {
      const result = await window.electron.financeHubTransfer.importDatabase(importFile);
      if (result.success) {
        setImportStatus(
          `✅ 가져오기 성공!\n` +
            `${result.recordsImported?.toLocaleString() || 0}개의 레코드를 가져왔습니다.\n` +
            `변경사항을 확인하려면 페이지를 새로고침하세요.`
        );

        // Ask user if they want to reload
        if (window.confirm('변경사항을 적용하기 위해 페이지를 새로고침하시겠습니까?')) {
          window.location.reload();
        }
      } else {
        setImportStatus(`❌ 가져오기 실패: ${result.error}`);
      }
    } catch (error: any) {
      setImportStatus(`❌ 가져오기 중 오류 발생: ${error.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  // ============================================
  // Helper Functions
  // ============================================

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // ============================================
  // Render
  // ============================================

  return (
    <div className="data-management-tab">
      <div className="data-management-header">
        <h2>데이터 관리</h2>
        <p className="data-management-description">
          FinanceHub 데이터베이스를 내보내거나 가져오고, 백업을 관리할 수 있습니다.
        </p>
      </div>

      <div className="data-management-content">
        {/* Export Section */}
        <section className="data-management-section">
          <h3>
            <FontAwesomeIcon icon={faDownload} /> 데이터베이스 내보내기
          </h3>
          <p className="section-description">
            현재 FinanceHub 데이터베이스를 파일로 내보냅니다.
          </p>

          <div className="export-controls">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={includeCredentials}
                onChange={(e) => setIncludeCredentials(e.target.checked)}
                disabled={isExporting}
              />
              <span>
                자격 증명 포함
                {includeCredentials && (
                  <FontAwesomeIcon
                    icon={faExclamationTriangle}
                    className="warning-icon"
                    title="보안 주의: 은행 로그인 정보가 포함됩니다"
                  />
                )}
              </span>
            </label>

            {includeCredentials && (
              <div className="warning-message">
                <FontAwesomeIcon icon={faExclamationTriangle} />
                <span>
                  <strong>보안 주의:</strong> 은행 로그인 정보(아이디/비밀번호)가 파일에 포함됩니다.
                  파일을 안전한 장소에 보관하고, 다른 사람과 공유하지 마세요.
                  가져오기 시 대상 컴퓨터의 암호화 키로 자동 재암호화됩니다.
                </span>
              </div>
            )}

            <button
              className="data-management-btn data-management-btn--primary"
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} spin /> 내보내는 중...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faDownload} /> 데이터베이스 내보내기
                </>
              )}
            </button>

            {exportStatus && (
              <div className={`status-message ${exportStatus.startsWith('✅') ? 'success' : 'error'}`}>
                <pre>{exportStatus}</pre>
              </div>
            )}
          </div>
        </section>

        {/* Import Section */}
        <section className="data-management-section">
          <h3>
            <FontAwesomeIcon icon={faUpload} /> 데이터베이스 가져오기
          </h3>
          <p className="section-description">
            이전에 내보낸 데이터베이스 파일을 가져옵니다. 자동으로 백업이 생성됩니다.
          </p>

          <div className="import-controls">
            <button
              className="data-management-btn data-management-btn--secondary"
              onClick={handleSelectImportFile}
              disabled={isImporting || isValidating}
            >
              <FontAwesomeIcon icon={faUpload} /> 가져오기 파일 선택
            </button>

            {importFile && (
              <div className="selected-file">
                <strong>선택된 파일:</strong> {importFile}
              </div>
            )}

            {isValidating && (
              <div className="status-message">
                <FontAwesomeIcon icon={faSpinner} spin /> 파일 검증 중...
              </div>
            )}

            {validationResult && validationResult.valid && validationResult.meta && (
              <div className="validation-results success">
                <h4>
                  <FontAwesomeIcon icon={faCheckCircle} /> 파일 검증 완료
                </h4>
                <div className="validation-details">
                  <div className="detail-row">
                    <span>테이블 수:</span>
                    <strong>{validationResult.meta.tableCount}</strong>
                  </div>
                  <div className="detail-row">
                    <span>총 레코드:</span>
                    <strong>{validationResult.meta.totalRecords.toLocaleString()}</strong>
                  </div>
                  <div className="detail-row">
                    <span>자격 증명:</span>
                    <strong>{validationResult.meta.includesCredentials ? '포함됨' : '제외됨'}</strong>
                  </div>
                  <div className="detail-row">
                    <span>내보낸 날짜:</span>
                    <strong>{formatDate(validationResult.meta.exportedAt)}</strong>
                  </div>
                  <div className="detail-row">
                    <span>내보낸 버전:</span>
                    <strong>{validationResult.meta.exportedBy}</strong>
                  </div>
                </div>
              </div>
            )}

            {validationResult && !validationResult.valid && (
              <div className="validation-results error">
                <h4>
                  <FontAwesomeIcon icon={faExclamationTriangle} /> 파일 검증 실패
                </h4>
                <p>{validationResult.error}</p>
              </div>
            )}

            {validationResult && validationResult.valid && (
              <button
                className="data-management-btn data-management-btn--primary"
                onClick={handleImport}
                disabled={isImporting}
              >
                {isImporting ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} spin /> 가져오는 중...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faUpload} /> 가져오기 실행
                  </>
                )}
              </button>
            )}

            {importStatus && (
              <div className={`status-message ${importStatus.startsWith('✅') ? 'success' : 'error'}`}>
                <pre>{importStatus}</pre>
              </div>
            )}
          </div>
        </section>

        {/* Backup Management Section */}
        <section className="data-management-section">
          <h3>
            <FontAwesomeIcon icon={faDatabase} /> 백업 관리
          </h3>
          <p className="section-description">
            데이터베이스 백업을 생성, 복원, 삭제할 수 있습니다.
          </p>

          <div className="backup-controls">
            <button
              className="data-management-btn data-management-btn--secondary"
              onClick={handleCreateBackup}
              disabled={creatingBackup}
            >
              {creatingBackup ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} spin /> 백업 생성 중...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faDatabase} /> 새 백업 만들기
                </>
              )}
            </button>

            <button
              className="data-management-btn data-management-btn--secondary"
              onClick={loadBackups}
              disabled={loadingBackups}
            >
              {loadingBackups ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} spin /> 로딩 중...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faHistory} /> 백업 목록 새로고침
                </>
              )}
            </button>
          </div>

          {loadingBackups ? (
            <div className="loading-message">
              <FontAwesomeIcon icon={faSpinner} spin /> 백업 목록을 불러오는 중...
            </div>
          ) : backups.length === 0 ? (
            <div className="empty-message">
              <p>생성된 백업이 없습니다.</p>
            </div>
          ) : (
            <div className="backup-list">
              <table className="backup-table">
                <thead>
                  <tr>
                    <th>생성 날짜</th>
                    <th>크기</th>
                    <th>레코드 수</th>
                    <th>작업</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map((backup) => (
                    <tr key={backup.id}>
                      <td>{formatDate(backup.createdAt)}</td>
                      <td>{formatBytes(backup.size)}</td>
                      <td>{backup.recordCount?.toLocaleString() || 'N/A'}</td>
                      <td>
                        <button
                          className="data-management-btn data-management-btn--small data-management-btn--primary"
                          onClick={() => handleRestoreBackup(backup.id)}
                          title="이 백업으로 복원"
                        >
                          <FontAwesomeIcon icon={faHistory} /> 복원
                        </button>
                        <button
                          className="data-management-btn data-management-btn--small data-management-btn--danger"
                          onClick={() => handleDeleteBackup(backup.id)}
                          title="백업 삭제"
                        >
                          <FontAwesomeIcon icon={faTrash} /> 삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="backup-note">
                💡 최근 5개의 백업만 자동으로 유지됩니다. 오래된 백업은 자동으로 삭제됩니다.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
