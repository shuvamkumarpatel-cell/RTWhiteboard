#!/bin/sh
set -eu
cp /workspace/Program.cs /runner/app/Program.cs
dotnet run --project /runner/app/Runner.csproj --no-restore --no-launch-profile < /workspace/stdin.txt
