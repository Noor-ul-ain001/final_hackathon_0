# X/Twitter and Calendar Integration for AI Employee

## Overview

This document provides a comprehensive guide to the X/Twitter and Calendar integration features in the AI Employee system. These features enable automated social media management and scheduling capabilities.

## X/Twitter Integration

### Features
- Automated posting of tweets
- Engagement monitoring and analytics
- Mention tracking and response
- Scheduled posting
- Weekly social media reporting

### Configuration

#### Environment Variables
Add these to your `.env` file:
```bash
TWITTER_API_KEY=your_api_key
TWITTER_API_SECRET=your_api_secret
TWITTER_ACCESS_TOKEN=your_access_token
TWITTER_ACCESS_TOKEN_SECRET=your_access_token_secret
TWITTER_BEARER_TOKEN=your_bearer_token
USE_TWITTER_MCP=true
```

#### MCP Server
The X/Twitter MCP server is located at `mcp/twitter-mcp/` and provides the following tools:
- `twitter_post_tweet` - Post new tweet (max 280 characters)
- `twitter_reply_to_tweet` - Reply to specific tweet
- `twitter_get_mentions` - Get recent mentions
- `twitter_get_engagement` - Get metrics for recent tweets
- `twitter_search_tweets` - Search tweets by query
- `twitter_get_user_info` - Get user profile info
- `twitter_get_weekly_summary` - Generate activity summary

### Usage

#### Posting a Tweet
The system monitors the `/Pending_Approval/` folder for tweet requests. Create a file with the tweet content and move it to `/Approved/` to post.

#### Monitoring Engagement
The system automatically tracks engagement metrics and generates weekly reports for CEO briefings.

## Calendar Integration

### Features
- Event scheduling and management
- Integration with AI Employee tasks
- Visual calendar view
- Task extraction from vault files
- Automatic event creation based on scheduled activities

### Components

#### Calendar Page
Located at `/calendar`, this page provides:
- Monthly calendar view
- Daily schedule view
- Upcoming events list
- Ability to create new events

#### API Route
The `/api/calendar` route fetches events from the vault and system activities.

#### MCP Integration
The calendar MCP server at `mcp/calendar-mcp/` provides:
- `create_calendar_event` - Create new calendar event
- `update_calendar_event` - Update existing event
- `delete_calendar_event` - Delete calendar event
- `read_calendar_events` - Read upcoming events

### Usage

#### Creating Events
Events can be created in multiple ways:
1. Through the calendar UI using the "Add Event" button
2. Automatically from scheduled tasks in the vault
3. Via MCP calls from other system components

#### Event Types
- **Task**: Routine AI Employee activities
- **Meeting**: Scheduled meetings
- **Deadline**: Important due dates
- **Review**: Periodic reviews and audits
- **Briefing**: CEO briefings and reports

## Integration with AI Employee System

### Workflow
1. **Task Detection**: System scans vault for scheduled tasks
2. **Event Creation**: Converts tasks to calendar events
3. **Notification**: Alerts Claude Code of upcoming events
4. **Execution**: Performs scheduled activities
5. **Reporting**: Updates calendar with completion status

### CEO Briefings
The calendar integrates with CEO briefing generation by:
- Tracking briefing schedules
- Providing engagement metrics
- Coordinating social media posts with briefing cycles

## Security Considerations

### API Keys
- Store API keys securely in environment variables
- Never commit credentials to version control
- Rotate keys regularly
- Use appropriate permissions

### Data Privacy
- Don't post sensitive information
- Respect user privacy settings
- Follow platform terms of service

## Troubleshooting

### Common Issues
1. **API Rate Limits**: X/Twitter has strict rate limits - system includes backoff mechanisms
2. **Authentication Failures**: Check credentials in environment variables
3. **Missing Events**: Verify vault paths and file formats

### Debugging
Enable debug logging by setting `LOG_LEVEL=DEBUG` in your environment.

## Development Notes

### Extending Functionality
To add new calendar features:
1. Update the MCP server with new tools
2. Modify the calendar page to use new functionality
3. Update the API route if needed
4. Test thoroughly with mock data

### Testing
Use the test scripts to verify functionality:
```bash
python test_x_twitter_integration.py
```

## Production Deployment

For production use:
1. Ensure proper API key security and rotation procedures
2. Monitor rate limit usage
3. Implement proper error handling and notifications
4. Regular security audits of credentials and access controls
5. Backup and recovery procedures for calendar data

## Best Practices

### X/Twitter
- Post during business hours (9AM-5PM)
- Include 1-3 relevant hashtags
- Keep content professional and on-brand
- Monitor engagement and adjust strategy

### Calendar
- Schedule important tasks in advance
- Use appropriate priority levels
- Keep event titles descriptive
- Regularly review and update scheduled events

## Error Handling

The system implements robust error handling:
- **Rate Limiting**: Automatic backoff when API limits are reached
- **Authentication Errors**: Credential refresh alerts
- **Content Errors**: Validation before posting
- **Simulation Mode**: Fallback when credentials are not configured