FROM mcr.microsoft.com/dotnet/sdk:9.0
ENV DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1
WORKDIR /workspace
RUN mkdir -p /runner/app
COPY backend/CodeRunner.Service/images/csharp/Runner.csproj /runner/app/Runner.csproj
COPY backend/CodeRunner.Service/images/csharp/Program.cs /runner/app/Program.cs
RUN dotnet restore /runner/app/Runner.csproj
COPY backend/CodeRunner.Service/images/csharp/run.sh /runner/run.sh
RUN chmod +x /runner/run.sh
ENTRYPOINT ["/runner/run.sh"]
