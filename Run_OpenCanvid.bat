@echo off
setlocal
cd /d "%~dp0"

if exist "%~dp0release_electron\OpenCanvid.exe" (
    start "" "%~dp0release_electron\OpenCanvid.exe"
    exit /b 0
)

if exist "%~dp0OpenCanvid.exe" (
    start "" "%~dp0OpenCanvid.exe"
    exit /b 0
)

echo Launching OpenCanvid via Electron...
call npx electron .
exit /b 0
