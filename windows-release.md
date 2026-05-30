# Windows release guide (local PC)

Use this when GitHub Actions minutes are exhausted or you want a manual Windows build. EGDesk has native dependencies (`better-sqlite3`, `ssh2`, `serialport`, etc.), so the installer should be built on **Windows**, not cross-compiled from macOS.

Repository: [minseochh02/egdesk-scratch](https://github.com/minseochh02/egdesk-scratch)

---

## Prerequisites

Install on the Windows PC:

| Tool | Version / notes |
|------|-----------------|
| [Git](https://git-scm.com/download/win) | Latest |
| [Node.js](https://nodejs.org/) | **22.x** (matches CI `.github/workflows/publish.yml`) |
| npm | Bundled with Node (project expects npm 7+) |
| [GitHub CLI](https://cli.github.com/) (optional) | For `gh release` uploads |
| Build tools | Visual Studio Build Tools or “Desktop development with C++” workload (needed for native module compile) |

Verify:

```powershell
node -v    # v22.x
npm -v
git --version
```

Log in to GitHub (for publishing):

```powershell
gh auth login
```

Or set a personal access token with `repo` scope:

```powershell
$env:GH_TOKEN = "ghp_xxxxxxxx"
```

---

## 1. Get the code

Fresh clone:

```powershell
cd $env:USERPROFILE\Desktop
git clone https://github.com/minseochh02/egdesk-scratch.git
cd egdesk-scratch
git checkout main
git pull
```

Or sync an existing folder:

```powershell
cd path\to\egdesk-scratch
git pull origin main
```

---

## 2. Production environment file

The packaged app bundles `.env.production` as `.env` inside the installer. Create it in the repo root **before** building.

**`egdesk-scratch\.env.production`** (example — use your real values):

```env
# Production Environment Variables
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

Do not commit this file if it contains secrets (keep it local on the Windows machine).

---

## 3. Bump version (if releasing a new version)

Current app version lives in:

- `package.json` → `"version"`
- `src/renderer/App.tsx` → `EGDesk Version: x.y.z` (update to match)

Example bump to patch release:

```powershell
npm version patch -m "Release v%s"
```

That updates `package.json` / `package-lock.json` and creates a git tag like `v1.3.49`.

Manually edit `App.tsx` so the displayed version matches, then commit:

```powershell
git add package.json package-lock.json src/renderer/App.tsx
git commit -m "Release v1.3.49"
git push origin main
git push origin v1.3.49
```

Skip this section if you are only rebuilding an existing tag.

---

## 4. Install dependencies

First install can take several minutes (native rebuild + DLL build):

```powershell
npm install
```

This runs `postinstall` (native deps + `build:dll`). If install fails on native modules, install [windows-build-tools](https://github.com/nodejs/node-gyp#on-windows) or Visual Studio Build Tools, then retry `npm install`.

---

## 5. Build the Windows installer

### Option A — Build only (no GitHub upload)

Output goes to `release\build\` (NSIS `.exe` for x64):

```powershell
npm run package:win
```

Artifacts example:

- `release\build\egdesk Setup 1.3.49.exe`
- `release\build\latest.yml` (auto-update metadata, if generated)

### Option B — Build and publish to GitHub Releases

Requires `GH_TOKEN` (or `gh auth login`). Uses `electron-builder` config in `package.json` (`owner`: `minseochh02`, `repo`: `egdesk-scratch`).

```powershell
$env:GH_TOKEN = "ghp_xxxxxxxx"   # or rely on gh auth

npm run npm:bundle
npm run build
npx electron-builder --publish always --win
```

`--publish always` creates or updates a GitHub Release for the version in `package.json` and uploads the installer.

---

## 6. Manual upload (if you used Option A)

Create a release and attach the installer:

```powershell
gh release create v1.3.49 `
  "release\build\egdesk Setup 1.3.49.exe" `
  --repo minseochh02/egdesk-scratch `
  --title "v1.3.49" `
  --notes "Windows release built locally."
```

Or upload to an existing release:

```powershell
gh release upload v1.3.49 "release\build\*.exe" --repo minseochh02/egdesk-scratch
```

---

## 7. After release

- Confirm the release on GitHub: **Releases** → correct tag and `.exe` asset.
- If `sync-release.yml` is enabled, publishing may mirror assets to the public repo (needs `PUBLIC_REPO_TOKEN` secret on GitHub).
- Test the installer on a clean Windows user account if possible.

---

## Troubleshooting

| Problem | What to try |
|---------|-------------|
| `node-gyp` / native module errors | Install Visual Studio Build Tools; run `npm run rebuild` in repo root |
| Missing `.env` in installed app | Ensure `.env.production` exists in repo root before `package:win` |
| Publish 401 / 403 | Regenerate `GH_TOKEN` with `repo` scope; `gh auth status` |
| Version mismatch in UI | Update `App.tsx` version string to match `package.json` |
| Out of disk space | `release\build` and `node_modules` are large; free several GB |

---

## Quick reference

```powershell
# Full local build (no publish)
npm install
npm run package:win

# Full build + GitHub Release
$env:GH_TOKEN = "..."
npx electron-builder --publish always --win
```

**Do not use** `npm run package:win` on macOS for production Windows releases — use this guide on Windows instead.
