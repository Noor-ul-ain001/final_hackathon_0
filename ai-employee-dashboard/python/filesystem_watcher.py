"""
Filesystem Watcher
------------------
Monitors a designated drop folder for new files and creates action files
for Claude to process. Useful for manual file drops that need AI processing.
"""

import shutil
from pathlib import Path
from datetime import datetime
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileCreatedEvent
from base_watcher import BaseWatcher
import time


class FileDropHandler(FileSystemEventHandler):
    """Handler for file system events in the drop folder."""

    def __init__(self, watcher):
        """
        Initialize the handler.

        Args:
            watcher: Reference to the FileSystemWatcher instance
        """
        super().__init__()
        self.watcher = watcher

    def on_created(self, event):
        """
        Called when a file or directory is created.

        Args:
            event: The file system event
        """
        if event.is_directory:
            return

        # Process the new file
        source = Path(event.src_path)

        # Ignore temporary files and hidden files
        if source.name.startswith('.') or source.name.startswith('~'):
            return

        # Give the file a moment to finish writing
        time.sleep(1)

        try:
            self.watcher.process_file_drop(source)
        except Exception as e:
            self.watcher.logger.error(f'Error processing file {source}: {e}')


class FileSystemWatcher(BaseWatcher):
    """
    Watches a designated drop folder for new files.

    When a file is dropped into the monitored folder, it:
    1. Copies the file to the vault
    2. Creates a metadata file in Needs_Action
    3. Logs the activity
    """

    def __init__(self, vault_path: str, drop_folder: str, check_interval: int = 5):
        """
        Initialize the filesystem watcher.

        Args:
            vault_path: Path to the Obsidian vault
            drop_folder: Path to the folder to monitor
            check_interval: Seconds between checks (for polling mode)
        """
        super().__init__(vault_path, check_interval)

        self.drop_folder = Path(drop_folder)
        self.drop_folder.mkdir(parents=True, exist_ok=True)

        # Create a folder in vault for dropped files
        self.dropped_files_folder = self.vault_path / 'Dropped_Files'
        self.dropped_files_folder.mkdir(parents=True, exist_ok=True)

        self.observer = None

    def check_for_updates(self) -> list:
        """
        Check drop folder for new files (polling mode).

        Returns:
            List of file paths that are new
        """
        new_files = []

        try:
            # Get all files in drop folder
            for file_path in self.drop_folder.iterdir():
                # Skip directories and hidden files
                if file_path.is_dir() or file_path.name.startswith('.'):
                    continue

                # Skip temporary files
                if file_path.name.startswith('~') or file_path.suffix == '.tmp':
                    continue

                # Check if we've already processed this file
                file_id = f'{file_path.name}_{file_path.stat().st_mtime}'
                if file_id not in self.processed_ids:
                    new_files.append(file_path)
                    self.processed_ids.add(file_id)

        except Exception as e:
            self.logger.error(f'Error scanning drop folder: {e}')

        return new_files

    def create_action_file(self, item) -> Path:
        """
        Create an action file for the dropped file.

        Args:
            item: Path object of the dropped file

        Returns:
            Path to the created action file
        """
        source = Path(item)

        # Copy file to vault's dropped files folder
        dest = self.dropped_files_folder / source.name
        counter = 1
        while dest.exists():
            # If file exists, add counter
            dest = self.dropped_files_folder / f'{source.stem}_{counter}{source.suffix}'
            counter += 1

        shutil.copy2(source, dest)
        self.logger.info(f'Copied file to vault: {dest.name}')

        # Create metadata file in Needs_Action
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        action_file = self.needs_action / f'FILE_DROP_{timestamp}_{source.stem}.md'

        # Get file information
        file_stat = source.stat()
        file_size = self.format_size(file_stat.st_size)

        # Create metadata
        metadata = {
            'type': 'file_drop',
            'original_name': source.name,
            'vault_location': str(dest.relative_to(self.vault_path)),
            'size': file_size,
            'dropped_at': datetime.now().isoformat(),
            'file_extension': source.suffix,
            'status': 'pending'
        }

        # Create content
        content = self.format_frontmatter(metadata)
        content += '\n'
        content += f'# File Drop: {source.name}\n\n'
        content += f'## File Information\n'
        content += f'- **Original Name**: {source.name}\n'
        content += f'- **Size**: {file_size}\n'
        content += f'- **Type**: {source.suffix}\n'
        content += f'- **Dropped**: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}\n'
        content += f'- **Location**: `{dest.relative_to(self.vault_path)}`\n\n'

        content += f'## Required Actions\n'
        content += f'- [ ] Review file contents\n'
        content += f'- [ ] Determine processing needed\n'
        content += f'- [ ] Process or archive file\n\n'

        content += f'## Suggested Processing\n'

        # Suggest actions based on file type
        if source.suffix.lower() in ['.pdf', '.doc', '.docx', '.txt']:
            content += f'- Extract text and summarize\n'
            content += f'- Check for action items or deadlines\n'
            content += f'- File appropriately\n'
        elif source.suffix.lower() in ['.csv', '.xlsx', '.xls']:
            content += f'- Parse spreadsheet data\n'
            content += f'- Import into accounting/tracking system\n'
            content += f'- Generate summary report\n'
        elif source.suffix.lower() in ['.jpg', '.jpeg', '.png', '.gif']:
            content += f'- Analyze image content\n'
            content += f'- Extract text if present (OCR)\n'
            content += f'- Categorize and file\n'
        else:
            content += f'- Review file manually\n'
            content += f'- Determine appropriate action\n'

        content += f'\n## Notes\n'
        content += f'[Add any notes about this file or its processing]\n'

        # Write the action file
        self.create_file_safely(action_file, content)

        # Optionally delete the original from drop folder
        # Uncomment if you want to auto-delete after processing
        # source.unlink()

        return action_file

    def process_file_drop(self, file_path: Path):
        """
        Process a file that was dropped (for event-driven mode).

        Args:
            file_path: Path to the dropped file
        """
        file_id = f'{file_path.name}_{file_path.stat().st_mtime}'

        if file_id not in self.processed_ids:
            self.logger.info(f'New file detected: {file_path.name}')
            self.create_action_file(file_path)
            self.processed_ids.add(file_id)
            self.update_dashboard(f'File drop detected: {file_path.name}')

    def run_event_driven(self):
        """
        Run in event-driven mode using watchdog.

        This is more efficient than polling mode as it uses OS-level
        file system events.
        """
        self.logger.info(f'Starting {self.__class__.__name__} in event-driven mode')
        self.logger.info(f'Watching folder: {self.drop_folder}')
        self.is_running = True

        # Create and start observer
        self.observer = Observer()
        event_handler = FileDropHandler(self)
        self.observer.schedule(event_handler, str(self.drop_folder), recursive=False)
        self.observer.start()

        try:
            while self.is_running:
                time.sleep(1)
        except KeyboardInterrupt:
            self.logger.info('Received shutdown signal')
        finally:
            self.observer.stop()
            self.observer.join()

        self.logger.info(f'{self.__class__.__name__} stopped')

    @staticmethod
    def format_size(size_bytes: int) -> str:
        """
        Format file size in human-readable format.

        Args:
            size_bytes: Size in bytes

        Returns:
            Formatted size string
        """
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size_bytes < 1024.0:
                return f'{size_bytes:.1f} {unit}'
            size_bytes /= 1024.0
        return f'{size_bytes:.1f} TB'


def main():
    """Main entry point for the filesystem watcher."""
    import argparse
    import sys

    parser = argparse.ArgumentParser(description='File System Watcher for AI Employee')
    parser.add_argument(
        '--vault',
        default='./AI_Employee_Vault',
        help='Path to Obsidian vault'
    )
    parser.add_argument(
        '--drop-folder',
        default='./AI_Employee_Vault/Inbox',
        help='Path to drop folder to monitor'
    )
    parser.add_argument(
        '--mode',
        choices=['polling', 'events'],
        default='events',
        help='Monitoring mode: polling or events (default: events)'
    )
    parser.add_argument(
        '--interval',
        type=int,
        default=5,
        help='Check interval in seconds for polling mode (default: 5)'
    )
    parser.add_argument(
        '--log-level',
        default='INFO',
        choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'],
        help='Logging level'
    )

    args = parser.parse_args()

    # Create watcher instance
    watcher = FileSystemWatcher(
        vault_path=args.vault,
        drop_folder=args.drop_folder,
        check_interval=args.interval
    )
    watcher.logger.setLevel(args.log_level)

    try:
        if args.mode == 'events':
            watcher.run_event_driven()
        else:
            watcher.run()
    except KeyboardInterrupt:
        watcher.stop()
        sys.exit(0)
    except Exception as e:
        watcher.logger.critical(f'Fatal error: {e}')
        sys.exit(1)


if __name__ == '__main__':
    main()
