import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faGlobe,
  faTimes,
  faQuestion,
  faRefresh,
  faCode,
  faDownload,
  faCheckCircle,
  faExclamationTriangle,
  faEdit,
  faDesktop,
  faInfoCircle,
  faFolder,
  faTarget,
  faChartBar,
  faFileAlt,
  faTimesCircle,
} from '../utils/fontAwesomeIcons';
import ProjectSelector from './ProjectSelector';
import ProjectContextService, {
  ProjectInfo,
} from '../services/projectContextService';
import './LocalServer.css';

interface ServerStatus {
  isRunning: boolean;
  port: number;
  url: string;
  pid?: number;
  error?: string;
}

interface StartServerResult {
  success: boolean;
  port?: number;
  phpInfo?: PHPInfo;
  error?: string;
}

interface PHPInfo {
  version: string;
  path: string;
  isBundled: boolean;
  isAvailable: boolean;
  error?: string;
}

interface FolderInfo {
  path: string;
  exists: boolean;
  hasWordPress: boolean;
  hasIndexPhp: boolean;
  hasWpContent: boolean;
  hasHtmlFiles: boolean;
  htmlFileCount: number;
  phpFileCount: number;
  folderType: 'www' | 'wordpress' | 'mixed' | 'unknown';
  detectedRoot?: string;
  availableFiles?: string[];
}

interface LocalServerProps {
  onStatusChange?: (status: ServerStatus) => void;
}

const LocalServer: React.FC<LocalServerProps> = ({ onStatusChange }) => {
  const navigate = useNavigate();
  const [serverStatus, setServerStatus] = useState<ServerStatus>({
    isRunning: false,
    port: 8000,
    url: 'http://localhost:8000',
  });

  const [currentFolder, setCurrentFolder] = useState<string>('');
  const [folderInfo, setFolderInfo] = useState<FolderInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [currentProject, setCurrentProject] = useState<ProjectInfo | null>(
    null,
  );
  const [phpInfo, setPhpInfo] = useState<PHPInfo | null>(null);
  const [phpDownloadProgress, setPhpDownloadProgress] = useState<{
    percent: number;
    transferred: number;
    total: number;
    bytesPerSecond: number;
  } | null>(null);
  const [isDownloadingPHP, setIsDownloadingPHP] = useState(false);
  const [phpDownloadError, setPhpDownloadError] = useState<string | null>(null);

  // Subscribe to project context changes
  useEffect(() => {
    const unsubscribe = ProjectContextService.getInstance().subscribe(
      (context) => {
        setCurrentProject(context.currentProject);

        // If current project changes and we have folder info, update the folder
        if (
          context.currentProject &&
          context.currentProject.path !== currentFolder
        ) {
          setCurrentFolder(context.currentProject.path);
          analyzeFolder(context.currentProject.path);
        }
      },
    );

    return unsubscribe;
  }, [currentFolder]);

  // Check if server is running on component mount
  useEffect(() => {
    checkServerStatus();
    loadPHPInfo();
    // Check every 5 seconds
    const interval = setInterval(checkServerStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // Listen for PHP download events
  useEffect(() => {
    const unsubscribeProgress = window.electron.phpInstaller.onDownloadProgress(
      (progress) => {
        setPhpDownloadProgress(progress);
      }
    );

    const unsubscribeComplete = window.electron.phpInstaller.onDownloadComplete(
      (result) => {
        setIsDownloadingPHP(false);
        setPhpDownloadProgress(null);
        if (result.success) {
          addLog('✅ PHP downloaded successfully');
          loadPHPInfo(); // Reload PHP info to detect downloaded PHP
        } else {
          addLog('❌ PHP download failed');
        }
      }
    );

    const unsubscribeError = window.electron.phpInstaller.onDownloadError(
      (error) => {
        setIsDownloadingPHP(false);
        setPhpDownloadProgress(null);
        setPhpDownloadError(error.error);
        addLog(`❌ PHP download error: ${error.error}`);
      }
    );

    return () => {
      unsubscribeProgress();
      unsubscribeComplete();
      unsubscribeError();
    };
  }, []);

  // Emit status to parent when it changes
  useEffect(() => {
    if (onStatusChange) {
      onStatusChange(serverStatus);
    }
  }, [serverStatus, onStatusChange]);

  const checkServerStatus = async () => {
    try {
      const result = await window.electron.wordpressServer.getServerStatus();
      if (result.success && result.status) {
        setServerStatus(result.status);
      }
    } catch (error) {
      console.error('Error checking server status:', error);
    }
  };

  const loadPHPInfo = async () => {
    try {
      const result = await window.electron.wordpressServer.getPHPInfo();
      if (result.success && result.phpInfo) {
        setPhpInfo(result.phpInfo);
        addLog(
          `🐘 PHP ${result.phpInfo.isBundled ? '(bundled)' : '(system)'}: ${result.phpInfo.version}`,
        );
      }
    } catch (error) {
      console.error('Error loading PHP info:', error);
      addLog(`❌ Error loading PHP info: ${error}`);
    }
  };

  const handleDownloadPHP = async () => {
    if (isDownloadingPHP) {
      return;
    }

    setIsDownloadingPHP(true);
    setPhpDownloadError(null);
    setPhpDownloadProgress(null);
    addLog('⬇️ Starting PHP download...');

    try {
      const result = await window.electron.phpInstaller.download();
      if (!result.success) {
        setIsDownloadingPHP(false);
        setPhpDownloadError(result.error || 'Download failed');
        addLog(`❌ PHP download failed: ${result.error}`);
      }
    } catch (error) {
      setIsDownloadingPHP(false);
      setPhpDownloadError(error instanceof Error ? error.message : 'Unknown error');
      addLog(`❌ PHP download error: ${error}`);
    }
  };

  const handleCancelDownload = async () => {
    try {
      await window.electron.phpInstaller.cancelDownload();
      setIsDownloadingPHP(false);
      setPhpDownloadProgress(null);
      addLog('🚫 PHP download cancelled');
    } catch (error) {
      console.error('Error cancelling download:', error);
    }
  };

  const analyzeFolder = async (folderPath: string) => {
    try {
      const result =
        await window.electron.wordpressServer.analyzeFolder(folderPath);
      if (result.success && result.info) {
        setFolderInfo(result.info);
        setCurrentFolder(folderPath);

        if (result.info.hasWordPress) {
          addLog(`✅ Server-compatible folder detected: ${folderPath}`);
          addLog(`📁 Folder type: ${result.info.folderType}`);
          if (
            result.info.detectedRoot &&
            result.info.detectedRoot !== folderPath
          ) {
            addLog(`🎯 Will serve from: ${result.info.detectedRoot}`);
          }
          if (result.info.htmlFileCount > 0) {
            addLog(`HTML files: ${result.info.htmlFileCount}`);
          }
          if (result.info.phpFileCount > 0) {
            addLog(`🐘 PHP files: ${result.info.phpFileCount}`);
          }
        } else {
          addLog(
            `⚠️  Folder structure not recognized, but server can still try to serve it: ${folderPath}`,
          );
        }
      } else {
        addLog(`Error analyzing folder: ${result.error}`);
      }
    } catch (error) {
      addLog(`Error analyzing folder: ${error}`);
    }
  };

  const selectFolder = async () => {
    try {
      const result = await window.electron.wordpressServer.pickFolder();
      if (result.success && result.folderPath) {
        // Set as current project
        await ProjectContextService.getInstance().setCurrentProject(
          result.folderPath,
        );
        await analyzeFolder(result.folderPath);
      } else {
        addLog(`No folder selected: ${result.error}`);
      }
    } catch (error) {
      addLog(`Error selecting folder: ${error}`);
    }
  };

  const startServer = async () => {
    if (!folderInfo) {
      addLog('Please select a folder first');
      return;
    }

    // Allow any folder that exists - the server can handle various structures
    if (!folderInfo.exists) {
      addLog('Selected folder does not exist');
      return;
    }

    setIsLoading(true);
    addLog('🚀 Starting WordPress server...');

    try {
      const result: StartServerResult =
        await window.electron.wordpressServer.startServer(
          currentFolder,
          serverStatus.port,
        );
      if (result.success) {
        addLog(`✅ Server started successfully on port ${result.port}`);
        addLog(`📁 Serving from: ${currentFolder}`);

        // Update PHP info if provided
        if (result.phpInfo) {
          setPhpInfo(result.phpInfo);
          addLog(
            `🐘 Using PHP: ${result.phpInfo.version} (${result.phpInfo.isBundled ? 'bundled' : 'system'})`,
          );
        }

        // Update server status
        setServerStatus((prev) => ({
          ...prev,
          isRunning: true,
          port: result.port || prev.port,
          url: `http://localhost:${result.port || prev.port}`,
          error: undefined,
        }));
      } else {
        const errorMsg = `Failed to start server: ${result.error}`;
        addLog(errorMsg);
        setServerStatus((prev) => ({ ...prev, error: errorMsg }));
      }
    } catch (error) {
      const errorMsg = `Failed to start server: ${error}`;
      addLog(errorMsg);
      setServerStatus((prev) => ({ ...prev, error: errorMsg }));
    } finally {
      setIsLoading(false);
    }
  };

  const stopServer = async () => {
    setIsLoading(true);
    addLog('🛑 Stopping WordPress server...');

    try {
      const result = await window.electron.wordpressServer.stopServer();
      if (result.success) {
        addLog('✅ Server stopped successfully');
        setServerStatus((prev) => ({
          ...prev,
          isRunning: false,
        }));
      } else {
        addLog(`Error stopping server: ${result.error}`);
      }
    } catch (error) {
      addLog(`Error stopping server: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const openInBrowser = () => {
    if (serverStatus.isRunning) {
      window.open(serverStatus.url, '_blank');
    }
  };

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev.slice(-49), `[${timestamp}] ${message}`]);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const handleProjectSelect = (project: ProjectInfo) => {
    setCurrentFolder(project.path);
    analyzeFolder(project.path);
    addLog(`📁 Switched to project: ${project.name} (${project.path})`);
  };

  return (
    <div className="local-server">
      <div className="server-header">
        <h2>
          <FontAwesomeIcon icon={faDesktop} className="section-icon" /> 로컬 서버
        </h2>
        <p>개발을 위한 로컬 PHP 서버를 관리하세요</p>
      </div>

      {/* Project Context Section */}
      <div className="project-context-section">
        <h3>
          <FontAwesomeIcon icon={faFolder} className="section-icon" /> 프로젝트 컨텍스트
        </h3>
        <div className="project-context-content">
          <ProjectSelector
            onProjectSelect={handleProjectSelect}
            showCurrentProject
            showRecentProjects
            showAvailableProjects={false}
            className="server-project-selector"
          />

          {currentProject && (
            <div className="project-details">
              <div className="project-metadata">
                <div className="metadata-item">
                  <strong>타입:</strong> {currentProject.type}
                </div>
                <div className="metadata-item">
                  <strong>언어:</strong> {currentProject.metadata.language}
                </div>
                <div className="metadata-item">
                  <strong>프레임워크:</strong>{' '}
                  {currentProject.metadata.framework}
                </div>
                {currentProject.metadata.version && (
                  <div className="metadata-item">
                    <strong>버전:</strong> {currentProject.metadata.version}
                  </div>
                )}
                <div className="metadata-item">
                  <strong>마지막 접근:</strong>{' '}
                  {currentProject.lastAccessed.toLocaleDateString()}
                </div>
              </div>

              <div className="project-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() =>
                    ProjectContextService.getInstance().updateProjectMetadata(
                      currentProject.id,
                    )
                  }
                >
                  <FontAwesomeIcon icon={faRefresh} /> Refresh Metadata
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() =>
                    ProjectContextService.getInstance().refreshAllProjects()
                  }
                >
                  <FontAwesomeIcon icon={faRefresh} /> 모든 프로젝트 새로고침
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="server-controls">
        <div className="folder-section">
          <h3>
            <FontAwesomeIcon icon={faFolder} className="section-icon" /> 폴더
          </h3>
          <div className="folder-input">
            <input
              type="text"
              value={currentFolder}
              onChange={(e) => setCurrentFolder(e.target.value)}
              placeholder="폴더 경로를 입력하거나 폴더 선택을 클릭하세요"
              disabled={isLoading}
            />
            <button
              onClick={selectFolder}
              disabled={isLoading}
              className="btn btn-secondary"
            >
              폴더 선택
            </button>
          </div>

          {folderInfo && (
            <div className="folder-info">
              <div
                className={`status-indicator ${folderInfo.hasWordPress ? 'success' : 'warning'}`}
              >
                <FontAwesomeIcon 
                  icon={folderInfo.hasWordPress ? faCheckCircle : faExclamationTriangle} 
                  className="compatibility-icon" 
                /> 서버 호환
              </div>
              <div
                className={`status-indicator ${folderInfo.folderType === 'www' ? 'success' : folderInfo.folderType === 'wordpress' ? 'success' : folderInfo.folderType === 'mixed' ? 'success' : 'warning'}`}
              >
                {folderInfo.folderType === 'www' ? (
                  <FontAwesomeIcon icon={faGlobe} />
                ) : folderInfo.folderType === 'wordpress' ? (
                  <FontAwesomeIcon icon={faCode} />
                ) : folderInfo.folderType === 'mixed' ? (
                  <FontAwesomeIcon icon={faRefresh} />
                ) : (
                  <FontAwesomeIcon icon={faQuestion} />
                )}{' '}
                {folderInfo.folderType}
              </div>
              {folderInfo.htmlFileCount > 0 && (
                <div className="status-indicator success">
                  <FontAwesomeIcon icon={faGlobe} /> {folderInfo.htmlFileCount}{' '}
                  HTML 파일
                </div>
              )}
              {folderInfo.phpFileCount > 0 && (
                <div className="status-indicator success">
                  <FontAwesomeIcon icon={faCode} /> {folderInfo.phpFileCount}{' '}
                  PHP 파일
                </div>
              )}
              {folderInfo.folderType === 'wordpress' ||
              folderInfo.folderType === 'mixed' ? (
                <>
                  <div
                    className={`status-indicator ${folderInfo.hasIndexPhp ? 'success' : 'error'}`}
                  >
                    <FontAwesomeIcon 
                      icon={folderInfo.hasIndexPhp ? faCheckCircle : faTimesCircle} 
                      className="compatibility-icon" 
                    /> index.php
                  </div>
                  <div
                    className={`status-indicator ${folderInfo.hasWpContent ? 'success' : 'error'}`}
                  >
                    <FontAwesomeIcon 
                      icon={folderInfo.hasWpContent ? faCheckCircle : faTimesCircle} 
                      className="compatibility-icon" 
                    /> wp-content
                  </div>
                </>
              ) : (
                  <div className="status-indicator success">
                  <FontAwesomeIcon icon={faCheckCircle} className="compatibility-icon" /> 파일 제공 준비 완료
                </div>
              )}
              {folderInfo.detectedRoot &&
                folderInfo.detectedRoot !== currentFolder && (
                  <div className="status-indicator success">
                    <FontAwesomeIcon icon={faTarget} className="target-icon" /> 제공할 경로: {folderInfo.detectedRoot}
                  </div>
                )}
            </div>
          )}
        </div>

        <div className="server-section">
          <h3>🚀 서버 제어</h3>
          <div className="server-buttons">
            {!serverStatus.isRunning ? (
              <button
                onClick={startServer}
                disabled={isLoading || !folderInfo?.exists}
                className="btn btn-primary"
              >
                {isLoading ? '시작 중...' : '서버 시작'}
              </button>
            ) : (
              <button
                onClick={stopServer}
                disabled={isLoading}
                className="btn btn-danger"
              >
                {isLoading ? '중지 중...' : '서버 중지'}
              </button>
            )}

            {serverStatus.isRunning && (
              <button onClick={openInBrowser} className="btn btn-success">
                브라우저에서 열기
              </button>
            )}

          </div>
        </div>

        <div className="server-status">
          <h3>
            <FontAwesomeIcon icon={faChartBar} className="section-icon" /> 서버 상태
          </h3>
          <div
            className={`status ${serverStatus.isRunning ? 'running' : 'stopped'}`}
          >
            <span className="status-dot" />
            {serverStatus.isRunning ? '실행 중' : '중지됨'}
          </div>

          {serverStatus.isRunning && (
            <div className="status-details">
              <p>
                <strong>포트:</strong> {serverStatus.port}
              </p>
              <p>
                <strong>URL:</strong>{' '}
                <a
                  href={serverStatus.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {serverStatus.url}
                </a>
              </p>
              <p>
                <strong>폴더:</strong> {currentFolder}
              </p>
              {currentProject && (
                <p>
                  <strong>프로젝트:</strong> {currentProject.name} (
                  {currentProject.type})
                </p>
              )}
            </div>
          )}

          {serverStatus.error && (
            <div className="error-message">
              <strong>오류:</strong> {serverStatus.error}
            </div>
          )}
        </div>
      </div>

      <div className="logs-section">
        <div className="logs-header">
          <h3>
            <FontAwesomeIcon icon={faFileAlt} className="section-icon" /> 서버 로그
          </h3>
          <button onClick={clearLogs} className="btn btn-small">
            로그 지우기
          </button>
        </div>
        <div className="logs-container">
          {logs.length === 0 ? (
            <p className="no-logs">
              아직 로그가 없습니다. 서버를 시작하여 활동을 확인하세요.
            </p>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="log-entry">
                {log}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="server-info">
        <h3>
          <FontAwesomeIcon icon={faInfoCircle} className="section-icon" /> 서버 정보
        </h3>
        <div className="info-grid">
          <div className="info-item">
            <strong>PHP 버전:</strong> {phpInfo?.version || '로딩 중...'}
          </div>
          <div className="info-item">
            <strong>PHP 소스:</strong>
            {phpInfo?.isBundled ? (
              <span className="php-bundled">
                <FontAwesomeIcon icon={faDownload} /> 번들됨
              </span>
            ) : phpInfo?.isAvailable ? (
              <span className="php-system">
                <FontAwesomeIcon icon={faCheckCircle} /> 시스템
              </span>
            ) : (
              <span className="php-error">
                <FontAwesomeIcon icon={faExclamationTriangle} /> 사용 불가
              </span>
            )}
          </div>
          <div className="info-item">
            <strong>PHP 경로:</strong> {phpInfo?.path || '찾을 수 없음'}
          </div>
          {!phpInfo?.isAvailable && (
            <div className="info-item" style={{ gridColumn: '1 / -1' }}>
              <div className="php-download-section">
                {!isDownloadingPHP ? (
                  <>
                    <div className="php-missing-notice">
                      <FontAwesomeIcon icon={faExclamationTriangle} />
                      <p>로컬 서버를 실행하려면 PHP가 필요합니다</p>
                    </div>
                    <button
                      onClick={handleDownloadPHP}
                      className="btn btn-primary"
                      style={{ marginTop: '10px' }}
                    >
                      <FontAwesomeIcon icon={faDownload} /> PHP 다운로드
                    </button>
                    {phpDownloadError && (
                      <div className="error-message" style={{ marginTop: '10px' }}>
                        <strong>오류:</strong> {phpDownloadError}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="php-download-progress">
                    <p>PHP 다운로드 중...</p>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${phpDownloadProgress?.percent || 0}%` }}
                      />
                    </div>
                    <p className="progress-text">
                      {phpDownloadProgress?.percent.toFixed(1)}%
                      {phpDownloadProgress && (
                        <>
                          {' '}
                          ({Math.round(phpDownloadProgress.transferred / 1024 / 1024)}MB
                          / {Math.round(phpDownloadProgress.total / 1024 / 1024)}MB)
                          {phpDownloadProgress.bytesPerSecond > 0 && (
                            <> - {Math.round(phpDownloadProgress.bytesPerSecond / 1024)}KB/s</>
                          )}
                        </>
                      )}
                    </p>
                    <button
                      onClick={handleCancelDownload}
                      className="btn btn-secondary"
                      style={{ marginTop: '10px' }}
                    >
                      취소
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="info-item">
            <strong>기본 포트:</strong> 8000
          </div>
          <div className="info-item">
            <strong>문서 루트:</strong> {currentFolder || '설정되지 않음'}
          </div>
          <div className="info-item">
            <strong>서버 타입:</strong> PHP 내장 서버
          </div>
          {folderInfo && (
            <>
              <div className="info-item">
                <strong>폴더 타입:</strong> {folderInfo.folderType}
              </div>
              {folderInfo.htmlFileCount > 0 && (
                <div className="info-item">
                  <strong>HTML 파일:</strong> {folderInfo.htmlFileCount}
                </div>
              )}
              {folderInfo.phpFileCount > 0 && (
                <div className="info-item">
                  <strong>PHP 파일:</strong> {folderInfo.phpFileCount}
                </div>
              )}
              {folderInfo.detectedRoot && (
                <div className="info-item">
                  <strong>감지된 루트:</strong> {folderInfo.detectedRoot}
                </div>
              )}
            </>
          )}
          {currentProject && (
            <>
              <div className="info-item">
                <strong>Current Project:</strong> {currentProject.name}
              </div>
              <div className="info-item">
                <strong>Project Type:</strong> {currentProject.type}
              </div>
              <div className="info-item">
                <strong>Project Language:</strong>{' '}
                {currentProject.metadata.language}
              </div>
              {currentProject.metadata.version && (
                <div className="info-item">
                  <strong>Project Version:</strong>{' '}
                  {currentProject.metadata.version}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LocalServer;
