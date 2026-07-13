@echo off
setlocal
chcp 65001 >nul
title 从夯到拉排版生成器
cd /d "%~dp0"

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo 未检测到 Node.js / npm。
  echo 请先安装 Node.js 20 或更高版本，然后重新双击本文件。
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo 首次启动，正在安装依赖…
  call npm.cmd install
  if errorlevel 1 (
    echo.
    echo 依赖安装失败，请检查网络后重试。
    pause
    exit /b 1
  )
)

echo 正在启动从夯到拉排版生成器…
echo 浏览器会自动打开；关闭本窗口或按 Ctrl+C 可停止服务。
call npm.cmd run dev -- --open

if errorlevel 1 pause
