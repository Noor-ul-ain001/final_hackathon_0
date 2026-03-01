# Personal AI Employee - Gold Tier Implementation

**Built with Claude Code for Hackathon 0: Building Autonomous FTEs in 2026**

> "Your life and business on autopilot. Local-first, agent-driven, human-in-the-loop."

This is a **Gold Tier** implementation of a Personal AI Employee that provides comprehensive business automation including email management, social media posting, accounting integration, and autonomous CEO briefings.

## Achievement: Gold Tier Complete

| Tier | Status | Features |
|------|--------|----------|
| Bronze | Complete | Gmail monitoring, Obsidian vault, basic workflows |
| Silver | Complete | Multi-watcher system, LinkedIn posting, approval workflows |
| **Gold** | **Complete** | Xero accounting, multi-platform social media, CEO briefings, error recovery |

## Key Features

### Core Automation
- **Email Management**: Gmail monitoring with intelligent categorization and response drafting
- **Social Media**: Automated posting to Twitter/X, Facebook, Instagram, and LinkedIn
- **Accounting**: Xero integration for financial tracking and audit
- **CEO Briefings**: Weekly automated business reports with actionable insights

### System Reliability
- **Error Recovery**: Exponential backoff retry, circuit breakers, graceful degradation
- **Audit Logging**: Comprehensive logging of all AI actions for compliance
- **Watchdog Manager**: Auto-restart of crashed processes

### Interactive UI
- **Web Dashboard**: Real-time browser-based monitoring at `http://localhost:5000`
- **Terminal UI**: Rich command-line interface for power users

## Quick Start

### 1. Install Dependencies

```bash
# Python dependencies
pip install -r requirements.txt

# Node.js dependencies for MCP servers
cd mcp/linkedin-mcp && npm install && cd ../..
cd mcp/social-mcp && npm install && cd ../..
```

### 2. Configure Environment

```bash
# Copy and edit environment file
cp .env.example .env

# Required variables:
# VAULT_PATH=./AI_Employee_Vault
# GMAIL_CREDENTIALS_PATH=./credentials.json
# XERO_CLIENT_ID=your_xero_client_id  (optional)
# TWITTER_API_KEY=your_twitter_key    (optional)
```

### 3. Start the System

```bash
# Option A: Start all watchers with watchdog
python watchdog_manager.py --vault ./AI_Employee_Vault

# Option B: Start individual watchers
python gmail_watcher.py --vault ./AI_Employee_Vault
python linkedin_watcher.py --vault ./AI_Employee_Vault
python social_media_watcher.py --vault ./AI_Employee_Vault
python xero_watcher.py --vault ./AI_Employee_Vault

# Option C: Use PM2 for production
pm2 start watchdog_manager.py --interpreter python
```

### 4. Launch Dashboard

```bash
# Web Dashboard (recommended)
python web_dashboard.py --port 5000
# Open http://localhost:5000

# Terminal UI
python terminal_ui.py --live
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    PERSONAL AI EMPLOYEE                         │
│                    GOLD TIER ARCHITECTURE                       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      EXTERNAL SOURCES                           │
├──────────┬──────────┬──────────┬──────────┬──────────┬─────────┤
│  Gmail   │ LinkedIn │ Twitter  │ Facebook │ Instagram│  Xero   │
└────┬─────┴────┬─────┴────┬─────┴────┬─────┴────┬─────┴────┬────┘
     │          │          │          │          │          │
     ▼          ▼          ▼          ▼          ▼          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    WATCHER LAYER (Python)                       │
│  gmail_watcher │ linkedin_watcher │ social_media_watcher        │
│                │ filesystem_watcher │ xero_watcher              │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    OBSIDIAN VAULT (Local)                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Needs_Action │ Pending_Approval │ Approved │ Done │ Logs   │ │
│  │ Dashboard.md │ Business_Goals.md │ Company_Handbook.md     │ │
│  │ Accounting/  │ Briefings/ │ Social_Media/                  │ │
│  └────────────────────────────────────────────────────────────┘ │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                 REASONING LAYER (Claude Code)                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                     AGENT SKILLS                           │ │
│  │  email-processor │ linkedin-poster │ social-media-poster   │ │
│  │  ceo-briefing │ dashboard-updater │ approval-handler       │ │
│  └────────────────────────────────────────────────────────────┘ │
└───────────────────────────┬─────────────────────────────────────┘
                            │
              ┌─────────────┴──────────────┐
              ▼                            ▼
┌───────────────────────────┐    ┌────────────────────────────────┐
│   HUMAN-IN-THE-LOOP       │    │         MCP SERVERS            │
│  ┌─────────────────────┐  │    │  ┌────────────────────────┐    │
│  │ Review & Approve    │──┼───▶│  │ email │ linkedin │      │   │
│  │ Web/Terminal UI     │  │    │  │ social │ xero           │   │
│  └─────────────────────┘  │    │  └────────────────────────┘    │
└───────────────────────────┘    └────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    RELIABILITY LAYER                            │
│  watchdog_manager │ error_recovery │ audit_logger │ graceful    │
└─────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
AI_Employee/
├── AI_Employee_Vault/           # Obsidian vault (knowledge base)
│   ├── Dashboard.md             # Real-time status
│   ├── Company_Handbook.md      # Rules and guidelines
│   ├── Business_Goals.md        # KPIs and targets
│   ├── Needs_Action/            # Watcher-generated tasks
│   ├── Pending_Approval/        # Awaiting human approval
│   ├── Approved/                # Ready to execute
│   ├── Done/                    # Completed tasks
│   ├── Logs/                    # Audit logs
│   ├── Accounting/              # Financial records
│   ├── Briefings/               # CEO briefings
│   └── Social_Media/            # Social media content
│
├── skills/                      # Agent Skills
│   ├── email-processor.skill.md
│   ├── linkedin-poster.skill.md
│   ├── social-media-poster.skill.md
│   ├── ceo-briefing.skill.md
│   ├── dashboard-updater.skill.md
│   └── approval-handler.skill.md
│
├── mcp/                         # MCP Servers
│   ├── linkedin-mcp/            # LinkedIn posting
│   └── social-mcp/              # Twitter/FB/Instagram
│
├── # Core Watchers
├── base_watcher.py              # Abstract base class
├── gmail_watcher.py             # Gmail monitoring
├── linkedin_watcher.py          # LinkedIn scheduler
├── filesystem_watcher.py        # File drop monitoring
├── social_media_watcher.py      # Multi-platform social (Gold)
├── xero_watcher.py              # Accounting integration (Gold)
│
├── # Gold Tier Features
├── ceo_briefing_generator.py    # Weekly CEO briefings
├── error_recovery.py            # Error handling & circuit breakers
├── audit_logger.py              # Comprehensive audit logging
├── watchdog_manager.py          # Process auto-restart
│
├── # Interactive UI
├── web_dashboard.py             # Browser-based dashboard
├── terminal_ui.py               # Rich terminal interface
│
├── # Supporting Files
├── email_sender.py              # Gmail sending
├── approval_notifier.py         # WhatsApp notifications
├── whatsapp_notifier.py         # WhatsApp integration
├── start_watchers.py            # Multi-watcher launcher
├── verify_setup.py              # Setup verification
│
├── # Configuration
├── mcp.json                     # MCP server configuration
├── requirements.txt             # Python dependencies
├── setup_scheduler.ps1          # Windows scheduler setup
├── .env                         # Environment variables
└── .gitignore                   # Git ignore rules
```

## Gold Tier Features in Detail

### 1. Xero Accounting Integration

```python
# Automated financial tracking
python xero_watcher.py --vault ./AI_Employee_Vault

# Features:
# - Transaction monitoring
# - Invoice tracking with overdue alerts
# - Subscription audit
# - Weekly financial summaries
```

### 2. Multi-Platform Social Media

```python
# Start unified social media watcher
python social_media_watcher.py --vault ./AI_Employee_Vault

# Supports:
# - Twitter/X posting
# - Facebook page posts
# - Instagram content
# - Scheduled posting
# - Engagement metrics
```

### 3. CEO Briefing System

```python
# Generate weekly CEO briefing
python ceo_briefing_generator.py --vault ./AI_Employee_Vault

# Includes:
# - Revenue analysis
# - Task completion metrics
# - Bottleneck identification
# - Cost optimization recommendations
# - Upcoming deadlines
```

### 4. Error Recovery System

```python
# Automatic error handling with:
# - Exponential backoff retry
# - Circuit breakers for cascading failure prevention
# - Graceful degradation
# - Human alert on critical failures

from error_recovery import with_retry, ErrorRecoveryManager

@with_retry(max_attempts=3, base_delay=1.0)
def risky_operation():
    # Your code here
    pass
```

### 5. Comprehensive Audit Logging

```python
from audit_logger import AuditLogger, ActionType

logger = AuditLogger('./AI_Employee_Vault')
logger.log_email_send(to='client@example.com', subject='Invoice', ...)
logger.log_social_post(platform='twitter', content_preview='...', ...)

# Generate audit report
report = logger.generate_audit_report()
```

### 6. Interactive Dashboards

```bash
# Web Dashboard
python web_dashboard.py --port 5000
# Features: Real-time stats, pending approvals, activity log

# Terminal UI
python terminal_ui.py --live
# Features: Rich terminal display, approve/reject commands
```

## Configuration

### Environment Variables

```bash
# Core
VAULT_PATH=./AI_Employee_Vault
DRY_RUN=false

# Gmail
GMAIL_CREDENTIALS_PATH=./credentials.json

# Xero (Gold Tier)
XERO_CLIENT_ID=your_client_id
XERO_CLIENT_SECRET=your_client_secret
XERO_TENANT_ID=your_tenant_id

# Twitter (Gold Tier)
TWITTER_API_KEY=your_api_key
TWITTER_API_SECRET=your_api_secret
TWITTER_ACCESS_TOKEN=your_access_token
TWITTER_ACCESS_SECRET=your_access_secret

# Facebook (Gold Tier)
FACEBOOK_ACCESS_TOKEN=your_access_token
FACEBOOK_PAGE_ID=your_page_id

# Instagram (Gold Tier)
INSTAGRAM_ACCESS_TOKEN=your_access_token
INSTAGRAM_ACCOUNT_ID=your_account_id
```

### MCP Server Configuration

See `mcp.json` for MCP server configuration. Servers include:
- `email`: Gmail sending
- `linkedin`: LinkedIn posting
- `social`: Twitter/Facebook/Instagram
- `xero`: Accounting (via Xero official MCP)

## Hackathon Submission Checklist

### Bronze Tier
- [x] Obsidian vault with Dashboard.md and Company_Handbook.md
- [x] Working Gmail watcher
- [x] Basic folder structure
- [x] Agent Skills implementation

### Silver Tier
- [x] Multiple watchers (Gmail + LinkedIn + WhatsApp + File System)
- [x] LinkedIn posting automation
- [x] Human-in-the-loop approval workflow
- [x] MCP servers for external actions

### Gold Tier
- [x] Xero accounting integration
- [x] Facebook/Instagram/Twitter integration
- [x] Weekly CEO Briefing generation
- [x] Error recovery and graceful degradation
- [x] Comprehensive audit logging
- [x] Documentation of architecture

## Resources

- **Hackathon Guide**: [hackathon.md](./hackathon.md)
- **Video Tutorials**: [YouTube @panaversity](https://www.youtube.com/@panaversity)
- **MCP Protocol**: [modelcontextprotocol.io](https://modelcontextprotocol.io/)
- **Agent Skills**: [platform.claude.com](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)

## Next.js Dashboard

A web-based dashboard has been created to complement the AI Employee system. You can find it in the `ai-employee-dashboard` directory. This dashboard provides a user-friendly interface to monitor and manage your AI Employee.

To run the dashboard:
1. Navigate to the `ai-employee-dashboard` directory
2. Install dependencies with `npm install`
3. Run the development server with `npm run dev`

## License

Educational project for Panaversity's AI Agent Factory Hackathon 0.

---

**Built with Claude Code | Gold Tier Complete | 2026**
