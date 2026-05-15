# @openclaw/kakao

OpenClaw 카카오톡 채널 플러그인

카카오톡 채널 챗봇을 OpenClaw에 연동하여 AI 기반 자동 응답을 제공합니다.

## 기능

- 카카오 챗봇 스킬 서버 webhook 수신
- AI 챗봇 콜백 모드 지원 (5초 타임아웃 우회)
- 다중 계정 지원
- DM 정책 (open/pairing/allowlist)

## 설치

```bash
# npm으로 설치
openclaw plugins install @openclaw/kakao

# 또는 로컬 경로로 설치
openclaw plugins install /path/to/openclaw-kakao-plugin
```

## 설정

`openclaw.json`에 다음 설정 추가:

```json
{
  "channels": {
    "kakao": {
      "enabled": true,
      "webhookPath": "/kakao/skill",
      "useCallback": true,
      "callbackTimeoutMs": 50000,
      "dmPolicy": "pairing"
    }
  }
}
```

### 설정 옵션

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `enabled` | boolean | `true` | 플러그인 활성화 |
| `webhookPath` | string | `/kakao/skill` | 스킬 서버 webhook 경로 |
| `useCallback` | boolean | `true` | AI 챗봇 콜백 모드 사용 |
| `callbackTimeoutMs` | number | `50000` | 콜백 타임아웃 (ms) |
| `dmPolicy` | string | `"pairing"` | DM 정책 (open/pairing/allowlist) |
| `allowFrom` | string[] | `[]` | 허용된 사용자 목록 |
| `botId` | string | - | 카카오 봇 ID |

## 카카오 챗봇 설정

1. [카카오 비즈니스](https://business.kakao.com)에서 챗봇 생성
2. [챗봇 관리자센터](https://chatbot.kakao.com)에서 스킬 등록
3. 스킬 URL에 OpenClaw webhook 주소 입력:
   - 예: `https://your-domain.com/kakao/skill`
4. AI 챗봇 전환 신청 (콜백 기능 사용 시)

### AI 챗봇 콜백 설정

카카오 챗봇의 기본 응답 타임아웃은 5초입니다. Claude 응답은 일반적으로 10-30초 걸리므로, **콜백 모드**를 사용해야 합니다.

1. 챗봇 관리자센터 > 설정 > AI 챗봇 관리에서 전환 신청
2. 승인 후 블록 설정에서 콜백 API 활성화
3. 기본 응답 메시지 설정 (예: "생각 중이에요...")

## 외부 노출

OpenClaw gateway를 외부에서 접근 가능하게 해야 합니다:

### Tailscale Funnel

```bash
openclaw gateway --tailscale funnel
```

### Cloudflare Tunnel

```bash
cloudflared tunnel --url http://localhost:19000
```

### ngrok (개발용)

```bash
ngrok http 19000
```

## 아키텍처

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  카카오 서버  │────▶│   OpenClaw   │────▶│    Claude    │
│              │     │   Gateway    │     │              │
└──────────────┘     └──────────────┘     └──────────────┘
        ▲                   │
        │                   │
        └───────────────────┘
           callbackUrl 응답
```

## 제한 사항

- 카카오톡 채널은 **푸시 메시지**를 직접 보낼 수 없음 (스킬 응답만 가능)
- 그룹 채팅 지원 안 함 (1:1 채팅만)
- 미디어 업로드 제한적 (이미지 URL만 지원)

## 라이선스

MIT
