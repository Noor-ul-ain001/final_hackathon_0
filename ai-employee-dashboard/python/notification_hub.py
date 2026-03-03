#!/usr/bin/env python3
"""
Notification Hub
----------------
Central notification system for the AI Employee.
Handles all outgoing notifications via WhatsApp with approval codes
and reply instructions.

Features:
- Sends approval requests with unique codes
- Provides clear reply instructions
- Supports multiple notification types
- Batches notifications when appropriate
"""

import os
import json
import hashlib
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / '.env')
except ImportError:
    pass

try:
    from whatsapp_sender import WhatsAppSender
    WHATSAPP_AVAILABLE = True
except ImportError:
    WHATSAPP_AVAILABLE = False


class NotificationHub:
    """
    Central hub for all notifications.
    Sends via WhatsApp (Twilio) or simulation mode.
    """

    def __init__(self, vault_path: str):
        """Initialize the notification hub."""
        self.vault_path = Path(vault_path)
        self.logs_dir = self.vault_path / 'Logs'
        self.logs_dir.mkdir(parents=True, exist_ok=True)

        # Initialize WhatsApp sender
        self.whatsapp = None
        if WHATSAPP_AVAILABLE:
            try:
                self.whatsapp = WhatsAppSender()
                print("[NotificationHub] Using WhatsApp for notifications")
            except Exception as e:
                print(f"[NotificationHub] WhatsApp init failed: {e}")

        # Notification queue for batching
        self._queue = []
        self._batch_threshold = 3  # Batch if more than 3 pending

    def _generate_code(self, identifier: str) -> str:
        """Generate a short approval code."""
        hash_input = f"{identifier}_{datetime.now().strftime('%Y%m%d%H')}"
        return hashlib.md5(hash_input.encode()).hexdigest()[:4].upper()

    def _send_whatsapp(self, message: str) -> bool:
        """Send a notification via WhatsApp or simulation mode."""
        if self.whatsapp:
            try:
                result = self.whatsapp.send(message)
                if result:
                    self._log_notification('sent', message)
                else:
                    self._log_notification('failed', message, error=self.whatsapp.last_error)
                return result
            except Exception as e:
                print(f"WhatsApp send error: {e}")
                self._log_notification('failed', message, error=str(e))
                return False

        # Simulation mode — no channel configured
        print(f"[SIMULATED] Notification: {message[:100]}...")
        self._log_notification('simulated', message)
        return True

    def _log_notification(self, status: str, message: str,
                         sid: str = None, error: str = None):
        """Log notification for audit."""
        log_file = self.logs_dir / f'notifications_{datetime.now().strftime("%Y-%m-%d")}.json'

        entry = {
            'timestamp': datetime.now().isoformat(),
            'status': status,
            'message_preview': message[:100],
            'sid': sid,
            'error': error
        }

        try:
            logs = []
            if log_file.exists():
                logs = json.loads(log_file.read_text())
            logs.append(entry)
            log_file.write_text(json.dumps(logs, indent=2))
        except:
            pass

    def notify_approval_needed(self, item_type: str, summary: str,
                               code: str, details: Dict = None) -> bool:
        """
        Send notification that approval is needed.

        Args:
            item_type: Type of item (EMAIL, SOCIAL, PAYMENT, etc.)
            summary: Brief summary of the item
            code: Approval code
            details: Additional details to include
        """
        message = f"""*Approval Required*

*{item_type}*: {summary}

*Code: {code}*

Reply:
approve {code}
reject {code}

Or just reply "{code}" to approve."""

        if details:
            if details.get('recipient'):
                message += f"\n\nTo: {details['recipient']}"
            if details.get('amount'):
                message += f"\nAmount: ${details['amount']}"
            if details.get('platform'):
                message += f"\nPlatform: {details['platform']}"

        return self._send_whatsapp(message)

    def notify_email_draft(self, to: str, subject: str, code: str,
                          preview: str = None) -> bool:
        """Notify about email draft ready for approval."""
        message = f"""*Email Draft Ready*

To: {to}
Subject: {subject}

Code: *{code}*

Reply "approve {code}" to send
Reply "reject {code}" to discard"""

        if preview:
            message += f"\n\nPreview:\n{preview[:200]}..."

        return self._send_whatsapp(message)

    def notify_social_post(self, platform: str, content: str, code: str) -> bool:
        """Notify about social media post ready for approval."""
        # Truncate content for preview
        preview = content[:200] + "..." if len(content) > 200 else content

        message = f"""*{platform.title()} Post Ready*

{preview}

Code: *{code}*

Reply "approve {code}" to post
Reply "reject {code}" to discard"""

        return self._send_whatsapp(message)

    def notify_payment(self, recipient: str, amount: float,
                       reason: str, code: str) -> bool:
        """Notify about payment requiring approval."""
        message = f"""*Payment Approval Required*

To: {recipient}
Amount: ${amount:.2f}
Reason: {reason}

Code: *{code}*

Reply "approve {code}" to process
Reply "reject {code}" to cancel"""

        return self._send_whatsapp(message)

    def notify_action_completed(self, action_type: str, summary: str) -> bool:
        """Notify that an action was completed."""
        timestamp = datetime.now().strftime('%H:%M')

        message = f"""*{action_type} Completed*

{summary}

Completed at {timestamp}"""

        return self._send_whatsapp(message)

    def notify_error(self, error_type: str, details: str) -> bool:
        """Notify about an error that needs attention."""
        message = f"""*AI Employee Alert*

Error: {error_type}

{details}

Reply "status" for system status"""

        return self._send_whatsapp(message)

    def notify_batch_approvals(self, items: List[Dict]) -> bool:
        """Send a batch notification for multiple pending approvals."""
        if not items:
            return True

        message = f"""*{len(items)} Items Pending Approval*

"""
        for item in items[:5]:  # Limit to 5 in message
            message += f"*{item['code']}*: {item['type']} - {item['summary'][:30]}\n"

        if len(items) > 5:
            message += f"\n...and {len(items) - 5} more"

        message += """

Reply with code to approve
Reply "list" for full list"""

        return self._send_whatsapp(message)

    def notify_daily_summary(self, stats: Dict) -> bool:
        """Send daily summary notification."""
        message = f"""*AI Employee Daily Summary*

Processed: {stats.get('processed', 0)}
Approved: {stats.get('approved', 0)}
Rejected: {stats.get('rejected', 0)}
Pending: {stats.get('pending', 0)}

Reply "status" for details"""

        return self._send_whatsapp(message)

    def notify_watcher_status(self, watcher_name: str, status: str,
                              details: str = '') -> bool:
        """Notify about watcher status changes."""
        emoji = "" if status == 'running' else ""

        message = f"""{emoji} *Watcher {status.title()}*

{watcher_name}
{details}"""

        return self._send_whatsapp(message)

    def send_test_notification(self) -> bool:
        """Send a test notification."""
        message = f"""*AI Employee Test*

Your notification system is working!

Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

Reply "help" for commands"""

        return self._send_whatsapp(message)


class ApprovalNotificationService:
    """
    Service that monitors Pending_Approval folder and sends
    notifications for new items.
    """

    def __init__(self, vault_path: str):
        """Initialize the notification service."""
        self.vault_path = Path(vault_path)
        self.pending_dir = self.vault_path / 'Pending_Approval'
        self.pending_dir.mkdir(parents=True, exist_ok=True)

        self.hub = NotificationHub(vault_path)
        self.notified_files = set()

        # Load already notified files
        self._load_notified_state()

    def _load_notified_state(self):
        """Load state of already notified files."""
        state_file = self.vault_path / '.notified_state.json'
        if state_file.exists():
            try:
                data = json.loads(state_file.read_text())
                self.notified_files = set(data.get('files', []))
            except:
                pass

    def _save_notified_state(self):
        """Save state of notified files."""
        state_file = self.vault_path / '.notified_state.json'
        try:
            data = {'files': list(self.notified_files)}
            state_file.write_text(json.dumps(data))
        except:
            pass

    def _generate_code(self, filename: str) -> str:
        """Generate approval code for a file."""
        hash_input = f"{filename}_{datetime.now().strftime('%Y%m%d')}"
        return hashlib.md5(hash_input.encode()).hexdigest()[:4].upper()

    def _parse_file(self, file_path: Path) -> Dict:
        """Parse metadata from pending file."""
        import re

        try:
            content = file_path.read_text(encoding='utf-8')

            # Extract YAML frontmatter
            yaml_match = re.search(r'^---\s*\n(.*?)\n---', content, re.DOTALL | re.MULTILINE)
            metadata = {}

            if yaml_match:
                yaml_content = yaml_match.group(1)
                for line in yaml_content.split('\n'):
                    if ':' in line:
                        key, value = line.split(':', 1)
                        metadata[key.strip()] = value.strip()

            # Get content preview (after frontmatter)
            parts = content.split('---')
            body = '---'.join(parts[2:]) if len(parts) > 2 else content
            metadata['preview'] = body.strip()[:300]

            return metadata

        except Exception as e:
            return {'error': str(e)}

    def _determine_type(self, filename: str, metadata: Dict) -> str:
        """Determine notification type."""
        filename_lower = filename.lower()

        if 'email' in filename_lower or 'response' in filename_lower:
            return 'EMAIL'
        elif 'linkedin' in filename_lower:
            return 'LINKEDIN'
        elif 'social' in filename_lower or 'post' in filename_lower:
            return 'SOCIAL'
        elif 'payment' in filename_lower:
            return 'PAYMENT'
        elif 'invoice' in filename_lower:
            return 'INVOICE'
        else:
            return metadata.get('type', 'ACTION').upper()

    def check_and_notify(self) -> List[Dict]:
        """Check for new pending items and send notifications."""
        new_items = []

        for file_path in self.pending_dir.glob('*.md'):
            file_key = file_path.name

            if file_key not in self.notified_files:
                metadata = self._parse_file(file_path)
                code = self._generate_code(file_key)
                item_type = self._determine_type(file_key, metadata)

                # Create summary
                if item_type == 'EMAIL':
                    summary = f"Reply to {metadata.get('reply_to', 'unknown')[:20]}"
                    self.hub.notify_email_draft(
                        to=metadata.get('reply_to', 'unknown'),
                        subject=metadata.get('original_subject', 'No subject'),
                        code=code,
                        preview=metadata.get('preview', '')
                    )
                elif item_type in ['LINKEDIN', 'SOCIAL']:
                    platform = metadata.get('platform', item_type.lower())
                    summary = f"{platform.title()} post"
                    self.hub.notify_social_post(
                        platform=platform,
                        content=metadata.get('preview', ''),
                        code=code
                    )
                elif item_type == 'PAYMENT':
                    summary = f"Payment to {metadata.get('recipient', 'unknown')}"
                    self.hub.notify_payment(
                        recipient=metadata.get('recipient', 'unknown'),
                        amount=float(metadata.get('amount', 0)),
                        reason=metadata.get('reason', 'Not specified'),
                        code=code
                    )
                else:
                    summary = file_key[:30]
                    self.hub.notify_approval_needed(
                        item_type=item_type,
                        summary=summary,
                        code=code
                    )

                self.notified_files.add(file_key)
                new_items.append({
                    'file': file_key,
                    'type': item_type,
                    'code': code
                })

        # Save state
        if new_items:
            self._save_notified_state()

        return new_items


def run_notification_service(vault_path: str, check_interval: int = 10):
    """Run the notification service continuously."""
    import time

    service = ApprovalNotificationService(vault_path)

    print("=" * 60)
    print("Notification Service Started")
    print("=" * 60)
    print(f"Monitoring: {service.pending_dir}")
    print(f"Check interval: {check_interval}s")
    print("=" * 60)

    try:
        while True:
            new_items = service.check_and_notify()
            if new_items:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Sent {len(new_items)} notification(s)")

            time.sleep(check_interval)

    except KeyboardInterrupt:
        print("\nNotification service stopped.")


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Notification Hub')
    parser.add_argument('--vault', default='./AI_Employee_Vault', help='Vault path')
    parser.add_argument('--test', action='store_true', help='Send test notification')
    parser.add_argument('--service', action='store_true', help='Run as service')
    parser.add_argument('--interval', type=int, default=10, help='Check interval')

    args = parser.parse_args()

    hub = NotificationHub(args.vault)

    if args.test:
        print("Sending test notification...")
        result = hub.send_test_notification()
        print(f"Result: {'Success' if result else 'Failed'}")

    elif args.service:
        run_notification_service(args.vault, args.interval)

    else:
        # Default: show status
        print("Notification Hub initialized")
        if hub.whatsapp:
            print(f"Channel: WhatsApp ({hub.whatsapp.api})")
        else:
            print("Channel: Simulation mode (no notifier configured)")
        print("\nRun with --test to send test notification")
        print("Run with --service to start monitoring")
