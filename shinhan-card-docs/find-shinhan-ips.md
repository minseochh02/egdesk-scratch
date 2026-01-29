# Finding Shinhan Server IP Addresses

## 🎯 Problem

We need the ACTUAL backend server IPs that Shinhan uses, not just the DNS-resolved load balancer.

---

## ✅ Method 1: Browser DevTools (Easiest)

### Steps:

1. **Open Shinhan Card website**
   - Go to: https://www.shinhancard.com/cconts/html/main.html

2. **Open Browser DevTools**
   - Press `F12`
   - Go to **Network** tab

3. **Clear network log**
   - Click 🚫 (clear button)

4. **Reload page and type password**
   - Refresh the page
   - Type password in password field
   - Click login

5. **Look at network requests**
   - Find the login POST request (usually `*.ajax` or similar)
   - Click on it
   - Go to **Headers** tab
   - Look for **Remote Address** field

**Example:**
```
Remote Address: 211.xxx.xxx.xxx:443
```

That's the REAL backend server IP!

6. **Collect ALL IPs**
   - Scroll through all requests
   - Note down all unique Remote Address IPs
   - Especially look for:
     - Login requests
     - INCA/nppfs requests
     - Any `*.ajax` endpoints

---

## ✅ Method 2: From Our Captured Data

If you saved the network capture from `test-form-submission.js`, check:

```powershell
# Look at the URLs in the captured requests
# In form-submission-data.json
```

The URLs will show the exact endpoints:
- `https://www.shinhancard.com/crp/cmm/CRPLOGIN/CMMServiceMemLoginC.ajax`
- `https://www.shinhancard.com/crp/csolution/inca_nos/pluginfree/jsp/nppfs.key.jsp`

Then resolve these to IPs using browser DevTools.

---

## ✅ Method 3: netstat During Active Session

### Steps:

1. **Open Shinhan website and login page**

2. **Run netstat to see active connections**
   ```cmd
   netstat -ano | findstr "ESTABLISHED" | findstr "443"
   ```

3. **Type password (don't submit yet)**

4. **Run netstat again**
   ```cmd
   netstat -ano | findstr "ESTABLISHED" | findstr "443" > active-connections.txt
   ```

5. **Filter for browser process**
   - Find your browser PID (Task Manager)
   - Example: Chrome PID = 5432
   ```cmd
   findstr "5432" active-connections.txt
   ```

6. **Extract the IPs**
   - Look for foreign addresses like: `211.xxx.xxx.xxx:443`
   - Those are the backend servers!

---

## ✅ Method 4: Wireshark (Most Detailed)

### Steps:

1. **Start Wireshark capture**

2. **Open Shinhan website**

3. **Filter by domain**
   ```
   tls.handshake.extensions_server_name contains "shinhan"
   ```

4. **Look at the IP addresses in packet details**
   - Source: Your computer
   - Destination: Shinhan backend server ← THIS IS WHAT WE WANT

5. **Export to CSV**
   - Statistics → Conversations → IPv4
   - Shows all unique IP addresses
   - Filter for Shinhan-related ones

---

## 📋 Expected IP Ranges

Korean servers typically use these IP ranges:
- `211.*.*.*` (Korea Telecom)
- `175.*.*.*` (SK Broadband)
- `106.*.*.*` (LG U+)

Shinhan Card likely uses multiple IPs for:
- **Main web server**: Load balancer for website
- **API server**: Backend for `*.ajax` requests
- **INCA server**: Might be separate IP for security traffic
- **CDN**: For static assets (images, CSS, JS)

---

## 🎯 What We're Looking For

**Priority IPs to monitor:**

1. **Login endpoint IP**
   - The server that receives `CMMServiceMemLoginC.ajax`
   - This gets the encrypted password

2. **INCA endpoint IP**
   - The server that handles `nppfs.key.jsp`, `nppfs.keypad.jsp`
   - This might also receive timing data

3. **Any separate INCA communication IP**
   - If INCA sends data separately, it might go to different IP
   - This would prove two-channel architecture

---

## 🔬 Once You Have the IPs

### Use them in Wireshark filter:

```
ip.addr == 211.xxx.xxx.xxx || ip.addr == 175.yyy.yyy.yyy
```

### Or in PowerShell script:

```powershell
# Add to capture-inca-packets.ps1
$shinhanIPs = @("211.xxx.xxx.xxx", "175.yyy.yyy.yyy")
if ($conn.RemoteAddress -in $shinhanIPs) {
    Write-Host "SHINHAN SERVER CONNECTION!" -ForegroundColor Green
}
```

---

## 📝 Template to Fill Out

After investigation, fill this out:

```
Shinhan Card Server IPs:
========================

Main Website:
- IP: ___.___.___.___ (DNS resolves to this)

Login Backend:
- IP: ___.___.___.___ (CMMServiceMemLoginC.ajax goes here)

INCA Endpoints:
- IP: ___.___.___.___ (nppfs.key.jsp)
- IP: ___.___.___.___ (nppfs.keypad.jsp)

Other Services:
- IP: ___.___.___.___ (description)

Total Unique IPs: ___
```

---

## 🚀 Quick Start

**Fastest way:**

1. Open Shinhan Card
2. Press F12 → Network tab
3. Type password
4. Click login
5. Find the login POST request
6. Look at "Remote Address"
7. That's your main IP to monitor!

Then use that IP in Wireshark filter to see all packets to/from that server.

---

**Run this and report back the IPs you find!** 🔍
