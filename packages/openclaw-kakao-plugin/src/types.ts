// 카카오 챗봇 스킬 서버 타입 정의

export interface KakaoSkillRequest {
  intent: {
    id: string;
    name: string;
  };
  userRequest: {
    callbackUrl?: string;
    timezone: string;
    block: {
      id: string;
      name: string;
    };
    utterance: string;
    lang: string;
    user: {
      id: string;
      type: string;
      properties: {
        botUserKey?: string;
        plusfriendUserKey?: string;
        appUserId?: string;
        isFriend?: boolean;
      };
    };
    params?: Record<string, string>;
  };
  bot: {
    id: string;
    name: string;
  };
  action: {
    id: string;
    name: string;
    params: Record<string, string>;
    detailParams: Record<string, { origin: string; value: string }>;
    clientExtra: Record<string, unknown>;
  };
  contexts?: Array<{
    name: string;
    lifeSpan: number;
    params: Record<string, string>;
  }>;
}

export interface KakaoSkillResponse {
  version: "2.0";
  useCallback?: boolean;
  template?: {
    outputs: KakaoOutput[];
    quickReplies?: KakaoQuickReply[];
  };
  context?: {
    values: Array<{
      name: string;
      lifeSpan: number;
      params?: Record<string, string>;
    }>;
  };
  data?: Record<string, unknown>;
}

export type KakaoOutput =
  | { simpleText: { text: string } }
  | { simpleImage: { imageUrl: string; altText: string } }
  | { basicCard: KakaoBasicCard }
  | { textCard: KakaoTextCard }
  | { listCard: KakaoListCard };

export interface KakaoBasicCard {
  title?: string;
  description?: string;
  thumbnail: {
    imageUrl: string;
    link?: { web: string };
    fixedRatio?: boolean;
  };
  buttons?: KakaoButton[];
}

export interface KakaoTextCard {
  title?: string;
  description?: string;
  buttons?: KakaoButton[];
}

export interface KakaoListCard {
  header: { title: string };
  items: Array<{
    title: string;
    description?: string;
    imageUrl?: string;
    link?: { web: string };
  }>;
  buttons?: KakaoButton[];
}

export interface KakaoButton {
  label: string;
  action: "webLink" | "message" | "block" | "phone" | "share";
  webLinkUrl?: string;
  messageText?: string;
  blockId?: string;
  phoneNumber?: string;
  extra?: Record<string, unknown>;
}

export interface KakaoQuickReply {
  label: string;
  action: "message" | "block";
  messageText?: string;
  blockId?: string;
  extra?: Record<string, unknown>;
}

export interface KakaoCallbackResponse {
  taskId: string;
  status: "SUCCESS" | "FAIL" | "ERROR";
  message: string;
  timestamp: number;
}

// OpenClaw 설정 타입
export interface KakaoConfig {
  enabled?: boolean;
  name?: string;
  webhookPath?: string;
  skillUrl?: string;
  botId?: string;
  useCallback?: boolean;
  callbackTimeoutMs?: number;
  dmPolicy?: "open" | "pairing" | "allowlist";
  allowFrom?: string[];
  accounts?: Record<string, KakaoAccountConfig>;
}

export interface KakaoAccountConfig {
  enabled?: boolean;
  name?: string;
  webhookPath?: string;
  skillUrl?: string;
  botId?: string;
  useCallback?: boolean;
  callbackTimeoutMs?: number;
  dmPolicy?: "open" | "pairing" | "allowlist";
  allowFrom?: string[];
}

export interface ResolvedKakaoAccount {
  accountId: string;
  name?: string;
  enabled: boolean;
  webhookPath: string;
  skillUrl?: string;
  botId?: string;
  useCallback: boolean;
  callbackTimeoutMs: number;
  config: KakaoAccountConfig & KakaoConfig;
}
