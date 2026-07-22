@echo off
echo ===================================================
echo   Starting Local Career141 Development Environment
echo ===================================================
echo.

echo [1/3] Starting local self-hosted Convex Docker containers...
docker compose up -d
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Failed to start Docker. Please make sure Docker Desktop is running!
    pause
    exit /b %errorlevel%
)

echo [2/3] Starting Next.js frontend (npm run dev)...
start "Career141 Next.js Frontend" cmd /k "npm run dev"

echo [3/3] Starting Convex Local dev tracking (npm run dev:local)...
start "Career141 Convex Compiler" cmd /k "npm run dev:local"

echo.
echo ===================================================
echo   Success! Local development environment is starting.
echo ===================================================
echo   - Local Dashboard:  http://localhost:6791
echo   - Frontend App:     http://localhost:3000
echo ===================================================
echo.
pause
