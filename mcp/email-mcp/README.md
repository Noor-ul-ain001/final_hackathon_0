# Email MCP Server

This is a Model Context Protocol (MCP) server that enables Claude Code to send and read emails using the Gmail API.

## Features

- Send emails via Gmail API
- Read emails from Gmail inbox
- Integration with Claude Code via MCP protocol

## Prerequisites

- Node.js 14+ installed
- Google Cloud project with Gmail API enabled
- `credentials.json` file from Google Cloud Console
- Properly authenticated `token.json` file (generated via OAuth flow)

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up Google Cloud credentials:**
   - If you don't have `credentials.json`, create a Google Cloud project and download it from the Google Cloud Console
   - Place `credentials.json` in this directory

3. **Authenticate with Google:**
   ```bash
   node auth.js
   ```
   This will start a local server and provide an authorization URL. Visit the URL, log in to your Google account, and authorize the application. You'll be redirected to localhost:3000, which will save the authentication token.

4. **Configure environment (optional):**
   Copy `.env` file to set custom paths for credentials and token files.

## Usage

Start the MCP server:
```bash
node index.js
```

The server will connect to Claude Code via the MCP protocol and make the email tools available.

## Available Tools

### send_email
Sends an email via Gmail API.

Parameters:
- `to` (string): Recipient email address
- `subject` (string): Email subject
- `body` (string): Email body content
- `cc` (string, optional): CC email addresses
- `bcc` (string, optional): BCC email addresses

### read_emails
Reads emails from Gmail inbox.

Parameters:
- `maxResults` (number, optional): Maximum number of emails to return (default: 10)
- `query` (string, optional): Search query to filter emails

## Claude Code Integration

The server is configured to work with Claude Code through MCP. Make sure your Claude Code settings include the MCP configuration pointing to this server.

## Troubleshooting

- If you get authentication errors, regenerate your `token.json` by running `node auth.js` again
- Ensure your Google Cloud project has the Gmail API enabled
- Check that your credentials.json has the correct redirect URI