# Interception Driver Testing Guide

## ✅ What's Already Done (on Mac)

1. ✅ Downloaded Interception driver files
2. ✅ Copied to `resources/interception/`
3. ✅ Created `interception-type.cpp` helper program
4. ✅ Updated Shinhan automator to use Interception
5. ✅ Updated Electron Builder to bundle Interception files

## 📋 What YOU Need To Do (on Windows)

### Step 1: Transfer Code to Windows

Transfer your entire `egdesk-scratch` folder to a Windows machine.

---

### Step 2: Compile interception-type.exe (On Windows)

Open **"Developer Command Prompt for VS"** (comes with Visual Studio):

```cmd
cd egdesk-scratch\resources\interception

REM Compile the helper program
cl /O2 /EHsc interception-type.cpp library\x64\interception.lib /link /OUT:interception-type.exe

REM Test it exists
dir interception-type.exe
```

**If you don't have Visual Studio:**
- Download Visual Studio Community (free): https://visualstudio.microsoft.com/downloads/
- Install "Desktop development with C++" workload
- OR just download Build Tools

---

### Step 3: Install Interception Driver (On Windows)

```cmd
cd egdesk-scratch\resources\interception

REM Run as Administrator
install-interception.exe /install

REM Restart your computer (required!)
shutdown /r /t 0
```

---

### Step 4: Test the Helper Program

After reboot, test if interception-type.exe works:

```cmd
cd egdesk-scratch\resources\interception

REM Run the typing program
interception-type.exe "test123" 100

REM You'll see:
REM "Press any key on your keyboard..."
REM → Press any key
REM → It will type "test123"
```

---

### Step 5: Build Electron App on Windows

```cmd
cd egdesk-scratch

REM Install dependencies
npm install

REM Build the app
npm run package:win
```

---

### Step 6: Test Banking Automation

Run your built Electron app and test Shinhan card login:

**What should happen:**
1. App opens browser
2. Fills username (regular Playwright)
3. **For password:**
   - Calls `interception-type.exe "yourpassword" 200`
   - Helper asks: "Press any key on keyboard..."
   - **You press a key once**
   - Helper types password using virtual HID
4. Login proceeds

**Check if password is accepted or rejected!**

---

## 🔍 Expected Behavior

### If It WORKS ✅
- Password field accepts input
- No security errors
- Login succeeds
- **Great! Interception bypasses TouchEn**

### If It FAILS ❌
- Password rejected
- Security error message
- **TouchEn detects virtual device → Need Arduino**

---

## ⚠️ Known Limitation

**The helper program requires you to press a key first.** This is because Interception needs to detect which keyboard device to use.

**Possible solutions if this is a problem:**
1. Hardcode device ID (usually device #1)
2. Detect keyboard automatically
3. Skip Interception → Use Arduino

---

## 🎯 Next Steps After Testing

### If Interception Works:
1. Remove the "press any key" requirement
2. Apply to all card automators
3. Done! ✅

### If Interception Fails:
1. Order Arduino Pro Micro ($8, Amazon)
2. Flash HID firmware (10 min)
3. Communicate via Serial
4. Guaranteed to work ✅

---

## Files You Have Now

```
resources/interception/
├── install-interception.exe       ← Driver installer
├── interception.dll               ← Driver library (x64)
├── interception.h                 ← API header
├── interception-type.cpp          ← Helper program source
├── interception-type.exe          ← (compile this on Windows)
├── library/
│   ├── x64/
│   │   ├── interception.dll
│   │   └── interception.lib       ← Link library for compilation
│   └── x86/
├── README.md                      ← Setup instructions
└── COMPILE.md                     ← Compilation guide
```

---

**Ready to transfer to Windows and test!**
