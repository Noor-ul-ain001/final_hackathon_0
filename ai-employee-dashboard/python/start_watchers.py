#!/usr/bin/env python3
"""
Start All Watchers

Launches all watcher scripts in separate processes:
1. Gmail Watcher - monitors inbox for new emails
2. Email Sender - sends approved responses
"""

import subprocess
import sys
import time
from pathlib import Path

WATCHERS = [
    {
        'name': 'Gmail Watcher',
        'script': 'gmail_watcher.py',
        'description': 'Monitors Gmail inbox for new emails'
    },
    {
        'name': 'Approval Notifier',
        'script': 'approval_notifier.py',
        'description': 'Sends WhatsApp alerts for pending approvals'
    },
    {
        'name': 'Email Sender',
        'script': 'email_sender.py',
        'description': 'Sends approved email responses'
    },
    {
        'name': 'LinkedIn Watcher',
        'script': 'linkedin_watcher.py',
        'description': 'Monitors business activities and creates LinkedIn post triggers'
    },
    {
        'name': 'Social Media Watcher',
        'script': 'social_media_watcher.py',
        'description': 'Manages Twitter/X posting and engagement monitoring'
    },
    {
        'name': 'Odoo Watcher',
        'script': 'odoo_watcher.py',
        'description': 'Monitors Odoo ERP for invoices, payments, and expenses'
    },
    {
        'name': 'Facebook Watcher',
        'script': 'facebook_watcher.py',
        'description': 'Monitors business activities and creates Facebook post triggers'
    }
]


def main():
    print("=" * 70)
    print("AI Employee - Starting All Watchers")
    print("=" * 70)

    processes = []

    try:
        for watcher in WATCHERS:
            script_path = Path(__file__).parent / watcher['script']

            if not script_path.exists():
                print(f"✗ {watcher['name']}: Script not found at {script_path}")
                continue

            print(f"\n[{watcher['name']}]")
            print(f"  Description: {watcher['description']}")
            print(f"  Starting...")

            # Start process
            process = subprocess.Popen(
                [sys.executable, str(script_path)],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1
            )

            processes.append({
                'name': watcher['name'],
                'process': process
            })

            print(f"  ✓ Started (PID: {process.pid})")
            time.sleep(1)

        print("\n" + "=" * 70)
        print("All watchers started successfully!")
        print("=" * 70)
        print("\nPress Ctrl+C to stop all watchers\n")

        # Monitor processes
        while True:
            for watcher in processes:
                # Check if process is still running
                if watcher['process'].poll() is not None:
                    print(f"\n⚠ {watcher['name']} stopped unexpectedly")

                # Print output
                try:
                    line = watcher['process'].stdout.readline()
                    if line:
                        print(f"[{watcher['name']}] {line.rstrip()}")
                except:
                    pass

            time.sleep(0.1)

    except KeyboardInterrupt:
        print("\n\n" + "=" * 70)
        print("Stopping all watchers...")
        print("=" * 70)

        for watcher in processes:
            try:
                watcher['process'].terminate()
                watcher['process'].wait(timeout=5)
                print(f"✓ {watcher['name']} stopped")
            except:
                watcher['process'].kill()
                print(f"✓ {watcher['name']} force stopped")

        print("\nAll watchers stopped.")

    except Exception as e:
        print(f"\n✗ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
