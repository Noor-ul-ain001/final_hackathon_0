# X/Twitter Integration for AI Employee

## Overview

The X/Twitter integration provides comprehensive social media management capabilities for the AI Employee system. It connects to the X/Twitter API to manage posting, engagement monitoring, and analytics reporting.

## Components

### 1. X/Twitter MCP Server (`mcp/twitter-mcp/`)

The Model Context Protocol (MCP) server enables Claude Code to interact with X/Twitter through a secure API.

#### Available Tools

**Posting:**
- `twitter_post_tweet` - Post new tweet (max 280 characters)
- `twitter_reply_to_tweet` - Reply to specific tweet

**Monitoring:**
- `twitter_get_mentions` - Get recent mentions
- `twitter_get_engagement` - Get metrics for recent tweets

**Research:**
- `twitter_search_tweets` - Search tweets by query
- `twitter_get_user_info` - Get user profile info

**Reporting:**
- `twitter_get_weekly_summary` - Generate activity summary

### 2. Social Media Watcher (`social_media_watcher.py`)

Monitors scheduled posts and engagement metrics, creating action files in the Obsidian vault for review.

#### Features:
- Scheduled posting based on configured schedule
- Engagement monitoring and reporting
- Weekly summary generation for CEO briefings
- Handles approval workflow for posts

### 3. X/Twitter Skill (`skills/twitter-manager.skill.md`)

Defines the workflow and best practices for using X/Twitter functionality within the AI Employee system.

## Configuration

### Environment Variables

Add the following to your `.env` file:

```bash
# X/Twitter API Configuration
TWITTER_API_KEY=your_api_key
TWITTER_API_SECRET=your_api_secret
TWITTER_ACCESS_TOKEN=your_access_token
TWITTER_ACCESS_TOKEN_SECRET=your_access_token_secret
TWITTER_BEARER_TOKEN=your_bearer_token
USE_TWITTER_MCP=true
```

### MCP Configuration

The `mcp.json` file should include the X/Twitter server configuration:

```json
{
  "name": "twitter",
  "command": "node",
  "args": ["C:/path/to/mcp/twitter-mcp/index.js"],
  "env": {
    "TWITTER_API_KEY": "${TWITTER_API_KEY}",
    "TWITTER_API_SECRET": "${TWITTER_API_SECRET}",
    "TWITTER_ACCESS_TOKEN": "${TWITTER_ACCESS_TOKEN}",
    "TWITTER_ACCESS_TOKEN_SECRET": "${TWITTER_ACCESS_SECRET}",
    "TWITTER_BEARER_TOKEN": "${TWITTER_BEARER_TOKEN}",
    "VAULT_PATH": "./AI_Employee_Vault",
    "DRY_RUN": "false",
    "NODE_ENV": "production"
  }
}
```

## Usage Examples

### Posting a Tweet

```javascript
// Using MCP client
const result = await client.call_tool('twitter', 'twitter_post_tweet', {
  text: "Excited to share our latest project update! #AI #Automation"
});
```

### Getting Engagement Metrics

```javascript
// Get engagement for recent tweets
const engagement = await client.call_tool('twitter', 'twitter_get_engagement', {
  count: 10
});

// Get weekly summary
const summary = await client.call_tool('twitter', 'twitter_get_weekly_summary', {
  days: 7
});
```

## Security Considerations

1. **Credential Management**: Store X/Twitter API credentials in environment variables, never in code
2. **Rate Limits**: The system handles X/Twitter API rate limits automatically
3. **Approval Workflows**: Certain posts require human approval
4. **Audit Logging**: All X/Twitter operations are logged for review

## Error Handling

The system implements robust error handling:

- **Rate Limiting**: Automatic backoff when API limits are reached
- **Authentication Errors**: Credential refresh alerts
- **Content Errors**: Validation before posting
- **Simulation Mode**: Fallback when credentials are not configured

## Integration Points

- **CEO Briefing Generator**: Uses X/Twitter data for social media reporting
- **Ralph Wiggum Loop**: Executes multi-step social media workflows
- **Dashboard**: Displays social media KPIs
- **Content Calendar**: Manages scheduled posts

## Troubleshooting

### Common Issues

1. **API Rate Limits**: X/Twitter has strict rate limits - system will automatically retry
2. **Authentication Failed**: Check credentials in environment variables
3. **Character Limit Exceeded**: Tweets must be under 280 characters
4. **Permission Denied**: Ensure app has required permissions (read/write/access_dm)

### Debugging

Enable debug logging by setting `LOG_LEVEL=DEBUG` in your environment.

## Development Notes

### Extending Functionality

To add new X/Twitter operations:

1. Add the tool definition to the TOOLS array in `mcp/twitter-mcp/index.js`
2. Implement the corresponding function
3. Add the function call to the `executeTool` switch statement
4. Update the X/Twitter skill documentation

### Testing

Use the test script to verify functionality:
```bash
python test_x_twitter_integration.py
```

## Production Deployment

For production use:

1. Ensure proper API key security and rotation procedures
2. Monitor rate limit usage
3. Implement proper error handling and notifications
4. Regular security audits of credentials and access controls