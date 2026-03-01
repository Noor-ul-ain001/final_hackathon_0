#!/usr/bin/env python3
"""
Email Sender - Automatic Reply System

Monitors the /Approved folder for approved email responses
and sends them via Gmail API.

Workflow:
1. Watch /Approved folder for new .md files
2. Parse email response details (recipient, subject, body)
3. Send email via Gmail API
4. Move sent response to /Done
5. Notify via WhatsApp that email was sent
"""

import os
import time
import re
import base64
from datetime import datetime
from pathlib import Path
from email.mime.text import MIMEText

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
APPROVED_DIR = VAULT_DIR / "Approved"
DONE_DIR = VAULT_DIR / "Done"
CHECK_INTERVAL = 10  # seconds

# Track processed files
processed_files = set()


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


def parse_response_file(file_path):
    """Parse markdown response file to extract email details"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Extract YAML frontmatter
        yaml_match = re.search(r'^---\s*\n(.*?)\n---', content, re.DOTALL | re.MULTILINE)
        metadata = {}

        if yaml_match:
            yaml_content = yaml_match.group(1)
            for line in yaml_content.split('\n'):
                if ':' in line:
                    key, value = line.split(':', 1)
                    metadata[key.strip()] = value.strip()

        # Extract sections
        to_match = re.search(r'^## To\s*\n(.+?)(?=\n##|\n---|\Z)', content, re.MULTILINE | re.DOTALL)
        subject_match = re.search(r'^## Subject\s*\n(.+?)(?=\n##|\n---|\Z)', content, re.MULTILINE | re.DOTALL)
        body_match = re.search(r'^## Body\s*\n(.+?)(?=\n##|\n---|\Z)', content, re.MULTILINE | re.DOTALL)

        email_data = {
            'email_id': metadata.get('email_id', ''),
            'thread_id': metadata.get('thread_id', ''),
            'original_message_id': metadata.get('original_message_id', ''),
            'reply_to': (to_match.group(1).strip() if to_match else metadata.get('reply_to', '')),
            'subject': (subject_match.group(1).strip() if subject_match else metadata.get('original_subject', 'No Subject')),
            'body': (body_match.group(1).strip() if body_match else '[No body content]')
        }

        # Validate required fields
        if not email_data['reply_to'] or not email_data['body']:
            raise ValueError("Missing required fields: reply_to or body")

        return email_data

    except Exception as e:
        print(f"Error parsing file {file_path.name}: {e}")
        return None


def create_message(to, subject, body):
    """Create email message"""
    message = MIMEText(body)
    message['to'] = to
    message['subject'] = subject

    # Encode message
    raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode('utf-8')
    return {'raw': raw_message}


def send_email(service, to, subject, body, thread_id=None, original_message_id=None):
    """Send email via Gmail API as a proper reply when threading info is available"""
    try:
        # Ensure Re: prefix for replies
        if original_message_id and not subject.lower().startswith('re:'):
            subject = f'Re: {subject}'

        message = create_message(to, subject, body)

        # Add reply headers so it threads correctly in the recipient's inbox
        if original_message_id:
            # Rebuild message with reply headers (create_message returns raw bytes)
            from email.mime.text import MIMEText as _MIMEText
            import base64 as _base64
            msg = _MIMEText(body)
            msg['to'] = to
            msg['subject'] = subject
            msg['In-Reply-To'] = original_message_id
            msg['References'] = original_message_id
            message = {'raw': _base64.urlsafe_b64encode(msg.as_bytes()).decode('utf-8')}

        send_body = message
        if thread_id:
            send_body = dict(message)
            send_body['threadId'] = thread_id

        sent_message = service.users().messages().send(
            userId='me',
            body=send_body
        ).execute()

        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Email sent to: {to}")
        return sent_message

    except HttpError as error:
        print(f"Error sending email: {error}")
        return None


def notify_whatsapp(recipient, subject):
    """Send WhatsApp notification about sent email"""
    try:
        # Import here to avoid dependency if WhatsApp is not configured
        from whatsapp_notifier import WhatsAppNotifier

        notifier = WhatsAppNotifier()
        notifier.notify_email_sent(recipient, subject)
    except Exception as e:
        print(f"WhatsApp notification skipped: {e}")


def scan_approved_folder():
    """Scan Approved folder for new response files"""
    try:
        APPROVED_DIR.mkdir(parents=True, exist_ok=True)

        # Get all .md files
        files = [f for f in APPROVED_DIR.iterdir() if f.is_file() and f.suffix == '.md']

        new_files = []
        for file_path in files:
            file_id = str(file_path)

            if file_id not in processed_files:
                new_files.append(file_path)
                processed_files.add(file_id)

        return new_files

    except Exception as e:
        print(f"Error scanning Approved folder: {e}")
        return []


def main():
    """Main sender loop"""
    print("=" * 60)
    print("Email Sender - Automatic Reply System")
    print("=" * 60)
    print(f"Monitoring: {APPROVED_DIR}")
    print(f"Check interval: {CHECK_INTERVAL} seconds")
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

    # Ensure directories exist
    DONE_DIR.mkdir(parents=True, exist_ok=True)

    # Initial scan
    print("\nPerforming initial scan...")
    initial_files = scan_approved_folder()
    if initial_files:
        print(f"Found {len(initial_files)} approved response(s) - marking as already processed")
    else:
        print("No approved responses found")

    print(f"\nMonitoring for approved responses...\n")

    try:
        while True:
            # Scan for new approved responses
            new_files = scan_approved_folder()

            # Process each file
            for file_path in new_files:
                try:
                    print(f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Processing: {file_path.name}")

                    # Parse response file
                    email_data = parse_response_file(file_path)
                    if not email_data:
                        print(f"  [FAILED] Failed to parse file")
                        continue

                    # Send email as a proper reply
                    result = send_email(
                        service,
                        email_data['reply_to'],
                        email_data['subject'],
                        email_data['body'],
                        thread_id=email_data.get('thread_id'),
                        original_message_id=email_data.get('original_message_id')
                    )

                    if result:
                        print(f"  [OK] Email sent successfully")

                        # Send WhatsApp notification
                        notify_whatsapp(email_data['reply_to'], email_data['subject'])

                        # Move to Done
                        done_path = DONE_DIR / file_path.name
                        file_path.rename(done_path)
                        print(f"  [OK] Moved to /Done")

                    else:
                        print(f"  [FAILED] Failed to send email")

                except Exception as e:
                    print(f"  [ERROR] Error processing file: {e}")

            # Wait before next check
            time.sleep(CHECK_INTERVAL)

    except KeyboardInterrupt:
        print("\n\n" + "=" * 60)
        print("Email Sender stopped by user")
        print(f"Total responses processed: {len(processed_files)}")
        print("=" * 60)


if __name__ == "__main__":
    main()
