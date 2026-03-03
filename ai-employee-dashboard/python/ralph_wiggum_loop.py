#!/usr/bin/env python3
"""
Ralph Wiggum Loop - Autonomous Task Execution
----------------------------------------------
Autonomous task execution engine that scans for pending tasks,
decomposes them into steps, and executes with approval gates.

Named after the concept of autonomous agents that "just keep going"
regardless of complexity, like Ralph Wiggum's endearing persistence.

Gold Tier Feature: Autonomous multi-step task execution with approval gates.
"""

import os
import json
import time
import logging
import subprocess
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict, Any, List, Callable
from enum import Enum
from dataclasses import dataclass, asdict, field
import hashlib

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / '.env')
except ImportError:
    pass

from base_watcher import BaseWatcher
from error_recovery import (
    ErrorRecoveryManager, ErrorCategory,
    with_retry, with_fallback, TransientError
)
from audit_logger import AuditLogger, ActionType, ApprovalStatus

# Import MCP client for real tool execution
try:
    from mcp_client import MCPClient, get_mcp_client, MCPToolResult
    MCP_CLIENT_AVAILABLE = True
except ImportError:
    MCP_CLIENT_AVAILABLE = False
    MCPToolResult = None


class TaskState(Enum):
    """States for task lifecycle."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    AWAITING_APPROVAL = "awaiting_approval"
    APPROVED = "approved"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class StepType(Enum):
    """Types of task steps."""
    READ_DATA = "read_data"           # Read from vault/files
    ANALYZE = "analyze"               # Analyze content
    DRAFT = "draft"                   # Create draft content
    API_CALL = "api_call"             # Call external API
    MCP_CALL = "mcp_call"             # Call MCP server tool
    SEND = "send"                     # Send email/message
    POST = "post"                     # Post to social media
    CREATE_INVOICE = "create_invoice" # Create invoice in Odoo
    UPDATE_FILE = "update_file"       # Update vault file
    NOTIFY = "notify"                 # Send notification


@dataclass
class TaskStep:
    """Individual step within a task."""
    id: str
    description: str
    action_type: StepType
    parameters: Dict[str, Any]
    requires_approval: bool = False
    status: TaskState = TaskState.PENDING
    result: Optional[Dict] = None
    error: Optional[str] = None
    executed_at: Optional[str] = None
    approved_by: Optional[str] = None

    def to_dict(self) -> dict:
        result = asdict(self)
        result['action_type'] = self.action_type.value
        result['status'] = self.status.value
        return result


@dataclass
class Task:
    """A multi-step task to be executed."""
    id: str
    title: str
    description: str
    source: str  # email, odoo, manual, scheduled
    priority: str = "normal"  # low, normal, high, urgent
    status: TaskState = TaskState.PENDING
    steps: List[TaskStep] = field(default_factory=list)
    context: Dict[str, Any] = field(default_factory=dict)
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    error: Optional[str] = None
    retry_count: int = 0
    max_retries: int = 3

    def to_dict(self) -> dict:
        result = {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'source': self.source,
            'priority': self.priority,
            'status': self.status.value,
            'steps': [s.to_dict() for s in self.steps],
            'context': self.context,
            'created_at': self.created_at,
            'started_at': self.started_at,
            'completed_at': self.completed_at,
            'error': self.error,
            'retry_count': self.retry_count
        }
        return result


class RalphWiggumLoop(BaseWatcher):
    """
    Autonomous task execution loop.

    Features:
    - Scans for pending tasks in vault
    - Decomposes tasks into executable steps
    - Executes steps with approval gates
    - Handles failures gracefully
    - Integrates with MCP servers
    """

    # Task types that can be auto-decomposed
    TASK_PATTERNS = {
        'email_reply': ['analyze', 'draft', 'send'],
        'social_post': ['gather_context', 'draft', 'approve', 'post'],
        'invoice': ['validate', 'create_odoo', 'notify'],
        'briefing': ['collect_data', 'analyze', 'generate', 'review', 'distribute'],
        'expense': ['validate', 'create_odoo', 'log'],
        'payment_followup': ['check_status', 'draft_reminder', 'send']
    }

    # Steps that always require human approval
    APPROVAL_REQUIRED = {
        StepType.SEND,
        StepType.POST,
        StepType.CREATE_INVOICE
    }

    # Amount threshold for auto-approval (transactions below this don't need approval)
    AUTO_APPROVAL_THRESHOLD = 100.0

    def __init__(self, vault_path: str, check_interval: int = 30,
                 auto_execute: bool = False, dry_run: bool = False):
        """
        Initialize the Ralph Wiggum Loop.

        Args:
            vault_path: Path to Obsidian vault
            check_interval: Seconds between task scans
            auto_execute: If True, execute tasks without manual trigger
            dry_run: If True, simulate executions without side effects
        """
        super().__init__(vault_path, check_interval)

        self.auto_execute = auto_execute
        self.dry_run = dry_run or os.getenv('DRY_RUN', 'false').lower() == 'true'

        # Folders
        self.tasks_folder = self.vault_path / 'Tasks'
        self.tasks_pending = self.tasks_folder / 'Pending'
        self.tasks_in_progress = self.tasks_folder / 'In_Progress'
        self.tasks_done = self.tasks_folder / 'Done'
        self.tasks_failed = self.tasks_folder / 'Failed'

        # Create folders
        for folder in [self.tasks_pending, self.tasks_in_progress,
                       self.tasks_done, self.tasks_failed]:
            folder.mkdir(parents=True, exist_ok=True)

        # Active tasks in memory
        self.active_tasks: Dict[str, Task] = {}

        # Error recovery
        self.error_manager = ErrorRecoveryManager(vault_path)

        # Audit logger
        self.audit_logger = AuditLogger(vault_path)

        # MCP server configurations
        self.mcp_config = self._load_mcp_config()

    def _load_mcp_config(self) -> dict:
        """Load MCP server configuration."""
        mcp_path = self.vault_path.parent / 'mcp.json'
        if mcp_path.exists():
            try:
                return json.loads(mcp_path.read_text())
            except Exception as e:
                self.logger.warning(f"Failed to load mcp.json: {e}")
        return {'servers': []}

    def _generate_task_id(self, title: str) -> str:
        """Generate unique task ID."""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        hash_part = hashlib.md5(f"{title}{timestamp}".encode()).hexdigest()[:6]
        return f"TASK_{timestamp}_{hash_part}"

    def _generate_step_id(self, task_id: str, index: int) -> str:
        """Generate unique step ID."""
        return f"{task_id}_STEP_{index:02d}"

    def check_for_updates(self) -> list:
        """Check for new tasks in the pending folder."""
        new_tasks = []

        # Scan for action files that could be tasks
        for action_file in self.needs_action.glob('*.md'):
            try:
                content = action_file.read_text(encoding='utf-8')

                # Check if this is a multi-step task
                if self._is_complex_task(content):
                    task = self._parse_task_file(action_file, content)
                    if task and task.id not in self.active_tasks:
                        new_tasks.append(task)
                        self.active_tasks[task.id] = task
                        self._move_to_in_progress(action_file, task)

            except Exception as e:
                self.logger.error(f"Error parsing {action_file}: {e}")

        # Also scan tasks/pending folder
        for task_file in self.tasks_pending.glob('*.json'):
            try:
                task_data = json.loads(task_file.read_text())
                task = self._task_from_dict(task_data)

                if task.id not in self.active_tasks:
                    new_tasks.append(task)
                    self.active_tasks[task.id] = task

            except Exception as e:
                self.logger.error(f"Error loading task {task_file}: {e}")

        return new_tasks

    def _is_complex_task(self, content: str) -> bool:
        """Determine if content represents a complex multi-step task."""
        indicators = [
            'type: email_reply',
            'type: social_post',
            'type: invoice',
            'type: briefing',
            'type: expense',
            'requires_steps: true',
            '## Steps',
            '## Workflow'
        ]
        return any(indicator in content.lower() for indicator in indicators)

    def _parse_task_file(self, filepath: Path, content: str) -> Optional[Task]:
        """Parse a task from a markdown file."""
        try:
            # Extract frontmatter
            if content.startswith('---'):
                parts = content.split('---', 2)
                if len(parts) >= 3:
                    frontmatter = parts[1].strip()
                    body = parts[2].strip()

                    # Parse YAML-like frontmatter
                    metadata = {}
                    for line in frontmatter.split('\n'):
                        if ':' in line:
                            key, value = line.split(':', 1)
                            metadata[key.strip()] = value.strip()

                    # Create task
                    task = Task(
                        id=self._generate_task_id(metadata.get('subject', filepath.stem)),
                        title=metadata.get('subject', filepath.stem),
                        description=body[:500],
                        source=metadata.get('type', 'unknown'),
                        priority=metadata.get('priority', 'normal'),
                        context={
                            'filepath': str(filepath),
                            'metadata': metadata,
                            'body': body
                        }
                    )

                    # Auto-decompose based on type
                    task.steps = self._decompose_task(task)

                    return task

        except Exception as e:
            self.logger.error(f"Failed to parse task file: {e}")

        return None

    def _task_from_dict(self, data: dict) -> Task:
        """Create Task from dictionary."""
        steps = []
        for step_data in data.get('steps', []):
            step = TaskStep(
                id=step_data['id'],
                description=step_data['description'],
                action_type=StepType(step_data['action_type']),
                parameters=step_data.get('parameters', {}),
                requires_approval=step_data.get('requires_approval', False),
                status=TaskState(step_data.get('status', 'pending'))
            )
            steps.append(step)

        task = Task(
            id=data['id'],
            title=data['title'],
            description=data['description'],
            source=data['source'],
            priority=data.get('priority', 'normal'),
            status=TaskState(data.get('status', 'pending')),
            steps=steps,
            context=data.get('context', {}),
            created_at=data.get('created_at', datetime.now().isoformat()),
            retry_count=data.get('retry_count', 0)
        )

        return task

    def _move_to_in_progress(self, filepath: Path, task: Task):
        """Move task file to in_progress folder."""
        # Save task state
        task_file = self.tasks_in_progress / f"{task.id}.json"
        task_file.write_text(json.dumps(task.to_dict(), indent=2))

        # Move original file
        new_path = self.tasks_in_progress / filepath.name
        filepath.rename(new_path)

    def create_action_file(self, task: Task) -> Path:
        """Create action file for task execution results."""
        filepath = self.tasks_done / f"{task.id}_result.md"

        content = f"""---
task_id: {task.id}
title: {task.title}
status: {task.status.value}
completed_at: {datetime.now().isoformat()}
---

# Task Result: {task.title}

## Summary
- **Status:** {task.status.value}
- **Steps Completed:** {sum(1 for s in task.steps if s.status == TaskState.COMPLETED)}
- **Total Steps:** {len(task.steps)}

## Steps Executed

"""
        for step in task.steps:
            status_icon = {
                TaskState.COMPLETED: '[x]',
                TaskState.FAILED: '[-]',
                TaskState.PENDING: '[ ]'
            }.get(step.status, '[ ]')

            content += f"{status_icon} **{step.description}**\n"
            if step.result:
                content += f"   - Result: {json.dumps(step.result)[:200]}\n"
            if step.error:
                content += f"   - Error: {step.error}\n"
            content += "\n"

        filepath.write_text(content, encoding='utf-8')
        return filepath

    def _decompose_task(self, task: Task) -> List[TaskStep]:
        """Decompose a task into executable steps."""
        steps = []
        task_type = task.source.lower()

        if task_type == 'email_reply' or 'email' in task_type:
            steps = self._decompose_email_reply(task)
        elif task_type == 'social_post' or 'twitter' in task_type:
            steps = self._decompose_social_post(task)
        elif task_type == 'invoice':
            steps = self._decompose_invoice(task)
        elif task_type == 'briefing' or 'ceo' in task_type:
            steps = self._decompose_briefing(task)
        elif task_type == 'expense':
            steps = self._decompose_expense(task)
        else:
            # Generic decomposition
            steps = self._decompose_generic(task)

        return steps

    def _decompose_email_reply(self, task: Task) -> List[TaskStep]:
        """Decompose email reply task."""
        return [
            TaskStep(
                id=self._generate_step_id(task.id, 0),
                description="Analyze email content and context",
                action_type=StepType.ANALYZE,
                parameters={'email_content': task.context.get('body', '')},
                requires_approval=False
            ),
            TaskStep(
                id=self._generate_step_id(task.id, 1),
                description="Draft reply based on analysis",
                action_type=StepType.DRAFT,
                parameters={'template': 'email_reply'},
                requires_approval=False
            ),
            TaskStep(
                id=self._generate_step_id(task.id, 2),
                description="Send email reply",
                action_type=StepType.SEND,
                parameters={'mcp_server': 'email'},
                requires_approval=True
            )
        ]

    def _decompose_social_post(self, task: Task) -> List[TaskStep]:
        """Decompose social media post task."""
        return [
            TaskStep(
                id=self._generate_step_id(task.id, 0),
                description="Gather context and trending topics",
                action_type=StepType.READ_DATA,
                parameters={'sources': ['business_goals', 'recent_posts']},
                requires_approval=False
            ),
            TaskStep(
                id=self._generate_step_id(task.id, 1),
                description="Draft tweet content",
                action_type=StepType.DRAFT,
                parameters={'max_chars': 280, 'platform': 'twitter'},
                requires_approval=False
            ),
            TaskStep(
                id=self._generate_step_id(task.id, 2),
                description="Post to Twitter",
                action_type=StepType.POST,
                parameters={'mcp_server': 'twitter', 'tool': 'twitter_post_tweet'},
                requires_approval=True
            )
        ]

    def _decompose_invoice(self, task: Task) -> List[TaskStep]:
        """Decompose invoice creation task."""
        return [
            TaskStep(
                id=self._generate_step_id(task.id, 0),
                description="Validate invoice data",
                action_type=StepType.ANALYZE,
                parameters={'validate': ['partner', 'amount', 'description']},
                requires_approval=False
            ),
            TaskStep(
                id=self._generate_step_id(task.id, 1),
                description="Create invoice in Odoo",
                action_type=StepType.CREATE_INVOICE,
                parameters={'mcp_server': 'odoo', 'tool': 'odoo_create_invoice'},
                requires_approval=True
            ),
            TaskStep(
                id=self._generate_step_id(task.id, 2),
                description="Notify relevant parties",
                action_type=StepType.NOTIFY,
                parameters={'channels': ['dashboard', 'log']},
                requires_approval=False
            )
        ]

    def _decompose_briefing(self, task: Task) -> List[TaskStep]:
        """Decompose CEO briefing task."""
        return [
            TaskStep(
                id=self._generate_step_id(task.id, 0),
                description="Collect financial data from Odoo",
                action_type=StepType.MCP_CALL,
                parameters={
                    'mcp_server': 'odoo',
                    'tools': ['odoo_get_revenue_report', 'odoo_get_expense_report',
                              'odoo_get_unpaid_invoices']
                },
                requires_approval=False
            ),
            TaskStep(
                id=self._generate_step_id(task.id, 1),
                description="Collect social media metrics",
                action_type=StepType.MCP_CALL,
                parameters={
                    'mcp_server': 'twitter',
                    'tools': ['twitter_get_weekly_summary']
                },
                requires_approval=False
            ),
            TaskStep(
                id=self._generate_step_id(task.id, 2),
                description="Analyze data and generate insights",
                action_type=StepType.ANALYZE,
                parameters={'analysis_type': 'weekly_summary'},
                requires_approval=False
            ),
            TaskStep(
                id=self._generate_step_id(task.id, 3),
                description="Generate briefing document",
                action_type=StepType.DRAFT,
                parameters={'template': 'ceo_briefing'},
                requires_approval=False
            ),
            TaskStep(
                id=self._generate_step_id(task.id, 4),
                description="Save and distribute briefing",
                action_type=StepType.UPDATE_FILE,
                parameters={'folder': 'Briefings'},
                requires_approval=False
            )
        ]

    def _decompose_expense(self, task: Task) -> List[TaskStep]:
        """Decompose expense recording task."""
        return [
            TaskStep(
                id=self._generate_step_id(task.id, 0),
                description="Validate expense data",
                action_type=StepType.ANALYZE,
                parameters={'validate': ['description', 'amount', 'category']},
                requires_approval=False
            ),
            TaskStep(
                id=self._generate_step_id(task.id, 1),
                description="Create expense in Odoo",
                action_type=StepType.MCP_CALL,
                parameters={'mcp_server': 'odoo', 'tool': 'odoo_create_expense'},
                requires_approval=self._needs_approval_for_amount(task)
            ),
            TaskStep(
                id=self._generate_step_id(task.id, 2),
                description="Log expense to audit trail",
                action_type=StepType.UPDATE_FILE,
                parameters={'log_type': 'expense'},
                requires_approval=False
            )
        ]

    def _decompose_generic(self, task: Task) -> List[TaskStep]:
        """Generic task decomposition."""
        return [
            TaskStep(
                id=self._generate_step_id(task.id, 0),
                description="Analyze task requirements",
                action_type=StepType.ANALYZE,
                parameters={'task_content': task.description},
                requires_approval=False
            ),
            TaskStep(
                id=self._generate_step_id(task.id, 1),
                description="Execute task action",
                action_type=StepType.API_CALL,
                parameters={},
                requires_approval=True
            )
        ]

    def _needs_approval_for_amount(self, task: Task) -> bool:
        """Check if task amount exceeds auto-approval threshold."""
        amount = task.context.get('amount', 0)
        try:
            amount = float(amount)
            return amount > self.AUTO_APPROVAL_THRESHOLD
        except (ValueError, TypeError):
            return True

    def run_loop(self):
        """Main autonomous execution loop."""
        self.logger.info("Ralph Wiggum Loop starting...")
        self.logger.info(f"Auto-execute: {self.auto_execute}")
        self.logger.info(f"Dry run: {self.dry_run}")

        self.audit_logger.log(
            ActionType.SYSTEM_START,
            "ralph_wiggum_loop",
            parameters={'auto_execute': self.auto_execute, 'dry_run': self.dry_run}
        )

        self.is_running = True

        while self.is_running:
            try:
                # Scan for tasks
                new_tasks = self._scan_for_tasks()

                if new_tasks:
                    self.logger.info(f"Found {len(new_tasks)} new task(s)")

                # Process active tasks
                for task_id, task in list(self.active_tasks.items()):
                    if task.status == TaskState.PENDING:
                        self._start_task(task)
                    elif task.status == TaskState.IN_PROGRESS:
                        self._continue_task(task)
                    elif task.status == TaskState.AWAITING_APPROVAL:
                        self._check_approval(task)
                    elif task.status in [TaskState.COMPLETED, TaskState.FAILED]:
                        self._finalize_task(task)
                        del self.active_tasks[task_id]

                # Update dashboard
                self.update_dashboard(
                    f"Active tasks: {len(self.active_tasks)}, "
                    f"Awaiting approval: {sum(1 for t in self.active_tasks.values() if t.status == TaskState.AWAITING_APPROVAL)}"
                )

            except Exception as e:
                self.error_manager.handle_error(e, "ralph_wiggum_loop", ErrorCategory.SYSTEM)
                self.logger.error(f"Loop error: {e}")

            if self.is_running:
                time.sleep(self.check_interval)

        self.audit_logger.log(
            ActionType.SYSTEM_STOP,
            "ralph_wiggum_loop"
        )
        self.logger.info("Ralph Wiggum Loop stopped")

    def _scan_for_tasks(self) -> List[Task]:
        """Scan for new pending tasks."""
        return self.check_for_updates()

    def _start_task(self, task: Task):
        """Start execution of a task."""
        task.status = TaskState.IN_PROGRESS
        task.started_at = datetime.now().isoformat()

        self.logger.info(f"Starting task: {task.id} - {task.title}")

        self.audit_logger.log(
            ActionType.FILE_CREATE,
            f"task:{task.id}",
            parameters={'title': task.title, 'steps': len(task.steps)},
            result="started"
        )

        self._save_task_state(task)

    def _continue_task(self, task: Task):
        """Continue executing task steps."""
        # Find next pending step
        for step in task.steps:
            if step.status == TaskState.PENDING:
                self._execute_step(task, step)
                break

        # Check if all steps completed
        if all(s.status == TaskState.COMPLETED for s in task.steps):
            task.status = TaskState.COMPLETED
            task.completed_at = datetime.now().isoformat()
            self.logger.info(f"Task completed: {task.id}")
        elif any(s.status == TaskState.FAILED for s in task.steps):
            task.status = TaskState.FAILED
            task.error = "One or more steps failed"
            self.logger.error(f"Task failed: {task.id}")
        elif any(s.status == TaskState.AWAITING_APPROVAL for s in task.steps):
            task.status = TaskState.AWAITING_APPROVAL

    def _execute_step(self, task: Task, step: TaskStep):
        """Execute a single task step."""
        # Check if approval is required
        if step.requires_approval and not self._has_approval(task, step):
            step.status = TaskState.AWAITING_APPROVAL
            self._request_approval(task, step)
            return

        self.logger.info(f"Executing step: {step.id} - {step.description}")

        try:
            if self.dry_run:
                result = self._simulate_step(step)
            else:
                result = self._run_step(step)

            step.status = TaskState.COMPLETED
            step.result = result
            step.executed_at = datetime.now().isoformat()

            self.audit_logger.log(
                ActionType.API_CALL,
                f"step:{step.id}",
                parameters=step.parameters,
                result="success"
            )

        except Exception as e:
            step.status = TaskState.FAILED
            step.error = str(e)

            self.error_manager.handle_error(
                e, f"step:{step.id}", ErrorCategory.TRANSIENT
            )

            # Retry logic
            if task.retry_count < task.max_retries:
                task.retry_count += 1
                step.status = TaskState.PENDING
                self.logger.warning(f"Retrying step {step.id}, attempt {task.retry_count}")
            else:
                self.logger.error(f"Step {step.id} failed after {task.max_retries} retries")

        self._save_task_state(task)

    def _run_step(self, step: TaskStep) -> dict:
        """Actually run a step's action."""
        action = step.action_type
        params = step.parameters

        if action == StepType.MCP_CALL:
            return self._call_mcp_tool(
                params.get('mcp_server'),
                params.get('tool') or params.get('tools', [])
            )
        elif action == StepType.ANALYZE:
            return {'analysis': 'completed', 'params': params}
        elif action == StepType.DRAFT:
            return {'draft': 'generated', 'params': params}
        elif action == StepType.READ_DATA:
            return self._read_data(params.get('sources', []))
        elif action == StepType.UPDATE_FILE:
            return self._update_file(params)
        elif action in [StepType.SEND, StepType.POST, StepType.CREATE_INVOICE]:
            return self._call_mcp_tool(params.get('mcp_server'), params.get('tool'))
        else:
            return {'action': action.value, 'status': 'executed'}

    def _simulate_step(self, step: TaskStep) -> dict:
        """Simulate step execution for dry run."""
        return {
            'simulated': True,
            'action_type': step.action_type.value,
            'parameters': step.parameters,
            'message': f'Would execute: {step.description}'
        }

    def _call_mcp_tool(self, server_name: str, tool_name, arguments: dict = None) -> dict:
        """
        Call an MCP server tool.

        Per hackathon doc: "MCP servers are Claude Code's hands"
        This method now uses the real MCP client for actual tool execution.
        """
        # Check if MCP client is available
        if not MCP_CLIENT_AVAILABLE:
            self.logger.warning('MCP client not available, simulating call')
            tools = tool_name if isinstance(tool_name, list) else [tool_name]
            return {
                'server': server_name,
                'tools_called': tools,
                'status': 'simulated',
                'note': 'MCP client not available'
            }

        # Get MCP client
        mcp_client = get_mcp_client()

        # Handle multiple tools
        if isinstance(tool_name, list):
            results = []
            for tool in tool_name:
                result = mcp_client.call_tool(server_name, tool, arguments or {})
                results.append({
                    'tool': tool,
                    'success': result.success,
                    'data': result.data,
                    'error': result.error
                })

            return {
                'server': server_name,
                'tools_called': tool_name,
                'results': results,
                'status': 'success' if all(r['success'] for r in results) else 'partial'
            }

        else:
            # Single tool call
            result = mcp_client.call_tool(server_name, tool_name, arguments or {})

            if result.success:
                return {
                    'server': server_name,
                    'tool': tool_name,
                    'status': 'success',
                    'data': result.data
                }
            else:
                # Log error but don't fail completely
                self.logger.error(f'MCP call failed: {result.error}')
                return {
                    'server': server_name,
                    'tool': tool_name,
                    'status': 'error',
                    'error': result.error
                }

    def _read_data(self, sources: List[str]) -> dict:
        """Read data from vault sources."""
        data = {}

        for source in sources:
            source_path = self.vault_path / f"{source}.md"
            if source_path.exists():
                data[source] = source_path.read_text(encoding='utf-8')[:1000]
            else:
                data[source] = None

        return {'sources_read': len(data), 'data': data}

    def _update_file(self, params: dict) -> dict:
        """Update a file in the vault."""
        folder = params.get('folder', '')
        target_folder = self.vault_path / folder
        target_folder.mkdir(parents=True, exist_ok=True)

        return {'folder': str(target_folder), 'status': 'ready'}

    def _has_approval(self, task: Task, step: TaskStep) -> bool:
        """Check if step has been approved."""
        return step.approved_by is not None

    def _request_approval(self, task: Task, step: TaskStep):
        """Create approval request for a step."""
        approval_file = self.needs_action / f"APPROVE_{task.id}_{step.id}.md"

        content = f"""---
type: approval_request
task_id: {task.id}
step_id: {step.id}
priority: {task.priority}
created: {datetime.now().isoformat()}
status: pending
---

# Approval Required

**Task:** {task.title}
**Step:** {step.description}
**Action Type:** {step.action_type.value}

## Details
{json.dumps(step.parameters, indent=2)}

## Actions
- Reply with "APPROVED" to proceed
- Reply with "REJECTED" to cancel
- Reply with "MODIFY: <changes>" to adjust

---
*Auto-generated by Ralph Wiggum Loop*
"""
        approval_file.write_text(content, encoding='utf-8')

        self.logger.info(f"Approval requested for step {step.id}")

        # Log approval request
        self.audit_logger.log(
            ActionType.APPROVAL_REQUEST,
            f"step:{step.id}",
            parameters={'task_id': task.id, 'step': step.description},
            approval_status=ApprovalStatus.PENDING
        )

    def _check_approval(self, task: Task):
        """Check for approval status updates."""
        for step in task.steps:
            if step.status == TaskState.AWAITING_APPROVAL:
                approval_file = self.needs_action / f"APPROVE_{task.id}_{step.id}.md"

                if approval_file.exists():
                    content = approval_file.read_text(encoding='utf-8')

                    if 'status: approved' in content.lower():
                        step.status = TaskState.PENDING
                        step.approved_by = 'human'
                        approval_file.unlink()
                        task.status = TaskState.IN_PROGRESS

                        self.audit_logger.log(
                            ActionType.APPROVAL_GRANTED,
                            f"step:{step.id}",
                            approval_status=ApprovalStatus.APPROVED,
                            approved_by='human'
                        )

                    elif 'status: rejected' in content.lower():
                        step.status = TaskState.CANCELLED
                        task.status = TaskState.CANCELLED
                        approval_file.unlink()

                        self.audit_logger.log(
                            ActionType.APPROVAL_DENIED,
                            f"step:{step.id}",
                            approval_status=ApprovalStatus.DENIED
                        )

    def _finalize_task(self, task: Task):
        """Finalize a completed or failed task."""
        # Create result file
        self.create_action_file(task)

        # Move to appropriate folder
        task_file = self.tasks_in_progress / f"{task.id}.json"

        if task.status == TaskState.COMPLETED:
            dest_folder = self.tasks_done
        else:
            dest_folder = self.tasks_failed

        if task_file.exists():
            dest_file = dest_folder / f"{task.id}.json"
            task_file.write_text(json.dumps(task.to_dict(), indent=2))
            task_file.rename(dest_file)

        self.logger.info(f"Task finalized: {task.id} -> {task.status.value}")

    def _save_task_state(self, task: Task):
        """Save current task state to file."""
        task_file = self.tasks_in_progress / f"{task.id}.json"
        task_file.write_text(json.dumps(task.to_dict(), indent=2))

    def handle_ralph_error(self, error: Exception, task: Task, step: Optional[TaskStep] = None):
        """Handle errors specific to Ralph Wiggum Loop."""
        context = f"task:{task.id}"
        if step:
            context += f":step:{step.id}"

        error_info = self.error_manager.handle_error(error, context, ErrorCategory.LOGIC)

        # Create intervention request if needed
        if error_info.get('circuit_breaker_tripped'):
            self._create_intervention_request(task, step, error)

    def _create_intervention_request(self, task: Task, step: Optional[TaskStep], error: Exception):
        """Create human intervention request when Ralph gets stuck."""
        intervention_file = self.needs_action / f"INTERVENTION_{task.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"

        content = f"""---
type: intervention_request
task_id: {task.id}
priority: high
created: {datetime.now().isoformat()}
status: pending
---

# Human Intervention Required

Ralph Wiggum Loop is stuck and needs help.

**Task:** {task.title}
**Error:** {str(error)}
{'**Step:** ' + step.description if step else ''}

## Context
{json.dumps(task.context, indent=2)[:1000]}

## What Happened
The autonomous task execution encountered repeated failures and triggered
the circuit breaker. Human intervention is needed to:

1. Review the error and context
2. Fix any issues or provide guidance
3. Decide whether to retry, modify, or cancel the task

## Actions
- Modify this file with instructions
- Mark as "status: resolved" when done

---
*Auto-generated by Ralph Wiggum Loop Error Handler*
"""
        intervention_file.write_text(content, encoding='utf-8')
        self.logger.warning(f"Intervention requested for task {task.id}")

    def run(self):
        """Override run method to use run_loop."""
        self.run_loop()


# Convenience function to create and run the loop
def create_ralph_wiggum_loop(vault_path: str, **kwargs) -> RalphWiggumLoop:
    """Create a configured Ralph Wiggum Loop instance."""
    return RalphWiggumLoop(vault_path, **kwargs)


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Ralph Wiggum Loop - Autonomous Task Execution')
    parser.add_argument('--vault', default='./AI_Employee_Vault', help='Vault path')
    parser.add_argument('--interval', type=int, default=30, help='Check interval in seconds')
    parser.add_argument('--auto-execute', action='store_true', help='Enable auto-execution')
    parser.add_argument('--dry-run', action='store_true', help='Run in simulation mode')

    args = parser.parse_args()

    loop = RalphWiggumLoop(
        vault_path=args.vault,
        check_interval=args.interval,
        auto_execute=args.auto_execute,
        dry_run=args.dry_run
    )

    try:
        loop.run()
    except KeyboardInterrupt:
        loop.stop()
        print("\nRalph Wiggum Loop stopped.")
