@echo off
cd /d "%~dp0"

echo ========================================
echo  Nativo Dev Server
echo ========================================

netstat -ano | findstr ":3000" | findstr "LISTENING" >nul
if not errorlevel 1 (
    echo A server is already running on port 3000.
    echo Close the existing server window first, then run this again.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [1/2] Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo Failed to install dependencies.
        pause
        exit /b 1
    )
)

echo [2/2] Starting dev server... (http://localhost:3000)
call npm run dev

pause
