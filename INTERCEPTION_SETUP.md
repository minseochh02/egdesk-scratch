# Interception Driver Setup for Windows Production

This guide explains how to bundle the Interception driver with your Electron app for Windows.

## Why Interception Driver?

Korean banking websites (Shinhan, Hana, KB, NH, etc.) use **TouchEn nxKey** kernel driver that blocks all software keyboard input. The only ways to bypass it are:

1. **Interception Driver** - Creates virtual HID keyboard device (software solution) ✅
2. **Arduino USB HID** - Physical hardware keyboard emulator

Since you're building a desktop app, Interception is the better choice.

---

## Step 1: Download Interception Driver

**Download Link:** https://github.com/oblitum/Interception/releases

1. Go to the releases page
2. Download **Interception.zip** (latest version)
3. Extract the ZIP file

---

## Step 2: Copy Driver Files to Your Project

Copy these files from the extracted folder to `resources/interception/`:

```bash
# Required files
cp Interception/install-interception.exe ./resources/interception/
cp Interception/interception.dll ./resources/interception/

# Optional (command-line tools)
cp -r Interception/command-line ./resources/interception/
cp -r Interception/library ./resources/interception/
```

**Your folder structure should look like:**
```
resources/
└── interception/
    ├── install-interception.exe  ← REQUIRED
    ├── interception.dll          ← REQUIRED
    ├── command-line/             ← Optional
    ├── library/                  ← Optional
    └── README.md                 ← Already created
```

---

## Step 3: Install Required NPM Packages (Already Done)

✅ `robotjs` - Installed
✅ `@nut-tree-fork/nut-js` - Installed
✅ `sudo-prompt` - Already installed

---

## Step 4: Build for Windows

On your Mac, build the Windows package:

```bash
npm run package:win
```

This will:
- Bundle your app
- Include `resources/interception/` folder
- Make driver installer available at runtime

---

## Step 5: Testing on Windows

When you run the built app on Windows for the **first time**:

### Automatic Driver Installation Flow

1. **App starts** → Checks if Interception driver installed
2. **If not installed** → Shows dialog:
   ```
   ┌─────────────────────────────────────────┐
   │  Keyboard Driver Required               │
   │                                         │
   │  This app requires a keyboard driver    │
   │  to automate banking websites.          │
   │                                         │
   │  ⚠️ Admin rights required                │
   │  ⚠️ Computer restart required            │
   │                                         │
   │  [ Install Now ]  [ Cancel ]            │
   └─────────────────────────────────────────┘
   ```
3. **User clicks "Install Now"**
4. **UAC prompt appears** (admin rights)
5. **Driver installs**
6. **Reboot prompt**:
   ```
   ┌─────────────────────────────────────────┐
   │  Restart Required                       │
   │                                         │
   │  Driver installed successfully.         │
   │  Restart now?                           │
   │                                         │
   │  [ Restart Now ]  [ Restart Later ]     │
   └─────────────────────────────────────────┘
   ```
7. **After restart** → App works normally!

---

## Step 6: Enable Interception in Your Code

To use Interception instead of robotjs/nut.js, update the automator:

```javascript
// In ShinhanCardAutomator.js
const result = await typeText(password, {
  slowTyping: true,
  preferredMethod: 'interception',  // ← Force Interception
  onProgress: (msg) => this.log(msg)
});
```

**Note:** Full Interception implementation requires scan code mapping. For now, the app uses:
- **robotjs** (first choice if available)
- **nut.js** (fallback)

---

## Step 7: Alternative - Manual Driver Installation

If auto-install doesn't work, users can install manually:

1. Navigate to app installation folder
2. Find `resources/interception/install-interception.exe`
3. Right-click → "Run as Administrator"
4. Run: `install-interception.exe /install`
5. Restart computer

---

## Troubleshooting

### Driver Installation Fails
- Check Windows Event Viewer → Windows Logs → System
- Look for "interception" related errors
- Ensure antivirus isn't blocking installation

### App Can't Find Driver Files
- Check if `resources/interception/` was bundled correctly
- Verify files exist in app installation directory
- Check `process.resourcesPath` in app logs

### Typing Still Doesn't Work
- Verify driver is loaded: `sc query interception`
- Check if service is running
- May need to fall back to Arduino hardware solution

---

## Next Steps

1. ✅ Download Interception files
2. ✅ Copy to `resources/interception/`
3. ✅ Build Windows package: `npm run package:win`
4. ✅ Test on Windows machine
5. ✅ If robotjs fails → Enable Interception driver
6. ✅ If Interception fails → Use Arduino hardware

---

## Important Notes

- **Interception is Windows-only** - Won't work on Mac/Linux
- **Requires one-time admin rights** - For driver installation
- **Requires reboot** - After driver installation
- **Check Interception license** - Ensure compliance for your use case

---

## Current Status

✅ Auto-install infrastructure created
✅ Native keyboard wrapper created
✅ Shinhan automator updated
⏳ **TODO: Download Interception driver files**
⏳ **TODO: Test on Windows**
