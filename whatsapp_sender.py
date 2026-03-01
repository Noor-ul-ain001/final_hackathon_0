#!/usr/bin/env python3
"""
WhatsApp Sender - Multiple API Support
--------------------------------------
Supports multiple WhatsApp APIs for sending notifications:
1. CallMeBot - Free, easiest setup
2. UltraMsg - Simple REST API
3. Green API - Good free tier
4. Twilio - Enterprise (existing)

Setup Instructions:
-------------------

OPTION 1: CallMeBot (Recommended - FREE)
1. Save this number in your phone: +34 644 71 99 23
2. Send this WhatsApp message to it: "I allow callmebot to send me messages"
3. You'll receive an API key
4. Set in .env:
   WHATSAPP_API=callmebot
   CALLMEBOT_PHONE=your_phone_number (e.g., 923147971082, no + sign)
   CALLMEBOT_APIKEY=your_api_key

OPTION 2: UltraMsg (Free trial)
1. Sign up at: https://ultramsg.com
2. Create an instance and connect your WhatsApp
3. Set in .env:
   WHATSAPP_API=ultramsg
   ULTRAMSG_INSTANCE=your_instance_id
   ULTRAMSG_TOKEN=your_token
   ULTRAMSG_TO=recipient_phone (e.g., 923147971082)

OPTION 3: Green API (Free tier)
1. Sign up at: https://green-api.com
2. Create an instance and scan QR code
3. Set in .env:
   WHATSAPP_API=greenapi
   GREENAPI_INSTANCE=your_instance_id
   GREENAPI_TOKEN=your_token
   GREENAPI_TO=recipient_phone@c.us (e.g., 923147971082@c.us)
"""

import os
import requests
import urllib.parse
from datetime import datetime
from pathlib import Path
from typing import Optional

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / '.env')
except ImportError:
    pass


class WhatsAppSender:
    """
    Universal WhatsApp sender supporting multiple APIs.
    """

    def __init__(self):
        """Initialize based on configured API."""
        self.api = os.getenv('WHATSAPP_API', 'callmebot').lower()
        self.last_error = None

        # CallMeBot config
        self.callmebot_phone = os.getenv('CALLMEBOT_PHONE', '')
        self.callmebot_apikey = os.getenv('CALLMEBOT_APIKEY', '')

        # UltraMsg config
        self.ultramsg_instance = os.getenv('ULTRAMSG_INSTANCE', '')
        self.ultramsg_token = os.getenv('ULTRAMSG_TOKEN', '')
        self.ultramsg_to = os.getenv('ULTRAMSG_TO', '')

        # Green API config
        self.greenapi_instance = os.getenv('GREENAPI_INSTANCE', '')
        self.greenapi_token = os.getenv('GREENAPI_TOKEN', '')
        self.greenapi_to = os.getenv('GREENAPI_TO', '')

        # Twilio config (fallback)
        self.twilio_sid = os.getenv('TWILIO_ACCOUNT_SID', '')
        self.twilio_token = os.getenv('TWILIO_AUTH_TOKEN', '')
        self.twilio_from = os.getenv('TWILIO_WHATSAPP_FROM', '')
        self.twilio_to = os.getenv('WHATSAPP_TO', '')

    def send(self, message: str) -> bool:
        """
        Send WhatsApp message using configured API.

        Args:
            message: Text message to send

        Returns:
            True if successful, False otherwise
        """
        if self.api == 'callmebot':
            return self._send_callmebot(message)
        elif self.api == 'ultramsg':
            return self._send_ultramsg(message)
        elif self.api == 'greenapi':
            return self._send_greenapi(message)
        elif self.api == 'twilio':
            return self._send_twilio(message)
        else:
            # Try CallMeBot as default
            return self._send_callmebot(message)

    def _send_callmebot(self, message: str) -> bool:
        """Send via CallMeBot API (FREE)."""
        if not self.callmebot_phone or not self.callmebot_apikey:
            self.last_error = "CallMeBot not configured. Set CALLMEBOT_PHONE and CALLMEBOT_APIKEY"
            print(f"[WhatsApp] {self.last_error}")
            return False

        try:
            # URL encode the message
            encoded_message = urllib.parse.quote(message)

            url = f"https://api.callmebot.com/whatsapp.php?phone={self.callmebot_phone}&text={encoded_message}&apikey={self.callmebot_apikey}"

            response = requests.get(url, timeout=30)

            if response.status_code == 200 and 'Message queued' in response.text:
                print(f"[WhatsApp] Message sent via CallMeBot")
                return True
            else:
                self.last_error = f"CallMeBot error: {response.text}"
                print(f"[WhatsApp] {self.last_error}")
                return False

        except Exception as e:
            self.last_error = str(e)
            print(f"[WhatsApp] Error: {e}")
            return False

    def _send_ultramsg(self, message: str) -> bool:
        """Send via UltraMsg API."""
        if not self.ultramsg_instance or not self.ultramsg_token:
            self.last_error = "UltraMsg not configured"
            return False

        try:
            url = f"https://api.ultramsg.com/{self.ultramsg_instance}/messages/chat?token={self.ultramsg_token}"

            # Use the number as-is if it's a group ID (@g.us) or already has +
            to = self.ultramsg_to
            if '@' not in to and not to.startswith('+'):
                to = f"+{to}"
            payload = {
                "to": to,
                "body": message
            }

            headers = {
                "Content-Type": "application/x-www-form-urlencoded"
            }

            response = requests.post(url, data=payload, headers=headers, timeout=30)
            result = response.json()

            if result.get('sent') == 'true' or result.get('sent') == True or result.get('id'):
                print(f"[WhatsApp] Message sent via UltraMsg")
                return True
            else:
                self.last_error = f"UltraMsg error: {result}"
                print(f"[WhatsApp] {self.last_error}")
                return False

        except Exception as e:
            self.last_error = str(e)
            print(f"[WhatsApp] Error: {e}")
            return False

    def _send_greenapi(self, message: str) -> bool:
        """Send via Green API."""
        if not self.greenapi_instance or not self.greenapi_token:
            self.last_error = "Green API not configured"
            return False

        try:
            url = f"https://api.green-api.com/waInstance{self.greenapi_instance}/sendMessage/{self.greenapi_token}"

            payload = {
                "chatId": self.greenapi_to,
                "message": message
            }

            response = requests.post(url, json=payload, timeout=30)
            result = response.json()

            if result.get('idMessage'):
                print(f"[WhatsApp] Message sent via Green API")
                return True
            else:
                self.last_error = f"Green API error: {result}"
                print(f"[WhatsApp] {self.last_error}")
                return False

        except Exception as e:
            self.last_error = str(e)
            print(f"[WhatsApp] Error: {e}")
            return False

    def _send_twilio(self, message: str) -> bool:
        """Send via Twilio (requires sandbox setup)."""
        if not self.twilio_sid or not self.twilio_token:
            self.last_error = "Twilio not configured"
            return False

        try:
            from twilio.rest import Client
            client = Client(self.twilio_sid, self.twilio_token)

            msg = client.messages.create(
                body=message,
                from_=self.twilio_from,
                to=self.twilio_to
            )

            print(f"[WhatsApp] Message sent via Twilio: {msg.sid}")
            return True

        except Exception as e:
            self.last_error = str(e)
            print(f"[WhatsApp] Twilio error: {e}")
            return False

    def send_approval_request(self, item_type: str, summary: str, code: str) -> bool:
        """Send formatted approval request."""
        message = f"""*Approval Required*

*{item_type}*: {summary}

Code: *{code}*

Reply:
• approve {code}
• reject {code}

Or just reply "{code}" to approve."""

        return self.send(message)

    def send_action_completed(self, action_type: str, summary: str) -> bool:
        """Send action completed notification."""
        timestamp = datetime.now().strftime('%H:%M')
        message = f"""*{action_type} Completed*

{summary}

Completed at {timestamp}"""

        return self.send(message)

    def send_test(self) -> bool:
        """Send test notification."""
        message = f"""*AI Employee Test*

Your WhatsApp notification is working!

API: {self.api}
Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

Reply "help" for commands."""

        return self.send(message)

    def get_setup_instructions(self) -> str:
        """Return setup instructions for the easiest API."""
        return """
========================================
WhatsApp Setup - CallMeBot (FREE)
========================================

1. Save this number in your contacts:
   +34 644 71 99 23

2. Send this WhatsApp message to it:
   "I allow callmebot to send me messages"

3. You'll receive your API key in the reply

4. Add to your .env file:
   WHATSAPP_API=callmebot
   CALLMEBOT_PHONE=923147971082  (your number, no + sign)
   CALLMEBOT_APIKEY=123456       (your API key)

5. Test with:
   python whatsapp_sender.py --test

========================================
"""


def test_whatsapp():
    """Test WhatsApp sending."""
    sender = WhatsAppSender()

    print("=" * 50)
    print("WhatsApp Sender Test")
    print("=" * 50)
    print(f"API: {sender.api}")
    print()

    # Check configuration
    if sender.api == 'callmebot':
        if not sender.callmebot_phone or not sender.callmebot_apikey:
            print("CallMeBot not configured!")
            print(sender.get_setup_instructions())
            return
        print(f"Phone: {sender.callmebot_phone}")
        print(f"API Key: {sender.callmebot_apikey[:4]}...")

    print()
    print("Sending test message...")
    result = sender.send_test()

    if result:
        print("\n[OK] SUCCESS! Check your WhatsApp.")
    else:
        print(f"\n[FAILED]: {sender.last_error}")
        print(sender.get_setup_instructions())


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='WhatsApp Sender')
    parser.add_argument('--test', action='store_true', help='Send test message')
    parser.add_argument('--setup', action='store_true', help='Show setup instructions')
    parser.add_argument('--message', '-m', type=str, help='Send custom message')

    args = parser.parse_args()

    sender = WhatsAppSender()

    if args.setup:
        print(sender.get_setup_instructions())
    elif args.message:
        result = sender.send(args.message)
        print("Sent!" if result else f"Failed: {sender.last_error}")
    else:
        test_whatsapp()
