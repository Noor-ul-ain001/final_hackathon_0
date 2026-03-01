# LinkedIn MCP Server

A Model Context Protocol (MCP) server that enables Claude Code to post content to LinkedIn.

## Features

- Create LinkedIn posts with text content
- Support for hashtags and visibility settings
- Multiple API fallbacks (REST API, UGC Posts, Shares)
- Dry-run mode for testing
- Detailed logging to vault

## Quick Start

### 1. Get LinkedIn Credentials

You need two things:
1. **Access Token** - From LinkedIn OAuth flow
2. **Person ID** - Your LinkedIn member ID

### 2. Getting Your LinkedIn Person ID

The Person ID is required for posting. Here are ways to find it:

#### Option A: From LinkedIn Developer Portal OAuth Response
When you complete the OAuth flow, the token response includes your member ID.

#### Option B: From Your Profile URL (sometimes)
Your LinkedIn profile URL might contain your ID: `linkedin.com/in/your-id`

#### Option C: From LinkedIn API (if you have profile scope)
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" https://api.linkedin.com/v2/me
```

#### Option D: Use the Token Introspection
You can decode your access token (if it's a JWT) to find the `sub` claim.

### 3. Configure Environment

Set these environment variables in your `.env` file or `mcp.json`:

```bash
# Required
LINKEDIN_ACCESS_TOKEN=your_access_token_here

# Required if token doesn't have profile read permissions
LINKEDIN_PERSON_ID=your_person_id_here

# Optional
DRY_RUN=false  # Set to true for testing
VAULT_PATH=../../AI_Employee_Vault
```

### 4. LinkedIn App Setup

1. Go to [LinkedIn Developers](https://www.linkedin.com/developers/)
2. Create a new app or select existing one
3. Go to **Products** tab
4. Request access to:
   - **Sign In with LinkedIn using OpenID Connect** - For profile access
   - **Share on LinkedIn** - For posting
5. Go to **Auth** tab
6. Add OAuth 2.0 scopes:
   - `openid` - Basic authentication
   - `profile` - Read profile info
   - `w_member_social` - Post on behalf of user
7. Generate access token using the OAuth 2.0 flow

### OAuth 2.0 Token Generation

Use this URL to start the OAuth flow:
```
https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=YOUR_CLIENT_ID&redirect_uri=YOUR_REDIRECT_URI&scope=openid%20profile%20w_member_social
```

Then exchange the code for a token:
```bash
curl -X POST https://www.linkedin.com/oauth/v2/accessToken \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=YOUR_AUTH_CODE" \
  -d "redirect_uri=YOUR_REDIRECT_URI" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET"
```

## MCP Configuration

Add to your `mcp.json`:

```json
{
  "name": "linkedin",
  "command": "node",
  "args": ["./mcp/linkedin-mcp/index.js"],
  "env": {
    "VAULT_PATH": "/path/to/AI_Employee_Vault",
    "LINKEDIN_ACCESS_TOKEN": "your_access_token",
    "LINKEDIN_PERSON_ID": "your_person_id",
    "DRY_RUN": "false",
    "NODE_ENV": "production"
  }
}
```

## Available Tools

### `linkedin_create_post`

Create and publish a text post on LinkedIn.

**Parameters:**
- `content` (string, required): The text content of the post (max 3000 chars)
- `visibility` (string, optional): "PUBLIC" or "CONNECTIONS" (default: "PUBLIC")
- `hashtags` (array, optional): List of hashtags without # symbol (max 5)

**Example:**
```json
{
  "content": "Excited to share that I've automated my LinkedIn posting workflow!",
  "visibility": "PUBLIC",
  "hashtags": ["Automation", "AI", "Productivity"]
}
```

### `linkedin_get_profile`

Get the authenticated user's LinkedIn profile information.

### `linkedin_get_post_analytics`

Get analytics for a LinkedIn post (requires Marketing Developer Platform access).

## API Fallbacks

The server tries multiple LinkedIn APIs in order:

1. **REST API** (`/rest/posts`) - New versioned API (recommended)
2. **UGC Posts API** (`/v2/ugcPosts`) - Older but widely supported
3. **Shares API** (`/v2/shares`) - Legacy fallback

## Troubleshooting

### "ACCESS_DENIED" Error

Your token doesn't have the required scopes. Regenerate with:
- `openid` - For authentication
- `profile` - For reading profile info
- `w_member_social` - For posting

### "Cannot post without user ID"

Set `LINKEDIN_PERSON_ID` in your environment variables.

### "Not enough permissions"

Ensure your LinkedIn app has the "Share on LinkedIn" product enabled.

### Token Expired

LinkedIn access tokens expire after 60 days. Regenerate the token using the OAuth flow.

## Logging

All actions are logged to:
- `{VAULT_PATH}/Logs/linkedin_YYYY-MM-DD.json` - API activity
- `{VAULT_PATH}/Done/LINKEDIN_POST_*.md` - Successful posts

## Development

```bash
# Install dependencies
npm install

# Run in dry-run mode
DRY_RUN=true node index.js

# Run with actual posting
DRY_RUN=false LINKEDIN_ACCESS_TOKEN=xxx LINKEDIN_PERSON_ID=xxx node index.js
```

## Support

- LinkedIn API: [LinkedIn Developer Support](https://www.linkedin.com/help/linkedin/topics/6122/6125)
- LinkedIn API Docs: [Microsoft Learn](https://learn.microsoft.com/en-us/linkedin/)
- MCP Protocol: [MCP Documentation](https://modelcontextprotocol.io)
