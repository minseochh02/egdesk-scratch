@echo off
REM Simple INCA Network Monitor
REM Monitors network connections from INCA process

echo ===================================================================
echo INCA Network Connection Monitor
echo ===================================================================
echo.

REM Check if running as admin
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [!] WARNING: Not running as Administrator
    echo     Some features may not work properly
    echo     Right-click this file and "Run as administrator"
    echo.
)

echo [1] Searching for INCA process...
echo.

REM Find INCA process
tasklist | findstr /i "nppfs nosstarter inca nprotect" > nul
if %errorLevel% equ 0 (
    echo     Found INCA processes:
    tasklist | findstr /i "nppfs nosstarter inca nprotect"
    echo.
) else (
    echo     [!] No INCA processes found
    echo     Make sure Shinhan Card website is open
    echo.
    pause
)

echo [2] Monitoring network connections...
echo     Press Ctrl+C to stop
echo.

:monitor_loop

REM Get timestamp
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set timestamp=%datetime:~8,2%:%datetime:~10,2%:%datetime:~12,2%

REM Check for INCA network connections
netstat -ano | findstr "ESTABLISHED" > temp_connections.txt

REM Parse each connection
for /f "tokens=2,3,5 delims=: " %%a in (temp_connections.txt) do (
    REM Get process info for PID %%c
    for /f "tokens=1" %%p in ('tasklist /FI "PID eq %%c" /NH /FO CSV ^| findstr /i "nppfs nosstarter inca nprotect"') do (
        echo [%timestamp%] INCA NETWORK ACTIVITY DETECTED!
        echo Process: %%p
        echo Remote: %%a:%%b
        echo PID: %%c
        echo.
        echo [%timestamp%] INCA NETWORK ACTIVITY - Process: %%p Remote: %%a:%%b PID: %%c >> inca-network-log.txt
    )
)

REM Clean up
del temp_connections.txt >nul 2>&1

REM Wait 2 seconds
timeout /t 2 /nobreak >nul

goto monitor_loop
