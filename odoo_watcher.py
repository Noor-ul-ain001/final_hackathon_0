"""
Odoo Accounting Watcher
-----------------------
Monitors Odoo accounting data and creates action files for financial audits,
expense tracking, and weekly CEO briefings.

Gold Tier Feature: Odoo integration for comprehensive business accounting.
Replaces Xero integration as the primary accounting source.
"""

import os
import json
import requests
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any
from base_watcher import BaseWatcher, WatcherConnectionError
from audit_logger import get_audit_logger, ActionType, ApprovalStatus


class OdooWatcher(BaseWatcher):
    """
    Watches Odoo accounting for new transactions, invoices, and financial events.
    Creates weekly financial summaries for CEO briefings.
    Uses JSON-RPC API (Odoo 19+ preferred) with XML-RPC fallback.
    """

    # Minimum transaction amount to create action file
    SIGNIFICANT_TRANSACTION_THRESHOLD = 100.0

    # Connection retry settings
    MAX_RETRY_DELAY = 3600  # Max 1 hour between retries
    INITIAL_RETRY_DELAY = 60  # Start with 1 minute

    def __init__(self, vault_path: str, check_interval: int = 3600):
        """
        Initialize Odoo watcher.

        Args:
            vault_path: Path to Obsidian vault
            check_interval: Check every hour by default
        """
        super().__init__(vault_path, check_interval)

        self.accounting_folder = self.vault_path / 'Accounting'
        self.accounting_folder.mkdir(parents=True, exist_ok=True)

        self.briefings_folder = self.vault_path / 'Briefings'
        self.briefings_folder.mkdir(parents=True, exist_ok=True)

        # Load Odoo configuration from environment
        self.odoo_url = os.getenv('ODOO_URL', 'http://localhost:8069')
        self.odoo_db = os.getenv('ODOO_DB', 'ai_employee')
        self.odoo_username = os.getenv('ODOO_USERNAME', 'admin')
        self.odoo_password = os.getenv('ODOO_PASSWORD')

        # Session management
        self.session = requests.Session()
        self.uid = None
        self.session_id = None

        # Connection failure tracking - prevents spamming errors
        self._connection_failed = False
        self._last_connection_attempt = None
        self._retry_delay = self.INITIAL_RETRY_DELAY
        self._connection_error_logged = False

        # Track processed items
        self.last_sync_date = None
        self._load_sync_state()

        # Initialize audit logger
        self.audit_logger = get_audit_logger(str(self.vault_path))

    def _load_sync_state(self):
        """Load last sync state from file."""
        state_file = self.vault_path / '.odoo_sync_state.json'
        if state_file.exists():
            try:
                state = json.loads(state_file.read_text())
                self.last_sync_date = datetime.fromisoformat(state.get('last_sync'))
                self.processed_ids = set(state.get('processed_ids', []))
            except Exception as e:
                self.logger.warning(f'Could not load sync state: {e}')
                self.last_sync_date = datetime.now() - timedelta(days=7)
        else:
            self.last_sync_date = datetime.now() - timedelta(days=7)

    def _save_sync_state(self):
        """Save sync state to file."""
        state_file = self.vault_path / '.odoo_sync_state.json'
        state = {
            'last_sync': datetime.now().isoformat(),
            'processed_ids': list(self.processed_ids)[-1000]  # Keep last 1000
        }
        state_file.write_text(json.dumps(state, indent=2))

    def _json_rpc(self, endpoint: str, params: Dict) -> Any:
        """
        Make a JSON-RPC call to Odoo.

        Args:
            endpoint: API endpoint (e.g., '/web/session/authenticate')
            params: Parameters for the call

        Returns:
            Result from Odoo
        """
        url = f'{self.odoo_url}{endpoint}'
        payload = {
            'jsonrpc': '2.0',
            'method': 'call',
            'params': params,
            'id': int(datetime.now().timestamp() * 1000)
        }

        try:
            response = self.session.post(
                url,
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=30
            )
            response.raise_for_status()
            result = response.json()

            if 'error' in result:
                raise WatcherConnectionError(f"Odoo error: {result['error']}")

            return result.get('result')
        except requests.exceptions.RequestException as e:
            raise WatcherConnectionError(f"Odoo connection failed: {e}")

    def _should_retry_connection(self) -> bool:
        """Check if we should retry connecting based on backoff."""
        if not self._connection_failed:
            return True

        if self._last_connection_attempt is None:
            return True

        elapsed = (datetime.now() - self._last_connection_attempt).total_seconds()
        return elapsed >= self._retry_delay

    def _authenticate(self) -> bool:
        """
        Authenticate with Odoo.

        Returns:
            True if authentication successful
        """
        if not self.odoo_password:
            if not self._connection_error_logged:
                self.logger.info('ODOO_PASSWORD not set. Running in simulation mode.')
                self._connection_error_logged = True
            return False

        # Check if we should skip due to previous failures (backoff)
        if not self._should_retry_connection():
            return False

        self._last_connection_attempt = datetime.now()

        try:
            result = self._json_rpc('/web/session/authenticate', {
                'db': self.odoo_db,
                'login': self.odoo_username,
                'password': self.odoo_password
            })

            if result and result.get('uid'):
                self.uid = result['uid']
                self.session_id = result.get('session_id')
                self.logger.info(f'Authenticated with Odoo as user ID: {self.uid}')
                # Reset failure tracking on success
                self._connection_failed = False
                self._retry_delay = self.INITIAL_RETRY_DELAY
                self._connection_error_logged = False
                return True
            else:
                if not self._connection_error_logged:
                    self.logger.warning('Odoo authentication failed: Invalid credentials')
                    self._connection_error_logged = True
                return False

        except WatcherConnectionError:
            # Connection failed - implement exponential backoff
            self._connection_failed = True
            if not self._connection_error_logged:
                self.logger.warning(
                    f'Odoo server not available at {self.odoo_url}. '
                    f'Running in simulation mode. Will retry in {self._retry_delay}s.'
                )
                self._connection_error_logged = True
            # Exponential backoff, capped at MAX_RETRY_DELAY
            self._retry_delay = min(self._retry_delay * 2, self.MAX_RETRY_DELAY)
            return False
        except Exception as e:
            self._connection_failed = True
            if not self._connection_error_logged:
                self.logger.warning(f'Odoo connection error: {e}. Running in simulation mode.')
                self._connection_error_logged = True
            self._retry_delay = min(self._retry_delay * 2, self.MAX_RETRY_DELAY)
            return False

    def _execute(self, model: str, method: str, args: List = None, kwargs: Dict = None) -> Any:
        """
        Execute an Odoo model method.

        Args:
            model: Odoo model name (e.g., 'account.move')
            method: Method to call (e.g., 'search_read')
            args: Positional arguments
            kwargs: Keyword arguments

        Returns:
            Result from Odoo
        """
        if not self.uid:
            if not self._authenticate():
                return None

        return self._json_rpc('/web/dataset/call_kw', {
            'model': model,
            'method': method,
            'args': args or [],
            'kwargs': kwargs or {}
        })

    def check_for_updates(self) -> list:
        """Check Odoo for new transactions, invoices, and expenses."""
        items = []

        # Try to connect (with backoff if previously failed)
        connected = False
        if self.odoo_password and self._should_retry_connection():
            connected = self._authenticate()

        if connected:
            items.extend(self._fetch_new_invoices())
            items.extend(self._fetch_new_payments())
            items.extend(self._fetch_new_expenses())
            # Also fetch other important updates when connected
            items.extend(self._fetch_new_sales_orders())
            items.extend(self._fetch_new_purchase_orders())
        else:
            # Simulation mode for development/demo (only generate occasionally)
            items.extend(self._get_simulated_data())

        # Check if weekly briefing is due (works even without Odoo connection)
        if self._is_briefing_due():
            items.append({
                'type': 'weekly_briefing',
                'period_start': (datetime.now() - timedelta(days=7)).isoformat(),
                'period_end': datetime.now().isoformat()
            })

        return items

    def _fetch_new_invoices(self) -> List[Dict]:
        """Fetch new invoices from Odoo."""
        items = []

        try:
            # Get invoices modified since last sync
            invoices = self._execute('account.move', 'search_read',
                [[
                    ['move_type', 'in', ['out_invoice', 'in_invoice']],
                    ['write_date', '>=', self.last_sync_date.isoformat()]
                ]],
                {
                    'fields': ['name', 'partner_id', 'amount_total', 'amount_residual',
                               'invoice_date', 'invoice_date_due', 'state', 'payment_state', 'move_type']
                }
            )

            if not invoices:
                return items

            today = datetime.now().date()

            for inv in invoices:
                inv_id = f"INV_{inv['id']}"
                if inv_id in self.processed_ids:
                    continue

                # Check if overdue
                due_date = datetime.strptime(inv['invoice_date_due'], '%Y-%m-%d').date() if inv['invoice_date_due'] else None
                is_overdue = due_date and due_date < today and inv['payment_state'] in ['not_paid', 'partial']

                # Determine priority
                priority = 'high' if is_overdue else ('normal' if inv['amount_total'] > self.SIGNIFICANT_TRANSACTION_THRESHOLD else 'low')

                items.append({
                    'type': 'invoice',
                    'id': inv_id,
                    'odoo_id': inv['id'],
                    'invoice_number': inv['name'],
                    'partner': inv['partner_id'][1] if inv['partner_id'] else 'Unknown',
                    'amount_total': inv['amount_total'],
                    'amount_due': inv['amount_residual'],
                    'invoice_date': inv['invoice_date'],
                    'due_date': inv['invoice_date_due'],
                    'state': inv['state'],
                    'payment_state': inv['payment_state'],
                    'is_customer_invoice': inv['move_type'] == 'out_invoice',
                    'is_overdue': is_overdue,
                    'priority': priority
                })

        except Exception as e:
            self.logger.error(f'Error fetching invoices: {e}')

        return items

    def _fetch_new_payments(self) -> List[Dict]:
        """Fetch new payments from Odoo."""
        items = []

        try:
            payments = self._execute('account.payment', 'search_read',
                [[
                    ['write_date', '>=', self.last_sync_date.isoformat()],
                    ['state', '=', 'posted']
                ]],
                {
                    'fields': ['name', 'partner_id', 'amount', 'date', 'payment_type', 'partner_type']
                }
            )

            if not payments:
                return items

            for payment in payments:
                pay_id = f"PAY_{payment['id']}"
                if pay_id in self.processed_ids:
                    continue

                # Only create action file for significant payments
                if payment['amount'] < self.SIGNIFICANT_TRANSACTION_THRESHOLD:
                    self.processed_ids.add(pay_id)
                    continue

                items.append({
                    'type': 'payment',
                    'id': pay_id,
                    'odoo_id': payment['id'],
                    'reference': payment['name'],
                    'partner': payment['partner_id'][1] if payment['partner_id'] else 'Unknown',
                    'amount': payment['amount'],
                    'date': payment['date'],
                    'payment_type': payment['payment_type'],  # inbound/outbound
                    'partner_type': payment['partner_type'],  # customer/supplier
                    'priority': 'normal'
                })

        except Exception as e:
            self.logger.error(f'Error fetching payments: {e}')

        return items

    def _fetch_new_expenses(self) -> List[Dict]:
        """Fetch new expenses from Odoo."""
        items = []

        try:
            expenses = self._execute('hr.expense', 'search_read',
                [[
                    ['write_date', '>=', self.last_sync_date.isoformat()]
                ]],
                {
                    'fields': ['name', 'unit_amount', 'date', 'state', 'employee_id']
                }
            )

            if not expenses:
                return items

            for exp in expenses:
                exp_id = f"EXP_{exp['id']}"
                if exp_id in self.processed_ids:
                    continue

                # Only create action file for significant expenses
                if exp['unit_amount'] < self.SIGNIFICANT_TRANSACTION_THRESHOLD:
                    self.processed_ids.add(exp_id)
                    continue

                items.append({
                    'type': 'expense',
                    'id': exp_id,
                    'odoo_id': exp['id'],
                    'description': exp['name'],
                    'amount': exp['unit_amount'],
                    'date': exp['date'],
                    'state': exp['state'],
                    'employee': exp['employee_id'][1] if exp['employee_id'] else 'Unknown',
                    'priority': 'normal'
                })

        except Exception as e:
            self.logger.error(f'Error fetching expenses: {e}')

        return items

    def _fetch_new_sales_orders(self) -> List[Dict]:
        """Fetch new sales orders from Odoo."""
        items = []

        try:
            # Get sales orders modified since last sync
            orders = self._execute('sale.order', 'search_read',
                [[
                    ['write_date', '>=', self.last_sync_date.isoformat()],
                    ['state', 'in', ['draft', 'sent', 'sale', 'done']]  # Include all relevant states
                ]],
                {
                    'fields': ['name', 'partner_id', 'date_order', 'state', 'amount_total', 'validity_date']
                }
            )

            if not orders:
                return items

            for order in orders:
                order_id = f"SO_{order['id']}"
                if order_id in self.processed_ids:
                    continue

                # Only create action file for significant orders or specific states
                priority = 'normal'
                if order['state'] in ['draft', 'sent'] and order['amount_total'] > self.SIGNIFICANT_TRANSACTION_THRESHOLD:
                    priority = 'high'  # Needs attention for confirmation
                elif order['state'] == 'done':
                    priority = 'low'  # Just informational

                items.append({
                    'type': 'sales_order',
                    'id': order_id,
                    'odoo_id': order['id'],
                    'order_number': order['name'],
                    'customer': order['partner_id'][1] if order['partner_id'] else 'Unknown',
                    'amount_total': order['amount_total'],
                    'date_order': order['date_order'],
                    'validity_date': order.get('validity_date'),
                    'state': order['state'],
                    'priority': priority
                })

        except Exception as e:
            self.logger.error(f'Error fetching sales orders: {e}')

        return items

    def _fetch_new_purchase_orders(self) -> List[Dict]:
        """Fetch new purchase orders from Odoo."""
        items = []

        try:
            # Get purchase orders modified since last sync
            orders = self._execute('purchase.order', 'search_read',
                [[
                    ['write_date', '>=', self.last_sync_date.isoformat()],
                    ['state', 'in', ['draft', 'sent', 'to approve', 'purchase', 'done', 'cancel']]
                ]],
                {
                    'fields': ['name', 'partner_id', 'date_order', 'state', 'amount_total', 'date_planned']
                }
            )

            if not orders:
                return items

            for order in orders:
                order_id = f"PO_{order['id']}"
                if order_id in self.processed_ids:
                    continue

                # Only create action file for significant orders or specific states
                priority = 'normal'
                if order['state'] in ['draft', 'to approve'] and order['amount_total'] > self.SIGNIFICANT_TRANSACTION_THRESHOLD:
                    priority = 'high'  # Needs approval
                elif order['state'] == 'purchase':
                    priority = 'medium'  # In progress
                elif order['state'] == 'done':
                    priority = 'low'  # Just informational

                items.append({
                    'type': 'purchase_order',
                    'id': order_id,
                    'odoo_id': order['id'],
                    'order_number': order['name'],
                    'supplier': order['partner_id'][1] if order['partner_id'] else 'Unknown',
                    'amount_total': order['amount_total'],
                    'date_order': order['date_order'],
                    'date_planned': order.get('date_planned'),
                    'state': order['state'],
                    'priority': priority
                })

        except Exception as e:
            self.logger.error(f'Error fetching purchase orders: {e}')

        return items

    def _get_simulated_data(self) -> List[Dict]:
        """Generate simulated data for development/demo."""
        import random

        # Only return simulated data occasionally (10% chance)
        if random.random() > 0.1:
            return []

        items = []
        sim_id = f'SIM_{datetime.now().strftime("%Y%m%d%H%M%S")}'

        if sim_id not in self.processed_ids:
            sim_type = random.choice(['invoice', 'payment', 'expense', 'sales_order', 'purchase_order'])

            if sim_type == 'invoice':
                items.append({
                    'type': 'invoice',
                    'id': sim_id,
                    'odoo_id': 0,
                    'invoice_number': f'INV/2026/00{random.randint(100, 999)}',
                    'partner': random.choice(['Client A', 'Client B', 'Client C']),
                    'amount_total': round(random.uniform(500, 5000), 2),
                    'amount_due': round(random.uniform(0, 2500), 2),
                    'invoice_date': datetime.now().strftime('%Y-%m-%d'),
                    'due_date': (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d'),
                    'state': 'posted',
                    'payment_state': random.choice(['paid', 'not_paid', 'partial']),
                    'is_customer_invoice': True,
                    'is_overdue': random.random() > 0.7,
                    'priority': 'normal',
                    'simulated': True
                })
            elif sim_type == 'payment':
                items.append({
                    'type': 'payment',
                    'id': sim_id,
                    'odoo_id': 0,
                    'reference': f'PAY/2026/00{random.randint(100, 999)}',
                    'partner': random.choice(['Client A', 'Client B', 'Vendor X']),
                    'amount': round(random.uniform(100, 3000), 2),
                    'date': datetime.now().strftime('%Y-%m-%d'),
                    'payment_type': random.choice(['inbound', 'outbound']),
                    'partner_type': random.choice(['customer', 'supplier']),
                    'priority': 'normal',
                    'simulated': True
                })
            elif sim_type == 'sales_order':
                items.append({
                    'type': 'sales_order',
                    'id': sim_id,
                    'odoo_id': 0,
                    'order_number': f'SO/2026/00{random.randint(100, 999)}',
                    'customer': random.choice(['Client A', 'Client B', 'Client C']),
                    'amount_total': round(random.uniform(1000, 8000), 2),
                    'date_order': datetime.now().strftime('%Y-%m-%d'),
                    'validity_date': (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d'),
                    'state': random.choice(['draft', 'sent', 'sale', 'done']),
                    'priority': 'normal',
                    'simulated': True
                })
            elif sim_type == 'purchase_order':
                items.append({
                    'type': 'purchase_order',
                    'id': sim_id,
                    'odoo_id': 0,
                    'order_number': f'PO/2026/00{random.randint(100, 999)}',
                    'supplier': random.choice(['Vendor X', 'Vendor Y', 'Supplier Z']),
                    'amount_total': round(random.uniform(500, 5000), 2),
                    'date_order': datetime.now().strftime('%Y-%m-%d'),
                    'date_planned': (datetime.now() + timedelta(days=14)).strftime('%Y-%m-%d'),
                    'state': random.choice(['draft', 'sent', 'to approve', 'purchase', 'done']),
                    'priority': 'normal',
                    'simulated': True
                })
            else:
                items.append({
                    'type': 'expense',
                    'id': sim_id,
                    'odoo_id': 0,
                    'description': random.choice(['Software Subscription', 'Office Supplies', 'Travel', 'Marketing']),
                    'amount': round(random.uniform(50, 500), 2),
                    'date': datetime.now().strftime('%Y-%m-%d'),
                    'state': 'reported',
                    'employee': 'Admin',
                    'priority': 'low',
                    'simulated': True
                })

        return items

    def _is_briefing_due(self) -> bool:
        """Check if weekly CEO briefing is due (Sunday night or Monday morning)."""
        now = datetime.now()

        # Check if it's Sunday after 8 PM or Monday before noon
        is_briefing_time = (now.weekday() == 6 and now.hour >= 20) or (now.weekday() == 0 and now.hour < 12)

        if not is_briefing_time:
            return False

        # Check if we already generated one for this week
        week_start = now - timedelta(days=now.weekday())
        briefing_file = self.briefings_folder / f'{week_start.strftime("%Y-%m-%d")}_Monday_Briefing.md'

        return not briefing_file.exists()

    def create_action_file(self, item) -> Path:
        """Create action file based on item type."""
        item_type = item.get('type')

        if item_type == 'invoice':
            return self._create_invoice_file(item)
        elif item_type == 'payment':
            return self._create_payment_file(item)
        elif item_type == 'expense':
            return self._create_expense_file(item)
        elif item_type == 'sales_order':
            return self._create_sales_order_file(item)
        elif item_type == 'purchase_order':
            return self._create_purchase_order_file(item)
        elif item_type == 'weekly_briefing':
            return self._create_briefing_request(item)

        return None

    def _create_invoice_file(self, item: Dict) -> Optional[Path]:
        """Create action file for an invoice."""
        # Log to monthly accounting file
        self._log_transaction(item)

        # Only create action file for significant or overdue invoices
        if not item.get('is_overdue') and item['amount_total'] < self.SIGNIFICANT_TRANSACTION_THRESHOLD:
            self.processed_ids.add(item['id'])
            self._save_sync_state()
            return None

        priority = item.get('priority', 'normal')

        metadata = {
            'type': 'odoo_invoice',
            'source': 'odoo',
            'invoice_id': item['id'],
            'odoo_id': item['odoo_id'],
            'invoice_number': item['invoice_number'],
            'amount_total': item['amount_total'],
            'amount_due': item['amount_due'],
            'due_date': item['due_date'],
            'status': 'pending_action' if item.get('is_overdue') else 'pending_review',
            'priority': priority
        }

        content = self.format_frontmatter(metadata)
        content += f"""
## Invoice Details

**Invoice #:** {item['invoice_number']}
**Customer/Vendor:** {item['partner']}
**Total Amount:** ${item['amount_total']:,.2f}
**Amount Due:** ${item['amount_due']:,.2f}
**Invoice Date:** {item['invoice_date']}
**Due Date:** {item['due_date']}
**Payment Status:** {item['payment_state']}
"""

        if item.get('is_overdue'):
            content += """
## !! OVERDUE INVOICE !!

This invoice is past due. Immediate action required.

## Suggested Actions
- [ ] Send payment reminder to customer
- [ ] Follow up via phone call if no response in 48 hours
- [ ] Consider escalation procedures
- [ ] Update customer credit status if repeated
"""
        elif item.get('is_customer_invoice'):
            content += """
## Suggested Actions
- [ ] Verify invoice accuracy
- [ ] Send to customer if not yet delivered
- [ ] Schedule follow-up reminder before due date
"""
        else:
            content += """
## Suggested Actions
- [ ] Review vendor invoice accuracy
- [ ] Schedule payment before due date
- [ ] Categorize expense appropriately
"""

        if item.get('simulated'):
            content += '\n> **Note:** This is simulated data for development.\n'

        filename = f'INV_{item["invoice_number"].replace("/", "_")}_{item["id"]}.md'
        filepath = self.needs_action / filename
        self.create_file_safely(filepath, content)

        self.processed_ids.add(item['id'])
        self._save_sync_state()

        # Audit log
        self.audit_logger.log(
            ActionType.FILE_CREATE,
            str(filepath),
            parameters={'invoice': item['invoice_number'], 'amount': item['amount_total']},
            result='success'
        )

        return filepath

    def _create_payment_file(self, item: Dict) -> Optional[Path]:
        """Create action file for a payment."""
        # Log to monthly accounting file
        self._log_transaction(item)

        metadata = {
            'type': 'odoo_payment',
            'source': 'odoo',
            'payment_id': item['id'],
            'odoo_id': item['odoo_id'],
            'reference': item['reference'],
            'amount': item['amount'],
            'date': item['date'],
            'status': 'pending_review',
            'priority': item.get('priority', 'normal')
        }

        payment_direction = 'received' if item['payment_type'] == 'inbound' else 'sent'

        content = self.format_frontmatter(metadata)
        content += f"""
## Payment Details

**Reference:** {item['reference']}
**Partner:** {item['partner']}
**Amount:** ${item['amount']:,.2f}
**Date:** {item['date']}
**Type:** Payment {payment_direction} ({item['partner_type']})

## Suggested Actions
- [ ] Verify payment matches invoice
- [ ] Confirm bank reconciliation
- [ ] Update accounting records
"""

        if item.get('simulated'):
            content += '\n> **Note:** This is simulated data for development.\n'

        filename = f'PAY_{item["reference"].replace("/", "_")}_{item["id"]}.md'
        filepath = self.needs_action / filename
        self.create_file_safely(filepath, content)

        self.processed_ids.add(item['id'])
        self._save_sync_state()

        return filepath

    def _create_expense_file(self, item: Dict) -> Optional[Path]:
        """Create action file for an expense."""
        # Log to monthly accounting file
        self._log_transaction(item)

        metadata = {
            'type': 'odoo_expense',
            'source': 'odoo',
            'expense_id': item['id'],
            'odoo_id': item['odoo_id'],
            'amount': item['amount'],
            'date': item['date'],
            'status': 'pending_review',
            'priority': item.get('priority', 'normal')
        }

        content = self.format_frontmatter(metadata)
        content += f"""
## Expense Details

**Description:** {item['description']}
**Amount:** ${item['amount']:,.2f}
**Date:** {item['date']}
**Submitted By:** {item['employee']}
**Status:** {item['state']}

## Suggested Actions
- [ ] Verify receipt/documentation
- [ ] Approve or request more information
- [ ] Categorize for budget tracking
"""

        if item.get('simulated'):
            content += '\n> **Note:** This is simulated data for development.\n'

        filename = f'EXP_{item["id"]}_{datetime.now().strftime("%Y%m%d")}.md'
        filepath = self.needs_action / filename
        self.create_file_safely(filepath, content)

        self.processed_ids.add(item['id'])
        self._save_sync_state()

        return filepath

    def _create_sales_order_file(self, item: Dict) -> Optional[Path]:
        """Create action file for a sales order."""
        # Log to monthly accounting file
        self._log_transaction(item)

        metadata = {
            'type': 'odoo_sales_order',
            'source': 'odoo',
            'order_id': item['id'],
            'odoo_id': item['odoo_id'],
            'order_number': item['order_number'],
            'amount_total': item['amount_total'],
            'date_order': item['date_order'],
            'status': item['state'],
            'priority': item.get('priority', 'normal')
        }

        content = self.format_frontmatter(metadata)
        content += f"""
## Sales Order Details

**Order #:** {item['order_number']}
**Customer:** {item['customer']}
**Total Amount:** ${item['amount_total']:,.2f}
**Order Date:** {item['date_order']}
**Validity Date:** {item.get('validity_date', 'N/A')}
**Status:** {item['state']}

## Suggested Actions
"""

        if item['state'] in ['draft', 'sent']:
            content += """- [ ] Review order details
- [ ] Confirm with customer if needed
- [ ] Convert to sales order if approved
- [ ] Update inventory if applicable
"""
        elif item['state'] == 'sale':
            content += """- [ ] Check fulfillment status
- [ ] Monitor delivery progress
- [ ] Prepare invoice when fulfilled
"""
        elif item['state'] == 'done':
            content += """- [ ] Verify completion
- [ ] Close order in system
- [ ] Archive for records
"""

        if item.get('simulated'):
            content += '\n> **Note:** This is simulated data for development.\n'

        filename = f'SO_{item["order_number"].replace("/", "_")}_{item["id"]}.md'
        filepath = self.needs_action / filename
        self.create_file_safely(filepath, content)

        self.processed_ids.add(item['id'])
        self._save_sync_state()

        return filepath

    def _create_purchase_order_file(self, item: Dict) -> Optional[Path]:
        """Create action file for a purchase order."""
        # Log to monthly accounting file
        self._log_transaction(item)

        metadata = {
            'type': 'odoo_purchase_order',
            'source': 'odoo',
            'order_id': item['id'],
            'odoo_id': item['odoo_id'],
            'order_number': item['order_number'],
            'amount_total': item['amount_total'],
            'date_order': item['date_order'],
            'status': item['state'],
            'priority': item.get('priority', 'normal')
        }

        content = self.format_frontmatter(metadata)
        content += f"""
## Purchase Order Details

**Order #:** {item['order_number']}
**Supplier:** {item['supplier']}
**Total Amount:** ${item['amount_total']:,.2f}
**Order Date:** {item['date_order']}
**Planned Date:** {item.get('date_planned', 'N/A')}
**Status:** {item['state']}

## Suggested Actions
"""

        if item['state'] in ['draft', 'to approve']:
            content += """- [ ] Review order details
- [ ] Verify supplier information
- [ ] Get required approvals
- [ ] Submit for processing
"""
        elif item['state'] == 'purchase':
            content += """- [ ] Monitor delivery status
- [ ] Prepare for receipt
- [ ] Schedule inspection if needed
"""
        elif item['state'] == 'done':
            content += """- [ ] Verify receipt
- [ ] Process payment
- [ ] Update inventory if applicable
- [ ] Archive for records
"""

        if item.get('simulated'):
            content += '\n> **Note:** This is simulated data for development.\n'

        filename = f'PO_{item["order_number"].replace("/", "_")}_{item["id"]}.md'
        filepath = self.needs_action / filename
        self.create_file_safely(filepath, content)

        self.processed_ids.add(item['id'])
        self._save_sync_state()

        return filepath

    def _create_briefing_request(self, item: Dict) -> Path:
        """Create request for weekly CEO briefing generation."""
        metadata = {
            'type': 'ceo_briefing_request',
            'source': 'odoo_watcher',
            'period_start': item['period_start'],
            'period_end': item['period_end'],
            'status': 'pending',
            'priority': 'high',
            'auto_generate': True
        }

        content = self.format_frontmatter(metadata)
        content += f"""
## Weekly CEO Briefing Request

A weekly CEO briefing should be generated for the period:
- **Start:** {item['period_start']}
- **End:** {item['period_end']}

## Instructions for Claude

Use the `ceo-briefing.skill.md` to generate a comprehensive Monday Morning CEO Briefing.

### Data Sources
1. **Odoo MCP** - Query financial data:
   - `odoo_get_revenue_report` for revenue
   - `odoo_get_expense_report` for expenses
   - `odoo_get_unpaid_invoices` for outstanding AR
   - `odoo_get_aging_report` for AR aging
   - `odoo_get_profit_loss` for P&L summary
   - `odoo_get_cash_flow` for cash flow analysis
   - `odoo_get_sales_orders` for sales order status

2. **Vault Data**:
   - `/Done/` folder for completed tasks
   - `/Dashboard.md` for activity history
   - `/Business_Goals.md` for targets

### Include in Briefing:
1. Revenue summary with target comparison
2. Outstanding invoices with aging breakdown
3. Expense breakdown by category
4. Sales order pipeline status
5. Purchase order status
6. Completed tasks summary
7. Cash flow status
8. Proactive recommendations
9. Upcoming deadlines

## Output Location
Save the briefing to: `/Briefings/{datetime.now().strftime('%Y-%m-%d')}_Monday_Briefing.md`
"""

        filename = f'BRIEFING_REQUEST_{datetime.now().strftime("%Y%m%d")}.md'
        filepath = self.needs_action / filename
        self.create_file_safely(filepath, content)

        return filepath

    def _log_transaction(self, item: Dict):
        """Log transaction to monthly accounting file."""
        month_file = self.accounting_folder / f'{datetime.now().strftime("%Y-%m")}_Transactions.md'

        # Create or append to monthly file
        if not month_file.exists():
            header = f"""---
type: monthly_transactions
month: {datetime.now().strftime('%Y-%m')}
source: odoo
---

# Transactions - {datetime.now().strftime('%B %Y')}

| Date | Type | Description | Amount | Partner |
|------|------|-------------|--------|---------|
"""
            month_file.write_text(header)

        # Determine transaction details based on type
        txn_type = item.get('type', 'unknown')
        if txn_type == 'invoice':
            description = item.get('invoice_number', 'Invoice')
            amount = item.get('amount_total', 0)
        elif txn_type == 'payment':
            description = item.get('reference', 'Payment')
            amount = item.get('amount', 0)
            if item.get('payment_type') == 'outbound':
                amount = -amount
        elif txn_type == 'expense':
            description = item.get('description', 'Expense')
            amount = -item.get('amount', 0)
        elif txn_type == 'sales_order':
            description = item.get('order_number', 'Sales Order')
            amount = item.get('amount_total', 0)
        elif txn_type == 'purchase_order':
            description = item.get('order_number', 'Purchase Order')
            amount = -item.get('amount_total', 0)  # Negative since it's an outgoing expense
        else:
            description = 'Unknown'
            amount = 0

        partner = item.get('partner', item.get('employee', item.get('customer', item.get('supplier', 'Unknown'))))
        date_str = item.get('date', item.get('invoice_date', item.get('date_order', datetime.now().strftime('%Y-%m-%d'))))

        # Append transaction
        content = month_file.read_text()
        new_row = f"| {date_str[:10]} | {txn_type} | {description[:30]} | ${amount:,.2f} | {partner} |\n"
        content += new_row
        month_file.write_text(content)


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Odoo Accounting Watcher')
    parser.add_argument('--vault', default='./AI_Employee_Vault', help='Path to vault')
    parser.add_argument('--interval', type=int, default=3600, help='Check interval in seconds')
    parser.add_argument('--once', action='store_true', help='Run once and exit')

    args = parser.parse_args()

    watcher = OdooWatcher(args.vault, args.interval)

    if args.once:
        items = watcher.check_for_updates()
        for item in items:
            watcher.create_action_file(item)
        print(f'Processed {len(items)} items')
    else:
        watcher.run()
