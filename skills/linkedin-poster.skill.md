# LinkedIn Poster Skill

## Description
Automatically creates and posts engaging content on LinkedIn to generate business leads and sales. Analyzes business activities, completed projects, and goals to craft relevant posts that showcase expertise and attract potential clients.

## When to Use
- Daily scheduled posting (e.g., 9 AM on weekdays)
- After completing significant projects or milestones
- When manually triggered for immediate posting
- As part of content marketing automation

## Input Requirements
- Access to `/AI_Employee_Vault/Business_Goals.md` for business context
- Access to `/AI_Employee_Vault/Tasks/Done/` for completed work
- Access to `/AI_Employee_Vault/Dashboard.md` for recent activities
- LinkedIn API credentials or MCP server configuration

## Process Steps

1. **Gather Content Ideas**
   - Review recent completed projects in `/Tasks/Done/`
   - Check business goals and target audience
   - Identify key achievements or insights worth sharing
   - Review industry trends or topics relevant to business

2. **Generate Post Content**
   - Create engaging post text (150-300 words optimal)
   - Include relevant hashtags (3-5 tags)
   - Add call-to-action when appropriate
   - Ensure professional yet approachable tone
   - Incorporate storytelling or value-add insights

3. **Create Approval Request**
   - Generate post file in `/AI_Employee_Vault/Pending_Approval/`
   - Include post text, hashtags, and scheduling info
   - Add notes about posting rationale
   - Flag for human review before posting

4. **Post After Approval**
   - Wait for file to move to `/Approved/`
   - Use LinkedIn MCP server or API to post
   - Log successful post in Dashboard
   - Move to `/Done/` with post URL

5. **Track Engagement**
   - Monitor post performance (optional for Gold tier)
   - Log engagement metrics
   - Learn from high-performing posts

## Post Template

```markdown
---
type: linkedin_post
created_at: [YYYY-MM-DD HH:MM:SS]
status: pending_approval
scheduled_for: [YYYY-MM-DD HH:MM:SS]
category: [expertise|achievement|insight|promotion]
---

# LinkedIn Post Draft

## Post Content

[Your post content here - 150-300 words]

[Include storytelling, insights, or value]

[Add call-to-action if appropriate]

## Hashtags
#Hashtag1 #Hashtag2 #Hashtag3 #Hashtag4 #Hashtag5

## Target Audience
[Brief description of who this post is for]

## Expected Outcome
[What you hope to achieve with this post - leads, engagement, brand awareness]

## Notes
[Why this post now? Any concerns? Alternative approaches?]

---
To approve: Move this file to /Approved
To reject: Delete or move to /Rejected
```

## Post Content Types

### 1. Achievement/Milestone Posts
- Completed project showcase
- Client success story
- Business milestone reached
- Awards or recognition

**Example:**
```
Just wrapped up an exciting project helping [Client Type] achieve [Result]!

The challenge: [Brief problem]
The solution: [Brief solution]
The impact: [Quantifiable result]

Grateful for the opportunity to [value statement].

#ProjectManagement #BusinessGrowth #ClientSuccess
```

### 2. Expertise/Insight Posts
- Industry observations
- Best practices sharing
- Lessons learned
- Tips and advice

**Example:**
```
3 lessons learned from automating business processes:

1. [Insight 1] - [Brief explanation]
2. [Insight 2] - [Brief explanation]
3. [Insight 3] - [Brief explanation]

What's been your biggest automation win?

#Automation #Productivity #BusinessEfficiency
```

### 3. Behind-the-Scenes Posts
- Work process sharing
- Tool recommendations
- Day-in-the-life content
- Problem-solving stories

**Example:**
```
How I'm using AI to manage my inbox 📧

Built a custom system that:
→ Monitors emails 24/7
→ Drafts responses automatically
→ Notifies me for approval
→ Sends when ready

Saving 10+ hours per week. The future is here.

Want to learn how? Drop a comment below.

#AITools #ProductivityHack #Automation
```

### 4. Engagement/Question Posts
- Industry polls or questions
- Advice requests
- Conversation starters
- Controversial (but professional) takes

**Example:**
```
Controversial opinion: [Your take]

Here's why I believe this: [Brief reasoning]

What's your experience been? Agree or disagree?

#IndustryDebate #YourIndustry #Discussion
```

## Posting Strategy

### Frequency
- **Silver Tier**: 2-3 posts per week
- **Gold Tier**: 1 post per day
- Avoid posting more than once per day

### Best Times
- Weekdays: 7-9 AM, 12-1 PM, 5-6 PM
- Avoid weekends unless B2C focused
- Test and adjust based on engagement

### Hashtag Strategy
- 3-5 hashtags per post (LinkedIn recommendation)
- Mix of popular (10K+ posts) and niche (1K-10K posts)
- Include industry-specific and skill-specific tags
- One branded hashtag if applicable

### Content Mix (Monthly)
- 40% Expertise/Insights
- 30% Achievements/Case Studies
- 20% Engagement/Questions
- 10% Behind-the-Scenes

## Approval Workflow

1. **Draft Creation**: AI creates post based on recent activities
2. **Pending Review**: Post saved to `/Pending_Approval/`
3. **Human Review**: You review, edit if needed, approve
4. **Posting**: AI posts to LinkedIn via MCP/API
5. **Logging**: Activity logged, file moved to `/Done/`

## LinkedIn MCP Server Integration

```javascript
// Sample MCP call structure
{
  "action": "create_post",
  "content": "[post text]",
  "visibility": "PUBLIC",
  "hashtags": ["tag1", "tag2", "tag3"]
}
```

## Quality Checklist
- [ ] Post length appropriate (150-300 words)
- [ ] Professional yet approachable tone
- [ ] Clear value proposition or insight
- [ ] Relevant hashtags included (3-5)
- [ ] Call-to-action when appropriate
- [ ] No spelling or grammar errors
- [ ] Aligns with business goals
- [ ] Target audience clearly identified
- [ ] No overly promotional content
- [ ] Authentic voice maintained

## Safety Guidelines

**Never:**
- Share confidential client information
- Make false or exaggerated claims
- Post controversial political/religious content
- Share proprietary business information
- Tag people without permission
- Use copyrighted images without license

**Always:**
- Verify facts and statistics
- Get client permission before mentioning
- Use original or licensed images
- Maintain professional standards
- Align with brand voice
- Consider potential audience reactions

## Error Handling
- If LinkedIn API fails, log error and retry
- If post rejected, save to `/Rejected/` with reason
- If approval times out (>48 hours), flag for review
- Track failed posts for troubleshooting

## Success Metrics
- Post created and approved within 24 hours
- Successful posting to LinkedIn
- No errors or rejections
- Engagement tracked (Gold tier)
- Leads generated tracked (Gold tier)

## Integration Points
- Reads from: `/AI_Employee_Vault/Business_Goals.md`, `/Tasks/Done/`
- Writes to: `/AI_Employee_Vault/Pending_Approval/`
- Posts via: LinkedIn MCP Server
- Updates: `/AI_Employee_Vault/Dashboard.md`

## Configuration

### Environment Variables Required
```
LINKEDIN_ACCESS_TOKEN=your_token
LINKEDIN_USER_ID=your_user_id
LINKEDIN_ORGANIZATION_ID=your_org_id (if posting as company)
```

### MCP Server Configuration
```json
{
  "servers": [
    {
      "name": "linkedin",
      "command": "node",
      "args": ["./mcp/linkedin-mcp/index.js"],
      "env": {
        "LINKEDIN_ACCESS_TOKEN": "${LINKEDIN_ACCESS_TOKEN}"
      }
    }
  ]
}
```

## Examples of Effective Posts

### Example 1: Project Completion
```
Just shipped a major automation project! 🚀

Helped a client save 15 hours/week by automating their email workflow with AI.

The result? More time for strategic work, faster response times, and happier customers.

Automation isn't about replacing humans—it's about empowering them.

What's one task you wish you could automate?

#BusinessAutomation #AITools #ProductivityWins
```

### Example 2: Insight Sharing
```
The best productivity tool isn't a tool at all—it's a system.

Here's what works:
→ Capture everything (inbox zero daily)
→ Process with clear rules
→ Automate the repetitive
→ Review weekly

I've tested dozens of tools. The ones that work all follow this pattern.

Tools change. Systems endure.

#ProductivitySystem #WorkSmarter #SystemsThinking
```

### Example 3: Behind-the-Scenes
```
Building an AI employee from scratch (Week 1 update):

✅ Gmail integration working
✅ Automated email drafts
✅ WhatsApp notifications setup
⏳ LinkedIn posting (in progress)

The goal? A 24/7 digital assistant handling routine tasks while I focus on growth.

Following the Panaversity hackathon guide. Will share lessons learned.

#BuildInPublic #AIAutomation #TechProject
```

## Notes for Improvement
- Implement A/B testing for post types
- Add image generation capability (Silver/Gold tier)
- Track hashtag performance over time
- Build library of high-performing templates
- Add competitor/industry content monitoring
- Implement engagement response automation (Gold tier)
