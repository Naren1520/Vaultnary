@echo off
setlocal
title Vaultnary Dev
cd /d "%~dp0"
if errorlevel 1 goto :fail

set "PATH=C:\msys64\mingw64\bin;%PATH%"
set "RUSTUP_TOOLCHAIN=stable-x86_64-pc-windows-gnu"

echo.
echo  Vaultnary - Starting development environment
echo  =============================================
echo.

if not exist ".env" (
    echo  ERROR: .env was not found. Copy .env.example to .env and configure it first.
    goto :fail
)
if not exist "apps\web\node_modules" (
    echo  ERROR: Frontend dependencies are missing. Run npm install in apps\web.
    goto :fail
)
where cargo >nul 2>nul
if errorlevel 1 (
    echo  ERROR: Cargo was not found on PATH.
    goto :fail
)
where sqlx >nul 2>nul
if errorlevel 1 (
    echo  ERROR: sqlx-cli was not found on PATH.
    goto :fail
)
where npm >nul 2>nul
if errorlevel 1 (
    echo  ERROR: npm was not found on PATH.
    goto :fail
)

echo [1/3] Running database migrations...
sqlx migrate run
if errorlevel 1 (
    echo.
    echo  ERROR: Migrations failed. Check DATABASE_URL and PostgreSQL in .env.
    goto :fail
)
echo  Migrations OK.
echo.

echo [2/3] Starting API server...
curl.exe --fail --silent http://127.0.0.1:8080/api/v1/health >nul 2>nul
if errorlevel 1 (
    start "Vaultnary API" /D "%~dp0" cmd /k "cargo run --bin api"
) else (
    echo  API is already responding at http://localhost:8080.
)

echo [3/3] Starting frontend...
curl.exe --fail --silent http://127.0.0.1:5173/ >nul 2>nul
if errorlevel 1 (
    start "Vaultnary Frontend" /D "%~dp0apps\web" cmd /k "npm run dev -- --host 127.0.0.1"
) else (
    echo  Frontend is already responding at http://localhost:5173.
)

echo.
echo  Development services are starting in separate windows.
echo    Frontend  -^>  http://localhost:5173
echo    API       -^>  http://localhost:8080
echo.
exit /b 0

:fail
echo.
pause
exit /b 1
