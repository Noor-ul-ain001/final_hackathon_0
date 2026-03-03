#!/usr/bin/env python3
"""
Gmail Watcher - Email Monitoring System

Monitors Gmail inbox for new emails and creates structured markdown files
in Needs_Action/ to trigger Claude processing.

Features:
- Monitors Gmail inbox continuously
- Processes ALL incoming emails (no keyword filter)
- Extracts email content (subject, sender, body)
- Creates structured markdown files for Claude
- Tracks processed emails to avoid duplicates
"""

import os
import time
import base64
import re
import json
import urllib.request
import urllib.error
from datetime import datetime
from pathlib import Path

try:
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from google.auth.transport.requests import Request
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
except ImportError:
    print("ERROR: Required packages not installed")
    print("Install with: pip install google-auth-oauthlib google-auth-httplib2 google-api-python-client")
    exit(1)

# Configuration
SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.modify'
]
CREDENTIALS_PATH = './credentials.json'
TOKEN_PATH = './token.json'
VAULT_DIR = Path(__file__).parent / "AI_Employee_Vault"
NEEDS_ACTION_DIR = VAULT_DIR / "Needs_Action"
PENDING_APPROVAL_DIR = VAULT_DIR / "Pending_Approval"
CHECK_INTERVAL = 10  # seconds (faster detection)

# Load Groq API key from .env
def _load_env_key(key_name):
    env_path = Path(__file__).parent / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding='utf-8').splitlines():
            line = line.strip()
            if line.startswith('#') or '=' not in line:
                continue
            k, _, v = line.partition('=')
            if k.strip().lower() == key_name.lower():
                return v.strip()
    return os.environ.get(key_name, '')

GROQ_API_KEY = _load_env_key('groq_api_key')

# Track processed emails
processed_emails = set()


def authenticate_gmail():
    """Authenticate with Gmail API"""
    creds = None

    if os.path.exists(TOKEN_PATH):
        try:
            creds = Credentials.from_authorized_user_file(TOKEN_PATH, SCOPES)
        except Exception as e:
            print(f"Error loading token: {e}")

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
            except Exception as e:
                print(f"Error refreshing token: {e}")
                return None
        else:
            try:
                flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_PATH, SCOPES)
                creds = flow.run_local_server(port=0)
            except Exception as e:
                print(f"Error during OAuth flow: {e}")
                return None

        # Save credentials
        Path(TOKEN_PATH).write_text(creds.to_json())

    return creds


def get_email_content(service, msg_id):
    """Fetch full email content"""
    try:
        message = service.users().messages().get(
            userId='me',
            id=msg_id,
            format='full'
        ).execute()

        headers = message['payload']['headers']

        # Extract headers
        subject = next((h['value'] for h in headers if h['name'].lower() == 'subject'), 'No Subject')
        sender = next((h['value'] for h in headers if h['name'].lower() == 'from'), 'Unknown')
        date = next((h['value'] for h in headers if h['name'].lower() == 'date'), 'Unknown')
        to = next((h['value'] for h in headers if h['name'].lower() == 'to'), 'Unknown')
        # Capture threading headers for proper reply
        message_id_header = next((h['value'] for h in headers if h['name'].lower() == 'message-id'), '')
        references = next((h['value'] for h in headers if h['name'].lower() == 'references'), '')
        thread_id = message.get('threadId', '')

        # Extract body
        body = ""
        if 'parts' in message['payload']:
            for part in message['payload']['parts']:
                if part['mimeType'] == 'text/plain':
                    if 'data' in part['body']:
                        body = base64.urlsafe_b64decode(part['body']['data']).decode('utf-8')
                        break
        else:
            if 'body' in message['payload'] and 'data' in message['payload']['body']:
                body = base64.urlsafe_b64decode(message['payload']['body']['data']).decode('utf-8')

        if not body:
            body = "[No plain text content available]"

        return {
            'id': msg_id,
            'thread_id': thread_id,
            'message_id_header': message_id_header,
            'references': references,
            'subject': subject,
            'sender': sender,
            'date': date,
            'to': to,
            'body': body
        }

    except Exception as e:
        print(f"Error fetching email {msg_id}: {e}")
        return None


def generate_email_response(email_data):
    """Call Groq API to generate a real email response draft."""
    if not GROQ_API_KEY:
        print("  [AI] No GROQ_API_KEY found — skipping auto-draft")
        return None

    sender = email_data['sender']
    subject = email_data['subject']
    body = email_data['body'][:2000]  # Trim very long emails

    prompt = (
        "You are a professional AI business email assistant. "
        "Draft a polished, concise reply to the email below.\n\n"
        f"From: {sender}\n"
        f"Subject: {subject}\n\n"
        f"Body:\n{body}\n\n"
        "Guidelines:\n"
        "- Professional but friendly tone\n"
        "- Address all points raised\n"
        "- Proper grammar and punctuation\n"
        "- Match the sender's formality level\n\n"
        "Write ONLY the email body text. "
        "Start with an appropriate greeting (e.g. 'Dear ...' or 'Hi ...'). "
        "End with a professional sign-off (e.g. 'Best regards,\\nAI Employee')."
    )

    payload = json.dumps({
        "model": "llama-3.1-8b-instant",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 600,
        "temperature": 0.7
    }).encode('utf-8')

    req = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=payload,
        headers={
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        }
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read())
            text = result['choices'][0]['message']['content'].strip()
            print(f"  [AI] Response generated ({len(text)} chars)")
            return text
    except Exception as e:
        print(f"  [AI] Groq API error: {e}")
        return None


def create_pending_approval_file(email_data, response_body, timestamp):
    """Create the Pending_Approval file with the AI-generated response."""
    PENDING_APPROVAL_DIR.mkdir(parents=True, exist_ok=True)

    clean_subject = "".join(
        c for c in email_data['subject'][:50] if c.isalnum() or c in (' ', '-', '_')
    ).strip().replace(' ', '_')

    filename = f"RESPONSE_{timestamp}_{clean_subject}.md"
    filepath = PENDING_APPROVAL_DIR / filename

    content = f"""---
email_id: {email_data['id']}
thread_id: {email_data.get('thread_id', '')}
original_message_id: {email_data.get('message_id_header', '')}
reply_to: {email_data['sender']}
original_subject: {email_data['subject']}
created_at: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
status: pending_approval
---

# Email Response Draft

## To
{email_data['sender']}

## Subject
Re: {email_data['subject']}

## Body
{response_body}

## Notes
Auto-generated by AI Employee (Groq llama-3.1-8b-instant). Review before sending.

---
To approve: Move this file to /Approved
To reject: Delete this file or move to /Done
"""

    filepath.write_text(content, encoding='utf-8')
    print(f"  [AI] Pending approval created: {filename}")
    return filename


def vault_file_exists_for_email(email_id: str) -> bool:
    """Return True if a vault file already contains this email_id."""
    for f in NEEDS_ACTION_DIR.glob('*.md'):
        try:
            if f'email_id: {email_id}' in f.read_text(encoding='utf-8'):
                return True
        except Exception:
            pass
    return False


def create_needs_action_file(email_data):
    """Create markdown file in Needs_Action/ and auto-generate Pending_Approval response."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    # Clean subject for filename
    clean_subject = "".join(c for c in email_data['subject'][:50] if c.isalnum() or c in (' ', '-', '_')).strip()
    clean_subject = clean_subject.replace(' ', '_')

    output_filename = f"{timestamp}_EMAIL_{clean_subject}.md"
    output_path = NEEDS_ACTION_DIR / output_filename

    matched_keyword = 'email'

    # Auto-generate response using Groq
    print(f"  [AI] Generating response for: {email_data['subject'][:60]}")
    generated_response = generate_email_response(email_data)

    # Create Pending_Approval file if we got a response
    pending_filename = None
    if generated_response:
        pending_filename = create_pending_approval_file(email_data, generated_response, timestamp)

    # Build status section based on whether response was generated
    if generated_response and pending_filename:
        response_section = f"""## ✅ AI Response Generated

An AI-drafted response has been automatically created and is waiting for your approval.

**Pending Approval File:** `AI_Employee_Vault/Pending_Approval/{pending_filename}`

> Review the draft, then move it to `/Approved` to send, or delete it to decline.

### Response Preview

{generated_response}
"""
    else:
        response_section = """## ⚠️ Manual Response Required

AI response generation was unavailable. Please manually create a response in `/Pending_Approval/`.
"""

    # Create structured markdown
    markdown_content = f"""# 📧 New Email Received

---
received_at: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
email_id: {email_data['id']}
source: Gmail
type: email
status: {"pending_approval" if generated_response else "needs_review"}
trigger_keyword: {matched_keyword}
pending_approval: {pending_filename or "none"}
---

## 📨 Email Details

| Field | Value |
|-------|-------|
| **From** | `{email_data['sender']}` |
| **To** | `{email_data['to']}` |
| **Subject** | `{email_data['subject']}` |
| **Date** | `{email_data['date']}` |
| **Trigger Keyword** | `{matched_keyword}` |

---

## 📝 Email Body

> **Original Message:**
>
> {chr(10).join(['> ' + line for line in email_data['body'].split(chr(10))])}

---

{response_section}

---
*Created by Gmail Watcher at {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}*
"""

    # Ensure directory exists
    NEEDS_ACTION_DIR.mkdir(parents=True, exist_ok=True)

    # Write file
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(markdown_content)

    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Created: {output_filename}")
    return output_path


def check_new_emails(service):
    """Check for all new unread emails"""
    try:
        # Query for unread emails
        results = service.users().messages().list(
            userId='me',
            q='is:unread',
            maxResults=25
        ).execute()

        messages = results.get('messages', [])

        new_emails = []
        for msg in messages:
            msg_id = msg['id']

            # Skip if already processed
            if msg_id in processed_emails:
                continue

            # Fetch full email
            email_data = get_email_content(service, msg_id)
            if email_data:
                # Mark as processed (so we don't check it again)
                processed_emails.add(msg_id)

                new_emails.append(email_data)
                safe_subject = email_data['subject'][:50].encode('ascii', errors='replace').decode('ascii')
                print(f"  [NEW] Processing email: {safe_subject}")

        return new_emails

    except HttpError as error:
        print(f"Error checking emails: {error}")
        return []


def main():
    """Main watcher loop"""
    print("=" * 60)
    print("Gmail Watcher - Email Monitoring System")
    print("=" * 60)
    print(f"Output to: {NEEDS_ACTION_DIR}")
    print(f"Check interval: {CHECK_INTERVAL} seconds")
    print(f"AI Auto-draft: {'ENABLED (Groq)' if GROQ_API_KEY else 'DISABLED (no GROQ_API_KEY)'}")
    print("=" * 60)

    # Authenticate
    print("\nAuthenticating with Gmail...")
    creds = authenticate_gmail()
    if not creds:
        print("Failed to authenticate. Exiting.")
        return

    service = build('gmail', 'v1', credentials=creds)

    # Get user profile
    try:
        profile = service.users().getProfile(userId='me').execute()
        email_address = profile.get('emailAddress', 'Unknown')
        print(f"Authenticated as: {email_address}")
    except Exception as e:
        print(f"Error getting profile: {e}")
        return

    # Initial scan — create files for emails that don't already have vault files
    print("\nPerforming initial scan...")
    initial_emails = check_new_emails(service)
    if initial_emails:
        print(f"Found {len(initial_emails)} unread email(s)")
        for email_data in initial_emails:
            safe_subj = email_data['subject'][:50].encode('ascii', errors='replace').decode('ascii')
            if vault_file_exists_for_email(email_data['id']):
                print(f"  [SKIP] Already in vault: {safe_subj}")
            else:
                print(f"  [NEW]  Creating file for: {safe_subj}")
                try:
                    create_needs_action_file(email_data)
                except Exception as e:
                    print(f"  Error: {e}")
    else:
        print("No unread emails found")

    print(f"\nMonitoring inbox for new emails...\n")

    try:
        while True:
            # Check for new emails
            new_emails = check_new_emails(service)

            # Process each new email
            for email_data in new_emails:
                try:
                    create_needs_action_file(email_data)
                except Exception as e:
                    print(f"Error processing email: {e}")

            # Wait before next check
            time.sleep(CHECK_INTERVAL)

    except KeyboardInterrupt:
        print("\n\n" + "=" * 60)
        print("Gmail Watcher stopped by user")
        print(f"Total emails processed: {len(processed_emails)}")
        print("=" * 60)


if __name__ == "__main__":
    main()
