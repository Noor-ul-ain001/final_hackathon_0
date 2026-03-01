@echo off
REM ============================================
REM AI Employee - Odoo Setup Script (Windows)
REM Gold Tier Requirement
REM ============================================

echo.
echo ========================================
echo   AI Employee - Odoo Setup
echo   Gold Tier Accounting Integration
echo ========================================
echo.

REM Check if Docker is installed
docker --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Docker is not installed or not in PATH.
    echo Please install Docker Desktop from: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

REM Check if Docker is running
docker info >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Docker is not running.
    echo Please start Docker Desktop and try again.
    pause
    exit /b 1
)

echo [OK] Docker is installed and running
echo.

REM Check if docker-compose is available
docker-compose --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [INFO] docker-compose command not found, trying 'docker compose'...
    docker compose version >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Neither docker-compose nor 'docker compose' is available.
        pause
        exit /b 1
    )
    set COMPOSE_CMD=docker compose
) else (
    set COMPOSE_CMD=docker-compose
)

echo [OK] Docker Compose is available
echo.

REM Create required directories
echo [INFO] Creating directories...
if not exist "odoo-addons" mkdir odoo-addons
if not exist "odoo-config" mkdir odoo-config
echo [OK] Directories created
echo.

REM Start Odoo
echo [INFO] Starting Odoo containers...
echo This may take a few minutes on first run (downloading images)...
echo.
%COMPOSE_CMD% up -d

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to start Odoo containers.
    echo Check docker-compose.yml and try again.
    pause
    exit /b 1
)

echo.
echo [OK] Odoo containers started successfully!
echo.

REM Wait for Odoo to be ready
echo [INFO] Waiting for Odoo to initialize (this takes 30-60 seconds)...
timeout /t 30 /nobreak >nul

REM Check if Odoo is responding
curl -s http://localhost:8069/web/database/selector >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [INFO] Odoo still starting, waiting another 30 seconds...
    timeout /t 30 /nobreak >nul
)

echo.
echo ========================================
echo   SETUP COMPLETE!
echo ========================================
echo.
echo Next steps:
echo.
echo 1. Open your browser and go to: http://localhost:8069
echo.
echo 2. Create a new database with these settings:
echo    - Master Password: admin_master_password
echo    - Database Name: ai_employee
echo    - Email: admin@ai-employee.local
echo    - Password: admin123
echo    - Language: English (US)
echo    - Country: Your country
echo.
echo 3. After login, install these apps:
echo    - Invoicing (for invoices and payments)
echo    - Expenses (for expense tracking)
echo    - Contacts (for customer management)
echo    - Sales (optional, for sales orders)
echo.
echo 4. Update your .env file:
echo    - Set USE_ODOO_MCP=true
echo    - Verify ODOO_PASSWORD=admin123
echo.
echo 5. Restart the AI Employee system
echo.
echo ========================================
echo.

REM Open browser
echo Opening Odoo in your default browser...
start http://localhost:8069

pause
