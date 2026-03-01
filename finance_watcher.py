#!/usr/bin/env python3
"""
Finance Watcher - Banking and Transaction Monitoring
-----------------------------------------------------
Monitors bank accounts and financial transactions.

Per Hackathon Document:
"Finance Watcher: Downloads local CSVs or calls banking APIs to log
new transactions in /Accounting/Current_Month.md"

This watcher supports multiple input methods:
1. CSV file drops (bank statement exports)
2. Banking API integration (Plaid, Yodlee, etc.)
3. Manual transaction entry via vault

Gold Tier Feature: Financial transaction monitoring for CEO Briefings.
"""

import os
import csv
import json
import hashlib
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, asdict
from enum import Enum

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / '.env')
except ImportError:
    pass

from base_watcher import BaseWatcher

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('FinanceWatcher')


class TransactionType(Enum):
    """Types of financial transactions."""
    INCOME = 'income'
    EXPENSE = 'expense'
    TRANSFER = 'transfer'
    SUBSCRIPTION = 'subscription'
    REFUND = 'refund'


@dataclass
class Transaction:
    """Represents a financial transaction."""
    id: str
    date: str
    description: str
    amount: float
    type: str
    category: str
    account: str
    reference: Optional[str] = None
    notes: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)


class FinanceWatcher(BaseWatcher):
    """
    Watches for financial transactions and creates action files.

    Per hackathon doc, monitors for:
    - Bank transactions (via CSV or API)
    - Subscription charges
    - Large/unusual transactions
    - Invoice payments
    """

    # Keywords that indicate subscriptions
    SUBSCRIPTION_KEYWORDS = [
        'subscription', 'monthly', 'recurring', 'netflix', 'spotify',
        'adobe', 'google', 'microsoft', 'aws', 'azure', 'slack',
        'notion', 'figma', 'github', 'dropbox', 'zoom'
    ]

    # Alert thresholds
    LARGE_TRANSACTION_THRESHOLD = float(os.getenv('LARGE_TRANSACTION_THRESHOLD', '500'))
    UNUSUAL_PATTERN_THRESHOLD = float(os.getenv('UNUSUAL_PATTERN_THRESHOLD', '200'))

    def __init__(self, vault_path: str, check_interval: int = 300):
        """
        Initialize the finance watcher.

        Args:
            vault_path: Path to Obsidian vault
            check_interval: Seconds between checks (default 5 minutes)
        """
        super().__init__(vault_path, check_interval)

        # Folders
        self.accounting_folder = self.vault_path / 'Accounting'
        self.drop_folder = self.vault_path / 'Accounting' / 'Bank_Statements'
        self.transactions_file = self.accounting_folder / 'transactions.json'

        # Create folders
        self.accounting_folder.mkdir(parents=True, exist_ok=True)
        self.drop_folder.mkdir(parents=True, exist_ok=True)

        # Tracking
        self.processed_files: set = set()
        self.processed_transactions: set = set()
        self._load_processed()

        # Banking API settings (optional)
        self.use_plaid = os.getenv('USE_PLAID_API', 'false').lower() == 'true'
        self.plaid_client_id = os.getenv('PLAID_CLIENT_ID')
        self.plaid_secret = os.getenv('PLAID_SECRET')

        logger.info(f'Finance Watcher initialized')
        logger.info(f'  Drop folder: {self.drop_folder}')
        logger.info(f'  Large transaction threshold: ${self.LARGE_TRANSACTION_THRESHOLD}')
        logger.info(f'  Plaid API: {"enabled" if self.use_plaid else "disabled"}')

    def _load_processed(self):
        """Load previously processed transaction IDs."""
        tracking_file = self.accounting_folder / '.processed_transactions.json'
        if tracking_file.exists():
            try:
                data = json.loads(tracking_file.read_text())
                self.processed_files = set(data.get('files', []))
                self.processed_transactions = set(data.get('transactions', []))
            except Exception as e:
                logger.warning(f'Failed to load tracking data: {e}')

    def _save_processed(self):
        """Save processed transaction IDs."""
        tracking_file = self.accounting_folder / '.processed_transactions.json'
        try:
            data = {
                'files': list(self.processed_files)[-500:],
                'transactions': list(self.processed_transactions)[-1000:],
                'last_updated': datetime.now().isoformat()
            }
            tracking_file.write_text(json.dumps(data, indent=2))
        except Exception as e:
            logger.warning(f'Failed to save tracking data: {e}')

    def _generate_transaction_id(self, date: str, description: str, amount: float) -> str:
        """Generate unique transaction ID."""
        content = f"{date}:{description}:{amount}"
        return hashlib.md5(content.encode()).hexdigest()[:12]

    def check_for_updates(self) -> List[Dict]:
        """
        Check for new financial data.

        Looks for:
        1. New CSV files in drop folder
        2. Banking API updates (if configured)
        3. Manual entries in vault
        """
        updates = []

        # Check CSV drops
        updates.extend(self._check_csv_drops())

        # Check banking API (if enabled)
        if self.use_plaid:
            updates.extend(self._check_plaid_api())

        # Check for manual entries
        updates.extend(self._check_manual_entries())

        return updates

    def _check_csv_drops(self) -> List[Dict]:
        """Check for new CSV bank statement files."""
        transactions = []

        for csv_file in self.drop_folder.glob('*.csv'):
            if str(csv_file) in self.processed_files:
                continue

            logger.info(f'Processing bank statement: {csv_file.name}')

            try:
                parsed = self._parse_csv_statement(csv_file)
                transactions.extend(parsed)
                self.processed_files.add(str(csv_file))

                # Move to processed folder
                processed_folder = self.drop_folder / 'Processed'
                processed_folder.mkdir(exist_ok=True)
                csv_file.rename(processed_folder / csv_file.name)

            except Exception as e:
                logger.error(f'Failed to parse {csv_file.name}: {e}')

        return transactions

    def _parse_csv_statement(self, filepath: Path) -> List[Dict]:
        """
        Parse a bank statement CSV file.

        Supports common formats:
        - Date, Description, Amount
        - Date, Description, Debit, Credit
        """
        transactions = []

        with open(filepath, 'r', newline='', encoding='utf-8-sig') as f:
            # Try to detect dialect
            sample = f.read(4096)
            f.seek(0)

            try:
                dialect = csv.Sniffer().sniff(sample)
            except:
                dialect = csv.excel

            reader = csv.DictReader(f, dialect=dialect)

            for row in reader:
                try:
                    # Extract fields (handle common column names)
                    date = (row.get('Date') or row.get('date') or
                           row.get('Transaction Date') or row.get('Posted Date') or '')

                    description = (row.get('Description') or row.get('description') or
                                  row.get('Memo') or row.get('Name') or '')

                    # Handle amount (could be single column or debit/credit)
                    amount_str = row.get('Amount') or row.get('amount')
                    if amount_str:
                        amount = float(amount_str.replace('$', '').replace(',', ''))
                    else:
                        debit = row.get('Debit') or row.get('Withdrawal') or '0'
                        credit = row.get('Credit') or row.get('Deposit') or '0'
                        debit_val = float(debit.replace('$', '').replace(',', '') or 0)
                        credit_val = float(credit.replace('$', '').replace(',', '') or 0)
                        amount = credit_val - debit_val

                    if not date or not description:
                        continue

                    # Generate ID
                    txn_id = self._generate_transaction_id(date, description, amount)

                    if txn_id in self.processed_transactions:
                        continue

                    # Categorize transaction
                    txn_type, category = self._categorize_transaction(description, amount)

                    transaction = {
                        'id': txn_id,
                        'date': date,
                        'description': description,
                        'amount': amount,
                        'type': txn_type,
                        'category': category,
                        'account': filepath.stem,
                        'source': 'csv'
                    }

                    transactions.append(transaction)
                    self.processed_transactions.add(txn_id)

                except Exception as e:
                    logger.warning(f'Failed to parse row: {e}')

        return transactions

    def _categorize_transaction(self, description: str, amount: float) -> tuple:
        """Categorize a transaction based on description and amount."""
        desc_lower = description.lower()

        # Check for subscriptions
        for keyword in self.SUBSCRIPTION_KEYWORDS:
            if keyword in desc_lower:
                return ('subscription', 'Software & Subscriptions')

        # Categorize by amount
        if amount > 0:
            txn_type = 'income'
            if 'payment' in desc_lower or 'invoice' in desc_lower:
                category = 'Client Payments'
            elif 'refund' in desc_lower:
                category = 'Refunds'
            elif 'transfer' in desc_lower:
                category = 'Transfers'
            else:
                category = 'Other Income'
        else:
            txn_type = 'expense'
            # Try to categorize expense
            if any(kw in desc_lower for kw in ['restaurant', 'food', 'cafe', 'uber eats']):
                category = 'Food & Dining'
            elif any(kw in desc_lower for kw in ['gas', 'fuel', 'parking']):
                category = 'Transportation'
            elif any(kw in desc_lower for kw in ['amazon', 'walmart', 'target']):
                category = 'Shopping'
            elif any(kw in desc_lower for kw in ['office', 'supplies', 'staples']):
                category = 'Office Supplies'
            elif any(kw in desc_lower for kw in ['marketing', 'advertising', 'facebook ads', 'google ads']):
                category = 'Marketing'
            else:
                category = 'Other Expenses'

        return (txn_type, category)

    def _check_plaid_api(self) -> List[Dict]:
        """
        Check Plaid API for new transactions.

        Plaid provides banking data aggregation.
        """
        if not self.plaid_client_id or not self.plaid_secret:
            return []

        # In production, this would:
        # 1. Initialize Plaid client
        # 2. Get linked accounts
        # 3. Fetch recent transactions
        # 4. Return new transactions

        logger.info('Plaid API check (not implemented - requires Plaid setup)')
        return []

    def _check_manual_entries(self) -> List[Dict]:
        """Check for manually entered transactions in vault."""
        transactions = []
        manual_file = self.accounting_folder / 'Manual_Transactions.md'

        if not manual_file.exists():
            return []

        try:
            content = manual_file.read_text()

            # Parse markdown table format
            # | Date | Description | Amount | Category |
            lines = content.split('\n')
            in_table = False

            for line in lines:
                if '|' in line:
                    if 'Date' in line and 'Description' in line:
                        in_table = True
                        continue
                    if '---' in line:
                        continue
                    if in_table and line.strip().startswith('|'):
                        parts = [p.strip() for p in line.split('|') if p.strip()]
                        if len(parts) >= 3:
                            date = parts[0]
                            description = parts[1]
                            amount_str = parts[2].replace('$', '').replace(',', '')

                            try:
                                amount = float(amount_str)
                            except:
                                continue

                            txn_id = self._generate_transaction_id(date, description, amount)

                            if txn_id not in self.processed_transactions:
                                category = parts[3] if len(parts) > 3 else 'Manual Entry'
                                txn_type = 'income' if amount > 0 else 'expense'

                                transactions.append({
                                    'id': txn_id,
                                    'date': date,
                                    'description': description,
                                    'amount': amount,
                                    'type': txn_type,
                                    'category': category,
                                    'account': 'manual',
                                    'source': 'manual'
                                })
                                self.processed_transactions.add(txn_id)

        except Exception as e:
            logger.warning(f'Failed to parse manual transactions: {e}')

        return transactions

    def create_action_file(self, transaction: Dict) -> Path:
        """
        Create action file for a transaction requiring attention.

        Per hackathon doc: "Flag any payment over $500 for my approval"
        """
        txn_id = transaction['id']
        amount = transaction['amount']
        description = transaction['description']
        date = transaction['date']
        category = transaction['category']
        txn_type = transaction['type']

        # Determine if this needs action
        needs_action = False
        action_reason = []

        # Large transaction
        if abs(amount) >= self.LARGE_TRANSACTION_THRESHOLD:
            needs_action = True
            action_reason.append(f'Large transaction (>${self.LARGE_TRANSACTION_THRESHOLD})')

        # Subscription for review
        if txn_type == 'subscription':
            needs_action = True
            action_reason.append('Subscription charge - review for optimization')

        # If no special action needed, just log it
        if not needs_action:
            self._log_transaction(transaction)
            return None

        # Create action file
        filename = f'TRANSACTION_{datetime.now().strftime("%Y%m%d_%H%M%S")}_{txn_id[:6]}.md'
        filepath = self.needs_action / filename

        sign = '+' if amount > 0 else ''
        content = f"""---
type: financial_transaction
transaction_id: {txn_id}
date: {date}
amount: {sign}${abs(amount):.2f}
category: {category}
transaction_type: {txn_type}
priority: {'high' if abs(amount) >= self.LARGE_TRANSACTION_THRESHOLD else 'normal'}
status: pending
---

# Transaction Alert

## Details
- **Date:** {date}
- **Description:** {description}
- **Amount:** {sign}${abs(amount):.2f}
- **Category:** {category}
- **Type:** {txn_type.upper()}

## Reason for Review
{chr(10).join(f'- {r}' for r in action_reason)}

## Suggested Actions
"""

        if txn_type == 'subscription':
            content += """- [ ] Verify this subscription is still needed
- [ ] Check if there's a cheaper alternative
- [ ] Update subscription audit log
"""
        elif abs(amount) >= self.LARGE_TRANSACTION_THRESHOLD:
            content += """- [ ] Verify transaction is legitimate
- [ ] Categorize properly for accounting
- [ ] Update budget tracking
"""

        content += """
---
*Auto-generated by Finance Watcher*
"""

        filepath.write_text(content, encoding='utf-8')

        logger.info(f'Created action file: {filepath.name}')
        logger.info(f'  Amount: ${abs(amount):.2f}')
        logger.info(f'  Reason: {", ".join(action_reason)}')

        # Update dashboard
        self.update_dashboard(f'Finance: {txn_type.upper()} ${abs(amount):.2f} - {description[:30]}')

        # Log transaction
        self._log_transaction(transaction)

        return filepath

    def _log_transaction(self, transaction: Dict):
        """Log transaction to monthly file."""
        month_file = self.accounting_folder / f'{datetime.now().strftime("%Y-%m")}_Transactions.md'

        # Create or update monthly log
        if not month_file.exists():
            header = f"""# Transactions - {datetime.now().strftime('%B %Y')}

| Date | Description | Amount | Category | Type |
|------|-------------|--------|----------|------|
"""
            month_file.write_text(header)

        # Append transaction
        amount = transaction['amount']
        sign = '+' if amount > 0 else ''
        row = f"| {transaction['date']} | {transaction['description'][:40]} | {sign}${abs(amount):.2f} | {transaction['category']} | {transaction['type']} |\n"

        with open(month_file, 'a') as f:
            f.write(row)

        # Save to JSON
        self._save_to_json(transaction)

    def _save_to_json(self, transaction: Dict):
        """Save transaction to JSON file for CEO briefing."""
        if self.transactions_file.exists():
            data = json.loads(self.transactions_file.read_text())
        else:
            data = {'transactions': []}

        data['transactions'].append({
            **transaction,
            'logged_at': datetime.now().isoformat()
        })

        # Keep last 500 transactions
        data['transactions'] = data['transactions'][-500:]

        self.transactions_file.write_text(json.dumps(data, indent=2))

    def get_monthly_summary(self) -> Dict:
        """Get summary for current month (for CEO briefing)."""
        if not self.transactions_file.exists():
            return {'income': 0, 'expenses': 0, 'subscriptions': 0}

        data = json.loads(self.transactions_file.read_text())
        current_month = datetime.now().strftime('%Y-%m')

        income = 0
        expenses = 0
        subscriptions = 0

        for txn in data.get('transactions', []):
            if txn.get('date', '').startswith(current_month):
                amount = txn.get('amount', 0)
                if amount > 0:
                    income += amount
                else:
                    expenses += abs(amount)
                if txn.get('type') == 'subscription':
                    subscriptions += abs(amount)

        return {
            'income': income,
            'expenses': expenses,
            'subscriptions': subscriptions,
            'net': income - expenses
        }


def main():
    """Run the finance watcher standalone."""
    vault_path = os.getenv('VAULT_PATH', './AI_Employee_Vault')

    print("=" * 60)
    print("Finance Watcher")
    print("=" * 60)
    print(f"Vault: {vault_path}")
    print(f"Drop CSV files into: {vault_path}/Accounting/Bank_Statements/")
    print(f"Large transaction threshold: ${FinanceWatcher.LARGE_TRANSACTION_THRESHOLD}")
    print("=" * 60)
    print("\nPress Ctrl+C to stop")

    watcher = FinanceWatcher(vault_path)

    try:
        watcher.run()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == '__main__':
    main()
