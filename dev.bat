@echo off
title Vaultnary Dev
cd /d "%~dp0"

echo.
echo  Vaultnary - Starting development environment
echo  =============================================
echo.

echo [1/3] Running database migrations...
set DATABASE_URL=postgres://vaultnary:narensj20@localhost:5020/vaultnary
sqlx migrate run
if %ERRORLEVEL% neq 0 (
    echo.
    echo  ERROR: Migrations failed. Check PostgreSQL is running.
    pause
    exit /b 1
)
echo  Migrations OK.
echo.

echo [2/3] Starting API server (reads .env automatically)...
start "Vaultnary API" cmd /k "cd /d %~dp0 && cargo run --bin api"

timeout /t 3 /nobreak >nul

echo [3/3] Starting frontend...
start "Vaultnary Frontend" cmd /k "cd /d %~dp0apps\web && npm run dev"

echo.
echo  Both servers starting in separate windows.
echo.
echo    Frontend  -^>  http://localhost:5173
echo    API       -^>  http://localhost:8080
echo.
echo  Wait for API window to show "Listening addr=0.0.0.0:8080"
echo  then open http://localhost:5173
echo.
pause
