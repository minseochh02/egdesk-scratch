import React, { useState } from 'react';
import { revertService } from '../../services/revertService';

/**
 * Simple test component to verify revert functionality
 * This can be used during development to test the revert features
 */
const RevertTest: React.FC = () => {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testFindBackups = async () => {
    setLoading(true);
    addResult('🔍 Testing backup discovery...');

    try {
      // Test with a sample file path (you can adjust this to your project structure)
      const sampleFilePath = '/Users/minseocha/Desktop/projects/태화트랜스/Taehwa_demo/www/index.php';
      
      const backups = await revertService.findBackupsForFile(sampleFilePath);
      
      if (backups.length > 0) {
        addResult(`✅ Found ${backups.length} backup(s) for ${sampleFilePath}`);
        backups.forEach((backup, index) => {
          addResult(`   ${index + 1}. ${backup.backupFilePath} (${backup.timestamp.toLocaleString()}) - ${backup.isValid ? 'Valid' : 'Invalid'}`);
        });
      } else {
        addResult(`ℹ️ No backups found for ${sampleFilePath}`);
      }
    } catch (error) {
      addResult(`❌ Error testing backup discovery: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const testFindAllBackups = async () => {
    setLoading(true);
    addResult('🔍 Testing project-wide backup discovery...');

    try {
      const projectRoot = '/Users/minseocha/Desktop/projects/태화트랜스/Taehwa_demo';
      
      const allBackups = await revertService.findAllBackups(projectRoot);
      
      addResult(`✅ Found backups for ${allBackups.size} file(s) in project`);
      
      let totalBackups = 0;
      for (const [originalFile, backups] of allBackups.entries()) {
        totalBackups += backups.length;
        addResult(`   📄 ${originalFile}: ${backups.length} backup(s)`);
      }
      
      addResult(`📊 Total: ${totalBackups} backup files across ${allBackups.size} original files`);
    } catch (error) {
      addResult(`❌ Error testing project backup discovery: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const testRevertPreview = async () => {
    setLoading(true);
    addResult('👁️ Testing revert preview...');

    try {
      // First find some backups to preview
      const sampleFilePath = '/Users/minseocha/Desktop/projects/태화트랜스/Taehwa_demo/www/index.php';
      const backups = await revertService.findBackupsForFile(sampleFilePath);
      
      if (backups.length > 0) {
        const backup = backups[0]; // Use the latest backup
        const preview = await revertService.getRevertPreview(sampleFilePath, backup.backupFilePath);
        
        if (preview.success) {
          addResult(`✅ Preview generated successfully`);
          addResult(`   Current content: ${preview.currentContent?.length || 0} characters`);
          addResult(`   Backup content: ${preview.backupContent?.length || 0} characters`);
          if (preview.diff) {
            addResult(`   Changes: +${preview.diff.added} -${preview.diff.removed} ~${preview.diff.modified} lines`);
          }
        } else {
          addResult(`❌ Preview failed: ${preview.error}`);
        }
      } else {
        addResult(`ℹ️ No backups available for preview test`);
      }
    } catch (error) {
      addResult(`❌ Error testing revert preview: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <div style={{
      padding: '2rem',
      backgroundColor: '#1a1a1a',
      color: '#ffffff',
      fontFamily: 'monospace',
      minHeight: '100vh'
    }}>
      <h2>🧪 Revert Service Test Suite</h2>
      
      <div style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <button
          onClick={testFindBackups}
          disabled={loading}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#007acc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.5 : 1
          }}
        >
          {loading ? '⏳ Testing...' : '🔍 Test Find Backups'}
        </button>
        
        <button
          onClick={testFindAllBackups}
          disabled={loading}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.5 : 1
          }}
        >
          {loading ? '⏳ Testing...' : '📁 Test Find All Backups'}
        </button>
        
        <button
          onClick={testRevertPreview}
          disabled={loading}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#6f42c1',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.5 : 1
          }}
        >
          {loading ? '⏳ Testing...' : '👁️ Test Preview'}
        </button>
        
        <button
          onClick={clearResults}
          disabled={loading}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.5 : 1
          }}
        >
          🗑️ Clear Results
        </button>
      </div>

      <div style={{
        backgroundColor: '#2a2a2a',
        padding: '1.5rem',
        borderRadius: '8px',
        border: '1px solid #404040',
        maxHeight: '60vh',
        overflowY: 'auto'
      }}>
        <h3>📊 Test Results:</h3>
        {testResults.length === 0 ? (
          <p style={{ color: '#888' }}>No tests run yet. Click a test button to begin.</p>
        ) : (
          <div>
            {testResults.map((result, index) => (
              <div key={index} style={{
                padding: '0.5rem 0',
                borderBottom: index < testResults.length - 1 ? '1px solid #404040' : 'none',
                fontSize: '0.9rem',
                lineHeight: '1.4'
              }}>
                {result}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{
        marginTop: '2rem',
        padding: '1rem',
        backgroundColor: '#2d3748',
        borderRadius: '6px',
        fontSize: '0.9rem',
        color: '#e2e8f0'
      }}>
        <h4>💡 Test Instructions:</h4>
        <ul>
          <li><strong>Find Backups:</strong> Tests finding backup files for a specific file</li>
          <li><strong>Find All Backups:</strong> Tests discovering all backup files in a project directory</li>
          <li><strong>Test Preview:</strong> Tests generating a preview of what would change during revert</li>
        </ul>
        <p><strong>Note:</strong> These tests use the example backup file path from your message. Adjust the file paths in the code if needed for your specific setup.</p>
      </div>
    </div>
  );
};

export default RevertTest;
