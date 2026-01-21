@echo off
chcp 437 > nul
cd /d "%~dp0"

echo.
echo  Penguin Magic World - Stop Service
echo.

:: Stop services
echo  Stopping services (port 8767 and 8766)...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":8767 " ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
    echo  [OK] Stopped PID: %%a (8767)
)
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":8766 " ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
    echo  [OK] Stopped PID: %%a (8766)
)

:: Close related cmd windows
taskkill /f /fi "WINDOWTITLE eq PenguinMagic-Backend" >nul 2>&1

echo.
echo  [OK] All services stopped!
echo.
timeout /t 3 > nul
