#!/usr/bin/env python3
"""
Social Media Poster
-------------------
Unified interface for posting to LinkedIn and X (Twitter).

This module provides a simple, consistent API for posting content
to social media platforms. It uses the MCP servers when available
and falls back to direct API calls.

Usage:
    # As a module
    from social_poster import SocialPoster
    poster = SocialPoster()

    # Post to LinkedIn
    result = poster.post_to_linkedin("Your professional content here", hashtags=["AI", "Tech"])

    # Post to X/Twitter
    result = poster.post_to_x("Your tweet here (max 280 chars)")

    # Post to both platforms
    results = poster.post_to_all("Content for both platforms")

    # CLI usage
    python social_poster.py --platform linkedin --content "Your post content"
    python social_poster.py --platform x --content "Your tweet"
    python social_poster.py --platform all --content "Post to both"
"""

import os
import json
import requests
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
import logging

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / '.env')
except ImportError:
    pass

# Optional imports
try:
    import tweepy
    TWEEPY_AVAILABLE = True
except ImportError:
    TWEEPY_AVAILABLE = False

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('SocialPoster')


@dataclass
class PostResult:
    """Result of a social media post."""
    success: bool
    platform: str
    post_id: Optional[str] = None
    url: Optional[str] = None
    message: str = ""
    error: Optional[str] = None
    simulated: bool = False
    timestamp: str = ""

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now().isoformat()

    def to_dict(self) -> Dict:
        return {
            'success': self.success,
            'platform': self.platform,
            'post_id': self.post_id,
            'url': self.url,
            'message': self.message,
            'error': self.error,
            'simulated': self.simulated,
            'timestamp': self.timestamp
        }


class SocialPoster:
    """
    Unified social media posting interface for LinkedIn and X/Twitter.

    Features:
    - Posts to LinkedIn (up to 3000 characters)
    - Posts to X/Twitter (up to 280 characters)
    - Automatic hashtag formatting
    - MCP server integration
    - Direct API fallback
    - Dry run mode for testing
    - Comprehensive logging
    """

    def __init__(self, vault_path: str = None, dry_run: bool = None):
        """
        Initialize the social poster.

        Args:
            vault_path: Path to Obsidian vault for logging
            dry_run: If True, simulates posts without actually posting
        """
        self.vault_path = Path(vault_path) if vault_path else Path(__file__).parent / 'AI_Employee_Vault'
        self.logs_dir = self.vault_path / 'Logs'
        self.logs_dir.mkdir(parents=True, exist_ok=True)

        # Dry run mode
        if dry_run is not None:
            self.dry_run = dry_run
        else:
            self.dry_run = os.getenv('DRY_RUN', 'false').lower() == 'true'

        # Load credentials
        self._load_credentials()

        # Initialize clients
        self.twitter_client = None
        self.mcp_client = None

        self._init_clients()

        logger.info(f"SocialPoster initialized (dry_run={self.dry_run})")

    def _load_credentials(self):
        """Load social media credentials from environment."""
        # LinkedIn
        self.linkedin_token = os.getenv('LINKEDIN_ACCESS_TOKEN')
        self.linkedin_person_id = os.getenv('LINKEDIN_PERSON_ID') or os.getenv('LINKEDIN_USER_ID')

        # Twitter/X
        self.twitter_api_key = os.getenv('TWITTER_API_KEY')
        self.twitter_api_secret = os.getenv('TWITTER_API_SECRET')
        self.twitter_access_token = os.getenv('TWITTER_ACCESS_TOKEN')
        self.twitter_access_secret = os.getenv('TWITTER_ACCESS_SECRET') or os.getenv('TWITTER_ACCESS_TOKEN_SECRET')
        self.twitter_bearer_token = os.getenv('TWITTER_BEARER_TOKEN')

    def _init_clients(self):
        """Initialize API clients."""
        # Initialize Twitter client
        # Check if access token looks like a bearer token (wrong config)
        if self.twitter_access_token and self.twitter_access_token.startswith('AAAA'):
            logger.warning("TWITTER_ACCESS_TOKEN appears to be a bearer token. User access tokens are required for posting.")
            logger.warning("Get user access tokens from Twitter Developer Portal -> Keys and tokens -> Access Token and Secret")
            self.twitter_client = None
        elif TWEEPY_AVAILABLE and all([
            self.twitter_api_key,
            self.twitter_api_secret,
            self.twitter_access_token,
            self.twitter_access_secret
        ]) and not self._is_placeholder(self.twitter_api_key):
            try:
                # URL decode tokens if needed
                import urllib.parse
                access_token = urllib.parse.unquote(self.twitter_access_token)
                access_secret = urllib.parse.unquote(self.twitter_access_secret)
                bearer = urllib.parse.unquote(self.twitter_bearer_token) if self.twitter_bearer_token else None

                self.twitter_client = tweepy.Client(
                    bearer_token=bearer,
                    consumer_key=self.twitter_api_key,
                    consumer_secret=self.twitter_api_secret,
                    access_token=access_token,
                    access_token_secret=access_secret
                )
                logger.info("Twitter client initialized")
            except Exception as e:
                logger.warning(f"Twitter client init failed: {e}")

        # Initialize MCP client
        try:
            from mcp_client import get_mcp_client
            self.mcp_client = get_mcp_client()
            logger.info("MCP client initialized")
        except ImportError:
            logger.info("MCP client not available")

    def _is_placeholder(self, value: str) -> bool:
        """Check if a value is a placeholder."""
        if not value:
            return True
        placeholders = ['your_', 'placeholder', 'xxx', 'changeme', 'todo']
        return any(p in value.lower() for p in placeholders)

    # ==================== LinkedIn Posting ====================

    def post_to_linkedin(
        self,
        content: str,
        hashtags: List[str] = None,
        visibility: str = "PUBLIC"
    ) -> PostResult:
        """
        Post content to LinkedIn.

        Args:
            content: Post content (max 3000 characters)
            hashtags: List of hashtags (without # symbol)
            visibility: "PUBLIC" or "CONNECTIONS"

        Returns:
            PostResult with success status and details
        """
        # Validate content
        if not content:
            return PostResult(
                success=False,
                platform="linkedin",
                error="Content cannot be empty"
            )

        # Format hashtags
        full_content = content
        if hashtags:
            formatted_hashtags = ' '.join([f"#{tag.lstrip('#')}" for tag in hashtags[:5]])
            full_content = f"{content}\n\n{formatted_hashtags}"

        if len(full_content) > 3000:
            return PostResult(
                success=False,
                platform="linkedin",
                error=f"Content exceeds 3000 characters ({len(full_content)} chars)"
            )

        # Dry run mode
        if self.dry_run:
            result = PostResult(
                success=True,
                platform="linkedin",
                post_id=f"DRY_{datetime.now().strftime('%Y%m%d%H%M%S')}",
                message=f"[DRY RUN] Would post to LinkedIn ({len(full_content)} chars)",
                simulated=True
            )
            self._log_post(result, full_content)
            return result

        # Use direct API (skip MCP as it may simulate)
        return self._post_linkedin_direct(full_content, visibility)

    def _post_linkedin_direct(self, content: str, visibility: str) -> PostResult:
        """Post to LinkedIn using direct API calls (UGC Posts API)."""
        if not self.linkedin_token or self._is_placeholder(self.linkedin_token):
            return PostResult(
                success=True,
                platform="linkedin",
                message="[SIMULATED] LinkedIn credentials not configured",
                simulated=True
            )

        try:
            headers = {
                'Authorization': f'Bearer {self.linkedin_token}',
                'Content-Type': 'application/json',
                'X-Restli-Protocol-Version': '2.0.0'
            }

            # Get user URN
            person_urn = None
            if self.linkedin_person_id:
                person_urn = f"urn:li:person:{self.linkedin_person_id}"
            else:
                # Try to get from userinfo endpoint
                try:
                    userinfo_response = requests.get(
                        'https://api.linkedin.com/v2/userinfo',
                        headers=headers,
                        timeout=10
                    )
                    if userinfo_response.ok:
                        user_data = userinfo_response.json()
                        person_urn = f"urn:li:person:{user_data.get('sub')}"
                except:
                    pass

                # Try /v2/me as fallback
                if not person_urn:
                    try:
                        me_response = requests.get(
                            'https://api.linkedin.com/v2/me',
                            headers=headers,
                            timeout=10
                        )
                        if me_response.ok:
                            me_data = me_response.json()
                            person_urn = f"urn:li:person:{me_data.get('id')}"
                    except:
                        pass

            if not person_urn:
                return PostResult(
                    success=False,
                    platform="linkedin",
                    error="Could not determine LinkedIn user ID. Set LINKEDIN_PERSON_ID in .env"
                )

            # Use UGC Posts API (most reliable)
            logger.info(f"Posting to LinkedIn UGC API with URN: {person_urn}")
            ugc_body = {
                "author": person_urn,
                "lifecycleState": "PUBLISHED",
                "specificContent": {
                    "com.linkedin.ugc.ShareContent": {
                        "shareCommentary": {"text": content},
                        "shareMediaCategory": "NONE"
                    }
                },
                "visibility": {
                    "com.linkedin.ugc.MemberNetworkVisibility": visibility
                }
            }

            ugc_response = requests.post(
                'https://api.linkedin.com/v2/ugcPosts',
                headers=headers,
                json=ugc_body,
                timeout=30
            )
            logger.info(f"LinkedIn UGC API response: {ugc_response.status_code}")

            if ugc_response.ok or ugc_response.status_code == 201:
                post_id = ugc_response.headers.get('x-restli-id', f"ugc_{datetime.now().strftime('%Y%m%d%H%M%S')}")
                result = PostResult(
                    success=True,
                    platform="linkedin",
                    post_id=post_id,
                    url=f"https://www.linkedin.com/feed/update/{post_id}",
                    message="Posted to LinkedIn successfully"
                )
                self._log_post(result, content)
                return result

            # UGC API failed - provide detailed error
            logger.error(f"LinkedIn UGC API failed: {ugc_response.status_code} - {ugc_response.text[:200]}")
            return PostResult(
                success=False,
                platform="linkedin",
                error=f"LinkedIn API error ({ugc_response.status_code}): {ugc_response.text[:200]}. Check if access token has w_member_social permission."
            )

        except requests.exceptions.Timeout:
            return PostResult(
                success=False,
                platform="linkedin",
                error="LinkedIn API request timed out"
            )
        except Exception as e:
            return PostResult(
                success=False,
                platform="linkedin",
                error=str(e)
            )

    # ==================== X/Twitter Posting ====================

    def post_to_x(
        self,
        content: str,
        reply_to_id: str = None,
        quote_tweet_id: str = None
    ) -> PostResult:
        """
        Post content to X (Twitter).

        Args:
            content: Tweet content (max 280 characters)
            reply_to_id: Optional tweet ID to reply to
            quote_tweet_id: Optional tweet ID to quote

        Returns:
            PostResult with success status and details
        """
        # Validate content
        if not content:
            return PostResult(
                success=False,
                platform="x",
                error="Content cannot be empty"
            )

        if len(content) > 280:
            return PostResult(
                success=False,
                platform="x",
                error=f"Tweet exceeds 280 characters ({len(content)} chars)"
            )

        # Dry run mode
        if self.dry_run:
            result = PostResult(
                success=True,
                platform="x",
                post_id=f"DRY_{datetime.now().strftime('%Y%m%d%H%M%S')}",
                message=f"[DRY RUN] Would post to X ({len(content)} chars)",
                simulated=True
            )
            self._log_post(result, content)
            return result

        # Use Tweepy directly (skip MCP as it simulates)
        return self._post_x_tweepy(content, reply_to_id, quote_tweet_id)

    def _post_x_tweepy(self, content: str, reply_to_id: str = None, quote_tweet_id: str = None) -> PostResult:
        """Post to X using Tweepy."""
        if not self.twitter_client:
            if not self.twitter_api_key or self._is_placeholder(self.twitter_api_key):
                return PostResult(
                    success=True,
                    platform="x",
                    message="[SIMULATED] Twitter API credentials not configured. Set TWITTER_API_KEY in .env",
                    simulated=True
                )
            # Check for bearer token being used as access token
            if self.twitter_access_token and self.twitter_access_token.startswith('AAAA'):
                return PostResult(
                    success=True,
                    platform="x",
                    message="[SIMULATED] TWITTER_ACCESS_TOKEN is a bearer token. Get user access tokens from Twitter Developer Portal for posting.",
                    simulated=True
                )
            return PostResult(
                success=False,
                platform="x",
                error="Twitter client not initialized. Check credentials in .env file."
            )

        try:
            tweet_params = {'text': content}

            if reply_to_id:
                tweet_params['in_reply_to_tweet_id'] = reply_to_id

            if quote_tweet_id:
                tweet_params['quote_tweet_id'] = quote_tweet_id

            response = self.twitter_client.create_tweet(**tweet_params)

            tweet_id = response.data['id']
            result = PostResult(
                success=True,
                platform="x",
                post_id=tweet_id,
                url=f"https://twitter.com/i/web/status/{tweet_id}",
                message="Posted to X successfully"
            )
            self._log_post(result, content)
            return result

        except tweepy.errors.Forbidden as e:
            error_msg = str(e)
            if '402' in error_msg or 'Payment Required' in error_msg or 'credits' in error_msg.lower():
                return PostResult(
                    success=False,
                    platform="x",
                    error="Twitter API requires payment. Your free tier credits may be exhausted. Visit developer.twitter.com to check your API plan."
                )
            return PostResult(
                success=False,
                platform="x",
                error=f"Twitter API forbidden: {e}. Check app permissions."
            )
        except tweepy.errors.Unauthorized as e:
            return PostResult(
                success=False,
                platform="x",
                error=f"Twitter API unauthorized: {e}. Check credentials."
            )
        except Exception as e:
            error_msg = str(e)
            if '402' in error_msg or 'Payment Required' in error_msg or 'credits' in error_msg.lower():
                return PostResult(
                    success=False,
                    platform="x",
                    error="Twitter API requires payment. Your free tier credits may be exhausted. Visit developer.twitter.com to check your API plan."
                )
            return PostResult(
                success=False,
                platform="x",
                error=str(e)
            )

    # ==================== Multi-Platform Posting ====================

    def post_to_all(
        self,
        content: str,
        linkedin_content: str = None,
        x_content: str = None,
        hashtags: List[str] = None
    ) -> Dict[str, PostResult]:
        """
        Post to all platforms (LinkedIn and X).

        Args:
            content: Default content for all platforms
            linkedin_content: Override content for LinkedIn (optional)
            x_content: Override content for X (optional, will be truncated to 280 chars)
            hashtags: Hashtags for LinkedIn

        Returns:
            Dictionary with platform names as keys and PostResults as values
        """
        results = {}

        # Post to LinkedIn
        li_content = linkedin_content or content
        results['linkedin'] = self.post_to_linkedin(li_content, hashtags=hashtags)

        # Post to X (truncate if needed)
        x_post_content = x_content or content
        if len(x_post_content) > 280:
            x_post_content = x_post_content[:277] + "..."
        results['x'] = self.post_to_x(x_post_content)

        return results

    # ==================== Logging ====================

    def _log_post(self, result: PostResult, content: str):
        """Log post to vault."""
        try:
            today = datetime.now().strftime('%Y-%m-%d')
            log_file = self.logs_dir / f'social_posts_{today}.json'

            logs = []
            if log_file.exists():
                try:
                    logs = json.loads(log_file.read_text())
                except:
                    pass

            logs.append({
                **result.to_dict(),
                'content': content[:500]  # Truncate for log
            })

            log_file.write_text(json.dumps(logs, indent=2))

        except Exception as e:
            logger.error(f"Failed to log post: {e}")


# ==================== CLI Interface ====================

def main():
    """Command-line interface for social posting."""
    import argparse
    import sys

    parser = argparse.ArgumentParser(
        description='Post to LinkedIn and X (Twitter)',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  Post to LinkedIn:
    python social_poster.py --platform linkedin --content "Your professional post"

  Post to X/Twitter:
    python social_poster.py --platform x --content "Your tweet (max 280 chars)"

  Post to both platforms:
    python social_poster.py --platform all --content "Content for both"

  With hashtags (LinkedIn only):
    python social_poster.py --platform linkedin --content "Post" --hashtags AI Tech Python

  Dry run (simulation):
    python social_poster.py --platform all --content "Test" --dry-run
        """
    )

    parser.add_argument(
        '--platform',
        choices=['linkedin', 'x', 'twitter', 'all'],
        required=True,
        help='Platform to post to'
    )
    parser.add_argument(
        '--content',
        required=True,
        help='Content to post'
    )
    parser.add_argument(
        '--hashtags',
        nargs='+',
        help='Hashtags for LinkedIn (without # symbol)'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Simulate without actually posting'
    )
    parser.add_argument(
        '--vault',
        default='./AI_Employee_Vault',
        help='Path to vault for logging'
    )

    args = parser.parse_args()

    # Create poster
    poster = SocialPoster(vault_path=args.vault, dry_run=args.dry_run)

    # Post based on platform
    if args.platform in ['linkedin']:
        result = poster.post_to_linkedin(args.content, hashtags=args.hashtags)
        status = 'SUCCESS' if result.success else 'FAILED'
        simulated = '[SIMULATED] ' if result.simulated else ''
        print(f"LINKEDIN: {status}")
        print(f"MESSAGE: {simulated}{result.message or result.error}")
        if result.url:
            print(f"URL: {result.url}")
        if result.post_id:
            print(f"POST_ID: {result.post_id}")
        sys.exit(0 if result.success else 1)

    elif args.platform in ['x', 'twitter']:
        result = poster.post_to_x(args.content)
        status = 'SUCCESS' if result.success else 'FAILED'
        simulated = '[SIMULATED] ' if result.simulated else ''
        print(f"X: {status}")
        print(f"MESSAGE: {simulated}{result.message or result.error}")
        if result.url:
            print(f"URL: {result.url}")
        if result.post_id:
            print(f"POST_ID: {result.post_id}")
        sys.exit(0 if result.success else 1)

    elif args.platform == 'all':
        results = poster.post_to_all(args.content, hashtags=args.hashtags)
        all_success = all(r.success for r in results.values())
        for platform, result in results.items():
            status = 'SUCCESS' if result.success else 'FAILED'
            simulated = '[SIMULATED] ' if result.simulated else ''
            print(f"{platform.upper()}: {status}")
            print(f"{platform.upper()}_MESSAGE: {simulated}{result.message or result.error}")
            if result.url:
                print(f"{platform.upper()}_URL: {result.url}")
        sys.exit(0 if all_success else 1)


if __name__ == '__main__':
    main()
