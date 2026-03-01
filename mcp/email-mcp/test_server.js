const { Server, StdioServerTransport, createHandler, tools } = require('@modelcontextprotocol/sdk/server');
const { google } = require('googleapis');
const fs = require('fs').promises;
require('dotenv').config();

// For testing purposes, let's create a mock tool that doesn't require Gmail connection
const testEmailTool = tools.define({
  name: 'test_connection',
  description: 'Test tool to verify MCP server is working',
  inputSchema: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'Test message to echo back'
      }
    }
  }
}, async ({ message }) => {
  return {
    success: true,
    message: `Test successful: ${message}`,
    timestamp: new Date().toISOString()
  };
});

// Create the MCP server handler
const handler = createHandler({
  tools: {
    test_connection: testEmailTool
  },
  resources: {}
});

// Start the server
async function startServer() {
  try {
    const server = new Server({
      name: 'email-mcp-test',
      version: '1.0.0',
      capabilities: {
        tools: true,
        resources: true
      }
    });

    server.setRequestHandler(handler);

    // Use stdio transport for MCP communication
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    console.log('Test Email MCP server started and ready to handle requests');
    console.log('Test tool "test_connection" is available');
  } catch (error) {
    console.error('Failed to start Test Email MCP server:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down Test Email MCP server...');
  process.exit(0);
});