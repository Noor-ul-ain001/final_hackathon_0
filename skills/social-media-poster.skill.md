# Social Media Poster Skill

## Description
Creates and schedules engaging social media content for Twitter/X, Facebook, and Instagram platforms. Generates platform-optimized content based on business goals and recent achievements.

## When to Use
- Scheduled posting times (configured per platform)
- When new content needs to be shared
- When engagement campaigns are requested
- When business achievements should be publicized

## Supported Platforms
1. **Twitter/X**: Short-form content (280 chars max), hashtags, threads
2. **Facebook**: Long-form content, link previews, questions
3. **Instagram**: Visual-first content, hashtag strategies, captions

## Input Requirements
- Access to `/AI_Employee_Vault/Business_Goals.md`
- Access to `/AI_Employee_Vault/Done/` (recent achievements)
- Access to Social Media MCP server
- Platform-specific requirements (character limits, image requirements)

## Process Steps

### 1. Content Strategy
Before creating content, consider:
- Current business objectives
- Recent achievements worth sharing
- Industry trends and relevant topics
- Audience engagement patterns
- Posting schedule compliance

### 2. Platform-Specific Guidelines

#### Twitter/X
```
- Max 280 characters
- Use 2-3 relevant hashtags
- Include call-to-action
- Thread for longer content
- Optimal times: 9 AM, 12 PM, 5 PM
```

#### Facebook
```
- Optimal length: 40-80 characters for engagement
- Can be longer for detailed posts
- Include engaging questions
- Use link previews effectively
- Optimal times: 1-4 PM
```

#### Instagram
```
- Visual content required
- Caption up to 2,200 characters
- Place hashtags at end or in comment
- Use 5-10 relevant hashtags
- Optimal times: 11 AM, 1 PM, 7 PM
```

### 3. Content Generation Template

```markdown
## [Platform] Post Draft

**Objective:** [What this post aims to achieve]
**Topic:** [Main subject]
**Tone:** [Professional/Casual/Inspiring/Educational]

### Content
[Main post content here]

### Hashtags
#hashtag1 #hashtag2 #hashtag3

### Media Suggestion
[Image/video recommendation if applicable]

### Call-to-Action
[What action do you want readers to take?]
```

### 4. Content Types

#### Achievement Posts
```
Template: "We're excited to share [achievement]!
This milestone represents [significance].
Thank you to [acknowledgment].
#milestone #achievement"
```

#### Educational Posts
```
Template: "Did you know? [Interesting fact]
Here's why this matters: [Explanation]
Want to learn more? [CTA]
#TipTuesday #industry"
```

#### Behind-the-Scenes
```
Template: "Here's a peek behind the curtain at [company]
[Process/team/work description]
What would you like to see more of?
#BTS #companyculture"
```

#### Value Posts
```
Template: "3 ways to [solve problem]:
1. [Tip 1]
2. [Tip 2]
3. [Tip 3]
Which tip are you trying first?
#tips #howto"
```

### 5. Approval Workflow

1. Generate draft content
2. Save to `/Pending_Approval/SOCIAL_[platform]_[date].md`
3. Wait for human to move to `/Approved/`
4. Once approved, use Social MCP to post

### 6. Post Using MCP

For Twitter:
```javascript
await mcp.call('social-mcp', 'post_to_twitter', {
    content: "Your tweet content here",
    media_url: "optional_image_url"
});
```

For Facebook:
```javascript
await mcp.call('social-mcp', 'post_to_facebook', {
    content: "Your Facebook post content",
    link: "optional_link_url"
});
```

For Instagram:
```javascript
await mcp.call('social-mcp', 'post_to_instagram', {
    caption: "Your Instagram caption",
    image_url: "required_image_url"
});
```

## Content Calendar Integration

### Default Schedule
| Day | Platform | Time | Content Type |
|-----|----------|------|--------------|
| Monday | LinkedIn | 9 AM | Professional/Industry |
| Tuesday | Twitter | 12 PM | Tips/Education |
| Wednesday | Facebook | 1 PM | Engagement/Questions |
| Thursday | Instagram | 7 PM | Visual/Behind-scenes |
| Friday | Twitter | 3 PM | Weekend wrap-up |

### Scheduling Posts
```javascript
await mcp.call('social-mcp', 'schedule_post', {
    platform: "twitter",
    content: "Scheduled content here",
    scheduled_time: "2026-01-20T09:00:00Z"
});
```

## Metrics and Optimization

### Track Performance
```javascript
const metrics = await mcp.call('social-mcp', 'get_engagement_metrics', {
    platform: "all",
    days: 7
});
```

### Key Metrics to Monitor
- Engagement rate (target: >3%)
- Click-through rate (target: >1%)
- Follower growth (target: >5%/month)
- Best performing content types
- Optimal posting times

### Optimization Rules
1. Replicate high-performing content themes
2. Adjust timing based on engagement data
3. A/B test different content formats
4. Increase frequency on best-performing platforms

## Error Handling

### API Failures
- Queue post for retry
- Log error with context
- Alert if multiple failures

### Rate Limits
- Respect platform rate limits
- Space out posts appropriately
- Use scheduling for bulk content

## Output Format

### Success
```json
{
    "success": true,
    "platform": "twitter",
    "post_id": "1234567890",
    "content_preview": "First 50 chars...",
    "posted_at": "2026-01-15T09:00:00Z"
}
```

### Logged in Audit
```json
{
    "action_type": "social_post",
    "platform": "twitter",
    "approval_status": "approved",
    "result": "success"
}
```

## Best Practices

1. **Consistency**: Post at regular intervals
2. **Authenticity**: Match brand voice
3. **Engagement**: Ask questions, use CTAs
4. **Timing**: Post when audience is active
5. **Variety**: Mix content types
6. **Visual**: Include images when possible
7. **Hashtags**: Research trending and relevant tags
8. **Compliance**: Follow platform guidelines

## Integration Points
- Reads from: Business_Goals.md, Done folder
- Writes to: Pending_Approval, Social_Media folder
- Uses: social-mcp server
- Logs to: Audit system
