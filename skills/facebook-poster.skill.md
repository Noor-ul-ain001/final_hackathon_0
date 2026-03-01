# Facebook Poster Skill

## Description
Automatically creates and posts engaging content on Facebook to build community, drive engagement, and promote business activities. Analyzes business activities, completed projects, and goals to craft relevant posts that resonate with your Facebook audience.

## When to Use
- Scheduled posting (e.g., weekdays 1-3 PM for optimal engagement)
- After completing significant projects or milestones
- Sharing blog posts, articles, or external content
- Photo/video updates from business activities
- Community engagement and response posts
- Event promotions and announcements

## Input Requirements
- Access to `/AI_Employee_Vault/Business_Goals.md` for business context
- Access to `/AI_Employee_Vault/Tasks/Done/` for completed work
- Access to `/AI_Employee_Vault/Dashboard.md` for recent activities
- Facebook Page access token and Page ID
- Facebook MCP server configured

## Process Steps

1. **Gather Content Ideas**
   - Review recent completed projects in `/Tasks/Done/`
   - Check business goals and target audience
   - Identify key achievements or stories worth sharing
   - Review upcoming events or promotions
   - Consider current trends relevant to business

2. **Generate Post Content**
   - Create engaging post text (50-500 characters optimal for Facebook)
   - Include relevant hashtags (1-3 tags - Facebook uses fewer than LinkedIn)
   - Add call-to-action when appropriate
   - Consider adding emoji for visual appeal
   - Determine if image/video would enhance the post

3. **Create Approval Request**
   - Generate post file in `/AI_Employee_Vault/Pending_Approval/`
   - Include post text, hashtags, and any media URLs
   - Add notes about posting rationale and timing
   - Flag for human review before posting

4. **Post After Approval**
   - Wait for file to move to `/Approved/`
   - Use Facebook MCP server to post
   - Log successful post in Dashboard
   - Move to `/Done/` with post URL and ID

5. **Track Engagement** (Gold Tier)
   - Monitor post performance via Facebook Insights
   - Track reach, engagement, clicks, and shares
   - Learn from high-performing posts
   - Adjust future content strategy

## Post Template

```markdown
---
type: facebook_post
created_at: [YYYY-MM-DD HH:MM:SS]
status: pending_approval
scheduled_for: [YYYY-MM-DD HH:MM:SS]
category: [update|achievement|promotion|engagement|share]
post_format: [text|photo|link|video]
---

# Facebook Post Draft

## Post Content

[Your post content here - optimized for Facebook]

[Include emoji where appropriate 👍]

[Add call-to-action if appropriate]

## Hashtags
#Hashtag1 #Hashtag2 #Hashtag3

## Media (Optional)
- Image URL: [if applicable]
- Link URL: [if applicable]
- Link preview image: [if applicable]

## Target Audience
[Brief description of who this post is for]

## Expected Outcome
[What you hope to achieve - engagement, clicks, awareness, leads]

## Notes
[Why this post now? Best time to post? Any concerns?]

---
To approve: Move this file to /Approved
To reject: Delete or move to /Rejected
```

## Post Content Types

### 1. Business Update Posts
- Company news and announcements
- Team updates
- Office culture highlights
- Process improvements

**Example:**
```
🎉 Exciting news! We just launched our new AI-powered email automation system.

Now responding to customer inquiries 24/7 with human-in-the-loop approval. The future is here!

Want to learn how we built it? Drop a comment below! 👇

#AIAutomation #BusinessInnovation #TechStartup
```

### 2. Achievement/Milestone Posts
- Completed project showcase
- Client success stories
- Business milestones
- Awards or recognition

**Example:**
```
🏆 MILESTONE ALERT!

Just helped our client save 15 hours per week by automating their entire email workflow.

The challenge: Overwhelming inbox, slow response times
The solution: Custom AI automation with approval workflow
The result: 15 hours/week saved + happier customers

This is why we do what we do! 💪

#ClientSuccess #Automation #ProductivityWins
```

### 3. Content Share Posts
- Blog post promotions
- Article shares with commentary
- Video content
- Podcast episodes

**Example:**
```
📖 New blog post is live!

"5 Ways AI Can Transform Your Small Business"

We break down practical AI applications that any business can implement today - no technical degree required.

Link in comments! 👇

#SmallBusiness #AITips #DigitalTransformation
```

### 4. Engagement/Question Posts
- Polls and questions
- Advice requests
- Conversation starters
- Community building

**Example:**
```
❓ Quick question for business owners:

What's your BIGGEST productivity challenge?

A) Email overload
B) Meeting fatigue  
C) Task management
D) Work-life balance

Drop your answer below! We're researching our next automation project. 👇

#BusinessChat #Productivity #SmallBusinessOwner
```

### 5. Behind-the-Scenes Posts
- Work process sharing
- Team photos
- Office life
- Building in public

**Example:**
```
☕ Monday morning vibes at our office!

Working on something exciting - can't share details yet, but it involves:
→ AI agents
→ Real-time collaboration
→ Making business automation accessible to everyone

Stay tuned! 🚀

#MondayMotivation #BuildInPublic #StartupLife
```

### 6. Photo/Visual Posts
- Event photos
- Product screenshots
- Infographics
- Team pictures

**Example:**
```
📸 Behind the scenes of our latest project deployment!

Our team working late to ensure everything goes smoothly. Dedication level: 💯

[Photo attached]

#TeamWork #LateNightGrind #ProjectDeployment
```

## Posting Strategy

### Frequency
- **Silver Tier**: 3-5 posts per week
- **Gold Tier**: 1-2 posts per day
- Avoid more than 2 posts per day (audience fatigue)

### Best Times for Facebook
- **Weekdays**: 1-3 PM (highest engagement)
- **Morning**: 9-10 AM (good for news/updates)
- **Evening**: 7-8 PM (good for engagement posts)
- **Weekends**: 12-1 PM Saturday/Sunday (B2C focused)

### Hashtag Strategy
- 1-3 hashtags per post (Facebook uses fewer than LinkedIn/Instagram)
- Keep them relevant and specific
- Mix of branded and industry tags
- Avoid hashtag stuffing

### Content Mix (Monthly)
- 30% Business Updates/Achievements
- 25% Engagement/Questions
- 20% Content Shares (blogs, articles)
- 15% Behind-the-Scenes
- 10% Promotional/Sales

### Visual Content
- Posts with images get 2.3x more engagement
- Use high-quality, original images when possible
- Consider Facebook's image dimensions (1200x630px for link shares)
- Videos perform exceptionally well (native upload preferred)

## Approval Workflow

1. **Draft Creation**: AI creates post based on activities
2. **Pending Review**: Post saved to `/Pending_Approval/`
3. **Human Review**: You review, edit if needed, approve
4. **Posting**: AI posts to Facebook via MCP/API
5. **Logging**: Activity logged, file moved to `/Done/`
6. **Analytics**: Track performance (optional)

## Facebook MCP Server Integration

```javascript
// Sample MCP call structure
{
  "name": "facebook_create_post",
  "arguments": {
    "message": "Your post content here...",
    "link": "https://example.com",  // optional
    "picture": "https://example.com/image.jpg"  // optional
  }
}
```

### Photo Post
```javascript
{
  "name": "facebook_create_photo_post",
  "arguments": {
    "caption": "Your caption here...",
    "image_url": "https://example.com/image.jpg"
  }
}
```

## Quality Checklist
- [ ] Post length appropriate (50-500 characters)
- [ ] Engaging opening (emoji, question, statement)
- [ ] Clear value or story
- [ ] Call-to-action when appropriate
- [ ] 1-3 relevant hashtags
- [ ] No spelling or grammar errors
- [ ] Aligns with brand voice
- [ ] Image/link included if relevant
- [ ] Mobile-friendly formatting
- [ ] Authentic and conversational tone

## Safety Guidelines

**Never:**
- Share confidential client information
- Post controversial political/religious content (unless brand-aligned)
- Share proprietary business information
- Tag people without permission
- Use copyrighted images without license
- Make false or exaggerated claims
- Post sensitive business metrics

**Always:**
- Verify facts and statistics
- Get client permission before mentioning
- Use original or properly licensed images
- Maintain professional standards
- Consider Facebook's community standards
- Think about long-term brand impact
- Respond to comments when appropriate

## Error Handling
- If Facebook API fails, log error and retry (max 3 attempts)
- If post rejected, save to `/Rejected/` with reason
- If approval times out (>48 hours), flag for review
- Track failed posts for troubleshooting
- Handle token expiry gracefully

## Success Metrics
- Post created and approved within 24 hours
- Successful posting to Facebook
- No errors or rejections
- Engagement tracked (reactions, comments, shares)
- Reach and impressions monitored

## Integration Points
- Reads from: `/AI_Employee_Vault/Business_Goals.md`, `/Tasks/Done/`, `/Dashboard.md`
- Writes to: `/AI_Employee_Vault/Pending_Approval/`, `/Done/`
- Posts via: Facebook MCP Server (`mcp/facebook-mcp`)
- Updates: `/AI_Employee_Vault/Dashboard.md`
- Logs: `/AI_Employee_Vault/Logs/facebook_*.json`

## Configuration

### Environment Variables Required
```bash
FACEBOOK_ACCESS_TOKEN=your_page_access_token
FACEBOOK_PAGE_ID=your_facebook_page_id
```

### How to Get Facebook Credentials

1. **Create Facebook App**
   - Go to https://developers.facebook.com/
   - Create a new app (Business type)

2. **Add Facebook Login Product**
   - In app dashboard, add "Facebook Login"
   - Configure settings

3. **Generate Access Token**
   - Use Graph API Explorer or OAuth flow
   - Required permissions:
     - `pages_manage_posts`
     - `pages_read_engagement`
     - `pages_show_list`
   - Exchange for long-lived token (60 days)

4. **Get Page ID**
   - Go to your Facebook Page
   - Click "About"
   - Find Page ID (or use Graph API)

### MCP Server Configuration
```json
{
  "servers": [
    {
      "name": "facebook",
      "command": "node",
      "args": ["./mcp/facebook-mcp/index.js"],
      "env": {
        "FACEBOOK_ACCESS_TOKEN": "${FACEBOOK_ACCESS_TOKEN}",
        "FACEBOOK_PAGE_ID": "${FACEBOOK_PAGE_ID}",
        "VAULT_PATH": "./AI_Employee_Vault"
      }
    }
  ]
}
```

## Facebook vs LinkedIn Strategy

| Aspect | Facebook | LinkedIn |
|--------|----------|----------|
| **Tone** | Conversational, casual | Professional, formal |
| **Length** | 50-500 characters | 150-300 words |
| **Hashtags** | 1-3 | 3-5 |
| **Emoji** | Encouraged 👍 | Use sparingly |
| **Best Time** | 1-3 PM weekdays | 9 AM weekdays |
| **Content** | Mixed media, personal | Professional insights |
| **Engagement** | Reactions, comments | Likes, comments, shares |

## Examples of Effective Posts

### Example 1: Quick Update
```
🚀 Just shipped a major update!

Our AI employee system now handles:
✅ Email automation
✅ Social media posting  
✅ Accounting integration
✅ CEO briefings

All with human-in-the-loop approval. Safety first! 🛡️

#AI #Automation #Productivity
```

### Example 2: Engagement Question
```
💡 Question for entrepreneurs:

What made you start your business?

A) Freedom/flexibility
B) Solve a problem
C) Financial goals
D) Passion project

Comment below! Love hearing your stories. 👇

#Entrepreneurship #SmallBusiness #StartupStory
```

### Example 3: Achievement with Photo
```
🎓 Certification complete!

Just completed the Panaversity AI Agent Factory hackathon. Learned:
→ MCP protocol
→ Autonomous agents
→ Human-AI collaboration
→ Production deployment

Ready to build the future! 🚀

[Team photo attached]

#ContinuousLearning #AIEducation #Hackathon
```

### Example 4: Content Share
```
📊 New research: AI automation saves small businesses 20+ hours/week

Our latest analysis of 100+ implementations shows:
- Email: 8 hours/week saved
- Social media: 5 hours/week saved
- Accounting: 7 hours/week saved

Full report linked in comments! 📈

#SmallBusiness #AIResearch #Automation
```

## Notes for Improvement
- Implement A/B testing for post formats
- Add automatic image generation capability
- Track optimal posting times per page
- Build library of high-performing templates
- Implement comment response automation
- Add sentiment analysis for engagement
- Integrate Facebook Ads management (advanced)

## Troubleshooting

### Common Issues

**Token Expired**
- Facebook tokens expire after 60 days
- Generate new long-lived token
- Consider implementing token refresh

**Page Not Found**
- Verify PAGE_ID is correct
- Ensure token has page permissions
- Check page is published (not draft)

**Post Failed**
- Check content doesn't violate community standards
- Verify image URLs are accessible
- Check rate limits (max 50 posts/hour)

**Low Engagement**
- Post at optimal times
- Use more visual content
- Ask questions to drive comments
- Respond to existing comments

---

*Facebook Poster Skill - AI Employee Gold Tier*
*Last Updated: February 2026*
