import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import html2canvas from 'html2canvas';
import {
  faChessRook,
  faFileExcel,
  faFilePdf,
  faGlobe,
  faDesktop,
  faPlay,
  faClock,
} from '../../utils/fontAwesomeIcons';
import Analysis from './Analysis';
import './RookiePage.css';

interface RookWorkflow {
  id: string;
  name: string;
  goal: string;
  outputType: 'excel' | 'pdf' | 'both';
  outputFilePath?: string; // Path to actual output file
  workflow: string[];
  sites: { name: string; type: 'web' | 'app' }[];
  lastRun?: Date;
  status: 'active' | 'paused' | 'failed';
}

interface ExcelThumbnailProps {
  filePath: string;
  outputType: 'excel' | 'pdf' | 'both';
}

const ExcelThumbnail: React.FC<ExcelThumbnailProps> = ({
  filePath,
  outputType,
}) => {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const generateThumbnail = useCallback(async () => {
    try {
      setLoading(true);
      console.log('[ExcelThumbnail] Generating thumbnail for:', filePath);

      // Check if IPC is available
      if (!(window as any).electron?.invoke) {
        console.error('[ExcelThumbnail] electron.invoke not available');
        setLoading(false);
        return;
      }

      // Request Excel HTML from main process (processes ALL sheets)
      const result = await (window as any).electron.invoke(
        'rookie:generate-excel-thumbnail',
        { filePath },
      );
      console.log('[ExcelThumbnail] Excel processed:');
      console.log('  - Sheet:', result.sheetName);
      console.log('  - Total sheets:', result.allSheets?.length || 0);
      console.log('  - All sheets available for AI:', result.allSheets ? 'Yes' : 'No');

      if (!result.success) {
        console.error(
          '[ExcelThumbnail] Failed to generate thumbnail:',
          result.message,
        );
        setLoading(false);
        return;
      }

      // Create hidden div with Excel HTML
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.top = '-9999px';
      tempDiv.innerHTML = result.html;
      document.body.appendChild(tempDiv);

      // Wait for render
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Convert to canvas (full Excel sheet scaled down)
      const canvas = await html2canvas(tempDiv, {
        backgroundColor: 'white',
        scale: 1,
        useCORS: true,
        allowTaint: true,
        width: 1000, // Limit canvas width
        windowWidth: 1000,
      });

      // Convert to data URL (JPEG for smaller file size)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85); // 85% quality
      console.log(
        '[ExcelThumbnail] Thumbnail generated successfully, size:',
        Math.round(dataUrl.length / 1024),
        'KB',
      );
      setThumbnailUrl(dataUrl);

      // Cleanup
      document.body.removeChild(tempDiv);
      setLoading(false);
    } catch (error: any) {
      console.error('Error generating thumbnail:', error);
      setLoading(false);
    }
  }, [filePath]);

  useEffect(() => {
    generateThumbnail();
  }, [generateThumbnail]);

  const getIcon = () => {
    if (outputType === 'excel') return faFileExcel;
    if (outputType === 'pdf') return faFilePdf;
    return faFileExcel;
  };

  if (loading) {
    return (
      <div className="rookie-goal-thumbnail">
        <FontAwesomeIcon icon={getIcon()} className="rookie-goal-icon" />
        <div className="rookie-goal-label">Loading...</div>
      </div>
    );
  }

  if (thumbnailUrl) {
    return (
      <div className="rookie-goal-thumbnail" style={{ padding: '8px' }}>
        <img
          src={thumbnailUrl}
          alt="Excel Preview"
          style={{
            width: '100%',
            height: 'auto',
            borderRadius: '4px',
            display: 'block',
            border: '1px solid rgba(46, 125, 50, 0.3)',
          }}
        />
      </div>
    );
  }

  return (
    <div className="rookie-goal-thumbnail">
      <FontAwesomeIcon icon={getIcon()} className="rookie-goal-icon" />
      <div className="rookie-goal-label">
        {outputType === 'excel'
          ? 'Excel'
          : outputType === 'pdf'
            ? 'PDF'
            : 'Excel & PDF'}
      </div>
    </div>
  );
};

const RookiePage: React.FC = () => {
  // State for view management
  const [currentView, setCurrentView] = useState<'list' | 'analysis'>('list');

  // Rook workflows (empty for now - will be loaded from storage later)
  const rooks: RookWorkflow[] = [];

  const getOutputIcon = (type: string) => {
    if (type === 'excel') return faFileExcel;
    if (type === 'pdf') return faFilePdf;
    return faFileExcel;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#2E7D32';
      case 'paused':
        return '#FF9800';
      case 'failed':
        return '#F44336';
      default:
        return '#888';
    }
  };

  // Show Analysis page if in analysis view
  if (currentView === 'analysis') {
    return <Analysis onBack={() => setCurrentView('list')} />;
  }

  // Show list view
  return (
    <div className="rookie-page">
      <header className="rookie-header">
        <div className="rookie-header-content">
          <div className="rookie-logo">
            <FontAwesomeIcon icon={faChessRook} className="rookie-logo-icon" />
            <div className="rookie-logo-text">
              <h1>Rookie</h1>
              <span className="rookie-logo-subtitle">Automation Workflows</span>
            </div>
          </div>
        </div>

        <div className="rookie-header-stats">
          <div className="rookie-stat">
            <span className="rookie-stat-value">{rooks.length}</span>
            <span className="rookie-stat-label">Total Rooks</span>
          </div>
          <div className="rookie-stat">
            <span className="rookie-stat-value">
              {rooks.filter((r) => r.status === 'active').length}
            </span>
            <span className="rookie-stat-label">Active</span>
          </div>
          <div className="rookie-stat">
            <span className="rookie-stat-value">
              {rooks.filter((r) => r.status === 'paused').length}
            </span>
            <span className="rookie-stat-label">Paused</span>
          </div>
        </div>
      </header>

      <div className="rookie-content">
        {/* Create New Rook Button */}
        <div className="rookie-workflows-header">
          <h2>Your Rooks</h2>
          <button
            className="rookie-create-button"
            onClick={() => setCurrentView('analysis')}
          >
            <FontAwesomeIcon
              icon={faChessRook}
              style={{ marginRight: '8px' }}
            />
            Create New Rook
          </button>
        </div>

        {/* Rook Workflows */}
        <div className="rookie-workflows">
          {rooks.map((rook) => (
            <div key={rook.id} className="rookie-workflow-card">
              {/* Header */}
              <div className="rookie-workflow-header">
                <div className="rookie-workflow-title">
                  <FontAwesomeIcon
                    icon={faChessRook}
                    style={{ color: '#2E7D32', marginRight: '10px' }}
                  />
                  <h3>{rook.name}</h3>
                </div>
                <div
                  className="rookie-workflow-status"
                  style={{ backgroundColor: getStatusColor(rook.status) }}
                >
                  {rook.status.toUpperCase()}
                </div>
              </div>

              {/* 3-Column Layout */}
              <div className="rookie-workflow-body">
                {/* Left Column: Goal Thumbnail */}
                <div className="rookie-workflow-column rookie-goal-column">
                  {rook.outputFilePath ? (
                    <ExcelThumbnail
                      filePath={rook.outputFilePath}
                      outputType={rook.outputType}
                    />
                  ) : (
                    <div className="rookie-goal-thumbnail">
                      <FontAwesomeIcon
                        icon={getOutputIcon(rook.outputType)}
                        className="rookie-goal-icon"
                      />
                      <div className="rookie-goal-label">
                        {rook.outputType === 'excel'
                          ? 'Excel'
                          : rook.outputType === 'pdf'
                            ? 'PDF'
                            : 'Excel & PDF'}
                      </div>
                    </div>
                  )}
                  <p className="rookie-goal-text">{rook.goal}</p>
                </div>

                {/* Middle Column: Workflow Steps */}
                <div className="rookie-workflow-column rookie-steps-column">
                  <h4>Workflow</h4>
                  <div className="rookie-workflow-steps-list">
                    {rook.workflow.map((step, index) => (
                      <div key={index} className="rookie-step-item">
                        <div className="rookie-step-number">{index + 1}</div>
                        <div className="rookie-step-text">{step}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Column: Sites/Apps */}
                <div className="rookie-workflow-column rookie-sites-column">
                  <h4>Sites & Apps</h4>
                  <div className="rookie-sites-list">
                    {rook.sites.map((site, index) => (
                      <div key={index} className="rookie-site-item">
                        <FontAwesomeIcon
                          icon={site.type === 'web' ? faGlobe : faDesktop}
                          className="rookie-site-icon"
                        />
                        <span>{site.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              {rook.lastRun && (
                <div className="rookie-workflow-footer">
                  <div className="rookie-workflow-last-run">
                    <FontAwesomeIcon
                      icon={faClock}
                      style={{ marginRight: '8px' }}
                    />
                    Last run: {rook.lastRun.toLocaleDateString()}
                  </div>
                  <button className="rookie-run-button">
                    <FontAwesomeIcon
                      icon={faPlay}
                      style={{ marginRight: '8px' }}
                    />
                    Run Now
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RookiePage;
