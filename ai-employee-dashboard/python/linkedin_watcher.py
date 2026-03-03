"""
LinkedIn Content Watcher
-------------------------
Monitors business activities and schedules LinkedIn post creation.
Triggers Claude Code to draft posts based on completed tasks, projects,
and business goals.
"""

from pathlib import Path
from datetime import datetime, timedelta
from base_watcher import BaseWatcher
import json


class LinkedInWatcher(BaseWatcher):
    """
    Monitors business activities and creates triggers for LinkedIn posts.

    This watcher doesn't directly post to LinkedIn - it creates action files
    that trigger Claude to draft posts, which then go through approval workflow.
    """

    def __init__(
        self,
        vault_path: str,
        check_interval: int = 3600,  # Check every hour
        posts_per_week: int = 3
    ):
        """
        Initialize the LinkedIn watcher.

        Args:
            vault_path: Path to the Obsidian vault
            check_interval: Seconds between checks
            posts_per_week: Target number of posts per week
        """
        super().__init__(vault_path, check_interval)

        self.posts_per_week = posts_per_week
        self.business_goals_path = self.vault_path / 'Business_Goals.md'
        self.done_tasks_folder = self.vault_path / 'Tasks' / 'Done'
        self.pending_approval_folder = self.vault_path / 'Pending_Approval'

        # Create necessary folders
        self.done_tasks_folder.mkdir(parents=True, exist_ok=True)

        # Load posting schedule from config
        self.posting_schedule = self.load_posting_schedule()

    def load_posting_schedule(self) -> dict:
        """
        Load the LinkedIn posting schedule from Business_Goals.md.

        Returns:
            Dictionary with posting schedule
        """
        # Default schedule: Monday, Wednesday, Friday at 9 AM
        default_schedule = {
            'monday': {'enabled': True, 'time': '09:00', 'type': 'insight'},
            'tuesday': {'enabled': False, 'time': '09:00', 'type': 'insight'},
            'wednesday': {'enabled': True, 'time': '09:00', 'type': 'behind_scenes'},
            'thursday': {'enabled': False, 'time': '09:00', 'type': 'insight'},
            'friday': {'enabled': True, 'time': '09:00', 'type': 'engagement'},
            'saturday': {'enabled': False, 'time': '09:00', 'type': 'insight'},
            'sunday': {'enabled': False, 'time': '09:00', 'type': 'insight'}
        }

        # TODO: Parse actual schedule from Business_Goals.md
        # For now, return default

        return default_schedule

    def check_for_updates(self) -> list:
        """
        Check if it's time to create a LinkedIn post.

        Returns:
            List of post triggers (each trigger is a dict with post requirements)
        """
        triggers = []

        try:
            now = datetime.now()
            today = now.strftime('%A').lower()

            # Check if today is a posting day
            if today not in self.posting_schedule:
                return triggers

            schedule = self.posting_schedule[today]
            if not schedule.get('enabled', False):
                return triggers

            # Check if we already have a pending post for today
            if self.has_pending_post_for_today():
                self.logger.debug('Already have pending post for today')
                return triggers

            # Check if it's the right time of day
            scheduled_hour = int(schedule['time'].split(':')[0])
            if now.hour != scheduled_hour:
                return triggers

            # Check if we already created a trigger in the last hour
            trigger_id = f'linkedin_post_{now.strftime("%Y%m%d_%H")}'
            if trigger_id in self.processed_ids:
                return triggers

            # Create trigger for post creation
            trigger = {
                'id': trigger_id,
                'type': schedule['type'],
                'scheduled_for': now.isoformat(),
                'context': self.gather_content_context()
            }

            triggers.append(trigger)
            self.processed_ids.add(trigger_id)

        except Exception as e:
            self.logger.error(f'Error checking for updates: {e}')

        return triggers

    def create_action_file(self, item) -> Path:
        """
        Create an action file that triggers Claude to draft a LinkedIn post.

        Args:
            item: Dictionary with post trigger information

        Returns:
            Path to the created action file
        """
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        action_file = self.needs_action / f'LINKEDIN_POST_{timestamp}.md'

        # Create metadata
        metadata = {
            'type': 'linkedin_post_request',
            'post_type': item['type'],
            'scheduled_for': item['scheduled_for'],
            'created_at': datetime.now().isoformat(),
            'status': 'pending_draft',
            'priority': 'normal'
        }

        # Create content
        content = self.format_frontmatter(metadata)
        content += '\n'
        content += f'# LinkedIn Post Request\n\n'

        content += f'## Instructions for Claude\n\n'
        content += f'Please create a LinkedIn post using the **linkedin-poster** skill.\n\n'

        content += f'**Post Type**: {item["type"]}\n\n'

        # Add context based on post type
        if item['type'] == 'insight':
            content += self.generate_insight_prompt(item['context'])
        elif item['type'] == 'behind_scenes':
            content += self.generate_behind_scenes_prompt(item['context'])
        elif item['type'] == 'engagement':
            content += self.generate_engagement_prompt(item['context'])
        elif item['type'] == 'achievement':
            content += self.generate_achievement_prompt(item['context'])
        else:
            content += self.generate_general_prompt(item['context'])

        content += f'\n## Content Context\n\n'
        content += f'### Recent Activities\n'
        for activity in item['context'].get('recent_activities', []):
            content += f'- {activity}\n'

        content += f'\n### Business Goals\n'
        content += f'{item["context"].get("business_goals_summary", "See Business_Goals.md")}\n'

        content += f'\n### Completed Tasks\n'
        for task in item['context'].get('completed_tasks', []):
            content += f'- {task}\n'

        content += f'\n## Requirements\n'
        content += f'- [ ] Draft engaging post (150-300 words)\n'
        content += f'- [ ] Include 3-5 relevant hashtags\n'
        content += f'- [ ] Add call-to-action\n'
        content += f'- [ ] Create approval file in /Pending_Approval\n'
        content += f'- [ ] Follow linkedin-poster.skill.md guidelines\n'

        # Write the action file
        self.create_file_safely(action_file, content)

        return action_file

    def gather_content_context(self) -> dict:
        """
        Gather context for post creation from vault files.

        Returns:
            Dictionary with context information
        """
        context = {
            'recent_activities': [],
            'completed_tasks': [],
            'business_goals_summary': ''
        }

        try:
            # Get recent activities from Dashboard
            dashboard_path = self.vault_path / 'Dashboard.md'
            if dashboard_path.exists():
                dashboard_content = dashboard_path.read_text(encoding='utf-8')
                # Extract recent activities (simplified - could be more sophisticated)
                if '## Recent Activity' in dashboard_content:
                    lines = dashboard_content.split('## Recent Activity')[1].split('\n')
                    context['recent_activities'] = [
                        line.strip('- ') for line in lines[1:6] if line.startswith('- ')
                    ]

            # Get completed tasks from last week
            if self.done_tasks_folder.exists():
                week_ago = datetime.now() - timedelta(days=7)
                for task_file in self.done_tasks_folder.glob('*.md'):
                    if task_file.stat().st_mtime > week_ago.timestamp():
                        # Read task title
                        content = task_file.read_text(encoding='utf-8')
                        first_line = content.split('\n')[0].strip('# ')
                        context['completed_tasks'].append(first_line)

            # Get business goals summary
            if self.business_goals_path.exists():
                goals_content = self.business_goals_path.read_text(encoding='utf-8')
                # Extract executive summary (simplified)
                if '## Executive Summary' in goals_content:
                    summary = goals_content.split('## Executive Summary')[1].split('##')[0]
                    context['business_goals_summary'] = summary.strip()

        except Exception as e:
            self.logger.error(f'Error gathering context: {e}')

        return context

    def generate_insight_prompt(self, context: dict) -> str:
        """Generate prompt for an insight/tip post."""
        return '''
**Post Objective**: Share a valuable insight, lesson learned, or professional tip.

**Approach**:
1. Identify a key lesson from recent work or experience
2. Present it as 2-3 actionable points
3. Make it relatable and practical
4. End with a question to drive engagement

**Tone**: Professional, helpful, not preachy

**Example Structure**:
[Opening hook - insight statement]

[2-3 bullet points with details]

[Question or call-to-action]

[Relevant hashtags]
'''

    def generate_behind_scenes_prompt(self, context: dict) -> str:
        """Generate prompt for a behind-the-scenes post."""
        return '''
**Post Objective**: Show your process, tools, or day-to-day work.

**Approach**:
1. Pick something interesting from recent activities
2. Explain what you're building/doing and why
3. Share a challenge or interesting aspect
4. Make it relatable to your audience

**Tone**: Authentic, conversational, transparent

**Example Structure**:
[What you're working on]

[Why it matters / the challenge]

[The approach / interesting detail]

[Lesson or takeaway]

[Relevant hashtags]
'''

    def generate_engagement_prompt(self, context: dict) -> str:
        """Generate prompt for an engagement post."""
        return '''
**Post Objective**: Start a conversation and drive engagement.

**Approach**:
1. Pose an interesting question or controversial (but professional) opinion
2. Share your perspective briefly
3. Invite others to share their experience
4. Keep it open-ended

**Tone**: Conversational, curious, inviting

**Example Structure**:
[Question or opinion statement]

[Your brief take on it]

[Invitation for others to share]

[Relevant hashtags]
'''

    def generate_achievement_prompt(self, context: dict) -> str:
        """Generate prompt for an achievement post."""
        return '''
**Post Objective**: Share a milestone, completed project, or achievement.

**Approach**:
1. State the achievement clearly
2. Brief context (the challenge or journey)
3. The outcome/impact
4. Gratitude or lesson learned

**Tone**: Proud but humble, grateful

**Example Structure**:
[Achievement statement]

The challenge: [Brief context]
The solution: [What you did]
The impact: [Result]

[Lesson learned or gratitude]

[Relevant hashtags]
'''

    def generate_general_prompt(self, context: dict) -> str:
        """Generate a general prompt."""
        return '''
**Post Objective**: Create engaging content related to your business and expertise.

**Approach**:
1. Review recent activities and completed tasks
2. Find an interesting angle or story
3. Make it valuable to your audience
4. Include call-to-action

**Tone**: Professional, engaging, authentic

Refer to the linkedin-poster.skill.md for detailed guidelines.
'''

    def has_pending_post_for_today(self) -> bool:
        """
        Check if there's already a pending LinkedIn post for today.

        Returns:
            True if pending post exists for today
        """
        today = datetime.now().strftime('%Y%m%d')

        # Check Pending_Approval folder
        for file in self.pending_approval_folder.glob('LINKEDIN_*.md'):
            if today in file.name:
                return True

        # Check Needs_Action folder
        for file in self.needs_action.glob('LINKEDIN_POST_*.md'):
            if today in file.name:
                return True

        return False


def main():
    """Main entry point for the LinkedIn watcher."""
    import argparse
    import sys

    parser = argparse.ArgumentParser(
        description='LinkedIn Content Watcher for AI Employee'
    )
    parser.add_argument(
        '--vault',
        default='./AI_Employee_Vault',
        help='Path to Obsidian vault'
    )
    parser.add_argument(
        '--interval',
        type=int,
        default=3600,
        help='Check interval in seconds (default: 3600 = 1 hour)'
    )
    parser.add_argument(
        '--posts-per-week',
        type=int,
        default=3,
        help='Target posts per week (default: 3)'
    )
    parser.add_argument(
        '--log-level',
        default='INFO',
        choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'],
        help='Logging level'
    )

    args = parser.parse_args()

    # Create watcher instance
    watcher = LinkedInWatcher(
        vault_path=args.vault,
        check_interval=args.interval,
        posts_per_week=args.posts_per_week
    )
    watcher.logger.setLevel(args.log_level)

    try:
        watcher.run()
    except KeyboardInterrupt:
        watcher.stop()
        sys.exit(0)
    except Exception as e:
        watcher.logger.critical(f'Fatal error: {e}')
        sys.exit(1)


if __name__ == '__main__':
    main()
