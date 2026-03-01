@echo off
echo Starting Email MCP Server...
echo.

cd /d "C:\Users\E\Desktop\AI_Employee\mcp\email-mcp"

if not exist token.json (
    echo Warning: token.json not found!
    echo Please run 'node auth.js' first to authenticate with Google
    echo.
    echo Would you like to run authentication now? (y/n)
    set /p answer=
    if /i "%answer%"=="y" (
        node auth.js
        if errorlevel 1 (
            echo Authentication failed. Exiting.
            pause
            exit /b 1
        )
    ) else (
        echo Please authenticate before starting the server.
        pause
        exit /b 1
    )
)

echo Starting Email MCP Server...
node index.js

pause