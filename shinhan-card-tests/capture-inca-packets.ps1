# INCA Packet Capture Script
# Captures actual data sent by INCA process to external servers
#
# Requires: Administrator privileges

param(
    [switch]$SkipLocalhost = $true
)

Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "INCA Packet Capture - External Connections Only" -ForegroundColor Yellow
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""

# Check admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[!] ERROR: Must run as Administrator" -ForegroundColor Red
    Write-Host "    Right-click PowerShell and 'Run as Administrator'" -ForegroundColor Yellow
    exit
}

# Find INCA process
Write-Host "[1] Finding INCA process..." -ForegroundColor Cyan
$incaProcess = Get-Process | Where-Object {
    $_.ProcessName -like "*nosstarter*" -or
    $_.ProcessName -like "*nppfs*"
} | Select-Object -First 1

if (-not $incaProcess) {
    Write-Host "    [!] No INCA process found" -ForegroundColor Red
    Write-Host "    Open Shinhan Card website first" -ForegroundColor Yellow
    exit
}

Write-Host "    Found: $($incaProcess.ProcessName) (PID: $($incaProcess.Id))" -ForegroundColor Green
Write-Host ""

# Monitor connections
Write-Host "[2] Monitoring EXTERNAL connections from INCA..." -ForegroundColor Cyan
Write-Host "    (Filtering out localhost 127.0.0.1)" -ForegroundColor Gray
Write-Host ""

$logFile = "inca-external-connections.json"
$connections = @()

Write-Host "Monitoring... Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

try {
    $iteration = 0
    while ($true) {
        $iteration++

        # Get connections for INCA process
        $tcpConnections = Get-NetTCPConnection -OwningProcess $incaProcess.Id -ErrorAction SilentlyContinue

        foreach ($conn in $tcpConnections) {
            # Skip localhost
            if ($SkipLocalhost -and ($conn.RemoteAddress -eq "127.0.0.1" -or $conn.RemoteAddress -eq "::1")) {
                continue
            }

            # Skip if already logged
            $connKey = "$($conn.RemoteAddress):$($conn.RemotePort)-$($conn.State)"
            if ($connections.connKey -contains $connKey) {
                continue
            }

            $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

            # Try to resolve hostname
            $hostname = "(resolving...)"
            try {
                $hostname = [System.Net.Dns]::GetHostEntry($conn.RemoteAddress).HostName
            } catch {
                $hostname = "(could not resolve)"
            }

            $connInfo = [PSCustomObject]@{
                Timestamp = $timestamp
                LocalAddress = "$($conn.LocalAddress):$($conn.LocalPort)"
                RemoteAddress = "$($conn.RemoteAddress):$($conn.RemotePort)"
                RemoteIP = $conn.RemoteAddress
                RemotePort = $conn.RemotePort
                State = $conn.State
                Hostname = $hostname
                IsShinhan = ($hostname -like "*shinhan*")
            }

            $connections += $connInfo

            # Display
            Write-Host "[$timestamp] EXTERNAL CONNECTION DETECTED!" -ForegroundColor Red
            Write-Host "  Remote: $($conn.RemoteAddress):$($conn.RemotePort)" -ForegroundColor Yellow
            Write-Host "  State:  $($conn.State)" -ForegroundColor White
            Write-Host "  Host:   $hostname" -ForegroundColor Cyan

            if ($hostname -like "*shinhan*") {
                Write-Host "  >>> THIS IS SHINHAN SERVER! <<<" -ForegroundColor Green
            }
            Write-Host ""
        }

        if ($iteration % 5 -eq 0) {
            $ts = Get-Date -Format "HH:mm:ss"
            Write-Host "[$ts] Monitoring... ($($connections.Count) connections found)" -ForegroundColor Gray
        }

        Start-Sleep -Seconds 1
    }
}
catch {
    Write-Host ""
    Write-Host "[*] Monitoring stopped" -ForegroundColor Yellow
}

# Save results
Write-Host ""
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "Results" -ForegroundColor Yellow
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""

if ($connections.Count -gt 0) {
    Write-Host "Found $($connections.Count) external connection(s):" -ForegroundColor Green
    Write-Host ""

    foreach ($conn in $connections) {
        Write-Host "  [$($conn.Timestamp)]" -ForegroundColor Gray
        Write-Host "    Remote: $($conn.RemoteAddress)" -ForegroundColor White
        Write-Host "    Host:   $($conn.Hostname)" -ForegroundColor Cyan
        if ($conn.IsShinhan) {
            Write-Host "    >>> SHINHAN SERVER <<<" -ForegroundColor Green
        }
        Write-Host ""
    }

    # Save to JSON
    $connections | ConvertTo-Json | Out-File $logFile
    Write-Host "Saved to: $logFile" -ForegroundColor Cyan
} else {
    Write-Host "No external connections found" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Possible reasons:" -ForegroundColor White
    Write-Host "  - INCA uses IPC/named pipes instead of network" -ForegroundColor Gray
    Write-Host "  - Connection happens only during login submission" -ForegroundColor Gray
    Write-Host "  - Data sent via browser (bundled in POST)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Next step: Use Wireshark to capture packet payload" -ForegroundColor Cyan
Write-Host "  1. Install Wireshark" -ForegroundColor White
Write-Host "  2. Filter: ip.addr == <Shinhan IP>" -ForegroundColor White
Write-Host "  3. Analyze packet contents" -ForegroundColor White
Write-Host ""
