# Xero Accounting Skill

## Description
Manages accounting operations through the Xero MCP server including invoice management,
payment recording, contact management, bank transaction tracking, and financial report
generation for the Gold Tier AI Employee.

## When to Use
- Creating customer invoices in Xero
- Recording payments received against invoices
- Fetching bank transactions for expense tracking
- Generating P&L or Balance Sheet financial reports
- Looking up or creating contacts (customers/suppliers)
- Producing the weekly financial summary for CEO briefings
- Checking overdue invoices and triggering payment reminders

## Prerequisites
- Xero MCP server configured and running (`mcp/xero-mcp/index.js`)
- Xero credentials set in `.env`:
  - `XERO_CLIENT_ID` — from your Xero app at https://developer.xero.com/myapps/
  - `XERO_CLIENT_SECRET`
  - `XERO_TENANT_ID` — your Xero organisation ID
  - `XERO_REFRESH_TOKEN` — obtained from one-time OAuth flow
- Without credentials the server runs in **simulation mode** (safe for development)

## MCP Tools Available

### Invoice Operations
- `xero_get_invoices` — List invoices (filter by status, date range, contact)
- `xero_create_invoice` — Create a new ACCREC (accounts receivable) invoice
- `xero_record_payment` — Record payment against an existing invoice

### Bank & Transaction Operations
- `xero_get_bank_transactions` — Fetch bank transactions (SPEND / RECEIVE)

### Contact Management
- `xero_get_contacts` — Search for customers and suppliers
- `xero_create_contact` — Create a new customer or supplier contact

### Financial Reports
- `xero_get_profit_loss` — Generate Profit & Loss for a date range
- `xero_get_balance_sheet` — Generate Balance Sheet at a point in time
- `xero_get_accounts` — List chart of accounts (filter by type)

### Summary & Briefings
- `xero_get_weekly_summary` — Full financial summary for CEO briefing (revenue, expenses, overdue)

## Process Steps

### Creating a Customer Invoice

1. **Find or create the contact**
   ```
   Tool: xero_get_contacts
   Parameters:
     search: "Customer Company Name"
     is_customer: true
   ```
   If not found, create them:
   ```
   Tool: xero_create_contact
   Parameters:
     name: "Customer Company Name"
     email: "billing@customer.com"
     is_customer: true
   ```

2. **Create the invoice**
   ```
   Tool: xero_create_invoice
   Parameters:
     contact_name: "Customer Company Name"
     line_items:
       - description: "Consulting Services - February 2026"
         quantity: 10
         unit_amount: 150
         account_code: "200"
     due_date: "2026-03-31"
     reference: "PO-12345"
   ```

3. **Log and notify**
   - Write invoice details to audit log
   - Update Dashboard.md with new invoice
   - If amount > $1,000 create approval file in Pending_Approval/

### Recording a Payment

1. **Get the invoice ID**
   ```
   Tool: xero_get_invoices
   Parameters:
     status: "AUTHORISED"
     contact_name: "Customer Company Name"
   ```

2. **Record the payment** (requires human approval if amount > $500)
   ```
   Tool: xero_record_payment
   Parameters:
     invoice_id: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
     amount: 1500.00
     payment_date: "2026-03-01"
     account_code: "090"
   ```

3. **Update records**
   - Log payment to Logs/ folder
   - Move invoice action file to Done/
   - Update Dashboard.md

### Checking for Overdue Invoices

1. **Fetch authorised invoices**
   ```
   Tool: xero_get_invoices
   Parameters:
     status: "AUTHORISED"
   ```

2. **Identify overdue** (is_overdue == true in response)

3. **For each overdue invoice**, create a Needs_Action file:
   ```
   filename: INV_OVERDUE_{invoice_number}.md
   priority: high
   suggested actions:
     - Send payment reminder via email-mcp
     - Follow up via WhatsApp if no response in 48h
   ```

### Generating the Weekly CEO Briefing Data

1. **Get full weekly summary**
   ```
   Tool: xero_get_weekly_summary
   Parameters:
     days: 7
   ```

2. **Use the result** to populate the CEO briefing template:
   - Revenue section: `summary.revenue.invoiced`
   - Bank inflows: `summary.revenue.received_in_bank`
   - Expenses: `summary.expenses.total`
   - Net cash flow: `summary.net_cashflow`
   - Overdue invoices: `summary.overdue_invoices`

3. **Generate P&L for month-to-date**
   ```
   Tool: xero_get_profit_loss
   Parameters:
     from_date: "2026-03-01"
     to_date: "2026-03-01"
   ```

### Monthly Financial Report

1. Generate P&L for the month
2. Generate Balance Sheet at month-end
3. Fetch all bank transactions for the month
4. Compile into Briefings/{date}_Monthly_Report.md
5. Highlight:
   - Revenue vs target (from Business_Goals.md)
   - Largest expense categories
   - Outstanding receivables
   - Subscription costs (flag unused ones)

## Approval Rules

| Action | Auto-approve | Requires human approval |
|--------|-------------|------------------------|
| Create invoice | Always | — |
| Record payment ≤ $100 | Yes (known contacts) | — |
| Record payment $100–$1,000 | — | Yes |
| Record payment > $1,000 | — | Always |
| Create new contact | Yes | — |
| Delete/void invoice | — | Always |

## Error Handling

### No Credentials (Simulation Mode)
- All tools return realistic simulated data
- Safe for development and demos
- No data is written to Xero

### Token Expired
- Server automatically refreshes using XERO_REFRESH_TOKEN
- If refresh fails: alert human, pause Xero operations

### API Rate Limits
- Xero limits: 60 requests/minute, 5,000/day
- Server returns clear error on 429 response
- Wait and retry after cool-down

### Duplicate Invoices
- Check existing invoices before creating
- Use `reference` field to match POs

## Example Workflows

### New Client Payment Received
```
1. Webhook / watcher detects bank credit
2. xero_get_invoices (status: AUTHORISED, contact: client)
3. Match payment amount to invoice
4. Create approval file in Pending_Approval/
5. Human approves → xero_record_payment
6. Update Dashboard.md
7. Send payment confirmation email via email-mcp
```

### Sunday Night CEO Briefing Trigger
```
1. xero_get_weekly_summary (days: 7)
2. xero_get_profit_loss (MTD)
3. Feed data into ceo-briefing.skill.md
4. Save to Briefings/YYYY-MM-DD_Monday_Briefing.md
5. Send WhatsApp notification to owner
```

### Overdue Invoice Follow-up
```
1. xero_get_invoices (status: AUTHORISED)
2. Filter is_overdue == true
3. For each:
   a. Draft reminder email (email-processor.skill.md)
   b. Create APPROVAL_REQUIRED file
   c. Human approves → send via email-mcp
4. Log follow-up in audit trail
```

## Integration Points
- **CEO Briefing** (`ceo-briefing.skill.md`) — provides financial KPIs
- **Email Processor** (`email-processor.skill.md`) — sends invoice & payment emails
- **Approval Handler** (`approval-handler.skill.md`) — gates large payments
- **Dashboard Updater** (`dashboard-updater.skill.md`) — reflects financial state
- **Weekly Audit** (`weekly-audit.skill.md`) — includes Xero subscription audit

## Security Considerations
- Never log XERO_CLIENT_SECRET or XERO_REFRESH_TOKEN
- Mask account numbers in audit logs (show last 4 digits only)
- All payment actions require human-in-the-loop approval above threshold
- Use DRY_RUN=true for testing
- Rotate credentials if refresh token is compromised
