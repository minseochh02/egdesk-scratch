@echo off
REM Quick Process Check - Simpler alternative to PowerShell script
REM Run this after clicking the password field

echo =============================================
echo Quick Security Software Check
echo =============================================
echo.
echo Checking for known security software...
echo.

echo === Running Processes ===
tasklist | findstr /I "nprotect npk touchenc veraport wizvera ipin interezen dream ksign keysharp inca ahnlab raon"
echo.

echo === Running Services ===
sc query | findstr /I "nprotect touchenc veraport wizvera ipin raon inca"
echo.

echo === Chrome Extension Check ===
if exist "%LOCALAPPDATA%\Google\Chrome\User Data\Default\Extensions\" (
    echo Chrome extensions found. Checking for security-related extensions...
    dir /b "%LOCALAPPDATA%\Google\Chrome\User Data\Default\Extensions\"
) else (
    echo Chrome extensions folder not found
)
echo.

echo === All Running Processes (for manual review) ===
echo Saving to processes.txt...
tasklist /V > processes.txt
echo Saved to processes.txt
echo.

echo =============================================
echo Done! Check the output above.
echo =============================================
echo.
echo If you see any of these keywords, that's your security software:
echo   - nprotect / npk
echo   - touchenc / raon
echo   - veraport / wizvera
echo   - ipin / interezen
echo   - keysharp / dream
echo.
pause
