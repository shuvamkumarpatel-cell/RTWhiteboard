@echo off
set DOTNET_CLI_HOME=C:\Users\shuva\OneDrive\Documents\New project\.dotnet
set DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1
set NUGET_PACKAGES=C:\Users\shuva\OneDrive\Documents\New project\.nuget\packages
set APPDATA=C:\Users\shuva\OneDrive\Documents\New project\.appdata
set USERPROFILE=C:\Users\shuva\OneDrive\Documents\New project
set HOME=C:\Users\shuva\OneDrive\Documents\New project
set ASPNETCORE_URLS=http://localhost:5240
cd /d C:\Users\shuva\OneDrive\Documents\New project
dotnet run --project .\backend\Whiteboard.Api\Whiteboard.Api.csproj --no-launch-profile
