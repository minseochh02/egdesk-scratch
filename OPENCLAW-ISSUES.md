# OpenClaw Known Issues

## Issue 1 — Kakao plugin not bundled in production app
**Status:** Open  
**Discovered:** 2026-05-26 (Windows PC testing)

The `resources/openclaw-kakao-plugin` folder is configured in `extraResources` in `package.json`, but the plugin is **not making it into the production build**. This causes a chain of failures:
- `openclaw plugins install --force <path>` fails because the path doesn't exist in the installed app
- Plugin never gets installed → `~/.openclaw/extensions/kakao` is empty
- Gateway starts but Kakao channel never loads
- `npm install --production` step for zod/deps is never reached

**Root cause to investigate:**
- Is `resources/openclaw-kakao-plugin/dist/channel.js` present at build time? (bundle script must run first via `prebuild`)
- Does `package:win` correctly trigger `prebuild` → `bundle:kakao-plugin`?
- Does electron-builder silently skip `extraResources` entries that are missing?

**Workaround:**
Manually copy the plugin folder to the Windows machine and point `openclaw plugins install --force` at it. Then run `npm install --production` in `%USERPROFILE%\.openclaw\extensions\kakao`.

---

## Issue 2 — Telegram pairing not waiting for gateway to be ready
**Status:** Open  
**Discovered:** 2026-05-26 (Windows PC testing)

The `/start` pairing flow sends the Telegram message before the gateway is fully up and able to process the pairing request. The gateway must be running and connected to Telegram **before** `/start` is sent — otherwise no pairing challenge is issued and no code appears.

Current flow polls `openclaw channels status` for up to 45s waiting for `Gateway reachable`, but the Telegram channel itself may still be initializing (as seen in logs — auth takes 84s on slow networks).

**Related:** The browser automation types `/start` without dismissing Telegram's autocomplete, which can cause the wrong command (e.g. `/status`) to be sent. Fix already applied (Escape before Enter).

**Fix needed:**
- Poll specifically for `[telegram]` channel being ready, not just gateway reachable
- Consider increasing the gateway readiness timeout on slow networks

---

## Issue 3 — Telegram allowedUsers hardcoded / not set correctly
**Status:** Needs investigation  
**Discovered:** 2026-05-26 (Windows PC testing)

Bot responds to one Telegram account but not others. Likely `allowedUsers` in `openclaw.json` under `channels.telegram` only contains the developer's Telegram user ID.

**Check:** Look for `allowedUsers`, `whitelist`, or similar field under `channels.telegram` in `~/.openclaw/openclaw.json`.

**Fix needed:**
- Either remove the restriction to allow all users
- Or expose this as a config option in the EGDesk UI

---

## Issue 4 — `openclaw plugins install` command rejected on Windows
**Status:** Open  
**Discovered:** 2026-05-26 (Windows PC testing)

Running `openclaw plugins install --force "<path>"` on Windows throws an error saying the plugin is not valid, even with a correct path. Same command works fine on Mac.

**Possible causes:**
- Path format differences (backslashes, spaces)
- Plugin `package.json` missing a Windows-required field
- openclaw CLI version difference between Mac and Windows

**To investigate:** Compare exact error message and plugin `package.json` contents.
