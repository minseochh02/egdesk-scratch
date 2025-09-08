import React, { useEffect, useMemo, useState } from 'react';
import { aiKeysStore } from '../AIKeysManager/store/aiKeysStore';
import { AIKey } from '../AIKeysManager/types';
import { CHAT_PROVIDERS, ModelInfo } from '../ChatInterface/types';
import { ChatService } from '../ChatInterface/services/chatService';
import './BlogWriter.css';

interface BlogWriterProps {
  initialTopic?: string;
  onTopicChange?: (value: string) => void;
  initialCategory?: string;
  onCategoryChange?: (value: string) => void;
  initialProviderId?: string;
  initialModelId?: string;
  initialKeyId?: string;
  onAIChange?: (providerId: string, modelId: string, keyId?: string) => void;
  initialKeywords?: string[];
  onKeywordsChange?: (keywords: string[]) => void;
  onTemplateSaved?: (template: { id: string; name: string; title: string; content: string; status: string }) => void;
}

export const BlogWriter: React.FC<BlogWriterProps> = ({
  initialTopic,
  onTopicChange,
  initialCategory,
  onCategoryChange,
  initialProviderId,
  initialModelId,
  initialKeyId,
  onAIChange,
  initialKeywords,
  onKeywordsChange,
  onTemplateSaved,
}) => {
  const [activeKeys, setActiveKeys] = useState<AIKey[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>(
    initialModelId || 'gpt-3.5-turbo',
  );
  const [selectedKey, setSelectedKey] = useState<AIKey | null>(null);

  const [topic, setTopic] = useState<string>(initialTopic || '');
  const [audience, setAudience] = useState<string>('개발자');
  const [tone, setTone] = useState<string>('실용적이고 친근한');
  const [length, setLength] = useState<string>('1200-1600 단어');
  const [keywordList, setKeywordList] = useState<string[]>(initialKeywords || []);
  const [isEditingKeyword, setIsEditingKeyword] = useState<boolean>(false);
  const [draftKeyword, setDraftKeyword] = useState<string>('');
  const [category, setCategory] = useState<string>(initialCategory || '');
  const [isEditingTopic, setIsEditingTopic] = useState<boolean>(false);
  const [draftTopic, setDraftTopic] = useState<string>('');
  const [templateName, setTemplateName] = useState<string>('');
  const categories = useMemo(
    () => [
      '💰 재정/투자 (부동산, 주식, 연금, 세금, 대출 등)',
      '💻 IT/기술 (프로그래밍, 앱 사용법, 소프트웨어, 디지털기기 등)',
      '🏠 생활/라이프스타일 (인테리어, 요리, 미니멀라이프, 반려동물 등)',
      '💪 건강/자기계발 (운동, 독서, 습관, 정신건강 등)',
      '🎓 교육/학습 (외국어, 자격증, 온라인강의, 공부법 등)',
      '🛒 쇼핑/소비 (온라인쇼핑, 중고거래, 할인혜택, 가성비제품 등)',
      '🚗 자동차/교통 (자동차보험, 중고차, 대중교통, 주차 등)',
      '🏢 취업/직장 (이직, 연차, 퇴사, 직장생활, 4대보험 등)',
    ],
    [],
  );

  // Removed generated HTML flow; templates are the primary output
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsub = aiKeysStore.subscribe((state) => {
      setActiveKeys(state.keys.filter((k) => k.isActive));
    });
    return () => unsub();
  }, []);

  const availableModels: ModelInfo[] = useMemo(() => {
    // Show all models from all providers
    return CHAT_PROVIDERS.flatMap((provider) => provider.models);
  }, []);

  const availableKeys = useMemo(() => {
    // Show all active keys regardless of provider
    return activeKeys;
  }, [activeKeys]);

  // Ensure model is valid when available models change
  useEffect(() => {
    // Check if current model exists in available models
    const currentModelExists = availableModels.some((m) => m.id === selectedModel);
    
    if (!currentModelExists && availableModels.length > 0) {
      // If current model doesn't exist, select the first available model
      setSelectedModel(availableModels[0].id);
    }
  }, [selectedModel, availableModels]);

  useEffect(() => {
    // If no key is selected or the selected key doesn't exist in available keys, select a default
    if (!selectedKey || !availableKeys.some((k) => k.id === selectedKey.id)) {
      const defaultKey = initialKeyId
        ? availableKeys.find((k) => k.id === initialKeyId) || availableKeys[0]
        : availableKeys[0];
      setSelectedKey(defaultKey || null);
    }
  }, [availableKeys, initialKeyId]);




  // Get provider color from selected model's provider
  const providerColor = useMemo(() => {
    const selectedModelInfo = availableModels.find((m) => m.id === selectedModel);
    if (selectedModelInfo) {
      const provider = CHAT_PROVIDERS.find((p) => p.id === selectedModelInfo.provider);
      return provider?.color || '#999';
    }
    return '#999';
  }, [selectedModel, availableModels]);

  const handleSaveTemplate = () => {
    setError(null);
    setSaveMessage(null);
    
    try {
      // Save all current values
      if (onTopicChange) onTopicChange(topic);
      if (onCategoryChange) onCategoryChange(category);
      if (onKeywordsChange) onKeywordsChange(keywordList);
      if (onAIChange && selectedKey) {
        const providerId = selectedKey.providerId;
        onAIChange(providerId, selectedModel, selectedKey.id);
      }
      
      // Create a template from current settings
      if (onTemplateSaved && topic) {
        const template = {
          id: `template_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: templateName.trim() || `${topic} 템플릿`,
          title: topic,
          content: [
            category ? `카테고리: ${category}` : undefined,
            audience ? `대상 독자: ${audience}` : undefined,
            tone ? `톤: ${tone}` : undefined,
            length ? `목표 길이: ${length}` : undefined,
            keywordList.length ? `키워드: ${keywordList.join(', ')}` : undefined,
            selectedKey ? `AI 모델: ${selectedModel} (${selectedKey.name})` : undefined,
          ]
            .filter(Boolean)
            .join('\n'),
          status: 'draft',
        };
        
        console.log('BlogWriter - Saving template:', template);
        onTemplateSaved(template);
      }
      
      setSaveMessage('템플릿이 성공적으로 저장되었습니다!');
      setTemplateName(''); // Clear template name after saving
      setTimeout(() => setSaveMessage(null), 3000); // Clear message after 3 seconds
    } catch (err) {
      setError('템플릿 저장 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="blog-writer">
      <div className="bw-header">
        <h1>🖋️ 블로그 작성기</h1>
        <p>저장된 AI 키를 사용하여 개요와 완전한 초안을 작성하세요</p>
      </div>

      <div className="bw-config">
        <div className="bw-section-title">카테고리 선택</div>
        <div className="bw-categories">
          {categories.map((c) => (
            <button
              key={c}
              className={`bw-category-card${category === c ? ' selected' : ''}`}
              onClick={() => setCategory(c)}
              type="button"
              title={c}
            >
              <span>{c}</span>
            </button>
          ))}
        </div>

        <div className="bw-row">
          <div className="bw-field">
            <label>모델</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
            >
              {availableModels.map((m) => {
                const provider = CHAT_PROVIDERS.find((p) => p.id === m.provider);
                return (
                  <option key={m.id} value={m.id}>
                    {m.name} ({provider?.name || m.provider})
                  </option>
                );
              })}
            </select>
          </div>
          <div className="bw-field">
            <label>API 키</label>
            <select
              value={selectedKey?.id || ''}
              onChange={(e) =>
                setSelectedKey(
                  availableKeys.find((k) => k.id === e.target.value) || null,
                )
              }
              disabled={availableKeys.length === 0}
            >
              <option value="">
                {availableKeys.length
                  ? 'API 키 선택'
                  : '활성화된 키가 없습니다'}
              </option>
              {availableKeys.map((k) => {
                const provider = CHAT_PROVIDERS.find((p) => p.id === k.providerId);
                return (
                  <option key={k.id} value={k.id}>
                    {k.name} ({provider?.name || k.providerId})
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        <div className="bw-row">
          <div className="bw-field bw-grow">
            <label>주제</label>
            <div className="bw-topic">
              <div className="bw-badges">
                {topic ? (
                  <span className="bw-badge" title="클릭하여 편집" onClick={() => {
                    setDraftTopic(topic);
                    setIsEditingTopic(true);
                  }}>
                    {topic}
                    <button
                      type="button"
                      className="bw-badge-action"
                      title="주제 제거"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTopic('');
                      }}
                    >
                      ×
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="bw-badge add"
                    onClick={() => {
                      setDraftTopic('');
                      setIsEditingTopic(true);
                    }}
                  >
                    + 주제 추가
                  </button>
                )}
              </div>

              {isEditingTopic && (
                <div className="bw-topic-editor">
                  <input
                    type="text"
                    value={draftTopic}
                    onChange={(e) => setDraftTopic(e.target.value)}
                    placeholder={
                      category
                        ? `${category} 주제 작성 (예: ... 시작하기)`
                        : '예: Electron + React 데스크톱 앱 만들기'
                    }
                  />
                  <div className="bw-topic-actions">
                    <button
                      type="button"
                      className="bw-btn primary"
                      onClick={() => {
                        setTopic(draftTopic.trim());
                        setIsEditingTopic(false);
                      }}
                      disabled={!draftTopic.trim()}
                    >
                      저장
                    </button>
                    <button
                      type="button"
                      className="bw-btn"
                      onClick={() => setIsEditingTopic(false)}
                    >
                      취소
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bw-row">
          <div className="bw-field">
            <label>대상 독자</label>
            <input
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
            />
          </div>
          <div className="bw-field">
            <label>톤</label>
            <input value={tone} onChange={(e) => setTone(e.target.value)} />
          </div>
          <div className="bw-field">
            <label>목표 길이</label>
            <input value={length} onChange={(e) => setLength(e.target.value)} />
          </div>
        </div>

        <div className="bw-row">
          <div className="bw-field bw-grow">
            <label>키워드</label>
            <div className="bw-topic">
              <div className="bw-badges">
                {keywordList.map((kw) => (
                  <span key={kw} className="bw-badge" title="키워드 제거">
                    {kw}
                    <button
                      type="button"
                      className="bw-badge-action"
                      onClick={() =>
                        setKeywordList((prev) => prev.filter((k) => k !== kw))
                      }
                    >
                      ×
                    </button>
                  </span>
                ))}
                {!isEditingKeyword && (
                  <button
                    type="button"
                    className="bw-badge add"
                    onClick={() => {
                      setDraftKeyword('');
                      setIsEditingKeyword(true);
                    }}
                  >
                    + 키워드 추가
                  </button>
                )}
              </div>

              {isEditingKeyword && (
                <div className="bw-topic-editor">
                  <input
                    type="text"
                    value={draftKeyword}
                    onChange={(e) => setDraftKeyword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const items = draftKeyword
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean);
                        if (items.length) {
                          setKeywordList((prev) => {
                            const merged = [...prev];
                            for (const it of items) {
                              if (!merged.includes(it)) merged.push(it);
                            }
                            return merged;
                          });
                          setDraftKeyword(''); // Clear the input after adding
                        }
                      }
                    }}
                    placeholder="예: electron, react"
                    autoFocus
                  />
                  <div className="bw-topic-actions">
                    <button
                      type="button"
                      className="bw-btn primary"
                      onClick={() => {
                        const items = draftKeyword
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean);
                        if (items.length) {
                          setKeywordList((prev) => {
                            const merged = [...prev];
                            for (const it of items) {
                              if (!merged.includes(it)) merged.push(it);
                            }
                            return merged;
                          });
                          setDraftKeyword(''); // Clear the input after adding
                        }
                      }}
                      disabled={!draftKeyword.trim()}
                    >
                      추가
                    </button>
                    <button
                      type="button"
                      className="bw-btn"
                      onClick={() => {
                        setIsEditingKeyword(false);
                        setDraftKeyword('');
                      }}
                    >
                      취소
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bw-row">
          <div className="bw-field bw-grow">
            <label>템플릿 이름</label>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="예: 개발 블로그 템플릿"
            />
          </div>
        </div>

        <div className="bw-actions">
          <button
            className="bw-btn primary"
            onClick={handleSaveTemplate}
            title="현재 설정을 템플릿으로 저장"
            disabled={!topic.trim()}
          >
            💾 템플릿 저장
          </button>
        </div>

        {saveMessage && (
          <div className="bw-success">
            <span>✅ {saveMessage}</span>
            <button onClick={() => setSaveMessage(null)} className="bw-close">
              ×
            </button>
          </div>
        )}

        {error && (
          <div className="bw-error">
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)} className="bw-close">
              ×
            </button>
          </div>
        )}
      </div>

      {/* No generated HTML panel; templates serve as reusable definitions */}
    </div>
  );
};

export default BlogWriter;
