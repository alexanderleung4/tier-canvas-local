@echo off
setlocal EnableExtensions
title Tier Canvas Launcher
cd /d "%~dp0"

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo.
  echo [ERROR] Node.js and npm were not found.
  echo Install Node.js 20 or later, then run this file again.
  echo.
  pause
  exit /b 1
)

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

echo.
echo The development server has stopped.
pause
