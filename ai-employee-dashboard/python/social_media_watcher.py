"""
Social Media Watcher
--------------------
X/Twitter focused watcher for social media management.
Handles scheduled posting, engagement monitoring, and content summaries.

Gold Tier Feature: X/Twitter social media integration with AI-powered posting.
"""

import os
import json
import requests
from datetime import datetime, timedelta
from pathlib import Path
from base_watcher import BaseWatcher
from typing import Optional, Dict, List, Any

# Platform-specific imports (optional - runs in simulation mode if not available)
try:
    import tweepy  # Twitter/X
    TWITTER_AVAILABLE = True
except ImportError:
    TWITTER_AVAILABLE = False

# Import audit logger
try:
    from audit_logger import get_audit_logger, ActionType, ApprovalStatus
    AUDIT_AVAILABLE = True
except ImportError:
    AUDIT_AVAILABLE = False


class SocialMediaWatcher(BaseWatcher):
    """
    X/Twitter focused social media watcher.
    Monitors engagement, schedules posts, generates summaries for CEO briefings.
    """

    PLATFORMS = ['twitter']  # X/Twitter only per user preference

    def __init__(self, vault_path: str, check_interval: int = 1800):
        """
        Initialize social media watcher.

        Args:
            vault_path: Path to Obsidian vault
            check_interval: Check every 30 minutes by default
        """
        super().__init__(vault_path, check_interval)

        self.social_folder = self.vault_path / 'Social_Media'
        self.social_folder.mkdir(parents=True, exist_ok=True)

        self.scheduled_posts_folder = self.vault_path / 'Social_Media' / 'Scheduled'
        self.scheduled_posts_folder.mkdir(parents=True, exist_ok=True)

        # Load credentials from environment
        self.credentials = self._load_credentials()

        # Initialize platform clients
        self.twitter_client = None
        self.twitter_auth = None

        self._init_platforms()

        # Track posting schedule
        self.post_schedule = self._load_schedule()

        # Initialize audit logger if available
        self.audit_logger = get_audit_logger(str(self.vault_path)) if AUDIT_AVAILABLE else None

    def _load_credentials(self) -> Dict:
        """Load social media credentials from environment."""
        return {
            'twitter': {
                'api_key': os.getenv('TWITTER_API_KEY'),
                'api_secret': os.getenv('TWITTER_API_SECRET'),
                'access_token': os.getenv('TWITTER_ACCESS_TOKEN'),
                'access_secret': os.getenv('TWITTER_ACCESS_SECRET'),
                'bearer_token': os.getenv('TWITTER_BEARER_TOKEN')
            }
        }

    def _init_platforms(self):
        """Initialize connections to social media platforms."""
        creds = self.credentials['twitter']
        if TWITTER_AVAILABLE and creds.get('api_key') and creds.get('access_token'):
            try:
                # OAuth 1.0a for posting (v1.1 endpoints)
                self.twitter_auth = tweepy.OAuth1UserHandler(
                    creds['api_key'],
                    creds['api_secret'],
                    creds['access_token'],
                    creds['access_secret']
                )

                # Client for v2 API (reading and writing)
                self.twitter_client = tweepy.Client(
                    bearer_token=creds['bearer_token'],
                    consumer_key=creds['api_key'],
                    consumer_secret=creds['api_secret'],
                    access_token=creds['access_token'],
                    access_token_secret=creds['access_secret']
                )
                self.logger.info('Twitter client initialized')
            except Exception as e:
                self.logger.warning(f'Twitter init failed: {e}')
        else:
            self.logger.info('Twitter running in simulation mode')

    def _load_schedule(self) -> Dict:
        """Load posting schedule from vault."""
        schedule_file = self.social_folder / 'posting_schedule.json'
        if schedule_file.exists():
            try:
                return json.loads(schedule_file.read_text())
            except:
                pass

        # Default schedule: 3x/week posting
        return {
            'twitter': {'days': [1, 3, 5], 'times': ['09:00', '14:00']}  # Mon, Wed, Fri
        }

    def check_for_updates(self) -> list:
        """Check for scheduled posts and engagement updates."""
        items = []

        # Check if any posts are due
        for platform in self.PLATFORMS:
            if self._is_post_due(platform):
                items.append({
                    'type': 'scheduled_post',
                    'platform': platform,
                    'due_time': datetime.now().isoformat()
                })

        # Check for engagement metrics (weekly)
        if self._is_metrics_due():
            items.append({
                'type': 'engagement_summary',
                'platforms': self.PLATFORMS,
                'period': 'weekly'
            })

        # Check for pending scheduled posts in vault
        items.extend(self._check_pending_posts())

        return items

    def _is_post_due(self, platform: str) -> bool:
        """Check if a post is due for the given platform."""
        schedule = self.post_schedule.get(platform, {})
        now = datetime.now()

        if now.weekday() not in schedule.get('days', []):
            return False

        for post_time in schedule.get('times', []):
            post_hour, post_min = map(int, post_time.split(':'))
            post_dt = now.replace(hour=post_hour, minute=post_min)
            time_diff = abs((now - post_dt).total_seconds())
            if time_diff < 1800:
                check_file = self.needs_action / f'POST_{platform}_{now.strftime("%Y%m%d")}_{post_time.replace(":", "")}.md'
                if not check_file.exists():
                    return True

        return False

    def _is_metrics_due(self) -> bool:
        """Check if weekly metrics summary is due (Sunday)."""
        now = datetime.now()
        if now.weekday() == 6 and now.hour >= 18:
            summary_file = self.social_folder / f'metrics_{now.strftime("%Y-W%W")}.md'
            return not summary_file.exists()
        return False

    def _check_pending_posts(self) -> list:
        """Check for approved posts ready to publish."""
        items = []
        approved_folder = self.vault_path / 'Approved'

        if not approved_folder.exists():
            return items

        for file in approved_folder.glob('SOCIAL_*.md'):
            try:
                content = file.read_text()
                if '---' in content:
                    items.append({
                        'type': 'approved_post',
                        'file': str(file),
                        'filename': file.name
                    })
            except Exception as e:
                self.logger.error(f'Error reading {file}: {e}')

        return items

    def create_action_file(self, item) -> Path:
        """Create action file based on item type."""
        item_type = item.get('type')

        if item_type == 'scheduled_post':
            return self._create_post_request(item)
        elif item_type == 'engagement_summary':
            return self._create_metrics_summary(item)
        elif item_type == 'approved_post':
            return self._publish_approved_post(item)

        return None

    def post_tweet(self, text: str, media_path: Optional[str] = None,
                   reply_to_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Post a tweet to Twitter/X.

        Args:
            text: Tweet content (max 280 characters)
            media_path: Optional path to media file (image/video)
            reply_to_id: Optional tweet ID to reply to

        Returns:
            Dictionary with success status and tweet details
        """
        if len(text) > 280:
            return {
                'success': False,
                'error': f'Tweet exceeds 280 characters ({len(text)} chars)'
            }

        # Log the attempt
        if self.audit_logger:
            self.audit_logger.log(
                ActionType.TWITTER_POST,
                'post_tweet',
                parameters={'text': text[:50] + '...', 'has_media': bool(media_path)},
                status=ApprovalStatus.PENDING
            )

        # Dry run / simulation mode
        if not self.twitter_client:
            result = {
                'success': True,
                'simulated': True,
                'tweet_id': f'SIM_{datetime.now().strftime("%Y%m%d%H%M%S")}',
                'text': text,
                'character_count': len(text),
                'message': 'Tweet simulated (credentials not configured)'
            }
            self._log_tweet_to_vault(result)
            return result

        try:
            media_ids = None

            # Upload media if provided
            if media_path and os.path.exists(media_path):
                api = tweepy.API(self.twitter_auth)
                media = api.media_upload(media_path)
                media_ids = [media.media_id]

            # Post tweet
            tweet_params = {'text': text}
            if media_ids:
                tweet_params['media_ids'] = media_ids
            if reply_to_id:
                tweet_params['in_reply_to_tweet_id'] = reply_to_id

            response = self.twitter_client.create_tweet(**tweet_params)

            result = {
                'success': True,
                'tweet_id': response.data['id'],
                'text': text,
                'character_count': len(text),
                'url': f'https://twitter.com/i/web/status/{response.data["id"]}',
                'has_media': bool(media_ids)
            }

            self._log_tweet_to_vault(result)

            # Log success
            if self.audit_logger:
                self.audit_logger.log(
                    ActionType.TWITTER_POST,
                    'post_tweet',
                    parameters={'tweet_id': result['tweet_id']},
                    result='success',
                    status=ApprovalStatus.APPROVED
                )

            return result

        except Exception as e:
            error_result = {
                'success': False,
                'error': str(e)
            }

            if self.audit_logger:
                self.audit_logger.log(
                    ActionType.TWITTER_POST,
                    'post_tweet',
                    parameters={'text': text[:50]},
                    result=f'error: {str(e)}',
                    status=ApprovalStatus.REJECTED
                )

            return error_result

    def get_engagement_metrics(self, count: int = 10) -> Dict[str, Any]:
        """
        Get engagement metrics for recent tweets.

        Args:
            count: Number of recent tweets to analyze

        Returns:
            Dictionary with engagement metrics and tweet details
        """
        if not self.twitter_client:
            return self._get_simulated_engagement(count)

        try:
            me = self.twitter_client.get_me(user_fields=['public_metrics'])
            user_id = me.data.id

            tweets = self.twitter_client.get_users_tweets(
                user_id,
                max_results=min(count, 100),
                tweet_fields=['created_at', 'public_metrics', 'text'],
                exclude=['replies', 'retweets']
            )

            tweet_list = []
            total_likes = 0
            total_retweets = 0
            total_replies = 0
            total_impressions = 0

            if tweets.data:
                for tweet in tweets.data:
                    metrics = tweet.public_metrics or {}
                    tweet_list.append({
                        'id': tweet.id,
                        'text': tweet.text[:100] + ('...' if len(tweet.text) > 100 else ''),
                        'created_at': tweet.created_at.isoformat() if tweet.created_at else None,
                        'likes': metrics.get('like_count', 0),
                        'retweets': metrics.get('retweet_count', 0),
                        'replies': metrics.get('reply_count', 0),
                        'impressions': metrics.get('impression_count', 0)
                    })

                    total_likes += metrics.get('like_count', 0)
                    total_retweets += metrics.get('retweet_count', 0)
                    total_replies += metrics.get('reply_count', 0)
                    total_impressions += metrics.get('impression_count', 0)

            tweet_count = len(tweet_list)
            total_engagement = total_likes + total_retweets + total_replies

            return {
                'success': True,
                'tweet_count': tweet_count,
                'account': {
                    'followers': me.data.public_metrics.get('followers_count', 0),
                    'following': me.data.public_metrics.get('following_count', 0),
                    'total_tweets': me.data.public_metrics.get('tweet_count', 0)
                },
                'summary': {
                    'total_likes': total_likes,
                    'total_retweets': total_retweets,
                    'total_replies': total_replies,
                    'total_impressions': total_impressions,
                    'total_engagement': total_engagement,
                    'avg_likes': round(total_likes / tweet_count, 1) if tweet_count > 0 else 0,
                    'avg_retweets': round(total_retweets / tweet_count, 1) if tweet_count > 0 else 0,
                    'engagement_rate': f'{((total_engagement / total_impressions) * 100):.2f}%' if total_impressions > 0 else 'N/A'
                },
                'tweets': tweet_list
            }

        except Exception as e:
            self.logger.error(f'Error getting engagement metrics: {e}')
            return self._get_simulated_engagement(count)

    def generate_weekly_summary(self, days: int = 7) -> Dict[str, Any]:
        """
        Generate a weekly summary of Twitter activity for CEO briefing.

        Args:
            days: Number of days to analyze (default: 7)

        Returns:
            Dictionary with summary data for CEO briefing integration
        """
        engagement = self.get_engagement_metrics(100)

        now = datetime.now()
        period_start = now - timedelta(days=days)

        period_tweets = []
        if engagement.get('success') and engagement.get('tweets'):
            for tweet in engagement['tweets']:
                if tweet.get('created_at'):
                    try:
                        tweet_date = datetime.fromisoformat(tweet['created_at'].replace('Z', '+00:00'))
                        if tweet_date.replace(tzinfo=None) >= period_start:
                            period_tweets.append(tweet)
                    except:
                        period_tweets.append(tweet)

        period_likes = sum(t.get('likes', 0) for t in period_tweets)
        period_retweets = sum(t.get('retweets', 0) for t in period_tweets)
        period_replies = sum(t.get('replies', 0) for t in period_tweets)
        period_impressions = sum(t.get('impressions', 0) for t in period_tweets)

        top_tweet = None
        max_engagement = 0
        for tweet in period_tweets:
            score = tweet.get('likes', 0) + tweet.get('retweets', 0) * 2 + tweet.get('replies', 0)
            if score > max_engagement:
                max_engagement = score
                top_tweet = tweet

        recommendations = self._generate_recommendations(period_tweets, period_likes, period_retweets)

        summary = {
            'success': True,
            'platform': 'twitter',
            'period': {
                'start': period_start.isoformat(),
                'end': now.isoformat(),
                'days': days
            },
            'account': engagement.get('account', {}),
            'activity': {
                'tweets_posted': len(period_tweets),
                'avg_tweets_per_day': round(len(period_tweets) / days, 1) if days > 0 else 0
            },
            'engagement': {
                'total_likes': period_likes,
                'total_retweets': period_retweets,
                'total_replies': period_replies,
                'total_impressions': period_impressions,
                'total_engagement': period_likes + period_retweets + period_replies,
                'avg_likes_per_tweet': round(period_likes / len(period_tweets), 1) if period_tweets else 0,
                'avg_retweets_per_tweet': round(period_retweets / len(period_tweets), 1) if period_tweets else 0,
                'engagement_rate': f'{((period_likes + period_retweets + period_replies) / period_impressions * 100):.2f}%' if period_impressions > 0 else 'N/A'
            },
            'top_performing_tweet': {
                'id': top_tweet['id'],
                'text': top_tweet['text'],
                'likes': top_tweet['likes'],
                'retweets': top_tweet['retweets'],
                'url': f'https://twitter.com/i/web/status/{top_tweet["id"]}'
            } if top_tweet else None,
            'recommendations': recommendations,
            'for_ceo_briefing': True
        }

        self._save_weekly_summary_to_vault(summary)

        return summary

    def _generate_recommendations(self, tweets: List[Dict], total_likes: int, total_retweets: int) -> List[Dict]:
        """Generate recommendations based on performance metrics."""
        recommendations = []

        if len(tweets) < 3:
            recommendations.append({
                'category': 'Frequency',
                'action': 'Increase posting frequency',
                'reason': f'Only {len(tweets)} tweets this week. Aim for 3-5 per week.',
                'priority': 'high'
            })

        if tweets:
            avg_likes = total_likes / len(tweets)
            if avg_likes < 5:
                recommendations.append({
                    'category': 'Engagement',
                    'action': 'Improve content quality',
                    'reason': 'Average likes per tweet is low. Try adding images, questions, or trending topics.',
                    'priority': 'medium'
                })

            sorted_tweets = sorted(tweets, key=lambda t: t.get('likes', 0) + t.get('retweets', 0) * 2, reverse=True)
            if sorted_tweets:
                top_tweet = sorted_tweets[0]
                recommendations.append({
                    'category': 'Content Strategy',
                    'action': 'Replicate top content',
                    'reason': f'Your best tweet had {top_tweet.get("likes", 0)} likes. Analyze what made it successful.',
                    'priority': 'low'
                })

        if not recommendations:
            recommendations.append({
                'category': 'General',
                'action': 'Maintain current strategy',
                'reason': 'Performance metrics look healthy. Continue with current approach.',
                'priority': 'low'
            })

        return recommendations

    def _get_simulated_engagement(self, count: int) -> Dict[str, Any]:
        """Generate simulated engagement data for demo mode."""
        import random

        tweets = []
        for i in range(min(count, 10)):
            tweets.append({
                'id': f'sim_{i}',
                'text': f'Simulated tweet {i + 1}...',
                'created_at': (datetime.now() - timedelta(days=i)).isoformat(),
                'likes': random.randint(5, 50),
                'retweets': random.randint(0, 15),
                'replies': random.randint(0, 8),
                'impressions': random.randint(100, 1000)
            })

        total_likes = sum(t['likes'] for t in tweets)
        total_retweets = sum(t['retweets'] for t in tweets)
        total_impressions = sum(t['impressions'] for t in tweets)

        return {
            'success': True,
            'simulated': True,
            'tweet_count': len(tweets),
            'account': {
                'followers': 1250,
                'following': 350,
                'total_tweets': 487
            },
            'summary': {
                'total_likes': total_likes,
                'total_retweets': total_retweets,
                'total_replies': sum(t['replies'] for t in tweets),
                'total_impressions': total_impressions,
                'avg_likes': round(total_likes / len(tweets), 1),
                'avg_retweets': round(total_retweets / len(tweets), 1),
                'engagement_rate': f'{((total_likes + total_retweets) / total_impressions * 100):.2f}%'
            },
            'tweets': tweets
        }

    def _log_tweet_to_vault(self, tweet_data: Dict):
        """Log tweet to vault for audit trail."""
        log_dir = self.vault_path / 'Logs'
        log_dir.mkdir(exist_ok=True)

        today = datetime.now().strftime('%Y-%m-%d')
        log_file = log_dir / f'twitter_{today}.json'

        logs = []
        if log_file.exists():
            try:
                logs = json.loads(log_file.read_text())
            except:
                pass

        logs.append({
            'timestamp': datetime.now().isoformat(),
            'action': 'TWEET_POSTED',
            'data': tweet_data
        })

        log_file.write_text(json.dumps(logs, indent=2))

    def _save_weekly_summary_to_vault(self, summary: Dict):
        """Save weekly summary to vault."""
        now = datetime.now()
        week_num = now.strftime('%Y-W%W')

        summary_file = self.social_folder / f'twitter_summary_{week_num}.json'
        summary_file.write_text(json.dumps(summary, indent=2, default=str))

    def _create_post_request(self, item: dict) -> Path:
        """Create request for social media post content."""
        platform = item['platform']
        now = datetime.now()

        metadata = {
            'type': 'social_post_request',
            'platform': platform,
            'scheduled_time': item['due_time'],
            'status': 'pending_content',
            'priority': 'normal'
        }

        content = self.format_frontmatter(metadata)
        content += f"""
## Social Media Post Request

**Platform:** {platform.title()}
**Scheduled:** {item['due_time']}

## Guidelines
Max 280 characters. Use relevant hashtags. Include call-to-action.

## Instructions for Claude

Generate engaging content for Twitter/X using these guidelines:

1. Review current business goals from Business_Goals.md
2. Check recent achievements from Done folder
3. Consider industry trends and relevant topics
4. Optimize for engagement (questions, calls-to-action)

## Draft Content
<!-- Claude: Generate content below -->

**Post Text:**
[Generate engaging post content here - max 280 characters]

**Hashtags:**
[2-3 relevant hashtags]

**Best Posting Time:**
Based on engagement data, consider posting during peak hours (9-11 AM, 1-3 PM EST)

## Approval Required
After content is generated, move to /Pending_Approval for review.
Human must approve before publishing via Twitter MCP.
"""

        filename = f'POST_{platform}_{now.strftime("%Y%m%d")}_{now.strftime("%H%M")}.md'
        filepath = self.needs_action / filename
        self.create_file_safely(filepath, content)

        return filepath

    def _create_metrics_summary(self, item: dict) -> Path:
        """Create weekly engagement metrics summary."""
        now = datetime.now()
        week_num = now.strftime('%Y-W%W')

        metrics = self.get_engagement_metrics(50)
        summary = self.generate_weekly_summary(7)

        metadata = {
            'type': 'social_media_metrics',
            'period': week_num,
            'generated': now.isoformat(),
            'platforms': item['platforms']
        }

        content = self.format_frontmatter(metadata)
        content += f"""
# Twitter Weekly Summary - {week_num}

## Executive Overview

| Metric | This Week | Change |
|--------|-----------|--------|
| Tweets Posted | {summary.get('activity', {}).get('tweets_posted', 0)} | - |
| Total Likes | {summary.get('engagement', {}).get('total_likes', 0)} | - |
| Total Retweets | {summary.get('engagement', {}).get('total_retweets', 0)} | - |
| Engagement Rate | {summary.get('engagement', {}).get('engagement_rate', 'N/A')} | - |
| Followers | {metrics.get('account', {}).get('followers', 0)} | - |

## Top Performing Content
"""

        if summary.get('top_performing_tweet'):
            top = summary['top_performing_tweet']
            content += f"""
- **Best Tweet:** {top.get('text', 'N/A')}
  - Likes: {top.get('likes', 0)} | Retweets: {top.get('retweets', 0)}
  - [View Tweet]({top.get('url', '#')})
"""

        content += """
## Recommendations
"""
        for rec in summary.get('recommendations', []):
            content += f"- **{rec['category']}:** {rec['action']}\n  - {rec['reason']}\n"

        content += f"""
## Next Week Focus
Based on this week's performance:
1. Continue posting 3-5 times per week
2. Experiment with different content types
3. Engage with replies and mentions

---
*Generated by AI Employee Social Media Watcher*
*Data for CEO Briefing integration available*
"""

        filepath = self.social_folder / f'metrics_{week_num}.md'
        self.create_file_safely(filepath, content)

        return filepath

    def _gather_platform_metrics(self) -> Dict:
        """Gather metrics from Twitter."""
        return {
            'twitter': self._get_twitter_metrics()
        }

    def _get_twitter_metrics(self) -> Dict:
        """Get real Twitter metrics."""
        metrics = self.get_engagement_metrics(20)
        if metrics.get('success'):
            return {
                'posts': metrics.get('tweet_count', 0),
                'engagements': metrics.get('summary', {}).get('total_engagement', 0),
                'followers': metrics.get('account', {}).get('followers', 0),
                'growth': '+N/A',
                'top_post': 'See Twitter Analytics'
            }
        return self._get_simulated_metrics('twitter')

    def _get_simulated_metrics(self, platform: str) -> Dict:
        """Generate simulated metrics for demo."""
        import random
        return {
            'posts': random.randint(3, 7),
            'engagements': random.randint(50, 500),
            'followers': 1250 + random.randint(-50, 100),
            'growth': f'+{random.randint(1, 5)}%',
            'top_post': f'[Simulated] Post about {random.choice(["AI", "business", "tech", "tips"])}',
            'simulated': True
        }

    def _publish_approved_post(self, item: dict) -> Optional[Path]:
        """Publish an approved post to Twitter."""
        filepath = Path(item['file'])

        try:
            content = filepath.read_text()

            post_text = None
            lines = content.split('\n')
            capture = False
            text_lines = []

            for line in lines:
                if 'Post Text:' in line:
                    capture = True
                    continue
                if capture and line.startswith('**') and 'Hashtags' not in line:
                    break
                if capture and line.strip():
                    text_lines.append(line.strip())

            if text_lines:
                post_text = ' '.join(text_lines)

            if post_text and not post_text.startswith('['):
                result = self.post_tweet(post_text)

                if result.get('success'):
                    self.logger.info(f'Published tweet: {result.get("tweet_id")}')

                    done_folder = self.vault_path / 'Done'
                    done_folder.mkdir(exist_ok=True)
                    new_path = done_folder / filepath.name
                    filepath.rename(new_path)

                    self.update_dashboard(f'Published tweet: {post_text[:50]}...')

                    return new_path
                else:
                    self.logger.error(f'Failed to post tweet: {result.get("error")}')
            else:
                self.logger.warning('No valid post content found in file')

        except Exception as e:
            self.logger.error(f'Failed to publish post: {e}')

        return None


class TwitterWatcher(SocialMediaWatcher):
    """X/Twitter-specific watcher."""
    PLATFORMS = ['twitter']


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Social Media Watcher')
    parser.add_argument('--vault', default='./AI_Employee_Vault', help='Path to vault')
    parser.add_argument('--interval', type=int, default=1800, help='Check interval')
    parser.add_argument('--once', action='store_true', help='Run once and exit')
    parser.add_argument('--summary', action='store_true', help='Generate weekly summary')
    parser.add_argument('--post', type=str, help='Post a tweet directly')

    args = parser.parse_args()

    watcher = SocialMediaWatcher(args.vault, args.interval)

    if args.summary:
        summary = watcher.generate_weekly_summary()
        print(json.dumps(summary, indent=2, default=str))
    elif args.post:
        result = watcher.post_tweet(args.post)
        print(json.dumps(result, indent=2))
    elif args.once:
        items = watcher.check_for_updates()
        for item in items:
            watcher.create_action_file(item)
        print(f'Processed {len(items)} items')
    else:
        watcher.run()
