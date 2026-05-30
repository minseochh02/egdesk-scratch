# Antigravity 2.0 Desktop Integration (EGDesk Coding)

## Overview

EGDesk Coding opens the user's project in **Google Antigravity** instead of an embedded preview window. This document records what we learned about Antigravity 2.0 **Desktop**, what EGDesk currently does, why launch often fails silently, and what to try next.

**Status:** Registration works; auto-open/focus does not. Next step: reverse-engineer `agyhub_summaries_proto.pb` or find a deep-link trigger.

---

## User environment (confirmed)

| Item | Value |
|------|-------|
| App | `/Applications/Antigravity.app` v2.0.10 |
| Bundle ID | `com.google.antigravity` |
| Product | Antigravity 2.0 **Desktop** (Electron + language server) |
| VS Code-style CLI | **Not present** — no `Contents/Resources/app/bin/antigravity` or `agy` |
| Binaries in bundle | `Contents/Resources/bin/language_server`, `webm_encoder` |
| URL scheme | `antigravity://` (registered; format for project open TBD) |

Antigravity 2.0 split **Desktop** (hub UI) from the older **IDE** (VS Code fork). EGDesk must target Desktop on macOS for users who only installed the main app.

---

## EGDesk flow today

When the user selects a project in Coding:

1. **`requireAntigravity()`** — block if app not installed; offer install page.
2. **`writeAntigravityContext()`** — write dev port context to:
   - `.agents/rules/egdesk-dev-context.md`
   - Managed section in `AGENTS.md` (`<!-- BEGIN:egdesk-dev-context -->` … `<!-- END:egdesk-dev-context -->`)
3. **`registerAntigravityProject()`** — create/reuse project in Antigravity registry.
4. **`launchAntigravityDesktop()`** — spawn macOS launcher with folder path.

**Main implementation:** `src/main/coding/open-antigravity.ts`

**IPC handlers:**

- `coding:check-antigravity`
- `coding:open-antigravity-install` → https://antigravity.google/download
- `coding:open-antigravity` → `{ folderPath, port, mode, url, projectName }`

**Dev ports:** `src/shared/coding-ports.ts` — coding uses 4000–4099 (default 4000); hosting uses 3000–3099.

---

## What EGDesk writes (project registration)

### Project registry JSON

Path: `~/.gemini/config/projects/{uuid}.json`

Example (oneconductor):

```json
{
  "id": "7a91f4ce-6471-4200-a575-2f39c338a798",
  "name": "oneconductor",
  "projectResources": {
    "resources": [{
      "gitFolder": {
        "folderUri": "file:///Users/minseocha/Desktop/oneconductor",
        "defaultBranch": "main"
      }
    }]
  },
  "settings": {
    "fileAccessPolicy": "AGENT_SETTING_POLICY_ASK",
    "internetPolicy": "AGENT_SETTING_POLICY_ASK",
    "autoExecutionPolicy": "CASCADE_COMMANDS_AUTO_EXECUTION_OFF",
    "artifactReviewMode": "ARTIFACT_REVIEW_MODE_ALWAYS"
  }
}
```

EGDesk reuses an existing UUID if the same `folderUri` is already registered (avoids duplicates).

### Electron app storage

Path: `~/Library/Application Support/Antigravity/app_storage.json`

```json
{
  "ide-install-wizard-shown": "true",
  "lastCreatedProjectId": "7a91f4ce-6471-4200-a575-2f39c338a798"
}
```

EGDesk sets `lastCreatedProjectId` on every open. **Alone, this does not open or focus the project.**

### Dev context in the repo

EGDesk env vars passed on launch (when spawn succeeds):

- `EGDESK_DEV_PORT`
- `EGDESK_DEV_URL`
- `EGDESK_DEV_MODE`

Antigravity agents can read these plus `AGENTS.md` / `.agents/rules/egdesk-dev-context.md`. Verified: after a conversation, Antigravity read `AGENTS.md` and acknowledged port 4000.

---

## Launch attempts and observed behavior

### Current macOS launch command

```
open -na "Antigravity" --args /absolute/path/to/project
```

**Logs show success:**

```
[open-antigravity] Registered project 7a91f4ce-… → /Users/minseocha/Desktop/oneconductor
[open-antigravity] Launchers: ide=none, desktop=/Applications/Antigravity.app/Contents/MacOS/Antigravity
[open-antigravity] Launching desktop: open -na "Antigravity" --args …
[open-antigravity] Desktop launch spawned (pid=…)
[open-antigravity] Opened via desktop (…)
```

**User experience:** Dock icon bounces briefly, then nothing — Antigravity does not switch to the project.

### Why folder-path launch likely fails

From Antigravity's extracted `dist/main.js` (Electron shell):

- Deep links: `antigravity://…` via `open-url`, argv, or `second-instance` handler.
- **No handler for a plain filesystem path in argv.**
- UI loads from language server: `https://127.0.0.1:{dynamicPort}/`.

So `open -na … --args /path` probably triggers a second instance that hands off to the running process and **drops the folder argument**.

### IDE-style launch (not available here)

If `antigravity` / `agy` CLI existed:

```
antigravity --new-window /path/to/project
```

That path is used when detected; this user's install has **no IDE launcher**.

---

## Experiments and findings

### Experiment 1: Manual project select → quit

| Step | Result |
|------|--------|
| User selects project in Antigravity UI | Works in session |
| User quits (Cmd+Q) | **No new keys** in `app_storage.json`, project JSON, or `antigravity_state.pbtxt` |
| Files touched on quit | None (excluding Electron caches) |

**Conclusion:** Selecting a project in the UI alone is **not** persisted to the JSON/protobuf files EGDesk can easily write.

### Experiment 2: Start conversation → quit → reopen

| Step | Result |
|------|--------|
| User starts conversation: *"This project runs on port 4000"* on oneconductor | New files under `~/.gemini/antigravity/` |
| User quits and reopens Antigravity | **Project is selected** on cold start |

**Conclusion:** Persistence requires **conversation / hub state**, not just project registry + `lastCreatedProjectId`.

### Files created when a conversation starts

| Path | Role |
|------|------|
| `~/.gemini/antigravity/agyhub_summaries_proto.pb` | **Hub index** — links cascade/conversation → folder → project UUID |
| `~/.gemini/antigravity/conversations/{cascadeId}.pb` | Full conversation protobuf |
| `~/.gemini/antigravity/brain/{cascadeId}/.system_generated/logs/transcript.jsonl` | Human-readable transcript |
| `~/.gemini/antigravity/annotations/{cascadeId}.pbtxt` | e.g. `last_user_view_time` |
| `~/.gemini/antigravity/antigravity_state.pbtxt` | Global state; gains `last_selected_agent_model` after chat |

### `agyhub_summaries_proto.pb` (decoded wire format)

Observed top-level structure (reverse-engineered May 2026):

```text
message AgyHubSummariesFile {
  repeated SummaryEntry entries = 1;
}

message SummaryEntry {
  string cascade_id = 1;   // conversation/cascade UUID
  Summary summary = 2;
}

message Summary {
  string title = 1;
  int32 status = 2;              // 12 observed for active conversation
  Timestamp updated_at = 3;
  string session_id = 4;
  int32 flag = 5;                // 1
  Timestamp created_at = 7;
  WorkspaceResource workspace = 9;
  Timestamp last_activity = 10;
  LastViewWrapper last_view = 15; // nested timestamp in field 7
  int32 zero = 16;               // 0
  ProjectLink project = 17;
  int32 kind = 22;               // 4 observed
}

message ProjectLink {
  WorkspaceResource workspace = 1;
  Timestamp linked_at = 2;
  string resource_id = 3;
  string folder_uri = 7;
  // field 15: optional binary UI blob (332 bytes in real conversation — skipped in EGDesk stub)
  string project_id = 18;        // matches ~/.gemini/config/projects/{id}.json
}
```

EGDesk writes this via `src/main/coding/agyhub-summaries.ts` (`upsertAgyHubSummary`) before launching Antigravity.

---

```
Cascade ID:   0c1cd48c-29c0-4ffd-a984-271ac0435188
Title:        Configuring Local Development Port
Folder:       file:///Users/minseocha/Desktop/oneconductor
Git remote:   https://github.com/Charismagreat/oneconductor.git
Branch:       main
Project ID:   7a91f4ce-6471-4200-a575-2f39c338a798
```

Other UUIDs appear inside the blob (resource/workspace IDs). Format is **protobuf**, not JSON.

Hex tail shows project ID as a length-prefixed string field:

```
… 92 01 24 37 61 39 31 66 34 63 65 …  →  field tag + "$7a91f4ce-6471-4200-a575-2f39c338a798"
```

### `antigravity_state.pbtxt` (global, text protobuf)

Lives at `~/.gemini/antigravity/antigravity_state.pbtxt`. Example after conversation:

```text
post_onboarding: { … }
seen_nuxs: { uids: 23 }
agent_onboarding_completed: AGENT_ONBOARDING_STATE_COMPLETED
last_selected_agent_model: MODEL_PLACEHOLDER_M20
migrate_convos_into_projects: MIGRATION_STATUS_COMPLETED
installation_uuid: "238569c6-87ee-4cd9-bde4-be8ce5577fb4"
migrate_retroactive_projects: RETROACTIVE_MIGRATION_STATUS_COMPLETED_UNNECESSARY
```

No project ID field observed here.

### Antigravity internal UI state

JS bundle references (from Electron Code Cache): `selectedProjectId`, `contextProjectId`, `setContextProjectId`, `lastSelectedAgentModel`. These likely live in **in-memory / IndexedDB** on the LS origin (`https://127.0.0.1:51631/`), not in plain JSON on disk.

### Deep links

Electron shell supports `antigravity://` but the **path format for opening a project is unknown**. Attempts like `antigravity://open?folder=…` were inconclusive. Worth searching `app.asar` `dist/main.js` and language_server strings after protobuf work.

---

## Summary table: what persists project selection?

| Mechanism | EGDesk writes? | Restores project on reopen? |
|-----------|----------------|----------------------------|
| `~/.gemini/config/projects/{id}.json` | Yes | No (alone) |
| `app_storage.json` → `lastCreatedProjectId` | Yes | No (alone) |
| CLI folder path `--args /path` | Tried | No |
| UI project select (no conversation) | N/A | No |
| `agyhub_summaries_proto.pb` + conversation files | No | **Yes** |
| `antigravity://` deep link | Not yet | Unknown |

---

## Logging (debugging)

| Where | What to search |
|-------|----------------|
| EGDesk dev terminal (`npm start`, `[1]` prefix) | `[open-antigravity]` |
| EGDesk Coding chat UI | Error banner if open fails |
| `~/Library/Logs/Antigravity/main.log` | Electron startup, LS port |
| `~/Library/Logs/Antigravity/language_server.log` | LS startup, auth, migrations |
| `~/.gemini/config/projects/` | Project JSON created? |
| `~/Library/Application Support/Antigravity/app_storage.json` | `lastCreatedProjectId` |
| `~/.gemini/antigravity/agyhub_summaries_proto.pb` | Hub index after conversation |

---

## Next steps

### 1. Crack `agyhub_summaries_proto.pb` (implemented — partial)

EGDesk writes hub entries via `agyhub-summaries.ts`. **Hub alone is not sufficient** if another project still has a live `conversations/{cascadeId}.pb` (Antigravity restores that session instead).

**Also implemented** in `antigravity-session.ts`:

- Reuse cascade id from meta / hub / brain transcripts
- Archive other projects' conversation `.pb` files to `conversations/.egdesk-archived/`
- Quit Antigravity before relaunch so disk state is re-read

Tasks remaining:

- [ ] Confirm cold relaunch opens the correct project when no conversation exists for others
- [ ] If hub-only still fails, reverse-engineer minimal `conversations/{cascadeId}.pb` stub

### 2. Deep link fallback

- [ ] Grep `app.asar` and LS for `antigravity://` route handlers in the web UI.
- [ ] Test `open "antigravity://…"` with project UUID after registration.

### 3. Launch behavior fixes (quick wins)

- [ ] Prefer `open -a Antigravity` over `open -na` when app already running (avoid dock bounce / second-instance handoff).
- [ ] Pass `antigravity://…` on argv if format found (Electron reads `process.argv` for deep links).

### 4. UX fallback (if protobuf/deep link fail)

- [ ] Show notice: *"Project registered in Antigravity — select **{name}** in Projects."*
- [ ] Optionally copy project name / open Antigravity to foreground only.

### 5. Optional: Antigravity IDE detection

Separate detection for VS Code-style **Antigravity IDE** vs **Desktop**; use IDE CLI when available.

---

## Related code

| File | Role |
|------|------|
| `src/main/coding/open-antigravity.ts` | Registration, context, launch |
| `src/renderer/utils/requireAntigravity.ts` | Install gate |
| `src/renderer/components/HomepageEditor/ProjectSelection/ProjectSelection.tsx` | Gate on project select |
| `src/renderer/components/HomepageEditor/HomepageEditor.tsx` | Dev server auto-start gate |
| `src/renderer/components/HomepageEditor/AIChatInterface/AIChat.tsx` | `openProjectInAntigravity()` |
| `src/shared/coding-ports.ts` | Port ranges |

---

## References on disk (this machine)

```
/Applications/Antigravity.app
~/.gemini/config/projects/
~/.gemini/antigravity/agyhub_summaries_proto.pb
~/.gemini/antigravity/antigravity_state.pbtxt
~/Library/Application Support/Antigravity/app_storage.json
~/Library/Logs/Antigravity/
```

Extracted Electron main process (for deep link behavior): `app.asar` → `dist/main.js` (`handleDeepLink`, `second-instance`, `open-url`).
