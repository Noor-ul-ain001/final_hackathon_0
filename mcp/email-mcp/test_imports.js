// Simple test to validate imports
console.log('Testing MCP server imports...');

try {
    const { Server, StdioServerTransport, createHandler, tools, resources } = require('@modelcontextprotocol/sdk/server');
    console.log('✅ MCP SDK imports successful');
    
    const { google } = require('googleapis');
    console.log('✅ Google APIs import successful');
    
    const express = require('express');
    console.log('✅ Express import successful');
    
    const fs = require('fs').promises;
    console.log('✅ FS import successful');
    
    console.log('\\n🎉 All imports successful! The server should work properly.');
    
} catch (error) {
    console.error('❌ Import error:', error.message);
    console.error('Stack:', error.stack);
}