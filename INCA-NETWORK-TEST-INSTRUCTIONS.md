# INCA Network Activity Test Instructions

## 🎯 Goal

Test if INCA driver sends keystroke timing data via a separate network channel (Theory 3: Two-Channel Architecture)

---

## 📋 Method 1: PowerShell Monitoring (Recommended - Easy)

### Steps:

1. **Close Shinhan Card website** (if open)

2. **Open PowerShell as Administrator**
   - Press `Win + X`
   - Click "Windows PowerShell (Admin)" or "Terminal (Admin)"

3. **Navigate to project directory**
   ```powershell
   cd "C:\Projects\egdesk-scratch"
   ```

4. **Run the monitoring script**
   ```powershell
   .\test-inca-network-activity.ps1
   ```

5. **Open Shinhan Card website in browser**
   - Go to: https://www.shinhancard.com/cconts/html/main.html
   - Focus password field
   - Type password with real keyboard

6. **Watch PowerShell output**
   - If INCA makes network connections → Script will show them in RED
   - Connection details saved to `inca-network-log.txt`

7. **Press Ctrl+C to stop monitoring**

### Expected Results:

**If Theory 3 is correct:**
```
[!] INCA NETWORK ACTIVITY DETECTED!
Process:        nosstarter.npe (PID: 12345)
Local Address:  192.168.1.100:54321
Remote Address: 211.xxx.xxx.xxx:443
Hostname:       shinhancard.com
```

**If no connections found:**
- INCA might use IPC instead of network
- Or timing data sent only during login submission
- Or Theory 3 is wrong

---

## 📋 Method 2: Wireshark Packet Capture (Advanced - Detailed)

### Prerequisites:
- Install Wireshark: https://www.wireshark.org/download.html

### Steps:

1. **Open Wireshark as Administrator**

2. **Start capture on your network interface**
   - Select your active network adapter (Wi-Fi or Ethernet)
   - Click the blue shark fin to start capture

3. **Filter for Shinhan traffic**
   - Apply display filter: `tcp.port == 443 || dns.qry.name contains "shinhan"`

4. **Open Shinhan website and login**
   - Type password with real keyboard
   - Click login button

5. **Stop capture after login**

6. **Analyze captured packets**
   - Look for connections from non-browser processes
   - Check for POST/WebSocket data containing session ID
   - Search for timing-related data

### What to Look For:

1. **TCP connections from INCA process**
   - Source: Local IP, Random port
   - Destination: Shinhan server IP, Port 443
   - Process: nosstarter.npe

2. **POST data with session ID**
   - Look for `__E2E_UNIQUE__` value in payload
   - Check if separate from browser's login POST

3. **Timing data structure**
   - JSON with keystroke timestamps
   - Binary data with timing deltas

---

## 📋 Method 3: Netstat Snapshot (Quick Check)

### Before typing password:
```cmd
netstat -ano | findstr "443" > before.txt
```

### After typing password (before clicking login):
```cmd
netstat -ano | findstr "443" > after.txt
```

### Compare:
```cmd
fc before.txt after.txt
```

Look for NEW connections from INCA process PID.

---

## 📋 Method 4: Process Monitor (Advanced)

### Prerequisites:
- Download Process Monitor: https://learn.microsoft.com/en-us/sysinternals/downloads/procmon

### Steps:

1. **Run Process Monitor as Administrator**

2. **Set filters**
   - Process Name: `contains "inca"` or `contains "nppfs"` or `contains "nosstarter"`
   - Operation: `is "TCP Send"` or `is "TCP Receive"`

3. **Clear events and start monitoring**

4. **Open Shinhan website, type password**

5. **Check captured events**
   - Look for TCP Send operations
   - Check destination addresses
   - Analyze payload (if visible)

---

## ✅ Interpreting Results

### Scenario A: INCA Network Activity FOUND

**What it means:**
- ✅ Theory 3 (Two-Channel Architecture) is CONFIRMED
- INCA sends data separately from browser
- Likely contains keystroke timing information
- Server receives two streams: browser POST + INCA data

**Next steps:**
- Analyze packet payload to see timing data structure
- Test if blocking INCA connection breaks login
- Understand correlation mechanism

---

### Scenario B: NO INCA Network Activity

**Possible explanations:**

1. **IPC/Shared Memory Instead**
   - INCA → Browser via named pipes
   - Browser bundles everything in one POST
   - Check browser POST for hidden timing data

2. **Connection Only During Submit**
   - INCA connects only when clicking "Login"
   - Re-run test, monitor during submission phase

3. **WebSocket Connection**
   - Opened during page load, stays alive
   - Data sent when typing, not visible in netstat snapshot

4. **Theory 3 is Wrong**
   - Timestamps only for hash generation
   - Server doesn't verify timing
   - Unlikely given all evidence

**Next steps:**
- Check for IPC/named pipes
- Re-analyze browser POST data
- Test timing variation (fast vs slow typing)

---

## 🔬 Advanced: Packet Payload Analysis

If INCA network activity is found, capture packet payload:

### Using Wireshark:
1. Right-click packet → Follow → TCP Stream
2. Look for JSON or binary data
3. Search for session ID (`__E2E_UNIQUE__`)
4. Check for timestamp arrays

### Expected Payload (if Theory 3 is correct):
```json
{
  "session_id": "176958520339989",
  "keystrokes": [
    {"char": "t", "timestamp": 0, "keycode": 84},
    {"char": "e", "timestamp": 145, "keycode": 69},
    {"char": "s", "timestamp": 298, "keycode": 83},
    ...
  ]
}
```

Or binary format with similar structure.

---

## 🚨 Important Notes

1. **Run monitoring BEFORE opening website**
   - INCA might initialize connection early
   - Want to catch all network activity

2. **Keep monitoring running during password entry**
   - Data might be sent in real-time as you type
   - Not just on form submission

3. **Test multiple times**
   - Some connections might be intermittent
   - Capture multiple login attempts

4. **Administrator rights required**
   - Packet capture needs elevated privileges
   - Some tools won't work without admin

---

## 📊 Expected Timeline

```
[Page Load] → INCA initializes → (Possible connection setup)
     ↓
[Focus Field] → Session created → (Possible key exchange)
     ↓
[Type Char 1] → Hash generated → (Possible timing data sent) ← TEST THIS
     ↓
[Type Char 2] → Hash generated → (Possible timing data sent) ← TEST THIS
     ↓
[Click Login] → Form submit → Browser POST + (INCA finalizes)
     ↓
[Server] → Correlates both channels → Verifies password + timing
```

---

## 🎯 Success Criteria

**Test is SUCCESSFUL if we find:**
- INCA process making TCP connections to Shinhan
- Connection happens during password typing
- Payload contains session ID
- Data structure includes timing information

**Test is INCONCLUSIVE if:**
- No network activity but timing is still verified
- Need to check IPC/named pipes next

---

Good luck! Report findings in the README. 🔬
