@echo off
setlocal
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "DOTNET_CLI_HOME=%ROOT%\.dotnet"
set "DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1"
set "NUGET_PACKAGES=%ROOT%\.nuget\packages"
set "APPDATA=%ROOT%\.appdata"
set "USERPROFILE=%ROOT%"
set "HOME=%ROOT%"
set "ASPNETCORE_URLS=http://localhost:5360"
cd /d "%ROOT%"
dotnet run --project ".\backend\CodeRunner.Service\CodeRunner.Service.csproj" --no-launch-profile
