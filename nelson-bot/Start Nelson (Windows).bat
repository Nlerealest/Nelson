@echo off
title Nelson - XAUUSD bot
cd /d "%~dp0"

where python >nul 2>nul || (
  echo Python was not found. Install 64-bit Python 3.12 from https://www.python.org
  echo and tick "Add python.exe to PATH" on the first screen of the installer.
  pause
  exit /b
)

rem A .venv copied from another PC points to that PC's Python and cannot run here: rebuild it
if exist .venv\Scripts\python.exe (
  .venv\Scripts\python -c "import sys" >nul 2>nul
  if errorlevel 1 (
    echo The .venv folder was made on another computer - rebuilding it...
    rmdir /s /q .venv
  )
)

if not exist .venv\Scripts\python.exe (
  echo First run: setting up Nelson...
  python -m venv .venv
  if not exist .venv\Scripts\python.exe (
    echo Could not create the .venv folder. Move Nelson out of OneDrive, e.g. to C:\Nelson, and try again.
    pause
    exit /b
  )
)

rem Install the packages whenever any is missing, so a failed first install is retried
.venv\Scripts\python -c "import yaml, pandas, numpy, requests, MetaTrader5" >nul 2>nul
if errorlevel 1 (
  echo Installing Nelson's packages - this takes a few minutes...
  .venv\Scripts\python -m pip install --upgrade pip
  .venv\Scripts\python -m pip install -r requirements.txt
  .venv\Scripts\python -c "import yaml, pandas, numpy, requests, MetaTrader5" >nul 2>nul
  if errorlevel 1 (
    echo.
    echo Installing failed - read the red error lines above.
    .venv\Scripts\python -c "import sys, struct; print('Your Python:', sys.version.split()[0], struct.calcsize('P') * 8, 'bit')"
    echo Nelson needs 64-bit Python 3.10 to 3.14 and an internet connection.
    echo If your Python is 32-bit, install 64-bit Python 3.12, delete the .venv folder here, and run this again.
    pause
    exit /b
  )
)

if not exist config.yaml (
  copy config.example.yaml config.yaml >nul
  echo Created config.yaml - it starts in PAPER mode ^(analysis only^). Edit it to change that.
)
echo Make sure MetaTrader 5 is open and logged in, with "Algo Trading" enabled.
.venv\Scripts\python run_nelson.py live
pause
