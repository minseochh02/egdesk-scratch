import React, { useState } from 'react';

/**
 * Example component demonstrating Naver Blog automation with AI-generated images
 * This component shows how to use the new IPC handlers from the renderer process
 */
const NaverBlogImageExample: React.FC = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAutomating, setIsAutomating] = useState(false);
  const [result, setResult] = useState<string>('');
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    title: 'AI-Generated Dog Image Blog Post',
    content: 'This post features an AI-generated dog image created using Gemini AI!',
    tags: '#ai #dog #egdesk #automation',
    dogImagePrompt: 'A cute golden retriever puppy playing in a sunny garden'
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const generateDogImage = async () => {
    setIsGenerating(true);
    setResult('');

    try {
      const response = await window.electronAPI.invoke('naver-blog-generate-dog-image', {
        prompt: formData.dogImagePrompt
      });

      if (response.success) {
        setResult(`✅ Dog image generated and copied to clipboard!\nImage saved to: ${response.imagePath}`);
      } else {
        setResult(`❌ Failed to generate image: ${response.error}`);
      }
    } catch (error) {
      setResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const runFullAutomation = async () => {
    setIsAutomating(true);
    setResult('');

    try {
      const response = await window.electronAPI.invoke('naver-blog-automation-with-image', {
        username: formData.username,
        password: formData.password,
        title: formData.title,
        content: formData.content,
        tags: formData.tags,
        includeDogImage: true,
        dogImagePrompt: formData.dogImagePrompt
      });

      if (response.success) {
        setResult(`✅ Blog automation completed successfully!\nImage Generated: ${response.imageGenerated ? 'Yes' : 'No'}`);
      } else {
        setResult(`❌ Automation failed: ${response.error}`);
      }
    } catch (error) {
      setResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsAutomating(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h2>🐕 Naver Blog with AI-Generated Dog Image</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <h3>Configuration</h3>
        <div style={{ display: 'grid', gap: '10px' }}>
          <div>
            <label>Naver Username:</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              placeholder="Enter your Naver username"
              style={{ width: '100%', padding: '8px', marginTop: '4px' }}
            />
          </div>
          
          <div>
            <label>Naver Password:</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="Enter your Naver password"
              style={{ width: '100%', padding: '8px', marginTop: '4px' }}
            />
          </div>
          
          <div>
            <label>Blog Title:</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              style={{ width: '100%', padding: '8px', marginTop: '4px' }}
            />
          </div>
          
          <div>
            <label>Blog Content:</label>
            <textarea
              name="content"
              value={formData.content}
              onChange={handleInputChange}
              rows={4}
              style={{ width: '100%', padding: '8px', marginTop: '4px' }}
            />
          </div>
          
          <div>
            <label>Tags:</label>
            <input
              type="text"
              name="tags"
              value={formData.tags}
              onChange={handleInputChange}
              placeholder="#tag1 #tag2 #tag3"
              style={{ width: '100%', padding: '8px', marginTop: '4px' }}
            />
          </div>
          
          <div>
            <label>Dog Image Prompt:</label>
            <textarea
              name="dogImagePrompt"
              value={formData.dogImagePrompt}
              onChange={handleInputChange}
              rows={2}
              style={{ width: '100%', padding: '8px', marginTop: '4px' }}
            />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button
          onClick={generateDogImage}
          disabled={isGenerating || isAutomating}
          style={{
            padding: '10px 20px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isGenerating || isAutomating ? 'not-allowed' : 'pointer',
            opacity: isGenerating || isAutomating ? 0.6 : 1
          }}
        >
          {isGenerating ? 'Generating...' : 'Generate Dog Image Only'}
        </button>
        
        <button
          onClick={runFullAutomation}
          disabled={isGenerating || isAutomating || !formData.username || !formData.password}
          style={{
            padding: '10px 20px',
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: (isGenerating || isAutomating || !formData.username || !formData.password) ? 'not-allowed' : 'pointer',
            opacity: (isGenerating || isAutomating || !formData.username || !formData.password) ? 0.6 : 1
          }}
        >
          {isAutomating ? 'Running Automation...' : 'Run Full Blog Automation'}
        </button>
      </div>

      {result && (
        <div style={{
          padding: '15px',
          backgroundColor: '#f5f5f5',
          border: '1px solid #ddd',
          borderRadius: '4px',
          whiteSpace: 'pre-line',
          fontFamily: 'monospace',
          fontSize: '14px'
        }}>
          {result}
        </div>
      )}

      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#e3f2fd', borderRadius: '4px' }}>
        <h4>📝 Instructions:</h4>
        <ol>
          <li>Make sure you have set your <code>GEMINI_API_KEY</code> environment variable</li>
          <li>Enter your Naver credentials above</li>
          <li>Customize the blog content and image prompt as desired</li>
          <li>Click "Generate Dog Image Only" to test image generation, or</li>
          <li>Click "Run Full Blog Automation" to create and post a complete blog with AI-generated image</li>
        </ol>
        
        <h4>🔧 Features:</h4>
        <ul>
          <li>AI-generated dog images using Gemini</li>
          <li>Automatic clipboard copying</li>
          <li>Seamless integration with Naver Blog editor</li>
          <li>Custom image generation prompts</li>
          <li>Comprehensive error handling</li>
        </ul>
      </div>
    </div>
  );
};

export default NaverBlogImageExample;
