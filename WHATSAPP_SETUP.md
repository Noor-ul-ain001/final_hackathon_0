# WhatsApp Dynamic Approval Setup

This guide explains how to set up the WhatsApp-based approval system for your AI Employee.

## Overview

The dynamic approval system allows you to:
- Receive notifications about pending approvals on WhatsApp
- Approve or reject items directly by replying to WhatsApp messages
- Execute approved actions automatically (emails, social posts, etc.)

## Prerequisites

1. **Twilio Account** (Free tier available)
   - Sign up at: https://www.twilio.com/try-twilio
   - Get your Account SID and Auth Token from the dashboard

2. **WhatsApp Sandbox** (for development)
   - Go to: Twilio Console > Messaging > Try it out > Send a WhatsApp message
   - Follow the instructions to join the sandbox

## Configuration

### 1. Set Environment Variables

Create or update your `.env` file:

```bash
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886  # Twilio sandbox number
WHATSAPP_TO=whatsapp:+1234567890  # Your WhatsApp number

# Webhook Configuration
WEBHOOK_PORT=5000
VALIDATE_WEBHOOK=false  # Set to true in production

# Optional: Dry run mode for testing
DRY_RUN=false
```

### 2. Set Up Webhook (for receiving replies)

#### Option A: Using ngrok (Development)

1. Install ngrok: https://ngrok.com/download
2. Run: `ngrok http 5000`
3. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)
4. Configure in Twilio:
   - Go to: Twilio Console > Messaging > Settings > WhatsApp Sandbox Settings
   - Set "When a message comes in" to: `https://abc123.ngrok.io/webhook/whatsapp`

#### Option B: Cloud Deployment (Production)

Deploy the webhook server to a cloud provider and configure the HTTPS URL in Twilio.

### 3. Test the Setup

```bash
# Send a test notification
python start_dynamic.py --test-notification

# Start just the webhook server
python start_dynamic.py --webhook-only

# Start the full system
python start_dynamic.py
```

## WhatsApp Commands

Once set up, you can use these commands by replying to notifications:

| Command | Description |
|---------|-------------|
| `approve <code>` | Approve an item |
| `reject <code>` | Reject an item |
| `list` | List all pending approvals |
| `status` | Show system status |
| `help` | Show available commands |
| `<code>` | Quick approve (just send the code) |

### Examples

```
# Approve an email with code AB12
approve AB12

# Reject a social post with code CD34
reject CD34

# Quick approve (just the code)
AB12

# View all pending items
list
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    DYNAMIC APPROVAL FLOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────┐   │
│  │   Watcher   │───▶│ Pending_     │───▶│ Notification    │   │
│  │  (Gmail,    │    │ Approval/    │    │ Hub             │   │
│  │   Social)   │    │              │    │                 │   │
│  └─────────────┘    └──────────────┘    └────────┬────────┘   │
│                                                   │            │
│                                         ┌─────────▼─────────┐  │
│                                         │    WhatsApp       │  │
│                                         │    (Twilio)       │  │
│                                         └─────────┬─────────┘  │
│                                                   │            │
│                    ┌──────────────────────────────┘            │
│                    │ User replies: "approve AB12"              │
│                    ▼                                           │
│  ┌─────────────────────────────┐                              │
│  │     Webhook Server          │                              │
│  │  (receives WhatsApp reply)  │                              │
│  └──────────────┬──────────────┘                              │
│                 │                                              │
│                 ▼                                              │
│  ┌─────────────────────────────┐    ┌─────────────────────┐   │
│  │   Approval Processor        │───▶│   Approved/         │   │
│  │  (moves files, logs)        │    │                     │   │
│  └─────────────────────────────┘    └──────────┬──────────┘   │
│                                                 │              │
│                                                 ▼              │
│                                    ┌─────────────────────────┐ │
│                                    │    Action Executor      │ │
│                                    │  (sends email, posts)   │ │
│                                    └──────────────┬──────────┘ │
│                                                   │            │
│                                                   ▼            │
│                                    ┌─────────────────────────┐ │
│                                    │    Done/                │ │
│                                    │  (completed actions)    │ │
│                                    └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Components

| File | Purpose |
|------|---------|
| `start_dynamic.py` | Main entry point |
| `dynamic_orchestrator.py` | Manages all components |
| `whatsapp_webhook_server.py` | Receives WhatsApp messages |
| `approval_processor.py` | Handles approve/reject logic |
| `notification_hub.py` | Sends WhatsApp notifications |
| `action_executor.py` | Executes approved actions |

## Troubleshooting

### Notifications not sending
1. Check `.env` file has correct Twilio credentials
2. Verify WHATSAPP_TO is in correct format: `whatsapp:+1234567890`
3. Make sure you've joined the Twilio WhatsApp sandbox

### Webhook not receiving messages
1. Check ngrok is running and URL is correct in Twilio
2. Verify webhook URL ends with `/webhook/whatsapp`
3. Check server logs for errors

### Actions not executing
1. Check the Approved folder for files
2. Verify action_executor is running (check orchestrator status)
3. Check credentials for the specific service (Gmail, LinkedIn, etc.)

## Security Notes

- Never commit `.env` file to version control
- Use HTTPS in production
- Enable VALIDATE_WEBHOOK in production
- Review approval logs regularly: `AI_Employee_Vault/Logs/`

## Quick Start

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Configure .env file (see above)

# 3. Start the system
python start_dynamic.py

# 4. Send a test notification
python start_dynamic.py --test-notification
```
