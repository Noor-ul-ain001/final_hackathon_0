const { Server, StdioServerTransport, createHandler, tools, resources } = require('@modelcontextprotocol/sdk/server');
const { google } = require('googleapis');
const express = require('express');
const fs = require('fs').promises;
require('dotenv').config();

// Calendar service setup (placeholder - would connect to actual calendar service)
let calendarService = null;

// Tool to create calendar event
const createEventTool = tools.define({
  name: 'create_calendar_event',
  description: 'Create a new calendar event',
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Title of the event'
      },
      startTime: {
        type: 'string',
        description: 'Start time in ISO format (e.g., 2023-12-01T10:00:00Z)'
      },
      endTime: {
        type: 'string',
        description: 'End time in ISO format (e.g., 2023-12-01T11:00:00Z)'
      },
      description: {
        type: 'string',
        description: 'Description of the event (optional)',
        optional: true
      },
      attendees: {
        type: 'array',
        items: {
          type: 'string'
        },
        description: 'List of attendee email addresses (optional)',
        optional: true
      },
      location: {
        type: 'string',
        description: 'Location of the event (optional)',
        optional: true
      }
    },
    required: ['title', 'startTime', 'endTime']
  }
}, async ({ title, startTime, endTime, description, attendees, location }) => {
  try {
    // In a real implementation, this would connect to Google Calendar API or similar
    // For now, we'll simulate the action
    console.log(`Creating calendar event: ${title}`);
    console.log(`Time: ${startTime} to ${endTime}`);
    
    if (location) {
      console.log(`Location: ${location}`);
    }
    
    if (attendees && attendees.length > 0) {
      console.log(`Attendees: ${attendees.join(', ')}`);
    }

    // Simulate creating an event
    return {
      success: true,
      eventId: `event_${Date.now()}`,
      message: `Calendar event "${title}" created successfully`
    };
  } catch (error) {
    console.error('Error creating calendar event:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

// Tool to update calendar event
const updateEventTool = tools.define({
  name: 'update_calendar_event',
  description: 'Update an existing calendar event',
  inputSchema: {
    type: 'object',
    properties: {
      eventId: {
        type: 'string',
        description: 'ID of the event to update'
      },
      title: {
        type: 'string',
        description: 'New title of the event (optional)',
        optional: true
      },
      startTime: {
        type: 'string',
        description: 'New start time in ISO format (optional)',
        optional: true
      },
      endTime: {
        type: 'string',
        description: 'New end time in ISO format (optional)',
        optional: true
      },
      description: {
        type: 'string',
        description: 'New description of the event (optional)',
        optional: true
      },
      attendees: {
        type: 'array',
        items: {
          type: 'string'
        },
        description: 'New list of attendee email addresses (optional)',
        optional: true
      },
      location: {
        type: 'string',
        description: 'New location of the event (optional)',
        optional: true
      }
    },
    required: ['eventId']
  }
}, async ({ eventId, title, startTime, endTime, description, attendees, location }) => {
  try {
    // In a real implementation, this would connect to Google Calendar API or similar
    console.log(`Updating calendar event: ${eventId}`);
    
    return {
      success: true,
      message: `Calendar event ${eventId} updated successfully`
    };
  } catch (error) {
    console.error('Error updating calendar event:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

// Tool to delete calendar event
const deleteEventTool = tools.define({
  name: 'delete_calendar_event',
  description: 'Delete a calendar event',
  inputSchema: {
    type: 'object',
    properties: {
      eventId: {
        type: 'string',
        description: 'ID of the event to delete'
      }
    },
    required: ['eventId']
  }
}, async ({ eventId }) => {
  try {
    // In a real implementation, this would connect to Google Calendar API or similar
    console.log(`Deleting calendar event: ${eventId}`);
    
    return {
      success: true,
      message: `Calendar event ${eventId} deleted successfully`
    };
  } catch (error) {
    console.error('Error deleting calendar event:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

// Tool to read calendar events
const readEventsTool = tools.define({
  name: 'read_calendar_events',
  description: 'Read upcoming calendar events',
  inputSchema: {
    type: 'object',
    properties: {
      maxResults: {
        type: 'number',
        description: 'Maximum number of events to return (default: 10)',
        optional: true
      },
      timeMin: {
        type: 'string',
        description: 'Start time to search for events (ISO format, default: now)',
        optional: true
      },
      timeMax: {
        type: 'string',
        description: 'End time to search for events (ISO format, optional)',
        optional: true
      }
    }
  }
}, async ({ maxResults = 10, timeMin, timeMax }) => {
  try {
    // In a real implementation, this would fetch from Google Calendar API
    // For now, return a simulated response
    return {
      success: true,
      events: [],
      count: 0,
      message: 'Calendar events retrieved successfully'
    };
  } catch (error) {
    console.error('Error reading calendar events:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

// Create the MCP server handler
const handler = createHandler({
  tools: {
    create_calendar_event: createEventTool,
    update_calendar_event: updateEventTool,
    delete_calendar_event: deleteEventTool,
    read_calendar_events: readEventsTool
  },
  resources: {}
});

// Initialize and start the server
async function startServer() {
  try {
    const server = new Server({
      name: 'calendar-mcp',
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

    console.log('Calendar MCP server started and ready to handle requests');
  } catch (error) {
    console.error('Failed to start Calendar MCP server:', error.message);
    process.exit(1);
  }
}

// Start the server
startServer();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down Calendar MCP server...');
  process.exit(0);
});