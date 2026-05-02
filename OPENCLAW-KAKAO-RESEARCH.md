# OpenClaw × KakaoTalk — Research Notes

## What We Know For Certain

### OpenClaw Gateway
- Runs on `ws://localhost:18789` (WebSocket) and `http://localhost:18789` (HTTP)
- Auth mode: token, stored in `~/.openclaw/openclaw.json` under `gateway.auth.token`
- Token value: `fcf3bbff328cca4fa69daabf8990b11fbd725e8a89191b14`
- Bind: loopback only (not exposed to network)
- Only agent installed: `main` (at `~/.openclaw/agents/main/`)

### WebSocket Protocol (confirmed working)
- Gateway sends `connect.challenge` event before accepting connect
- Must capture nonce from challenge and send `connect` in response
- Valid `client.id`: `"cli"`, `"node-host"`, `"gateway-client"`, etc. (NOT custom strings)
- Valid `client.mode`: `"backend"`, `"cli"`, `"node"`, etc. (NOT `"operator"`)
- Auth token goes inside `params.auth: { token }` in the connect message
- Do NOT include a `device` object unless you have publicKey/signature — it triggers required field validation
- WS connect with `operator.read` scope works and returns `ok: true`

### Scope Problem
- The gateway token only grants `operator.read` scope
- `sessions.send` (the method to inject a message into a session) requires `operator.write`
- Requesting `operator.write` in connect scopes is rejected: `"missing scope: operator.write"`
- No known way yet to get `operator.write` from the current token

### OpenClaw Hooks System (confirmed via `openclaw hooks list`)
- Hooks are **in-process lifecycle events**, NOT HTTP webhook endpoints
- Built-in hooks: `boot-md`, `bootstrap-extra-files`, `command-logger`, `session-memory`
- Hook categories: agent turn, tool execution, message delivery, session & lifecycle
- Registered via `api.on("hook_name", handler)` in a plugin's `register()` function
- `gateway_start` / `gateway_stop` hooks exist for managing services

### HTTP Endpoints (confirmed via curl)
- `POST http://localhost:18789/hooks/kakao` → 404 (does not exist)
- No `/hooks` HTTP endpoint in this version of OpenClaw

### openclaw.json Config
- OpenClaw uses Zod schema validation and rewrites the config file
- Unknown keys are silently dropped when OpenClaw rewrites the file
- Adding `gateway.hooks` array → gets stripped on next write

### Plugin SDK (`openclaw/plugin-sdk`)
- **Exported and usable**: `emptyPluginConfigSchema`, `ChannelPlugin`, `OpenClawPluginApi`, `PluginRuntime`, `OpenClawConfig`, `HookEntry`, `ReplyPayload`
- **NOT exported** (missing from SDK): `DEFAULT_ACCOUNT_ID`, `registerPluginHttpRoute`
- Plugin entry: `definePluginEntry({ id, register(api) {} })`  
  (or: `export default { id, name, configSchema, register(api) {} }`)
- `api.runtime` gives access to `PluginRuntime`
- `api.registerChannel({ plugin })` registers a channel plugin

### openclaw-kakao-plugin (github.com/HariFatherKR/openclaw-kakao-plugin)
- Uses `registerPluginHttpRoute` to register `/kakao/skill` inside OpenClaw's HTTP server
- Uses `runtime.channel.reply.dispatchReplyWithBufferedBlockDispatcher` to dispatch to AI and get reply
- Uses `DEFAULT_ACCOUNT_ID` as a constant for the default account
- **Cannot compile** against current OpenClaw because `registerPluginHttpRoute` and `DEFAULT_ACCOUNT_ID` are not in the SDK
- The `dispatchReplyWithBufferedBlockDispatcher` call is what actually sends the message to the AI and captures the response — this is the key API we want

### Correct Plugin SDK API (from docs.openclaw.ai/plugins/sdk-channel-plugins)

The plugin repo used the WRONG API surface. Here is what the SDK actually provides:

**HTTP route registration** — done via `api.registerHttpRoute(...)` inside `registerFull(api)`:
```typescript
export default defineChannelPluginEntry({
  id: "kakao",
  name: "카카오톡",
  plugin: kakaoPlugin,
  registerFull(api) {
    api.registerHttpRoute({
      path: "/kakao/skill",
      auth: "plugin",
      handler: async (req, res) => { ... },
    });
  },
});
```
NOT `registerPluginHttpRoute` (that doesn't exist).
NOT `register(api)` (that's the old/wrong entry point).

**`DEFAULT_ACCOUNT_ID`** — comes from `openclaw/plugin-sdk/setup`, NOT from `openclaw/plugin-sdk`:
```typescript
import { DEFAULT_ACCOUNT_ID } from "openclaw/plugin-sdk/setup";
```

**Narrow import paths** available in the SDK:
- `openclaw/plugin-sdk/setup` — `DEFAULT_ACCOUNT_ID`, setup helpers
- `openclaw/plugin-sdk/inbound-envelope` — inbound message handling
- `openclaw/plugin-sdk/inbound-reply-dispatch` — reply dispatch
- `openclaw/plugin-sdk/account-core`, `/account-resolution`, `/account-helpers`
- `openclaw/plugin-sdk/outbound-media`, `/outbound-runtime`
- `openclaw/plugin-sdk/channel-mention-gating`
- `openclaw/plugin-sdk/approval-*` variants

**Entry point functions:**
- `defineChannelPluginEntry({ id, name, plugin, registerFull(api) {} })` — full runtime
- `defineSetupPluginEntry(plugin)` — setup-only (avoids loading runtime during onboarding)

### What We Do NOT Know Yet
- Whether `PluginRuntime` actually has `channel.reply.dispatchReplyWithBufferedBlockDispatcher` (used in plugin source, not verified in type defs)
- What `ChannelGatewayContext` contains
- Whether there is any other way to get `operator.write` scope
- Full spec of `PluginRuntime` and what's on `api` inside `registerFull` — docs say to check https://docs.openclaw.ai/llms.txt

### Current State of EGDesk Code
- `askOpenClaw()` in `local-server-manager.ts` currently uses the hybrid approach:
  - WS connect (read-only, works)
  - Then POSTs to `http://localhost:18789/hooks/kakao` (returns 404 — broken)
- This needs to be fixed regardless of which approach we choose
