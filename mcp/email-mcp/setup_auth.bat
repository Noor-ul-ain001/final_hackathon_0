#!/bin/bash
# Script to set up Gmail API authentication for the email MCP server

echo "Setting up Gmail API authentication for email MCP server..."

# Check if credentials.json exists
if [ ! -f "./credentials.json" ]; then
    echo "Error: credentials.json not found!"
    echo "Please make sure you have downloaded credentials.json from Google Cloud Console"
    exit 1
fi

echo "Installing dependencies..."
npm install

echo "Running authentication setup..."
node auth.js

echo "Authentication setup complete!"
echo "You can now start the email MCP server with: node index.js"