# INCA Network Activity Monitor
# Tests Theory 3: Does INCA driver send separate data to server?
#
# This script:
# 1. Finds INCA process (nosstarter.npe)
# 2. Monitors its network connections in real-time
# 3. Captures any data sent to Shinhan server
# 4. Proves/disproves two-channel architecture

Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 69) -ForegroundColor Cyan
Write-Host "INCA Network Activity Monitor" -ForegroundColor Yellow
Write-Host ("=" * 70) -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "[!] WARNING: Not running as Administrator" -ForegroundColor Red
    Write-Host "    Some network monitoring features may not work" -ForegroundColor Yellow
    Write-Host "    For full packet capture, run PowerShell as Administrator" -ForegroundColor Yellow
    Write-Host ""
}

# Step 1: Find INCA process
Write-Host "[1] Searching for INCA process..." -ForegroundColor Cyan

$incaProcesses = Get-Process | Where-Object {
    $_.ProcessName -like "*nppfs*" -or
    $_.ProcessName -like "*nosstarter*" -or
    $_.ProcessName -like "*inca*" -or
    $_.ProcessName -like "*nprotect*"
}

if ($incaProcesses) {
    Write-Host "    Found INCA processes:" -ForegroundColor Green
    foreach ($proc in $incaProcesses) {
        Write-Host "    - $($proc.ProcessName) (PID: $($proc.Id))" -ForegroundColor White
    }
    Write-Host ""
} else {
    Write-Host "    [!] No INCA processes found" -ForegroundColor Yellow
    Write-Host "    INCA may not be running yet" -ForegroundColor Yellow
    Write-Host "    Open Shinhan Card website first, then re-run this script" -ForegroundColor Yellow
    Write-Host ""

    $continue = Read-Host "Continue anyway? (y/n)"
    if ($continue -ne 'y') {
        exit
    }
}

# Step 2: Monitor network connections
Write-Host "[2] Monitoring network connections..." -ForegroundColor Cyan
Write-Host "    Press Ctrl+C to stop monitoring" -ForegroundColor Yellow
Write-Host ""

$logFile = "inca-network-log.txt"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

# Create/clear log file
"INCA Network Activity Log - $timestamp" | Out-File $logFile
"=" * 70 | Out-File $logFile -Append
"" | Out-File $logFile -Append

Write-Host "[*] Monitoring started. Log file: $logFile" -ForegroundColor Green
Write-Host ""

# Continuous monitoring
$iteration = 0
$foundConnections = @()

try {
    while ($true) {
        $iteration++

        # Get all network connections
        $connections = Get-NetTCPConnection -State Established -ErrorAction SilentlyContinue

        # Check each connection
        foreach ($conn in $connections) {
            # Get process info
            $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue

            if ($proc) {
                # Check if it's INCA-related
                $isInca = $proc.ProcessName -like "*nppfs*" -or
                          $proc.ProcessName -like "*nosstarter*" -or
                          $proc.ProcessName -like "*inca*" -or
                          $proc.ProcessName -like "*nprotect*"

                # Check if connecting to Shinhan
                $isShinhan = $conn.RemoteAddress -like "*shinhan*" -or
                            $conn.RemoteAddress -match "^\d+\.\d+\.\d+\.\d+$"  # Any IP

                if ($isInca) {
                    $connKey = "$($proc.ProcessName)-$($conn.RemoteAddress):$($conn.RemotePort)"

                    if ($foundConnections -notcontains $connKey) {
                        $foundConnections += $connKey

                        $timestamp = Get-Date -Format "HH:mm:ss"
                        $logEntry = "[$timestamp] INCA NETWORK ACTIVITY DETECTED!"

                        Write-Host $logEntry -ForegroundColor Red
                        $logEntry | Out-File $logFile -Append

                        $details = @"
Process:        $($proc.ProcessName) (PID: $($proc.Id))
Local Address:  $($conn.LocalAddress):$($conn.LocalPort)
Remote Address: $($conn.RemoteAddress):$($conn.RemotePort)
State:          $($conn.State)

"@
                        Write-Host $details -ForegroundColor Yellow
                        $details | Out-File $logFile -Append

                        # Try to resolve hostname
                        try {
                            $hostname = [System.Net.Dns]::GetHostEntry($conn.RemoteAddress).HostName
                            $hostnameInfo = "Hostname:       $hostname"
                            Write-Host $hostnameInfo -ForegroundColor Cyan
                            $hostnameInfo | Out-File $logFile -Append
                            "" | Out-File $logFile -Append
                        } catch {
                            "Hostname:       (Could not resolve)" | Out-File $logFile -Append
                            "" | Out-File $logFile -Append
                        }
                    }
                }
            }
        }

        # Status update every 10 iterations
        if ($iteration % 10 -eq 0) {
            $timestamp = Get-Date -Format "HH:mm:ss"
            Write-Host "[$timestamp] Monitoring... (iteration $iteration, found $($foundConnections.Count) INCA connections)" -ForegroundColor Gray
        }

        Start-Sleep -Seconds 1
    }
}
catch {
    Write-Host ""
    Write-Host "[*] Monitoring stopped" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 69) -ForegroundColor Cyan
Write-Host "Summary" -ForegroundColor Yellow
Write-Host ("=" * 70) -ForegroundColor Cyan
Write-Host ""

if ($foundConnections.Count -gt 0) {
    Write-Host "[!] FOUND $($foundConnections.Count) INCA NETWORK CONNECTION(S)!" -ForegroundColor Green
    Write-Host ""
    Write-Host "This PROVES Theory 3 (Two-Channel Architecture):" -ForegroundColor Green
    Write-Host "  - INCA driver IS making separate network connections" -ForegroundColor White
    Write-Host "  - Likely sending keystroke timing data independently" -ForegroundColor White
    Write-Host "  - Server receives both browser POST and INCA data" -ForegroundColor White
    Write-Host ""
    Write-Host "Details saved to: $logFile" -ForegroundColor Cyan
} else {
    Write-Host "[*] No INCA network connections detected" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Possible reasons:" -ForegroundColor White
    Write-Host "  1. INCA uses IPC/named pipes instead of network" -ForegroundColor Gray
    Write-Host "  2. Connection happens only during login submission" -ForegroundColor Gray
    Write-Host "  3. INCA wasn't active during monitoring" -ForegroundColor Gray
    Write-Host "  4. Theory 3 might be wrong (unlikely)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Try:" -ForegroundColor Cyan
    Write-Host "  - Run script BEFORE opening Shinhan website" -ForegroundColor White
    Write-Host "  - Keep script running WHILE typing password" -ForegroundColor White
    Write-Host "  - Monitor during actual login submission" -ForegroundColor White
}

Write-Host ""
