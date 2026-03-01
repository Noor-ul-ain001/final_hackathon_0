# Twitter Manager Skill

## Description
Manages Twitter/X social media presence through the Twitter MCP server including posting tweets, monitoring engagement, responding to mentions, and generating weekly social media summaries for CEO briefings.

## When to Use
- Posting scheduled or ad-hoc tweets
- Monitoring and responding to mentions
- Analyzing engagement metrics
- Generating weekly social media reports
- Searching for relevant industry tweets
- Building social presence strategy

## Input Requirements
- Twitter MCP server configured and running
- Valid Twitter API credentials (API key, secret, access tokens)
- Content guidelines from Business_Goals.md
- Brand voice guidelines from Company_Handbook.md

## MCP Tools Available

### Posting
- `twitter_post_tweet` - Post new tweet (max 280 chars)
- `twitter_reply_to_tweet` - Reply to specific tweet

### Monitoring
- `twitter_get_mentions` - Get recent mentions
- `twitter_get_engagement` - Get metrics for recent tweets

### Research
- `twitter_search_tweets` - Search tweets by query
- `twitter_get_user_info` - Get user profile info

### Reporting
- `twitter_get_weekly_summary` - Generate activity summary

## Process Steps

### Posting a Tweet

1. **Draft Content**
   - Review Business_Goals.md for messaging priorities
   - Keep under 280 characters
   - Include relevant hashtags (max 2-3)
   - Consider optimal posting time

2. **Content Validation**
   - Character count check
   - Brand voice alignment
   - No sensitive information
   - Grammar and spelling check

3. **Post Tweet**
   ```
   Tool: twitter_post_tweet
   Parameters:
     text: "Your tweet content here #hashtag"
   ```

4. **Record and Monitor**
   - Log tweet to audit trail
   - Check initial engagement after 1 hour
   - Update dashboard

### Responding to Mentions

1. **Get Recent Mentions**
   ```
   Tool: twitter_get_mentions
   Parameters:
     count: 20
   ```

2. **Analyze Each Mention**
   - Determine sentiment (positive, neutral, negative)
   - Identify if response needed
   - Prioritize based on follower count/relevance

3. **Draft Response**
   - Keep professional and friendly
   - Address the specific point raised
   - Include call-to-action if appropriate

4. **Reply to Tweet**
   ```
   Tool: twitter_reply_to_tweet
   Parameters:
     tweet_id: "1234567890"
     text: "Thanks for reaching out! ..."
   ```

### Weekly Summary for CEO Briefing

1. **Collect Metrics**
   ```
   Tool: twitter_get_weekly_summary
   Parameters:
     days: 7
   ```

2. **Analyze Performance**
   - Total tweets posted
   - Engagement rates (likes, retweets, replies)
   - Follower growth
   - Top performing content
   - Mention volume and sentiment

3. **Generate Insights**
   - What content worked best
   - Optimal posting times
   - Audience interests
   - Competitor activity

4. **Create Summary Section**
   ```markdown
   ## Social Media (Twitter)
   - **Tweets Posted:** X
   - **Total Engagement:** X likes, X retweets
   - **Top Tweet:** [content] (X likes)
   - **Mentions:** X (X% positive)
   - **Follower Growth:** +X
   ```

## Content Guidelines

### Tweet Best Practices
- Start with a hook or question
- Use emojis sparingly (1-2 max)
- Include call-to-action when relevant
- Post during business hours (9AM-5PM)
- Avoid controversial topics

### Content Categories
1. **Value Posts** (60%) - Tips, insights, industry news
2. **Engagement Posts** (20%) - Questions, polls, discussions
3. **Promotional Posts** (15%) - Products, services, offers
4. **Personal Posts** (5%) - Behind-the-scenes, team highlights

### Hashtag Strategy
- Use 1-3 relevant hashtags
- Mix popular and niche hashtags
- Create brand hashtag for campaigns
- Research trending hashtags in industry

## Approval Requirements

### Always Requires Approval
- Any promotional content
- Responses to complaints
- Content mentioning competitors
- Political or sensitive topics

### Auto-Approved
- Thank you replies
- Simple engagement replies
- Scheduled content from approved calendar

## Error Handling

### Rate Limiting
- Twitter API has rate limits
- Back off and retry after delay
- Queue posts for later if limit hit

### Authentication Errors
- Alert for token refresh
- Check API key validity
- Verify app permissions

### Content Errors
- Validate character count before posting
- Check for banned words/phrases
- Verify media attachments if any

## Example Workflows

### Daily Social Check
```
1. Get overnight mentions
2. Review and categorize
3. Draft responses for important mentions
4. Create approval requests
5. Post approved responses
6. Log all activity
```

### Content Calendar Execution
```
1. Read scheduled posts from vault
2. For each post due today:
   a. Validate content
   b. Check for relevance/timing
   c. Request approval if needed
   d. Post when approved
3. Update calendar status
```

### Engagement Analysis
```
1. Get engagement metrics (last 7 days)
2. Identify top performing tweets
3. Analyze engagement patterns
4. Generate recommendations
5. Update strategy document
```

## Integration Points
- CEO Briefing Generator (weekly social metrics)
- Ralph Wiggum Loop (automated posting workflows)
- Content Calendar (scheduled posts)
- Dashboard (engagement KPIs)

## Security Considerations
- Never share API credentials
- Don't post customer data
- Avoid DMs for sensitive info
- Use DRY_RUN for testing

## Success Metrics
- Engagement rate: > 3%
- Response time to mentions: < 4 hours
- Post frequency: 3-5 per week
- Follower growth: > 5% monthly
- Sentiment: > 80% positive/neutral
