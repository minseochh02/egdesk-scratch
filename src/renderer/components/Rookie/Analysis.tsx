import React, { useState, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faFileExcel,
  faFilePdf,
  faGlobe,
  faDesktop,
  faUpload,
  faTrash,
} from '../../utils/fontAwesomeIcons';
import './Analysis.css';

interface AnalysisProps {
  onBack: () => void;
}

interface Resource {
  id: number;
  name: string;
  type: 'web' | 'app';
  icon: string;
}

interface ExcelTable {
  id: string;
  name: string;
  position: {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  };
  headers: Array<{
    level: number;
    text: string;
    col: number;
    isMerged?: boolean;
  }>;
  dataRowCount: number;
}

interface AIAnalysisResult {
  success: boolean;
  tables: ExcelTable[];
  totalTables: number;
  summary: string;
  suggestions?: string[];
  error?: string;
}

// Mock resources for UI development
const mockResources: Resource[] = [
  { id: 1, name: 'NH Bank', type: 'web', icon: '🌐' },
  { id: 2, name: 'Woori Bank', type: 'web', icon: '🌐' },
  { id: 3, name: 'Company ERP', type: 'app', icon: '🖥️' },
  { id: 4, name: 'Shinhan Bank', type: 'web', icon: '🌐' },
  { id: 5, name: 'Google Sheets', type: 'web', icon: '🌐' },
  { id: 6, name: 'Excel', type: 'app', icon: '🖥️' },
  { id: 7, name: 'Notion', type: 'app', icon: '🖥️' },
  { id: 8, name: 'Naver', type: 'web', icon: '🌐' },
];

const Analysis: React.FC<AnalysisProps> = ({ onBack }) => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [selectedResources, setSelectedResources] = useState<number[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const resourceSectionRef = useRef<HTMLDivElement>(null);

  // Scroll to top when component mounts
  React.useEffect(() => {
    if (pageRef.current) {
      pageRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    // Also scroll window to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Analyze Excel file with AI when uploaded
  React.useEffect(() => {
    if (uploadedFile && uploadedFile.name.match(/\.(xlsx|xls)$/i)) {
      analyzeExcelWithAI(uploadedFile);
    }
  }, [uploadedFile]);

  // Scroll to resource section when AI analysis completes
  React.useEffect(() => {
    if (aiAnalysis && !isAnalyzing && resourceSectionRef.current) {
      resourceSectionRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }, [aiAnalysis, isAnalyzing]);

  // Handle file drop
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const { files } = e.dataTransfer;
    if (files.length > 0) {
      const file = files[0];
      // Check if file is Excel or PDF
      if (
        file.name.endsWith('.xlsx') ||
        file.name.endsWith('.xls') ||
        file.name.endsWith('.pdf')
      ) {
        setUploadedFile(file);
      } else {
        alert('Please upload an Excel (.xlsx, .xls) or PDF file');
      }
    }
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  // Handle drag leave
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { files } = e.target;
    if (files && files.length > 0) {
      const file = files[0];
      if (
        file.name.endsWith('.xlsx') ||
        file.name.endsWith('.xls') ||
        file.name.endsWith('.pdf')
      ) {
        setUploadedFile(file);
      } else {
        alert('Please upload an Excel (.xlsx, .xls) or PDF file');
      }
    }
  };

  // Handle file browse click
  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  // Handle file remove
  const handleRemoveFile = () => {
    setUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle resource selection toggle
  const handleResourceToggle = (resourceId: number) => {
    setSelectedResources((prev) => {
      if (prev.includes(resourceId)) {
        return prev.filter((id) => id !== resourceId);
      }
      return [...prev, resourceId];
    });
  };

  // Handle cancel/back
  const handleCancel = () => {
    setUploadedFile(null);
    setSelectedResources([]);
    setAiAnalysis(null);
    onBack();
  };

  // Analyze Excel file with AI
  const analyzeExcelWithAI = async (file: File) => {
    try {
      setIsAnalyzing(true);
      setAiAnalysis(null);
      console.log('[Analysis] Starting AI analysis for:', file.name);

      // Read file as ArrayBuffer in renderer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Array.from(new Uint8Array(arrayBuffer));

      console.log('[Analysis] File buffer read, size:', buffer.length, 'bytes');

      // Send buffer to main process for Excel processing + AI analysis
      const analysisResult = await (window as any).electron.invoke(
        'rookie:analyze-excel-from-buffer',
        {
          buffer,
          fileName: file.name,
        }
      );

      console.log('[Analysis] AI analysis result:', analysisResult);

      if (!analysisResult.success) {
        throw new Error(analysisResult.message || 'AI analysis failed');
      }

      setAiAnalysis(analysisResult);
    } catch (error: any) {
      console.error('[Analysis] AI analysis error:', error);
      setAiAnalysis({
        success: false,
        error: error.message,
        tables: [],
        totalTables: 0,
        sheetName: '',
        summary: '',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handle start recording
  const handleStartRecording = () => {
    if (!uploadedFile) {
      alert('Please upload a goal file first');
      return;
    }
    if (selectedResources.length === 0) {
      alert('Please select at least one resource');
      return;
    }

    // TODO: Will be implemented later
    alert('Recording will be implemented later');
  };

  // Get file icon based on file type
  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith('.pdf')) {
      return faFilePdf;
    }
    return faFileExcel;
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const availableResources = mockResources.filter(
    (r) => !selectedResources.includes(r.id),
  );
  const selectedResourcesList = mockResources.filter((r) =>
    selectedResources.includes(r.id),
  );

  return (
    <div ref={pageRef} className="rookie-analysis-page">
      {/* Header */}
      <div className="rookie-analysis-header">
        <button type="button" className="rookie-back-button" onClick={handleCancel}>
          <FontAwesomeIcon icon={faArrowLeft} />
          <span>Back</span>
        </button>
        <h2>Create New Rook</h2>
      </div>

      {/* Content */}
      <div className="rookie-analysis-content">
        {/* Step 1: Upload Goal File */}
        <div className="rookie-step-section">
          <h3 className="rookie-step-title">Step 1: Upload Goal File</h3>

          {!uploadedFile ? (
            <div
              role="button"
              tabIndex={0}
              className={`rookie-file-upload-zone ${isDragging ? 'dragging' : ''}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={handleBrowseClick}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleBrowseClick();
                }
              }}
            >
              <FontAwesomeIcon icon={faUpload} className="rookie-upload-icon" />
              <p className="rookie-upload-text">
                Drag & Drop Excel/PDF file here
              </p>
              <p className="rookie-upload-subtext">or click to browse</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.pdf"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </div>
          ) : (
            <div className="rookie-file-preview">
              <div className="rookie-file-info">
                <FontAwesomeIcon
                  icon={getFileIcon(uploadedFile.name)}
                  className="rookie-file-icon"
                />
                <div className="rookie-file-details">
                  <div className="rookie-file-name">{uploadedFile.name}</div>
                  <div className="rookie-file-size">
                    {formatFileSize(uploadedFile.size)}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="rookie-file-remove"
                onClick={handleRemoveFile}
              >
                <FontAwesomeIcon icon={faTrash} />
              </button>
            </div>
          )}
        </div>

        {/* AI Analysis Results */}
        {uploadedFile && uploadedFile.name.match(/\.(xlsx|xls)$/i) && (
          <div className="rookie-step-section">
            <h3 className="rookie-step-title">
              AI Analysis
              {isAnalyzing && <span style={{ marginLeft: '10px', fontSize: '12px', color: '#888' }}>(Analyzing...)</span>}
            </h3>

            {isAnalyzing && (
              <div className="rookie-ai-loading">
                <div className="rookie-spinner"></div>
                <p>Claude is analyzing your Excel structure...</p>
              </div>
            )}

            {!isAnalyzing && aiAnalysis && aiAnalysis.success && (
              <div className="rookie-ai-results">
                {/* Summary */}
                <div className="rookie-ai-summary">
                  <h4>Summary</h4>
                  <p>{aiAnalysis.summary}</p>
                </div>

                {/* Tables Found */}
                <div className="rookie-ai-tables">
                  <h4>Tables Found: {aiAnalysis.totalTables}</h4>

                  {aiAnalysis.tables.map((table, idx) => (
                    <div key={table.id} className="rookie-ai-table-card">
                      <div className="rookie-ai-table-header">
                        <span className="rookie-ai-table-number">Table {idx + 1}</span>
                        <span className="rookie-ai-table-name">{table.name}</span>
                      </div>

                      <div className="rookie-ai-table-details">
                        <div>
                          <strong>Position:</strong> Row {table.position.startRow} - {table.position.endRow},
                          Col {table.position.startCol} - {table.position.endCol}
                        </div>
                        <div>
                          <strong>Headers:</strong> {table.headers.length} header(s)
                        </div>
                        <div>
                          <strong>Data Rows:</strong> {table.dataRowCount}
                        </div>
                      </div>

                      {table.headers.length > 0 && (
                        <div className="rookie-ai-headers">
                          <strong>Header Structure:</strong>
                          <ul>
                            {table.headers.map((header, hidx) => (
                              <li key={hidx}>
                                Level {header.level}: {header.text}
                                {header.isMerged && <span className="rookie-merged-tag">Merged</span>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Suggestions */}
                {aiAnalysis.suggestions && aiAnalysis.suggestions.length > 0 && (
                  <div className="rookie-ai-suggestions">
                    <h4>Automation Suggestions</h4>
                    <ul>
                      {aiAnalysis.suggestions.map((suggestion, idx) => (
                        <li key={idx}>{suggestion}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {!isAnalyzing && aiAnalysis && !aiAnalysis.success && (
              <div className="rookie-ai-error">
                <p>❌ AI Analysis failed: {aiAnalysis.error}</p>
                {aiAnalysis.error?.includes('NO_API_KEY') && (
                  <p style={{ marginTop: '10px', fontSize: '12px', color: '#888' }}>
                    Please configure your Anthropic API key in AI Keys Manager
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Select Resources */}
        <div ref={resourceSectionRef} className="rookie-step-section">
          <h3 className="rookie-step-title">Step 2: Select Resources</h3>

          <div className="rookie-resource-library">
            {/* Available Resources */}
            <div className="rookie-resource-column">
              <h4 className="rookie-resource-column-title">
                Available Resources
              </h4>
              <div className="rookie-resource-list">
                {availableResources.map((resource) => (
                  <div
                    key={resource.id}
                    role="button"
                    tabIndex={0}
                    className="rookie-resource-item"
                    onClick={() => handleResourceToggle(resource.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleResourceToggle(resource.id);
                      }
                    }}
                  >
                    <FontAwesomeIcon
                      icon={resource.type === 'web' ? faGlobe : faDesktop}
                      className="rookie-resource-icon"
                    />
                    <span className="rookie-resource-name">
                      {resource.name}
                    </span>
                  </div>
                ))}

                {/* Add Resource Buttons */}
                <button
                  type="button"
                  className="rookie-add-resource-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    // eslint-disable-next-line no-alert
                    alert('Add resource will be implemented later');
                  }}
                >
                  + Add Website
                </button>
                <button
                  type="button"
                  className="rookie-add-resource-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    // eslint-disable-next-line no-alert
                    alert('Add resource will be implemented later');
                  }}
                >
                  + Add App
                </button>
              </div>
            </div>

            {/* Arrow indicator */}
            <div className="rookie-resource-arrow">→</div>

            {/* Selected Resources */}
            <div className="rookie-resource-column">
              <h4 className="rookie-resource-column-title">
                Your Selection ({selectedResourcesList.length})
              </h4>
              <div className="rookie-resource-list">
                {selectedResourcesList.length === 0 ? (
                  <div className="rookie-resource-empty">
                    No resources selected yet
                  </div>
                ) : (
                  selectedResourcesList.map((resource) => (
                    <div
                      key={resource.id}
                      role="button"
                      tabIndex={0}
                      className="rookie-resource-item selected"
                      onClick={() => handleResourceToggle(resource.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleResourceToggle(resource.id);
                        }
                      }}
                    >
                      <FontAwesomeIcon
                        icon={resource.type === 'web' ? faGlobe : faDesktop}
                        className="rookie-resource-icon"
                      />
                      <span className="rookie-resource-name">
                        {resource.name}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="rookie-analysis-footer">
        <button
          type="button"
          className="rookie-button-secondary"
          onClick={handleCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className="rookie-button-primary"
          onClick={handleStartRecording}
        >
          Start Recording →
        </button>
      </div>
    </div>
  );
};

export default Analysis;
