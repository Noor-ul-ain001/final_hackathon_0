# Odoo Integration for AI Employee

## Overview

The Odoo integration provides comprehensive ERP (Enterprise Resource Planning) functionality for the AI Employee system. It connects to an Odoo Community Edition instance to manage accounting, customer relationships, inventory, sales, and procurement operations.

## Components

### 1. Odoo MCP Server (`mcp/odoo-mcp/`)

The Model Context Protocol (MCP) server enables Claude Code to interact with Odoo through a secure API. It supports both JSON-RPC and XML-RPC protocols for compatibility with different Odoo versions.

#### Available Tools

**Customer Management:**
- `odoo_create_customer` - Create new customer/partner
- `odoo_find_customer` - Search for existing customers

**Invoice Operations:**
- `odoo_create_invoice` - Create customer invoice
- `odoo_get_unpaid_invoices` - List outstanding invoices
- `odoo_get_aging_report` - Accounts receivable aging

**Payment Operations:**
- `odoo_record_payment` - Record payment against invoice

**Expense Operations:**
- `odoo_create_expense` - Record business expense

**Product Management:**
- `odoo_create_product` - Create new product/service

**Purchase Operations:**
- `odoo_create_purchase_order` - Create purchase order for suppliers

**Sales Operations:**
- `odoo_get_sales_orders` - Get list of sales orders

**Reporting:**
- `odoo_get_balance_sheet` - Financial position report
- `odoo_get_profit_loss` - Income statement
- `odoo_get_revenue_report` - Revenue analysis
- `odoo_get_expense_report` - Expense analysis
- `odoo_get_cash_flow` - Cash flow statement
- `odoo_get_bank_transactions` - Recent bank activity

### 2. Odoo Watcher (`odoo_watcher.py`)

Monitors Odoo for new transactions and creates action files in the Obsidian vault for review. The watcher operates on a configurable interval (default: hourly).

#### Features:
- Monitors invoices, payments, expenses, sales orders, and purchase orders
- Creates action files for significant transactions (> $100)
- Generates weekly CEO briefings
- Maintains transaction logs in `/Accounting/YYYY-MM_Transactions.md`
- Includes simulation mode for development

### 3. Odoo Skill (`skills/odoo-accounting.skill.md`)

Defines the workflow and best practices for using Odoo functionality within the AI Employee system.

## Configuration

### Environment Variables

Add the following to your `.env` file:

```bash
# Odoo Configuration
ODOO_URL=http://localhost:8069
ODOO_DB=ai_employee
ODOO_USERNAME=admin
ODOO_PASSWORD=your_admin_password
USE_ODOO_MCP=true
```

### MCP Configuration

The `mcp.json` file should include the Odoo server configuration:

```json
{
  "name": "odoo",
  "command": "node",
  "args": ["C:/path/to/mcp/odoo-mcp/index.js"],
  "env": {
    "ODOO_URL": "http://localhost:8069",
    "ODOO_DB": "ai_employee",
    "ODOO_USERNAME": "admin",
    "ODOO_PASSWORD": "your_password",
    "VAULT_PATH": "./AI_Employee_Vault",
    "DRY_RUN": "false",
    "NODE_ENV": "production"
  }
}
```

## Usage Examples

### Creating an Invoice

```javascript
// Using MCP client
const result = await client.call_tool('odoo', 'odoo_create_invoice', {
  partner_name: "Acme Corporation",
  amount: 1500.00,
  description: "Website Development Services",
  due_date: "2026-02-15"
});
```

### Getting Financial Reports

```javascript
// Get revenue report for January 2026
const revenue = await client.call_tool('odoo', 'odoo_get_revenue_report', {
  start_date: "2026-01-01",
  end_date: "2026-01-31"
});

// Get aging report
const aging = await client.call_tool('odoo', 'odoo_get_aging_report', {});
```

### Creating a Customer

```javascript
// Create a new customer
const customer = await client.call_tool('odoo', 'odoo_create_customer', {
  name: "New Customer Inc.",
  email: "contact@newcustomer.com",
  phone: "+1-555-123-4567",
  street: "123 Business Ave",
  city: "Business City",
  country: "United States"
});
```

## Security Considerations

1. **Credential Management**: Store Odoo credentials in environment variables, never in code
2. **Approval Workflows**: Large transactions require human approval
3. **Audit Logging**: All Odoo operations are logged for review
4. **Dry Run Mode**: Test operations without making changes to Odoo

## Error Handling

The system implements robust error handling:

- **Connection Errors**: Automatic retry with exponential backoff
- **Authentication Errors**: Credential refresh alerts
- **Data Errors**: Validation before API calls
- **Simulation Mode**: Fallback when Odoo is unavailable

## Integration Points

- **CEO Briefing Generator**: Uses Odoo data for financial reporting
- **Ralph Wiggum Loop**: Executes multi-step accounting workflows
- **Email Processor**: Sends customer notifications
- **Dashboard**: Displays financial KPIs
- **Procurement System**: Manages purchase orders and suppliers

## Troubleshooting

### Common Issues

1. **Connection Refused**: Verify Odoo server is running and accessible
2. **Authentication Failed**: Check credentials in environment variables
3. **Permission Denied**: Ensure user has required access rights in Odoo
4. **Timeout Errors**: Check network connectivity and Odoo server performance

### Debugging

Enable debug logging by setting `LOG_LEVEL=DEBUG` in your environment.

## Development Notes

### Extending Functionality

To add new Odoo operations:

1. Add the tool definition to the TOOLS array in `mcp/odoo-mcp/index.js`
2. Implement the corresponding function
3. Add the function call to the `executeTool` switch statement
4. Update the Odoo skill documentation

### Testing

Use the test script to verify functionality:
```bash
python test_odoo_integration.py
```

## Production Deployment

For production use:

1. Ensure SSL/TLS encryption for Odoo connections
2. Implement proper backup procedures
3. Monitor system performance and resource usage
4. Regular security audits of credentials and access controls