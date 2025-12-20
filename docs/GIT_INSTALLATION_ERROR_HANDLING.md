# Git Installation Check and Error Handling

## Overview

This document outlines the implementation of a pre-flight Git installation check to ensure a smooth user experience when cloning repositories from GitHub.

## Problem Statement

When users attempt to create a project from a GitHub URL without Git installed, the `git clone` operation fails with a cryptic error:

```
Command failed: git clone https://github.com/user/repo.git
fatal: 'git' is not recognized as an internal or external command
```

This provides no actionable guidance, leaving users confused about the root cause.

## Solution Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Renderer Process                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  ProjectSelection.tsx                                     │  │
│  │  - Calls window.electron.git.clone()                      │  │
│  │  - Catches GIT_NOT_INSTALLED error                        │  │
│  │  - Displays user-friendly modal with download link        │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │ IPC
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Main Process                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  ipcMain.handle('git-clone')                              │  │
│  │  1. Check Git availability (git --version)               │  │
│  │  2. If not found → return { error: 'GIT_NOT_INSTALLED' }  │  │
│  │  3. If found → proceed with git clone                     │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation Details

### 1. Main Process: Git Availability Check

**File:** `src/main/utils/git.ts`

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function isGitInstalled(): Promise<boolean> {
  try {
    await execAsync('git --version');
    return true;
  } catch {
    return false;
  }
}

export const GitError = {
  GIT_NOT_INSTALLED: 'GIT_NOT_INSTALLED',
  CLONE_FAILED: 'CLONE_FAILED',
  INVALID_URL: 'INVALID_URL',
} as const;
```

**File:** `src/main/main.ts`

```typescript
ipcMain.handle('git-clone', async (_event, { url, targetPath }) => {
  // Pre-flight check
  if (!(await isGitInstalled())) {
    return {
      success: false,
      error: GitError.GIT_NOT_INSTALLED,
      message: 'Git is not installed on this system.',
    };
  }

  // Proceed with clone operation
  try {
    await execAsync(`git clone ${url} "${targetPath}"`);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: GitError.CLONE_FAILED,
      message: error.message,
    };
  }
});
```

### 2. Renderer Process: Error Handling UI

**File:** `src/renderer/components/HomepageEditor/ProjectSelection/ProjectSelection.tsx`

```tsx
const handleCreateProject = async () => {
  const result = await window.electron.git.clone(githubUrl, targetPath);

  if (!result.success) {
    if (result.error === 'GIT_NOT_INSTALLED') {
      setShowGitMissingModal(true);
      return;
    }
    // Handle other errors...
  }
};
```

### 3. User-Facing Error Modal

```tsx
<Modal open={showGitMissingModal} onClose={() => setShowGitMissingModal(false)}>
  <div className="git-missing-modal">
    <h2>⚠️ Git Not Found</h2>
    <p>
      To clone projects from GitHub, Git must be installed on your system.
    </p>
    
    <h3>Installation Steps:</h3>
    <ol>
      <li>Download Git from <a href="https://git-scm.com/downloads">git-scm.com/downloads</a></li>
      <li>Run the installer with default settings</li>
      <li>Restart this application</li>
    </ol>
    
    <button onClick={() => shell.openExternal('https://git-scm.com/downloads')}>
      Download Git
    </button>
  </div>
</Modal>
```

## Platform-Specific Considerations

| Platform | Git Location | Notes |
|----------|--------------|-------|
| Windows  | `C:\Program Files\Git\bin\git.exe` | May require PATH configuration after install |
| macOS    | `/usr/bin/git` or via Homebrew | Xcode Command Line Tools includes Git |
| Linux    | `/usr/bin/git` | Install via package manager (`apt`, `yum`, etc.) |

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Git installed but not in PATH | Check fails; user prompted to reinstall or configure PATH |
| Partial/corrupted installation | `git --version` may fail; same handling as not installed |
| Network timeout during clone | Separate error type (`CLONE_FAILED`) with network-specific message |
| Invalid GitHub URL | Validate URL format before attempting clone |

## Testing Checklist

- [ ] Git not installed → Modal displays correctly
- [ ] Git installed → Clone proceeds normally
- [ ] Modal "Download Git" button opens correct URL
- [ ] Application restart detection after Git installation (optional enhancement)
- [ ] Cross-platform testing (Windows, macOS, Linux)

## Future Enhancements

1. **Auto-detection after install**: Poll for Git availability after user clicks download link
2. **Portable Git support**: Allow users to specify a custom Git executable path
3. **Alternative clone methods**: Offer GitHub API download as fallback (for public repos)

---

