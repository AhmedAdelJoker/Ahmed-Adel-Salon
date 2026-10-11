@echo off
REM ============================================================
REM  SalonPro - double-click to run the whole project
REM  Backend :8000 + Frontend :5173
REM ============================================================

cd /d "%~dp0"

title SalonPro

echo.
echo  ============================================
echo    SalonPro - Barber Luxe ERP
echo  ============================================
echo.

REM -- Fast path: powershell.exe is always present on Windows.
where powershell >nul 2>&1
if errorlevel 1 (
    echo  [X] PowerShell not found on this machine.
    echo      Windows PowerShell ships with Windows; try repairing the OS.
    echo.
    pause
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run.ps1" %*

set EXITCODE=%ERRORLEVEL%

echo.
if not "%EXITCODE%"=="0" (
    echo  Stopped with exit code %EXITCODE%.
) else (
    echo  Project stopped.
)
echo.
pause
exit /b %EXITCODE%