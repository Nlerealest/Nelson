@echo off
title Nelson - XAUUSD bot
cd /d "%~dp0"
where python >nul 2>nul || (echo Install Python 3.11+ from https://www.python.org first ^(tick "Add to PATH"^). & pause & exit /b)
if not exist .venv (
  echo First run: setting up Nelson...
  python -m venv .venv
  .venv\Scripts\python -m pip install --upgrade pip
  .venv\Scripts\python -m pip install -r requirements.txt
)
if not exist config.yaml (
  copy config.example.yaml config.yaml >nul
  echo Created config.yaml - it starts in PAPER mode ^(analysis only^). Edit it to change that.
)
echo Make sure MetaTrader 5 is open and logged in, with "Algo Trading" enabled.
.venv\Scripts\python run_nelson.py live
pause
