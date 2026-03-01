# Odoo Accounting Skill

## Description
Manages accounting operations through the Odoo MCP server including invoice creation, payment recording, expense logging, and financial report generation.

## When to Use
- Creating customer invoices
- Recording payments received
- Logging business expenses
- Generating financial reports (balance sheet, P&L, aging)
- Checking outstanding invoices
- Analyzing cash flow

## Input Requirements
- Odoo MCP server configured and running
- Valid Odoo credentials in environment variables
- Partner/customer information for invoices
- Transaction details (amounts, descriptions, dates)

## MCP Tools Available

### Customer Management
- `odoo_create_customer` - Create new customer/partner
- `odoo_find_customer` - Search for existing customers

### Invoice Operations
- `odoo_create_invoice` - Create new customer invoice
- `odoo_get_unpaid_invoices` - List outstanding invoices
- `odoo_get_aging_report` - Accounts receivable aging

### Payment Operations
- `odoo_record_payment` - Record payment against invoice

### Expense Operations
- `odoo_create_expense` - Record business expense

### Product Management
- `odoo_create_product` - Create new product/service

### Purchase Operations
- `odoo_create_purchase_order` - Create purchase order for suppliers

### Sales Operations
- `odoo_get_sales_orders` - Get list of sales orders

### Reporting
- `odoo_get_balance_sheet` - Financial position report
- `odoo_get_profit_loss` - Income statement
- `odoo_get_revenue_report` - Revenue analysis
- `odoo_get_expense_report` - Expense analysis
- `odoo_get_cash_flow` - Cash flow statement
- `odoo_get_bank_transactions` - Recent bank activity

## Process Steps

### Managing Customers

1. **Creating a New Customer**
   - Verify customer information is complete
   - Check if customer already exists using `odoo_find_customer`
   - Create customer with `odoo_create_customer`

   ```
   Tool: odoo_create_customer
   Parameters:
     name: "Customer Company Name"
     email: "contact@customer.com"
     phone: "+1234567890"
     street: "123 Business St"
     city: "Business City"
     country: "USA"
   ```

2. **Finding Existing Customers**
   - Search by name or email using `odoo_find_customer`
   - Verify customer details before proceeding with transactions

   ```
   Tool: odoo_find_customer
   Parameters:
     name: "Customer Company Name"
   ```

### Creating an Invoice

1. **Validate Invoice Data**
   - Verify partner/customer name exists
   - Validate amounts are positive numbers
   - Check description is meaningful
   - Confirm due date is in the future

2. **Create Invoice in Odoo**
   ```
   Tool: odoo_create_invoice
   Parameters:
     partner_name: "Customer Name"
     lines: [
       {"description": "Service Description", "quantity": 1, "price_unit": 500}
     ]
     due_date: "2026-02-15"
   ```

3. **Record in Audit Log**
   - Log invoice ID and amount
   - Note approval status
   - Save to vault logs

4. **Notify Stakeholders**
   - Update dashboard
   - Create notification if high value

### Managing Products/Services

1. **Creating a New Product**
   - Verify product details are complete
   - Create product with `odoo_create_product`

   ```
   Tool: odoo_create_product
   Parameters:
     name: "Service Name"
     description: "Detailed service description"
     sale_price: 500.00
     category: "Services"
     type: "service"
   ```

### Creating Purchase Orders

1. **Prepare Purchase Order**
   - Verify supplier exists
   - Prepare line items with products/services
   - Validate quantities and prices

2. **Create Purchase Order**
   ```
   Tool: odoo_create_purchase_order
   Parameters:
     supplier_name: "Supplier Name"
     line_items: [
       {
         "product_name": "Product A",
         "quantity": 10,
         "unit_price": 25.00
       }
     ]
     expected_date: "2026-02-15"
   ```

### Recording a Payment

1. **Verify Invoice Exists**
   - Get invoice details from Odoo
   - Confirm invoice is unpaid/partial

2. **Record Payment**
   ```
   Tool: odoo_record_payment
   Parameters:
     invoice_id: 123
     amount: 500.00
     payment_date: "2026-01-18"
   ```

3. **Update Records**
   - Log payment to audit trail
   - Update outstanding invoices list

### Generating Financial Reports

1. **Determine Report Type and Period**
   - Balance Sheet: Point-in-time snapshot
   - P&L: Date range (start_date to end_date)
   - Cash Flow: Date range

2. **Call Appropriate Tool**
   ```
   Tool: odoo_get_profit_loss
   Parameters:
     start_date: "2026-01-01"
     end_date: "2026-01-31"
   ```

3. **Format Results**
   - Present in readable format
   - Highlight key metrics
   - Compare to targets if available

## Validation Rules

### Invoice Amounts
- Minimum: $1.00
- Requires approval: > $1,000
- Requires CEO approval: > $10,000

### Payment Recording
- Amount cannot exceed invoice balance
- Date cannot be in the future
- Must reference valid invoice ID

### Expense Categories
- Software & Subscriptions
- Office Supplies
- Travel & Entertainment
- Professional Services
- Marketing & Advertising
- Utilities
- Other

## Error Handling

### Connection Errors
- Retry with exponential backoff (3 attempts)
- Fall back to simulation mode if unavailable
- Queue transaction for later if critical

### Authentication Errors
- Alert human for credential refresh
- Check environment variables
- Verify Odoo user permissions

### Data Errors
- Validate all inputs before API call
- Return clear error messages
- Suggest corrections when possible

## Example Workflows

### New Customer Onboarding
```
1. Receive customer information
2. Check if customer exists using odoo_find_customer
3. If new customer:
   a. Validate contact details
   b. Create customer with odoo_create_customer
4. Log customer creation to audit trail
5. Update dashboard
```

### Monthly Invoice Batch
```
1. Read pending invoices from vault
2. For each invoice request:
   a. Validate data
   b. Create in Odoo
   c. Log to audit trail
3. Generate summary report
4. Update dashboard
```

### Product/Service Catalog Management
```
1. Receive new product request
2. Validate product details
3. Create product with odoo_create_product
4. Log to audit trail
5. Update inventory records
```

### Purchase Order Processing
```
1. Receive purchase request
2. Validate supplier information
3. Prepare line items
4. Create purchase order with odoo_create_purchase_order
5. Track order status with odoo_get_sales_orders
6. Update procurement records
```

### Weekly AR Review
```
1. Get aging report
2. Identify overdue invoices
3. For each overdue > 30 days:
   a. Draft reminder email
   b. Create action file for approval
4. Generate AR summary
```

### End-of-Month Reporting
```
1. Generate P&L for month
2. Generate balance sheet
3. Generate cash flow analysis
4. Get sales order status
5. Compile into CEO briefing
6. Save to Briefings folder
```

## Integration Points
- CEO Briefing Generator (provides financial data)
- Ralph Wiggum Loop (executes invoice/payment steps)
- Email Processor (payment confirmation emails, customer notifications)
- Dashboard (financial KPIs, customer metrics, procurement status)
- Customer Onboarding Workflow (creates new customers in Odoo)
- Procurement System (handles purchase orders and supplier management)

## Security Considerations
- Never log full credentials
- Mask account numbers in logs
- Require approval for large transactions
- Use DRY_RUN mode for testing

## Success Metrics
- Invoice creation: < 5 seconds
- Report generation: < 10 seconds
- Error rate: < 1%
- Data accuracy: 100%
