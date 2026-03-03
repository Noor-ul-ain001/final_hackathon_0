#!/bin/bash
set -e

echo "=========================================="
echo "  AI Employee - Container Startup"
echo "=========================================="

# Create vault directories
mkdir -p /tmp/AI_Employee_Vault/Needs_Action \
         /tmp/AI_Employee_Vault/Pending_Approval \
         /tmp/AI_Employee_Vault/Done \
         /tmp/AI_Employee_Vault/In_Progress \
         /tmp/AI_Employee_Vault/Approved \
         /tmp/AI_Employee_Vault/Rejected \
         /tmp/AI_Employee_Vault/Failed \
         /tmp/AI_Employee_Vault/Briefings

# Write .env for Python scripts if secrets are provided
ENV_FILE=/app/python/.env
if [ -n "$GMAIL_CREDENTIALS_PATH" ] || [ -n "$TWILIO_ACCOUNT_SID" ] || [ -n "$WHATSAPP_ACCESS_TOKEN" ]; then
  echo "Writing .env for Python watchers..."
  printenv | grep -E "^(VAULT_PATH|GMAIL|TWILIO|WHATSAPP|TWITTER|LINKEDIN|FACEBOOK|ODOO|XERO|EXECUTION_MODE|DRY_RUN)=" > "$ENV_FILE" || true
fi

# Start Python watchers in the background
echo "Starting Python watchers..."
cd /app/python
python3 start_watchers.py >> /tmp/watchers.log 2>&1 &
WATCHER_PID=$!
echo "Python watchers started (PID: $WATCHER_PID)"

# Start Next.js app in the foreground
echo "Starting Next.js app on port $PORT..."
cd /app
exec npm start
