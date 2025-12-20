# Project Data Migration Plan: `isGit` Flag

## Objective
Introduce a boolean flag `isGit` to the `ProjectInfo` data structure to explicitly track whether a project originated from a Git repository (specifically GitHub) or was created locally. This simplifies logic by removing the need to constantly check for the existence of `repositoryUrl` or scan `.git/config` for basic differentiation.

## Data Structure Changes

### 1. Update `ProjectInfo` Interface
Modify `egdesk-scratch/src/renderer/services/projectContextService.ts`:

```typescript
export interface ProjectInfo {
  // ... existing fields ...
  
  // NEW FIELD
  isGit: boolean; // True if project is a Git repository (cloned or has remote)
  
  metadata: {
    // ... existing metadata ...
    repositoryUrl?: string; // Still useful for the actual link
  };
}
```

## Migration Strategy

### Phase 1: Update Service Logic (`ProjectContextService.ts`)

1.  **Modify `analyzeAndCreateProject`**:
    - When creating a *new* project, determine `isGit` status.
    - Logic:
      - If `extractGitRemoteUrl` returns a value -> `isGit = true`.
      - OR check for existence of `.git` folder -> `isGit = true` (even if no remote).
      - Otherwise -> `isGit = false`.

2.  **Update `loadContext` (The Migration Script)**:
    - This is where the data migration happens for *existing* users.
    - When loading projects from `localStorage`, check if the `isGit` property is missing.
    - **Migration Logic:**
      ```typescript
      parsed.availableProjects = parsed.availableProjects.map((p: any) => ({
        ...p,
        // BACKFILL LOGIC
        isGit: p.isGit ?? (!!p.metadata?.repositoryUrl || false), 
        // ... rest of hydration
      }));
      ```
    - *Note:* Since we can't synchronously re-scan filesystems during a simple `loadContext`, we rely on the existing `repositoryUrl` metadata for the initial backfill. A background "refresh" task could be triggered to verify deeper truth later.

### Phase 2: Update Project Creation Flow (`ProjectSelection.tsx`)

1.  **GitHub Clone Case:**
    - When the user provides a GitHub URL, explicitly set `isGit: true` when registering the project (if the service API allows passing partial info) OR ensure the post-creation analysis catches it.

2.  **Local Create Case:**
    - `isGit` defaults to `false`.

### Phase 3: UI Updates

1.  **Visual Indicators:**
    - In `ProjectSelection.tsx` (card view) and `ProjectSelector.tsx` (dropdown), use the `isGit` flag to show a GitHub icon or "Git" badge.
    - In `HomepageEditor.tsx`, use `project.isGit` to decide whether to show "Open Repository" buttons or "Local Preview" buttons.

## Implementation Steps

1.  **Step 1:** Modify `ProjectInfo` interface in `projectContextService.ts`.
2.  **Step 2:** Update `loadContext` to backfill `isGit` for existing projects.
3.  **Step 3:** Update `analyzeAndCreateProject` to populate `isGit` for new/refreshed projects.
4.  **Step 4:** (Optional) Add a "Repair/Refresh" button in settings that forces a re-analysis of all projects to correct any stale `isGit` flags (e.g., if a user initialized git manually in the terminal).

## Verification
- **Test A:** Open existing app -> Projects with valid repo URLs in metadata should now have `isGit: true`.
- **Test B:** Create new Local Project -> `isGit` should be `false`.
- **Test C:** Create new GitHub Project (Clone) -> `isGit` should be `true`.

