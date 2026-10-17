@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
    echo Please install Node.js LTS from https://nodejs.org/ before starting FreeInk.
    pause
    exit /b 1
)
if not exist "node_modules\electron" (
    echo Installing FreeInk desktop dependencies for the first run...
    call npm install
    if errorlevel 1 (
        echo Installation failed. Check your internet connection.
        pause
        exit /b 1
    )
)
call npm start
if errorlevel 1 pause
