@echo off
setlocal enabledelayedexpansion

title FarmSentinal - Universal Launcher (Universal Python Compatibility)
color 0A

echo ================================================================
echo   FarmSentinal - Universal Monitoring Dashboard Launcher
echo ================================================================
echo.

set "ROOT_DIR=%~dp0"

:: 1. Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not found in PATH!
    echo Please install Node.js v18 or higher from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: 2. Check Python executable
set "PYTHON_EXE="
where python >nul 2>nul
if %errorlevel% equ 0 (
    set "PYTHON_EXE=python"
) else (
    where py >nul 2>nul
    if %errorlevel% equ 0 (
        set "PYTHON_EXE=py"
    )
)

where uv >nul 2>nul
set "HAS_UV=%errorlevel%"

if "!PYTHON_EXE!"=="" if %HAS_UV% neq 0 (
    echo [ERROR] Neither Python nor uv was found in your PATH!
    echo Please install Python 3.8 or higher from https://www.python.org/
    echo.
    pause
    exit /b 1
)

echo ----------------------------------------------------------------
echo [1/4] Setting up Backend environment and dependencies...
echo ----------------------------------------------------------------
cd /d "%ROOT_DIR%backend"

if %HAS_UV% equ 0 (
    echo [INFO] Astral uv tool found. Syncing backend dependencies...
    call uv sync
) else (
    echo [INFO] uv not found. Using standard Python environment setup...
    if not exist .venv (
        echo Creating Python virtual environment in backend...
        call !PYTHON_EXE! -m venv .venv
    )
    echo Installing backend dependencies into virtual environment...
    call .venv\Scripts\python.exe -m pip install --upgrade pip
    call .venv\Scripts\python.exe -m pip install --prefer-binary -r requirements.txt
)

echo.
echo ----------------------------------------------------------------
echo [2/4] Setting up Frontend dependencies...
echo ----------------------------------------------------------------
cd /d "%ROOT_DIR%frontend"
if not exist node_modules (
    echo Installing frontend packages with npm...
    call npm install
) else (
    echo Frontend node_modules verified.
)

echo.
echo ----------------------------------------------------------------
echo [3/4] Launching FarmSentinal Services...
echo ----------------------------------------------------------------

cd /d "%ROOT_DIR%"

echo Starting FastAPI Backend Server on http://localhost:8000...
start "FarmSentinal Backend" cmd /k "cd /d %ROOT_DIR%backend && .venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000"

echo Starting React Frontend Dashboard on http://localhost:3000...
start "FarmSentinal Frontend" cmd /k "cd /d %ROOT_DIR%frontend && npm run dev -- --port 3000"

echo.
echo [4/4] Opening Dashboard in browser...
ping 127.0.0.1 -n 4 >nul
start http://localhost:3000

echo.
echo ================================================================
echo   FarmSentinal is up and running!
echo   - Dashboard URL: http://localhost:3000
echo   - Backend API URL: http://localhost:8000
echo   - Swagger API Docs: http://localhost:8000/docs
echo ================================================================
echo.
pause
