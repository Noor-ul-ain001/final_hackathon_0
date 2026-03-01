"""
Comprehensive Audit Logging System
----------------------------------
Logs all AI actions for compliance, debugging, and review.
Every action the AI takes is logged with full context.

Gold Tier Feature: Comprehensive audit logging.
"""

import os
import json
import hashlib
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict, Any, List
import logging
from enum import Enum
from dataclasses import dataclass, asdict


class ActionType(Enum):
    """Types of actions that can be logged."""
    # Email actions
    EMAIL_SEND = "email_send"
    EMAIL_READ = "email_read"
    EMAIL_DRAFT = "email_draft"

    # Social media actions
    SOCIAL_POST = "social_post"
    SOCIAL_SCHEDULE = "social_schedule"

    # Gold Tier: Twitter-specific actions
    TWITTER_POST = "twitter_post"
    TWITTER_REPLY = "twitter_reply"
    TWITTER_ENGAGEMENT = "twitter_engagement"

    # Payment actions
    PAYMENT_REQUEST = "payment_request"
    PAYMENT_APPROVED = "payment_approved"

    # Gold Tier: Odoo accounting actions
    ODOO_INVOICE_CREATE = "odoo_invoice_create"
    ODOO_INVOICE_SEND = "odoo_invoice_send"
    ODOO_PAYMENT_RECORD = "odoo_payment_record"
    ODOO_EXPENSE_CREATE = "odoo_expense_create"
    ODOO_REPORT_GENERATE = "odoo_report_generate"

    # File actions
    FILE_CREATE = "file_create"
    FILE_MODIFY = "file_modify"
    FILE_DELETE = "file_delete"

    # Approval actions
    APPROVAL_REQUEST = "approval_request"
    APPROVAL_GRANTED = "approval_granted"
    APPROVAL_DENIED = "approval_denied"

    # Gold Tier: Ralph Wiggum Loop actions
    RALPH_TASK_START = "ralph_task_start"
    RALPH_TASK_COMPLETE = "ralph_task_complete"
    RALPH_TASK_FAIL = "ralph_task_fail"
    RALPH_STEP_EXECUTE = "ralph_step_execute"
    RALPH_STEP_APPROVE = "ralph_step_approve"
    RALPH_INTERVENTION = "ralph_intervention"

    # Gold Tier: CEO Briefing actions
    CEO_BRIEFING_GENERATE = "ceo_briefing_generate"
    CEO_BRIEFING_DISTRIBUTE = "ceo_briefing_distribute"

    # Gold Tier: Skill invocation
    SKILL_INVOKE = "skill_invoke"
    SKILL_COMPLETE = "skill_complete"

    # MCP actions
    MCP_CALL = "mcp_call"
    MCP_RESULT = "mcp_result"

    # System actions
    API_CALL = "api_call"
    ERROR = "error"
    SYSTEM_START = "system_start"
    SYSTEM_STOP = "system_stop"
    CONFIG_CHANGE = "config_change"
    BRIEFING_GENERATED = "briefing_generated"


class ApprovalStatus(Enum):
    """Status of approval for actions."""
    AUTO_APPROVED = "auto_approved"
    PENDING = "pending"
    APPROVED = "approved"
    DENIED = "denied"
    NOT_REQUIRED = "not_required"


@dataclass
class AuditEntry:
    """Structured audit log entry."""
    timestamp: str
    action_type: str
    actor: str
    target: str
    parameters: Dict[str, Any]
    approval_status: str
    approved_by: Optional[str]
    result: str
    duration_ms: Optional[int] = None
    error_message: Optional[str] = None
    correlation_id: Optional[str] = None
    session_id: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), indent=2, default=str)


class AuditLogger:
    """
    Comprehensive audit logging for all AI Employee actions.
    """

    # Minimum retention period in days
    RETENTION_DAYS = 90

    def __init__(self, vault_path: str, session_id: Optional[str] = None):
        """
        Initialize the audit logger.

        Args:
            vault_path: Path to the Obsidian vault
            session_id: Optional session identifier
        """
        self.vault_path = Path(vault_path)
        self.logs_folder = self.vault_path / 'Logs'
        self.logs_folder.mkdir(parents=True, exist_ok=True)

        self.session_id = session_id or self._generate_session_id()
        self.correlation_id = None

        self.logger = logging.getLogger('AuditLogger')
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            handler.setFormatter(logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            ))
            self.logger.addHandler(handler)
            self.logger.setLevel(logging.INFO)

    def _generate_session_id(self) -> str:
        """Generate a unique session ID."""
        return hashlib.md5(
            f'{datetime.now().isoformat()}-{os.getpid()}'.encode()
        ).hexdigest()[:12]

    def set_correlation_id(self, correlation_id: str):
        """Set correlation ID for tracking related actions."""
        self.correlation_id = correlation_id

    def log(
        self,
        action_type: ActionType,
        target: str,
        parameters: Optional[Dict] = None,
        result: str = "success",
        approval_status: ApprovalStatus = ApprovalStatus.NOT_REQUIRED,
        approved_by: Optional[str] = None,
        duration_ms: Optional[int] = None,
        error_message: Optional[str] = None
    ) -> AuditEntry:
        """
        Log an action to the audit trail.

        Args:
            action_type: Type of action being logged
            target: What the action was performed on
            parameters: Additional parameters/context
            result: Result of the action (success, failure, etc.)
            approval_status: Whether approval was needed/granted
            approved_by: Who approved (human or auto)
            duration_ms: How long the action took
            error_message: Error message if action failed

        Returns:
            The created AuditEntry
        """
        entry = AuditEntry(
            timestamp=datetime.now().isoformat(),
            action_type=action_type.value,
            actor="claude_code",
            target=target,
            parameters=parameters or {},
            approval_status=approval_status.value,
            approved_by=approved_by,
            result=result,
            duration_ms=duration_ms,
            error_message=error_message,
            correlation_id=self.correlation_id,
            session_id=self.session_id
        )

        # Write to daily log file
        self._write_log(entry)

        # Log to Python logger as well
        log_level = logging.ERROR if result == "failure" else logging.INFO
        self.logger.log(log_level, f'[{action_type.value}] {target} -> {result}')

        return entry

    def log_email_send(
        self,
        to: str,
        subject: str,
        approval_status: ApprovalStatus,
        approved_by: Optional[str] = None,
        result: str = "success"
    ) -> AuditEntry:
        """Convenience method for logging email sends."""
        return self.log(
            action_type=ActionType.EMAIL_SEND,
            target=to,
            parameters={'subject': subject},
            approval_status=approval_status,
            approved_by=approved_by,
            result=result
        )

    def log_social_post(
        self,
        platform: str,
        content_preview: str,
        approval_status: ApprovalStatus,
        result: str = "success"
    ) -> AuditEntry:
        """Convenience method for logging social media posts."""
        return self.log(
            action_type=ActionType.SOCIAL_POST,
            target=platform,
            parameters={'content_preview': content_preview[:100]},
            approval_status=approval_status,
            result=result
        )

    def log_payment(
        self,
        amount: float,
        recipient: str,
        reference: str,
        approval_status: ApprovalStatus,
        approved_by: Optional[str] = None,
        result: str = "success"
    ) -> AuditEntry:
        """Convenience method for logging payment actions."""
        return self.log(
            action_type=ActionType.PAYMENT_REQUEST,
            target=recipient,
            parameters={'amount': amount, 'reference': reference},
            approval_status=approval_status,
            approved_by=approved_by,
            result=result
        )

    def log_file_operation(
        self,
        operation: str,
        filepath: str,
        result: str = "success"
    ) -> AuditEntry:
        """Log file operations."""
        action_map = {
            'create': ActionType.FILE_CREATE,
            'modify': ActionType.FILE_MODIFY,
            'delete': ActionType.FILE_DELETE
        }
        return self.log(
            action_type=action_map.get(operation, ActionType.FILE_MODIFY),
            target=filepath,
            result=result
        )

    def log_error(
        self,
        context: str,
        error_message: str,
        parameters: Optional[Dict] = None
    ) -> AuditEntry:
        """Log an error event."""
        return self.log(
            action_type=ActionType.ERROR,
            target=context,
            parameters=parameters,
            result="failure",
            error_message=error_message
        )

    # Gold Tier: Odoo logging methods
    def log_odoo_invoice(
        self,
        invoice_id: str,
        partner: str,
        amount: float,
        approval_status: ApprovalStatus,
        approved_by: Optional[str] = None,
        result: str = "success"
    ) -> AuditEntry:
        """Log Odoo invoice creation."""
        return self.log(
            action_type=ActionType.ODOO_INVOICE_CREATE,
            target=f"invoice:{invoice_id}",
            parameters={'partner': partner, 'amount': amount},
            approval_status=approval_status,
            approved_by=approved_by,
            result=result
        )

    def log_odoo_payment(
        self,
        payment_id: str,
        invoice_id: str,
        amount: float,
        result: str = "success"
    ) -> AuditEntry:
        """Log Odoo payment recording."""
        return self.log(
            action_type=ActionType.ODOO_PAYMENT_RECORD,
            target=f"payment:{payment_id}",
            parameters={'invoice_id': invoice_id, 'amount': amount},
            result=result
        )

    def log_odoo_expense(
        self,
        expense_id: str,
        description: str,
        amount: float,
        category: str,
        result: str = "success"
    ) -> AuditEntry:
        """Log Odoo expense creation."""
        return self.log(
            action_type=ActionType.ODOO_EXPENSE_CREATE,
            target=f"expense:{expense_id}",
            parameters={'description': description, 'amount': amount, 'category': category},
            result=result
        )

    # Gold Tier: Twitter logging methods
    def log_twitter_post(
        self,
        tweet_id: str,
        content_preview: str,
        approval_status: ApprovalStatus,
        approved_by: Optional[str] = None,
        result: str = "success"
    ) -> AuditEntry:
        """Log Twitter post."""
        return self.log(
            action_type=ActionType.TWITTER_POST,
            target=f"tweet:{tweet_id}",
            parameters={'content_preview': content_preview[:100]},
            approval_status=approval_status,
            approved_by=approved_by,
            result=result
        )

    def log_twitter_reply(
        self,
        tweet_id: str,
        reply_to: str,
        content_preview: str,
        result: str = "success"
    ) -> AuditEntry:
        """Log Twitter reply."""
        return self.log(
            action_type=ActionType.TWITTER_REPLY,
            target=f"tweet:{tweet_id}",
            parameters={'reply_to': reply_to, 'content_preview': content_preview[:100]},
            result=result
        )

    # Gold Tier: Ralph Wiggum Loop logging methods
    def log_ralph_task_start(
        self,
        task_id: str,
        title: str,
        step_count: int
    ) -> AuditEntry:
        """Log Ralph task start."""
        return self.log(
            action_type=ActionType.RALPH_TASK_START,
            target=f"task:{task_id}",
            parameters={'title': title, 'step_count': step_count},
            result="started"
        )

    def log_ralph_task_complete(
        self,
        task_id: str,
        title: str,
        steps_completed: int,
        duration_ms: Optional[int] = None
    ) -> AuditEntry:
        """Log Ralph task completion."""
        return self.log(
            action_type=ActionType.RALPH_TASK_COMPLETE,
            target=f"task:{task_id}",
            parameters={'title': title, 'steps_completed': steps_completed},
            duration_ms=duration_ms,
            result="success"
        )

    def log_ralph_step_execute(
        self,
        task_id: str,
        step_id: str,
        description: str,
        action_type_str: str,
        result: str = "success",
        error_message: Optional[str] = None
    ) -> AuditEntry:
        """Log Ralph step execution."""
        return self.log(
            action_type=ActionType.RALPH_STEP_EXECUTE,
            target=f"step:{step_id}",
            parameters={'task_id': task_id, 'description': description, 'step_action': action_type_str},
            result=result,
            error_message=error_message
        )

    # Gold Tier: CEO Briefing logging methods
    def log_ceo_briefing(
        self,
        briefing_id: str,
        period: str,
        sections: List[str],
        result: str = "success"
    ) -> AuditEntry:
        """Log CEO briefing generation."""
        return self.log(
            action_type=ActionType.CEO_BRIEFING_GENERATE,
            target=f"briefing:{briefing_id}",
            parameters={'period': period, 'sections': sections},
            result=result
        )

    # Gold Tier: Skill invocation logging
    def log_skill_invoke(
        self,
        skill_name: str,
        parameters: Optional[Dict] = None,
        result: str = "success"
    ) -> AuditEntry:
        """Log skill invocation."""
        return self.log(
            action_type=ActionType.SKILL_INVOKE,
            target=f"skill:{skill_name}",
            parameters=parameters or {},
            result=result
        )

    def _write_log(self, entry: AuditEntry):
        """Write audit entry to daily JSON log file."""
        date_str = datetime.now().strftime('%Y-%m-%d')
        log_file = self.logs_folder / f'{date_str}_audit.json'

        # Load existing entries or create new list
        if log_file.exists():
            try:
                entries = json.loads(log_file.read_text())
            except json.JSONDecodeError:
                entries = []
        else:
            entries = []

        entries.append(entry.to_dict())

        # Write back
        log_file.write_text(json.dumps(entries, indent=2, default=str))

    def get_logs(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        action_type: Optional[ActionType] = None,
        result: Optional[str] = None
    ) -> List[AuditEntry]:
        """
        Retrieve audit logs with optional filtering.

        Args:
            start_date: Filter logs from this date
            end_date: Filter logs until this date
            action_type: Filter by action type
            result: Filter by result (success/failure)

        Returns:
            List of matching AuditEntry objects
        """
        if not start_date:
            start_date = datetime.now() - timedelta(days=7)
        if not end_date:
            end_date = datetime.now()

        entries = []

        for log_file in self.logs_folder.glob('*_audit.json'):
            try:
                file_date_str = log_file.stem.split('_')[0]
                file_date = datetime.strptime(file_date_str, '%Y-%m-%d')

                if start_date.date() <= file_date.date() <= end_date.date():
                    file_entries = json.loads(log_file.read_text())
                    for entry_dict in file_entries:
                        # Apply filters
                        if action_type and entry_dict.get('action_type') != action_type.value:
                            continue
                        if result and entry_dict.get('result') != result:
                            continue

                        entries.append(AuditEntry(**entry_dict))
            except Exception as e:
                self.logger.warning(f'Error reading {log_file}: {e}')

        return sorted(entries, key=lambda x: x.timestamp, reverse=True)

    def generate_audit_report(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> str:
        """
        Generate a human-readable audit report.

        Args:
            start_date: Report start date
            end_date: Report end date

        Returns:
            Markdown-formatted audit report
        """
        entries = self.get_logs(start_date, end_date)

        if not entries:
            return "# Audit Report\n\nNo entries found for the specified period."

        # Group by action type
        by_type = {}
        successes = 0
        failures = 0

        for entry in entries:
            action = entry.action_type
            by_type[action] = by_type.get(action, 0) + 1
            if entry.result == 'success':
                successes += 1
            else:
                failures += 1

        report = f"""# Audit Report

**Period:** {start_date.strftime('%Y-%m-%d') if start_date else 'Last 7 days'} to {end_date.strftime('%Y-%m-%d') if end_date else 'Now'}
**Generated:** {datetime.now().isoformat()}
**Total Actions:** {len(entries)}

## Summary

| Metric | Value |
|--------|-------|
| Total Actions | {len(entries)} |
| Successful | {successes} |
| Failed | {failures} |
| Success Rate | {(successes/len(entries)*100):.1f}% |

## Actions by Type

| Action Type | Count |
|-------------|-------|
"""
        for action, count in sorted(by_type.items(), key=lambda x: x[1], reverse=True):
            report += f"| {action} | {count} |\n"

        # Recent failures
        failures_list = [e for e in entries if e.result == 'failure'][:10]
        if failures_list:
            report += """
## Recent Failures

| Time | Action | Target | Error |
|------|--------|--------|-------|
"""
            for entry in failures_list:
                report += f"| {entry.timestamp[:19]} | {entry.action_type} | {entry.target[:30]} | {entry.error_message or 'N/A'} |\n"

        # Approval summary
        approval_counts = {}
        for entry in entries:
            status = entry.approval_status
            approval_counts[status] = approval_counts.get(status, 0) + 1

        report += """
## Approval Summary

| Status | Count |
|--------|-------|
"""
        for status, count in approval_counts.items():
            report += f"| {status} | {count} |\n"

        report += """
---
*This report was automatically generated by the AI Employee Audit System.*
"""
        return report

    def cleanup_old_logs(self):
        """Remove logs older than retention period."""
        cutoff_date = datetime.now() - timedelta(days=self.RETENTION_DAYS)
        removed = 0

        for log_file in self.logs_folder.glob('*_audit.json'):
            try:
                file_date_str = log_file.stem.split('_')[0]
                file_date = datetime.strptime(file_date_str, '%Y-%m-%d')

                if file_date < cutoff_date:
                    log_file.unlink()
                    removed += 1
            except Exception as e:
                self.logger.warning(f'Error processing {log_file}: {e}')

        if removed:
            self.logger.info(f'Cleaned up {removed} old log file(s)')

        return removed


# Global audit logger instance
_audit_logger: Optional[AuditLogger] = None


def get_audit_logger(vault_path: Optional[str] = None) -> AuditLogger:
    """Get or create the global audit logger."""
    global _audit_logger
    if _audit_logger is None:
        if vault_path is None:
            vault_path = './AI_Employee_Vault'
        _audit_logger = AuditLogger(vault_path)
    return _audit_logger


def audit(action_type: ActionType, target: str, **kwargs) -> AuditEntry:
    """Convenience function for quick audit logging."""
    return get_audit_logger().log(action_type, target, **kwargs)


if __name__ == '__main__':
    # Demo
    logger = AuditLogger('./AI_Employee_Vault')

    # Log some test actions
    logger.log_email_send(
        to='client@example.com',
        subject='Invoice #123',
        approval_status=ApprovalStatus.APPROVED,
        approved_by='human'
    )

    logger.log_social_post(
        platform='linkedin',
        content_preview='Excited to share our latest update...',
        approval_status=ApprovalStatus.AUTO_APPROVED
    )

    logger.log_file_operation(
        operation='create',
        filepath='/Needs_Action/EMAIL_123.md'
    )

    # Generate report
    report = logger.generate_audit_report()
    print(report)
