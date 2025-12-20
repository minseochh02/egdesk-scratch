# Goal: Disable Automatic PHP/Local Server Startup on Project Open

## Objective
Prevent the application from automatically starting a local PHP/web server (and the associated localhost preview) immediately when a project is selected in the Homepage Editor. The desired behavior is to simply open the project context (for AI chat/editing) and optionally open the repository URL if available, without spinning up a local server unless explicitly requested.

## Current Behavior
1. **Selection:** User selects a project in `ProjectSelection`.
2. **Context Update:** `ProjectContextService` updates the current project.
3. **Editor Response:** `HomepageEditor` listens to context changes.
4. **Auto-Start Logic:** Inside `HomepageEditor`, `handleAutoStartServer` is triggered.
   - It checks if the project is "suitable" (web/WordPress).
   - If suitable, it calls `startLocalServer` (which spawns the PHP process).
   - It then opens a preview window (which we recently changed to prioritize the repo URL, but the server still starts).

## Required Changes

### 1. Modify `HomepageEditor.tsx`
- **Disable Auto-Start:** entirely remove or comment out the call to `handleAutoStartServer` inside the `useEffect` that listens to project context changes.
- **Retain Repo Opening (Optional/Conditional):** If the user still wants the *link* to open but not the *server*, we need to separate these concerns. The current request implies "it still starts php, i do not want this behavior," which strongly suggests stopping the process spawning.
- **Manual Start Option:** Ensure the UI (which already exists but might be hidden or unused) allows the user to *manually* start the server if they actually need to preview the site locally later.

### 2. Refine `ProjectContextService.ts` (if needed)
- Ensure that the metadata analysis doesn't trigger side effects that start servers (currently it doesn't, so this is likely safe).

### 3. Cleanup
- Verify that no other components (like `AIChatInterface`) are presuming a running server and trying to start one.

## Project Type Differentiation
The system differentiates between GitHub projects and local projects primarily through the `ProjectContextService` analysis:

1. **GitHub Project Detection:**
   - During project analysis, `ProjectContextService.extractGitRemoteUrl` reads the `.git/config` file in the project folder.
   - It parses the `[remote "origin"]` section to find the `url` property.
   - If a valid URL is found (e.g., `https://github.com/...` or `git@github.com:...`), it is stored in the project's metadata as `repositoryUrl`.
   - The UI can then check `project.metadata.repositoryUrl` to determine if it's a connected GitHub project.
   - Additionally, during project creation in the `ProjectSelection` UI, if the user inputs a GitHub URL directly, the system recognizes it via regex (`isGithubUrl`), prompts for a destination folder, and instructs the AI to clone the repository.

2. **Local Project:**
   - If no `.git/config` exists, or no remote origin URL is found, `repositoryUrl` remains undefined.
   - These are treated as purely local projects (even if they are Git repositories without a remote).

## Implementation Plan
1. **Locate `handleAutoStartServer` call in `HomepageEditor.tsx`**: This is the trigger.
2. **Remove/Disable the Trigger**: Stop calling this function on project load.
3. **Preserve URL Opening (If Desired)**: If the goal is "Open Project -> Open Repo URL" but *not* "Start Server", we should extract the "Open Repo URL" logic into its own standalone function that runs on project select, independent of the server status.
4. **Verify Manual Controls**: Check that the "Start Server" button in the AI Chat interface still works so the user can opt-in to the server later.

