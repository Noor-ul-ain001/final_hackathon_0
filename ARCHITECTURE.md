# AI Employee System Architecture

## Overview

AI Employee is an autonomous business assistant that monitors various inputs (email, social media, accounting), processes them intelligently, and takes action through approval workflows. The system is designed with human-in-the-loop controls for sensitive operations.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         AI Employee System                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │  Gmail   │  │  Odoo    │  │ Twitter  │  │ LinkedIn │  │Filesystem│ │
│  │ Watcher  │  │ Watcher  │  │ Watcher  │  │ Watcher  │  │ Watcher  │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘ │
│       │             │             │             │             │        │
│       └─────────────┴──────┬──────┴─────────────┴─────────────┘        │
│                            │                                            │
│                            ▼                                            │
│               ┌───────────────────────┐                                 │
│               │   Needs_Action Folder │                                 │
│               │   (Obsidian Vault)    │                                 │
│               └───────────┬───────────┘                                 │
│                           │                                             │
│                           ▼                                             │
│               ┌───────────────────────┐                                 │
│               │  Ralph Wiggum Loop    │                                 │
│               │  (Autonomous Tasks)   │                                 │
│               └───────────┬───────────┘                                 │
│                           │                                             │
│         ┌─────────────────┼─────────────────┐                          │
│         │                 │                 │                          │
│         ▼                 ▼                 ▼                          │
│  ┌────────────┐  ┌────────────┐   ┌────────────┐                       │
│  │   Email    │  │   Odoo     │   │  Twitter   │                       │
│  │ MCP Server │  │ MCP Server │   │ MCP Server │                       │
│  └──────┬─────┘  └──────┬─────┘   └──────┬─────┘                       │
│         │               │                │                             │
│         ▼               ▼                ▼                             │
│     Gmail API      Odoo JSON-RPC    Twitter API v2                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Dynamic Orchestrator (`dynamic_orchestrator.py`)

The main entry point that manages all system components:

- **Watcher Management:** Starts and monitors all watcher threads
- **Health Checks:** Auto-restarts failed components
- **Status Tracking:** Maintains system state in `.orchestrator_status.json`
- **Graceful Shutdown:** Handles SIGINT/SIGTERM for clean exit

### 2. Watchers (Input Layer)

Watchers monitor external sources and create action files in the vault.

| Watcher | Source | Check Interval | Output |
|---------|--------|----------------|--------|
| `gmail_watcher` | Gmail API | 60s | Email action files |
| `odoo_watcher` | Odoo JSON-RPC | 3600s | Transaction files |
| `social_media_watcher` | Twitter API | 1800s | Social action files |
| `linkedin_watcher` | LinkedIn | 3600s | Connection files |
| `filesystem_watcher` | Drop folder | 10s | File action files |

### 3. Ralph Wiggum Loop (`ralph_wiggum_loop.py`)

Autonomous task execution engine:

- **Task Decomposition:** Breaks complex tasks into steps
- **Approval Gates:** Requires human approval for sensitive actions
- **Error Recovery:** Retry logic with circuit breaker
- **Intervention Requests:** Creates help files when stuck

### 4. MCP Servers (Tool Layer)

Model Context Protocol servers expose tools to Claude Code:

| Server | Purpose | Key Tools |
|--------|---------|-----------|
| `email-mcp` | Gmail operations | `send_email`, `read_emails` |
| `odoo-mcp` | Accounting | `create_invoice`, `get_revenue_report` |
| `twitter-mcp` | Social media | `post_tweet`, `get_engagement` |

### 5. Obsidian Vault (Data Layer)

The vault serves as the persistent storage and coordination point:

```
AI_Employee_Vault/
├── Needs_Action/       # Pending action files
├── Pending_Approval/   # Items awaiting human approval
├── Approved/           # Approved items ready to execute
├── Done/               # Completed actions (archive)
├── Tasks/
│   ├── Pending/        # Queued tasks
│   ├── In_Progress/    # Active tasks
│   ├── Done/           # Completed tasks
│   └── Failed/         # Failed tasks
├── Briefings/          # CEO briefing reports
├── Logs/               # Audit logs and system logs
├── Quarantine/         # Problematic data
├── Dashboard.md        # System status overview
├── Business_Goals.md   # Business context
└── Company_Handbook.md # Response guidelines
```

## Data Flow

### Email Processing Flow

```
1. Gmail Watcher detects new email
2. Creates EMAIL_[id].md in Needs_Action/
3. Ralph Wiggum Loop picks up task
4. Decomposes: Analyze → Draft → Send
5. Draft created in Pending_Approval/
6. Human approves via WhatsApp/file
7. Email MCP sends response
8. Task archived to Done/
```

### Invoice Creation Flow

```
1. Manual trigger or scheduled
2. Ralph creates invoice task
3. Steps: Validate → Create → Notify
4. If amount > $100, request approval
5. Odoo MCP creates invoice
6. Dashboard updated
7. Audit log entry created
```

### CEO Briefing Flow

```
1. Sunday 8PM schedule trigger
2. Collect data: Odoo + Twitter + Vault
3. Analyze metrics and trends
4. Generate briefing markdown
5. Save to Briefings/ folder
6. Update Dashboard
7. Send notification
```

## Security Model

### Credential Management

- API credentials stored in `.env` file
- Environment variables loaded at runtime
- Never logged or exposed in vault files
- DRY_RUN mode for testing without credentials

### Approval Gates

Actions requiring human approval:
- Sending emails
- Posting to social media
- Creating invoices > $100
- Recording payments
- Any financial transaction

### Audit Trail

Every action logged with:
- Timestamp
- Action type
- Actor (claude_code/human)
- Parameters (sanitized)
- Result
- Approval status

### Circuit Breaker

Prevents cascade failures:
- Trips after 5 consecutive errors
- 5-minute cooldown before retry
- Alerts human when tripped
- Half-open state for testing

## Error Recovery Patterns

### Transient Errors (Network, Rate Limits)

```
Strategy: Exponential backoff retry
Attempts: 3
Delay: 1s → 2s → 4s (max 60s)
On failure: Queue for later
```

### Authentication Errors

```
Strategy: Alert human
Action: Create ALERT file in Needs_Action/
Recovery: Manual credential refresh
```

### Logic Errors

```
Strategy: Human review request
Action: Create REVIEW file
Recovery: Human provides guidance
```

### System Errors

```
Strategy: Circuit breaker + restart
Action: Trip breaker, alert human
Recovery: Auto-restart after cooldown
```

## Configuration

### Environment Variables (`.env`)

```bash
# Gmail
GMAIL_CREDENTIALS_PATH=./mcp/email-mcp/credentials.json
GMAIL_TOKEN_PATH=./mcp/email-mcp/token.json

# Odoo
ODOO_URL=http://localhost:8069
ODOO_DB=ai_employee
ODOO_USERNAME=admin
ODOO_PASSWORD=your_password

# Twitter
TWITTER_API_KEY=your_key
TWITTER_API_SECRET=your_secret
TWITTER_ACCESS_TOKEN=your_token
TWITTER_ACCESS_SECRET=your_secret

# System
DRY_RUN=true
VAULT_PATH=./AI_Employee_Vault
```

### MCP Configuration (`mcp.json`)

Defines which MCP servers to run and their configuration.

## Skills System

Skills are documented workflows that guide Claude Code:

| Skill | Purpose | Location |
|-------|---------|----------|
| `email-processor` | Process incoming emails | `skills/` |
| `odoo-accounting` | Accounting operations | `skills/` |
| `twitter-manager` | Social media management | `skills/` |
| `ralph-wiggum` | Autonomous task execution | `skills/` |
| `weekly-audit` | CEO briefing generation | `skills/` |
| `ceo-briefing` | Briefing templates | `skills/` |

## Deployment

### Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL 15+ (for Odoo)
- Docker (optional, for Odoo)

### Quick Start

```bash
# Install Python dependencies
pip install -r requirements.txt

# Install MCP server dependencies
cd mcp/email-mcp && npm install
cd mcp/odoo-mcp && npm install
cd mcp/twitter-mcp && npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Start the system
python dynamic_orchestrator.py
```

### Running with Docker

```bash
# Start Odoo
docker-compose up -d

# Start AI Employee
python dynamic_orchestrator.py
```

## Monitoring

### Dashboard (`Dashboard.md`)

Real-time system status:
- Active watchers
- Pending approvals
- Recent activity
- Error counts

### Logs (`Logs/`)

Daily log files:
- `YYYY-MM-DD_audit.json` - All actions
- `YYYY-MM-DD_errors.json` - Errors only
- `orchestrator_YYYY-MM-DD.json` - System events

### Status File (`.orchestrator_status.json`)

```json
{
  "running": true,
  "start_time": "2026-01-18T10:00:00",
  "watchers": {
    "gmail": {"running": true},
    "odoo": {"running": true}
  },
  "pending_approvals": 3
}
```

## Lessons Learned

### Design Decisions

1. **File-based coordination** - Using the Obsidian vault as the source of truth enables visibility and manual intervention

2. **Human-in-the-loop** - Requiring approval for sensitive actions prevents autonomous mistakes

3. **MCP architecture** - Separating tools into MCP servers enables modularity and testing

4. **Ralph Wiggum Loop** - Autonomous task execution with approval gates balances automation with safety

### Common Issues

1. **Credential expiry** - OAuth tokens need periodic refresh
2. **Rate limits** - APIs have usage limits, use caching
3. **Data consistency** - Vault files can be edited externally

### Future Improvements

1. Web dashboard for monitoring
2. Mobile app for approvals
3. ML-based email classification
4. Predictive analytics for briefings
5. Multi-tenant support

## Component Dependencies

```
dynamic_orchestrator.py
├── approval_processor.py
├── notification_hub.py
├── action_executor.py
├── gmail_watcher.py
├── odoo_watcher.py
├── social_media_watcher.py
├── linkedin_watcher.py
├── filesystem_watcher.py
└── ralph_wiggum_loop.py
    ├── base_watcher.py
    ├── error_recovery.py
    └── audit_logger.py

mcp/
├── email-mcp/index.js
├── odoo-mcp/index.js
└── twitter-mcp/index.js
```

## Testing

### Unit Tests

```bash
python -m pytest tests/
```

### Integration Tests

```bash
DRY_RUN=true python dynamic_orchestrator.py --minimal
```

### MCP Server Tests

```bash
DRY_RUN=true node mcp/odoo-mcp/index.js
```

## Support

- **Documentation:** `docs/` folder
- **Skills:** `skills/` folder
- **Issue Tracking:** GitHub Issues
- **Logs:** `AI_Employee_Vault/Logs/`

---

*AI Employee Gold Tier - Architecture Documentation*
*Last Updated: January 2026*
