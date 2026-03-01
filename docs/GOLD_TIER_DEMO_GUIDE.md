# Gold Tier Features - Demo Guide

This guide walks through demonstrating each Gold Tier feature. All demos can run in `DRY_RUN=true` mode for safe testing.

---

## Table of Contents

1. [Odoo MCP Server](#1-odoo-mcp-server)
2. [Twitter MCP Server](#2-twitter-mcp-server)
3. [Ralph Wiggum Loop](#3-ralph-wiggum-loop)
4. [CEO Briefing Generator](#4-ceo-briefing-generator)
5. [Error Recovery System](#5-error-recovery-system)
6. [Audit Logging](#6-audit-logging)
7. [Full System Demo](#7-full-system-demo)

---

## Prerequisites

```bash
# Set environment to dry-run mode
set DRY_RUN=true

# Ensure vault exists
mkdir AI_Employee_Vault\Needs_Action
mkdir AI_Employee_Vault\Tasks\Pending
mkdir AI_Employee_Vault\Briefings
mkdir AI_Employee_Vault\Logs
```

---

## 1. Odoo MCP Server

### What It Does
Connects to Odoo ERP for accounting operations: invoices, payments, expenses, and financial reports.

### Demo: Test MCP Server Directly

```bash
# Navigate to MCP server
cd mcp/odoo-mcp

# Install dependencies (first time)
npm install

# Run in test mode
set DRY_RUN=true
node index.js
```

### Demo: Test via JSON-RPC

Create a test file `test_odoo.js`:

```javascript
// test_odoo.js
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Test: List available tools
console.log(JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/list',
  params: {}
}));

// Test: Get balance sheet
setTimeout(() => {
  console.log(JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'odoo_get_balance_sheet',
      arguments: { date: '2026-01-18' }
    }
  }));
}, 100);

// Test: Get revenue report
setTimeout(() => {
  console.log(JSON.stringify({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'odoo_get_revenue_report',
      arguments: {
        start_date: '2026-01-01',
        end_date: '2026-01-18'
      }
    }
  }));
}, 200);
```

Run:
```bash
node test_odoo.js | node index.js
```

### Expected Output (Simulated)

```json
{
  "success": true,
  "simulated": true,
  "date": "2026-01-18",
  "assets": {
    "current_assets": 45000,
    "cash": 25000,
    "accounts_receivable": 15000
  },
  "liabilities": {
    "current_liabilities": 12000
  },
  "equity": {
    "retained_earnings": 53000
  }
}
```

### Demo: Available Tools

| Tool | Purpose | Example Arguments |
|------|---------|-------------------|
| `odoo_get_balance_sheet` | Financial position | `{"date": "2026-01-18"}` |
| `odoo_get_profit_loss` | Income statement | `{"start_date": "2026-01-01", "end_date": "2026-01-31"}` |
| `odoo_get_bank_transactions` | Bank activity | `{"limit": 50}` |
| `odoo_get_aging_report` | A/R aging | `{}` |
| `odoo_get_cash_flow` | Cash flow | `{"start_date": "2026-01-01", "end_date": "2026-01-31"}` |
| `odoo_create_invoice` | Create invoice | `{"partner_name": "Client A", "lines": [{"description": "Service", "price_unit": 500}]}` |
| `odoo_get_unpaid_invoices` | Outstanding invoices | `{"limit": 50}` |
| `odoo_record_payment` | Record payment | `{"invoice_id": 123, "amount": 500}` |

---

## 2. Twitter MCP Server

### What It Does
Manages Twitter/X presence: posting, engagement metrics, mentions, and weekly summaries.

### Demo: Test MCP Server

```bash
cd mcp/twitter-mcp
npm install
set DRY_RUN=true
node index.js
```

### Demo: Test Tools

```javascript
// test_twitter.js

// Test: Post a tweet (simulated)
console.log(JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: {
    name: 'twitter_post_tweet',
    arguments: {
      text: 'Testing AI Employee Twitter integration! #automation'
    }
  }
}));

// Test: Get engagement metrics
setTimeout(() => {
  console.log(JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'twitter_get_engagement',
      arguments: { count: 10 }
    }
  }));
}, 100);

// Test: Get weekly summary
setTimeout(() => {
  console.log(JSON.stringify({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'twitter_get_weekly_summary',
      arguments: { days: 7 }
    }
  }));
}, 200);
```

### Expected Output (Simulated)

```json
{
  "success": true,
  "simulated": true,
  "tweet_id": "SIM_1737216000000",
  "text": "Testing AI Employee Twitter integration! #automation",
  "character_count": 52
}
```

### Demo: Available Tools

| Tool | Purpose | Example Arguments |
|------|---------|-------------------|
| `twitter_post_tweet` | Post tweet | `{"text": "Hello world!"}` |
| `twitter_get_engagement` | Get metrics | `{"count": 10}` |
| `twitter_get_mentions` | Get mentions | `{"count": 20}` |
| `twitter_reply_to_tweet` | Reply | `{"tweet_id": "123", "text": "Thanks!"}` |
| `twitter_get_user_info` | User profile | `{"username": "target_user"}` |
| `twitter_search_tweets` | Search | `{"query": "#AI", "count": 10}` |
| `twitter_get_weekly_summary` | Weekly report | `{"days": 7}` |

---

## 3. Ralph Wiggum Loop

### What It Does
Autonomous task execution with task decomposition, approval gates, and error recovery.

### Demo: Run the Loop

```bash
cd C:\Users\E\Desktop\AI_Employee
python ralph_wiggum_loop.py --vault ./AI_Employee_Vault --dry-run --interval 10
```

### Demo: Create a Test Task

Create `AI_Employee_Vault/Needs_Action/TEST_EMAIL_001.md`:

```markdown
---
type: email_reply
subject: Client inquiry about pricing
from: client@example.com
priority: normal
created: 2026-01-18T10:00:00
requires_steps: true
---

# Email Response Required

## Original Email
From: client@example.com
Subject: Pricing inquiry

Hi,

I'd like to know your pricing for consulting services.

Best regards,
Client
```

### Expected Behavior

1. Ralph detects the task in Needs_Action
2. Decomposes into steps:
   - Step 1: Analyze email content (auto)
   - Step 2: Draft reply (auto)
   - Step 3: Send email (requires approval)
3. Creates approval request in `Needs_Action/APPROVE_TASK_xxx_STEP_02.md`
4. Waits for approval
5. On approval, executes send step
6. Archives to `Tasks/Done/`

### Demo: Check Task Status

```bash
# View active tasks
dir AI_Employee_Vault\Tasks\In_Progress\

# View approval requests
dir AI_Employee_Vault\Needs_Action\APPROVE_*

# View completed tasks
dir AI_Employee_Vault\Tasks\Done\
```

### Demo: Approve a Step

Edit the approval file and change:
```yaml
status: pending
```
to:
```yaml
status: approved
```

Ralph will detect the approval and continue execution.

### Demo: Task Types

| Task Type | Steps | Approvals Required |
|-----------|-------|-------------------|
| `email_reply` | Analyze → Draft → Send | Send |
| `social_post` | Gather → Draft → Post | Post |
| `invoice` | Validate → Create → Notify | Create (if >$100) |
| `briefing` | Collect → Analyze → Generate → Review → Distribute | None |
| `expense` | Validate → Create → Log | Create (if >$100) |

---

## 4. CEO Briefing Generator

### What It Does
Generates comprehensive weekly briefings with financial data (Odoo), social metrics (Twitter), and task analytics.

### Demo: Generate a Briefing

```bash
cd C:\Users\E\Desktop\AI_Employee
python ceo_briefing_generator.py --vault ./AI_Employee_Vault --days 7
```

### Expected Output

File created: `AI_Employee_Vault/Briefings/2026-01-18_Monday_Briefing.md`

```markdown
# Monday Morning CEO Briefing
## Week of January 11 - January 18, 2026

### Executive Summary
- ✅ Revenue: $2,750.00 (on_track)
- ✅ All invoices current
- 🎯 Completed 10 tasks this week
- 💡 3 optimization opportunity(ies) identified

### Financial Performance

| Metric | This Week | MTD | Target |
|--------|-----------|-----|--------|
| Revenue | $2,750.00 | $2,750.00 | $10,000.00 |
| Expenses | $425.00 | $425.00 | $500.00 |
| Net Profit | $2,325.00 | $2,325.00 | - |

### Social Media Performance (Twitter)

| Metric | Value |
|--------|-------|
| Tweets Posted | 4 |
| Total Likes | 85 |
| Total Retweets | 23 |
| Followers | 1,285 |

### Accounts Receivable Aging

| Bucket | Amount |
|--------|--------|
| Current (0-30 days) | $1,200.00 |
| 31-60 days | $800.00 |
| **Total Outstanding** | **$2,000.00** |
...
```

### Demo: View Generated Briefings

```bash
dir AI_Employee_Vault\Briefings\
type AI_Employee_Vault\Briefings\2026-01-18_Monday_Briefing.md
```

---

## 5. Error Recovery System

### What It Does
Handles errors with retry logic, circuit breakers, and human intervention requests.

### Demo: Test Retry Decorator

```python
# test_error_recovery.py
from error_recovery import with_retry, TransientError, ErrorRecoveryManager

@with_retry(max_attempts=3, base_delay=0.5)
def flaky_api_call():
    import random
    if random.random() > 0.3:
        raise TransientError("API temporarily unavailable")
    return "Success!"

# Test
for i in range(5):
    try:
        result = flaky_api_call()
        print(f"Attempt {i+1}: {result}")
    except TransientError as e:
        print(f"Attempt {i+1}: Failed after retries - {e}")
```

Run:
```bash
python test_error_recovery.py
```

### Demo: Test Circuit Breaker

```python
# test_circuit_breaker.py
from error_recovery import ErrorRecoveryManager, ErrorCategory

manager = ErrorRecoveryManager('./AI_Employee_Vault')

# Simulate 5 errors to trip circuit breaker
for i in range(6):
    error_info = manager.handle_error(
        Exception(f"Error {i+1}"),
        context="test_component",
        category=ErrorCategory.TRANSIENT
    )
    print(f"Error {i+1}: Circuit breaker tripped = {error_info.get('circuit_breaker_tripped', False)}")

# Check if circuit is open
print(f"\nCircuit open: {manager.is_circuit_open('transient:test_component')}")
```

### Demo: Test Ralph Error Handler

```python
# test_ralph_error.py
from error_recovery import ErrorRecoveryManager

manager = ErrorRecoveryManager('./AI_Employee_Vault')

# Simulate a Ralph task error
error_info = manager.handle_ralph_error(
    error=Exception("Step execution failed"),
    task_id="TASK_20260118_abc123",
    step_id="TASK_20260118_abc123_STEP_02",
    task_context={'title': 'Send email to client', 'step': 'send_email'}
)

print(f"Intervention requested: {error_info.get('intervention_requested', False)}")
```

Check generated file:
```bash
dir AI_Employee_Vault\Needs_Action\RALPH_INTERVENTION_*
```

---

## 6. Audit Logging

### What It Does
Comprehensive logging of all system actions with timestamps, actors, and results.

### Demo: Log Various Actions

```python
# test_audit_logger.py
from audit_logger import AuditLogger, ActionType, ApprovalStatus

logger = AuditLogger('./AI_Employee_Vault')

# Log an Odoo invoice creation
logger.log_odoo_invoice(
    invoice_id="INV/2026/0042",
    partner="Client A",
    amount=1500.00,
    approval_status=ApprovalStatus.APPROVED,
    approved_by="human"
)

# Log a Twitter post
logger.log_twitter_post(
    tweet_id="1234567890",
    content_preview="Exciting news about our AI features!",
    approval_status=ApprovalStatus.APPROVED,
    approved_by="human"
)

# Log a Ralph task start
logger.log_ralph_task_start(
    task_id="TASK_20260118_def456",
    title="Process client email",
    step_count=3
)

# Log CEO briefing generation
logger.log_ceo_briefing(
    briefing_id="2026-01-18",
    period="2026-01-11 to 2026-01-18",
    sections=["financial", "social", "tasks"]
)

print("Check logs at: AI_Employee_Vault/Logs/")
```

### Demo: View Audit Logs

```bash
type AI_Employee_Vault\Logs\2026-01-18_audit.json
```

### Expected Log Entry

```json
{
  "timestamp": "2026-01-18T14:30:00.000000",
  "action_type": "odoo_invoice_create",
  "actor": "claude_code",
  "target": "invoice:INV/2026/0042",
  "parameters": {"partner": "Client A", "amount": 1500.0},
  "approval_status": "approved",
  "approved_by": "human",
  "result": "success",
  "session_id": "abc123"
}
```

---

## 7. Full System Demo

### Start Everything

```bash
# Terminal 1: Start the orchestrator
cd C:\Users\E\Desktop\AI_Employee
set DRY_RUN=true
python dynamic_orchestrator.py
```

### Create Demo Tasks

```bash
# Create an email task
echo ---
echo type: email_reply
echo subject: Demo email
echo from: demo@example.com
echo priority: normal
echo requires_steps: true
echo ---
echo Please respond to this demo inquiry.
) > AI_Employee_Vault\Needs_Action\DEMO_EMAIL_001.md

# Create an invoice task
echo ---
echo type: invoice
echo partner: Demo Client
echo amount: 500
echo description: Consulting services
echo ---
echo Create invoice for Demo Client.
) > AI_Employee_Vault\Needs_Action\DEMO_INVOICE_001.md
```

### Monitor Activity

```bash
# Watch dashboard updates
type AI_Employee_Vault\Dashboard.md

# Watch logs
type AI_Employee_Vault\Logs\2026-01-18_audit.json

# Check for approval requests
dir AI_Employee_Vault\Needs_Action\APPROVE_*
```

### Generate CEO Briefing

```bash
python ceo_briefing_generator.py --vault ./AI_Employee_Vault --days 7
type AI_Employee_Vault\Briefings\2026-01-18_Monday_Briefing.md
```

### Clean Up Demo

```bash
# Stop orchestrator (Ctrl+C in terminal)

# Remove demo files
del AI_Employee_Vault\Needs_Action\DEMO_*
del AI_Employee_Vault\Tasks\In_Progress\*
del AI_Employee_Vault\Tasks\Pending\*
```

---

## Troubleshooting

### MCP Server Won't Start

```bash
# Check Node.js version (need 18+)
node --version

# Reinstall dependencies
cd mcp/odoo-mcp && npm install
cd mcp/twitter-mcp && npm install
```

### Ralph Loop Not Detecting Tasks

```bash
# Ensure task has correct frontmatter
# Must include: type, requires_steps: true

# Check folder permissions
dir AI_Employee_Vault\Needs_Action
```

### Logs Not Being Created

```bash
# Create logs folder
mkdir AI_Employee_Vault\Logs

# Check write permissions
echo test > AI_Employee_Vault\Logs\test.txt
del AI_Employee_Vault\Logs\test.txt
```

### Circuit Breaker Tripped

```bash
# Wait 5 minutes for auto-reset
# Or manually reset in code:
python -c "from error_recovery import ErrorRecoveryManager; m = ErrorRecoveryManager('./AI_Employee_Vault'); m.reset_circuit('component_name')"
```

---

## Quick Reference Commands

```bash
# Start system (dry run)
set DRY_RUN=true && python dynamic_orchestrator.py

# Generate briefing
python ceo_briefing_generator.py --vault ./AI_Employee_Vault

# Run Ralph loop standalone
python ralph_wiggum_loop.py --vault ./AI_Employee_Vault --dry-run

# Test Odoo MCP
cd mcp/odoo-mcp && node index.js

# Test Twitter MCP
cd mcp/twitter-mcp && node index.js

# View logs
type AI_Employee_Vault\Logs\%date:~-4%-%date:~4,2%-%date:~7,2%_audit.json
```

---

*Gold Tier Demo Guide - AI Employee System*
*Last Updated: January 2026*
