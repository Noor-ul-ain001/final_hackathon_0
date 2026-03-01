# Odoo Setup Guide - Gold Tier Requirement

This guide covers setting up Odoo Community Edition for the AI Employee Gold Tier requirement: **"Create an accounting system for your business in Odoo Community (self-hosted, local) and integrate it via an MCP server using Odoo's JSON-RPC APIs."**

## Quick Start (Windows)

```bash
# Run the setup script
setup_odoo.bat
```

Or manually:

```bash
# Start Odoo with Docker
docker-compose up -d

# Wait 60 seconds, then open
# http://localhost:8069
```

## Prerequisites

- **Docker Desktop**: [Download here](https://www.docker.com/products/docker-desktop)
- **4GB RAM minimum** available for Docker
- **Port 8069** available (Odoo web interface)
- **Port 5432** available (PostgreSQL database)

## Step-by-Step Setup

### 1. Start Odoo Services

```bash
# From the AI_Employee directory
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f odoo
```

### 2. Create Database

1. Open http://localhost:8069 in your browser
2. You'll see the database creation page
3. Fill in:
   - **Master Password**: `admin_master_password`
   - **Database Name**: `ai_employee`
   - **Email**: `admin@ai-employee.local`
   - **Password**: `admin123`
   - **Language**: English (US)
   - **Country**: Your country
4. Click "Create database"
5. Wait for initialization (1-2 minutes)

### 3. Install Required Apps

After logging in, go to **Apps** and install:

| App | Purpose | Required |
|-----|---------|----------|
| **Invoicing** | Create and manage invoices | Yes |
| **Expenses** | Track business expenses | Yes |
| **Contacts** | Customer/vendor management | Yes |
| **Sales** | Sales orders and quotes | Recommended |
| **Purchase** | Purchase orders | Optional |
| **Accounting** | Full accounting features | Optional |

### 4. Configure AI Employee Integration

Edit `.env` file:

```env
# Enable Odoo integration
USE_ODOO_MCP=true

# Odoo connection settings
ODOO_URL=http://localhost:8069
ODOO_DB=ai_employee
ODOO_USERNAME=admin
ODOO_PASSWORD=admin123
```

### 5. Test the Connection

```bash
# Test Odoo connection
python test_odoo_integration.py
```

Or restart the AI Employee and check for errors:

```bash
python dynamic_orchestrator.py
```

## Odoo MCP Server Features

The Odoo MCP server (`mcp/odoo-mcp/index.js`) provides these tools for Claude:

### Invoice Management
- `odoo_create_invoice` - Create customer invoices
- `odoo_record_payment` - Record payments received
- `odoo_get_unpaid_invoices` - List outstanding invoices

### Expense Tracking
- `odoo_create_expense` - Record business expenses
- `odoo_get_expense_report` - Get expense summaries

### Financial Reports
- `odoo_get_revenue_report` - Revenue for date range
- `odoo_get_profit_loss` - Profit & Loss statement
- `odoo_get_balance_sheet` - Balance sheet report
- `odoo_get_cash_flow` - Cash flow analysis
- `odoo_get_aging_report` - Accounts receivable aging

### Customer/Product Management
- `odoo_create_customer` - Add new customers
- `odoo_find_customer` - Search customers
- `odoo_create_product` - Add products/services
- `odoo_get_sales_orders` - List sales orders
- `odoo_create_purchase_order` - Create purchase orders

## Weekly CEO Briefing Integration

The Odoo watcher generates data for the weekly CEO briefing:

```markdown
## Financial Summary (from Odoo)

### Revenue This Week
- Total: $5,250
- Invoices Sent: 3
- Payments Received: $4,100

### Expenses
- Total Expenses: $1,200
- Categories: Software ($500), Office ($700)

### Cash Position
- Outstanding Receivables: $8,500
- Overdue (30+ days): $2,100

### Recommendations
- Follow up on Invoice #INV-2024-0042 (45 days overdue)
- Review software subscription costs
```

## Troubleshooting

### Cannot connect to Odoo

```bash
# Check if containers are running
docker-compose ps

# Restart containers
docker-compose restart

# Check logs for errors
docker-compose logs odoo
```

### Database not found

1. Go to http://localhost:8069/web/database/manager
2. Create database with name `ai_employee`
3. Make sure `ODOO_DB=ai_employee` in `.env`

### Authentication failed

1. Verify username is `admin` (or your created user)
2. Reset password in Odoo web interface
3. Update `ODOO_PASSWORD` in `.env`

### Port already in use

```bash
# Check what's using port 8069
netstat -ano | findstr :8069

# Stop the conflicting process or change ports in docker-compose.yml
```

### Reset everything

```bash
# Stop and remove containers and volumes
docker-compose down -v

# Start fresh
docker-compose up -d
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   AI Employee                        │
│  ┌─────────────┐    ┌─────────────┐                 │
│  │ Odoo Watcher│    │ CEO Briefing│                 │
│  │  (Python)   │    │  Generator  │                 │
│  └──────┬──────┘    └──────┬──────┘                 │
│         │                  │                         │
│         ▼                  ▼                         │
│  ┌─────────────────────────────────────┐            │
│  │        Odoo MCP Server              │            │
│  │   (mcp/odoo-mcp/index.js)           │            │
│  │   JSON-RPC / XML-RPC API            │            │
│  └──────────────────┬──────────────────┘            │
└─────────────────────┼───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│              Docker Containers                       │
│  ┌─────────────┐    ┌─────────────┐                 │
│  │    Odoo     │◄──►│ PostgreSQL  │                 │
│  │  (Port 8069)│    │  (Port 5432)│                 │
│  └─────────────┘    └─────────────┘                 │
└─────────────────────────────────────────────────────┘
```

## Security Notes

- **Change default passwords** before production use
- **Don't expose ports** to the internet without proper security
- **Regular backups**: `docker exec ai_employee_postgres pg_dump -U odoo ai_employee > backup.sql`
- **Keep Docker images updated**: `docker-compose pull && docker-compose up -d`

## Resources

- [Odoo Documentation](https://www.odoo.com/documentation)
- [Odoo JSON-RPC API (19+)](https://www.odoo.com/documentation/19.0/developer/reference/external_api.html)
- [Why Odoo (Value-for-Money ERP)](https://chatgpt.com/share/6967deaf-9404-8001-9ad7-03017255ebaf)
