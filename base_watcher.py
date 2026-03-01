"""
Base Watcher Class
------------------
Abstract base class for all watcher scripts in the AI Employee system.
Provides common functionality for monitoring various inputs and creating
actionable files for Claude to process.
"""

import time
import logging
from pathlib import Path
from abc import ABC, abstractmethod
from datetime import datetime
import json


class BaseWatcher(ABC):
    """
    Abstract base class for all watchers.

    All watchers follow this pattern:
    1. Periodically check for updates
    2. Create actionable .md files in Needs_Action folder
    3. Handle errors gracefully
    4. Log all activities
    """

    def __init__(self, vault_path: str, check_interval: int = 60, log_level: str = "INFO"):
        """
        Initialize the base watcher.

        Args:
            vault_path: Path to the Obsidian vault
            check_interval: Seconds between checks
            log_level: Logging level (DEBUG, INFO, WARNING, ERROR)
        """
        self.vault_path = Path(vault_path)
        self.needs_action = self.vault_path / 'Needs_Action'
        self.check_interval = check_interval
        self.processed_ids = set()
        self.last_check = None
        self.is_running = False

        # Ensure required folders exist
        self.needs_action.mkdir(parents=True, exist_ok=True)

        # Set up logging
        self.logger = logging.getLogger(self.__class__.__name__)
        self.logger.setLevel(getattr(logging, log_level.upper()))

        # Create console handler if not already configured
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
            self.logger.addHandler(handler)

    @abstractmethod
    def check_for_updates(self) -> list:
        """
        Check for new items to process.

        Returns:
            List of new items to process. Each item structure is defined
            by the specific watcher implementation.

        This method must be implemented by all subclasses.
        """
        pass

    @abstractmethod
    def create_action_file(self, item) -> Path:
        """
        Create a .md file in Needs_Action folder for the given item.

        Args:
            item: The item to create an action file for

        Returns:
            Path to the created file

        This method must be implemented by all subclasses.
        """
        pass

    def format_frontmatter(self, metadata: dict) -> str:
        """
        Format YAML frontmatter for markdown files.

        Args:
            metadata: Dictionary of metadata to include

        Returns:
            Formatted YAML frontmatter string
        """
        lines = ['---']
        for key, value in metadata.items():
            if isinstance(value, (list, dict)):
                # For complex types, use JSON representation
                lines.append(f'{key}: {json.dumps(value)}')
            else:
                lines.append(f'{key}: {value}')
        lines.append('---\n')
        return '\n'.join(lines)

    def create_file_safely(self, filepath: Path, content: str) -> bool:
        """
        Create a file with error handling and atomic write.

        Args:
            filepath: Path where file should be created
            content: Content to write

        Returns:
            True if successful, False otherwise
        """
        try:
            # Write to temporary file first
            temp_path = filepath.with_suffix('.tmp')
            temp_path.write_text(content, encoding='utf-8')

            # Rename to final path (atomic operation)
            temp_path.replace(filepath)

            self.logger.debug(f'Created file: {filepath.name}')
            return True
        except Exception as e:
            self.logger.error(f'Failed to create file {filepath}: {e}')
            return False

    def update_dashboard(self, activity: str):
        """
        Update the dashboard with activity log entry.

        Args:
            activity: Description of the activity
        """
        try:
            dashboard_path = self.vault_path / 'Dashboard.md'

            if not dashboard_path.exists():
                self.logger.warning('Dashboard.md not found, skipping update')
                return

            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            log_entry = f'- [{timestamp}] {self.__class__.__name__}: {activity}\n'

            # Read existing content
            content = dashboard_path.read_text(encoding='utf-8')

            # Find the Recent Activity section
            if '## Recent Activity' in content:
                # Insert after the Recent Activity header
                parts = content.split('## Recent Activity\n', 1)
                updated_content = (
                    parts[0] +
                    '## Recent Activity\n' +
                    log_entry +
                    parts[1]
                )

                # Write back
                dashboard_path.write_text(updated_content, encoding='utf-8')
                self.logger.debug(f'Updated dashboard: {activity}')
            else:
                self.logger.warning('Recent Activity section not found in dashboard')

        except Exception as e:
            self.logger.error(f'Failed to update dashboard: {e}')

    def run(self):
        """
        Main run loop. Continuously checks for updates and processes them.
        """
        self.logger.info(f'Starting {self.__class__.__name__}')
        self.logger.info(f'Vault path: {self.vault_path}')
        self.logger.info(f'Check interval: {self.check_interval} seconds')
        self.is_running = True

        consecutive_errors = 0
        max_consecutive_errors = 5

        while self.is_running:
            try:
                # Check for updates
                items = self.check_for_updates()
                self.last_check = datetime.now()

                if items:
                    self.logger.info(f'Found {len(items)} new item(s)')
                    self.update_dashboard(f'Checked, found {len(items)} new item(s)')

                    # Process each item
                    for item in items:
                        try:
                            filepath = self.create_action_file(item)
                            if filepath:
                                self.logger.info(f'Created action file: {filepath.name}')
                        except Exception as e:
                            self.logger.error(f'Error creating action file: {e}')
                else:
                    self.logger.debug('No new items found')
                    # Only update dashboard every 5 minutes if no items found
                    if not hasattr(self, '_last_empty_update') or \
                       (datetime.now() - self._last_empty_update).seconds > 300:
                        self.update_dashboard('Checked, found 0 new items')
                        self._last_empty_update = datetime.now()

                # Reset error counter on success
                consecutive_errors = 0

            except KeyboardInterrupt:
                self.logger.info('Received shutdown signal')
                self.is_running = False
                break
            except Exception as e:
                consecutive_errors += 1
                self.logger.error(f'Error in run loop: {e}')
                self.update_dashboard(f'Error: {str(e)[:50]}')

                if consecutive_errors >= max_consecutive_errors:
                    self.logger.critical(
                        f'Too many consecutive errors ({max_consecutive_errors}), stopping'
                    )
                    self.is_running = False
                    break

            # Sleep until next check
            if self.is_running:
                time.sleep(self.check_interval)

        self.logger.info(f'{self.__class__.__name__} stopped')

    def stop(self):
        """Stop the watcher gracefully."""
        self.logger.info('Stopping watcher...')
        self.is_running = False

    def get_status(self) -> dict:
        """
        Get current status of the watcher.

        Returns:
            Dictionary with status information
        """
        return {
            'name': self.__class__.__name__,
            'is_running': self.is_running,
            'last_check': self.last_check.isoformat() if self.last_check else None,
            'processed_count': len(self.processed_ids),
            'check_interval': self.check_interval
        }


class WatcherError(Exception):
    """Base exception for watcher-related errors."""
    pass


class WatcherConfigurationError(WatcherError):
    """Raised when watcher configuration is invalid."""
    pass


class WatcherConnectionError(WatcherError):
    """Raised when watcher cannot connect to external service."""
    pass
