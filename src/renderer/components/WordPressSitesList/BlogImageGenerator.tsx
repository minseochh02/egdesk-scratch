import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faImage,
  faSpinner,
  faCheck,
  faTimes,
  faExclamationTriangle,
  faDownload,
  faTrash,
  faEye,
  faMagic,
  faCog,
  faUpload,
} from '@fortawesome/free-solid-svg-icons';
import BlogImageGenerator, { BlogImageRequest, GeneratedImage, ImageGenerationOptions } from '../../services/blogImageGenerator';
import WordPressMediaService from '../../services/wordpressMediaService';
import './BlogImageGenerator.css';

interface BlogImageGeneratorProps {
  site: {
    url: string;
    username: string;
    password: string;
    name?: string;
  };
  initialContent?: {
    title: string;
    content: string;
    excerpt?: string;
    keywords?: string[];
    category?: string;
  };
}

const BlogImageGeneratorComponent: React.FC<BlogImageGeneratorProps> = ({ 
  site, 
  initialContent 
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [generationOptions, setGenerationOptions] = useState<ImageGenerationOptions>({
    provider: 'dalle',
    quality: 'standard',
    size: '1024x1024'
  });

  const [blogContent, setBlogContent] = useState<BlogImageRequest>({
    title: initialContent?.title || '',
    content: initialContent?.content || '',
    excerpt: initialContent?.excerpt || '',
    keywords: initialContent?.keywords || [],
    category: initialContent?.category || '',
    style: 'realistic',
    aspectRatio: 'landscape',
    count: 3,
    customPrompts: []
  });

  const [newKeyword, setNewKeyword] = useState('');
  const [newPrompt, setNewPrompt] = useState('');

  const mediaService = new WordPressMediaService(site.url, site.username, site.password);
  const imageGenerator = new BlogImageGenerator(mediaService, generationOptions);

  const handleContentChange = (field: keyof BlogImageRequest, value: any) => {
    setBlogContent(prev => ({ ...prev, [field]: value }));
    setError(null);
    setSuccess(null);
  };

  const handleAddKeyword = () => {
    if (newKeyword.trim() && !blogContent.keywords?.includes(newKeyword.trim())) {
      setBlogContent(prev => ({
        ...prev,
        keywords: [...(prev.keywords || []), newKeyword.trim()]
      }));
      setNewKeyword('');
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    setBlogContent(prev => ({
      ...prev,
      keywords: prev.keywords?.filter(k => k !== keyword) || []
    }));
  };

  const handleAddPrompt = () => {
    if (newPrompt.trim() && !blogContent.customPrompts?.includes(newPrompt.trim())) {
      setBlogContent(prev => ({
        ...prev,
        customPrompts: [...(prev.customPrompts || []), newPrompt.trim()]
      }));
      setNewPrompt('');
    }
  };

  const handleRemovePrompt = (prompt: string) => {
    setBlogContent(prev => ({
      ...prev,
      customPrompts: prev.customPrompts?.filter(p => p !== prompt) || []
    }));
  };

  const handleLoadSampleBlog = () => {
    const sampleBlog = {
      title: "The Future of Artificial Intelligence in Web Development",
      content: `# The Future of Artificial Intelligence in Web Development

Artificial Intelligence is revolutionizing the way we build and interact with websites. From automated code generation to intelligent user interfaces, AI is becoming an integral part of modern web development.

## Current AI Tools in Web Development

Today's developers have access to powerful AI tools that can:

- **Generate code automatically** based on natural language descriptions
- **Optimize performance** by analyzing and suggesting improvements
- **Create responsive designs** that adapt to different screen sizes
- **Debug applications** by identifying potential issues before they occur

## Machine Learning Integration

Machine learning algorithms are being integrated into web applications to provide:

- **Personalized user experiences** based on behavior patterns
- **Intelligent content recommendations** that keep users engaged
- **Automated testing** that can find edge cases humans might miss
- **Real-time analytics** that provide actionable insights

## The Impact on Developer Productivity

AI-powered development tools are significantly increasing developer productivity:

- **Faster prototyping** with AI-generated boilerplate code
- **Reduced debugging time** through intelligent error detection
- **Automated documentation** generation from code comments
- **Smart refactoring** suggestions that improve code quality

## Challenges and Considerations

While AI brings many benefits, developers must also consider:

- **Code quality** - ensuring AI-generated code meets standards
- **Security implications** - protecting against AI-generated vulnerabilities
- **Learning curve** - adapting to new AI-powered workflows
- **Ethical considerations** - using AI responsibly in development

## Looking Ahead

The future of web development with AI looks promising. We can expect to see:

- More sophisticated AI assistants that understand complex requirements
- Better integration between design and development tools
- Automated deployment and maintenance systems
- Enhanced user experience through intelligent interfaces

As we move forward, developers who embrace AI tools while maintaining strong fundamental skills will be best positioned for success in this evolving landscape.`,
      excerpt: "Explore how Artificial Intelligence is transforming web development, from automated code generation to intelligent user interfaces. Discover the current tools, benefits, and future possibilities.",
      keywords: ["artificial intelligence", "web development", "machine learning", "automation", "productivity"],
      category: "Technology",
      style: "realistic" as const,
      aspectRatio: "landscape" as const,
      count: 3,
      customPrompts: [
        "A futuristic workspace with multiple monitors showing code and AI interfaces, modern office setting, professional photography, high quality",
        "Abstract visualization of neural networks and data connections, blue and purple tones, digital art style, high resolution",
        "Developer working on laptop with AI assistant interface visible on screen, cozy home office, natural lighting, realistic style"
      ]
    };

    setBlogContent(sampleBlog);
    setSuccess("샘플 블로그가 로드되었습니다!");
  };

  const handleGenerateImages = async () => {
    if (!blogContent.title.trim() || !blogContent.content.trim()) {
      setError('제목과 내용을 입력해주세요.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setSuccess(null);

    try {
      const images = await imageGenerator.generateBlogImages(blogContent, site);
      setGeneratedImages(images);
      setSuccess(`${images.length}개의 이미지가 생성되었습니다!`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '이미지 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUploadToWordPress = async () => {
    if (generatedImages.length === 0) {
      setError('업로드할 이미지가 없습니다.');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // The image generator already handles WordPress upload during generation
      setSuccess('이미지가 WordPress에 성공적으로 업로드되었습니다!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'WordPress 업로드 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteImage = (imageId: string) => {
    setGeneratedImages(prev => prev.filter(img => img.id !== imageId));
  };

  const openImageUrl = (url: string) => {
    window.open(url, '_blank');
  };

  return (
    <div className="blog-image-generator">
      <div className="generator-header">
        <h3>
          <FontAwesomeIcon icon={faMagic} />
          블로그 이미지 생성기
        </h3>
        <p>AI를 사용하여 블로그 콘텐츠에 맞는 이미지를 자동으로 생성합니다.</p>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="message error">
          <FontAwesomeIcon icon={faTimes} />
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {success && (
        <div className="message success">
          <FontAwesomeIcon icon={faCheck} />
          {success}
          <button onClick={() => setSuccess(null)}>×</button>
        </div>
      )}

      {/* Content Input Section */}
      <div className="content-input-section">
        <div className="section-header">
          <h4>블로그 콘텐츠</h4>
          <button
            type="button"
            onClick={handleLoadSampleBlog}
            className="load-sample-btn"
            title="샘플 블로그 콘텐츠를 로드합니다"
          >
            📝 샘플 블로그 로드
          </button>
        </div>
        
        <div className="form-group">
          <label htmlFor="blog-title">제목 *</label>
          <input
            id="blog-title"
            type="text"
            value={blogContent.title}
            onChange={(e) => handleContentChange('title', e.target.value)}
            placeholder="블로그 포스트 제목을 입력하세요"
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label htmlFor="blog-content">내용 *</label>
          <textarea
            id="blog-content"
            value={blogContent.content}
            onChange={(e) => handleContentChange('content', e.target.value)}
            placeholder="블로그 포스트 내용을 입력하세요 (HTML 형식 지원)"
            rows={8}
            className="form-textarea"
          />
        </div>

        <div className="form-group">
          <label htmlFor="blog-excerpt">요약</label>
          <textarea
            id="blog-excerpt"
            value={blogContent.excerpt}
            onChange={(e) => handleContentChange('excerpt', e.target.value)}
            placeholder="블로그 포스트 요약 (선택사항)"
            rows={3}
            className="form-textarea"
          />
        </div>

        <div className="form-group">
          <label htmlFor="blog-category">카테고리</label>
          <input
            id="blog-category"
            type="text"
            value={blogContent.category}
            onChange={(e) => handleContentChange('category', e.target.value)}
            placeholder="예: 기술, 비즈니스, 디자인"
            className="form-input"
          />
        </div>

        {/* Keywords */}
        <div className="form-group">
          <label>키워드</label>
          <div className="keywords-input">
            <input
              type="text"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              placeholder="키워드를 입력하고 Enter를 누르세요"
              className="form-input"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddKeyword();
                }
              }}
            />
            <button
              type="button"
              onClick={handleAddKeyword}
              className="add-keyword-btn"
            >
              추가
            </button>
          </div>
          {blogContent.keywords && blogContent.keywords.length > 0 && (
            <div className="keywords-list">
              {blogContent.keywords.map((keyword, index) => (
                <span key={index} className="keyword-tag">
                  {keyword}
                  <button
                    type="button"
                    onClick={() => handleRemoveKeyword(keyword)}
                    className="remove-keyword-btn"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Custom Image Prompts */}
        <div className="form-group">
          <label>커스텀 이미지 프롬프트</label>
          <div className="prompts-input">
            <textarea
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              placeholder="이미지 생성을 위한 프롬프트를 입력하세요 (예: 'A beautiful sunset over mountains, photorealistic, high quality')"
              className="form-textarea"
              rows={3}
            />
            <button
              type="button"
              onClick={handleAddPrompt}
              className="add-prompt-btn"
            >
              프롬프트 추가
            </button>
          </div>
          {blogContent.customPrompts && blogContent.customPrompts.length > 0 && (
            <div className="prompts-list">
              {blogContent.customPrompts.map((prompt, index) => (
                <div key={index} className="prompt-item">
                  <span className="prompt-text">{prompt}</span>
                  <button
                    type="button"
                    onClick={() => handleRemovePrompt(prompt)}
                    className="remove-prompt-btn"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <small className="form-help">
            💡 커스텀 프롬프트를 입력하면 자동 생성된 프롬프트 대신 사용됩니다.
          </small>
        </div>
      </div>

      {/* Generation Options */}
      <div className="generation-options">
        <h4>이미지 생성 옵션</h4>
        
        <div className="options-grid">
          <div className="form-group">
            <label htmlFor="image-style">스타일</label>
            <select
              id="image-style"
              value={blogContent.style}
              onChange={(e) => handleContentChange('style', e.target.value)}
              className="form-select"
            >
              <option value="realistic">사실적</option>
              <option value="illustration">일러스트</option>
              <option value="minimalist">미니멀</option>
              <option value="artistic">예술적</option>
              <option value="photographic">사진적</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="aspect-ratio">화면 비율</label>
            <select
              id="aspect-ratio"
              value={blogContent.aspectRatio}
              onChange={(e) => handleContentChange('aspectRatio', e.target.value)}
              className="form-select"
            >
              <option value="landscape">가로형 (16:9)</option>
              <option value="portrait">세로형 (9:16)</option>
              <option value="square">정사각형 (1:1)</option>
              <option value="wide">와이드 (21:9)</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="image-count">생성할 이미지 수</label>
            <select
              id="image-count"
              value={blogContent.count}
              onChange={(e) => handleContentChange('count', parseInt(e.target.value))}
              className="form-select"
            >
              <option value={1}>1개</option>
              <option value={2}>2개</option>
              <option value={3}>3개</option>
              <option value={4}>4개</option>
              <option value={5}>5개</option>
            </select>
          </div>

        <div className="form-group">
          <label htmlFor="provider">AI 제공자</label>
          <select
            id="provider"
            value={generationOptions.provider}
            onChange={(e) => setGenerationOptions(prev => ({ ...prev, provider: e.target.value as any }))}
            className="form-select"
          >
            <option value="dalle">OpenAI DALL-E 3 (권장)</option>
            <option value="placeholder">Placeholder (테스트용)</option>
            <option value="stability">Stability AI</option>
            <option value="midjourney">Midjourney</option>
          </select>
          <small className="form-help">
            💡 DALL-E 3을 사용하려면 AI Keys Manager에서 OpenAI API 키를 설정해주세요.
          </small>
        </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="action-buttons">
        <button
          onClick={handleGenerateImages}
          disabled={isGenerating || !blogContent.title.trim() || !blogContent.content.trim()}
          className="generate-btn"
        >
          {isGenerating ? (
            <>
              <FontAwesomeIcon icon={faSpinner} spin />
              이미지 생성 중...
            </>
          ) : (
            <>
              <FontAwesomeIcon icon={faMagic} />
              이미지 생성하기
            </>
          )}
        </button>

        {generatedImages.length > 0 && (
          <button
            onClick={handleUploadToWordPress}
            disabled={isUploading}
            className="upload-btn"
          >
            {isUploading ? (
              <>
                <FontAwesomeIcon icon={faSpinner} spin />
                WordPress 업로드 중...
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faUpload} />
                WordPress에 업로드
              </>
            )}
          </button>
        )}
      </div>

      {/* Generated Images */}
      {generatedImages.length > 0 && (
        <div className="generated-images-section">
          <h4>생성된 이미지 ({generatedImages.length}개)</h4>
          <div className="images-grid">
            {generatedImages.map((image) => (
              <div key={image.id} className="image-card">
                <div className="image-preview">
                  <img 
                    src={image.url} 
                    alt={image.altText}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
                
                <div className="image-info">
                  <h5>{image.description}</h5>
                  <p className="image-meta">
                    <span className="placement">{image.placement}</span>
                    <span className="style">{image.style}</span>
                    <span className="aspect-ratio">{image.aspectRatio}</span>
                  </p>
                  <p className="image-prompt">
                    <strong>프롬프트:</strong> {image.prompt}
                  </p>
                  <p className="image-alt">
                    <strong>Alt 텍스트:</strong> {image.altText}
                  </p>
                </div>

                <div className="image-actions">
                  <button
                    onClick={() => openImageUrl(image.url)}
                    className="action-btn view"
                    title="새 탭에서 보기"
                  >
                    <FontAwesomeIcon icon={faEye} />
                  </button>
                  <button
                    onClick={() => handleDeleteImage(image.id)}
                    className="action-btn delete"
                    title="삭제"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BlogImageGeneratorComponent;
