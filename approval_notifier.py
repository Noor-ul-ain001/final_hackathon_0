#!/usr/bin/env python3
"""
Approval Notifier

Monitors Pending_Approval folder and sends WhatsApp notifications
when new draft responses are created by Claude.

This ensures you're immediately notified when a response needs review.
"""

import os
import time
from datetime import datetime
from pathlib import Path
import re

try:
    from whatsapp_notifier import WhatsAppNotifier
    NOTIFIER_TYPE = 'whatsapp'
except ImportError:
    print("ERROR: whatsapp_notifier not found")
    exit(1)

# Configuration
VAULT_DIR = Path(__file__).parent / "AI_Employee_Vault"
PENDING_DIR = VAULT_DIR / "Pending_Approval"
CHECK_INTERVAL = 5  # seconds

# Track notified files
notified_files = set()


def parse_response_metadata(file_path):
    """Extract metadata from response file"""
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

        return metadata

    except Exception as e:
        print(f"Error parsing metadata: {e}")
        return {}


def scan_pending_folder():
    """Scan Pending_Approval folder for new files"""
    try:
        PENDING_DIR.mkdir(parents=True, exist_ok=True)

        # Get all .md files
        files = [f for f in PENDING_DIR.iterdir() if f.is_file() and f.suffix == '.md']

        new_files = []
        for file_path in files:
            file_id = str(file_path)

            if file_id not in notified_files:
                new_files.append(file_path)
                notified_files.add(file_id)

        return new_files

    except Exception as e:
        print(f"Error scanning Pending_Approval folder: {e}")
        return []


def main():
    """Main notifier loop"""
    print("=" * 60)
    print("Approval Notifier - Notification System")
    print("=" * 60)
    print(f"Monitoring: {PENDING_DIR}")
    print(f"Check interval: {CHECK_INTERVAL} seconds")
    print("=" * 60)

    # Initialize notifier
    notifier = None
    channel = 'none'

    try:
        notifier = WhatsAppNotifier()
        channel = 'WhatsApp'
        print(f"Notifier: WhatsApp")
    except Exception as e:
        print(f"WhatsApp init failed: {e}")
        print("\nConfigure TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + WHATSAPP_TO in .env")
        return

    if notifier is None:
        print("No notifier configured.")
        return

    # Initial scan
    print("\nPerforming initial scan...")
    initial_files = scan_pending_folder()
    if initial_files:
        print(f"Found {len(initial_files)} pending response(s) - marking as already notified")
    else:
        print("No pending responses found")

    print(f"\nMonitoring for new draft responses...\n")

    try:
        while True:
            # Scan for new files
            new_files = scan_pending_folder()

            # Notify for each new file
            for file_path in new_files:
                try:
                    metadata = parse_response_metadata(file_path)

                    sender = metadata.get('reply_to', 'Unknown')
                    subject = metadata.get('original_subject', 'No Subject')

                    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] New draft: {file_path.name}")
                    print(f"  From: {sender}")
                    print(f"  Subject: {subject}")

                    # Send notification via configured channel
                    success = notifier.notify_approval_needed(sender, subject)

                    if success:
                        print(f"  Sent via {channel}")
                    else:
                        print(f"  Notification failed")

                except Exception as e:
                    print(f"Error processing {file_path.name}: {e}")

            # Wait before next check
            time.sleep(CHECK_INTERVAL)

    except KeyboardInterrupt:
        print("\n\n" + "=" * 60)
        print("Approval Notifier stopped by user")
        print(f"Total notifications sent: {len(notified_files)}")
        print("=" * 60)


if __name__ == "__main__":
    main()
