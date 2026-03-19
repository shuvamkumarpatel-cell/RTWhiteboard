@echo off
setlocal
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
cd /d "%ROOT%\frontend"
npm.cmd run dev -- --host 0.0.0.0
