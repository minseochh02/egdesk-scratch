// Gmail Types for MCP Integration

export interface GmailMessage {
  id: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  isRead: boolean;
  isImportant: boolean;
  labels: string[];
  threadId: string;
  body?: string;
  attachments?: GmailAttachment[];
}

export interface GmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  downloadUrl?: string;
}

export interface GmailStats {
  totalMessages: number;
  unreadMessages: number;
  importantMessages: number;
  sentMessages: number;
  recentActivity: number;
}

export interface GmailConnection {
  id: string;
  name: string;
  email: string;
  adminEmail: string;
  serviceAccountKey: any;
  createdAt: string;
  updatedAt: string;
  type: 'gmail';
  status?: 'online' | 'offline' | 'error' | 'checking';
}

export interface GmailSearchOptions {
  maxResults?: number;
  query?: string;
  labelIds?: string[];
  includeSpamTrash?: boolean;
  pageToken?: string;
}

export interface GmailSendOptions {
  to: string;
  subject: string;
  body: string;
  isHtml?: boolean;
  attachments?: File[];
  replyToMessageId?: string;
}

export interface GmailLabel {
  id: string;
  name: string;
  type: 'system' | 'user';
  color?: string;
  messagesTotal?: number;
  messagesUnread?: number;
}

export interface GmailThread {
  id: string;
  messages: GmailMessage[];
  subject: string;
  participants: string[];
  lastMessageDate: string;
  isRead: boolean;
  labels: string[];
}

export interface GmailMCPConfig {
  serverUrl: string;
  apiKey: string;
  timeout: number;
  retryAttempts: number;
}

export interface GmailMCPResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface GmailMCPError {
  code: string;
  message: string;
  details?: any;
}
