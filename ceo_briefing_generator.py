"""
CEO Briefing Generator
----------------------
Generates comprehensive weekly business and accounting audits with CEO briefings.
Analyzes revenue, expenses, completed tasks, bottlenecks, and provides recommendations.

Gold Tier Feature: Weekly Business and Accounting Audit with CEO Briefing.

Per Hackathon Document:
"The Trigger: A scheduled task runs every Sunday night."
"The Deliverable: A 'Monday Morning CEO Briefing' highlighting Revenue, Bottlenecks,
and Proactive Suggestions."

Integrations:
- Odoo MCP Server for financial data (invoices, payments, expenses)
- Twitter MCP Server for social media metrics
- Vault files for tasks and activities
"""

import os
import json
import subprocess
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any
import logging

# Import MCP client for real data fetching
try:
    from mcp_client import MCPClient, get_mcp_client
    MCP_CLIENT_AVAILABLE = True
except ImportError:
    MCP_CLIENT_AVAILABLE = False


class CEOBriefingGenerator:
    """
    Generates weekly CEO briefings by analyzing vault data,
    accounting records, and task completion metrics.
    """

    def __init__(self, vault_path: str):
        """Initialize the briefing generator."""
        self.vault_path = Path(vault_path)
        self.logger = logging.getLogger('CEOBriefingGenerator')

        # Setup logging
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            handler.setFormatter(logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            ))
            self.logger.addHandler(handler)
            self.logger.setLevel(logging.INFO)

        # Key folders
        self.briefings_folder = self.vault_path / 'Briefings'
        self.briefings_folder.mkdir(parents=True, exist_ok=True)

        self.done_folder = self.vault_path / 'Done'
        self.logs_folder = self.vault_path / 'Logs'
        self.accounting_folder = self.vault_path / 'Accounting'

        # MCP integration settings
        self.use_odoo_mcp = os.getenv('USE_ODOO_MCP', 'true').lower() == 'true'
        self.use_twitter_mcp = os.getenv('USE_TWITTER_MCP', 'true').lower() == 'true'
        self.mcp_config_path = Path(vault_path).parent / 'mcp.json'

    def _call_odoo_mcp(self, tool_name: str, arguments: Dict = None) -> Optional[Dict]:
        """
        Call an Odoo MCP tool and return the result.

        Per hackathon doc: Uses Odoo's JSON-RPC APIs via MCP server.

        Args:
            tool_name: Name of the Odoo tool (e.g., 'odoo_get_revenue_report')
            arguments: Tool arguments

        Returns:
            Tool result as dict, or None on error
        """
        if not self.use_odoo_mcp:
            return None

        self.logger.info(f'Calling Odoo MCP: {tool_name}')

        # Try real MCP client first
        if MCP_CLIENT_AVAILABLE:
            try:
                mcp_client = get_mcp_client()
                result = mcp_client.call_tool('odoo', tool_name, arguments or {})

                if result.success and result.data:
                    self.logger.info(f'Odoo MCP call successful: {tool_name}')
                    return {'success': True, **result.data}
                else:
                    self.logger.warning(f'Odoo MCP call returned no data: {result.error}')
                    # Fall through to simulated data

            except Exception as e:
                self.logger.warning(f'Odoo MCP call failed, using simulated data: {e}')

        # Fallback to simulated data for demo/development
        self.logger.info(f'Using simulated Odoo data for: {tool_name}')

        if tool_name == 'odoo_get_revenue_report':
            return self._get_simulated_odoo_revenue()
        elif tool_name == 'odoo_get_expense_report':
            return self._get_simulated_odoo_expenses()
        elif tool_name == 'odoo_get_unpaid_invoices':
            return self._get_simulated_odoo_invoices()
        elif tool_name == 'odoo_get_aging_report':
            return self._get_simulated_odoo_aging()
        elif tool_name == 'odoo_get_cash_flow':
            return self._get_simulated_odoo_cashflow()

        return None

    def _call_twitter_mcp(self, tool_name: str, arguments: Dict = None) -> Optional[Dict]:
        """
        Call a Twitter MCP tool and return the result.

        Per hackathon doc: Integrate Twitter (X) and generate summary.

        Args:
            tool_name: Name of the Twitter tool
            arguments: Tool arguments

        Returns:
            Tool result as dict, or None on error
        """
        if not self.use_twitter_mcp:
            return None

        self.logger.info(f'Calling Twitter MCP: {tool_name}')

        # Try real MCP client first
        if MCP_CLIENT_AVAILABLE:
            try:
                mcp_client = get_mcp_client()
                result = mcp_client.call_tool('twitter', tool_name, arguments or {})

                if result.success and result.data:
                    self.logger.info(f'Twitter MCP call successful: {tool_name}')
                    return {'success': True, **result.data}
                else:
                    self.logger.warning(f'Twitter MCP call returned no data: {result.error}')

            except Exception as e:
                self.logger.warning(f'Twitter MCP call failed, using simulated data: {e}')

        # Fallback to simulated data
        self.logger.info(f'Using simulated Twitter data for: {tool_name}')

        if tool_name == 'twitter_get_weekly_summary':
            return self._get_simulated_twitter_summary()
        elif tool_name == 'twitter_get_engagement':
            return self._get_simulated_twitter_engagement()

        return None

    def _get_simulated_odoo_revenue(self) -> Dict:
        """Simulated Odoo revenue report."""
        return {
            'success': True,
            'simulated': True,
            'period': {'start': '2026-01-11', 'end': '2026-01-18'},
            'total_revenue': 2750.00,
            'by_customer': [
                {'customer': 'Client A', 'amount': 1500},
                {'customer': 'Client B', 'amount': 850},
                {'customer': 'Client C', 'amount': 400}
            ],
            'invoice_count': 5
        }

    def _get_simulated_odoo_expenses(self) -> Dict:
        """Simulated Odoo expense report."""
        return {
            'success': True,
            'simulated': True,
            'period': {'start': '2026-01-11', 'end': '2026-01-18'},
            'total_expenses': 425.00,
            'by_category': [
                {'category': 'Software', 'amount': 150},
                {'category': 'Marketing', 'amount': 125},
                {'category': 'Office', 'amount': 100},
                {'category': 'Other', 'amount': 50}
            ],
            'expense_count': 8
        }

    def _get_simulated_odoo_invoices(self) -> Dict:
        """Simulated Odoo unpaid invoices."""
        return {
            'success': True,
            'simulated': True,
            'invoices': [
                {'number': 'INV/2026/0042', 'customer': 'Client D', 'amount': 1200, 'due_date': '2026-01-25', 'days_overdue': 0},
                {'number': 'INV/2026/0038', 'customer': 'Client E', 'amount': 800, 'due_date': '2026-01-10', 'days_overdue': 8}
            ],
            'total_outstanding': 2000,
            'overdue_count': 1,
            'overdue_amount': 800
        }

    def _get_simulated_odoo_aging(self) -> Dict:
        """Simulated Odoo aging report."""
        return {
            'success': True,
            'simulated': True,
            'as_of_date': '2026-01-18',
            'summary': {
                'current': 1200,
                'days_1_30': 800,
                'days_31_60': 0,
                'days_61_90': 0,
                'over_90': 0,
                'total_outstanding': 2000
            }
        }

    def _get_simulated_odoo_cashflow(self) -> Dict:
        """Simulated Odoo cash flow."""
        return {
            'success': True,
            'simulated': True,
            'period': {'start': '2026-01-11', 'end': '2026-01-18'},
            'operating': {
                'customer_receipts': 2100,
                'supplier_payments': -350,
                'net_operating': 1750
            },
            'net_cash_change': 1750
        }

    def _get_simulated_twitter_summary(self) -> Dict:
        """Simulated Twitter weekly summary."""
        return {
            'success': True,
            'simulated': True,
            'period': {'days': 7},
            'activity': {
                'tweets_posted': 4,
                'mentions_received': 12
            },
            'engagement': {
                'total_likes': 85,
                'total_retweets': 23,
                'total_replies': 18,
                'avg_likes_per_tweet': '21.3',
                'avg_retweets_per_tweet': '5.8'
            },
            'account': {
                'followers': 1285,
                'following': 342
            },
            'top_performing_tweet': {
                'text': 'Excited to announce our new AI-powered features! #AI #Automation',
                'likes': 42,
                'retweets': 12
            }
        }

    def _get_simulated_twitter_engagement(self) -> Dict:
        """Simulated Twitter engagement metrics."""
        return {
            'success': True,
            'simulated': True,
            'tweet_count': 4,
            'summary': {
                'total_likes': 85,
                'total_retweets': 23,
                'avg_engagement_rate': '4.2%'
            }
        }

    def generate_briefing(self, lookback_days: int = 7) -> Path:
        """
        Generate a comprehensive CEO briefing.

        Args:
            lookback_days: Number of days to analyze

        Returns:
            Path to the generated briefing file
        """
        self.logger.info(f'Generating CEO briefing for last {lookback_days} days')

        period_end = datetime.now()
        period_start = period_end - timedelta(days=lookback_days)

        # Collect all data
        financial_data = self._collect_financial_data(period_start, period_end)
        task_data = self._collect_task_data(period_start, period_end)
        activity_data = self._collect_activity_data(period_start, period_end)
        social_data = self._collect_social_data(period_start, period_end)
        business_goals = self._load_business_goals()

        # Analyze data
        analysis = self._analyze_data(financial_data, task_data, activity_data, business_goals)

        # Generate briefing
        briefing_content = self._generate_briefing_content(
            period_start, period_end, financial_data, task_data,
            activity_data, social_data, business_goals, analysis
        )

        # Save briefing
        filename = f'{period_end.strftime("%Y-%m-%d")}_Monday_Briefing.md'
        filepath = self.briefings_folder / filename
        filepath.write_text(briefing_content, encoding='utf-8')

        self.logger.info(f'Briefing saved to: {filepath}')

        # Update dashboard
        self._update_dashboard(filepath.name)

        return filepath

    def _collect_social_data(self, start: datetime, end: datetime) -> Dict:
        """Collect social media metrics from Twitter MCP."""
        data = {
            'tweets_posted': 0,
            'total_likes': 0,
            'total_retweets': 0,
            'mentions': 0,
            'followers': 0,
            'engagement_rate': '0%',
            'top_tweet': None,
            'simulated': False
        }

        # Try to get data from Twitter MCP
        twitter_summary = self._call_twitter_mcp('twitter_get_weekly_summary', {'days': 7})

        if twitter_summary and twitter_summary.get('success'):
            data['tweets_posted'] = twitter_summary.get('activity', {}).get('tweets_posted', 0)
            data['mentions'] = twitter_summary.get('activity', {}).get('mentions_received', 0)
            data['total_likes'] = twitter_summary.get('engagement', {}).get('total_likes', 0)
            data['total_retweets'] = twitter_summary.get('engagement', {}).get('total_retweets', 0)
            data['followers'] = twitter_summary.get('account', {}).get('followers', 0)
            data['engagement_rate'] = twitter_summary.get('summary', {}).get('avg_engagement_rate', '0%')
            data['top_tweet'] = twitter_summary.get('top_performing_tweet')
            data['simulated'] = twitter_summary.get('simulated', False)

        return data

    def _collect_financial_data(self, start: datetime, end: datetime) -> Dict:
        """Collect financial data from Odoo MCP and accounting folder."""
        data = {
            'revenue': 0.0,
            'expenses': 0.0,
            'outstanding_invoices': 0.0,
            'overdue_invoices': [],
            'overdue_amount': 0.0,
            'transactions': [],
            'subscriptions': [],
            'cash_flow': 0.0,
            'aging': {},
            'simulated': False
        }

        # Try to get data from Odoo MCP first
        start_str = start.strftime('%Y-%m-%d')
        end_str = end.strftime('%Y-%m-%d')

        # Revenue from Odoo
        revenue_data = self._call_odoo_mcp('odoo_get_revenue_report', {
            'start_date': start_str,
            'end_date': end_str
        })
        if revenue_data and revenue_data.get('success'):
            data['revenue'] = revenue_data.get('total_revenue', 0)
            data['simulated'] = revenue_data.get('simulated', False)

        # Expenses from Odoo
        expense_data = self._call_odoo_mcp('odoo_get_expense_report', {
            'start_date': start_str,
            'end_date': end_str
        })
        if expense_data and expense_data.get('success'):
            data['expenses'] = expense_data.get('total_expenses', 0)

        # Unpaid invoices from Odoo
        invoice_data = self._call_odoo_mcp('odoo_get_unpaid_invoices', {})
        if invoice_data and invoice_data.get('success'):
            data['outstanding_invoices'] = invoice_data.get('total_outstanding', 0)
            data['overdue_amount'] = invoice_data.get('overdue_amount', 0)
            data['overdue_invoices'] = [
                inv['number'] for inv in invoice_data.get('invoices', [])
                if inv.get('days_overdue', 0) > 0
            ]

        # Aging report from Odoo
        aging_data = self._call_odoo_mcp('odoo_get_aging_report', {})
        if aging_data and aging_data.get('success'):
            data['aging'] = aging_data.get('summary', {})

        # Cash flow from Odoo
        cashflow_data = self._call_odoo_mcp('odoo_get_cash_flow', {
            'start_date': start_str,
            'end_date': end_str
        })
        if cashflow_data and cashflow_data.get('success'):
            data['cash_flow'] = cashflow_data.get('net_cash_change', 0)

        # Fallback: Check accounting folder for transaction logs
        if data['revenue'] == 0 and self.accounting_folder.exists():
            for file in self.accounting_folder.glob('*.md'):
                try:
                    content = file.read_text(encoding='utf-8')
                    # Parse transaction tables
                    if '| Date |' in content:
                        lines = content.split('\n')
                        for line in lines:
                            if '|' in line and '$' in line:
                                parts = [p.strip() for p in line.split('|') if p.strip()]
                                if len(parts) >= 3:
                                    try:
                                        amount_str = parts[2].replace('$', '').replace(',', '')
                                        amount = float(amount_str)
                                        if amount > 0:
                                            data['revenue'] += amount
                                        else:
                                            data['expenses'] += abs(amount)
                                        data['transactions'].append({
                                            'date': parts[0],
                                            'description': parts[1],
                                            'amount': amount
                                        })
                                    except (ValueError, IndexError):
                                        pass
                except Exception as e:
                    self.logger.warning(f'Error parsing {file}: {e}')

        # Check for invoices in Needs_Action
        needs_action = self.vault_path / 'Needs_Action'
        if needs_action.exists():
            for file in needs_action.glob('INV_*.md'):
                try:
                    content = file.read_text(encoding='utf-8')
                    if 'amount_due:' in content.lower():
                        # Extract amount due from frontmatter
                        for line in content.split('\n'):
                            if 'amount_due:' in line.lower():
                                amount = float(line.split(':')[1].strip())
                                data['outstanding_invoices'] += amount
                            if 'OVERDUE' in content.upper():
                                data['overdue_invoices'].append(file.stem)
                except:
                    pass

        # Identify subscriptions from transactions
        subscription_keywords = ['subscription', 'monthly', 'adobe', 'notion', 'slack', 'aws', 'google']
        for txn in data['transactions']:
            desc = txn['description'].lower()
            if any(kw in desc for kw in subscription_keywords):
                data['subscriptions'].append(txn)

        # Use simulated data if no real data found
        if data['revenue'] == 0 and data['expenses'] == 0:
            data = self._get_simulated_financial_data()

        return data

    def _get_simulated_financial_data(self) -> Dict:
        """Generate simulated financial data for demo."""
        import random
        return {
            'revenue': round(random.uniform(1500, 3500), 2),
            'expenses': round(random.uniform(200, 500), 2),
            'outstanding_invoices': round(random.uniform(0, 2000), 2),
            'overdue_invoices': ['INV_1234'] if random.random() > 0.5 else [],
            'transactions': [
                {'date': '2026-01-10', 'description': 'Client A Payment', 'amount': 1500},
                {'date': '2026-01-12', 'description': 'Software Subscription', 'amount': -99},
                {'date': '2026-01-14', 'description': 'Consulting Revenue', 'amount': 750},
            ],
            'subscriptions': [
                {'description': 'Claude Code Pro', 'amount': -20},
                {'description': 'Google Workspace', 'amount': -12},
                {'description': 'LinkedIn Premium', 'amount': -30},
            ],
            'simulated': True
        }

    def _collect_task_data(self, start: datetime, end: datetime) -> Dict:
        """Collect completed task data from Done folder."""
        data = {
            'completed_tasks': [],
            'total_completed': 0,
            'categories': {},
            'bottlenecks': []
        }

        if self.done_folder.exists():
            for file in self.done_folder.glob('*.md'):
                try:
                    stat = file.stat()
                    modified = datetime.fromtimestamp(stat.st_mtime)

                    if start <= modified <= end:
                        content = file.read_text(encoding='utf-8')
                        task_type = 'general'

                        # Determine task type from filename or content
                        fname = file.name.upper()
                        if 'EMAIL' in fname:
                            task_type = 'email'
                        elif 'LINKEDIN' in fname or 'SOCIAL' in fname:
                            task_type = 'social_media'
                        elif 'INV' in fname or 'PAYMENT' in fname:
                            task_type = 'financial'

                        data['completed_tasks'].append({
                            'name': file.stem,
                            'type': task_type,
                            'completed': modified.isoformat()
                        })

                        data['categories'][task_type] = data['categories'].get(task_type, 0) + 1
                except Exception as e:
                    self.logger.warning(f'Error processing {file}: {e}')

            data['total_completed'] = len(data['completed_tasks'])

        # Simulated data if no tasks found
        if data['total_completed'] == 0:
            data = {
                'completed_tasks': [
                    {'name': 'Client email response', 'type': 'email', 'completed': datetime.now().isoformat()},
                    {'name': 'LinkedIn post', 'type': 'social_media', 'completed': datetime.now().isoformat()},
                    {'name': 'Invoice sent', 'type': 'financial', 'completed': datetime.now().isoformat()},
                ],
                'total_completed': 3,
                'categories': {'email': 5, 'social_media': 3, 'financial': 2},
                'bottlenecks': [],
                'simulated': True
            }

        return data

    def _collect_activity_data(self, start: datetime, end: datetime) -> Dict:
        """Collect activity data from dashboard and logs."""
        data = {
            'emails_processed': 0,
            'social_posts': 0,
            'approvals_processed': 0,
            'system_uptime': '99.9%',
            'recent_activities': []
        }

        # Parse dashboard for activity log
        dashboard_path = self.vault_path / 'Dashboard.md'
        if dashboard_path.exists():
            try:
                content = dashboard_path.read_text(encoding='utf-8')
                if '## Recent Activity' in content:
                    activity_section = content.split('## Recent Activity')[1]
                    if '##' in activity_section:
                        activity_section = activity_section.split('##')[0]

                    for line in activity_section.split('\n'):
                        if line.strip().startswith('- ['):
                            data['recent_activities'].append(line.strip())
                            if 'email' in line.lower():
                                data['emails_processed'] += 1
                            elif 'linkedin' in line.lower() or 'social' in line.lower():
                                data['social_posts'] += 1
                            elif 'approved' in line.lower():
                                data['approvals_processed'] += 1
            except Exception as e:
                self.logger.warning(f'Error reading dashboard: {e}')

        return data

    def _load_business_goals(self) -> Dict:
        """Load business goals from vault."""
        goals = {
            'monthly_revenue_target': 10000,
            'expense_budget': 500,
            'response_time_target': 24,  # hours
            'invoice_payment_rate_target': 90,  # percent
        }

        goals_path = self.vault_path / 'Business_Goals.md'
        if goals_path.exists():
            try:
                content = goals_path.read_text(encoding='utf-8')
                # Parse key metrics
                for line in content.split('\n'):
                    if 'monthly goal:' in line.lower():
                        try:
                            amount = float(line.split('$')[1].split()[0].replace(',', ''))
                            goals['monthly_revenue_target'] = amount
                        except:
                            pass
            except Exception as e:
                self.logger.warning(f'Error loading business goals: {e}')

        return goals

    def _analyze_data(self, financial: Dict, tasks: Dict, activity: Dict, goals: Dict) -> Dict:
        """Analyze collected data and generate insights."""
        analysis = {
            'revenue_status': 'on_track',
            'expense_status': 'normal',
            'productivity_status': 'good',
            'key_wins': [],
            'bottlenecks': [],
            'recommendations': []
        }

        # Revenue analysis
        mtd_target_pace = goals['monthly_revenue_target'] / 4  # Weekly target
        if financial['revenue'] >= mtd_target_pace:
            analysis['revenue_status'] = 'ahead'
            analysis['key_wins'].append(f"Revenue ahead of target: ${financial['revenue']:,.2f}")
        elif financial['revenue'] >= mtd_target_pace * 0.8:
            analysis['revenue_status'] = 'on_track'
        else:
            analysis['revenue_status'] = 'behind'
            analysis['recommendations'].append({
                'category': 'Revenue',
                'action': 'Increase sales focus',
                'reason': f"Revenue ${financial['revenue']:,.2f} is below weekly target",
                'impact': 'High'
            })

        # Expense analysis
        if financial['expenses'] > goals['expense_budget']:
            analysis['expense_status'] = 'over_budget'
            analysis['recommendations'].append({
                'category': 'Cost Optimization',
                'action': 'Review and reduce expenses',
                'reason': f"Expenses ${financial['expenses']:,.2f} exceed budget ${goals['expense_budget']}",
                'impact': 'Medium'
            })

        # Overdue invoices
        if financial['overdue_invoices']:
            analysis['bottlenecks'].append({
                'issue': 'Overdue Invoices',
                'impact': 'Medium',
                'action': f"Follow up on {len(financial['overdue_invoices'])} overdue invoice(s)"
            })

        # Task completion
        if tasks['total_completed'] >= 10:
            analysis['key_wins'].append(f"Completed {tasks['total_completed']} tasks this week")

        # Subscription review
        for sub in financial.get('subscriptions', []):
            if abs(sub['amount']) > 50:
                analysis['recommendations'].append({
                    'category': 'Subscription Review',
                    'action': f"Review {sub['description']}",
                    'reason': f"Monthly cost: ${abs(sub['amount'])}",
                    'impact': 'Low'
                })

        return analysis

    def _generate_briefing_content(self, start: datetime, end: datetime,
                                    financial: Dict, tasks: Dict, activity: Dict,
                                    social: Dict, goals: Dict, analysis: Dict) -> str:
        """Generate the full briefing markdown content."""

        # Calculate metrics
        net_profit = financial['revenue'] - financial['expenses']
        mtd_percent = (financial['revenue'] / goals['monthly_revenue_target']) * 100

        content = f"""---
generated: {datetime.now().isoformat()}
period_start: {start.strftime('%Y-%m-%d')}
period_end: {end.strftime('%Y-%m-%d')}
type: ceo_briefing
---

# Monday Morning CEO Briefing
## Week of {start.strftime('%B %d')} - {end.strftime('%B %d, %Y')}

### Executive Summary
"""

        # Add key points
        status_emoji = {'ahead': '✅', 'on_track': '✅', 'behind': '⚠️'}
        content += f"- {status_emoji.get(analysis['revenue_status'], '📊')} Revenue: ${financial['revenue']:,.2f} ({analysis['revenue_status']})\n"

        if financial['overdue_invoices']:
            content += f"- ⚠️ {len(financial['overdue_invoices'])} overdue invoice(s) requiring attention\n"
        else:
            content += "- ✅ All invoices current\n"

        content += f"- 🎯 Completed {tasks['total_completed']} tasks this week\n"

        if analysis['recommendations']:
            content += f"- 💡 {len(analysis['recommendations'])} optimization opportunity(ies) identified\n"

        content += f"""
### Financial Performance

| Metric | This Week | MTD | Target |
|--------|-----------|-----|--------|
| Revenue | ${financial['revenue']:,.2f} | ${financial['revenue']:,.2f} | ${goals['monthly_revenue_target']:,.2f} |
| Expenses | ${financial['expenses']:,.2f} | ${financial['expenses']:,.2f} | ${goals['expense_budget']:,.2f} |
| Net Profit | ${net_profit:,.2f} | ${net_profit:,.2f} | - |
| Outstanding | ${financial['outstanding_invoices']:,.2f} | - | - |

**Progress to Target:** {mtd_percent:.1f}% ({analysis['revenue_status'].replace('_', ' ').title()})

### Key Wins
"""

        for i, win in enumerate(analysis['key_wins'][:5], 1):
            content += f"{i}. {win}\n"

        if not analysis['key_wins']:
            content += "- Building momentum for next week\n"

        content += """
### Task Completion Summary

| Category | Completed |
|----------|-----------|
"""

        for category, count in tasks.get('categories', {}).items():
            content += f"| {category.replace('_', ' ').title()} | {count} |\n"

        content += f"\n**Total Tasks Completed:** {tasks['total_completed']}\n"

        # Social Media Section
        if social.get('tweets_posted', 0) > 0 or social.get('simulated'):
            content += """
### Social Media Performance (Twitter)

| Metric | Value |
|--------|-------|
"""
            content += f"| Tweets Posted | {social.get('tweets_posted', 0)} |\n"
            content += f"| Total Likes | {social.get('total_likes', 0)} |\n"
            content += f"| Total Retweets | {social.get('total_retweets', 0)} |\n"
            content += f"| Mentions Received | {social.get('mentions', 0)} |\n"
            content += f"| Followers | {social.get('followers', 0):,} |\n"

            if social.get('top_tweet'):
                top = social['top_tweet']
                content += f"""
**Top Performing Tweet:**
> {top.get('text', 'N/A')}
> - Likes: {top.get('likes', 0)} | Retweets: {top.get('retweets', 0)}
"""

        # Accounting Audit Section (from Odoo)
        if financial.get('aging'):
            aging = financial['aging']
            content += """
### Accounts Receivable Aging

| Bucket | Amount |
|--------|--------|
"""
            content += f"| Current (0-30 days) | ${aging.get('current', 0):,.2f} |\n"
            content += f"| 31-60 days | ${aging.get('days_1_30', 0):,.2f} |\n"
            content += f"| 61-90 days | ${aging.get('days_31_60', 0):,.2f} |\n"
            content += f"| Over 90 days | ${aging.get('over_90', 0):,.2f} |\n"
            content += f"| **Total Outstanding** | **${aging.get('total_outstanding', 0):,.2f}** |\n"

        # Cash Flow Section
        if financial.get('cash_flow'):
            content += f"""
### Cash Flow Summary

**Net Cash Change This Week:** ${financial['cash_flow']:,.2f}
"""

        if analysis['bottlenecks']:
            content += """
### Bottlenecks & Issues

| Issue | Impact | Suggested Action |
|-------|--------|------------------|
"""
            for bottleneck in analysis['bottlenecks']:
                content += f"| {bottleneck['issue']} | {bottleneck['impact']} | {bottleneck['action']} |\n"

        if analysis['recommendations']:
            content += """
### Proactive Recommendations
"""
            for i, rec in enumerate(analysis['recommendations'][:5], 1):
                content += f"""
**{i}. {rec['category']}**: {rec['action']}
- **Why:** {rec['reason']}
- **Expected Impact:** {rec['impact']}
"""

        if financial.get('subscriptions'):
            content += """
### Subscription Audit

| Service | Monthly Cost | Status |
|---------|-------------|--------|
"""
            total_sub_cost = 0
            for sub in financial['subscriptions']:
                cost = abs(sub['amount'])
                total_sub_cost += cost
                content += f"| {sub['description']} | ${cost:.2f} | Review |\n"

            content += f"\n**Total Monthly Subscriptions:** ${total_sub_cost:.2f}\n"

        content += f"""
### Week Ahead Priorities

1. Follow up on any outstanding invoices
2. Continue task execution from Needs_Action folder
3. Review and approve pending items
4. Monitor social media engagement
5. Prepare for upcoming deadlines

---
*Generated by AI Employee CEO Briefing System*
*Data sources: Accounting folder, Task logs, Dashboard analytics*
*Next briefing: {(end + timedelta(days=7)).strftime('%B %d, %Y')}*
"""

        if financial.get('simulated') or tasks.get('simulated'):
            content += "\n> **Note:** This briefing includes simulated data for demonstration purposes.\n"

        return content

    def _update_dashboard(self, briefing_filename: str):
        """Update dashboard with briefing generation notification."""
        dashboard_path = self.vault_path / 'Dashboard.md'

        if not dashboard_path.exists():
            return

        try:
            content = dashboard_path.read_text(encoding='utf-8')
            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            log_entry = f'- [{timestamp}] CEOBriefing: Generated {briefing_filename}\n'

            if '## Recent Activity' in content:
                parts = content.split('## Recent Activity\n', 1)
                updated_content = (
                    parts[0] +
                    '## Recent Activity\n' +
                    log_entry +
                    parts[1]
                )
                dashboard_path.write_text(updated_content, encoding='utf-8')
                self.logger.info('Dashboard updated')
        except Exception as e:
            self.logger.warning(f'Failed to update dashboard: {e}')


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Generate CEO Briefing')
    parser.add_argument('--vault', default='./AI_Employee_Vault', help='Path to vault')
    parser.add_argument('--days', type=int, default=7, help='Lookback period in days')

    args = parser.parse_args()

    generator = CEOBriefingGenerator(args.vault)
    filepath = generator.generate_briefing(args.days)
    print(f'Briefing generated: {filepath}')
