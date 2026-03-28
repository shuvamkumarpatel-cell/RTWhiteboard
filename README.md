# Realtime Whiteboard

A full-stack collaborative whiteboard built with an ASP.NET Core API backend and a React + TypeScript frontend.

## Stack

- Backend: ASP.NET Core Web API, SignalR, in-memory room state
- Frontend: React, TypeScript, Vite, Canvas API, SignalR client

## Project structure

- `backend/Whiteboard.Api` - REST API and SignalR hub
- `backend/CodeRunner.Service` - isolated execution service scaffold for code runs
- `frontend` - React application

## Run the backend

```powershell
$env:DOTNET_CLI_HOME="$PWD/.dotnet"
$env:DOTNET_SKIP_FIRST_TIME_EXPERIENCE="1"
dotnet restore .\backend\Whiteboard.Api\Whiteboard.Api.csproj --configfile .\backend\NuGet.Config
dotnet run --project .\backend\Whiteboard.Api\Whiteboard.Api.csproj
```

The API runs on `http://localhost:5240` by default.

## Run the code runner

```powershell
$env:DOTNET_CLI_HOME="$PWD/.dotnet"
$env:DOTNET_SKIP_FIRST_TIME_EXPERIENCE="1"
dotnet restore .\backend\CodeRunner.Service\CodeRunner.Service.csproj --configfile .\backend\NuGet.Config
dotnet run --project .\backend\CodeRunner.Service\CodeRunner.Service.csproj
```

The runner listens on `http://localhost:5360` by default. The main API forwards code-execution requests there.

## Phase 2: Dockerized language sandboxes

Phase 2 adds a dedicated runner service that executes code inside per-language Docker images instead of relying on host-installed compilers.

Build the runner images:

```powershell
.\build-runner-images.cmd
```

Then run the runner service:

```powershell
.\run-runner.cmd
```

This architecture means the execution host only needs Docker plus the runner service. End users do not need to install language runtimes locally in the browser environment.

Supported runnable languages in the current Docker setup:

- JavaScript
- Python
- Java
- C++
- C#

## Run the frontend

```powershell
Copy-Item .\frontend\.env.example .\frontend\.env -Force
npm.cmd install --prefix .\frontend
npm.cmd run dev --prefix .\frontend
```

The Vite app runs on `http://localhost:5173`.

## Run the full app

Once the Docker images are built, you can launch runner, backend, and frontend together:

```powershell
.\run-all.cmd
```

This opens three terminal windows, one for each service:

- code runner on `http://localhost:5360`
- backend API on `http://localhost:5240`
- frontend on `http://localhost:5173`

## Features

- Shared rooms with generated room ids
- Real-time drawing via SignalR
- Shared code editor with Monaco-based autocomplete
- Phase 1 remote code-runner architecture scaffold
- Participant presence list
- Brush color and size controls
- Clear board action
- Invite link copy support

## Free hosting: Cloudflare Pages + Render

This project is set up for a free hosting path with:

- Frontend on Cloudflare Pages
- Backend on Render Web Service

### 1. Push the repo to GitHub

Create a GitHub repository and push this project.

### 2. Deploy the backend to Render

You can create the service manually in Render or use the included [render.yaml](C:/Users/shuva/OneDrive/Documents/New%20project/render.yaml).

Manual settings:

- Service type: Web Service
- Runtime: .NET
- Root directory: `backend/Whiteboard.Api`
- Build command: `dotnet publish -c Release -o out`
- Start command: `dotnet ./out/Whiteboard.Api.dll`
- Plan: `Free`

Environment variables:

- `ASPNETCORE_ENVIRONMENT=Production`
- `FRONTEND_ORIGINS=https://your-pages-domain.pages.dev`

After deploy, verify:

- `https://your-render-service.onrender.com/health`
- `https://your-render-service.onrender.com/api/rooms/studio`

### 3. Deploy the frontend to Cloudflare Pages

In Cloudflare Pages, connect the same GitHub repo and use:

- Framework preset: `Vite`
- Root directory: `frontend`
- Build command: `npm run build`
- Build output directory: `dist`

Environment variable:

- `VITE_API_URL=https://your-render-service.onrender.com`

You can copy [frontend/.env.production.example](C:/Users/shuva/OneDrive/Documents/New%20project/frontend/.env.production.example) as a reference for this value.

### 4. Update backend CORS

Once Cloudflare gives you your real Pages URL, set Render's `FRONTEND_ORIGINS` to that exact origin, for example:

```text
https://realtime-whiteboard.pages.dev
```

If you later attach a custom domain, include both origins as a comma-separated list:

```text
https://realtime-whiteboard.pages.dev,https://whiteboard.yourdomain.com
```

### 5. Test the deployed app

Open the Cloudflare Pages URL in two browser windows and join the same room. Drawing, clearing, and participant presence should sync through the Render backend.

## Deployment notes

- Render free services can sleep after inactivity, so the first API request may take a little longer.
- Board data is currently stored in memory only. If the backend restarts, rooms and drawings are lost.
- For production-grade hosting, the next step is adding persistent storage such as PostgreSQL and a shared SignalR backplane if you scale beyond one backend instance.
