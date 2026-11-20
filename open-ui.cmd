@echo off
setlocal
set PORT=8765
set HERE=%~dp0
netstat -ano | findstr ":%PORT% " | findstr LISTENING >nul 2>&1
if errorlevel 1 (
  start "DS5Dongle Web (keep open)" /min cmd /c "cd /d "%HERE%" && python -m http.server %PORT% --bind 127.0.0.1"
  timeout /t 2 >nul
)
start "" "http://127.0.0.1:%PORT%/index.html"
endlocal
