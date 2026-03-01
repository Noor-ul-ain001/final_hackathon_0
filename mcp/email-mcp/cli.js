#!/usr/bin/env node
/**
 * CLI wrapper for MCP email-mcp server
 * Allows Python scripts to call MCP tools via subprocess
 *
 * Usage:
 *   echo '{"tool": "send_email", "arguments": {...}}' | node cli.js
 */

const { google } = require('googleapis');
const fs = require('fs').promises;
const path = require('path');

// Gmail API scopes
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify'
];

const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');

/**
 * Load OAuth credentials
 */
async function loadCredentials() {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const credentials = JSON.parse(content);
  return credentials;
}

/**
 * Load saved tokens
 */
async function loadToken() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    return JSON.parse(content);
  } catch (err) {
    throw new Error('Token not found. Run setup_auth.bat first.');
  }
}

/**
 * Create authorized Gmail client
 */
async function authorize() {
  const credentials = await loadCredentials();
  const token = await loadToken();

  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  oAuth2Client.setCredentials(token);
  return oAuth2Client;
}

/**
 * Send email via Gmail API
 */
async function sendEmail(auth, to, subject, body, cc = null, bcc = null, inReplyTo = null, references = null) {
  const gmail = google.gmail({ version: 'v1', auth });

  // Build email message
  const emailLines = [];
  emailLines.push(`To: ${to}`);
  if (cc) emailLines.push(`Cc: ${cc}`);
  if (bcc) emailLines.push(`Bcc: ${bcc}`);
  emailLines.push(`Subject: ${subject}`);
  if (inReplyTo) emailLines.push(`In-Reply-To: ${inReplyTo}`);
  if (references) emailLines.push(`References: ${references}`);
  emailLines.push('Content-Type: text/plain; charset=utf-8');
  emailLines.push('');
  emailLines.push(body);

  const email = emailLines.join('\r\n');

  // Encode to base64url
  const encodedMessage = Buffer.from(email)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  try {
    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });

    return {
      success: true,
      messageId: result.data.id,
      threadId: result.data.threadId,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Read emails from Gmail
 */
async function readEmails(auth, maxResults = 10, query = 'is:unread') {
  const gmail = google.gmail({ version: 'v1', auth });

  try {
    const result = await gmail.users.messages.list({
      userId: 'me',
      maxResults: maxResults,
      q: query,
    });

    const messages = result.data.messages || [];

    // Get full message details
    const fullMessages = await Promise.all(
      messages.map(async (msg) => {
        const message = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'full',
        });
        return message.data;
      })
    );

    return {
      success: true,
      count: fullMessages.length,
      messages: fullMessages,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Main CLI handler
 */
async function main() {
  try {
    // Read JSON from stdin
    let input = '';
    process.stdin.setEncoding('utf8');

    for await (const chunk of process.stdin) {
      input += chunk;
    }

    if (!input.trim()) {
      console.error(JSON.stringify({ success: false, error: 'No input provided' }));
      process.exit(1);
    }

    const request = JSON.parse(input);
    const { tool, arguments: args } = request;

    // Authorize with Gmail
    const auth = await authorize();

    // Execute requested tool
    let result;
    switch (tool) {
      case 'send_email':
        result = await sendEmail(
          auth,
          args.to,
          args.subject,
          args.body,
          args.cc,
          args.bcc,
          args.in_reply_to,
          args.references
        );
        break;

      case 'read_emails':
        result = await readEmails(
          auth,
          args.max_results || 10,
          args.query || 'is:unread'
        );
        break;

      default:
        result = { success: false, error: `Unknown tool: ${tool}` };
    }

    // Output result as JSON
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);

  } catch (error) {
    console.error(JSON.stringify({ success: false, error: error.message }));
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { sendEmail, readEmails };
