@echo off
rem Double-click this file to install and start Ndalama for testing on your phone.
title Ndalama
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js is not installed. Your browser will open the download page.
  echo Install the "LTS" version, restart your computer, then double-click this file again.
  start https://nodejs.org/en/download
  pause
  exit /b 1
)

node -e "process.exit(Number(process.versions.node.split('.')[0]) < 20 ? 1 : 0)"
if errorlevel 1 (
  echo.
  echo Your Node.js is too old. Ndalama needs version 20 or newer.
  echo Install the "LTS" version from nodejs.org, then double-click this file again.
  start https://nodejs.org/en/download
  pause
  exit /b 1
)

if not exist node_modules (
  echo.
  echo Installing Ndalama for the first time. This takes a few minutes...
  call npm install
  if errorlevel 1 (
    echo.
    echo Installing failed. Check your internet connection and try again.
    pause
    exit /b 1
  )
)

echo.
echo Starting Ndalama. When the QR code appears:
echo   Android: open Expo Go and tap "Scan QR code"
echo   iPhone:  open the Camera app and point it at the QR code
echo Keep this window open while you use the app. Close it to stop.
echo.
call npx expo start
pause
