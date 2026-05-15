# KakaoTalk → OpenClaw Integration — Implementation Notes

## Overview

KakaoTalk messages flow through two servers:

```
KakaoTalk → EGDesk :8080/kakao/skill → OpenClaw :18789/kakao/skill → AI → callbackUrl → KakaoTalk
```

EGDesk acts as a transparent proxy. All logic lives in the OpenClaw kakao plugin.

---

## Components

### 1. OpenClaw Kakao Plugin (`openclaw-kakao-plugin`)

Source: `egdesk-scratch/packages/openclaw-kakao-plugin/`  
Installed: `/Users/minseocha/.openclaw/extensions/kakao/`

#### Entry point — `src/index.ts`

Uses `defineChannelPluginEntry` from `"openclaw/plugin-sdk/channel-core"`.

`registerFull(api)` does three things:
1. Stores the OpenClaw runtime via `setKakaoRuntime(api.runtime)`
2. Registers the channel: `api.registerChannel({ plugin: kakaoPlugin })`
3. Registers the HTTP webhook: `api.registerHttpRoute({ path: "/kakao/skill", auth: "plugin", handler })`

The HTTP handler:
- Parses the `KakaoSkillRequest` body
- Extracts `userKey` from `botUserKey` / `plusfriendUserKey` / `id`
- If `callbackUrl` is present: ACKs immediately with `useCallback: true`, then dispatches to AI async via `processAndSendCallback`
- If no `callbackUrl`: echoes the utterance back (fallback only — production always sends callbackUrl when callback mode is enabled in KakaoTalk OBT)

#### Channel logic — `src/channel.ts`

Key exports:
- `kakaoPlugin` — the `ChannelPlugin` object registered with OpenClaw
- `resolveKakaoAccount(cfg, accountId?)` — reads `cfg.channels.kakao`, returns a `ResolvedKakaoAccount`
- `createSimpleTextResponse(text)` — builds a `KakaoSkillResponse` with `simpleText`
- `createCallbackWaitResponse(msg?)` — builds the immediate ACK response (`useCallback: true`)
- `processAndSendCallback(ctxPayload, callbackUrl, cfg, account, runtime)` — calls `runtime.channel.reply.dispatchReplyWithBufferedBlockDispatcher`, then POSTs the AI response to `callbackUrl`

`startAccount` (inside `kakaoPlugin.gateway`) only stores the OpenClaw config via `setKakaoCfg(ctx.cfg)` so the HTTP handler can retrieve it later via `getKakaoCfg()`.

Config defaults (`KakaoConfigSchema`):
| Field | Default |
|---|---|
| `webhookPath` | `/kakao/skill` |
| `useCallback` | `true` |
| `callbackTimeoutMs` | `50000` |
| `dmPolicy` | `pairing` |

#### Runtime store — `src/runtime.ts`

Module-level singletons:
- `setKakaoRuntime` / `getKakaoRuntime` — the `PluginRuntime` from `registerFull`
- `setKakaoCfg` / `getKakaoCfg` — the OpenClaw config from `startAccount`

Both are needed because `registerFull` and `startAccount` run in different contexts.

#### Types — `src/types.ts`

- `KakaoSkillRequest` — incoming webhook body from KakaoTalk
- `KakaoSkillResponse` — outgoing response (direct or callback)
- `KakaoConfig` / `KakaoAccountConfig` / `ResolvedKakaoAccount` — config shapes
- `KakaoOutput`, `KakaoButton`, `KakaoQuickReply` — response template types

---

### 2. OpenClaw Config — `~/.openclaw/openclaw.json`

The kakao channel must be present for `registerFull` and `startAccount` to be called:

```json
"channels": {
  "kakao": {
    "enabled": true,
    "webhookPath": "/kakao/skill"
  }
}
```

The plugin install entry points to the source repo:

```json
"plugins": {
  "installs": {
    "kakao": {
      "source": "path",
      "sourcePath": "egdesk-scratch/packages/openclaw-kakao-plugin",
      "installPath": "/Users/minseocha/.openclaw/extensions/kakao"
    }
  }
}
```

---

### 3. EGDesk Proxy — `local-server-manager.ts`

Routes `/kakao/skill` and `/kakao/skill/sync` both to `proxyToOpenClaw()`.

`proxyToOpenClaw`:
1. Reads raw request body
2. POSTs it to `http://localhost:18789/kakao/skill`
3. Returns the upstream response verbatim
4. On failure: returns `502` with a Korean error message

---

## Compilation

The installed extension must be compiled — the source repo has no `node_modules`.

```bash
# After editing source files:
cp src/*.ts ~/.openclaw/extensions/kakao/src/

# Compile from the installed path (has node_modules)
~/.openclaw/extensions/kakao/node_modules/.bin/tsc \
  --project ~/.openclaw/extensions/kakao/tsconfig.json
```

Then restart OpenClaw to pick up the new `dist/`.

---

## Request Flow (Callback Mode)

```
1. User sends message in KakaoTalk
2. KakaoTalk POST → https://<tunnel>/kakao/skill
                     (includes callbackUrl)
3. Tunnel forwards → EGDesk :8080/kakao/skill
4. EGDesk proxyToOpenClaw → OpenClaw :18789/kakao/skill
5. OpenClaw handler:
   a. Responds immediately: {"version":"2.0","useCallback":true,"data":{"text":"잠시만..."}}
   b. Calls processAndSendCallback async
6. AI generates response via dispatchReplyWithBufferedBlockDispatcher
7. OpenClaw POSTs response to callbackUrl
8. KakaoTalk delivers AI response to user
```

---

## Known Behaviors

- **No callbackUrl**: The handler echoes the utterance back. This happens in the KakaoTalk developer console skill tester because `callbackUrl` is only sent when callback mode is enabled in KakaoTalk OBT settings. Production messages always include `callbackUrl` when the skill is configured for callback.
- **`getKakaoCfg()` returns null before first message**: `startAccount` must run (triggered by OpenClaw channel startup) before the HTTP handler can resolve the account. OpenClaw calls `startAccount` at startup if the channel is enabled.
