const { Server, StdioServerTransport, createHandler, tools, resources } = require('@modelcontextprotocol/sdk/server');
const puppeteer = require('puppeteer');
const express = require('express');
const fs = require('fs').promises;
require('dotenv').config();

// Browser automation tools
const navigateToUrlTool = tools.define({
  name: 'navigate_to_url',
  description: 'Navigate to a specific URL in a browser',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'URL to navigate to'
      },
      waitForSelector: {
        type: 'string',
        description: 'CSS selector to wait for (optional)',
        optional: true
      }
    },
    required: ['url']
  }
}, async ({ url, waitForSelector }) => {
  try {
    // In a real implementation, this would use Puppeteer to navigate to the URL
    // For now, we'll simulate the action
    console.log(`Navigating to URL: ${url}`);
    if (waitForSelector) {
      console.log(`Waiting for selector: ${waitForSelector}`);
    }

    return {
      success: true,
      message: `Navigated to ${url}`,
      url: url
    };
  } catch (error) {
    console.error('Error navigating to URL:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

const clickElementTool = tools.define({
  name: 'click_element',
  description: 'Click an element on the webpage',
  inputSchema: {
    type: 'object',
    properties: {
      selector: {
        type: 'string',
        description: 'CSS selector of the element to click'
      }
    },
    required: ['selector']
  }
}, async ({ selector }) => {
  try {
    // In a real implementation, this would use Puppeteer to click the element
    console.log(`Clicking element with selector: ${selector}`);

    return {
      success: true,
      message: `Clicked element with selector: ${selector}`
    };
  } catch (error) {
    console.error('Error clicking element:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

const fillFormFieldTool = tools.define({
  name: 'fill_form_field',
  description: 'Fill a form field with a value',
  inputSchema: {
    type: 'object',
    properties: {
      selector: {
        type: 'string',
        description: 'CSS selector of the form field'
      },
      value: {
        type: 'string',
        description: 'Value to fill in the form field'
      }
    },
    required: ['selector', 'value']
  }
}, async ({ selector, value }) => {
  try {
    // In a real implementation, this would use Puppeteer to fill the form field
    console.log(`Filling form field ${selector} with value: ${value}`);

    return {
      success: true,
      message: `Filled form field ${selector} with value: ${value}`
    };
  } catch (error) {
    console.error('Error filling form field:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

const extractPageContentTool = tools.define({
  name: 'extract_page_content',
  description: 'Extract content from the current page',
  inputSchema: {
    type: 'object',
    properties: {
      selector: {
        type: 'string',
        description: 'CSS selector to extract content from (optional - if not provided, extracts all text)'
      }
    }
  }
}, async ({ selector }) => {
  try {
    // In a real implementation, this would use Puppeteer to extract content
    console.log(`Extracting page content${selector ? ` for selector: ${selector}` : ' (full page)'}`);

    return {
      success: true,
      content: 'Sample page content extracted here',
      message: selector ? `Extracted content for selector: ${selector}` : 'Extracted full page content'
    };
  } catch (error) {
    console.error('Error extracting page content:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

// Create the MCP server handler
const handler = createHandler({
  tools: {
    navigate_to_url: navigateToUrlTool,
    click_element: clickElementTool,
    fill_form_field: fillFormFieldTool,
    extract_page_content: extractPageContentTool
  },
  resources: {}
});

// Initialize and start the server
async function startServer() {
  try {
    const server = new Server({
      name: 'browser-mcp',
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

    console.log('Browser MCP server started and ready to handle requests');
  } catch (error) {
    console.error('Failed to start Browser MCP server:', error.message);
    process.exit(1);
  }
}

// Start the server
startServer();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down Browser MCP server...');
  process.exit(0);
});