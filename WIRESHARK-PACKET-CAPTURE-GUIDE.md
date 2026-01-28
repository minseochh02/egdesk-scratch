# Wireshark Packet Capture Guide

## 🎯 Goal: Capture actual data sent by INCA to see if it contains timing information

---

## 📋 Prerequisites

1. **Install Wireshark**
   - Download: https://www.wireshark.org/download.html
   - Install with default options
   - Requires Administrator privileges

2. **Find Shinhan Server IP** (from browser network tab or previous captures)
   - Example: `211.xxx.xxx.xxx`

---

## 🚀 Step-by-Step Instructions

### Step 1: Start Wireshark Capture

1. **Open Wireshark as Administrator**
   - Right-click Wireshark icon
   - Choose "Run as administrator"

2. **Select Network Interface**
   - Choose your active adapter (Wi-Fi or Ethernet)
   - Look for one with active traffic (packets/sec shown)

3. **Start Capture**
   - Click blue shark fin button (top left)
   - Or press `Ctrl+E`

---

### Step 2: Apply Filter

**Option A: Filter by Shinhan domain**
```
http.host contains "shinhan" || tls.handshake.extensions_server_name contains "shinhan"
```

**Option B: Filter by Shinhan IP** (if known)
```
ip.addr == 211.xxx.xxx.xxx
```

**Option C: Filter all HTTPS traffic**
```
tcp.port == 443
```

---

### Step 3: Reproduce INCA Activity

1. **Open Shinhan Card website**
   - Go to login page
   - Focus password field

2. **Type password with real keyboard**
   - Type slowly and deliberately
   - Watch Wireshark for packets

3. **Click Login button**
   - This should trigger final submission

---

### Step 4: Stop Capture

- Click red square button
- Or press `Ctrl+E`

---

### Step 5: Analyze Captured Packets

#### Look for INCA-related Traffic:

1. **Filter POST requests:**
   ```
   http.request.method == "POST"
   ```

2. **Check each POST for:**
   - Source process (if visible in packet)
   - URL containing "inca" or "nppfs"
   - Payload with session ID

3. **Right-click packet → Follow → TCP Stream**
   - Shows full request/response

---

## 🔍 What to Look For

### A) Separate INCA Request

**Indicators:**
- POST to different endpoint than browser login
- URL contains "inca", "nppfs", "nosstarter"
- Request includes `__E2E_UNIQUE__` session ID
- Payload structure different from browser POST

**Example:**
```http
POST /inca/timing HTTP/1.1
Host: www.shinhancard.com
Content-Type: application/json

{
  "session_id": "176958520339989",
  "keystrokes": [
    {"char": "t", "time": 0, "code": 84},
    {"char": "e", "time": 145, "code": 69},
    ...
  ]
}
```

---

### B) WebSocket Connection

**Indicators:**
- WebSocket upgrade request
- Continuous bidirectional frames
- Binary or JSON data

**Filter:**
```
websocket
```

**Look for:**
- Session ID in handshake
- Timing data in frames
- Real-time updates as you type

---

### C) Custom Protocol

**Indicators:**
- TCP connection to non-standard port
- Binary data (not HTTP)
- Persistent connection

**Filter:**
```
tcp.dstport != 80 && tcp.dstport != 443
```

---

## 📊 Analyzing Packet Payload

### Method 1: Follow TCP Stream

1. Right-click packet
2. Follow → TCP Stream
3. Look for readable data:
   - JSON with timing info
   - Session ID (`__E2E_UNIQUE__`)
   - Keystroke array

### Method 2: Export as Text

1. Select packet
2. File → Export Packet Dissections → As Plain Text
3. Open in text editor
4. Search for session ID or timing keywords

### Method 3: Decode Binary Data

If payload is binary:
1. Right-click packet
2. Copy → ...as Hex Dump
3. Use hex editor or online decoder
4. Look for recognizable patterns:
   - Timestamps (8-byte integers)
   - Session ID hex representation
   - Array markers

---

## 🎯 Expected Findings

### Scenario A: INCA Sends Separate Request

**Evidence:**
- POST to `/inca/timing` or similar
- Contains `__E2E_UNIQUE__` for correlation
- JSON/binary with keystroke timestamps
- Sent during password entry (not just on submit)

**Example packet:**
```
POST /crp/inca/keystroke.ajax HTTP/1.1
Host: www.shinhancard.com

session=176958520339989&data=<encrypted_timing_data>
```

---

### Scenario B: INCA Uses WebSocket

**Evidence:**
- WebSocket connection opened on page load
- Frames sent as you type each character
- Each frame contains timing for one keystroke

**Example frame:**
```json
{
  "session": "176958520339989",
  "keystroke": {
    "index": 0,
    "timestamp": 1769581923144,
    "keycode": 84
  }
}
```

---

### Scenario C: No Separate INCA Traffic

**If found:**
- Only browser POST request visible
- All data bundled in one submission
- No INCA-specific endpoints

**Conclusion:**
- INCA uses IPC → Browser extension → Single POST
- Or timing data embedded in browser POST (we missed it)
- Or timing not verified at all (unlikely)

---

## 🛠️ Advanced: Decrypt HTTPS Traffic

If packets are encrypted (likely), you need SSL keys:

### Option 1: Chrome SSLKEYLOGFILE

1. Set environment variable:
   ```cmd
   setx SSLKEYLOGFILE "C:\Users\YourName\ssl-keys.log"
   ```

2. Restart Chrome

3. In Wireshark:
   - Edit → Preferences
   - Protocols → TLS
   - (Pre)-Master-Secret log filename: `C:\Users\YourName\ssl-keys.log`

4. Restart capture

Now HTTPS traffic will be decrypted!

---

### Option 2: Wireshark Decryption (if you have server cert)

- Only works if you control the server
- Not applicable for Shinhan Card

---

## 📋 Quick Checklist

- [ ] Wireshark running as Administrator
- [ ] Correct network interface selected
- [ ] Filter applied (Shinhan domain/IP)
- [ ] Capture started
- [ ] Shinhan website open
- [ ] Password typed with real keyboard
- [ ] Login submitted
- [ ] Capture stopped
- [ ] Packets analyzed for:
  - [ ] POST to INCA endpoints
  - [ ] WebSocket connections
  - [ ] Session ID in payloads
  - [ ] Timing data structures

---

## 🎓 Interpretation Guide

| Finding | Meaning | Theory Confirmed |
|---------|---------|-----------------|
| POST to `/inca/*` with timing data | INCA sends separately via HTTP | ✅ Two-Channel (HTTP) |
| WebSocket with keystroke frames | INCA sends via persistent connection | ✅ Two-Channel (WebSocket) |
| TCP to non-standard port with binary data | INCA uses custom protocol | ✅ Two-Channel (Custom) |
| Only browser POST visible | Data bundled or using IPC | ❓ Need IPC analysis |
| No INCA traffic at all | Timing not sent/verified | ❌ Theory 3 wrong |

---

## 🚨 Troubleshooting

**Problem: No packets captured**
- Solution: Check if correct network interface selected
- Solution: Disable VPN/proxy

**Problem: All packets encrypted**
- Solution: Use SSLKEYLOGFILE method (see above)
- Solution: Look at packet metadata (size, timing, endpoints)

**Problem: Too many packets**
- Solution: Apply stricter filter
- Solution: Capture only during password entry (30 seconds)

**Problem: Can't identify INCA packets**
- Solution: Use Process Monitor to see INCA's exact connections
- Solution: Compare before/after typing password

---

## 📖 Next Steps

After capturing and analyzing:

1. **Document findings** in README
2. **If INCA traffic found**: Decode payload structure
3. **If no INCA traffic**: Test IPC/named pipes
4. **Test timing variation**: See if fast typing fails

---

Good luck! This will definitively prove or disprove the two-channel theory. 🔬
