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
  SourceMappingVisualizer,
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

  // Handle execute build plan
  const handleExecutePlan = async (planIndex: number) => {
    if (!navigationPlans || !navigationPlans.steps || navigationPlans.steps.length === 0) {
      alert('No build plan to execute');
      return;
    }

    // Check if skillset is selected (required for website automation)
    const hasWebsiteSteps = navigationPlans.steps.some((s: any) =>
      s.actionType === 'NAVIGATE_WEBSITE' || s.actionType === 'DOWNLOAD_EXCEL'
    );

    if (hasWebsiteSteps && !selectedSkillsetId) {
      alert('⚠️ This plan requires website automation.\n\nPlease select a website from the Skillset library in Step 1 before executing.');
      return;
    }

    try {
      setIsExecuting(true);
      setExecutionResults(null);
      console.log('[Analysis] Executing build plan...');
      console.log('[Analysis] Build steps:', navigationPlans.steps.length);
      console.log('[Analysis] Selected skillset:', selectedSkillsetId);
      console.log('[Analysis] Has website steps:', hasWebsiteSteps);

      // Get credentials if skillset is selected
      let credentials = null;
      if (selectedSkillsetId) {
        try {
          credentials = await (window as any).electron.invoke(
            'skillset:get-credentials',
            selectedSkillsetId
          );
          console.log('[Analysis] Loaded credentials from Skillset:', credentials ? 'Yes' : 'No');

          // Check format - new format has credentials array, old format is flat object
          if (credentials && credentials.credentials && Array.isArray(credentials.credentials)) {
            console.log('[Analysis] ✓ New format with selectors, fields:', credentials.credentials.length);
            credentials.credentials.forEach((c: any) => {
              console.log(`  - ${c.fieldName}: selector ID = ${c.selector.elementId}, has value = ${!!c.value}`);
            });
          } else if (credentials && typeof credentials === 'object') {
            console.log('[Analysis] Old format (no selectors), fields:', Object.keys(credentials));
          }
        } catch (error) {
          console.warn('[Analysis] Failed to load credentials:', error);
        }
      } else {
        console.warn('[Analysis] ⚠️ No skillset selected - cannot load credentials');
      }

      // Prepare credentials - check if they actually have values
      const finalCredentials =
        (credentials && Object.keys(credentials).length > 0) ? credentials :
        (Object.keys(loginCredentials).length > 0) ? loginCredentials :
        undefined;

      console.log('[Analysis] Final credentials to send:', finalCredentials ? 'Has values' : 'None');
      console.log('[Analysis] Credential object:', finalCredentials);

      // Execute the build plan
      const result = await (window as any).electron.invoke(
        'rookie:execute-build-plan',
        {
          buildPlan: navigationPlans,
          targetReport: aiAnalysis,
          sourceFiles: resourceFiles.map(f => ({ name: f.name })),
          websiteSkillsetId: selectedSkillsetId,
          credentials: finalCredentials,
        }
      );

      console.log('[Analysis] Sent to backend - websiteSkillsetId:', selectedSkillsetId);
      console.log('[Analysis] Sent to backend - credentials:', finalCredentials ? 'Included' : 'Not included');

      console.log('[Analysis] Execution result:', result);

      if (!result) {
        throw new Error('No execution result returned');
      }

      // Display results
      setExecutionResults({
        success: result.success,
        completedSteps: result.completedSteps,
        totalSteps: result.totalSteps,
        websiteResults: result.websiteResults,
        dataProcessingResult: result.dataProcessingResult,
        outputFile: result.outputFile,
        error: result.error,
        message: result.outputFile
          ? `✅ Report built successfully: ${result.outputFile}`
          : (result.error || `Completed ${result.completedSteps} of ${result.totalSteps} steps`),
      });

      if (result.error) {
        console.warn('[Analysis] Execution completed with note:', result.error);
      } else if (result.success) {
        console.log('[Analysis] ✓ Build plan executed successfully');
      }
    } catch (error: any) {
      console.error('[Analysis] Execution error:', error);
      alert(`Failed to execute plan: ${error.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  // Handle load saved build plan
  const handleLoadSavedBuildPlan = async (fileName?: string) => {
    try {
      setIsGeneratingPlan(true);
      setNavigationPlans(null);
      setExecutionResults(null);
      console.log('[Analysis] Loading saved build plan...');

      const result = await (window as any).electron.invoke(
        'rookie:load-build-plan',
        { fileName: fileName || null }
      );

      console.log('[Analysis] Loaded plan:', result);

      if (result.success) {
        console.log('[Analysis] ✓ Loaded', result.steps?.length || 0, 'steps from file');
        setNavigationPlans(result);

        // Check if plan needs website and warn user
        const hasWebsiteSteps = result.steps?.some((s: any) =>
          s.actionType === 'NAVIGATE_WEBSITE' || s.actionType === 'DOWNLOAD_EXCEL'
        );

        if (hasWebsiteSteps && !selectedSkillsetId) {
          setTimeout(() => {
            alert('📂 Build plan loaded!\n\n⚠️ This plan requires website automation.\nPlease select ECOUNT from the Skillset dropdown in Step 1 before executing.');
          }, 500);
        }
      } else {
        alert(`Failed to load build plan: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('[Analysis] Load plan error:', error);
      alert(`Failed to load build plan: ${error.message}`);
    } finally {
      setIsGeneratingPlan(false);
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
      let sourceFilesInfo = resourceFiles.map(file => {
        // Try to find columns from resolver analysis
        const fileInventory = resolverAnalysis?.sourceInventory?.find(
          (inv: any) => inv.file === file.name
        );

        const columns = fileInventory?.columns?.map((col: any) => col.name) || [];

        console.log(`[Analysis] File: ${file.name}, Columns from RESOLVER: ${columns.length}`);

        return {
          name: file.name,
          columns,
        };
      });

      // If no columns found and we have source files, warn user
      const hasColumns = sourceFilesInfo.some(f => f.columns.length > 0);
      if (resourceFiles.length > 0 && !hasColumns) {
        console.warn('[Analysis] ⚠️ No column information available from RESOLVER');
        console.warn('[Analysis] Build plan may be less specific without column names');

        // Provide at least file names
        sourceFilesInfo = resourceFiles.map(file => ({
          name: file.name,
          columns: [], // Empty but AI knows files exist
        }));
      }

      console.log('[Analysis] Calling AI Build Planner...');
      console.log('  - Target:', aiAnalysis.sheetName);
      console.log('  - Source files being sent:', sourceFilesInfo.length);
      sourceFilesInfo.forEach(f => {
        console.log(`    • ${f.name}: ${f.columns.length} columns - ${f.columns.join(', ')}`);
      });
      console.log('  - Website skillset ID being sent:', selectedSkillsetId || 'None');
      console.log('  - Full payload:');
      console.log('    sourceFiles:', JSON.stringify(sourceFilesInfo));
      console.log('    websiteSkillsetId:', selectedSkillsetId);

      const result = await (window as any).electron.invoke(
        'rookie:generate-build-plan',
        {
          targetReport: aiAnalysis,
          sourceFiles: sourceFilesInfo,
          websiteSkillsetId: selectedSkillsetId,
        }
      );

      console.log('[Analysis] Received result from backend:');
      console.log('  - Success:', result.success);
      console.log('  - Steps:', result.steps?.length || 0);
      console.log('  - Error:', result.error || 'None');

      console.log('[Analysis] Build plan result:', result);
      console.log('[Analysis] Result success:', result.success);
      console.log('[Analysis] Result steps:', result.steps?.length);
      console.log('[Analysis] Result strategy:', result.strategy);

      if (result.success) {
        console.log('[Analysis] ✓ Generated', result.steps?.length || 0, 'build steps');
        console.log('[Analysis] Setting navigationPlans state...');
        setNavigationPlans(result);
        console.log('[Analysis] ✓ navigationPlans state updated');
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

  // Handle re-explore existing skillset
  const handleReExploreSkillset = async (skillsetId: string) => {
    try {
      setIsResearching(true);
      console.log('[Analysis] Re-exploring skillset:', skillsetId);

      // Get website info
      const website = await (window as any).electron.invoke('skillset:get-website', skillsetId);
      if (!website) {
        alert('Website not found');
        return;
      }

      console.log('[Analysis] Re-exploring:', website.siteName, website.url);

      // Get saved credentials
      const savedCredentials = await (window as any).electron.invoke(
        'skillset:get-credentials',
        skillsetId
      );

      console.log('[Analysis] Saved credentials retrieved:', savedCredentials);
      console.log('[Analysis] Credential keys:', savedCredentials ? Object.keys(savedCredentials) : 'None');
      console.log('[Analysis] Has credentials:', !!savedCredentials && Object.keys(savedCredentials).length > 0);

      // Trigger exploration with saved credentials
      const siteWithCreds = {
        url: website.url,
        credentialValues: savedCredentials || undefined,
      };

      console.log('[Analysis] Sending to EXPLORER:', {
        url: website.url,
        hasCredentials: !!savedCredentials,
        credentialKeys: savedCredentials ? Object.keys(savedCredentials) : [],
      });

      const result = await (window as any).electron.invoke(
        'rookie:explore-websites-parallel',
        {
          sites: [siteWithCreds],
        }
      );

      console.log('[Analysis] EXPLORER returned needsLogin:', result.findings?.[0]?.needsLogin);
      console.log('[Analysis] Re-exploration result:', result);

      if (!result || !result.success) {
        throw new Error(result?.error || 'Re-exploration failed');
      }

      // Check if any site needs login credentials
      const sitesNeedingLogin = result.findings.filter((f: any) => f.needsLogin);
      console.log('[Analysis] Sites needing login:', sitesNeedingLogin.length);
      console.log('[Analysis] Findings:', result.findings);

      if (sitesNeedingLogin.length > 0) {
        console.log('[Analysis] ✓ Re-exploration needs credentials - showing credential form');
        console.log('[Analysis] Login fields:', sitesNeedingLogin[0].loginFields);

        // Show credential input form
        setResearcherResults({
          ...result,
          needsCredentialInput: true,
          mode: 'parallel',
          isReExplore: true, // Flag to indicate this is a re-explore
          originalSkillsetId: skillsetId, // Store for later
        });

        console.log('[Analysis] ✓ researcherResults state set, credential form should appear');
      } else {
        // Success without needing credentials
        console.log('[Analysis] Re-exploration completed successfully');

        // Reload skillsets to get updated data
        const skillsets = await (window as any).electron.invoke('skillset:list-websites');
        setAvailableSkillsets(skillsets || []);

        // Reload credential status
        await handleSkillsetSelection(skillsetId);

        alert(`✅ Skillset refreshed successfully!\n\nCapabilities have been updated.\nCredentials preserved.`);
      }
    } catch (error: any) {
      console.error('[Analysis] Re-explore error:', error);
      alert(`Failed to refresh skillset: ${error.message}`);
    } finally {
      setIsResearching(false);
    }
  };


  // Handle resume exploration with credentials
  const handleResumeResearch = async (siteIndex: number, credentials?: Record<string, string>) => {
    const finding = researcherResults.findings[siteIndex];
    if (!finding.loginFields) return;

    // Use passed credentials or fall back to state
    const credsToUse = credentials || loginCredentials;

    console.log('[Analysis] Credentials to use:', Object.keys(credsToUse));
    console.log('[Analysis] Credential values present:', Object.keys(credsToUse).length);

    if (Object.keys(credsToUse).length === 0) {
      alert('No credentials entered. Please fill in all fields.');
      return;
    }

    try {
      setIsResearching(true);
      console.log('[Analysis] Resuming exploration with credentials (EXPLORER mode)...');
      console.log('[Analysis] Sending IPC with:', {
        url: finding.site,
        hasLoginFields: !!finding.loginFields,
        credentialKeys: Object.keys(credsToUse),
        credentialValues: credsToUse, // Full object for debugging
      });

      // Always use EXPLORER (parallel mode)
      const result = await (window as any).electron.invoke('rookie:resume-exploration', {
        site: { url: finding.site },
        loginFields: finding.loginFields,
        credentialValues: credsToUse,
      });

      console.log('[Analysis] Resume result:', result);

      if (result.success) {
        // Reload skillsets to get updated data
        const skillsets = await (window as any).electron.invoke('skillset:list-websites');
        setAvailableSkillsets(skillsets || []);

        // Check if this was a re-explore (updating existing) or new explore
        const isReExplore = researcherResults.isReExplore;
        const originalSkillsetId = researcherResults.originalSkillsetId;

        if (isReExplore && originalSkillsetId) {
          // Re-exploration: Keep the same skillset selected
          console.log('[Analysis] Re-exploration successful, updating existing skillset');
          setSelectedSkillsetId(originalSkillsetId);
          await handleSkillsetSelection(originalSkillsetId);

          // Clear the researcher results and form
          setResearcherResults(null);
          setLoginCredentials({});

          // Show success message for refresh
          alert(`✅ Skillset refreshed successfully!\n\nFound ${result.capabilities?.length || 0} capabilities.\nCredentials saved securely.\nSkillset updated.`);
        } else {
          // New exploration: Find and select the newly added skillset
          const newSkillset = skillsets.find((s: any) => s.url === finding.site);
          if (newSkillset) {
            setSelectedSkillsetId(newSkillset.id);
            await handleSkillsetSelection(newSkillset.id);
          }

          // Clear the researcher results and form
          setResearcherResults(null);
          setLoginCredentials({});
          setNewSiteUrl('');

          // Show success message for new explore
          alert(`✅ Website explored successfully!\n\nFound ${result.capabilities?.length || 0} capabilities.\nCredentials saved securely.\nAdded to Skillset library.`);
        }
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
            onReExplore={handleReExploreSkillset}
          />

          {/* Exploration Credentials */}
          {researcherResults && researcherResults.needsCredentialInput && researcherResults.findings && (
            <ExplorationCredentials
              findings={researcherResults.findings}
              isExploring={isResearching}
              onContinueExploration={async (siteIndex, credentials) => {
                console.log('[Analysis] Credentials from form:', credentials);
                console.log('[Analysis] Field count:', Object.keys(credentials).length);
                setLoginCredentials(credentials); // Save to state for later use
                await handleResumeResearch(siteIndex, credentials); // Pass directly!
              }}
            />
          )}

          {/* Analyze Target Button - appears when target file is uploaded */}
          {uploadedFile && !aiAnalysis && !isAnalyzing && (
            <button
              type="button"
              className="rookie-analyze-target-button"
              onClick={async () => {
                console.log('[Analysis] Analyzing target report...');
                await analyzeExcelWithAI(uploadedFile);
              }}
            >
              🤖 Analyze Target Report
            </button>
          )}

          {/* Re-analyze Button - appears after analysis is complete */}
          {uploadedFile && aiAnalysis && !isAnalyzing && (
            <button
              type="button"
              className="rookie-reanalyze-button"
              onClick={async () => {
                setAiAnalysis(null);
                await analyzeExcelWithAI(uploadedFile, true);
              }}
            >
              🔄 Re-analyze Target
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

        {/* Excel HTML Preview - Plain Structure */}
        {!isAnalyzing && aiAnalysis && aiAnalysis.html && (
          <div className="rookie-step-section">
            <h3 className="rookie-step-title">Target Report Structure</h3>
            <p className="rookie-subsection-description">
              Visual preview of the target report structure (analyzed by AI).
              {!resolverAnalysis && ' Run Step 2 to see source-to-target mappings.'}
            </p>
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


      {/* Step 2: Analyze Source Mapping (RESOLVER) */}
      <div className="rookie-step-section">
        <h3 className="rookie-step-title">Step 2: Analyze Source-to-Target Mapping</h3>
        <p className="rookie-subsection-description">
          The Resolver will analyze how your source files map to the target report structure.
          It will resolve unclear terms, verify formulas, and create a detailed build recipe.
        </p>

        {/* Prerequisites check */}
        {(!aiAnalysis || resourceFiles.length === 0) && (
          <div className="rookie-prerequisites-warning">
            ⚠️ Prerequisites needed:
            <ul>
              {!aiAnalysis && <li>Complete Step 1 (Target Report Analysis)</li>}
              {resourceFiles.length === 0 && <li>Upload at least one source file in Step 1</li>}
            </ul>
          </div>
        )}

        {/* Resolver button */}
        {aiAnalysis && resourceFiles.length > 0 && !resolverAnalysis && !isResolving && (
          <button
            type="button"
            className="rookie-start-research-button"
            onClick={() => handleStartRecording(false)}
          >
            🔍 Analyze Source Mapping
          </button>
        )}

        {/* Loading state */}
        {isResolving && (
          <div className="rookie-ai-loading">
            <div className="rookie-spinner"></div>
            <p>Resolver is analyzing source files and mapping them to target report...</p>
            <p style={{ fontSize: '12px', color: '#888', marginTop: '10px' }}>
              This may take 1-2 minutes as the AI explores your data
            </p>
          </div>
        )}

        {/* Resolver results */}
        {resolverAnalysis && resolverAnalysis.success && (
          <div className="rookie-resolver-results">
            <div className="rookie-resolver-success">
              ✅ Source mapping analysis complete!
            </div>

            {/* Term Resolutions */}
            {resolverAnalysis.termResolutions && resolverAnalysis.termResolutions.length > 0 && (
              <div className="rookie-phase-compact">
                <h4 className="rookie-phase-title-compact">
                  ❓ Terms Resolved ({resolverAnalysis.termResolutions.length})
                </h4>
                <div className="rookie-term-resolutions">
                  {resolverAnalysis.termResolutions.map((tr: any, idx: number) => (
                    <div key={idx} className="rookie-term-resolution">
                      <strong>"{tr.term}"</strong> → {tr.answer}
                      <span className={`rookie-confidence-badge ${tr.confidence}`}>
                        {tr.confidence}
                      </span>
                      {tr.foundIn && (
                        <div className="rookie-term-source">
                          Found in: {tr.foundIn}
                          {tr.column && ` (column: ${tr.column})`}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Source Inventory */}
            {resolverAnalysis.sourceInventory && resolverAnalysis.sourceInventory.length > 0 && (
              <div className="rookie-phase-compact">
                <h4 className="rookie-phase-title-compact">
                  📊 Source Files Inventory ({resolverAnalysis.sourceInventory.length})
                </h4>
                <div className="rookie-source-inventory">
                  {resolverAnalysis.sourceInventory.map((inv: any, idx: number) => (
                    <div key={idx} className="rookie-inventory-item">
                      <div className="rookie-inventory-header">
                        <strong>{inv.file}</strong>
                        <span className="rookie-row-count">{inv.rowCount} rows</span>
                      </div>
                      <div className="rookie-inventory-details">
                        <div>📁 Origin: {inv.origin}</div>
                        <div>🎯 Feeds sections: {inv.feedsTargetSections?.join(', ') || 'Unknown'}</div>
                        <div>📋 Columns: {inv.columns?.length || 0}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Build Recipe Summary */}
            {resolverAnalysis.buildRecipe && (
              <div className="rookie-phase-compact">
                <h4 className="rookie-phase-title-compact">
                  📋 Build Recipe ({resolverAnalysis.buildRecipe.steps?.length || 0} steps)
                </h4>
                <div className="rookie-build-recipe-summary">
                  Build recipe created with {resolverAnalysis.buildRecipe.steps?.length || 0} executable steps
                </div>
              </div>
            )}

            {/* Source Mapping Visualizer */}
            {resolverAnalysis.sourceInventory && (
              <SourceMappingVisualizer
                resolverData={{
                  sourceInventory: resolverAnalysis.sourceInventory,
                  buildRecipe: resolverAnalysis.buildRecipe,
                }}
                targetHtml={aiAnalysis?.semanticHtml}
              />
            )}

            {/* Enhanced HTML Preview with Mappings */}
            {resolverAnalysis.buildRecipe?.steps?.length > 0 && (
              <div className="rookie-enhanced-preview-section">
                <h4 className="rookie-phase-title-compact">
                  🔍 Interactive Report Preview
                </h4>
                <p className="rookie-preview-hint">
                  {resolverAnalysis.enhancedHtml
                    ? 'Hover over cells with 🔗 icon to see source data mappings (file, column, operation, filters)'
                    : 'HTML preview (mappings visualization coming soon)'}
                </p>
                <div className="rookie-html-preview">
                  <div
                    className="rookie-html-preview-content"
                    dangerouslySetInnerHTML={{
                      __html: resolverAnalysis.enhancedHtml || aiAnalysis?.html || '<p>No preview available</p>'
                    }}
                  />
                </div>
                {resolverAnalysis.fromCache && (
                  <div style={{
                    marginTop: '10px',
                    padding: '10px',
                    background: '#2a2a1a',
                    border: '1px solid #665500',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: '#ffcc00'
                  }}>
                    ℹ️ This analysis used cached data. For best results with interactive hover tooltips,
                    click "🔄 Regenerate Analysis" below to generate fresh mappings with the latest format.
                  </div>
                )}
              </div>
            )}

            {/* Regenerate button */}
            <button
              type="button"
              className="rookie-regenerate-button"
              onClick={() => handleStartRecording(true)}
              style={{ marginTop: '15px' }}
            >
              🔄 Regenerate Analysis
            </button>
          </div>
        )}

        {/* Resolver error */}
        {resolverAnalysis && !resolverAnalysis.success && (
          <div className="rookie-ai-error">
            ❌ Resolver analysis failed: {resolverAnalysis.error}
          </div>
        )}
      </div>


      {/* Step 3: Build Plan */}
      <div className="rookie-step-section">
        <h3 className="rookie-step-title">Step 3: Generate Build Plan</h3>
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

        {/* Always show buttons */}
        {!navigationPlans && !isGeneratingPlan && (
          <div className="rookie-build-plan-buttons">
            <button
              type="button"
              className="rookie-start-research-button"
              onClick={handleGenerateNavigationPlan}
            >
              🤖 Generate Build Plan
            </button>
            <button
              type="button"
              className="rookie-load-plan-button"
              onClick={() => handleLoadSavedBuildPlan('build_plan_2026-02-08T13-25-31-445Z.json')}
              title="Load the saved build plan for testing"
            >
              📂 Load Last Plan (Test)
            </button>
          </div>
        )}

          {isGeneratingPlan && (
            <div className="rookie-ai-loading">
              <div className="rookie-spinner"></div>
              <p>AI is analyzing all resources and generating comprehensive build plan...</p>
            </div>
          )}

          {navigationPlans && (
            <>
              {/* Debug info */}
              <div style={{ display: 'none' }}>
                Success: {String(navigationPlans.success)}
                Steps: {navigationPlans.steps?.length || 0}
                Strategy: {navigationPlans.strategy ? 'Yes' : 'No'}
              </div>

              {navigationPlans.success && (
                <BuildPlanDisplay
                  plan={navigationPlans}
                  onExecute={() => handleExecutePlan(0)}
                  isExecuting={isExecuting && !executionResults}
                />
              )}

              {!navigationPlans.success && (
                <div className="rookie-build-plan-error">
                  ❌ Failed to generate build plan: {navigationPlans.error || 'Unknown error'}
                </div>
              )}
            </>
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
              {executionResults && (
                <div className="rookie-execution-results">
                  <h4 className="rookie-execution-title">
                    {executionResults.success ? '✅ Execution Complete' : '⚠️ Execution Completed with Notes'}
                  </h4>

                  <div className="rookie-execution-summary">
                    <div className="rookie-execution-stat-box">
                      <strong>Completed Steps:</strong> {executionResults.completedSteps || 0}
                    </div>
                    <div className="rookie-execution-stat-box">
                      <strong>Total Steps:</strong> {executionResults.totalSteps || 0}
                    </div>
                  </div>

                  {executionResults.message && (
                    <div className={executionResults.success ? 'rookie-execution-message' : 'rookie-execution-warning'}>
                      {executionResults.message}
                    </div>
                  )}

                  {executionResults.error && (
                    <div className="rookie-execution-note">
                      📝 Note: {executionResults.error}
                    </div>
                  )}

                  {/* Website Automation Results */}
                  {executionResults.websiteResults && executionResults.websiteResults.length > 0 && (
                    <div className="rookie-execution-phase">
                      <strong>🌐 Website Automation ({executionResults.websiteResults.length} steps)</strong>
                      {executionResults.websiteResults.map((stepResult: any, idx: number) => (
                        <div key={idx} className={`rookie-step-result ${stepResult.success ? 'success' : 'failed'}`}>
                          <div className="rookie-step-result-header">
                            <span className="rookie-step-result-number">Step {stepResult.step}</span>
                            <span className="rookie-step-result-action">{stepResult.action}</span>
                            <span className={`rookie-step-result-status ${stepResult.success ? 'success' : 'failed'}`}>
                              {stepResult.success ? '✓' : '✗'}
                            </span>
                          </div>
                          {stepResult.error && (
                            <div className="rookie-step-result-error">Error: {stepResult.error}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Data Processing Results */}
                  {executionResults.dataProcessingResult && (
                    <div className="rookie-execution-phase">
                      <strong>🔨 Data Processing ({executionResults.dataProcessingResult.stepsCompleted}/{executionResults.dataProcessingResult.totalSteps} steps)</strong>
                      <div className="rookie-processing-summary">
                        {executionResults.dataProcessingResult.success ? '✅ Complete' : '⚠️ Partial'}
                      </div>
                    </div>
                  )}

                  {/* Final Report Output */}
                  {executionResults.outputFile && (
                    <div className="rookie-final-output">
                      <strong>📊 Final Report:</strong>
                      <div className="rookie-output-file">
                        {executionResults.outputFile}
                      </div>
                      <button
                        type="button"
                        className="rookie-open-report-button"
                        onClick={() => {
                          (window as any).electron.invoke('shell:open-path', executionResults.outputFile);
                        }}
                      >
                        📂 Open Report
                      </button>
                    </div>
                  )}
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
