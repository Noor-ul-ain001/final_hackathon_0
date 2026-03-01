const { Server, StdioServerTransport, createHandler, tools, resources } = require('@modelcontextprotocol/sdk/server');
const { google } = require('googleapis');
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
require('dotenv').config();

// Gmail API setup
let gmailService = null;

async function initializeGmailService() {
  try {
    const credentialsPath = process.env.GMAIL_CREDENTIALS_PATH || './credentials.json';
    const tokenPath = process.env.GMAIL_TOKEN_PATH || './token.json';

    // Check if token file exists
    try {
      await fs.access(tokenPath);
    } catch {
      throw new Error(`Token file not found at ${tokenPath}. Run 'node auth.js' to authenticate first.`);
    }

    const credentials = JSON.parse(await fs.readFile(credentialsPath, 'utf8'));
    const token = JSON.parse(await fs.readFile(tokenPath, 'utf8'));

    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    oAuth2Client.setCredentials(token);
    gmailService = google.gmail({ version: 'v1', auth: oAuth2Client });

    console.log('✅ Gmail service initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing Gmail service:', error.message);
    console.log('');
    console.log('💡 Troubleshooting tips:');
    console.log('- Make sure you have run "node auth.js" to authenticate first');
    console.log('- Verify your email is added as a test user in Google Cloud Console');
    console.log('- Check that your credentials.json and token.json files exist and are valid');
    console.log('- See docs/OAUTH_CONSENT_SETUP.md for setup instructions');
    throw error;
  }
}

// Tool to send email
const sendEmailTool = tools.define({
  name: 'send_email',
  description: 'Send an email using Gmail API',
  inputSchema: {
    type: 'object',
    properties: {
      to: {
        type: 'string',
        description: 'Recipient email address'
      },
      subject: {
        type: 'string',
        description: 'Email subject'
      },
      body: {
        type: 'string',
        description: 'Email body content'
      },
      cc: {
        type: 'string',
        description: 'CC email addresses (optional)',
        optional: true
      },
      bcc: {
        type: 'string',
        description: 'BCC email addresses (optional)',
        optional: true
      }
    },
    required: ['to', 'subject', 'body']
  }
}, async ({ to, subject, body, cc, bcc }) => {
  if (!gmailService) {
    throw new Error('Gmail service not initialized');
  }

  try {
    const rawMessage = makeBody(to, cc, bcc, subject, body);
    
    const result = await gmailService.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: rawMessage
      }
    });

    return {
      success: true,
      messageId: result.data.id,
      message: `Email sent successfully to ${to}`
    };
  } catch (error) {
    console.error('Error sending email:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

// Helper function to create email message
function makeBody(to, cc, bcc, subject, body) {
  const boundary = '=====0123456789=====';
  let message = '';

  message += `To: ${to}\r\n`;
  if (cc) message += `Cc: ${cc}\r\n`;
  if (bcc) message += `Bcc: ${bcc}\r\n`;
  message += `Subject: ${subject}\r\n`;
  message += 'Content-Type: multipart/mixed; boundary="' + boundary + '"\r\n\r\n';

  message += '--' + boundary + '\r\n';
  message += 'Content-Type: text/plain; charset=UTF-8\r\n\r\n';
  message += body + '\r\n';
  message += '--' + boundary + '--';

  const encodedMessage = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
  return encodedMessage;
}

// Tool to read emails
const readEmailsTool = tools.define({
  name: 'read_emails',
  description: 'Read emails from Gmail inbox',
  inputSchema: {
    type: 'object',
    properties: {
      maxResults: {
        type: 'number',
        description: 'Maximum number of emails to return (default: 10)',
        optional: true
      },
      query: {
        type: 'string',
        description: 'Search query to filter emails (optional)',
        optional: true
      }
    }
  }
}, async ({ maxResults = 10, query = '' }) => {
  if (!gmailService) {
    throw new Error('Gmail service not initialized');
  }

  try {
    const response = await gmailService.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: maxResults
    });

    const messages = response.data.messages || [];
    const emailDetails = [];

    for (const message of messages) {
      const emailResponse = await gmailService.users.messages.get({
        userId: 'me',
        id: message.id
      });

      const headers = emailResponse.data.payload.headers;
      const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
      const from = headers.find(h => h.name === 'From')?.value || 'Unknown Sender';
      
      // Extract body content
      let body = '';
      if (emailResponse.data.payload.parts) {
        const textPart = emailResponse.data.payload.parts.find(part => part.mimeType === 'text/plain');
        if (textPart) {
          body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
        }
      } else if (emailResponse.data.payload.body && emailResponse.data.payload.body.data) {
        body = Buffer.from(emailResponse.data.payload.body.data, 'base64').toString('utf-8');
      }

      emailDetails.push({
        id: message.id,
        subject: subject,
        from: from,
        body: body.substring(0, 500) + '...' // Truncate long bodies
      });
    }

    return {
      success: true,
      emails: emailDetails,
      count: emailDetails.length
    };
  } catch (error) {
    console.error('Error reading emails:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

// Create the MCP server handler
const handler = createHandler({
  tools: {
    send_email: sendEmailTool,
    read_emails: readEmailsTool
  },
  resources: {}
});

// Initialize the Gmail service and start the server
async function startServer() {
  try {
    await initializeGmailService();
    
    const server = new Server({
      name: 'email-mcp',
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
    
    console.log('Email MCP server started and ready to handle requests');
  } catch (error) {
    console.error('Failed to start Email MCP server:', error.message);
    process.exit(1);
  }
}

// Start the server
startServer();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down Email MCP server...');
  process.exit(0);
});