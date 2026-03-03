#!/usr/bin/env python3
"""
WhatsApp Notification System

Sends WhatsApp notifications when:
1. New email arrives and is placed in Needs_Action
2. Draft response is ready in Pending_Approval

Supports UltraMsg API (primary) and Twilio (fallback)
"""

import os
import requests
from datetime import datetime
from pathlib import Path

try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent / '.env'
    load_dotenv(env_path)
except ImportError:
    print("WARNING: python-dotenv not installed. Using system environment variables.")

# UltraMsg Configuration (Primary)
ULTRAMSG_INSTANCE = os.getenv('ULTRAMSG_INSTANCE')
ULTRAMSG_TOKEN = os.getenv('ULTRAMSG_TOKEN')
ULTRAMSG_TO = os.getenv('ULTRAMSG_TO')

# Twilio Configuration (Fallback)
TWILIO_ACCOUNT_SID = os.getenv('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.getenv('TWILIO_AUTH_TOKEN')
TWILIO_WHATSAPP_FROM = os.getenv('TWILIO_WHATSAPP_FROM', 'whatsapp:+14155238886')
WHATSAPP_TO = os.getenv('WHATSAPP_TO')


class WhatsAppNotifier:
    """Send WhatsApp notifications via UltraMsg or Twilio"""

    def __init__(self):
        """Initialize WhatsApp client"""
        self.use_ultramsg = bool(ULTRAMSG_INSTANCE and ULTRAMSG_TOKEN and ULTRAMSG_TO)
        self.use_twilio = bool(TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and WHATSAPP_TO)
        self.twilio_client = None

        if not self.use_ultramsg and not self.use_twilio:
            raise ValueError(
                "No WhatsApp service configured. Set either UltraMsg or Twilio credentials in .env"
            )

        if self.use_ultramsg:
            print(f"Using UltraMsg (Instance: {ULTRAMSG_INSTANCE})")
            self.api_url = f"https://api.ultramsg.com/{ULTRAMSG_INSTANCE}/messages/chat"

        if self.use_twilio:
            if not self.use_ultramsg:
                print("Using Twilio WhatsApp")
            from twilio.rest import Client
            self.twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

    def send_notification(self, message):
        """Send WhatsApp message - tries UltraMsg first, falls back to Twilio"""
        try:
            if self.use_ultramsg:
                result = self._send_ultramsg(message)
                if result:
                    return True
                # UltraMsg failed - fall back to Twilio if available
                if self.use_twilio:
                    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] UltraMsg failed, trying Twilio...")
                    return self._send_twilio(message)
                return False
            elif self.use_twilio:
                return self._send_twilio(message)
            return False
        except Exception as e:
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] WhatsApp error: {e}")
            return False

    def _send_ultramsg(self, message):
        """Send via UltraMsg API"""
        payload = {
            "token": ULTRAMSG_TOKEN,
            "to": ULTRAMSG_TO,
            "body": message
        }

        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        response = requests.post(self.api_url, data=payload, headers=headers)

        if response.status_code == 200:
            result = response.json()
            if result.get('sent') == 'true' or result.get('sent') == True:
                print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] WhatsApp sent via UltraMsg")
                return True
            else:
                print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] UltraMsg response: {result}")
                return False
        else:
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] UltraMsg HTTP {response.status_code}")
            return False

    def _send_twilio(self, message):
        """Send via Twilio WhatsApp"""
        msg = self.twilio_client.messages.create(
            body=message,
            from_=TWILIO_WHATSAPP_FROM,
            to=WHATSAPP_TO
        )
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] WhatsApp sent via Twilio: {msg.sid}")
        return True

    def notify_new_email(self, sender, subject):
        """Notify about new email"""
        message = f"""🔔 *New Email Received*

From: {sender}
Subject: {subject}

Claude is analyzing this email and will draft a response shortly.

Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"""

        return self.send_notification(message)

    def notify_approval_needed(self, sender, subject):
        """Notify that draft response needs approval"""
        message = f"""✅ *Response Draft Ready - Approval Needed*

Original Email:
From: {sender}
Subject: {subject}

A draft response has been created and is waiting for your approval.

*Action Required:*
- Review the draft at: /Pending_Approval
- Approve via Dashboard or move to /Approved
- Or modify/reject as needed

Dashboard: http://localhost:3000/approvals

Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"""

        return self.send_notification(message)

    def notify_email_sent(self, recipient, subject):
        """Notify that email was sent"""
        message = f"""📧 *Email Sent Successfully*

To: {recipient}
Subject: {subject}

The approved response has been sent.

Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"""

        return self.send_notification(message)


def test_notification():
    """Test WhatsApp notification"""
    print("=" * 60)
    print("WhatsApp Notification Test")
    print("=" * 60)

    try:
        notifier = WhatsAppNotifier()
        print(f"\nSending test notification...")

        message = f"""🤖 *AI Employee System Test*

This is a test notification from your AI Employee system.

If you received this, WhatsApp notifications are working correctly!

Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"""

        success = notifier.send_notification(message)

        if success:
            print("\n[OK] Test notification sent successfully!")
            print("Check your WhatsApp for the message.")
        else:
            print("\n[FAILED] Failed to send test notification")

    except ValueError as e:
        print(f"\n[ERROR] Configuration error: {e}")
        print("\nSetup instructions:")
        print("1. For UltraMsg: https://ultramsg.com")
        print("   Set: ULTRAMSG_INSTANCE, ULTRAMSG_TOKEN, ULTRAMSG_TO")
        print("2. For Twilio: https://www.twilio.com/try-twilio")
        print("   Set: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, WHATSAPP_TO")
    except Exception as e:
        print(f"\n✗ Error: {e}")


if __name__ == "__main__":
    test_notification()
