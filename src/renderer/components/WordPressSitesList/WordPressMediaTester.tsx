import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUpload,
  faImage,
  faSpinner,
  faCheck,
  faTimes,
  faExclamationTriangle,
  faDownload,
  faTrash,
  faEye,
} from '@fortawesome/free-solid-svg-icons';
import WordPressMediaService from '../../services/wordpressMediaService';
import './WordPressMediaTester.css';

interface WordPressMediaTesterProps {
  site: {
    url: string;
    username: string;
    password: string;
    name?: string;
  };
}

interface MediaItem {
  id: number;
  title: string;
  source_url: string;
  media_type: string;
  mime_type: string;
  alt_text?: string;
  caption?: string;
  description?: string;
}

const WordPressMediaTester: React.FC<WordPressMediaTesterProps> = ({ site }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedMedia, setUploadedMedia] = useState<MediaItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaOptions, setMediaOptions] = useState({
    altText: '',
    caption: '',
    description: '',
    title: '',
  });

  const mediaService = new WordPressMediaService(site.url, site.username, site.password);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
      setSuccess(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('파일을 선택해주세요.');
      return;
    }

    setIsUploading(true);
    setError(null);
    setSuccess(null);
    setUploadProgress(0);

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 100);

      const result = await mediaService.uploadMedia(
        selectedFile,
        selectedFile.name,
        selectedFile.type,
        {
          altText: mediaOptions.altText || undefined,
          caption: mediaOptions.caption || undefined,
          description: mediaOptions.description || undefined,
          title: mediaOptions.title || selectedFile.name,
        }
      );

      clearInterval(progressInterval);
      setUploadProgress(100);

      setUploadedMedia(prev => [result, ...prev]);
      setSuccess(`파일이 성공적으로 업로드되었습니다! (ID: ${result.id})`);
      setSelectedFile(null);
      setMediaOptions({ altText: '', caption: '', description: '', title: '' });
      
      // Reset file input
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (err) {
      setError(err instanceof Error ? err.message : '업로드 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleLoadMedia = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await mediaService.listMedia(1, 20);
      setUploadedMedia(result.media);
      setSuccess(`${result.media.length}개의 미디어를 불러왔습니다.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '미디어 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteMedia = async (mediaId: number) => {
    if (!window.confirm('정말로 이 미디어를 삭제하시겠습니까?')) {
      return;
    }

    try {
      const success = await mediaService.deleteMedia(mediaId);
      if (success) {
        setUploadedMedia(prev => prev.filter(media => media.id !== mediaId));
        setSuccess('미디어가 성공적으로 삭제되었습니다.');
      } else {
        setError('미디어 삭제에 실패했습니다.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '미디어 삭제 중 오류가 발생했습니다.');
    }
  };

  const openMediaUrl = (url: string) => {
    window.open(url, '_blank');
  };

  return (
    <div className="wordpress-media-tester">
      <div className="tester-header">
        <h3>
          <FontAwesomeIcon icon={faImage} />
          WordPress 미디어 테스터
        </h3>
        <p>{site.name || site.url}의 미디어 라이브러리를 테스트합니다.</p>
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

      {/* Upload Section */}
      <div className="upload-section">
        <h4>미디어 업로드</h4>
        
        <div className="file-input-group">
          <label htmlFor="file-input" className="file-input-label">
            <FontAwesomeIcon icon={faUpload} />
            파일 선택
          </label>
          <input
            id="file-input"
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="file-input"
          />
          {selectedFile && (
            <div className="selected-file">
              <FontAwesomeIcon icon={faImage} />
              <span>{selectedFile.name}</span>
              <span className="file-size">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
            </div>
          )}
        </div>

        <div className="media-options">
          <div className="option-group">
            <label htmlFor="media-title">제목</label>
            <input
              id="media-title"
              type="text"
              value={mediaOptions.title}
              onChange={(e) => setMediaOptions(prev => ({ ...prev, title: e.target.value }))}
              placeholder="미디어 제목"
            />
          </div>

          <div className="option-group">
            <label htmlFor="media-alt">Alt 텍스트</label>
            <input
              id="media-alt"
              type="text"
              value={mediaOptions.altText}
              onChange={(e) => setMediaOptions(prev => ({ ...prev, altText: e.target.value }))}
              placeholder="접근성을 위한 alt 텍스트"
            />
          </div>

          <div className="option-group">
            <label htmlFor="media-caption">캡션</label>
            <input
              id="media-caption"
              type="text"
              value={mediaOptions.caption}
              onChange={(e) => setMediaOptions(prev => ({ ...prev, caption: e.target.value }))}
              placeholder="미디어 캡션"
            />
          </div>

          <div className="option-group">
            <label htmlFor="media-description">설명</label>
            <textarea
              id="media-description"
              value={mediaOptions.description}
              onChange={(e) => setMediaOptions(prev => ({ ...prev, description: e.target.value }))}
              placeholder="미디어 설명"
              rows={2}
            />
          </div>
        </div>

        <div className="upload-actions">
          <button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            className="upload-btn"
          >
            {isUploading ? (
              <>
                <FontAwesomeIcon icon={faSpinner} spin />
                업로드 중... ({uploadProgress}%)
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faUpload} />
                업로드
              </>
            )}
          </button>

          <button
            onClick={handleLoadMedia}
            disabled={isLoading}
            className="load-btn"
          >
            {isLoading ? (
              <>
                <FontAwesomeIcon icon={faSpinner} spin />
                불러오는 중...
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faDownload} />
                미디어 목록 불러오기
              </>
            )}
          </button>
        </div>

        {/* Upload Progress Bar */}
        {isUploading && (
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        )}
      </div>

      {/* Media List */}
      {uploadedMedia.length > 0 && (
        <div className="media-list-section">
          <h4>업로드된 미디어 ({uploadedMedia.length}개)</h4>
          <div className="media-grid">
            {uploadedMedia.map((media) => (
              <div key={media.id} className="media-item">
                <div className="media-preview">
                  {media.media_type === 'image' ? (
                    <img 
                      src={media.source_url} 
                      alt={media.alt_text || media.title}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="media-placeholder">
                      <FontAwesomeIcon icon={faImage} />
                      <span>{media.mime_type}</span>
                    </div>
                  )}
                </div>
                
                <div className="media-info">
                  <h5>{media.title}</h5>
                  <p className="media-type">{media.mime_type}</p>
                  {media.alt_text && (
                    <p className="media-alt">Alt: {media.alt_text}</p>
                  )}
                  {media.caption && (
                    <p className="media-caption">Caption: {media.caption}</p>
                  )}
                </div>

                <div className="media-actions">
                  <button
                    onClick={() => openMediaUrl(media.source_url)}
                    className="action-btn view"
                    title="새 탭에서 보기"
                  >
                    <FontAwesomeIcon icon={faEye} />
                  </button>
                  <button
                    onClick={() => handleDeleteMedia(media.id)}
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

export default WordPressMediaTester;
