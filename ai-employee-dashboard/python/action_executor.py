#!/usr/bin/env python3
"""
Action Executor
---------------
Executes approved actions automatically.
Monitors the Approved folder and processes items based on their type.

Supported action types:
- Email: Send emails via Gmail API
- Social Media: Post to LinkedIn, Twitter, Facebook, Instagram
- Generic: Move to Done folder
"""

import os
import re
import json
import shutil
import base64
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / '.env')
except ImportError:
    pass

# Optional imports for various actions
try:
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from google.auth.transport.requests import Request
    from googleapiclient.discovery import build
    GMAIL_AVAILABLE = True
except ImportError:
    GMAIL_AVAILABLE = False

try:
    import tweepy
    TWITTER_AVAILABLE = True
except ImportError:
    TWITTER_AVAILABLE = False

try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False


class ActionExecutor:
    """
    Executes approved actions based on their type.
    """

    GMAIL_SCOPES = [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.modify'
    ]

    def __init__(self, vault_path: str):
        """Initialize the action executor."""
        self.vault_path = Path(vault_path)
        self.approved_dir = self.vault_path / 'Approved'
        self.done_dir = self.vault_path / 'Done'
        self.failed_dir = self.vault_path / 'Failed'
        self.logs_dir = self.vault_path / 'Logs'

        # Ensure directories exist
        for dir_path in [self.approved_dir, self.done_dir,
                        self.failed_dir, self.logs_dir]:
            dir_path.mkdir(parents=True, exist_ok=True)

        # Track processed files
        self.processed_files = set()

        # Initialize services
        self.gmail_service = None
        self.twitter_client = None
        self.linkedin_token = os.getenv('LINKEDIN_ACCESS_TOKEN')

        # Initialize MCP client
        self.mcp_client = None
        try:
            from mcp_client import get_mcp_client
            self.mcp_client = get_mcp_client()
        except ImportError:
            print("MCP client not available - LinkedIn MCP will not be used")

        # Dry run mode
        self.dry_run = os.getenv('DRY_RUN', 'false').lower() == 'true'

        self._init_services()

    def _init_services(self):
        """Initialize external service connections."""
        # Gmail
        if GMAIL_AVAILABLE:
            try:
                self.gmail_service = self._init_gmail()
            except Exception as e:
                print(f"Gmail init failed: {e}")

        # Twitter
        if TWITTER_AVAILABLE:
            try:
                self.twitter_client = self._init_twitter()
            except Exception as e:
                print(f"Twitter init failed: {e}")

    def _init_gmail(self):
        """Initialize Gmail service."""
        creds = None
        token_path = Path(__file__).parent / 'token.json'
        credentials_path = Path(__file__).parent / 'credentials.json'

        if token_path.exists():
            creds = Credentials.from_authorized_user_file(str(token_path), self.GMAIL_SCOPES)

        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            elif credentials_path.exists():
                flow = InstalledAppFlow.from_client_secrets_file(
                    str(credentials_path), self.GMAIL_SCOPES)
                creds = flow.run_local_server(port=0)

            if creds:
                token_path.write_text(creds.to_json())

        if creds:
            return build('gmail', 'v1', credentials=creds)
        return None

    def _init_twitter(self):
        """Initialize Twitter client."""
        api_key = os.getenv('TWITTER_API_KEY')
        api_secret = os.getenv('TWITTER_API_SECRET')
        access_token = os.getenv('TWITTER_ACCESS_TOKEN')
        # Support both naming conventions
        access_secret = os.getenv('TWITTER_ACCESS_TOKEN_SECRET') or os.getenv('TWITTER_ACCESS_SECRET')
        bearer_token = os.getenv('TWITTER_BEARER_TOKEN')

        if all([api_key, api_secret, access_token, access_secret]):
            try:
                client = tweepy.Client(
                    bearer_token=bearer_token if bearer_token else None,
                    consumer_key=api_key,
                    consumer_secret=api_secret,
                    access_token=access_token,
                    access_token_secret=access_secret
                )
                print(f"Twitter client initialized successfully")
                return client
            except Exception as e:
                print(f"Twitter client init error: {e}")
                return None
        return None

    def _parse_file(self, file_path: Path) -> Dict:
        """Parse an approved file to extract action details."""
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

            # Extract sections
            sections = {}

            # To section
            to_match = re.search(r'^## To\s*\n(.+?)(?=\n##|\n---|\Z)', content, re.MULTILINE | re.DOTALL)
            if to_match:
                sections['to'] = to_match.group(1).strip()

            # Subject section
            subject_match = re.search(r'^## Subject\s*\n(.+?)(?=\n##|\n---|\Z)', content, re.MULTILINE | re.DOTALL)
            if subject_match:
                sections['subject'] = subject_match.group(1).strip()

            # Body section
            body_match = re.search(r'^## Body\s*\n(.+?)(?=\n##|\n---|\Z)', content, re.MULTILINE | re.DOTALL)
            if body_match:
                sections['body'] = body_match.group(1).strip()

            # Post content section
            post_match = re.search(r'^## Post Content\s*\n(.+?)(?=\n##|\n---|\Z)', content, re.MULTILINE | re.DOTALL)
            if post_match:
                sections['post_content'] = post_match.group(1).strip()

            # Content section (alternative)
            content_match = re.search(r'^## Content\s*\n(.+?)(?=\n##|\n---|\Z)', content, re.MULTILINE | re.DOTALL)
            if content_match:
                sections['content'] = content_match.group(1).strip()

            return {
                'metadata': metadata,
                'sections': sections,
                'raw_content': content,
                'filename': file_path.name
            }

        except Exception as e:
            return {'error': str(e), 'filename': file_path.name}

    def _determine_action_type(self, filename: str, metadata: Dict) -> str:
        """Determine the type of action to execute."""
        filename_lower = filename.lower()

        if 'email' in filename_lower or 'response' in filename_lower:
            return 'email'
        elif 'linkedin' in filename_lower:
            return 'linkedin'
        elif 'twitter' in filename_lower or 'tweet' in filename_lower:
            return 'twitter'
        elif 'facebook' in filename_lower or 'fb_' in filename_lower:
            return 'facebook'
        elif 'instagram' in filename_lower or 'ig_' in filename_lower:
            return 'instagram'
        elif 'social' in filename_lower or 'post' in filename_lower:
            return 'social'
        elif 'payment' in filename_lower:
            return 'payment'
        else:
            return 'generic'

    def process_approved_items(self) -> List[Dict]:
        """Process all approved items in the Approved folder."""
        results = []

        for file_path in self.approved_dir.glob('*.md'):
            if str(file_path) in self.processed_files:
                continue

            self.processed_files.add(str(file_path))

            try:
                parsed = self._parse_file(file_path)
                if 'error' in parsed:
                    results.append({
                        'success': False,
                        'type': 'error',
                        'message': parsed['error'],
                        'file': file_path.name
                    })
                    continue

                action_type = self._determine_action_type(
                    file_path.name,
                    parsed.get('metadata', {})
                )

                # Execute action
                result = self._execute_action(action_type, parsed, file_path)
                results.append(result)

                # Move file based on result
                if result.get('success'):
                    dest = self.done_dir / file_path.name
                else:
                    dest = self.failed_dir / file_path.name

                shutil.move(str(file_path), str(dest))

                # Log result
                self._log_action(action_type, file_path.name, result)

            except Exception as e:
                results.append({
                    'success': False,
                    'type': 'error',
                    'message': str(e),
                    'file': file_path.name
                })

        return results

    def _execute_action(self, action_type: str, parsed: Dict, file_path: Path) -> Dict:
        """Execute an action based on its type."""
        if self.dry_run:
            return {
                'success': True,
                'type': action_type,
                'message': f'[DRY RUN] Would execute {action_type}',
                'file': file_path.name
            }

        if action_type == 'email':
            return self._execute_email(parsed)
        elif action_type == 'linkedin':
            return self._execute_linkedin(parsed)
        elif action_type == 'twitter':
            return self._execute_twitter(parsed)
        elif action_type == 'facebook':
            return self._execute_facebook(parsed)
        elif action_type == 'instagram':
            return self._execute_instagram(parsed)
        elif action_type == 'social':
            return self._execute_social(parsed)
        elif action_type == 'payment':
            return self._execute_payment(parsed)
        else:
            return self._execute_generic(parsed)

    def _execute_email(self, parsed: Dict) -> Dict:
        """Execute email sending action."""
        if not self.gmail_service:
            return {
                'success': False,
                'type': 'email',
                'message': 'Gmail service not available'
            }

        try:
            metadata = parsed.get('metadata', {})
            sections = parsed.get('sections', {})

            to = sections.get('to') or metadata.get('reply_to', '')
            subject = sections.get('subject') or metadata.get('original_subject', 'No Subject')
            body = sections.get('body', '')

            # Threading fields for proper reply
            thread_id = metadata.get('thread_id', '')
            original_message_id = metadata.get('original_message_id', '')

            if not to or not body:
                return {
                    'success': False,
                    'type': 'email',
                    'message': 'Missing recipient or body'
                }

            # Ensure subject has Re: prefix for replies
            if original_message_id and not subject.lower().startswith('re:'):
                subject = f'Re: {subject}'

            # Create message with reply headers
            message = MIMEText(body)
            message['to'] = to
            message['subject'] = subject
            if original_message_id:
                message['In-Reply-To'] = original_message_id
                message['References'] = original_message_id

            raw = base64.urlsafe_b64encode(message.as_bytes()).decode('utf-8')

            # Send — include threadId to keep it in the same conversation
            send_body: Dict = {'raw': raw}
            if thread_id:
                send_body['threadId'] = thread_id

            result = self.gmail_service.users().messages().send(
                userId='me',
                body=send_body
            ).execute()

            # Send notification
            self._notify_action_complete('Email', f"Sent to {to}")

            return {
                'success': True,
                'type': 'email',
                'message': f'Email sent to {to}',
                'message_id': result.get('id')
            }

        except Exception as e:
            return {
                'success': False,
                'type': 'email',
                'message': str(e)
            }

    def _execute_linkedin(self, parsed: Dict) -> Dict:
        """Execute LinkedIn post action using MCP server."""
        try:
            sections = parsed.get('sections', {})
            content = (sections.get('post_content') or
                      sections.get('content') or
                      sections.get('body', ''))

            if not content:
                return {
                    'success': False,
                    'type': 'linkedin',
                    'message': 'No post content found'
                }

            # Extract hashtags if available
            hashtags_raw = (sections.get('hashtags', '') or
                           sections.get('hashtag', ''))

            # Parse hashtags from markdown format or plain text
            hashtags = []
            if hashtags_raw:
                # If it's in markdown format like "#Tag1 #Tag2 #Tag3"
                if isinstance(hashtags_raw, str):
                    import re
                    hashtags = re.findall(r'#(\w+)', hashtags_raw)
                elif isinstance(hashtags_raw, list):
                    hashtags = [tag.lstrip('#') for tag in hashtags_raw if tag]

            # Use MCP client to post via LinkedIn MCP server
            if hasattr(self, 'mcp_client') and self.mcp_client:
                # Call LinkedIn MCP server with proper tool
                result = self.mcp_client.call_tool('linkedin', 'linkedin_create_post', {
                    'content': content,
                    'hashtags': hashtags
                })

                if result.success:
                    self._notify_action_complete('LinkedIn', 'Post published')
                    return {
                        'success': True,
                        'type': 'linkedin',
                        'message': 'LinkedIn post published via MCP',
                        'details': result.data
                    }
                else:
                    return {
                        'success': False,
                        'type': 'linkedin',
                        'message': f'LinkedIn MCP error: {result.error}'
                    }
            else:
                # Fallback to direct API if MCP client not available
                if not self.linkedin_token or self.linkedin_token.startswith('http') or self.linkedin_token.startswith('your_'):
                    # Invalid token - simulation mode
                    return {
                        'success': True,
                        'type': 'linkedin',
                        'message': '[SIMULATED] LinkedIn MCP not configured - need valid OAuth access token'
                    }

                if self.dry_run:
                    return {
                        'success': True,
                        'type': 'linkedin',
                        'message': '[DRY RUN] LinkedIn post would be published'
                    }

                # Log that we're attempting to post
                print(f"[LinkedIn] Attempting to post with token: {self.linkedin_token[:15]}...")

                # LinkedIn API call
                headers = {
                    'Authorization': f'Bearer {self.linkedin_token}',
                    'Content-Type': 'application/json',
                    'X-Restli-Protocol-Version': '2.0.0'
                }

                # Get user URN
                profile_url = 'https://api.linkedin.com/v2/me'
                profile_response = requests.get(profile_url, headers=headers)
                if profile_response.status_code != 200:
                    return {
                        'success': False,
                        'type': 'linkedin',
                        'message': f'Could not get user profile: {profile_response.status_code}'
                    }

                user_urn = f"urn:li:person:{profile_response.json().get('id')}"

                # Create post
                post_url = 'https://api.linkedin.com/v2/ugcPosts'
                post_data = {
                    "author": user_urn,
                    "lifecycleState": "PUBLISHED",
                    "specificContent": {
                        "com.linkedin.ugc.ShareContent": {
                            "shareCommentary": {
                                "text": content
                            },
                            "shareMediaCategory": "NONE"
                        }
                    },
                    "visibility": {
                        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
                    }
                }

                response = requests.post(post_url, headers=headers, json=post_data)

                if response.status_code in [200, 201]:
                    self._notify_action_complete('LinkedIn', 'Post published')
                    return {
                        'success': True,
                        'type': 'linkedin',
                        'message': 'LinkedIn post published'
                    }
                else:
                    return {
                        'success': False,
                        'type': 'linkedin',
                        'message': f'LinkedIn API error: {response.status_code}'
                    }

        except Exception as e:
            return {
                'success': False,
                'type': 'linkedin',
                'message': f'Error executing LinkedIn post: {str(e)}'
            }

    def _execute_twitter(self, parsed: Dict) -> Dict:
        """Execute Twitter post action using Tweepy."""
        if not self.twitter_client:
            # Check if credentials exist
            api_key = os.getenv('TWITTER_API_KEY')
            if not api_key or api_key.startswith('your_'):
                return {
                    'success': True,
                    'type': 'twitter',
                    'message': '[SIMULATED] Twitter not configured - need API credentials'
                }
            return {
                'success': True,
                'type': 'twitter',
                'message': '[SIMULATED] Twitter client not initialized - check credentials'
            }

        if self.dry_run:
            return {
                'success': True,
                'type': 'twitter',
                'message': '[DRY RUN] Tweet would be posted'
            }

        try:
            sections = parsed.get('sections', {})
            content = (sections.get('post_content') or
                      sections.get('content') or
                      sections.get('body', ''))[:280]

            if not content:
                return {
                    'success': False,
                    'type': 'twitter',
                    'message': 'No tweet content found'
                }

            response = self.twitter_client.create_tweet(text=content)

            self._notify_action_complete('Twitter', 'Tweet posted')

            return {
                'success': True,
                'type': 'twitter',
                'message': 'Tweet posted',
                'tweet_id': response.data.get('id')
            }

        except Exception as e:
            return {
                'success': False,
                'type': 'twitter',
                'message': str(e)
            }

    def _execute_facebook(self, parsed: Dict) -> Dict:
        """Execute Facebook post action via Graph API."""
        fb_access_token = os.getenv('FACEBOOK_ACCESS_TOKEN')
        fb_page_id = os.getenv('FACEBOOK_PAGE_ID')

        if not fb_access_token or fb_access_token.startswith('your_'):
            return {
                'success': True,
                'type': 'facebook',
                'message': '[SIMULATED] Facebook not configured - post would be published'
            }

        if self.dry_run:
            return {
                'success': True,
                'type': 'facebook',
                'message': '[DRY RUN] Facebook post would be published'
            }

        content = parsed.get('body', parsed.get('content', ''))
        if not content:
            return {'success': False, 'type': 'facebook', 'message': 'No content to post'}

        try:
            import requests
            url = f"https://graph.facebook.com/v18.0/{fb_page_id}/feed"
            response = requests.post(url, data={
                'message': content,
                'access_token': fb_access_token
            })

            if response.status_code == 200:
                self._notify_action_complete('Facebook', 'Post published')
                return {
                    'success': True,
                    'type': 'facebook',
                    'message': 'Facebook post published',
                    'post_id': response.json().get('id')
                }
            else:
                return {
                    'success': False,
                    'type': 'facebook',
                    'message': f'Facebook API error: {response.status_code}'
                }
        except Exception as e:
            return {'success': False, 'type': 'facebook', 'message': str(e)}

    def _execute_instagram(self, parsed: Dict) -> Dict:
        """Execute Instagram post action via Graph API."""
        ig_access_token = os.getenv('INSTAGRAM_ACCESS_TOKEN')
        ig_account_id = os.getenv('INSTAGRAM_BUSINESS_ACCOUNT_ID') or os.getenv('INSTAGRAM_ACCOUNT_ID')

        if not ig_access_token or ig_access_token.startswith('your_'):
            return {
                'success': True,
                'type': 'instagram',
                'message': '[SIMULATED] Instagram not configured - post would be published'
            }

        if self.dry_run:
            return {
                'success': True,
                'type': 'instagram',
                'message': '[DRY RUN] Instagram post would be published'
            }

        caption = parsed.get('body', parsed.get('content', ''))
        image_url = parsed.get('metadata', {}).get('image_url')

        if not caption or not image_url:
            return {
                'success': True,
                'type': 'instagram',
                'message': '[SIMULATED] Instagram requires image_url in metadata'
            }

        try:
            import requests
            # Step 1: Create media container
            container_url = f"https://graph.facebook.com/v18.0/{ig_account_id}/media"
            container_response = requests.post(container_url, data={
                'image_url': image_url,
                'caption': caption,
                'access_token': ig_access_token
            })

            if container_response.status_code != 200:
                return {
                    'success': False,
                    'type': 'instagram',
                    'message': f'Container creation failed: {container_response.status_code}'
                }

            creation_id = container_response.json().get('id')

            # Step 2: Publish the container
            publish_url = f"https://graph.facebook.com/v18.0/{ig_account_id}/media_publish"
            publish_response = requests.post(publish_url, data={
                'creation_id': creation_id,
                'access_token': ig_access_token
            })

            if publish_response.status_code == 200:
                self._notify_action_complete('Instagram', 'Post published')
                return {
                    'success': True,
                    'type': 'instagram',
                    'message': 'Instagram post published',
                    'media_id': publish_response.json().get('id')
                }
            else:
                return {
                    'success': False,
                    'type': 'instagram',
                    'message': f'Publish failed: {publish_response.status_code}'
                }
        except Exception as e:
            return {'success': False, 'type': 'instagram', 'message': str(e)}

    def _execute_social(self, parsed: Dict) -> Dict:
        """Execute generic social media post action."""
        metadata = parsed.get('metadata', {})
        platform = metadata.get('platform', 'unknown')

        if platform == 'linkedin':
            return self._execute_linkedin(parsed)
        elif platform == 'twitter':
            return self._execute_twitter(parsed)
        elif platform == 'facebook':
            return self._execute_facebook(parsed)
        elif platform == 'instagram':
            return self._execute_instagram(parsed)
        else:
            return {
                'success': True,
                'type': 'social',
                'message': f'[SIMULATED] {platform} post would be published'
            }

    def _execute_payment(self, parsed: Dict) -> Dict:
        """Execute payment action - always requires additional verification."""
        return {
            'success': False,
            'type': 'payment',
            'message': 'Payment execution requires manual processing for security'
        }

    def _execute_generic(self, parsed: Dict) -> Dict:
        """Execute generic action (just mark as done)."""
        return {
            'success': True,
            'type': 'generic',
            'message': 'Action marked as complete'
        }

    def _notify_action_complete(self, action_type: str, summary: str):
        """Send notification that action was completed."""
        try:
            from notification_hub import NotificationHub
            hub = NotificationHub(str(self.vault_path))
            hub.notify_action_completed(action_type, summary)
        except Exception as e:
            print(f"Notification failed: {e}")

    def _log_action(self, action_type: str, filename: str, result: Dict):
        """Log action execution."""
        log_file = self.logs_dir / f'actions_{datetime.now().strftime("%Y-%m-%d")}.json'

        entry = {
            'timestamp': datetime.now().isoformat(),
            'action_type': action_type,
            'filename': filename,
            'success': result.get('success', False),
            'message': result.get('message', '')
        }

        try:
            logs = []
            if log_file.exists():
                logs = json.loads(log_file.read_text())
            logs.append(entry)
            log_file.write_text(json.dumps(logs, indent=2))
        except:
            pass


def run_executor(vault_path: str, interval: int = 10):
    """Run the action executor continuously."""
    import time

    executor = ActionExecutor(vault_path)

    print("=" * 60)
    print("Action Executor Started")
    print("=" * 60)
    print(f"Vault: {vault_path}")
    print(f"Check interval: {interval}s")
    print(f"Dry run: {executor.dry_run}")
    print("=" * 60)

    try:
        while True:
            results = executor.process_approved_items()
            for result in results:
                status = "OK" if result.get('success') else "FAIL"
                print(f"[{datetime.now().strftime('%H:%M:%S')}] [{status}] {result['type']}: {result['message']}")

            time.sleep(interval)

    except KeyboardInterrupt:
        print("\nAction executor stopped.")


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Action Executor')
    parser.add_argument('--vault', default='./AI_Employee_Vault', help='Vault path')
    parser.add_argument('--interval', type=int, default=10, help='Check interval')
    parser.add_argument('--dry-run', action='store_true', help='Dry run mode')
    parser.add_argument('--once', action='store_true', help='Run once and exit')

    args = parser.parse_args()

    if args.dry_run:
        os.environ['DRY_RUN'] = 'true'

    if args.once:
        executor = ActionExecutor(args.vault)
        results = executor.process_approved_items()
        for result in results:
            print(f"{result['type']}: {result['message']}")
    else:
        run_executor(args.vault, args.interval)
