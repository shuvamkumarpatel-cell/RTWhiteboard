@echo off
setlocal
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

start "RTWhiteboard Runner" cmd /k "cd /d %ROOT% && run-runner.cmd"
start "RTWhiteboard Backend" cmd /k "cd /d %ROOT% && run-backend.cmd"
start "RTWhiteboard Frontend" cmd /k "cd /d %ROOT% && run-frontend.cmd"
