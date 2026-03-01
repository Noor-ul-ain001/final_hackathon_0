"""
Error Recovery and Graceful Degradation System
----------------------------------------------
Handles transient errors, authentication failures, and system issues.
Implements exponential backoff retry and graceful degradation patterns.

Gold Tier Feature: Error recovery and graceful degradation.
"""

import os
import time
import logging
import traceback
from datetime import datetime
from functools import wraps
from pathlib import Path
from typing import Callable, Optional, Type, Tuple, Any
from enum import Enum


class ErrorCategory(Enum):
    """Categories of errors for different handling strategies."""
    TRANSIENT = "transient"  # Network timeout, API rate limit
    AUTHENTICATION = "authentication"  # Expired token, revoked access
    LOGIC = "logic"  # Misinterpretation, invalid data
    DATA = "data"  # Corrupted file, missing field
    SYSTEM = "system"  # Crash, disk full


class TransientError(Exception):
    """Errors that can be retried (network issues, rate limits)."""
    pass


class AuthenticationError(Exception):
    """Errors requiring human intervention (expired tokens)."""
    pass


class DataError(Exception):
    """Errors with data integrity (corrupted files)."""
    pass


# Gold Tier: Odoo-specific errors
class OdooConnectionError(TransientError):
    """Errors connecting to Odoo server."""
    pass


class OdooAuthenticationError(AuthenticationError):
    """Errors authenticating with Odoo (invalid credentials, expired session)."""
    pass


class OdooDataError(DataError):
    """Errors with Odoo data (missing partner, invalid invoice)."""
    pass


# Gold Tier: Twitter-specific errors
class TwitterRateLimitError(TransientError):
    """Twitter API rate limit exceeded."""
    pass


class TwitterAuthError(AuthenticationError):
    """Twitter authentication failed (invalid/expired tokens)."""
    pass


# Gold Tier: Ralph Wiggum Loop errors
class RalphTaskError(Exception):
    """Base error for Ralph Wiggum Loop task execution."""
    pass


class RalphDecompositionError(RalphTaskError):
    """Error decomposing task into steps."""
    pass


class RalphApprovalTimeoutError(RalphTaskError):
    """Approval request timed out."""
    pass


class RalphStepExecutionError(RalphTaskError):
    """Error executing a task step."""
    pass


def with_retry(
    max_attempts: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    exceptions: Tuple[Type[Exception], ...] = (TransientError, ConnectionError, TimeoutError)
) -> Callable:
    """
    Decorator for exponential backoff retry logic.

    Args:
        max_attempts: Maximum number of retry attempts
        base_delay: Initial delay between retries in seconds
        max_delay: Maximum delay between retries in seconds
        exceptions: Tuple of exception types to catch and retry

    Returns:
        Decorated function with retry logic
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            logger = logging.getLogger(func.__module__)
            last_exception = None

            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    if attempt == max_attempts - 1:
                        logger.error(f'{func.__name__} failed after {max_attempts} attempts: {e}')
                        raise

                    delay = min(base_delay * (2 ** attempt), max_delay)
                    logger.warning(
                        f'{func.__name__} attempt {attempt + 1}/{max_attempts} failed: {e}. '
                        f'Retrying in {delay:.1f}s...'
                    )
                    time.sleep(delay)

            raise last_exception

        return wrapper
    return decorator


def with_fallback(
    fallback_func: Optional[Callable] = None,
    fallback_value: Any = None,
    log_errors: bool = True
) -> Callable:
    """
    Decorator for graceful degradation with fallback.

    Args:
        fallback_func: Function to call on error (receives original args)
        fallback_value: Static value to return on error
        log_errors: Whether to log errors

    Returns:
        Decorated function with fallback logic
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            logger = logging.getLogger(func.__module__)

            try:
                return func(*args, **kwargs)
            except Exception as e:
                if log_errors:
                    logger.warning(f'{func.__name__} failed, using fallback: {e}')

                if fallback_func:
                    try:
                        return fallback_func(*args, **kwargs)
                    except Exception as fallback_error:
                        logger.error(f'Fallback also failed: {fallback_error}')
                        return fallback_value

                return fallback_value

        return wrapper
    return decorator


class ErrorRecoveryManager:
    """
    Manages error recovery strategies and system health.
    """

    def __init__(self, vault_path: str, alert_callback: Optional[Callable] = None):
        """
        Initialize error recovery manager.

        Args:
            vault_path: Path to Obsidian vault for logs
            alert_callback: Function to call for human alerts
        """
        self.vault_path = Path(vault_path)
        self.logs_folder = self.vault_path / 'Logs'
        self.logs_folder.mkdir(parents=True, exist_ok=True)

        self.alert_callback = alert_callback
        self.error_counts = {}
        self.circuit_breakers = {}

        self.logger = logging.getLogger('ErrorRecovery')
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            handler.setFormatter(logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            ))
            self.logger.addHandler(handler)
            self.logger.setLevel(logging.INFO)

    def handle_error(
        self,
        error: Exception,
        context: str,
        category: ErrorCategory = ErrorCategory.TRANSIENT
    ) -> dict:
        """
        Handle an error with appropriate recovery strategy.

        Args:
            error: The exception that occurred
            context: Description of what was being attempted
            category: Category of error for handling strategy

        Returns:
            Dictionary with handling result and recommended action
        """
        error_info = {
            'timestamp': datetime.now().isoformat(),
            'category': category.value,
            'context': context,
            'error_type': type(error).__name__,
            'error_message': str(error),
            'traceback': traceback.format_exc(),
            'action': 'none',
            'recovered': False
        }

        # Track error frequency
        error_key = f'{category.value}:{context}'
        self.error_counts[error_key] = self.error_counts.get(error_key, 0) + 1

        # Determine handling strategy
        if category == ErrorCategory.TRANSIENT:
            error_info['action'] = 'retry_with_backoff'
            error_info['recovered'] = True

        elif category == ErrorCategory.AUTHENTICATION:
            error_info['action'] = 'alert_human'
            self._alert_human(f'Authentication error in {context}: {error}')

        elif category == ErrorCategory.DATA:
            error_info['action'] = 'quarantine'
            self._quarantine_data(context, error)

        elif category == ErrorCategory.SYSTEM:
            error_info['action'] = 'restart_component'
            self._handle_system_error(context, error)

        elif category == ErrorCategory.LOGIC:
            error_info['action'] = 'human_review'
            self._create_review_request(context, error)

        # Log error
        self._log_error(error_info)

        # Check circuit breaker
        if self.error_counts[error_key] >= 5:
            self._trip_circuit_breaker(error_key)
            error_info['circuit_breaker_tripped'] = True

        return error_info

    def is_circuit_open(self, component: str) -> bool:
        """Check if circuit breaker is open for a component."""
        breaker = self.circuit_breakers.get(component)
        if not breaker:
            return False

        # Check if cooldown has passed (5 minutes)
        if (datetime.now() - breaker['tripped_at']).seconds > 300:
            self.circuit_breakers[component]['state'] = 'half_open'
            return False

        return breaker['state'] == 'open'

    def reset_circuit(self, component: str):
        """Reset circuit breaker for a component after successful operation."""
        if component in self.circuit_breakers:
            self.circuit_breakers[component]['state'] = 'closed'
            self.logger.info(f'Circuit breaker reset for {component}')

    def handle_ralph_error(
        self,
        error: Exception,
        task_id: str,
        step_id: Optional[str] = None,
        task_context: Optional[dict] = None
    ) -> dict:
        """
        Handle errors specific to Ralph Wiggum Loop autonomous task execution.

        Args:
            error: The exception that occurred
            task_id: ID of the task that failed
            step_id: Optional step ID within the task
            task_context: Optional task context for debugging

        Returns:
            Dictionary with handling result and intervention info
        """
        context = f"ralph_task:{task_id}"
        if step_id:
            context += f":step:{step_id}"

        # Determine error category based on error type
        if isinstance(error, (RalphDecompositionError,)):
            category = ErrorCategory.LOGIC
        elif isinstance(error, (RalphApprovalTimeoutError,)):
            category = ErrorCategory.TRANSIENT
        elif isinstance(error, (RalphStepExecutionError,)):
            category = ErrorCategory.SYSTEM
        elif isinstance(error, (OdooConnectionError, OdooAuthenticationError)):
            category = ErrorCategory.AUTHENTICATION
        elif isinstance(error, (TwitterRateLimitError,)):
            category = ErrorCategory.TRANSIENT
        else:
            category = ErrorCategory.SYSTEM

        # Handle using standard error handling
        error_info = self.handle_error(error, context, category)

        # Add Ralph-specific info
        error_info['ralph_task_id'] = task_id
        error_info['ralph_step_id'] = step_id
        error_info['task_context'] = task_context

        # Create intervention request for complex failures
        if error_info.get('circuit_breaker_tripped') or category in [ErrorCategory.LOGIC, ErrorCategory.SYSTEM]:
            self._create_ralph_intervention(task_id, step_id, error, task_context)
            error_info['intervention_requested'] = True

        return error_info

    def _create_ralph_intervention(
        self,
        task_id: str,
        step_id: Optional[str],
        error: Exception,
        context: Optional[dict]
    ):
        """Create human intervention request when Ralph gets stuck."""
        intervention_file = self.vault_path / 'Needs_Action' / f'RALPH_INTERVENTION_{task_id}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.md'

        import json
        context_str = json.dumps(context, indent=2, default=str)[:1000] if context else 'No context available'

        content = f"""---
type: ralph_intervention
task_id: {task_id}
step_id: {step_id or 'N/A'}
priority: high
created: {datetime.now().isoformat()}
status: pending
---

# Ralph Wiggum Intervention Required

The autonomous task execution loop encountered an error that requires human attention.

## Error Details
- **Task ID:** {task_id}
- **Step ID:** {step_id or 'N/A'}
- **Error Type:** {type(error).__name__}
- **Error Message:** {str(error)}

## Task Context
```json
{context_str}
```

## Recommended Actions
1. Review the error and task context above
2. Check system logs in /Logs folder for more details
3. Verify any external service connections (Odoo, Twitter, etc.)
4. Decide whether to:
   - **Retry:** Mark this file as `status: retry` to attempt again
   - **Skip:** Mark as `status: skip` to move to next step
   - **Cancel:** Mark as `status: cancel` to stop the task
   - **Modify:** Update task parameters and mark as `status: modified`

## Resolution
After reviewing, update the status field above and save the file.

---
*Auto-generated by Ralph Wiggum Loop Error Handler*
"""
        intervention_file.write_text(content, encoding='utf-8')
        self.logger.warning(f'Ralph intervention requested for task {task_id}')

    def handle_odoo_error(self, error: Exception, operation: str) -> dict:
        """
        Handle Odoo-specific errors.

        Args:
            error: The exception that occurred
            operation: What Odoo operation was being performed

        Returns:
            Dictionary with handling result
        """
        context = f"odoo:{operation}"

        if 'connection' in str(error).lower() or 'timeout' in str(error).lower():
            return self.handle_error(OdooConnectionError(str(error)), context, ErrorCategory.TRANSIENT)
        elif 'authentication' in str(error).lower() or 'login' in str(error).lower():
            return self.handle_error(OdooAuthenticationError(str(error)), context, ErrorCategory.AUTHENTICATION)
        else:
            return self.handle_error(error, context, ErrorCategory.DATA)

    def handle_twitter_error(self, error: Exception, operation: str) -> dict:
        """
        Handle Twitter-specific errors.

        Args:
            error: The exception that occurred
            operation: What Twitter operation was being performed

        Returns:
            Dictionary with handling result
        """
        context = f"twitter:{operation}"
        error_str = str(error).lower()

        if 'rate limit' in error_str or '429' in error_str:
            return self.handle_error(TwitterRateLimitError(str(error)), context, ErrorCategory.TRANSIENT)
        elif 'auth' in error_str or 'token' in error_str or '401' in error_str:
            return self.handle_error(TwitterAuthError(str(error)), context, ErrorCategory.AUTHENTICATION)
        else:
            return self.handle_error(error, context, ErrorCategory.TRANSIENT)

    def _trip_circuit_breaker(self, component: str):
        """Trip the circuit breaker to prevent cascade failures."""
        self.circuit_breakers[component] = {
            'state': 'open',
            'tripped_at': datetime.now(),
            'error_count': self.error_counts.get(component, 0)
        }
        self.logger.warning(f'Circuit breaker tripped for {component}')
        self._alert_human(f'Circuit breaker tripped: {component}')

    def _alert_human(self, message: str):
        """Send alert to human operator."""
        self.logger.warning(f'HUMAN ALERT: {message}')

        # Create alert file in vault
        alert_file = self.vault_path / 'Needs_Action' / f'ALERT_{datetime.now().strftime("%Y%m%d_%H%M%S")}.md'
        content = f"""---
type: system_alert
priority: high
created: {datetime.now().isoformat()}
status: pending
---

# System Alert

{message}

## Action Required
Please review and resolve this issue.

## Suggested Steps
1. Check system logs in /Logs folder
2. Verify credentials and API connections
3. Restart affected components if needed
"""
        alert_file.write_text(content, encoding='utf-8')

        if self.alert_callback:
            try:
                self.alert_callback(message)
            except Exception as e:
                self.logger.error(f'Alert callback failed: {e}')

    def _quarantine_data(self, context: str, error: Exception):
        """Move problematic data to quarantine folder."""
        quarantine_folder = self.vault_path / 'Quarantine'
        quarantine_folder.mkdir(exist_ok=True)

        quarantine_file = quarantine_folder / f'quarantine_{datetime.now().strftime("%Y%m%d_%H%M%S")}.md'
        content = f"""---
type: quarantined_data
context: {context}
error: {str(error)}
created: {datetime.now().isoformat()}
---

# Quarantined Data

**Context:** {context}
**Error:** {str(error)}

## Review Required
This data caused an error and has been quarantined for manual review.
"""
        quarantine_file.write_text(content, encoding='utf-8')
        self.logger.info(f'Data quarantined: {quarantine_file}')

    def _handle_system_error(self, context: str, error: Exception):
        """Handle system-level errors."""
        self.logger.critical(f'System error in {context}: {error}')
        self._alert_human(f'Critical system error in {context}')

    def _create_review_request(self, context: str, error: Exception):
        """Create a review request for logic errors."""
        review_file = self.vault_path / 'Needs_Action' / f'REVIEW_{datetime.now().strftime("%Y%m%d_%H%M%S")}.md'
        content = f"""---
type: review_request
context: {context}
priority: normal
created: {datetime.now().isoformat()}
status: pending
---

# Human Review Required

The AI made a decision that may need verification.

**Context:** {context}
**Issue:** {str(error)}

## Please Review
- Check if the AI's interpretation was correct
- Provide guidance if needed
- Update Company_Handbook.md with clarifications
"""
        review_file.write_text(content, encoding='utf-8')

    def _log_error(self, error_info: dict):
        """Log error to daily JSON log file."""
        import json

        log_file = self.logs_folder / f'{datetime.now().strftime("%Y-%m-%d")}_errors.json'

        # Load existing logs or create new
        if log_file.exists():
            try:
                logs = json.loads(log_file.read_text())
            except:
                logs = []
        else:
            logs = []

        logs.append(error_info)
        log_file.write_text(json.dumps(logs, indent=2, default=str))

    def get_health_status(self) -> dict:
        """Get overall system health status."""
        return {
            'timestamp': datetime.now().isoformat(),
            'error_counts': dict(self.error_counts),
            'circuit_breakers': {
                k: {'state': v['state'], 'tripped_at': v['tripped_at'].isoformat()}
                for k, v in self.circuit_breakers.items()
            },
            'status': 'degraded' if any(
                b['state'] == 'open' for b in self.circuit_breakers.values()
            ) else 'healthy'
        }


class GracefulDegradation:
    """
    Manages graceful degradation strategies for different components.
    """

    def __init__(self, vault_path: str):
        self.vault_path = Path(vault_path)
        self.temp_folder = self.vault_path / '.temp_queue'
        self.temp_folder.mkdir(exist_ok=True)

    def queue_for_later(self, item_type: str, data: dict) -> Path:
        """
        Queue an item for processing when service is restored.

        Args:
            item_type: Type of item (email, payment, etc.)
            data: Data to queue

        Returns:
            Path to queued file
        """
        import json

        filename = f'{item_type}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
        filepath = self.temp_folder / filename
        filepath.write_text(json.dumps(data, indent=2, default=str))
        return filepath

    def process_queued_items(self, item_type: str, processor: Callable) -> int:
        """
        Process all queued items of a given type.

        Args:
            item_type: Type of items to process
            processor: Function to process each item

        Returns:
            Number of items processed
        """
        import json

        processed = 0
        for filepath in self.temp_folder.glob(f'{item_type}_*.json'):
            try:
                data = json.loads(filepath.read_text())
                processor(data)
                filepath.unlink()  # Remove after successful processing
                processed += 1
            except Exception as e:
                logging.warning(f'Failed to process queued item {filepath}: {e}')

        return processed


# Convenience functions
def create_error_handler(vault_path: str) -> ErrorRecoveryManager:
    """Create a configured error handler."""
    return ErrorRecoveryManager(vault_path)


def safe_operation(func: Callable, error_manager: ErrorRecoveryManager, context: str) -> Callable:
    """Wrap a function with error handling."""
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except TransientError as e:
            error_manager.handle_error(e, context, ErrorCategory.TRANSIENT)
            raise
        except AuthenticationError as e:
            error_manager.handle_error(e, context, ErrorCategory.AUTHENTICATION)
            raise
        except DataError as e:
            error_manager.handle_error(e, context, ErrorCategory.DATA)
            raise
        except Exception as e:
            error_manager.handle_error(e, context, ErrorCategory.SYSTEM)
            raise

    return wrapper


if __name__ == '__main__':
    # Demo/test
    manager = ErrorRecoveryManager('./AI_Employee_Vault')

    # Test retry decorator
    @with_retry(max_attempts=3, base_delay=0.1)
    def flaky_function():
        import random
        if random.random() > 0.3:
            raise TransientError('Random failure')
        return 'Success!'

    # Test fallback decorator
    @with_fallback(fallback_value='Default value')
    def risky_function():
        raise Exception('This always fails')

    print('Testing retry decorator...')
    try:
        result = flaky_function()
        print(f'Result: {result}')
    except TransientError:
        print('All retries exhausted')

    print('\nTesting fallback decorator...')
    result = risky_function()
    print(f'Result: {result}')

    print('\nHealth status:', manager.get_health_status())
