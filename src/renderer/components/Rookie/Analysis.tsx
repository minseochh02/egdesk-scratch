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

// DATA-ORIENTED ROOKIE Interfaces
interface ReportContext {
  company: string;
  reportPurpose: string;
  period: string;
  dataStory: string;
}

interface Dimension {
  name: string;
  values: string[];
  description: string;
  unclearTerms?: string[];
}

interface Measure {
  name: string;
  unit: string;
  description: string;
  questions?: string[];
}

interface Calculation {
  name: string;
  logic: string;
  example?: string;
  unclear?: string;
}

interface RawDataNeeds {
  description: string;
  fields: string[];
  sources: string[];
}

interface AIAnalysisResult {
  success: boolean;
  sheetName?: string;
  reportContext?: ReportContext;
  dimensions?: Dimension[];
  measures?: Measure[];
  calculations?: Calculation[];
  rawDataNeeds?: RawDataNeeds;
  unclearTerms?: string[];
  error?: string;
  html?: string; // Full HTML for display
  semanticHtml?: string; // Semantic HTML content
  htmlFilePath?: string;
  fromCache?: boolean;
  cacheFilePath?: string;
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
  const [resourceFiles, setResourceFiles] = useState<File[]>([]); // Source Excel files
  const [isDragging, setIsDragging] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [resolverAnalysis, setResolverAnalysis] = useState<any | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [termCorrections, setTermCorrections] = useState<Record<string, string>>({}); // term -> corrected answer
  const [confirmedTerms, setConfirmedTerms] = useState<Set<string>>(new Set()); // confirmed term names
  const [researchSites, setResearchSites] = useState<Array<{ url: string; notes?: string }>>([]);
  const [researcherResults, setResearcherResults] = useState<any | null>(null);
  const [isResearching, setIsResearching] = useState(false);
  const [showAddSiteForm, setShowAddSiteForm] = useState(false);
  const [newSiteUrl, setNewSiteUrl] = useState('');
  const [newSiteNotes, setNewSiteNotes] = useState('');
  const [loginCredentials, setLoginCredentials] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resourceFileInputRef = useRef<HTMLInputElement>(null);
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

  // Don't auto-analyze - wait for user to click button

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

  // Handle resource file upload
  const handleResourceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { files } = e.target;
    if (files && files.length > 0) {
      const newFiles = Array.from(files).filter(
        file => file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
      );
      if (newFiles.length > 0) {
        setResourceFiles(prev => [...prev, ...newFiles]);
      } else {
        alert('Please upload Excel files (.xlsx, .xls)');
      }
    }
  };

  // Handle resource file browse click
  const handleResourceFileBrowseClick = () => {
    resourceFileInputRef.current?.click();
  };

  // Handle resource file remove
  const handleRemoveResourceFile = (index: number) => {
    setResourceFiles(prev => prev.filter((_, idx) => idx !== index));
  };

  // Handle cancel/back
  const handleCancel = () => {
    setUploadedFile(null);
    setSelectedResources([]);
    setResourceFiles([]);
    setAiAnalysis(null);
    setResolverAnalysis(null);
    setResearchSites([]);
    setResearcherResults(null);
    setConfirmedTerms(new Set());
    setTermCorrections({});
    onBack();
  };

  // Analyze Excel file with AI
  const analyzeExcelWithAI = async (file: File, forceRegenerate = false) => {
    try {
      setIsAnalyzing(true);
      setAiAnalysis(null);
      console.log('[Analysis] Starting AI analysis for:', file.name);
      console.log('[Analysis] Force regenerate:', forceRegenerate);

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
          forceRegenerate,
          availableSourceFiles: resourceFiles.map(f => f.name), // Pass source file names
        }
      );

      console.log('[Analysis] AI analysis result:', analysisResult);

      if (!analysisResult || !analysisResult.success) {
        const errorMsg = analysisResult?.message || analysisResult?.error || 'AI analysis failed';
        throw new Error(String(errorMsg));
      }

      setAiAnalysis(analysisResult);
    } catch (error: any) {
      console.error('[Analysis] AI analysis error:', error);
      setAiAnalysis({
        success: false,
        error: error.message,
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Regenerate analysis (force refresh)
  const handleRegenerateAnalysis = () => {
    if (uploadedFile) {
      analyzeExcelWithAI(uploadedFile, true);
    }
  };

  // Confirm term resolution
  const handleConfirmTerm = (term: string) => {
    setConfirmedTerms(prev => new Set([...prev, term]));
  };

  // Correct term resolution
  const handleCorrectTerm = (term: string) => {
    const correction = window.prompt(`Correct the meaning of "${term}":`);
    if (correction && correction.trim()) {
      setTermCorrections(prev => ({ ...prev, [term]: correction.trim() }));
      setConfirmedTerms(prev => new Set([...prev, term]));
    }
  };

  // Handle add site form
  const handleAddSite = () => {
    if (!newSiteUrl.trim()) {
      alert('Please enter a URL');
      return;
    }

    setResearchSites(prev => [...prev, {
      url: newSiteUrl.trim(),
      notes: newSiteNotes.trim() || undefined,
    }]);

    // Reset form
    setNewSiteUrl('');
    setNewSiteNotes('');
    setShowAddSiteForm(false);
  };

  // Check if all terms are confirmed
  const allTermsConfirmed = resolverAnalysis?.termResolutions
    ? resolverAnalysis.termResolutions.every((tr: any) => confirmedTerms.has(tr.term))
    : false;

  // Handle resume research with credentials
  const handleResumeResearch = async (siteIndex: number) => {
    const finding = researcherResults.findings[siteIndex];
    if (!finding.loginFields) return;

    try {
      setIsResearching(true);
      console.log('[Analysis] Resuming research with credentials...');

      const result = await (window as any).electron.invoke(
        'rookie:resume-research',
        {
          loginFields: finding.loginFields,
          credentialValues: loginCredentials,
        }
      );

      console.log('[Analysis] Resume result:', result);

      if (result.success) {
        // Update the finding with new results
        const updatedFindings = [...researcherResults.findings];
        updatedFindings[siteIndex] = {
          ...finding,
          ...result,
          needsLogin: false,
        };

        setResearcherResults({
          ...researcherResults,
          findings: updatedFindings,
          needsCredentialInput: false,
        });

        // Clear credential inputs
        setLoginCredentials({});
      }
    } catch (error: any) {
      console.error('[Analysis] Resume error:', error);
      alert(`Failed to resume research: ${error.message}`);
    } finally {
      setIsResearching(false);
    }
  };

  // Handle website research
  const handleStartWebsiteResearch = async () => {
    if (researchSites.length === 0) {
      alert('Please add at least one website to research');
      return;
    }

    try {
      setIsResearching(true);
      setResearcherResults(null);
      console.log('[Analysis] Starting website research...');
      console.log('[Analysis] Sites to explore:', researchSites.length);

      // Call RESEARCHER IPC - AI will map site capabilities
      const result = await (window as any).electron.invoke(
        'rookie:research-websites',
        {
          sites: researchSites,
        }
      );

      console.log('[Analysis] Research result:', result);

      if (!result || !result.success) {
        throw new Error(result?.error || 'Website research failed');
      }

      // Check if any site needs login credentials
      const sitesNeedingLogin = result.findings.filter((f: any) => f.needsLogin);
      if (sitesNeedingLogin.length > 0) {
        console.log('[Analysis] Some sites need login credentials:', sitesNeedingLogin);
        // Store results to show login form
        setResearcherResults({
          ...result,
          needsCredentialInput: true,
        });
      } else {
        setResearcherResults(result);
      }
    } catch (error: any) {
      console.error('[Analysis] Research error:', error);
      alert(`Website research failed: ${error.message}`);
    } finally {
      setIsResearching(false);
    }
  };

  // Handle start recording - triggers Resolver analysis
  const handleStartRecording = async (forceRegenerate = false, rookieAnalysisOverride?: any) => {
    // Use override if provided (for sequential execution), otherwise use state
    const analysisToUse = rookieAnalysisOverride || aiAnalysis;

    if (!uploadedFile) {
      alert('Please upload a goal file first');
      return;
    }
    if (resourceFiles.length === 0) {
      alert('Please upload at least one source Excel file');
      return;
    }
    if (!analysisToUse || !analysisToUse.success) {
      alert('Please wait for target report analysis to complete');
      console.error('[Analysis] Cannot run RESOLVER - no valid ROOKIE analysis');
      return;
    }

    console.log('[Analysis] RESOLVER starting with analysis:', {
      hasOrientation: !!analysisToUse.reportContext,
      hasDimensions: !!analysisToUse.dimensions,
      unclearTerms: analysisToUse.unclearTerms?.length || 0,
    });

    try {
      setIsResolving(true);
      setResolverAnalysis(null);
      console.log('[Analysis] Starting Resolver analysis...');

      // Read all source files as buffers
      const sourceFilesData = await Promise.all(
        resourceFiles.map(async (file) => {
          const arrayBuffer = await file.arrayBuffer();
          const buffer = Array.from(new Uint8Array(arrayBuffer));
          return {
            fileName: file.name,
            buffer,
          };
        })
      );

      console.log('[Analysis] Source files prepared:', sourceFilesData.length);

      // Call Resolver IPC
      const resolverResult = await (window as any).electron.invoke(
        'rookie:analyze-source-mapping',
        {
          rookieAnalysis: analysisToUse,
          targetHtml: analysisToUse.semanticHtml || '',
          sourceFiles: sourceFilesData,
          forceRegenerate,
        }
      );

      console.log('[Analysis] Resolver analysis result:', resolverResult);
      console.log('[Analysis] Result keys:', resolverResult ? Object.keys(resolverResult) : 'null');
      console.log('[Analysis] Result success:', resolverResult?.success);

      if (!resolverResult) {
        console.error('[Analysis] ❌ RESOLVER returned null/undefined');
        throw new Error('Resolver returned no result');
      }

      if (!resolverResult.success) {
        console.error('[Analysis] ❌ RESOLVER failed:', resolverResult.error);
        throw new Error(resolverResult.error || 'Resolver analysis failed');
      }

      console.log('[Analysis] Setting RESOLVER state...');
      setResolverAnalysis(resolverResult);

      console.log('[Analysis] ✅ RESOLVER state set:', {
        success: resolverResult?.success,
        hasTermResolutions: !!resolverResult?.termResolutions,
        hasBuildRecipe: !!resolverResult?.buildRecipe,
      });

      // Force a re-render check
      setTimeout(() => {
        console.log('[Analysis] State after 100ms:', {
          resolverAnalysisIsSet: !!resolverResult,
        });
      }, 100);
    } catch (error: any) {
      console.error('[Analysis] Resolver analysis error:', error);
      alert(`Resolver analysis failed: ${error.message}`);
    } finally {
      setIsResolving(false);
    }
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
        {/* Step 1: Upload Files */}
        <div className="rookie-step-section">
          <h3 className="rookie-step-title">Step 1: Upload Files</h3>

          {/* Upload Target Report */}
          <div className="rookie-upload-subsection">
            <h4 className="rookie-subsection-title">Target Report</h4>
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
                  Drag & Drop Target Excel file here
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

          {/* Upload Source Files */}
          <div className="rookie-upload-subsection">
            <h4 className="rookie-subsection-title">Source Files (Raw Data)</h4>
            <p className="rookie-subsection-description">
              Upload Excel files containing the raw data needed to build the target report.
            </p>

            <div className="rookie-resource-file-upload">
              <button
                type="button"
                className="rookie-upload-resource-button"
                onClick={handleResourceFileBrowseClick}
              >
                <FontAwesomeIcon icon={faUpload} style={{ marginRight: '8px' }} />
                Upload Source Excel Files
              </button>
              <input
                ref={resourceFileInputRef}
                type="file"
                accept=".xlsx,.xls"
                multiple
                onChange={handleResourceFileChange}
                style={{ display: 'none' }}
              />
            </div>

            {resourceFiles.length > 0 && (
              <div className="rookie-resource-files-list">
                <h4 className="rookie-resource-files-title">
                  Uploaded Files ({resourceFiles.length})
                </h4>
                {resourceFiles.map((file, idx) => (
                  <div key={idx} className="rookie-resource-file-item">
                    <div className="rookie-resource-file-info">
                      <FontAwesomeIcon
                        icon={faFileExcel}
                        className="rookie-resource-file-icon"
                      />
                      <div className="rookie-resource-file-details">
                        <div className="rookie-resource-file-name">{file.name}</div>
                        <div className="rookie-resource-file-size">
                          {formatFileSize(file.size)}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="rookie-resource-file-remove"
                      onClick={() => handleRemoveResourceFile(idx)}
                      title="Remove file"
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Analyze Button - appears when both target and sources are uploaded */}
          {uploadedFile && resourceFiles.length > 0 && !aiAnalysis && !isAnalyzing && !isResolving && (
            <button
              type="button"
              className="rookie-analyze-all-button"
              onClick={async () => {
                console.log('[Analysis] 🚀 Start Analysis clicked');

                // First analyze target with ROOKIE
                console.log('[Analysis] Step 1: Running ROOKIE...');
                await analyzeExcelWithAI(uploadedFile);

                console.log('[Analysis] Step 2: Running RESOLVER...');
                // Then automatically trigger RESOLVER
                await handleStartRecording(false);

                console.log('[Analysis] ✅ Both analyses complete');
              }}
            >
              🚀 Start Analysis
            </button>
          )}

          {/* Re-analyze Button - appears after analysis is complete */}
          {uploadedFile && resourceFiles.length > 0 && (aiAnalysis || resolverAnalysis) && !isAnalyzing && !isResolving && (
            <button
              type="button"
              className="rookie-reanalyze-button"
              onClick={async () => {
                setAiAnalysis(null);
                setResolverAnalysis(null);
                setConfirmedTerms(new Set());
                setTermCorrections({});
                await analyzeExcelWithAI(uploadedFile, true);
                await handleStartRecording(true);
              }}
            >
              🔄 Re-analyze All
            </button>
          )}
        </div>

        {/* AI Analysis Results (part of Step 1) */}
        {uploadedFile && uploadedFile.name.match(/\.(xlsx|xls)$/i) && (aiAnalysis || isAnalyzing) && (
          <div className="rookie-step-section">
            <div className="rookie-step-title-row">
              <h3 className="rookie-step-title">
                Target Analysis (ROOKIE)
                {isAnalyzing && <span style={{ marginLeft: '10px', fontSize: '12px', color: '#888' }}>(Analyzing...)</span>}
                {!isAnalyzing && aiAnalysis && aiAnalysis.fromCache && (
                  <span className="rookie-cache-badge">📦 From Cache</span>
                )}
              </h3>
              {!isAnalyzing && aiAnalysis && aiAnalysis.success && (
                <button
                  type="button"
                  className="rookie-regenerate-button"
                  onClick={handleRegenerateAnalysis}
                  title="Force regenerate analysis (new API call)"
                >
                  🔄 Regenerate
                </button>
              )}
            </div>

            {isAnalyzing && (
              <div className="rookie-ai-loading">
                <div className="rookie-spinner"></div>
                <p>Gemini is analyzing your Excel structure...</p>
              </div>
            )}

            {!isAnalyzing && aiAnalysis && aiAnalysis.success && (
              <div className="rookie-ai-results">
                {/* Report Context */}
                {aiAnalysis.reportContext && (
                  <div className="rookie-phase">
                    <h4 className="rookie-phase-title">📊 Report Overview</h4>
                    <div className="rookie-phase-content">
                      <div className="rookie-info-grid">
                        <div><strong>Company:</strong> {aiAnalysis.reportContext.company}</div>
                        <div><strong>Purpose:</strong> {aiAnalysis.reportContext.reportPurpose}</div>
                        <div><strong>Period:</strong> {aiAnalysis.reportContext.period}</div>
                      </div>
                      <div className="rookie-assessment">{aiAnalysis.reportContext.dataStory}</div>
                    </div>
                  </div>
                )}

                {/* Data Dimensions */}
                {aiAnalysis.dimensions && aiAnalysis.dimensions.length > 0 && (
                  <div className="rookie-phase">
                    <h4 className="rookie-phase-title">📐 Data Dimensions ({aiAnalysis.dimensions.length})</h4>
                    <div className="rookie-phase-content-compact">
                      {aiAnalysis.dimensions.map((dim, idx) => (
                        <div key={idx} className="rookie-dimension-card-compact">
                          <div className="rookie-dimension-header-compact">
                            <span className="rookie-dimension-name-compact">{dim.name}</span>
                            <span className="rookie-dimension-count">({dim.values.length} values)</span>
                          </div>
                          <div className="rookie-value-tags-compact">
                            {dim.values.map((val, vidx) => (
                              <span key={vidx} className="rookie-value-tag-small">{val}</span>
                            ))}
                          </div>
                          {dim.unclearTerms && dim.unclearTerms.length > 0 && (
                            <div className="rookie-dimension-unclear-compact">
                              ❓ {dim.unclearTerms.join(', ')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Data Measures */}
                {aiAnalysis.measures && aiAnalysis.measures.length > 0 && (
                  <div className="rookie-phase-compact">
                    <h4 className="rookie-phase-title-compact">📊 Measures ({aiAnalysis.measures.length})</h4>
                    <div className="rookie-measures-badges">
                      {aiAnalysis.measures.map((measure, idx) => (
                        <span key={idx} className="rookie-measure-badge" title={measure.description}>
                          {measure.name} <span className="rookie-measure-unit-small">{measure.unit}</span>
                        </span>
                      ))}
                    </div>
                    {/* Show questions if any */}
                    {aiAnalysis.measures.some(m => m.questions && m.questions.length > 0) && (
                      <div className="rookie-measure-questions-list">
                        {aiAnalysis.measures.filter(m => m.questions && m.questions.length > 0).map((measure, idx) => (
                          <div key={idx} className="rookie-measure-question-item">
                            <strong>{measure.name}:</strong> {measure.questions?.join('; ')}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Calculations */}
                {aiAnalysis.calculations && aiAnalysis.calculations.length > 0 && (
                  <div className="rookie-phase-compact">
                    <h4 className="rookie-phase-title-compact">🧮 Calculations ({aiAnalysis.calculations.length})</h4>
                    <div className="rookie-calculations-list-compact">
                      {aiAnalysis.calculations.map((calc, idx) => (
                        <div key={idx} className="rookie-calculation-item-compact">
                          <strong>{calc.name}:</strong> {calc.logic}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Raw Data Needs */}
                {aiAnalysis.rawDataNeeds && (
                  <div className="rookie-phase-compact">
                    <h4 className="rookie-phase-title-compact">📝 Raw Data Needs</h4>
                    <div className="rookie-data-needs-compact">
                      <div className="rookie-data-needs-row">
                        <strong>Fields:</strong>
                        <div className="rookie-field-tags-compact">
                          {aiAnalysis.rawDataNeeds.fields.map((field, idx) => (
                            <span key={idx} className="rookie-field-tag-small">{field}</span>
                          ))}
                        </div>
                      </div>
                      <div className="rookie-data-needs-row">
                        <strong>Sources:</strong>
                        <div className="rookie-source-tags-compact">
                          {aiAnalysis.rawDataNeeds.sources.map((source, idx) => (
                            <span key={idx} className="rookie-source-tag-small">{source}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Unclear Terms - What ROOKIE doesn't understand */}
                {aiAnalysis.unclearTerms && aiAnalysis.unclearTerms.length > 0 && (
                  <div className="rookie-phase-compact">
                    <h4 className="rookie-phase-title-compact">
                      ❓ Terms to Research ({aiAnalysis.unclearTerms.length})
                    </h4>
                    <div className="rookie-unclear-terms-badges">
                      {aiAnalysis.unclearTerms.map((term, idx) => (
                        <span key={idx} className="rookie-unclear-term-badge">
                          {term}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!isAnalyzing && aiAnalysis && !aiAnalysis.success && (
              <div className="rookie-ai-error">
                <p>❌ AI Analysis failed: {aiAnalysis.error}</p>
                {aiAnalysis.error?.includes('NO_API_KEY') && (
                  <p style={{ marginTop: '10px', fontSize: '12px', color: '#888' }}>
                    Please configure your Google API key in AI Keys Manager
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Excel HTML Preview */}
        {!isAnalyzing && aiAnalysis && aiAnalysis.html && (
          <div className="rookie-step-section">
            <h3 className="rookie-step-title">Target Report Preview</h3>
            <div className="rookie-html-preview">
              <div className="rookie-html-preview-controls">
                <span className="rookie-html-info">
                  {aiAnalysis.htmlFilePath && (
                    <>File saved to: {aiAnalysis.htmlFilePath}</>
                  )}
                </span>
              </div>
              <div
                className="rookie-html-preview-content"
                dangerouslySetInnerHTML={{ __html: aiAnalysis.html }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Resolver Analysis Results */}
      {resolverAnalysis && resolverAnalysis.success && (
        <div className="rookie-step-section">
          <div className="rookie-step-title-row">
            <h3 className="rookie-step-title">
              Step 2: Review & Build Recipe
              {resolverAnalysis.fromCache && (
                <span className="rookie-cache-badge">📦 From Cache</span>
              )}
            </h3>
            {!isResolving && (
              <button
                type="button"
                className="rookie-regenerate-button"
                onClick={() => handleStartRecording(true)}
                title="Force regenerate analysis (new API call)"
              >
                🔄 Regenerate
              </button>
            )}
          </div>

          {/* Term Resolutions - Answers to ROOKIE's questions */}
          {resolverAnalysis.termResolutions && resolverAnalysis.termResolutions.length > 0 && (
            <div className="rookie-resolver-phase">
              <h4 className="rookie-resolver-phase-title">
                ✅ Term Resolutions ({resolverAnalysis.termResolutions.length})
              </h4>
              <div className="rookie-term-resolutions-note">
                RESOLVER found answers to ROOKIE's unclear terms by searching source data:
              </div>
              <div className="rookie-term-progress">
                {confirmedTerms.size} of {resolverAnalysis.termResolutions.length} terms confirmed
                {!allTermsConfirmed && (
                  <span className="rookie-term-progress-note">
                    (Please review and confirm all terms before proceeding)
                  </span>
                )}
              </div>

              {resolverAnalysis.termResolutions.map((res: any, idx: number) => {
                const isConfirmed = confirmedTerms.has(res.term);
                const hasCorrection = termCorrections[res.term];
                const displayAnswer = hasCorrection || res.answer;

                return (
                  <div key={idx} className={`rookie-term-resolution-card confidence-${res.confidence} ${isConfirmed ? 'confirmed' : ''}`}>
                    <div className="rookie-term-resolution-header">
                      <span className="rookie-resolved-term">"{res.term}"</span>
                      <div className="rookie-term-badges">
                        <span className={`rookie-confidence-badge ${res.confidence}`}>
                          {res.confidence}
                        </span>
                        {isConfirmed && (
                          <span className="rookie-confirmed-badge">✓ Confirmed</span>
                        )}
                        {hasCorrection && (
                          <span className="rookie-corrected-badge">✏️ Corrected</span>
                        )}
                      </div>
                    </div>
                    <div className="rookie-term-answer">
                      {hasCorrection && (
                        <div className="rookie-correction-note">User correction:</div>
                      )}
                      {displayAnswer}
                    </div>
                    <div className="rookie-term-location">
                      <strong>Found in:</strong> {res.foundIn}
                      {res.column && <span> → Column: <code>{res.column}</code></span>}
                      {res.exampleValues && res.exampleValues.length > 0 && (
                        <span className="rookie-term-examples-inline">
                          {' '}→ Examples: {res.exampleValues.slice(0, 5).join(', ')}
                          {res.exampleValues.length > 5 && `, +${res.exampleValues.length - 5} more`}
                        </span>
                      )}
                    </div>
                    {!isConfirmed && (
                      <div className="rookie-term-actions">
                        <button
                          type="button"
                          className="rookie-confirm-button"
                          onClick={() => handleConfirmTerm(res.term)}
                        >
                          ✓ Confirm
                        </button>
                        <button
                          type="button"
                          className="rookie-correct-button"
                          onClick={() => handleCorrectTerm(res.term)}
                        >
                          ✏️ Correct
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Source Inventory */}
          {resolverAnalysis.sourceInventory && resolverAnalysis.sourceInventory.length > 0 && (
            <div className="rookie-resolver-phase">
              <h4 className="rookie-resolver-phase-title">Source Inventory</h4>
              {resolverAnalysis.sourceInventory.map((src: any, idx: number) => (
                <div key={idx} className="rookie-source-inventory-card">
                  <div className="rookie-source-file-header">
                    <strong>{src.file}</strong>
                    <span className="rookie-source-origin">{src.origin}</span>
                  </div>
                  <div className="rookie-source-stats">
                    <span>Rows: {src.rowCount}</span>
                    {src.dateRange && <span>Date Range: {src.dateRange}</span>}
                  </div>
                  <div className="rookie-source-columns">
                    <strong>Columns ({src.columns.length}):</strong>
                    {src.columns.map((col: any, cidx: number) => (
                      <span key={cidx} className={`rookie-column-tag ${col.role}`}>
                        {col.name} ({col.type})
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Build Recipe Steps */}
          {resolverAnalysis.buildRecipe && resolverAnalysis.buildRecipe.steps && (
            <div className="rookie-resolver-phase">
              <h4 className="rookie-resolver-phase-title">
                Build Steps ({resolverAnalysis.buildRecipe.steps.length})
              </h4>
              {resolverAnalysis.buildRecipe.steps.map((step: any) => (
                <div key={step.step} className="rookie-build-step-card">
                  <div className="rookie-step-number">Step {step.step}</div>
                  <div className="rookie-step-target">{step.targetSection}</div>
                  <div className="rookie-step-action">{step.action}</div>
                  <div className="rookie-step-logic">
                    <strong>Logic:</strong>
                    <pre>{step.logic}</pre>
                  </div>
                  <div className="rookie-step-fills">
                    <strong>Fills:</strong> {step.fillsCells}
                  </div>
                  <div className="rookie-step-check">
                    <strong>Post-check:</strong> {step.postCheck}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Unknowns/Unresolved Items */}
          {resolverAnalysis.buildRecipe?.unresolvedItems &&
           resolverAnalysis.buildRecipe.unresolvedItems.length > 0 && (
            <div className="rookie-resolver-phase">
              <h4 className="rookie-resolver-phase-title">
                Unresolved Items ({resolverAnalysis.buildRecipe.unresolvedItems.length})
              </h4>
              {resolverAnalysis.buildRecipe.unresolvedItems.map((item: any, idx: number) => (
                <div key={idx} className="rookie-unresolved-card">
                  <div className="rookie-unresolved-item">{item.item}</div>
                  <div className="rookie-unresolved-reason">
                    <strong>Reason:</strong> {item.reason}
                  </div>
                  <div className="rookie-unresolved-workaround">
                    <strong>Workaround:</strong> {item.workaround}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Website Research (Always visible) */}
      <div className="rookie-step-section">
        <h3 className="rookie-step-title">Step 3: Website Research (Optional)</h3>

        {/* Show what still needs research */}
        {resolverAnalysis?.buildRecipe?.unresolvedItems && resolverAnalysis.buildRecipe.unresolvedItems.length > 0 && (
            <div className="rookie-unresolved-summary">
              <h4>🔍 Still Needs Research ({resolverAnalysis.buildRecipe.unresolvedItems.length} items)</h4>
              <div className="rookie-unresolved-items-compact">
                {resolverAnalysis.buildRecipe.unresolvedItems.map((item: any, idx: number) => (
                  <div key={idx} className="rookie-unresolved-item-compact">
                    • {item.item}
                  </div>
                ))}
              </div>
              <p className="rookie-research-suggestion">
                💡 Add websites below to let RESEARCHER explore and find this data automatically
              </p>
            </div>
          )}

          {/* Add research sites */}
          <div className="rookie-research-sites-section">
            <h4 className="rookie-subsection-title">Research Websites</h4>
            <p className="rookie-subsection-description">
              Add website URLs where RESEARCHER should look for missing data. AI will automatically discover what login fields are needed and ask you to provide credentials.
            </p>

            {!showAddSiteForm ? (
              <button
                type="button"
                className="rookie-add-site-button"
                onClick={() => setShowAddSiteForm(true)}
              >
                + Add Website
              </button>
            ) : (
              <div className="rookie-add-site-form">
                <input
                  type="url"
                  placeholder="Website URL (e.g., https://login.ecount.com, https://bank.com)"
                  value={newSiteUrl}
                  onChange={(e) => setNewSiteUrl(e.target.value)}
                  className="rookie-site-input"
                  autoFocus
                />
                <textarea
                  placeholder="Notes (optional): e.g., 'This account only has Sales and Inventory access' or 'Focus on transaction reports only'"
                  value={newSiteNotes}
                  onChange={(e) => setNewSiteNotes(e.target.value)}
                  className="rookie-site-notes-input"
                  rows={3}
                />
                <p className="rookie-site-form-note">
                  💡 AI will explore the site and ask for credentials if needed
                </p>
                <div className="rookie-form-buttons">
                  <button
                    type="button"
                    className="rookie-form-button-add"
                    onClick={handleAddSite}
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    className="rookie-form-button-cancel"
                    onClick={() => {
                      setShowAddSiteForm(false);
                      setNewSiteUrl('');
                      setNewSiteNotes('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {researchSites.length > 0 && (
              <div className="rookie-research-sites-list">
                {researchSites.map((site, idx) => (
                  <div key={idx} className="rookie-research-site-item">
                    <div className="rookie-site-info">
                      <span className="rookie-site-url">{site.url}</span>
                      {site.notes && (
                        <div className="rookie-site-notes-display">
                          📝 {site.notes}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="rookie-remove-site-button"
                      onClick={() => setResearchSites(prev => prev.filter((_, i) => i !== idx))}
                    >
                      ×
                    </button>
                  </div>
                ))}

                {/* Start Research Button */}
                <button
                  type="button"
                  className="rookie-start-research-button"
                  onClick={handleStartWebsiteResearch}
                  disabled={isResearching}
                >
                  {isResearching ? '🔍 Researching Websites...' : '🚀 Start Website Research'}
                </button>
                {!allTermsConfirmed && (
                  <p className="rookie-research-note">
                    💡 Tip: Confirming term resolutions in Step 2 helps RESEARCHER understand what to look for
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Login Credential Request */}
          {researcherResults && researcherResults.needsCredentialInput && (
            <div className="rookie-login-request-section">
              <h4 className="rookie-researcher-title">🔐 Login Credentials Needed</h4>
              <p className="rookie-login-request-note">
                🔍 RESEARCHER explored the sites and discovered what fields are needed for login.
                <br />
                🔒 Your passwords are encrypted and never exposed to AI.
              </p>
              {researcherResults.findings.filter((f: any) => f.needsLogin).map((finding: any, idx: number) => (
                <div key={idx} className="rookie-login-request-card">
                  <div className="rookie-login-site">{finding.site}</div>
                  <div className="rookie-login-fields-discovered">
                    <strong>Fields discovered:</strong>
                    {finding.loginFields.fields.map((field: any, fidx: number) => (
                      <div key={fidx} className="rookie-discovered-field">
                        {field.name} ({field.type})
                      </div>
                    ))}
                  </div>
                  <div className="rookie-login-form">
                    {finding.loginFields.fields.map((field: any, fidx: number) => (
                      <input
                        key={fidx}
                        type={field.type === 'password' ? 'password' : 'text'}
                        placeholder={field.name}
                        value={loginCredentials[field.name] || ''}
                        onChange={(e) => {
                          setLoginCredentials(prev => ({
                            ...prev,
                            [field.name]: e.target.value,
                          }));
                        }}
                        className="rookie-login-input"
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    className="rookie-continue-research-button"
                    onClick={() => handleResumeResearch(idx)}
                    disabled={isResearching || finding.loginFields.fields.some((f: any) => !loginCredentials[f.name])}
                  >
                    {isResearching ? '🔍 Logging in...' : 'Continue Research'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Research Results */}
          {researcherResults && researcherResults.success && !researcherResults.needsCredentialInput && (
            <div className="rookie-researcher-results-section">
              <h4 className="rookie-researcher-title">🎯 Research Findings</h4>
              {researcherResults.findings.map((finding: any, idx: number) => (
                <div key={idx} className={`rookie-research-finding ${finding.success ? 'success' : 'failed'}`}>
                  <div className="rookie-research-site-header">
                    <span className="rookie-research-site-url">{finding.site}</span>
                    <span className={`rookie-research-status ${finding.success ? 'success' : 'failed'}`}>
                      {finding.success ? '✓ Found Data' : '✗ Failed'}
                    </span>
                  </div>

                  {finding.success && (
                    <>
                      <div className="rookie-site-type-badge">{finding.siteType}</div>
                      <div className="rookie-research-summary">{finding.summary}</div>

                      {finding.capabilities && finding.capabilities.length > 0 && (
                        <div className="rookie-site-capabilities">
                          <strong>Site Capabilities ({finding.capabilities.length} sections):</strong>
                          {finding.capabilities.map((cap: any, cidx: number) => (
                            <div key={cidx} className="rookie-capability-item">
                              <div className="rookie-capability-header">
                                <span className="rookie-capability-section">{cap.section}</span>
                                <span className="rookie-capability-path">{cap.path}</span>
                              </div>
                              <div className="rookie-capability-description">{cap.description}</div>
                              {cap.dataAvailable && cap.dataAvailable.length > 0 && (
                                <div className="rookie-capability-data">
                                  <strong>Data:</strong>
                                  {cap.dataAvailable.map((data: string, didx: number) => (
                                    <span key={didx} className="rookie-data-badge">{data}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="rookie-research-stats">
                        Tool calls: {finding.toolCalls || 0} | Screenshots: {finding.screenshots?.length || 0}
                      </div>
                    </>
                  )}

                  {!finding.success && (
                    <div className="rookie-research-error">
                      Error: {finding.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      {/* Footer */}
      <div className="rookie-analysis-footer">
        <button
          type="button"
          className="rookie-button-secondary"
          onClick={handleCancel}
          disabled={isResolving || isResearching}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default Analysis;
