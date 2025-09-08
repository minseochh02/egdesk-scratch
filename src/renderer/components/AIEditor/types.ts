export interface AIEditRequest {
  filePath: string;
  fileContent: string;
  userInstruction: string;
  fileType?: string;
  language?: string;
  projectRoot?: string; // Project root directory for codespace analysis
  context?: {
    imports?: string[];
    classes?: string[];
    functions?: string[];
    variables?: string[];
    relatedFiles?: RelatedFileContext[];
    semanticallyRelevantFiles?: SemanticallyRelevantFile[];
  };
  selection?: {
    start: number;
    end: number;
    text: string;
  };
}

export interface AIEditResponse {
  success: boolean;
  edits: AIEdit[];
  explanation?: string;
  error?: string;
  rawResponse?: string; // Raw AI response for debugging
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost?: number;
}

export interface AIEditStreamResponse {
  type: 'content' | 'edit' | 'done' | 'error';
  content?: string;
  edit?: AIEdit;
  error?: string;
  isComplete: boolean;
}

export interface AIEdit {
  type:
    | 'replace'
    | 'insert'
    | 'delete'
    | 'format'
    | 'refactor'
    | 'create'
    | 'delete_file';
  range?: {
    start: number;
    end: number;
    startLine?: number;
    endLine?: number;
    startColumn?: number;
    endColumn?: number;
  };
  oldText?: string; // For search/replace operations
  newText?: string;
  description: string;
  confidence?: number;
  filePath?: string; // For file creation/deletion operations
  isImplicitFormat?: boolean; // Flag to indicate this needs special handling for implicit search/replace format
}

export interface FileContext {
  path: string;
  name: string;
  extension: string;
  language: string;
  content: string;
  size: number;
  lastModified: Date;
  imports: string[];
  classes: string[];
  functions: string[];
  variables: string[];
  dependencies: string[];
}

export interface RelatedFileContext {
  path: string;
  name: string;
  language: string;
  imports: string[];
  classes: string[];
  functions: string[];
  variables: string[];
}

export interface SemanticallyRelevantFile {
  path: string;
  name: string;
  language: string;
  relevance: number;
  context: string;
  matches: string[];
  // 🔥 CRITICAL: Include actual file content for AI analysis
  content: string;
  size: number;
  extension: string;
}

export interface AIEditorConfig {
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  includeContext: boolean;
  maxContextFiles?: number;
  autoApply: boolean;
  requireConfirmation: boolean;
}

export interface AIEditorState {
  isEditing: boolean;
  currentFile: string | null;
  pendingEdits: AIEdit[];
  appliedEdits: AIEdit[];
  error: string | null;
  isLoading: boolean;
  lastEditTime: Date | null;
}

// New conversation types
export interface ConversationMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  metadata?: {
    filePath?: string;
    language?: string;
    edits?: AIEdit[];
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    cost?: number;
    provider?: string;
    model?: string;
  };
}

export interface Conversation {
  id: string;
  projectPath: string;
  projectName: string;
  title: string;
  messages: ConversationMessage[];
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
  summary?: string;
}

export interface ConversationStore {
  conversations: Conversation[];
  currentConversationId: string | null;
  isLoading: boolean;
  error: string | null;
}

export interface CodespaceAnalysisResult {
  success: boolean;
  totalFiles: number;
  totalLines: number;
  languages: Record<string, number>;
  fileTypes: Record<string, number>;
  error?: string;
}
