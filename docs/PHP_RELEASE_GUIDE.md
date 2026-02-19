# PHP Binaries Release Guide

This guide explains how to package and upload PHP binaries to GitHub releases for the optional PHP download feature.

## Overview

The EGDesk app no longer bundles PHP in the installation package. Instead, users can download PHP on-demand when they need the Homepage Editor feature. This reduces the app size by 384MB (76% smaller).

PHP binaries are hosted on GitHub releases and downloaded automatically when users click the "Download PHP" button.

---

## Prerequisites

Before you begin, ensure you have:

1. **Git repository access** - Write access to the GitHub repository
2. **PHP bundles ready** - The `php-bundle/` directory contains PHP binaries for all platforms
3. **GitHub CLI (optional)** - For automated uploads via command line
   - Install: `brew install gh` (macOS) or visit https://cli.github.com

---

## Step 1: Package PHP Binaries

### 1.1 Run the Packaging Script

From the project root directory, run:

```bash
./scripts/release/prepare-php-assets.sh
```

This script will:
- Create archives for each platform (tar.gz for Unix, zip for Windows)
- Generate SHA256 checksums
- Place all files in `release/php-assets/`

### 1.2 Verify the Output

Check that the following files were created:

```bash
ls -lh release/php-assets/
```

Expected files:
```
php-macos-arm64.tar.gz     (~38MB)  - macOS Apple Silicon
php-macos-x64.tar.gz       (~58MB)  - macOS Intel
php-windows-x64.zip        (~114MB) - Windows 64-bit
php-linux-x64.tar.gz       (~16MB)  - Linux 64-bit
php-checksums.txt          - SHA256 checksums
```

**Note**: Some platforms may be missing if you don't have the corresponding PHP bundles.

---

## Step 2: Upload to GitHub Releases

You can upload using either the **GitHub CLI** (recommended) or the **GitHub Web Interface**.

### Option A: Using GitHub CLI (Recommended)

#### 2.1 Login to GitHub CLI

```bash
gh auth login
```

Follow the prompts to authenticate.

#### 2.2 Create a New Release

```bash
gh release create v1.0.0-php \
  --title "PHP Binaries for EGDesk" \
  --notes "PHP 8.3 binaries for optional download in EGDesk Homepage Editor" \
  release/php-assets/*
```

**Important**: The tag `v1.0.0-php` must match the `PHP_VERSION` constant in `src/main/php/php-installer.ts`.

#### 2.3 Verify Upload

```bash
gh release view v1.0.0-php
```

You should see all PHP archives listed as assets.

---

### Option B: Using GitHub Web Interface

#### 2.1 Navigate to Releases Page

1. Go to your GitHub repository
2. Click on **"Releases"** (in the right sidebar or under "Code" tab)
3. Click **"Draft a new release"**

#### 2.2 Create the Release

**Tag version**: `v1.0.0-php`
- Important: Must match `PHP_VERSION` in `src/main/php/php-installer.ts`
- Click "Choose a tag" → Type `v1.0.0-php` → Click "Create new tag"

**Release title**: `PHP Binaries for EGDesk`

**Description**:
```
PHP 8.3 binaries for optional download in EGDesk Homepage Editor.

These binaries are downloaded on-demand when users need the local PHP server feature.

Supported platforms:
- macOS ARM64 (Apple Silicon)
- macOS x64 (Intel)
- Windows x64
- Linux x64

SHA256 checksums are included for verification.
```

#### 2.3 Upload Assets

1. Scroll down to **"Attach binaries"** section
2. Drag and drop all files from `release/php-assets/`:
   - `php-macos-arm64.tar.gz`
   - `php-macos-x64.tar.gz`
   - `php-windows-x64.zip`
   - `php-linux-x64.tar.gz`
   - `php-checksums.txt`

Or click "Attach binaries" and select files manually.

#### 2.4 Publish Release

1. Choose release type:
   - **Pre-release**: If testing (recommended for first upload)
   - **Latest release**: For production

2. Click **"Publish release"**

---

## Step 3: Verify the Release

### 3.1 Check Release URL

After publishing, verify the release is accessible:

```
https://github.com/minseochh02/egdesk-scratch/releases/tag/v1.0.0-php
```

### 3.2 Test Download URLs

Verify each asset is downloadable. The download URLs should follow this pattern:

```
https://github.com/minseochh02/egdesk-scratch/releases/download/v1.0.0-php/php-macos-arm64.tar.gz
https://github.com/minseochh02/egdesk-scratch/releases/download/v1.0.0-php/php-macos-x64.tar.gz
https://github.com/minseochh02/egdesk-scratch/releases/download/v1.0.0-php/php-windows-x64.zip
https://github.com/minseochh02/egdesk-scratch/releases/download/v1.0.0-php/php-linux-x64.tar.gz
```

Test one by pasting the URL in a browser - it should start downloading.

### 3.3 Verify Checksums

Download the checksums file and verify:

```bash
cd release/php-assets
curl -L -o downloaded-checksums.txt \
  "https://github.com/minseochh02/egdesk-scratch/releases/download/v1.0.0-php/php-checksums.txt"

diff php-checksums.txt downloaded-checksums.txt
```

No output means checksums match.

---

## Step 4: Update Application Code (If Needed)

If you used a different tag name than `v1.0.0-php`, update the constant in the PHP installer:

**File**: `src/main/php/php-installer.ts`

```typescript
// Change this line to match your release tag
private readonly PHP_VERSION = 'v1.0.0-php';
```

Then rebuild the app:

```bash
npm run build
npm run package
```

---

## Step 5: Test the Implementation

### 5.1 Test Without System PHP

1. Build and package the app: `npm run package`
2. Install the packaged app
3. Open Homepage Editor (should be ~384MB smaller)
4. Verify "Download PHP" button appears
5. Click "Download PHP"
6. Verify progress bar updates
7. Verify PHP is detected after download
8. Test starting the local server

### 5.2 Test With System PHP

1. Install PHP on your system (e.g., `brew install php`)
2. Open the app
3. Open Homepage Editor
4. Verify system PHP is detected (no download needed)
5. Verify local server works

---

## Troubleshooting

### Issue: "404 Not Found" during download

**Cause**: Release tag doesn't match the `PHP_VERSION` constant

**Solution**:
1. Check the release tag: `gh release list`
2. Update `PHP_VERSION` in `src/main/php/php-installer.ts` to match
3. Rebuild: `npm run build`

---

### Issue: "Checksum mismatch" error

**Cause**: PHP archive was modified or corrupted

**Solution**:
1. Re-run the packaging script: `./scripts/release/prepare-php-assets.sh`
2. Delete the old release: `gh release delete v1.0.0-php`
3. Re-upload with new archives

---

### Issue: Archive extraction fails

**Cause**: Corrupt download or wrong archive format

**Solution**:
1. Test download manually and try to extract
2. For Windows, ensure ZIP format (not tar.gz)
3. Re-package and re-upload if needed

---

### Issue: "Repository not found" error

**Cause**: Incorrect GitHub owner/repo in the download URL

**Solution**:
1. Check `GITHUB_OWNER` and `GITHUB_REPO` constants in `src/main/php/php-installer.ts`
2. Update to match your repository
3. Rebuild the app

Current values:
```typescript
private readonly GITHUB_OWNER = 'minseochh02';
private readonly GITHUB_REPO = 'egdesk-scratch';
```

---

## Updating PHP Binaries

If you need to update the PHP binaries (e.g., new PHP version):

1. Update `php-bundle/` directory with new PHP binaries
2. Run packaging script: `./scripts/release/prepare-php-assets.sh`
3. Create a new release with a new tag (e.g., `v1.0.1-php`)
4. Update `PHP_VERSION` in `src/main/php/php-installer.ts`
5. Rebuild and package the app

---

## File Structure Reference

```
egdesk-scratch/
├── php-bundle/                    # Source PHP binaries (not in releases)
│   ├── macos/
│   │   ├── arm64/                # PHP for Apple Silicon
│   │   └── x64/                  # PHP for Intel Mac
│   ├── windows/
│   │   └── x64/                  # PHP for Windows 64-bit
│   └── linux/
│       └── x64/                  # PHP for Linux 64-bit
│
├── release/
│   └── php-assets/               # Generated archives (upload these)
│       ├── php-macos-arm64.tar.gz
│       ├── php-macos-x64.tar.gz
│       ├── php-windows-x64.zip
│       ├── php-linux-x64.tar.gz
│       └── php-checksums.txt
│
├── scripts/
│   └── release/
│       └── prepare-php-assets.sh # Packaging script
│
└── src/
    └── main/
        └── php/
            └── php-installer.ts   # Download manager (contains GitHub URLs)
```

---

## Quick Reference

### Create Release (CLI)
```bash
gh release create v1.0.0-php \
  --title "PHP Binaries for EGDesk" \
  --notes "PHP 8.3 binaries" \
  release/php-assets/*
```

### List Releases
```bash
gh release list
```

### View Release Details
```bash
gh release view v1.0.0-php
```

### Delete Release (if needed)
```bash
gh release delete v1.0.0-php --yes
```

### Re-upload Assets to Existing Release
```bash
gh release upload v1.0.0-php release/php-assets/* --clobber
```

---

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Verify your GitHub CLI is authenticated: `gh auth status`
3. Ensure release tag matches `PHP_VERSION` constant
4. Test download URLs manually in browser
5. Check application logs for detailed error messages

---

## Summary

✅ **What you did**: Removed 384MB PHP bundle from app, saving 76% in size

✅ **What users get**: Smaller download, optional PHP installation on-demand

✅ **How it works**: PHP downloads automatically from GitHub releases when needed

---

**Next Step**: Run `./scripts/release/prepare-php-assets.sh` and upload to GitHub! 🚀
