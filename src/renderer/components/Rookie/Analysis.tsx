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
import {
  TargetUpload,
  SourceFilesUpload,
  WebsiteSelector,
  ExplorationCredentials,
  BuildPlanDisplay,
} from './components';

interface AnalysisProps {
  onBack: () => void;
}


const Analysis: React.FC<AnalysisProps> = ({ onBack }) => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [resourceFiles, setResourceFiles] = useState<File[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [resolverAnalysis, setResolverAnalysis] = useState<any | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [availableSkillsets, setAvailableSkillsets] = useState<any[]>([]);
  const [selectedSkillsetId, setSelectedSkillsetId] = useState<string | null>(null);
  const [credentialStatus, setCredentialStatus] = useState<any | null>(null);
  const [researcherResults, setResearcherResults] = useState<any | null>(null);
  const [isResearching, setIsResearching] = useState(false);
  const [loginCredentials, setLoginCredentials] = useState<Record<string, string>>({});
  const [navigationPlans, setNavigationPlans] = useState<any | null>(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [executionResults, setExecutionResults] = useState<any | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
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

  // Load available skillsets on mount
  React.useEffect(() => {
    const loadSkillsets = async () => {
      try {
        const skillsets = await (window as any).electron.invoke('skillset:list-websites');
        setAvailableSkillsets(skillsets || []);
      } catch (error) {
        console.error('Failed to load skillsets:', error);
      }
    };
    loadSkillsets();
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

  // File handlers
  const handleRemoveFile = () => {
    setUploadedFile(null);
  };

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
    setNavigationPlans(null);
    setConfirmedTerms(new Set());
    setTermCorrections({});
    onBack();
  };

  // Handle execute navigation plan
  const handleExecutePlan = async (planIndex: number) => {
    if (!navigationPlans || !navigationPlans.plans || !navigationPlans.plans[planIndex]) {
      alert('No plan to execute');
      return;
    }

    try {
      setIsExecuting(true);
      setExecutionResults(null);
      console.log('[Analysis] Executing navigation plan...');
      console.log('[Analysis] Credentials available:', Object.keys(loginCredentials).length > 0 ? 'Yes' : 'No (AI will discover)');

      const plan = navigationPlans.plans[planIndex];

      console.log('[Analysis] Using', explorerCapabilities?.capabilities?.length || 0, 'capabilities for NAVIGATOR');

      // Pass credentials if available, otherwise AI will discover them
      const result = await (window as any).electron.invoke(
        'rookie:execute-navigation-plan',
        {
          plan,
          url: 'https://login.ecount.com/',
          credentialValues: Object.keys(loginCredentials).length > 0 ? loginCredentials : undefined,
          explorerCapabilities: explorerCapabilities?.capabilities || [], // Pass full sitemap from state
        }
      );

      console.log('[Analysis] Execution result:', result);

      if (!result || !result.success) {
        throw new Error(result?.error || 'Plan execution failed');
      }

      // Check if login credentials are needed
      if (result.needsLogin && result.loginFields) {
        console.log('[Analysis] Executor needs login credentials');
        // Store partial result to show credential form
        setExecutionResults({
          ...result,
          needsCredentialInput: true,
          planIndex, // Store plan index for resume
        });
      } else {
        setExecutionResults(result);
      }
    } catch (error: any) {
      console.error('[Analysis] Execution error:', error);
      alert(`Failed to execute plan: ${error.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  // Handle generate comprehensive build plan
  const handleGenerateNavigationPlan = async () => {
    try {
      setIsGeneratingPlan(true);
      setNavigationPlans(null);
      setExecutionResults(null);
      console.log('[Analysis] Generating comprehensive build plan...');

      // Check prerequisites
      if (!aiAnalysis) {
        alert('Please analyze the target report first (Step 1)');
        return;
      }

      if (resourceFiles.length === 0 && !selectedSkillsetId) {
        alert('Please add source files or select a website to continue');
        return;
      }

      // Prepare source files info (extract column names from resolver analysis if available)
      const sourceFilesInfo = resourceFiles.map(file => {
        // Try to find columns from resolver analysis
        const fileInventory = resolverAnalysis?.sourceInventory?.find(
          (inv: any) => inv.file === file.name
        );

        return {
          name: file.name,
          columns: fileInventory?.columns?.map((col: any) => col.name) || [],
        };
      });

      console.log('[Analysis] Calling AI Build Planner...');
      console.log('  - Target:', aiAnalysis.sheetName);
      console.log('  - Source files:', sourceFilesInfo.length);
      console.log('  - Website skillset:', selectedSkillsetId || 'None');

      const result = await (window as any).electron.invoke(
        'rookie:generate-build-plan',
        {
          targetReport: aiAnalysis,
          sourceFiles: sourceFilesInfo,
          websiteSkillsetId: selectedSkillsetId,
        }
      );

      console.log('[Analysis] Build plan result:', result);

      if (result.success) {
        console.log('[Analysis] ✓ Generated', result.steps?.length || 0, 'build steps');
        setNavigationPlans(result);
      } else {
        alert(`Failed to generate build plan: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('[Analysis] Build plan error:', error);
      alert(`Failed to generate build plan: ${error.message}`);
    } finally {
      setIsGeneratingPlan(false);
    }
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
  // Handle immediate website exploration
  const handleExploreWebsite = async () => {
    if (!newSiteUrl.trim()) {
      alert('Please enter a URL');
      return;
    }

    const url = newSiteUrl.trim();

    try {
      setIsResearching(true);
      setShowAddSiteForm(false);
      console.log('[Analysis] Starting immediate exploration of:', url);

      // Call EXPLORER directly
      const result = await (window as any).electron.invoke(
        'rookie:explore-websites-parallel',
        {
          sites: [{ url }],
        }
      );

      console.log('[Analysis] Exploration result:', result);

      if (!result || !result.success) {
        throw new Error(result?.error || 'Website exploration failed');
      }

      // Check if any site needs login credentials
      const sitesNeedingLogin = result.findings.filter((f: any) => f.needsLogin);
      if (sitesNeedingLogin.length > 0) {
        console.log('[Analysis] Site needs login credentials');
        setResearcherResults({
          ...result,
          needsCredentialInput: true,
          mode: 'parallel',
        });
      } else {
        // Success! Reload skillsets to show newly added one
        const skillsets = await (window as any).electron.invoke('skillset:list-websites');
        setAvailableSkillsets(skillsets || []);

        // Find the newly added skillset by URL
        const newSkillset = skillsets.find((s: any) => s.url === url);
        if (newSkillset) {
          setSelectedSkillsetId(newSkillset.id);
          await handleSkillsetSelection(newSkillset.id);
          alert(`✅ Website explored successfully!\n\nFound ${result.findings[0]?.capabilities?.length || 0} capabilities.\nAdded to Skillset library.`);
        }
      }

      // Reset form
      setNewSiteUrl('');
    } catch (error: any) {
      console.error('[Analysis] Exploration error:', error);
      alert(`Failed to explore website: ${error.message}`);
    } finally {
      setIsResearching(false);
    }
  };

  // Handle skillset selection
  const handleSkillsetSelection = async (skillsetId: string | null) => {
    setSelectedSkillsetId(skillsetId);
    setCredentialStatus(null);

    if (skillsetId) {
      try {
        const status = await (window as any).electron.invoke(
          'skillset:get-credential-status',
          skillsetId
        );
        setCredentialStatus(status);
      } catch (error) {
        console.error('Failed to load credential status:', error);
      }
    }
  };


  // Handle resume exploration with credentials
  const handleResumeResearch = async (siteIndex: number) => {
    const finding = researcherResults.findings[siteIndex];
    if (!finding.loginFields) return;

    try {
      setIsResearching(true);
      console.log('[Analysis] Resuming exploration with credentials (EXPLORER mode)...');

      // Always use EXPLORER (parallel mode)
      const result = await (window as any).electron.invoke('rookie:resume-exploration', {
        site: { url: finding.site },
        loginFields: finding.loginFields,
        credentialValues: loginCredentials,
      });

      console.log('[Analysis] Resume result:', result);

      if (result.success) {
        // Success! Reload skillsets to show newly added one
        const skillsets = await (window as any).electron.invoke('skillset:list-websites');
        setAvailableSkillsets(skillsets || []);

        // Find the newly added skillset by URL
        const newSkillset = skillsets.find((s: any) => s.url === finding.site);
        if (newSkillset) {
          setSelectedSkillsetId(newSkillset.id);
          await handleSkillsetSelection(newSkillset.id);
        }

        // Clear the researcher results and form
        setResearcherResults(null);
        setLoginCredentials({});
        setNewSiteUrl('');

        // Show success message
        alert(`✅ Website explored successfully!\n\nFound ${result.capabilities?.length || 0} capabilities.\nCredentials saved securely.\nAdded to Skillset library.`);
      }
    } catch (error: any) {
      console.error('[Analysis] Resume error:', error);
      alert(`Failed to resume exploration: ${error.message}`);
    } finally {
      setIsResearching(false);
    }
  };

  // Handle website exploration
  const handleStartWebsiteResearch = async () => {
    if (researchSites.length === 0) {
      alert('Please add at least one website to explore');
      return;
    }

    try {
      setIsResearching(true);
      setResearcherResults(null);
      console.log('[Analysis] Starting website exploration with EXPLORER...');
      console.log('[Analysis] Sites to explore:', researchSites.length);

      // Always use EXPLORER (parallel mode)
      const result = await (window as any).electron.invoke(
        'rookie:explore-websites-parallel',
        {
          sites: researchSites,
        }
      );

      console.log('[Analysis] Exploration result:', result);

      if (!result || !result.success) {
        throw new Error(result?.error || 'Website exploration failed');
      }

      // Check if any site needs login credentials
      const sitesNeedingLogin = result.findings.filter((f: any) => f.needsLogin);
      if (sitesNeedingLogin.length > 0) {
        console.log('[Analysis] Some sites need login credentials:', sitesNeedingLogin);
        // Store results to show login form
        setResearcherResults({
          ...result,
          needsCredentialInput: true,
          mode: 'parallel',
        });
      } else {
        setResearcherResults({
          ...result,
          mode: 'parallel',
        });
      }
    } catch (error: any) {
      console.error('[Analysis] Exploration error:', error);
      alert(`Website exploration failed: ${error.message}`);
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

          {/* Target Report Upload */}
          <TargetUpload
            uploadedFile={uploadedFile}
            onFileSelect={setUploadedFile}
            onFileRemove={handleRemoveFile}
          />

          {/* Source Files Upload */}
          <SourceFilesUpload
            files={resourceFiles}
            onFilesAdd={(files) => setResourceFiles(prev => [...prev, ...files])}
            onFileRemove={handleRemoveResourceFile}
          />

          {/* Website Selector */}
          <WebsiteSelector
            availableSkillsets={availableSkillsets}
            selectedSkillsetId={selectedSkillsetId}
            credentialStatus={credentialStatus}
            isExploring={isResearching && !researcherResults?.needsCredentialInput}
            onSkillsetSelect={handleSkillsetSelection}
            onExploreWebsite={handleExploreWebsite}
          />

          {/* Exploration Credentials */}
          {researcherResults && researcherResults.needsCredentialInput && researcherResults.findings && (
            <ExplorationCredentials
              findings={researcherResults.findings}
              isExploring={isResearching}
              onContinueExploration={async (siteIndex, credentials) => {
                setLoginCredentials(credentials);
                await handleResumeResearch(siteIndex);
              }}
            />
          )}

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


      {/* Step 2: Build Plan */}
      <div className="rookie-step-section">
        <h3 className="rookie-step-title">Step 2: Generate Build Plan</h3>
        <p className="rookie-subsection-description">
          AI will analyze your target report, source files, and website capabilities to create a comprehensive plan for building the entire report from scratch.
        </p>

        {/* Show available resources summary */}
        {(resourceFiles.length > 0 || selectedSkillsetId) && (
          <div className="rookie-resources-summary">
            <strong>📦 Available Resources:</strong>
            <ul>
              {resourceFiles.length > 0 && (
                <li>📁 {resourceFiles.length} source file{resourceFiles.length > 1 ? 's' : ''}: {resourceFiles.map(f => f.name).join(', ')}</li>
              )}
              {selectedSkillsetId && (() => {
                const skillset = availableSkillsets.find(s => s.id === selectedSkillsetId);
                return skillset ? (
                  <li>🌐 {skillset.siteName} ({Math.round(skillset.overallConfidence * 100)}% confidence)</li>
                ) : null;
              })()}
            </ul>
          </div>
        )}

        {/* Always show button */}
        {!navigationPlans && !isGeneratingPlan && (
          <button
            type="button"
            className="rookie-start-research-button"
            onClick={handleGenerateNavigationPlan}
          >
            🤖 Generate Build Plan
          </button>
        )}

          {isGeneratingPlan && (
            <div className="rookie-ai-loading">
              <div className="rookie-spinner"></div>
              <p>AI is analyzing all resources and generating comprehensive build plan...</p>
            </div>
          )}

          {navigationPlans && navigationPlans.success && (
            <BuildPlanDisplay
              plan={navigationPlans}
              onExecute={() => handleExecutePlan(0)}
              isExecuting={isExecuting && !executionResults}
            />
          )}

          {/* Execution Login Request */}
          {executionResults && executionResults.needsCredentialInput && executionResults.loginFields && (
                <div className="rookie-login-request-section">
                  <h4 className="rookie-researcher-title">🔐 Login Credentials Needed for Execution</h4>
                  <p className="rookie-login-request-note">
                    🔍 EXECUTOR discovered what login fields are needed.
                    <br />
                    🔒 Your passwords are encrypted and never exposed to AI.
                  </p>
                  <div className="rookie-login-request-card">
                    <div className="rookie-login-fields-discovered">
                      <strong>Fields discovered:</strong>
                      {executionResults.loginFields.fields.map((field: any, fidx: number) => (
                        <div key={fidx} className="rookie-discovered-field">
                          {field.name} ({field.type})
                        </div>
                      ))}
                    </div>
                    <div className="rookie-login-form">
                      {executionResults.loginFields.fields.map((field: any, fidx: number) => (
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
                      onClick={() => {
                        console.log('[Analysis] Resuming execution with credentials:', Object.keys(loginCredentials));
                        handleExecutePlan(executionResults.planIndex);
                      }}
                      disabled={isExecuting || executionResults.loginFields.fields.some((f: any) => !loginCredentials[f.name])}
                    >
                      {isExecuting ? '🚀 Executing...' : 'Continue Execution'}
                    </button>
                  </div>
                </div>
              )}

              {/* Execution Results */}
              {executionResults && executionResults.success && !executionResults.needsCredentialInput && (
                <div className="rookie-execution-results">
                  <h4 className="rookie-execution-title">✅ Execution Complete</h4>
                  {executionResults.savedTo && (
                    <div className="rookie-results-saved-note">
                      💾 Results saved to: <code>{executionResults.savedTo}</code>
                    </div>
                  )}

                  {executionResults.extractedData && (
                    <div className="rookie-extracted-data">
                      <strong>Findings:</strong>
                      <div className="rookie-findings-text">
                        {executionResults.extractedData.findings}
                      </div>

                      {executionResults.extractedData.data && (
                        <div className="rookie-data-preview">
                          <strong>Extracted Data:</strong>
                          <pre>{JSON.stringify(executionResults.extractedData.data, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  )}

                  {executionResults.executionLog && executionResults.executionLog.length > 0 && (
                    <div className="rookie-execution-log">
                      <strong>Execution Log:</strong>
                      <div className="rookie-log-entries">
                        {executionResults.executionLog.map((log: string, idx: number) => (
                          <div key={idx} className="rookie-log-entry">{log}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="rookie-execution-stats">
                    Tool calls: {executionResults.toolCalls || 0} |
                    Screenshots: {executionResults.screenshots?.length || 0}
                  </div>
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
