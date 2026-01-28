# Quick Start: INCA Network Test

## 🚀 Fastest Way to Test

### Option 1: PowerShell (Recommended)
```powershell
# Open PowerShell as Administrator
# Navigate to project folder
cd "C:\Projects\egdesk-scratch"

# Run monitor
.\test-inca-network-activity.ps1

# Then open Shinhan website and type password
```

### Option 2: Batch File (Simple)
```cmd
# Right-click "monitor-inca.bat"
# Choose "Run as administrator"

# Then open Shinhan website and type password
```

### Option 3: Manual netstat
```cmd
# Before typing password:
netstat -ano | findstr "ESTABLISHED" > before.txt

# After typing password:
netstat -ano | findstr "ESTABLISHED" > after.txt

# Compare:
fc before.txt after.txt

# Look for new connections with INCA process PID
```

---

## ✅ What You're Looking For

**SUCCESS (Theory Confirmed):**
```
[12:34:56] INCA NETWORK ACTIVITY DETECTED!
Process:        nosstarter.npe (PID: 12345)
Remote Address: 211.xxx.xxx.xxx:443
Hostname:       shinhancard.com
```

**FAILURE (No INCA connections):**
```
No INCA network connections detected
```

---

## 📋 Full Process

1. **Start monitoring script** (before opening website)
2. **Open browser** → Go to Shinhan Card
3. **Type password** with real keyboard
4. **Watch console** for INCA network activity
5. **Stop monitoring** (Ctrl+C)
6. **Check log file** (`inca-network-log.txt`)

---

## 🎯 What This Proves

**If INCA network activity found:**
- ✅ Two-Channel Architecture is CONFIRMED
- ✅ INCA sends timing data separately
- ✅ Server receives browser POST + INCA data

**If no network activity:**
- Could be using IPC/named pipes
- Or connection only during login submit
- Need further investigation

---

## 📖 More Details

See `INCA-NETWORK-TEST-INSTRUCTIONS.md` for:
- Advanced Wireshark capture
- Packet payload analysis
- Alternative testing methods
- Troubleshooting guide

---

**Run the test and report findings!** 🔬
