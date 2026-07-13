@echo off
setlocal EnableExtensions
title Tier Canvas Launcher
cd /d "%~dp0"

where npm.cmd >nul 2>nul
if errorlevel 1 goto INSTALL_NODE

node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 20 ? 0 : 1)" >nul 2>nul
if errorlevel 1 goto INSTALL_NODE

if not exist "node_modules" (
  echo.
  echo Installing project dependencies. This only happens on first launch.
  echo.
  call npm.cmd install
  if errorlevel 1 (
    echo.
    echo [ERROR] Dependency installation failed. Check your network and try again.
    echo.
    pause
    exit /b 1
  )
)

echo.
echo Starting Tier Canvas Generator...
echo Your browser will open at http://127.0.0.1:5173
echo Keep this window open while using the app. Press Ctrl+C to stop it.
echo.
call npm.cmd run dev -- --open
set "SERVER_EXIT=%ERRORLEVEL%"

echo.
echo The development server has stopped.
pause
exit /b %SERVER_EXIT%

:INSTALL_NODE
echo.
echo Node.js 20 or later is required and was not found.
echo.

where winget.exe >nul 2>nul
if errorlevel 1 goto OPEN_NODE_DOWNLOAD

echo Installing the current Node.js LTS release with Windows Package Manager...
echo Windows may ask for permission. Follow its prompts, then run this file again.
echo.
winget install --id OpenJS.NodeJS.LTS -e --source winget --accept-package-agreements --accept-source-agreements
if errorlevel 1 (
  echo.
  echo [ERROR] Node.js installation did not finish successfully.
  echo Check your network or install Node.js from the official download page.
  start "" "https://nodejs.org/en/download"
  echo.
  pause
  exit /b 1
)

echo.
echo Node.js LTS has been installed.
echo Close this window, then double-click this launcher once more.
echo.
pause
exit /b 0

:OPEN_NODE_DOWNLOAD
echo Windows Package Manager was not found.
echo Opening the official Node.js download page instead.
start "" "https://nodejs.org/en/download"
echo.
pause
exit /b 1
