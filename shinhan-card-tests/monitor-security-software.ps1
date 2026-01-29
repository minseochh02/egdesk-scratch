# Security Software Monitor (Windows PowerShell)
# Run this BEFORE opening Shinhan Card, then click the password field
# It will detect what processes/drivers start

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Security Software Monitor" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This script monitors:" -ForegroundColor Yellow
Write-Host "  1. New processes that start"
Write-Host "  2. Browser extensions"
Write-Host "  3. Loaded DLLs in Chrome"
Write-Host "  4. Kernel drivers"
Write-Host "  5. Services"
Write-Host ""
Write-Host "Instructions:" -ForegroundColor Green
Write-Host "  1. This script is now running (monitoring baseline)"
Write-Host "  2. Open Chrome and go to Shinhan Card"
Write-Host "  3. Click into the PASSWORD FIELD"
Write-Host "  4. Press ENTER here when done"
Write-Host ""

# Capture baseline
Write-Host "Capturing baseline..." -ForegroundColor Yellow
$baselineProcesses = Get-Process | Select-Object Name, Id, Path
$baselineServices = Get-Service | Where-Object {$_.Status -eq 'Running'} | Select-Object Name, DisplayName
$baselineDrivers = Get-WmiObject Win32_SystemDriver | Where-Object {$_.State -eq 'Running'} | Select-Object Name, DisplayName, PathName

Write-Host "Baseline captured. Waiting for you to click password field..." -ForegroundColor Green
Write-Host ""
Read-Host "Press ENTER after clicking the password field"

Write-Host ""
Write-Host "Analyzing changes..." -ForegroundColor Yellow
Write-Host ""

# Capture after clicking password field
$afterProcesses = Get-Process | Select-Object Name, Id, Path
$afterServices = Get-Service | Where-Object {$_.Status -eq 'Running'} | Select-Object Name, DisplayName
$afterDrivers = Get-WmiObject Win32_SystemDriver | Where-Object {$_.State -eq 'Running'} | Select-Object Name, DisplayName, PathName

# Find NEW processes
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "1. NEW PROCESSES DETECTED:" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
$newProcesses = Compare-Object -ReferenceObject $baselineProcesses -DifferenceObject $afterProcesses -Property Name, Id -PassThru | Where-Object {$_.SideIndicator -eq '=>'}

if ($newProcesses) {
    foreach ($proc in $newProcesses) {
        Write-Host "  [NEW] $($proc.Name) (PID: $($proc.Id))" -ForegroundColor Green
        if ($proc.Path) {
            Write-Host "        Path: $($proc.Path)" -ForegroundColor Gray
        }
    }
} else {
    Write-Host "  No new processes detected" -ForegroundColor Gray
}
Write-Host ""

# Find NEW services
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "2. NEW SERVICES STARTED:" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
$newServices = Compare-Object -ReferenceObject $baselineServices -DifferenceObject $afterServices -Property Name -PassThru | Where-Object {$_.SideIndicator -eq '=>'}

if ($newServices) {
    foreach ($svc in $newServices) {
        Write-Host "  [NEW] $($svc.DisplayName) ($($svc.Name))" -ForegroundColor Green
    }
} else {
    Write-Host "  No new services started" -ForegroundColor Gray
}
Write-Host ""

# Find NEW drivers
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "3. NEW KERNEL DRIVERS LOADED:" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
$newDrivers = Compare-Object -ReferenceObject $baselineDrivers -DifferenceObject $afterDrivers -Property Name -PassThru | Where-Object {$_.SideIndicator -eq '=>'}

if ($newDrivers) {
    foreach ($drv in $newDrivers) {
        Write-Host "  [NEW] $($drv.DisplayName) ($($drv.Name))" -ForegroundColor Green
        Write-Host "        Path: $($drv.PathName)" -ForegroundColor Gray
    }
} else {
    Write-Host "  No new drivers loaded" -ForegroundColor Gray
}
Write-Host ""

# Check for known security software
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "4. KNOWN SECURITY SOFTWARE CHECK:" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

$knownSecurity = @(
    "nprotect", "npkcrypt", "npkeyc", "touchenc", "touchenkey",
    "veraport", "wizvera", "ipin", "interezen", "dream", "ksign",
    "keysharp", "inca", "ahnlab", "raonsecure"
)

$allProcesses = Get-Process | Select-Object Name, Path
$found = $false

foreach ($keyword in $knownSecurity) {
    $matches = $allProcesses | Where-Object {$_.Name -like "*$keyword*" -or $_.Path -like "*$keyword*"}
    if ($matches) {
        $found = $true
        Write-Host "  [FOUND] Security software detected: $keyword" -ForegroundColor Red
        foreach ($match in $matches) {
            Write-Host "          Process: $($match.Name)" -ForegroundColor Yellow
            if ($match.Path) {
                Write-Host "          Path: $($match.Path)" -ForegroundColor Gray
            }
        }
    }
}

if (-not $found) {
    Write-Host "  No known security software detected in process names" -ForegroundColor Gray
    Write-Host "  (It may be using different names or embedded in browser)" -ForegroundColor Gray
}
Write-Host ""

# Check Chrome extensions folder
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "5. CHROME EXTENSIONS:" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

$chromeExtPath = "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Extensions"
if (Test-Path $chromeExtPath) {
    $extensions = Get-ChildItem $chromeExtPath -Directory
    Write-Host "  Found $($extensions.Count) extensions installed" -ForegroundColor Yellow
    Write-Host ""
    foreach ($ext in $extensions) {
        $manifestPath = Get-ChildItem -Path $ext.FullName -Recurse -Filter "manifest.json" | Select-Object -First 1
        if ($manifestPath) {
            $manifest = Get-Content $manifestPath.FullName | ConvertFrom-Json
            $name = $manifest.name
            # Check for security-related keywords
            if ($name -match "security|protect|key|crypt|safe|shield|guard") {
                Write-Host "  [SECURITY?] $name" -ForegroundColor Red
                Write-Host "              ID: $($ext.Name)" -ForegroundColor Gray
                Write-Host "              Path: $($ext.FullName)" -ForegroundColor Gray
            }
        }
    }
} else {
    Write-Host "  Chrome extensions folder not found" -ForegroundColor Gray
}
Write-Host ""

# Check for DLLs loaded in Chrome
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "6. SUSPICIOUS DLLs IN CHROME:" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

$chromeProcs = Get-Process -Name "chrome" -ErrorAction SilentlyContinue
if ($chromeProcs) {
    Write-Host "  Checking first Chrome process (PID: $($chromeProcs[0].Id))..." -ForegroundColor Yellow

    # This requires admin rights, so wrap in try-catch
    try {
        $modules = $chromeProcs[0].Modules | Where-Object {
            $_.ModuleName -match "nprotect|touchenc|veraport|wizvera|ipin|keysharp|npk|dream|raon"
        }

        if ($modules) {
            foreach ($mod in $modules) {
                Write-Host "  [FOUND] $($mod.ModuleName)" -ForegroundColor Red
                Write-Host "          Path: $($mod.FileName)" -ForegroundColor Gray
            }
        } else {
            Write-Host "  No suspicious DLLs detected (requires admin for full scan)" -ForegroundColor Gray
        }
    } catch {
        Write-Host "  Cannot scan DLLs (requires administrator privileges)" -ForegroundColor Yellow
        Write-Host "  Run as administrator for full DLL scan" -ForegroundColor Gray
    }
} else {
    Write-Host "  Chrome is not running" -ForegroundColor Gray
}
Write-Host ""

# Summary
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "SUMMARY & RECOMMENDATIONS:" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Look at the processes/drivers/services above" -ForegroundColor White
Write-Host "  2. Search their names online to identify the security software" -ForegroundColor White
Write-Host "  3. Share the findings to determine bypass strategy" -ForegroundColor White
Write-Host ""
Write-Host "Common Korean banking security software:" -ForegroundColor Yellow
Write-Host "  - nProtect KeyCrypt (INCA Internet)" -ForegroundColor Gray
Write-Host "  - TouchEn Key (RaonSecure)" -ForegroundColor Gray
Write-Host "  - Veraport (Wizvera)" -ForegroundColor Gray
Write-Host "  - IPinside (Interezen)" -ForegroundColor Gray
Write-Host "  - Dream Security KeySharp" -ForegroundColor Gray
Write-Host ""
Write-Host "If you found security software, search for:" -ForegroundColor Green
Write-Host "  - '[software name] bypass'" -ForegroundColor White
Write-Host "  - '[software name] reverse engineering'" -ForegroundColor White
Write-Host "  - '[software name] API documentation'" -ForegroundColor White
Write-Host ""

Read-Host "Press ENTER to exit"
