@echo off
setlocal
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
cd /d "%ROOT%\backend\CodeRunner.Service"
docker compose -f docker-compose.images.yml build
