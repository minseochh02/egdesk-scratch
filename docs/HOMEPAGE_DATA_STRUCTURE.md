# Homepage Data Flow & Structure

## Overview
This document outlines the data structure and flow for managing projects within the Homepage Editor, specifically focusing on how projects are registered, differentiated (Local vs. GitHub), and persisted.

## Data Structure

### Project Info (`ProjectInfo` Interface)
The core data model for a project is the `ProjectInfo` interface defined in `ProjectContextService`.

```typescript
interface ProjectInfo {
  id: string;              // Unique identifier (generated hash of path)
  name: string;            // Display name
  path: string;            // Local filesystem path (root of project)
  type: 'wordpress' | 'web' | 'node' | 'python' | 'java' | 'cpp' | 'other';
  description?: string;
  lastAccessed: Date;
  isActive: boolean;
  isInitialized: boolean;
  createdAt: Date;
  
  // METADATA
  metadata: {
    // Structural Flags (auto-detected)
    hasWordPress?: boolean;
    hasPackageJson?: boolean;
    // ... other language flags
    
    // Versioning
    version?: string;
    
    // Repository Info (The Key Differentiator)
    repositoryUrl?: string; // If present, treated as a connected repo. If absent, local.
    
    // Initialization State
    hasBackupFolder?: boolean;
    initializationDate?: Date;
    initializationStatus?: 'pending' | 'completed' | 'failed';
  };
}
```

## Project Registration Flow

The differentiation between a **Local Project** and a **GitHub Project** happens explicitly at the entry point (User UI) and is persisted into the metadata during the registration process.

### 1. User Entry Point (`ProjectSelection.tsx`)
The user is presented with a "New Project" form.
- **Input:** User enters a string into the "Project Path" field.
- **Differentiation Logic:**
  - The system checks the input using a regex: `isGithubUrl(input)`.
  - **Case A: GitHub URL** (e.g., `https://github.com/user/repo`)
    - The UI detects this is a remote repo.
    - It prompts for a secondary "Destination Folder".
    - The system *knows* this is a GitHub project intent.
  - **Case B: Local Path** (e.g., `/Users/me/projects/my-app`)
    - The UI detects this is a local path.
    - No secondary input is needed.
    - The system *knows* this is a local project intent.

### 2. Service Registration (`ProjectContextService.ts`)
When `handleCreateProject` is called:

#### For GitHub Projects:
1.  **Target Path:** The "Destination Folder" becomes the project `path`.
2.  **Registration:** `ProjectContextService.setCurrentProject(targetPath)` is called.
3.  **Metadata Injection (Proposed Improvement):** 
    - Currently, the service auto-analyzes the folder *after* creation.
    - **Optimized Flow:** We should pass the `repositoryUrl` explicitly during creation if it's a known clone operation, OR ensure the cloning happens *before* final metadata analysis so the `.git/config` is detected naturally.
    - **Initialization:** An AI Agent is spawned with a prompt: "Clone [URL] into [Path] and initialize."

#### For Local Projects:
1.  **Target Path:** The input path is the project `path`.
2.  **Registration:** `ProjectContextService.setCurrentProject(targetPath)` is called.
3.  **Analysis:** The service scans the folder. Since it's local (and potentially empty or just created), no `.git/config` might exist yet. `repositoryUrl` remains `undefined`.
4.  **Initialization:** An AI Agent is spawned with a prompt: "Initialize project in [Path]."

### 3. Persistence & State
- **Storage:** The `ProjectContextService` saves the `ProjectInfo` (including the `metadata.repositoryUrl`) to `localStorage`.
- **Restoration:** On app reload, `loadContext` reads this JSON.
  - Projects with a valid `metadata.repositoryUrl` are hydrated as **GitHub Projects**.
  - Projects without it are hydrated as **Local Projects**.

## Behavior Differentiation
Once registered, the system uses this persisted `repositoryUrl` to decide behavior:
- **Opening Project:** 
  - If `repositoryUrl` exists: Open the browser to that URL (instead of localhost).
  - If `repositoryUrl` is missing: Do nothing (or open localhost if manually started).
- **AI Context:** The AI knows if it's working with a remote repo context vs. a local-only sandbox.

## Summary
The "Source of Truth" is the `project.metadata.repositoryUrl` field. 
- It is populated **automatically** via `.git/config` scanning for existing folders.
- It should be populated **explicitly** (or via the clone-then-scan workflow) during new project creation from a URL.

