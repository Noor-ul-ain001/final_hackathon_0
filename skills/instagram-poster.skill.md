# Instagram Poster Skill

## Description
Automatically creates and publishes engaging image posts on Instagram Business accounts to grow followers, increase brand visibility, and showcase business achievements. Uses the Instagram Graph API (via the Facebook MCP server) to post content, track performance, and build a consistent visual identity.

## When to Use
- Daily posts (11am–1pm or 7–9pm weekdays for peak engagement)
- After completing projects or reaching business milestones
- Sharing visually compelling behind-the-scenes content
- Promoting blog posts or achievements with an image hook
- Showcasing team culture, office life, or product screenshots
- Reels teasers (static cover image + caption driving to reel)

## Input Requirements
- `INSTAGRAM_ACCESS_TOKEN` — Instagram Graph API token (same app as Facebook)
- `INSTAGRAM_ACCOUNT_ID` — Instagram Business Account ID
- A publicly accessible image URL (Instagram API requires `image_url` — text-only posts are NOT supported)
- Access to `/AI_Employee_Vault/Business_Goals.md` for business context
- Access to `/AI_Employee_Vault/Tasks/Done/` for recent completed work
- Facebook MCP server configured with Instagram env vars

## Process Steps

1. **Gather Content Ideas**
   - Review recent completed projects in `/Tasks/Done/`
   - Check business goals and brand identity
   - Identify visually interesting stories (achievements, behind-the-scenes, tips)
   - Review upcoming events, launches, or promotions
   - Identify a suitable image or suggest one to the human

2. **Generate Post Content**
   - Write caption (125–150 characters before "more" fold — lead with the hook)
   - Select 5–15 relevant hashtags (Instagram supports more than Facebook/LinkedIn)
   - Mix branded hashtags + niche industry hashtags + broad reach hashtags
   - Add call-to-action (link in bio, comment below, save this post)
   - Confirm image URL is publicly accessible

3. **Create Approval Request**
   - Save draft to `/AI_Employee_Vault/Pending_Approval/`
   - Include image URL, caption, hashtags, and posting rationale
   - Flag for human review

4. **Post After Approval**
   - Wait for file to move to `/Approved/`
   - Call `instagram_create_post` via Facebook MCP server
   - Log successful post in Dashboard
   - Move to `/Done/` with post ID and URL

5. **Track Engagement**
   - Use `instagram_get_weekly_summary` to monitor impressions, reach, and profile views
   - Track likes and comments on recent media
   - Adjust hashtag and timing strategy based on results

## Post Template

```markdown
---
type: instagram_post
created_at: [YYYY-MM-DD HH:MM:SS]
status: pending_approval
scheduled_for: [YYYY-MM-DD HH:MM:SS]
category: [achievement|behind_the_scenes|quote|promotion|carousel_teaser]
image_url: [publicly accessible URL]
---

# Instagram Post Draft

## Caption

[Hook line — first 125 characters are shown before "more"]

[Body — 2-3 lines expanding on the hook]

[Call-to-action — "Link in bio" / "Save this" / "Tag someone who needs this"]

## Hashtags
#Hashtag1 #Hashtag2 #Hashtag3 #Hashtag4 #Hashtag5
#Hashtag6 #Hashtag7 #Hashtag8 #Hashtag9 #Hashtag10

## Image
- URL: [image URL]
- Description: [what the image shows]
- Dimensions: [ideally 1080x1080 square or 1080x1350 portrait]

## Target Audience
[Who is this for? Entrepreneurs, developers, small business owners?]

## Expected Outcome
[Awareness / Followers / Engagement / Website traffic]

## Notes
[Why this post now? Best time? Any concerns?]

---
To approve: Move this file to /Approved
To reject: Delete or move to /Rejected
```

## Post Content Types

### 1. Achievement Posts
Share milestones, project completions, and client wins.

**Example:**
```
🏆 Just launched our AI Employee system.

It handles emails, social media, invoices AND writes its own CEO briefings — all with human approval.

We built this in 72 hours. Here's what we learned 👇

#AIAutomation #Hackathon #BuildInPublic #StartupLife #ProductLaunch #AIAgent #TechStartup #IndieHacker #Entrepreneur #Innovation
```

### 2. Behind-the-Scenes Posts
Show the human side of the business — process, tools, workspace.

**Example:**
```
☕ Saturday morning. Just me, coffee, and 12 MCP servers running.

Building an AI that handles its own inbox. No managers. No standups. Just pure automation.

Save this if you're building something similar 🔖

#BuildInPublic #SoloFounder #AITools #StartupLife #IndieHacker #RemoteWork #TechFounder #SideProject #NoCode #AIBuilder
```

### 3. Quote / Insight Posts
Short, punchy quotes over a clean background image.

**Example:**
```
"The best employee never sleeps, never complains, and always follows the process."

— Building AI agents that actually work 🤖

Double tap if you agree 👇

#AIQuote #Automation #BusinessMindset #Entrepreneurship #FutureOfWork #AIStartup #ProductivityHack #WorkSmarter #TechQuote #DigitalTransformation
```

### 4. Carousel Teaser Posts
Static cover of a carousel to drive swipe engagement.

**Example:**
```
5 things I automated this week that saved me 20 hours →

Swipe to see the full breakdown 👉

(Spoiler: #3 will surprise you)

#Productivity #Automation #AITools #WorkSmarter #BusinessHacks #Entrepreneur #TimeManagement #TechTips #AIAutomation #BuildInPublic
```

### 5. Promotion / Launch Posts
Announce products, services, or new features.

**Example:**
```
🚀 NEW: AI Employee is now open source.

Fork it. Run it. Make it yours.

Link in bio to get started — takes 10 minutes to set up.

#OpenSource #AI #GitHub #AIAgent #BuildInPublic #DevCommunity #Python #NodeJS #Automation #TechStartup
```

## Posting Strategy

### Frequency
- **Gold Tier**: 1 post per day (maximum 2)
- Never skip more than 2 days in a row (algorithm penalises inconsistency)
- Stories can supplement feed posts without algorithm impact

### Best Times for Instagram
- **11am–1pm weekdays** — lunchtime scroll (highest overall engagement)
- **7–9pm weekdays** — evening browse session
- **Saturday 10am–12pm** — weekend leisure scrolling
- Avoid early morning (< 8am) and late night (> 10pm)

### Hashtag Strategy
- Use **5–15 hashtags** per post (Instagram supports up to 30, but 10–12 is optimal)
- Mix three tiers:
  - **Broad** (1M+ posts): #AI #Startup #Entrepreneur
  - **Mid** (100K–1M): #AIAutomation #BuildInPublic #TechFounder
  - **Niche** (< 100K): #AIEmployee #MCPServer #AgentAI
- Rotate hashtag sets to avoid shadowban patterns
- Include 1–2 branded hashtags (#YourBrand)

### Content Mix (Monthly)
- 30% Achievement / Milestone
- 25% Behind-the-Scenes
- 20% Quote / Insight
- 15% Carousel Teaser / Educational
- 10% Promotion / Launch

### Image Guidelines
- **Square**: 1080×1080px (safe default)
- **Portrait**: 1080×1350px (takes more feed space — better reach)
- **Landscape**: 1080×566px (use rarely)
- High contrast, bold text overlays perform well for quote posts
- Bright, well-lit photos for behind-the-scenes
- Consistent colour palette builds brand recognition

## MCP Call Examples

### Create a Post
```javascript
{
  "name": "instagram_create_post",
  "arguments": {
    "image_url": "https://example.com/images/achievement-post.jpg",
    "caption": "🏆 Just shipped something huge.\n\nDetails in the comments 👇\n\n#BuildInPublic #AIAutomation #StartupLife #Entrepreneur #TechStartup #IndieHacker #Innovation #AIAgent #OpenSource #ProductLaunch"
  }
}
```

### Get Account Info
```javascript
{
  "name": "instagram_get_account_info",
  "arguments": {}
}
```

### Get Weekly Performance
```javascript
{
  "name": "instagram_get_weekly_summary",
  "arguments": {}
}
```

## Quality Checklist
- [ ] Image URL is publicly accessible (not localhost, not Google Drive)
- [ ] Caption hook is within first 125 characters
- [ ] Caption body adds value (not just hashtags)
- [ ] 5–15 hashtags included (not more than 30)
- [ ] Call-to-action present
- [ ] No spelling or grammar errors
- [ ] Image dimensions correct (1080×1080 or 1080×1350)
- [ ] Aligns with brand voice and visual identity
- [ ] Not a duplicate of recent posts (check Done folder)
- [ ] Approved by human before posting

## Safety Guidelines

**Never:**
- Post confidential client data or private business metrics
- Use images without license or permission
- Tag people without consent
- Make claims that cannot be verified
- Copy competitor content
- Use banned or shadowbanned hashtags
- Post more than 2 times in one day (triggers spam filters)

**Always:**
- Verify image URL loads correctly before posting
- Use original or properly licensed images
- Maintain consistent visual brand identity
- Monitor comments and flag inappropriate replies
- Respect Instagram's Community Guidelines
- Store credentials in `.env` — never hardcode in files

## Error Handling

| Error | Cause | Fix |
|-------|-------|-----|
| `INSTAGRAM_ACCESS_TOKEN not configured` | Missing env var | Set token in `.env` |
| `INSTAGRAM_ACCOUNT_ID not configured` | Missing env var | Set account ID in `.env` |
| `image_url` rejected | Image not publicly accessible | Host image publicly (S3, CDN, etc.) |
| Container creation fails | Bad image format | Use JPEG/PNG, min 320px wide |
| Publish fails after container | Rate limit or permissions | Wait 1 hour, retry |
| Token expired | Tokens expire after 60 days | Refresh via Facebook Developer Portal |

## Required Environment Variables

Add to your `.env` file:
```bash
# Instagram Business API
INSTAGRAM_ACCESS_TOKEN=your_instagram_graph_api_token
INSTAGRAM_ACCOUNT_ID=your_instagram_business_account_id
```

Add to `mcp.json` facebook server block:
```json
"INSTAGRAM_ACCESS_TOKEN": "your_instagram_access_token",
"INSTAGRAM_ACCOUNT_ID": "your_instagram_account_id"
```

### How to Get Instagram Credentials

1. **Convert Instagram to Business Account**
   - Instagram Settings → Account → Switch to Professional Account → Business

2. **Connect to Facebook Page**
   - Instagram Settings → Account → Linked Accounts → Facebook
   - Connect to your Facebook Business Page

3. **Create Facebook App**
   - Go to https://developers.facebook.com/
   - Create app (Business type) if not already created for Facebook posting

4. **Get Instagram Business Account ID**
   - Use Graph API Explorer: `GET /{facebook-page-id}?fields=instagram_business_account`
   - Or: `GET /me/accounts` then look up connected IG account

5. **Required Permissions**
   - `instagram_basic`
   - `instagram_content_publish`
   - `instagram_manage_insights`
   - `pages_show_list`
   - `pages_read_engagement`

6. **Generate Long-Lived Token**
   - Use Graph API Explorer to generate token
   - Exchange for 60-day long-lived token via:
     `GET /oauth/access_token?grant_type=fb_exchange_token&...`

## Platform Comparison

| Aspect | Instagram | Facebook | LinkedIn | Twitter/X |
|--------|-----------|----------|----------|-----------|
| **Tone** | Visual, authentic | Conversational | Professional | Punchy, real-time |
| **Image required** | YES (API) | No | No | No |
| **Caption length** | 2,200 chars max | 63,206 chars | 3,000 chars | 280 chars |
| **Hashtags** | 5–15 | 1–3 | 3–5 | 1–2 |
| **Best time** | 11am–1pm | 1–3pm | 9am | 9–11am |
| **Algorithm** | Engagement rate | Reactions + shares | Dwell time | Recency |
| **Content type** | Square/portrait images | Mixed | Articles, text | Short text |
| **Audience** | B2C, younger | Mixed | B2B | Real-time/news |

## Integration Points
- Reads from: `/AI_Employee_Vault/Business_Goals.md`, `/Tasks/Done/`, `/Dashboard.md`
- Writes to: `/AI_Employee_Vault/Pending_Approval/`, `/Done/`
- Posts via: Facebook MCP Server (`mcp/facebook-mcp`) — same server handles Instagram
- Updates: `/AI_Employee_Vault/Dashboard.md`
- Logs: `/AI_Employee_Vault/Logs/instagram_*.json`
- Done files: `/AI_Employee_Vault/Done/INSTAGRAM_POST_*.md`

---

*Instagram Poster Skill — AI Employee Gold Tier*
*Last Updated: February 2026*
