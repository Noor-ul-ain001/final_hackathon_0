# AI Employee System - Bronze & Silver Tier Implementation

## 🎯 Project Overview

This is a complete implementation of the **Bronze** and **Silver** tiers from the Personal AI Employee Hackathon (Panaversity 2026). The system creates an autonomous AI agent that manages personal and business tasks using Claude Code, Obsidian, and various automation tools.

## ✅ Completed Features

### Bronze Tier ✓
- [x] Obsidian vault with Dashboard.md and Company_Handbook.md
- [x] File system watcher for monitoring drop folder
- [x] Claude Code reading from and writing to vault
- [x] Basic folder structure (/Inbox, /Needs_Action, /Done, etc.)
- [x] All AI functionality implemented as Agent Skills

### Silver Tier ✓
- [x] Multiple watcher scripts (Gmail + WhatsApp + LinkedIn + FileSystem)
- [x] LinkedIn integration for automated posting
- [x] Claude reasoning loop with Plan.md creation capability
- [x] MCP server for external actions (Email + LinkedIn)
- [x] Human-in-the-loop approval workflow
- [x] Business Goals management system
- [x] All AI functionality implemented as Agent Skills

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [System Architecture](#system-architecture)
4. [Quick Start](#quick-start)
5. [Configuration](#configuration)
6. [Agent Skills](#agent-skills)
7. [Watcher Scripts](#watcher-scripts)
8. [MCP Servers](#mcp-servers)
9. [Workflow](#workflow)
10. [Scheduling](#scheduling)
11. [Troubleshooting](#troubleshooting)
12. [Next Steps](#next-steps)

## Prerequisites

### Required Software
- **Python 3.13+** - [Download](https://www.python.org/downloads/)
- **Node.js 24+ LTS** - [Download](https://nodejs.org/)
- **Claude Code** (Pro subscription or use Free Gemini API with Claude Code Router)
- **Obsidian** v1.10.6+ - [Download](https://obsidian.md)
- **Git** (recommended) - [Download](https://git-scm.com/)

### Required Skills
- Basic command-line usage
- Understanding of file systems
- Familiarity with environment variables
- Ability to use Claude Code

### Estimated Setup Time
- Bronze Tier: 2-3 hours
- Silver Tier: 4-6 hours (including Bronze)

## Installation

### Step 1: Clone or Download

```bash
# If using Git
cd C:\Users\E\Desktop
git clone [your-repo] AI_Employee

# Or download and extract to this location
```

### Step 2: Install Python Dependencies

```bash
cd AI_Employee
pip install -r requirements.txt
```

### Step 3: Install Node.js Dependencies (for MCP servers)

```bash
# Install LinkedIn MCP server
cd mcp/linkedin-mcp
npm install
cd ../..
```

### Step 4: Set Up Environment Variables

Create a `.env` file in the project root:

```bash
# Gmail API Credentials (if using Gmail watcher)
GMAIL_CLIENT_ID=your_client_id
GMAIL_CLIENT_SECRET=your_client_secret

# Twilio (for WhatsApp notifications)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
TWILIO_WHATSAPP_TO=whatsapp:+your_number

# LinkedIn API (optional - can use dry-run mode)
LINKEDIN_ACCESS_TOKEN=your_token
LINKEDIN_USER_ID=your_user_id

# System Configuration
DRY_RUN=true  # Set to false when ready for real actions
VAULT_PATH=./AI_Employee_Vault
```

**Security Note**: Never commit the `.env` file to version control!

### Step 5: Configure Claude Code MCP

Update your Claude Code `mcp.json` (usually in `~/.config/claude-code/` or `.claude/`):

```json
{
  "servers": [
    {
      "name": "linkedin",
      "command": "node",
      "args": ["C:/Users/E/Desktop/AI_Employee/mcp/linkedin-mcp/index.js"],
      "env": {
        "LINKEDIN_ACCESS_TOKEN": "${LINKEDIN_ACCESS_TOKEN}",
        "LINKEDIN_USER_ID": "${LINKEDIN_USER_ID}",
        "DRY_RUN": "true"
      }
    }
  ]
}
```

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    PERSONAL AI EMPLOYEE                         │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Watchers   │────▶│    Vault     │◀────│ Claude Code  │
│  (Sensors)   │     │  (Obsidian)  │     │   (Brain)    │
└──────────────┘     └──────────────┘     └──────────────┘
       │                     │                     │
       ├─ Gmail             ├─ Needs_Action       │
       ├─ WhatsApp          ├─ Pending_Approval   │
       ├─ LinkedIn          ├─ Approved           │
       └─ FileSystem        └─ Done               │
                                                   │
                            ┌──────────────┐      │
                            │ MCP Servers  │◀─────┘
                            │   (Hands)    │
                            └──────────────┘
                                   │
                                   ├─ Gmail
                                   └─ LinkedIn
```

### Data Flow

1. **Perception**: Watchers detect events (new email, scheduled post time, file drop)
2. **Processing**: Watcher creates action file in `/Needs_Action`
3. **Reasoning**: Claude Code processes action files using Agent Skills
4. **Approval**: Claude creates draft in `/Pending_Approval`
5. **Human Review**: You review and move to `/Approved`
6. **Action**: System executes via MCP servers
7. **Logging**: Result logged and file moved to `/Done`

## Quick Start

### Bronze Tier Quick Start (Basic System)

```bash
# 1. Start the file system watcher
python filesystem_watcher.py --vault ./AI_Employee_Vault --mode events

# 2. Drop a file into the Inbox folder
# The watcher will create an action file

# 3. Use Claude Code to process the action
claude --cwd ./AI_Employee_Vault

# In Claude, say:
# "Read and process files in /Needs_Action"
```

### Silver Tier Quick Start (Full System)

```bash
# 1. Start all watchers
python start_watchers.py

# This starts:
# - Gmail watcher (checks every 2 minutes)
# - LinkedIn watcher (checks hourly for scheduled posts)
# - File system watcher (real-time monitoring)
# - WhatsApp notification handler

# 2. Claude processes automatically or on-demand
# The system is now running autonomously!
```

## Configuration

### Vault Folder Structure

```
AI_Employee_Vault/
├── Dashboard.md              # Real-time system status
├── Company_Handbook.md        # Rules and guidelines
├── Business_Goals.md          # Business objectives and metrics
├── Inbox/                     # File drop folder
├── Needs_Action/              # Pending items for Claude
├── Pending_Approval/          # Drafts awaiting human review
├── Approved/                  # Approved actions ready to execute
├── Rejected/                  # Rejected drafts
├── Done/                      # Completed actions
├── Plans/                     # Claude's execution plans
├── Tasks/                     # Task management
│   └── Done/                  # Completed tasks
├── Logs/                      # System logs
├── Accounting/                # Financial tracking
├── Briefings/                 # CEO briefings
└── Dropped_Files/             # Files from file watcher
```

### Customizing Company_Handbook.md

Edit `AI_Employee_Vault/Company_Handbook.md` to customize:
- Email response tone and style
- Approval thresholds
- Response templates
- Special handling rules
- Your business-specific guidelines

### Customizing Business_Goals.md

Edit `AI_Employee_Vault/Business_Goals.md` to set:
- Revenue targets
- KPIs and metrics
- Service offerings
- Target audience
- LinkedIn posting strategy
- Subscription management rules

## Agent Skills

All AI functionality is implemented as Agent Skills. These skills guide Claude in specific tasks:

### Available Skills

| Skill | Location | Purpose |
|-------|----------|---------|
| email-processor | `skills/email-processor.skill.md` | Process and draft email responses |
| linkedin-poster | `skills/linkedin-poster.skill.md` | Create LinkedIn posts |
| dashboard-updater | `skills/dashboard-updater.skill.md` | Update system dashboard |
| approval-handler | `skills/approval-handler.skill.md` | Manage approval workflow |

### Using Skills

When working with Claude Code:

```
"Use the email-processor skill to draft a response to the email in /Needs_Action"

"Use the linkedin-poster skill to create a post about our recent project completion"

"Use the dashboard-updater skill to log this activity"
```

Claude will automatically follow the guidelines in the skill files.

## Watcher Scripts

### Gmail Watcher

**File**: `gmail_watcher.py`

**Purpose**: Monitors Gmail inbox for new unread emails and creates action files.

**Usage**:
```bash
python gmail_watcher.py --vault ./AI_Employee_Vault --interval 120
```

**Configuration**:
- Requires Gmail API credentials
- Filters: Unread emails (can customize with query parameter)
- Check interval: 120 seconds (2 minutes) default

### LinkedIn Watcher

**File**: `linkedin_watcher.py`

**Purpose**: Schedules LinkedIn post creation based on Business_Goals.md posting schedule.

**Usage**:
```bash
python linkedin_watcher.py --vault ./AI_Employee_Vault --interval 3600 --posts-per-week 3
```

**Features**:
- Follows posting schedule (Mon/Wed/Fri default)
- Gathers context from completed tasks
- Creates different post types (insight, behind-scenes, engagement)
- Triggers Claude to draft posts

### File System Watcher

**File**: `filesystem_watcher.py`

**Purpose**: Monitors Inbox folder for dropped files and creates action files.

**Usage**:
```bash
python filesystem_watcher.py --vault ./AI_Employee_Vault --drop-folder ./AI_Employee_Vault/Inbox --mode events
```

**Features**:
- Real-time monitoring (events mode) or polling mode
- Automatically copies files to vault
- Creates metadata files with file info
- Suggests processing based on file type

### Base Watcher Class

**File**: `base_watcher.py`

All watchers inherit from `BaseWatcher` class which provides:
- Standardized logging
- Dashboard integration
- Error handling and recovery
- Graceful shutdown
- Status reporting

## MCP Servers

### LinkedIn MCP Server

**Location**: `mcp/linkedin-mcp/`

**Purpose**: Enables Claude Code to post content to LinkedIn.

**Features**:
- Create LinkedIn posts
- Dry-run mode for testing
- Post logging to files

**Setup**:
```bash
cd mcp/linkedin-mcp
npm install
npm start
```

**Modes**:
1. **Dry-run mode** (default): Posts logged to files
2. **Simulation mode**: Posts logged, no API needed
3. **Production mode**: Actual LinkedIn API posting (requires credentials)

### Email MCP Server

Uses existing `email_sender.py` script integrated with Gmail API.

## Workflow

### Email Processing Workflow

```
New Email Arrives
    ↓
Gmail Watcher detects (every 2 min)
    ↓
Creates file in /Needs_Action
    ↓
Claude reads with email-processor skill
    ↓
Claude drafts response
    ↓
Saves to /Pending_Approval
    ↓
WhatsApp notification sent
    ↓
Human reviews and moves to /Approved
    ↓
Email sent via email_sender.py
    ↓
Logged and moved to /Done
```

### LinkedIn Posting Workflow

```
Scheduled time (e.g., Monday 9 AM)
    ↓
LinkedIn Watcher checks schedule
    ↓
Creates post request in /Needs_Action
    ↓
Claude reads with linkedin-poster skill
    ↓
Claude drafts LinkedIn post
    ↓
Saves to /Pending_Approval
    ↓
Human reviews, edits if needed
    ↓
Moves to /Approved
    ↓
Posted via LinkedIn MCP
    ↓
Logged and moved to /Done
```

### File Drop Workflow

```
User drops file in /Inbox
    ↓
FileSystem Watcher detects (real-time)
    ↓
Copies file to /Dropped_Files
    ↓
Creates metadata in /Needs_Action
    ↓
Claude analyzes file
    ↓
Processes based on file type
    ↓
Completes and moves to /Done
```

## Scheduling

### Windows Task Scheduler Setup

For always-on operation, schedule watchers to run at startup:

#### Using XML Configuration (Recommended)

1. Create task definition file `watcher_task.xml`:

```xml
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>AI Employee Watcher Services</Description>
  </RegistrationInfo>
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
    </LogonTrigger>
  </Triggers>
  <Principals>
    <Principal>
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>true</RunOnlyIfNetworkAvailable>
  </Settings>
  <Actions>
    <Exec>
      <Command>C:\Users\E\Desktop\AI_Employee\start_watchers.py</Command>
      <WorkingDirectory>C:\Users\E\Desktop\AI_Employee</WorkingDirectory>
    </Exec>
  </Actions>
</Task>
```

2. Import the task:

```powershell
schtasks /create /tn "AI_Employee_Watchers" /xml watcher_task.xml
```

#### Manual Setup via GUI

1. Open Task Scheduler
2. Create Basic Task
3. Name: "AI Employee Watchers"
4. Trigger: "When I log on"
5. Action: "Start a program"
6. Program: `python`
7. Arguments: `C:\Users\E\Desktop\AI_Employee\start_watchers.py`
8. Working directory: `C:\Users\E\Desktop\AI_Employee`

### Linux/Mac (cron)

Add to crontab:

```bash
@reboot cd /path/to/AI_Employee && python3 start_watchers.py >> logs/watchers.log 2>&1
```

## Troubleshooting

### Common Issues

#### Watchers Not Starting

**Symptom**: Watchers exit immediately or don't run

**Solutions**:
1. Check Python version: `python --version` (should be 3.13+)
2. Verify dependencies: `pip install -r requirements.txt`
3. Check .env file exists and has correct values
4. Run with debug: `python gmail_watcher.py --log-level DEBUG`

#### Gmail API Errors

**Symptom**: "Credentials not found" or "Authentication failed"

**Solutions**:
1. Ensure `credentials.json` exists in project root
2. Run Gmail setup: `python test_gmail.py`
3. Re-authorize if token expired
4. Check Google Cloud Console for API enablement

#### LinkedIn Posts Not Working

**Symptom**: Posts logged to files instead of posted

**Expected behavior** in default configuration!

To actually post:
1. Get LinkedIn API credentials
2. Set `LINKEDIN_ACCESS_TOKEN` and `LINKEDIN_USER_ID` in `.env`
3. Set `DRY_RUN=false`
4. Restart MCP server

#### Claude Not Processing Files

**Symptom**: Files stay in /Needs_Action

**Solutions**:
1. Manually trigger Claude: `claude --cwd ./AI_Employee_Vault`
2. Tell Claude: "Read and process files in /Needs_Action using appropriate skills"
3. Check Dashboard.md for errors
4. Verify skills exist in `skills/` folder

#### WhatsApp Notifications Not Sending

**Symptom**: No WhatsApp messages received

**Solutions**:
1. Check Twilio credentials in `.env`
2. Verify WhatsApp sandbox is joined (expires after 72 hours)
3. Check Twilio console for errors
4. Test with: `python whatsapp_notifier.py`

### Logs and Debugging

Check logs in these locations:
- **System logs**: `logs/` folder
- **Dashboard**: `AI_Employee_Vault/Dashboard.md` (recent activity)
- **Orchestrator log**: `orchestrator.log`
- **Watcher outputs**: Console output or redirect to file

Enable debug logging:
```bash
python gmail_watcher.py --log-level DEBUG
```

## Next Steps

### Enhance Bronze/Silver Tier

- [ ] Customize Company_Handbook.md with your business rules
- [ ] Fill in Business_Goals.md with your actual goals
- [ ] Add more email response templates
- [ ] Create custom LinkedIn post templates
- [ ] Set up email filtering rules (priority keywords)

### Prepare for Gold Tier

- [ ] Set up local Odoo Community Edition
- [ ] Create Odoo MCP server for accounting
- [ ] Implement weekly CEO briefing automation
- [ ] Add Facebook and Instagram integration
- [ ] Add Twitter (X) integration
- [ ] Implement Ralph Wiggum loop for autonomous task completion

### Prepare for Platinum Tier

- [ ] Deploy to cloud VM (Oracle Cloud Free Tier)
- [ ] Set up vault syncing (Git or Syncthing)
- [ ] Implement claim-by-move rule for work distribution
- [ ] Separate Cloud vs Local responsibilities
- [ ] Add health monitoring and alerts
- [ ] Implement A2A (Agent-to-Agent) communication

## Support & Resources

### Documentation
- **Project README**: `README.md`
- **Setup Guide**: `SETUP.md`
- **Hackathon Guide**: `hackathon.md`
- **HOW TO USE**: `HOW_TO_USE.md`

### Community
- **Research Meetings**: Wednesdays 10 PM (see hackathon.md for Zoom link)
- **YouTube**: @panaversity
- **Issues**: GitHub issues page

### Learning Resources
- [Claude Code Guide](https://agentfactory.panaversity.org/docs/AI-Tool-Landscape/claude-code-features-and-workflows)
- [Claude Agent Skills](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
- [MCP Documentation](https://modelcontextprotocol.io)
- [Obsidian Help](https://help.obsidian.md)

## License

This project is part of the Panaversity AI Employee Hackathon 2026.

---

## Achievement Status

### ✅ Bronze Tier Complete
- Vault structure implemented
- Watcher scripts created
- Claude Code integration working
- Agent Skills implemented

### ✅ Silver Tier Complete
- Multiple watchers (Gmail, LinkedIn, FileSystem)
- LinkedIn integration (with dry-run mode)
- MCP server for LinkedIn
- Approval workflow implemented
- Business Goals system created
- All functionality as Agent Skills

### 🎯 Ready for Gold Tier
You now have a solid foundation to build the Gold tier features!

---

**Last Updated**: 2026-01-15
**Status**: Bronze & Silver Tiers Complete ✅
**Next Milestone**: Gold Tier Implementation

Happy Automating! 🤖
