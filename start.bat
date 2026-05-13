@echo off
setlocal

set "ROOT=%~dp0"
set "FRONTEND=%ROOT%frontend"
set "BACKEND=%ROOT%backend"

echo Installing frontend dependencies...
pushd "%FRONTEND%"
if not exist "node_modules\.bin\vite.cmd" (
	call npm install
	if errorlevel 1 exit /b 1
) else (
	echo Frontend dependencies already installed; skipping reinstall.
)
popd

echo Syncing backend dependencies with uv...
pushd "%BACKEND%"
call uv sync
if errorlevel 1 exit /b 1
popd

echo Starting backend...
start "" cmd /k "cd /d ""%BACKEND%"" && uv run uvicorn app.main:app --reload --env-file .env"

echo Starting frontend...
start "" cmd /k "cd /d ""%FRONTEND%"" && npm run dev"

endlocal
