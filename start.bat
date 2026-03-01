@echo off
title AI Employee - Dynamic System
echo.
echo ============================================
echo    AI EMPLOYEE - Dynamic Orchestrator
echo ============================================
echo.

cd /d "%~dp0"

REM Check if Docker is running for Odoo
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Docker not running - Odoo integration disabled
    echo        Start Docker Desktop for accounting features
    echo.
) else (
    echo [INFO] Docker detected - checking Odoo containers...
    docker-compose ps -q >nul 2>&1
    if %errorlevel% equ 0 (
        docker-compose up -d
        echo [INFO] Odoo containers starting...
    )
)

echo.
echo Starting Dynamic Orchestrator...
echo.
echo Components:
echo   - Gmail Watcher
echo   - LinkedIn Watcher
echo   - Twitter/Social Media Watcher
echo   - Filesystem Watcher
echo   - Odoo Accounting Watcher
echo   - Ralph Wiggum Task Loop
echo   - WhatsApp Notifications
echo   - CEO Briefing Scheduler
echo.
echo Press Ctrl+C to stop
echo ============================================
echo.

python dynamic_orchestrator.py %*

pause
