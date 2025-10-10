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
  const [naverClientId, setNaverClientId] = useState('');
  const [naverClientSecret, setNaverClientSecret] = useState('');
  const [naverLoginStatus, setNaverLoginStatus] = useState('');
  const [chromeLaunchStatus, setChromeLaunchStatus] = useState('');
  const [pasteTestStatus, setPasteTestStatus] = useState('');
  const [phpServerStatus, setPhpServerStatus] = useState('');
  const [googleAuthStatus, setGoogleAuthStatus] = useState('');
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [gmailStatus, setGmailStatus] = useState('');
  const [gmailMessages, setGmailMessages] = useState<any[]>([]);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [tunnelStatus, setTunnelStatus] = useState('');
  const [tunnelUrl, setTunnelUrl] = useState('');
  const [isTunnelRunning, setIsTunnelRunning] = useState(false);

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

          {/* Naver OAuth Login Section */}
          <div>
            <h3 style={{ color: '#03c75a', marginBottom: '10px' }}>🔐 Naver OAuth Login (API)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <input
                type="text"
                placeholder="Naver Client ID"
                value={naverClientId}
                onChange={(e) => setNaverClientId(e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff' }}
              />
              <input
                type="password"
                placeholder="Naver Client Secret"
                value={naverClientSecret}
                onChange={(e) => setNaverClientSecret(e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff' }}
              />
            </div>
            <div style={{ marginBottom: '10px', padding: '8px', backgroundColor: '#1a1a1a', borderRadius: '4px', fontSize: '12px', color: '#ccc' }}>
              <strong>ℹ️ Note:</strong> Get your Client ID and Secret from <a href="https://developers.naver.com" target="_blank" rel="noopener noreferrer" style={{ color: '#03c75a' }}>Naver Developer Center</a>. 
              Set callback URL to: <code style={{ backgroundColor: '#333', padding: '2px 4px', borderRadius: '2px' }}>http://localhost:1212/auth/naver/callback</code>
            </div>
            {naverLoginStatus && (
              <div style={{ 
                marginBottom: '10px', 
                padding: '8px', 
                backgroundColor: naverLoginStatus.includes('Success') ? '#1a3a1a' : '#3a1a1a', 
                borderRadius: '4px', 
                fontSize: '12px', 
                color: naverLoginStatus.includes('Success') ? '#4CAF50' : '#f44336',
                border: `1px solid ${naverLoginStatus.includes('Success') ? '#4CAF50' : '#f44336'}`
              }}>
                {naverLoginStatus}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={async () => {
                  if (!naverClientId || !naverClientSecret) {
                    alert('Please enter both Client ID and Client Secret');
                    return;
                  }
                  try {
                    setNaverLoginStatus('Starting Naver OAuth login...');
                    const result = await (window as any).electron.debug.startNaverOAuthLogin(
                      naverClientId,
                      naverClientSecret
                    );
                    if (result?.success) {
                      setNaverLoginStatus(`Success! User: ${result.userInfo?.name || 'Unknown'} (${result.userInfo?.email || 'No email'})`);
                    } else {
                      setNaverLoginStatus(`Failed: ${result?.error || 'Unknown error'}`);
                    }
                  } catch (e: any) {
                    setNaverLoginStatus(`Error: ${e?.message || e}`);
                    console.error('Naver OAuth login error:', e);
                  }
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#03c75a',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  flex: 1
                }}
              >
                🔐 Start Naver OAuth Login
              </button>
              <button
                onClick={() => setNaverLoginStatus('')}
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

          {/* Chrome Launch Section */}
          <div>
            <h3 style={{ color: '#4285f4', marginBottom: '10px' }}>🌐 Launch Chrome for Testing</h3>
            <div style={{ marginBottom: '10px', padding: '8px', backgroundColor: '#1a1a1a', borderRadius: '4px', fontSize: '12px', color: '#ccc' }}>
              <strong>ℹ️ Note:</strong> This will launch Chrome and navigate to Naver Blog write page for manual testing and debugging.
            </div>
            {chromeLaunchStatus && (
              <div style={{ 
                marginBottom: '10px', 
                padding: '8px', 
                backgroundColor: chromeLaunchStatus.includes('Success') ? '#1a3a1a' : '#3a1a1a', 
                borderRadius: '4px', 
                fontSize: '12px', 
                color: chromeLaunchStatus.includes('Success') ? '#4CAF50' : '#f44336',
                border: `1px solid ${chromeLaunchStatus.includes('Success') ? '#4CAF50' : '#f44336'}`
              }}>
                {chromeLaunchStatus}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={async () => {
                  try {
                    setChromeLaunchStatus('Launching Chrome...');
                    const result = await (window as any).electron.debug.launchChrome();
                    if (result?.success) {
                      setChromeLaunchStatus('Success! Chrome launched and navigated to Naver Blog write page.');
                    } else {
                      setChromeLaunchStatus(`Failed: ${result?.error || 'Unknown error'}`);
                    }
                  } catch (e: any) {
                    setChromeLaunchStatus(`Error: ${e?.message || e}`);
                    console.error('Chrome launch error:', e);
                  }
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#4285f4',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  flex: 1
                }}
              >
                🌐 Launch Chrome for Testing
              </button>
              <button
                onClick={() => setChromeLaunchStatus('')}
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

          {/* Paste Component Test Section */}
          <div>
            <h3 style={{ color: '#FF9800', marginBottom: '10px' }}>🧪 Test Paste Component</h3>
            <div style={{ marginBottom: '10px', padding: '8px', backgroundColor: '#1a1a1a', borderRadius: '4px', fontSize: '12px', color: '#ccc' }}>
              <strong>ℹ️ Note:</strong> This will test the paste component functionality on Naver Blog. It will check if left/right clicks work, if context menus appear, and if paste options are available. Check the console for detailed results.
            </div>
            {pasteTestStatus && (
              <div style={{ 
                marginBottom: '10px', 
                padding: '8px', 
                backgroundColor: pasteTestStatus.includes('Success') ? '#1a3a1a' : '#3a1a1a', 
                borderRadius: '4px', 
                fontSize: '12px', 
                color: pasteTestStatus.includes('Success') ? '#4CAF50' : '#f44336',
                border: `1px solid ${pasteTestStatus.includes('Success') ? '#4CAF50' : '#f44336'}`
              }}>
                {pasteTestStatus}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={async () => {
                  try {
                    setPasteTestStatus('Starting paste component test...');
                    const result = await (window as any).electron.debug.testPasteComponent();
                    if (result?.success) {
                      setPasteTestStatus(`Success! ${result.message} Check console for detailed results.`);
                      console.log('Paste test details:', result.details);
                    } else {
                      setPasteTestStatus(`Failed: ${result?.error || 'Unknown error'}`);
                    }
                  } catch (e: any) {
                    setPasteTestStatus(`Error: ${e?.message || e}`);
                    console.error('Paste component test error:', e);
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
                  flex: 1
                }}
              >
                🧪 Test Paste Component
              </button>
              <button
                onClick={() => setPasteTestStatus('')}
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

          {/* Local Tunnel Section */}
          <div>
            <h3 style={{ color: '#00BCD4', marginBottom: '10px' }}>🌐 Create Local Tunnel</h3>
            <div style={{ marginBottom: '10px', padding: '8px', backgroundColor: '#1a1a1a', borderRadius: '4px', fontSize: '12px', color: '#ccc' }}>
              <strong>ℹ️ Note:</strong> Create a public tunnel to your local server. This allows access from any device on the internet using a public URL. No signup required!
            </div>
            {tunnelStatus && (
              <div style={{ 
                marginBottom: '10px', 
                padding: '8px', 
                backgroundColor: tunnelStatus.includes('Success') || tunnelStatus.includes('Running') ? '#1a3a1a' : '#3a1a1a', 
                borderRadius: '4px', 
                fontSize: '12px', 
                color: tunnelStatus.includes('Success') || tunnelStatus.includes('Running') ? '#4CAF50' : '#f44336',
                border: `1px solid ${tunnelStatus.includes('Success') || tunnelStatus.includes('Running') ? '#4CAF50' : '#f44336'}`
              }}>
                {tunnelStatus}
              </div>
            )}
            {tunnelUrl && (
              <div style={{ 
                marginBottom: '10px', 
                padding: '12px', 
                backgroundColor: '#0a2a0a', 
                borderRadius: '4px', 
                fontSize: '14px', 
                color: '#4CAF50',
                border: '1px solid #4CAF50',
                wordBreak: 'break-all'
              }}>
                <strong>🌐 Public URL:</strong> <a href={tunnelUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#4CAF50', textDecoration: 'underline' }}>{tunnelUrl}</a>
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  try {
                    setTunnelStatus('Starting tunnel...');
                    const result = await (window as any).electron.tunnel.start(8080);
                    if (result?.success) {
                      setTunnelStatus(`Success! Tunnel created`);
                      setTunnelUrl(result.url);
                      setIsTunnelRunning(true);
                    } else {
                      setTunnelStatus(`Failed: ${result?.error || 'Unknown error'}`);
                      setTunnelUrl('');
                      setIsTunnelRunning(false);
                    }
                  } catch (e: any) {
                    setTunnelStatus(`Error: ${e?.message || e}`);
                    setTunnelUrl('');
                    setIsTunnelRunning(false);
                    console.error('Tunnel start error:', e);
                  }
                }}
                disabled={isTunnelRunning}
                style={{
                  padding: '10px 20px',
                  backgroundColor: isTunnelRunning ? '#666' : '#00BCD4',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isTunnelRunning ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  flex: 1,
                  minWidth: '120px'
                }}
              >
                {isTunnelRunning ? '🔄 Creating...' : '🌐 Create Tunnel'}
              </button>
              <button
                type="button"
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  try {
                    setTunnelStatus('Stopping tunnel...');
                    const result = await (window as any).electron.tunnel.stop();
                    if (result?.success) {
                      setTunnelStatus('Tunnel stopped successfully');
                      setTunnelUrl('');
                      setIsTunnelRunning(false);
                    } else {
                      setTunnelStatus(`Failed to stop: ${result?.error || 'Unknown error'}`);
                    }
                  } catch (e: any) {
                    setTunnelStatus(`Error: ${e?.message || e}`);
                    console.error('Tunnel stop error:', e);
                  }
                }}
                disabled={!isTunnelRunning}
                style={{
                  padding: '10px 20px',
                  backgroundColor: !isTunnelRunning ? '#666' : '#F44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: !isTunnelRunning ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  flex: 1,
                  minWidth: '120px'
                }}
              >
                🛑 Stop Tunnel
              </button>
              <button
                type="button"
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  try {
                    setTunnelStatus('Checking tunnel status...');
                    const result = await (window as any).electron.tunnel.status();
                    if (result?.success) {
                      if (result.isRunning) {
                        setTunnelStatus(`Tunnel is running`);
                        setTunnelUrl(result.url || '');
                        setIsTunnelRunning(true);
                      } else {
                        setTunnelStatus(`Tunnel is not running`);
                        setTunnelUrl('');
                        setIsTunnelRunning(false);
                      }
                    } else {
                      setTunnelStatus(`Status check failed: ${result?.error || 'Unknown error'}`);
                    }
                  } catch (e: any) {
                    setTunnelStatus(`Error: ${e?.message || e}`);
                    console.error('Tunnel status error:', e);
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
                🔍 Check Status
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setTunnelStatus('');
                  setTunnelUrl('');
                  setIsTunnelRunning(false);
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

          {/* Google OAuth Sign-In Section */}
          <div>
            <h3 style={{ color: '#4285f4', marginBottom: '10px' }}>🔐 Google OAuth Sign-In (with Gmail)</h3>
            <div style={{ marginBottom: '10px', padding: '8px', backgroundColor: '#1a1a1a', borderRadius: '4px', fontSize: '12px', color: '#ccc' }}>
              <strong>ℹ️ Note:</strong> Sign in with your Google account to access Gmail API. This includes permissions to read, send, and manage your Gmail messages. Uses OAuth2 credentials from the root folder.
            </div>
            {googleAuthStatus && (
              <div style={{ 
                marginBottom: '10px', 
                padding: '8px', 
                backgroundColor: googleAuthStatus.includes('Success') || googleAuthStatus.includes('signed in') ? '#1a3a1a' : '#3a1a1a', 
                borderRadius: '4px', 
                fontSize: '12px', 
                color: googleAuthStatus.includes('Success') || googleAuthStatus.includes('signed in') ? '#4CAF50' : '#f44336',
                border: `1px solid ${googleAuthStatus.includes('Success') || googleAuthStatus.includes('signed in') ? '#4CAF50' : '#f44336'}`
              }}>
                {googleAuthStatus}
              </div>
            )}
            {googleUser && (
              <div style={{ 
                marginBottom: '10px', 
                padding: '12px', 
                backgroundColor: '#1a3a1a', 
                borderRadius: '4px', 
                fontSize: '13px', 
                color: '#4CAF50',
                border: '1px solid #4CAF50',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                {googleUser.picture && (
                  <img 
                    src={googleUser.picture} 
                    alt="Profile" 
                    style={{ 
                      width: '40px', 
                      height: '40px', 
                      borderRadius: '50%',
                      border: '2px solid #4CAF50'
                    }} 
                  />
                )}
                <div>
                  <div style={{ fontWeight: 'bold' }}>{googleUser.name}</div>
                  <div style={{ fontSize: '11px', opacity: 0.8 }}>{googleUser.email}</div>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={async () => {
                  try {
                    setGoogleAuthStatus('Starting Google OAuth sign-in...');
                    const result = await (window as any).electron.googleAuth.signIn();
                    if (result?.success && result.user) {
                      setGoogleUser(result.user);
                      setGoogleAuthStatus(`Success! Signed in as ${result.user.name}`);
                      console.log('Google tokens:', result.tokens);
                    } else {
                      setGoogleAuthStatus(`Failed: ${result?.error || 'Unknown error'}`);
                      setGoogleUser(null);
                    }
                  } catch (e: any) {
                    setGoogleAuthStatus(`Error: ${e?.message || e}`);
                    setGoogleUser(null);
                    console.error('Google OAuth sign-in error:', e);
                  }
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#4285f4',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  flex: 1
                }}
              >
                🔐 Sign in with Google
              </button>
              <button
                onClick={async () => {
                  try {
                    setGoogleAuthStatus('Signing out...');
                    const result = await (window as any).electron.googleAuth.signOut();
                    if (result?.success) {
                      setGoogleAuthStatus('Successfully signed out');
                      setGoogleUser(null);
                    } else {
                      setGoogleAuthStatus(`Sign out failed: ${result?.error || 'Unknown error'}`);
                    }
                  } catch (e: any) {
                    setGoogleAuthStatus(`Error: ${e?.message || e}`);
                    console.error('Google OAuth sign-out error:', e);
                  }
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Sign Out
              </button>
              <button
                onClick={() => {
                  setGoogleAuthStatus('');
                  setGoogleUser(null);
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

          {/* Gmail Section */}
          {googleUser && (
            <div>
              <h3 style={{ color: '#EA4335', marginBottom: '10px' }}>📧 Gmail API</h3>
              <div style={{ marginBottom: '10px', padding: '8px', backgroundColor: '#1a1a1a', borderRadius: '4px', fontSize: '12px', color: '#ccc' }}>
                <strong>ℹ️ Note:</strong> Access your Gmail messages and send emails. You must be signed in with Google to use these features.
              </div>
              {gmailStatus && (
                <div style={{ 
                  marginBottom: '10px', 
                  padding: '8px', 
                  backgroundColor: gmailStatus.includes('Success') || gmailStatus.includes('sent') ? '#1a3a1a' : '#3a1a1a', 
                  borderRadius: '4px', 
                  fontSize: '12px', 
                  color: gmailStatus.includes('Success') || gmailStatus.includes('sent') ? '#4CAF50' : '#f44336',
                  border: `1px solid ${gmailStatus.includes('Success') || gmailStatus.includes('sent') ? '#4CAF50' : '#f44336'}`
                }}>
                  {gmailStatus}
                </div>
              )}

              {/* List Messages Section */}
              <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#2a2a2a', borderRadius: '4px' }}>
                <h4 style={{ color: '#fff', marginTop: 0, marginBottom: '10px', fontSize: '14px' }}>📬 Recent Messages</h4>
                <button
                  onClick={async () => {
                    try {
                      setGmailStatus('Fetching recent messages...');
                      const result = await (window as any).electron.gmail.listMessages(10);
                      if (result?.success) {
                        setGmailMessages(result.messages || []);
                        setGmailStatus(`Success! Found ${result.messages?.length || 0} messages (Total: ${result.resultSizeEstimate || 0})`);
                      } else {
                        setGmailStatus(`Failed: ${result?.error || 'Unknown error'}`);
                        setGmailMessages([]);
                      }
                    } catch (e: any) {
                      setGmailStatus(`Error: ${e?.message || e}`);
                      setGmailMessages([]);
                      console.error('Gmail list messages error:', e);
                    }
                  }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#EA4335',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '12px'
                  }}
                >
                  📬 Fetch Recent Messages
                </button>
                {gmailMessages.length > 0 && (
                  <div style={{ marginTop: '10px', maxHeight: '150px', overflowY: 'auto' }}>
                    {gmailMessages.map((msg, idx) => (
                      <div key={msg.id || idx} style={{ 
                        padding: '6px', 
                        backgroundColor: '#1a1a1a', 
                        borderRadius: '3px', 
                        marginBottom: '5px',
                        fontSize: '11px',
                        color: '#ccc'
                      }}>
                        ID: {msg.id} | Thread: {msg.threadId}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Send Email Section */}
              <div style={{ padding: '10px', backgroundColor: '#2a2a2a', borderRadius: '4px' }}>
                <h4 style={{ color: '#fff', marginTop: 0, marginBottom: '10px', fontSize: '14px' }}>📤 Send Email</h4>
                <input
                  type="email"
                  placeholder="To (email address)"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#1a1a1a', color: '#fff', width: '100%', marginBottom: '8px' }}
                />
                <input
                  type="text"
                  placeholder="Subject"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#1a1a1a', color: '#fff', width: '100%', marginBottom: '8px' }}
                />
                <textarea
                  placeholder="Email body"
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={4}
                  style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#1a1a1a', color: '#fff', width: '100%', marginBottom: '8px', resize: 'vertical' }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={async () => {
                      if (!emailTo || !emailSubject || !emailBody) {
                        setGmailStatus('Please fill in all email fields');
                        return;
                      }
                      try {
                        setGmailStatus('Sending email...');
                        const result = await (window as any).electron.gmail.sendEmail(emailTo, emailSubject, emailBody);
                        if (result?.success) {
                          setGmailStatus(`Success! Email sent. Message ID: ${result.messageId}`);
                          // Clear form
                          setEmailTo('');
                          setEmailSubject('');
                          setEmailBody('');
                        } else {
                          setGmailStatus(`Failed: ${result?.error || 'Unknown error'}`);
                        }
                      } catch (e: any) {
                        setGmailStatus(`Error: ${e?.message || e}`);
                        console.error('Gmail send email error:', e);
                      }
                    }}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#34A853',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '12px',
                      flex: 1
                    }}
                  >
                    📤 Send Email
                  </button>
                  <button
                    onClick={() => {
                      setGmailStatus('');
                      setGmailMessages([]);
                      setEmailTo('');
                      setEmailSubject('');
                      setEmailBody('');
                    }}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#666',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '12px'
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
          )}
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
