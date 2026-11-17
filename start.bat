@echo off
REM ==============================================================================
REM DataForge AI - Self-Healing Startup Script (Windows)
REM ==============================================================================

setlocal enabledelayedexpansion

echo ==================================================================
echo           Launching DataForge AI Platform (Windows)
echo ==================================================================

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

REM 1. Verify Prerequisites
echo [Step 1/5] Checking runtime prerequisites...

where python >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Error: Python is not installed or not in PATH.
    echo Please install Python 3.9+ from https://www.python.org/
    exit /b 1
)

where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Error: Node.js is not installed or not in PATH.
    echo Please install Node.js 18+ from https://nodejs.org/
    exit /b 1
)

where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Error: npm is not installed or not in PATH.
    echo Please install Node.js/npm from https://nodejs.org/
    exit /b 1
)

REM 2. Prepare Python Environment
echo [Step 2/5] Preparing Python Virtual Environment...
cd /d "%SCRIPT_DIR%backend"
if not exist "venv" (
    echo   Creating virtual environment in backend\venv...
    python -m venv venv
    call venv\Scripts\activate.bat
    echo   Installing backend dependencies...
    python -m pip install --upgrade pip
    pip install -r requirements.txt
) else (
    call venv\Scripts\activate.bat
)

if not exist "%SCRIPT_DIR%backend\data" mkdir "%SCRIPT_DIR%backend\data"

REM 3. Prepare Frontend Environment
echo [Step 3/5] Checking Frontend Dependencies...
cd /d "%SCRIPT_DIR%frontend"
if not exist "node_modules" (
    echo   Installing frontend dependencies...
    call npm install
)

REM 4. Launch Backend and Frontend in separate windows
echo [Step 4/5] Starting Backend (Port 8080)...
set "PYTHONPATH=%SCRIPT_DIR%backend"
start "DataForge AI Backend" cmd /k "cd /d "%SCRIPT_DIR%backend" && call venv\Scripts\activate.bat && set PYTHONPATH=%SCRIPT_DIR%backend && uvicorn app.main:app --host 127.0.0.1 --port 8080 --reload"

echo [Step 5/5] Starting Frontend (Port 3000)...
start "DataForge AI Frontend" cmd /k "cd /d "%SCRIPT_DIR%frontend" && npm run dev -- --port 3000 --host 127.0.0.1"

echo ==================================================================
echo   DataForge AI is running!
echo   Web UI:         http://127.0.0.1:3000
echo   REST API Docs:  http://127.0.0.1:8080/docs
echo ==================================================================
