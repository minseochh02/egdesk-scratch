import React, { useState, useEffect, useRef } from 'react';
import {
  HashRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
  Navigate,
} from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faGlobe,
  faRobot,
  faHome,
  faShieldAlt,
  faCog,
} from './utils/fontAwesomeIcons';
import LandingPage from './components/LandingPage';
import { AIKeysManager } from './components/AIKeysManager';
import { HomepageEditor } from './components/HomepageEditor';
import SSLAnalyzer from './components/SSLAnalyzer/SSLAnalyzer';
import URLFileViewerPage from './components/HomepageEditor/URLFileViewerPage';
import ErrorBoundary from './components/ErrorBoundary';
import { EGBlogging } from './components/EGBlog';
import MCPServer from './components/MCPServer/MCPServer';
import './App.css';

function DebugModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [debugId, setDebugId] = useState('');
  const [debugPw, setDebugPw] = useState('');
  const [debugProxy, setDebugProxy] = useState('');
  const [debugTitle, setDebugTitle] = useState('');
  const [debugContent, setDebugContent] = useState('');
  const [debugTags, setDebugTags] = useState('');
  const [wooriId, setWooriId] = useState('');
  const [wooriPassword, setWooriPassword] = useState('');
  const [wooriProxy, setWooriProxy] = useState('');
  const [wooriGeminiKey, setWooriGeminiKey] = useState('');
  const [naverWithImageId, setNaverWithImageId] = useState('');
  const [naverWithImagePassword, setNaverWithImagePassword] = useState('');
  const [naverWithImageProxy, setNaverWithImageProxy] = useState('');
  const [naverWithImageTitle, setNaverWithImageTitle] = useState('AI-Generated Dog Image Blog Post');
  const [naverWithImageContent, setNaverWithImageContent] = useState('This post features an AI-generated dog image created using Gemini AI! The image was automatically generated and pasted into the blog editor.');
  const [naverWithImageTags, setNaverWithImageTags] = useState('#ai #dog #egdesk #automation');
  const [naverWithImagePrompt, setNaverWithImagePrompt] = useState('A cute golden retriever puppy playing in a sunny garden, high quality, photorealistic, professional photography style');
  const [includeDogImage, setIncludeDogImage] = useState(true);
  const [phpServerStatus, setPhpServerStatus] = useState('');
  const [mcpServerStatus, setMcpServerStatus] = useState('');
  const [mcpIsBuilt, setMcpIsBuilt] = useState(false);
  const [mcpIsConfigured, setMcpIsConfigured] = useState(false);

  // Check MCP server status on mount
  useEffect(() => {
    if (isOpen) {
      checkMcpStatus();
    }
  }, [isOpen]);

  const checkMcpStatus = async () => {
    try {
      const result = await (window as any).electron.mcpServer.getStatus();
      if (result?.success && result.status) {
        setMcpIsBuilt(result.status.isBuilt);
        setMcpIsConfigured(result.status.isConfigured);
      }
    } catch (e) {
      console.error('Failed to check MCP status:', e);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: '#1e1e1e',
        border: '1px solid #333',
        borderRadius: '8px',
        padding: '20px',
        maxWidth: '800px',
        width: '90%',
        maxHeight: '80vh',
        overflowY: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ color: '#fff', margin: 0 }}>Debug Panel</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#888',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Naver Blog Section */}
          <div>
            <h3 style={{ color: '#03c75a', marginBottom: '10px' }}>Naver Blog Automation</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <input
                type="text"
                placeholder="Naver ID"
                value={debugId}
                onChange={(e) => setDebugId(e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff' }}
              />
              <input
                type="password"
                placeholder="Naver Password"
                value={debugPw}
                onChange={(e) => setDebugPw(e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff' }}
              />
            </div>
            <input
              type="text"
              placeholder="Proxy (optional) - e.g. http://user:pass@host:port"
              value={debugProxy}
              onChange={(e) => setDebugProxy(e.target.value)}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff', width: '100%', marginBottom: '10px' }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <input
                type="text"
                placeholder="Title (optional)"
                value={debugTitle}
                onChange={(e) => setDebugTitle(e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff' }}
              />
              <input
                type="text"
                placeholder="Content (optional)"
                value={debugContent}
                onChange={(e) => setDebugContent(e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff' }}
              />
              <input
                type="text"
                placeholder="Tags (optional)"
                value={debugTags}
                onChange={(e) => setDebugTags(e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff' }}
              />
            </div>
            <button
              onClick={async () => {
                try {
                  const result = await (window as any).electron.debug.startAutomation(
                    debugId || undefined,
                    debugPw || undefined,
                    debugProxy || undefined,
                    debugTitle || undefined,
                    debugContent || undefined,
                    debugTags || undefined
                  );
                  if (!result?.success) {
                    console.error('Debug automation failed:', result?.error);
                    alert(`Automation failed${result?.error ? `: ${result.error}` : ''}`);
                  } else {
                    console.log('Naver blog automation completed successfully');
                    alert('Naver blog automation completed successfully!');
                  }
                } catch (e: any) {
                  console.error('Debug automation error:', e);
                  alert(`Automation error: ${e?.message || e}`);
                }
              }}
              style={{
                padding: '10px 20px',
                backgroundColor: '#03c75a',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Start Naver Blog Automation
            </button>
          </div>

          {/* Woori Section */}
          <div>
            <h3 style={{ color: '#FF5A4A', marginBottom: '10px' }}>Woori Bank Automation</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <input
                type="text"
                placeholder="Woori ID"
                value={wooriId}
                onChange={(e) => setWooriId(e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff' }}
              />
              <input
                type="password"
                placeholder="Woori Password"
                value={wooriPassword}
                onChange={(e) => setWooriPassword(e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff' }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <input
                type="text"
                placeholder="Proxy (optional)"
                value={wooriProxy}
                onChange={(e) => setWooriProxy(e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff' }}
              />
              <input
                type="password"
                placeholder="Gemini API Key (optional)"
                value={wooriGeminiKey}
                onChange={(e) => setWooriGeminiKey(e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff' }}
              />
            </div>
            <button
              onClick={async () => {
                try {
                  const result = await (window as any).electron.debug.startWooriAutomation(
                    wooriId || undefined,
                    wooriPassword || undefined,
                    wooriProxy || undefined,
                    wooriGeminiKey || undefined
                  );
                  if (!result?.success) {
                    console.error('Woori automation failed:', result?.error);
                    alert(`Woori automation failed${result?.error ? `: ${result.error}` : ''}`);
                  } else {
                    console.log('Woori automation result:', result);
                    alert('Woori automation completed successfully. Check console for AI analysis details.');
                  }
                } catch (e: any) {
                  console.error('Woori automation error:', e);
                  alert(`Woori automation error: ${e?.message || e}`);
                }
              }}
              style={{
                padding: '10px 20px',
                backgroundColor: '#FF5A4A',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Start Woori Bank Automation
            </button>
          </div>

          {/* Naver Blog with AI Image Section */}
          <div>
            <h3 style={{ color: '#FF6B35', marginBottom: '10px' }}>🐕 Naver Blog with AI-Generated Dog Image</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <input
                type="text"
                placeholder="Naver ID"
                value={naverWithImageId}
                onChange={(e) => setNaverWithImageId(e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff' }}
              />
              <input
                type="password"
                placeholder="Naver Password"
                value={naverWithImagePassword}
                onChange={(e) => setNaverWithImagePassword(e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff' }}
              />
            </div>
            <input
              type="text"
              placeholder="Proxy (optional) - e.g. http://user:pass@host:port"
              value={naverWithImageProxy}
              onChange={(e) => setNaverWithImageProxy(e.target.value)}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff', width: '100%', marginBottom: '10px' }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <input
                type="text"
                placeholder="Blog Title"
                value={naverWithImageTitle}
                onChange={(e) => setNaverWithImageTitle(e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff' }}
              />
              <input
                type="text"
                placeholder="Tags"
                value={naverWithImageTags}
                onChange={(e) => setNaverWithImageTags(e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="includeDogImage"
                  checked={includeDogImage}
                  onChange={(e) => setIncludeDogImage(e.target.checked)}
                  style={{ transform: 'scale(1.2)' }}
                />
                <label htmlFor="includeDogImage" style={{ color: '#fff', fontSize: '14px' }}>
                  Include Dog Image
                </label>
              </div>
            </div>
            <textarea
              placeholder="Blog Content"
              value={naverWithImageContent}
              onChange={(e) => setNaverWithImageContent(e.target.value)}
              rows={3}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff', width: '100%', marginBottom: '10px', resize: 'vertical' }}
            />
            <textarea
              placeholder="Dog Image Prompt (customize the AI-generated dog image)"
              value={naverWithImagePrompt}
              onChange={(e) => setNaverWithImagePrompt(e.target.value)}
              rows={2}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff', width: '100%', marginBottom: '10px', resize: 'vertical' }}
            />
            <div style={{ marginBottom: '10px', padding: '8px', backgroundColor: '#1a1a1a', borderRadius: '4px', fontSize: '12px', color: '#ccc' }}>
              <strong>ℹ️ Note:</strong> This feature uses the "egdesk" API key from your AI Keys Manager. Make sure you have a Google/Gemini API key configured with the name "egdesk".
            </div>
            <button
              onClick={async () => {
                try {
                  const result = await (window as any).electron.debug.startNaverBlogWithImage(
                    naverWithImageId || undefined,
                    naverWithImagePassword || undefined,
                    naverWithImageProxy || undefined,
                    naverWithImageTitle || undefined,
                    naverWithImageContent || undefined,
                    naverWithImageTags || undefined,
                    includeDogImage,
                    naverWithImagePrompt || undefined
                  );
                  if (!result?.success) {
                    console.error('Naver Blog with image automation failed:', result?.error);
                    alert(`Naver Blog with image automation failed${result?.error ? `: ${result.error}` : ''}`);
                  } else {
                    console.log('Naver Blog with image automation completed successfully');
                    const imageStatus = result.imageGenerated ? ' (with AI-generated dog image)' : ' (no image generated)';
                    alert(`Naver Blog with image automation completed successfully${imageStatus}!`);
                  }
                } catch (e: any) {
                  console.error('Naver Blog with image automation error:', e);
                  alert(`Naver Blog with image automation error: ${e?.message || e}`);
                }
              }}
              style={{
                padding: '10px 20px',
                backgroundColor: '#FF6B35',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              🐕 Start Naver Blog with AI Dog Image
            </button>
          </div>



          {/* PHP Server Section */}
          <div>
              <h3 style={{ color: '#9C27B0', marginBottom: '10px' }}>🚀 PHP Server</h3>
              <div style={{ marginBottom: '10px', padding: '8px', backgroundColor: '#1a1a1a', borderRadius: '4px', fontSize: '12px', color: '#ccc' }}>
                <strong>ℹ️ Note:</strong> Start a PHP server with /hello and /gmail endpoints. The /gmail endpoint calls the Electron app to fetch Gmail messages. Access from any device on your network!
              </div>
            {phpServerStatus && (
              <div style={{ 
                marginBottom: '10px', 
                padding: '8px', 
                backgroundColor: phpServerStatus.includes('Success') || phpServerStatus.includes('Running') ? '#1a3a1a' : '#3a1a1a', 
                borderRadius: '4px', 
                fontSize: '12px', 
                color: phpServerStatus.includes('Success') || phpServerStatus.includes('Running') ? '#4CAF50' : '#f44336',
                border: `1px solid ${phpServerStatus.includes('Success') || phpServerStatus.includes('Running') ? '#4CAF50' : '#f44336'}`
              }}>
                {phpServerStatus}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  try {
                    setPhpServerStatus('Starting PHP server...');
                    const result = await (window as any).electron.phpServer.startServer(8080);
                    if (result?.success) {
                      setPhpServerStatus(`Success! Server running at ${result.url}\nHello endpoint: ${result.helloUrl}\nLocal IP: ${result.localIP}`);
                    } else {
                      setPhpServerStatus(`Failed: ${result?.error || 'Unknown error'}`);
                    }
                  } catch (e: any) {
                    setPhpServerStatus(`Error: ${e?.message || e}`);
                    console.error('PHP server start error:', e);
                  }
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#9C27B0',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  flex: 1,
                  minWidth: '120px'
                }}
              >
                🚀 Start Server
              </button>
              <button
                type="button"
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  try {
                    setPhpServerStatus('Stopping PHP server...');
                    const result = await (window as any).electron.phpServer.stopServer();
                    if (result?.success) {
                      setPhpServerStatus('Server stopped successfully');
                    } else {
                      setPhpServerStatus(`Failed to stop: ${result?.error || 'Unknown error'}`);
                    }
                  } catch (e: any) {
                    setPhpServerStatus(`Error: ${e?.message || e}`);
                    console.error('PHP server stop error:', e);
                  }
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#F44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  flex: 1,
                  minWidth: '120px'
                }}
              >
                🛑 Stop Server
              </button>
              <button
                type="button"
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  try {
                    setPhpServerStatus('Testing hello endpoint...');
                    const result = await (window as any).electron.phpServer.testHelloEndpoint();
                    if (result?.success) {
                      setPhpServerStatus(`Hello endpoint test: ${result.message}`);
                    } else {
                      setPhpServerStatus(`Hello test failed: ${result?.error || 'Unknown error'}`);
                    }
                  } catch (e: any) {
                    setPhpServerStatus(`Error: ${e?.message || e}`);
                    console.error('PHP server test error:', e);
                  }
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#FF9800',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  flex: 1,
                  minWidth: '120px'
                }}
              >
                🧪 Test Hello
              </button>
              <button
                type="button"
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  try {
                    setPhpServerStatus('Testing Gmail endpoint...');
                    const result = await (window as any).electron.phpServer.gmailEndpoint();
                    if (result?.success) {
                      setPhpServerStatus(`Gmail endpoint: ${result.message} (${result.data?.count || 0} messages)`);
                      console.log('Gmail endpoint result:', result);
                    } else {
                      setPhpServerStatus(`Gmail endpoint failed: ${result?.error || 'Unknown error'}`);
                    }
                  } catch (e: any) {
                    setPhpServerStatus(`Error: ${e?.message || e}`);
                    console.error('Gmail endpoint test error:', e);
                  }
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#EA4335',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  flex: 1,
                  minWidth: '120px'
                }}
              >
                📧 Test Gmail
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setPhpServerStatus('');
                }}
                style={{
                  padding: '10px 15px',
                  backgroundColor: '#666',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Clear
              </button>
            </div>
          </div>


          {/* MCP Server for Claude Desktop Section */}
          <div>
            <h3 style={{ color: '#7C3AED', marginBottom: '10px' }}>🤖 MCP Server for Claude Desktop</h3>
            <div style={{ marginBottom: '10px', padding: '8px', backgroundColor: '#1a1a1a', borderRadius: '4px', fontSize: '12px', color: '#ccc' }}>
              <strong>ℹ️ Note:</strong> Enable your Gmail data in Claude Desktop using the Model Context Protocol (MCP). Start the PHP server first, then enable this to allow Claude to access your Gmail database.
            </div>
            
            {/* Status Display */}
            <div style={{ 
              marginBottom: '10px', 
              padding: '10px', 
              backgroundColor: '#2a2a2a', 
              borderRadius: '4px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#999' }}>Server Built:</span>
                <span style={{ 
                  fontSize: '12px', 
                  fontWeight: 'bold',
                  color: mcpIsBuilt ? '#4CAF50' : '#f44336' 
                }}>
                  {mcpIsBuilt ? '✓ Yes' : '✗ No'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#999' }}>Claude Configured:</span>
                <span style={{ 
                  fontSize: '12px', 
                  fontWeight: 'bold',
                  color: mcpIsConfigured ? '#4CAF50' : '#f44336' 
                }}>
                  {mcpIsConfigured ? '✓ Yes' : '✗ No'}
                </span>
              </div>
            </div>

            {mcpServerStatus && (
              <div style={{ 
                marginBottom: '10px', 
                padding: '8px', 
                backgroundColor: mcpServerStatus.includes('Success') || mcpServerStatus.includes('enabled') ? '#1a3a1a' : '#3a1a1a', 
                borderRadius: '4px', 
                fontSize: '12px', 
                color: mcpServerStatus.includes('Success') || mcpServerStatus.includes('enabled') ? '#4CAF50' : '#f44336',
                border: `1px solid ${mcpServerStatus.includes('Success') || mcpServerStatus.includes('enabled') ? '#4CAF50' : '#f44336'}`
              }}>
                {mcpServerStatus}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  try {
                    setMcpServerStatus('Building and configuring MCP server...');
                    
                    // Build the server
                    const buildResult = await (window as any).electron.mcpServer.build();
                    if (!buildResult?.success) {
                      throw new Error(`Build failed: ${buildResult?.error || 'Unknown error'}`);
                    }
                    
                    // Configure Claude Desktop
                    const configResult = await (window as any).electron.mcpServer.configureClaude();
                    if (!configResult?.success) {
                      throw new Error(`Configuration failed: ${configResult?.error || 'Unknown error'}`);
                    }
                    
                    setMcpServerStatus('✓ Success! MCP server enabled in Claude Desktop. Please restart Claude Desktop to use it.');
                    await checkMcpStatus();
                  } catch (e: any) {
                    setMcpServerStatus(`Error: ${e?.message || e}`);
                    console.error('MCP server enable error:', e);
                  }
                }}
                disabled={mcpIsConfigured}
                style={{
                  padding: '10px 20px',
                  backgroundColor: mcpIsConfigured ? '#666' : '#7C3AED',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: mcpIsConfigured ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  flex: 1,
                  minWidth: '120px'
                }}
              >
                {mcpIsConfigured ? '✓ Enabled' : '🤖 Enable in Claude'}
              </button>
              <button
                type="button"
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  try {
                    setMcpServerStatus('Removing from Claude Desktop...');
                    const result = await (window as any).electron.mcpServer.unconfigureClaude();
                    if (result?.success) {
                      setMcpServerStatus('✓ Removed from Claude Desktop. Restart Claude Desktop to apply.');
                      await checkMcpStatus();
                    } else {
                      setMcpServerStatus(`Failed: ${result?.error || 'Unknown error'}`);
                    }
                  } catch (e: any) {
                    setMcpServerStatus(`Error: ${e?.message || e}`);
                    console.error('MCP server disable error:', e);
                  }
                }}
                disabled={!mcpIsConfigured}
                style={{
                  padding: '10px 20px',
                  backgroundColor: !mcpIsConfigured ? '#666' : '#F44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: !mcpIsConfigured ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  flex: 1,
                  minWidth: '120px'
                }}
              >
                🗑️ Disable
              </button>
              <button
                type="button"
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  await checkMcpStatus();
                  setMcpServerStatus('Status refreshed');
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#FF9800',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  flex: 1,
                  minWidth: '120px'
                }}
              >
                🔄 Refresh Status
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMcpServerStatus('');
                }}
                style={{
                  padding: '10px 15px',
                  backgroundColor: '#666',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Clear
              </button>
            </div>

            {/* Instructions */}
            <div style={{ 
              marginTop: '10px', 
              padding: '10px', 
              backgroundColor: '#2a2a2a', 
              borderRadius: '4px',
              fontSize: '11px',
              color: '#aaa'
            }}>
              <strong style={{ color: '#7C3AED' }}>How to use:</strong>
              <ol style={{ margin: '5px 0 0 0', paddingLeft: '20px' }}>
                <li>Start the PHP server above (🚀 Start Server)</li>
                <li>Fetch some Gmail data using the Gmail Dashboard in MCP Server section</li>
                <li>Click "Enable in Claude" button</li>
                <li>Restart Claude Desktop application</li>
                <li>Ask Claude: "List all Gmail users in the database"</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NavigationBar({ showDebugModal, setShowDebugModal }: { showDebugModal: boolean; setShowDebugModal: (show: boolean) => void }) {
  const location = useLocation();
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const checkWidth = () => {
      setIsNarrow(window.innerWidth < 600);
    };
    
    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  return (
    <div className={`navigation-bar ${isNarrow ? 'narrow' : ''}`}>
      <nav className="nav-links">
        <Link
          to="/"
          className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faHome} />
          {!isNarrow && <span>홈</span>}
        </Link>
        <Link
          to="/homepage-editor"
          className={`nav-link ${location.pathname === '/homepage-editor' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faCog} />
          {!isNarrow && <span>EG Coding</span>}
        </Link>
        {/* Legacy BlogManager navigation - replaced by Blog Connector */}
        {/* <Link
          to="/blog-manager"
          className={`nav-link ${location.pathname === '/blog-manager' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faGlobe} />
          {!isNarrow && <span>EG Blogging</span>}
        </Link> */}
        <Link
          to="/blog-connector"
          className={`nav-link ${location.pathname === '/blog-connector' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faGlobe} />
          {!isNarrow && <span>EG Blogging</span>}
        </Link>
        <Link
          to="/ssl-analyzer"
          className={`nav-link ${location.pathname === '/ssl-analyzer' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faShieldAlt} />
          {!isNarrow && <span>EG SSL-Checker</span>}
        </Link>
        <Link
          to="/ai-keys"
          className={`nav-link ${location.pathname === '/ai-keys' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faRobot} />
          {!isNarrow && <span>API 키 관리</span>}
        </Link>
        <button
          className="nav-link"
          onClick={() => setShowDebugModal(true)}
          style={{ cursor: 'pointer' }}
          title="Open Debug Panel"
        >
          <FontAwesomeIcon icon={faRobot} />
          {!isNarrow && <span>Debug</span>}
        </button>

      </nav>
    </div>
  );
}

function RouteWindowBoundsManager() {
  const location = useLocation();
  const originalBoundsRef = useRef<any | null>(null);
  const wasInHomepageEditorRef = useRef<boolean>(false);

  useEffect(() => {
    (async () => {
      const isInHomepageEditor = location.pathname.startsWith('/homepage-editor');
      if (isInHomepageEditor && !wasInHomepageEditorRef.current) {
        try {
          const result = await window.electron.mainWindow.getBounds();
          if (result?.success && result.bounds) {
            originalBoundsRef.current = result.bounds;
          }
        } catch (e) {
          console.warn('Failed to capture main window bounds on enter:', e);
        }
        wasInHomepageEditorRef.current = true;
      }

      if (!isInHomepageEditor && wasInHomepageEditorRef.current) {
        try {
          // Close any localhost preview windows opened by AI Chat
          try {
            const list = await (window as any).electron.browserWindow.getAllLocalhostWindows();
            if (list?.success && Array.isArray(list.windows)) {
              for (const win of list.windows) {
                try {
                  await (window as any).electron.browserWindow.closeWindow(win.windowId);
                } catch (e) {
                  console.warn('Failed to close localhost window:', e);
                }
              }
            }
          } catch (e) {
            console.warn('Failed to enumerate localhost windows:', e);
          }

          const bounds = originalBoundsRef.current;
          if (bounds) {
            await window.electron.mainWindow.setBounds(bounds);
          }
        } catch (e) {
          console.warn('Failed to restore main window bounds on leave:', e);
        }
        wasInHomepageEditorRef.current = false;
        originalBoundsRef.current = null;
      }
    })();
  }, [location.pathname]);

  return null;
}

export default function App() {
  const [showDebugModal, setShowDebugModal] = useState(false);

  return (
    <Router>
      <RouteWindowBoundsManager />
      <div className="app-container">
        <NavigationBar showDebugModal={showDebugModal} setShowDebugModal={setShowDebugModal} />
        <DebugModal isOpen={showDebugModal} onClose={() => setShowDebugModal(false)} />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/index.html" element={<LandingPage />} />
            <Route path="/viewer" element={<URLFileViewerPage />} />
            <Route 
              path="/blog-connector" 
              element={
                <ErrorBoundary>
                  <EGBlogging />
                </ErrorBoundary>
              } 
            />
            <Route path="/ai-keys" element={<AIKeysManager />} />
            <Route path="/homepage-editor" element={<HomepageEditor />} />
            <Route path="/ssl-analyzer" element={<SSLAnalyzer />} />
            <Route path="/mcp-server" element={<MCPServer />} />
            
            {/* Fallback to home for unknown routes */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
