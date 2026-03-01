# Odoo Installation Guide

Complete guide for installing and configuring Odoo 19 for the AI Employee system.

## Overview

Odoo is the primary accounting and ERP system for AI Employee. This guide covers:
- Docker installation (recommended)
- Windows native installation
- Required modules configuration
- Environment variables setup
- Integration with AI Employee

## Prerequisites

- **Minimum Requirements:**
  - 4GB RAM (8GB recommended)
  - 50GB disk space
  - PostgreSQL 15+ (included with Docker or installed separately)

## Option 1: Docker Installation (Recommended)

Docker provides the easiest setup with isolated environments.

### Step 1: Install Docker

1. Download Docker Desktop from [docker.com](https://www.docker.com/products/docker-desktop/)
2. Install and start Docker Desktop
3. Verify installation:
   ```bash
   docker --version
   docker-compose --version
   ```

### Step 2: Create Docker Compose File

Create `docker-compose.yml` in your AI_Employee directory:

```yaml
version: '3.8'

services:
  odoo-db:
    image: postgres:15
    container_name: odoo_postgres
    environment:
      - POSTGRES_USER=odoo
      - POSTGRES_PASSWORD=odoo_secure_password_123
      - POSTGRES_DB=ai_employee
    volumes:
      - odoo-db-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped

  odoo:
    image: odoo:19.0
    container_name: odoo_server
    depends_on:
      - odoo-db
    environment:
      - HOST=odoo-db
      - USER=odoo
      - PASSWORD=odoo_secure_password_123
    volumes:
      - odoo-data:/var/lib/odoo
      - odoo-config:/etc/odoo
      - odoo-addons:/mnt/extra-addons
    ports:
      - "8069:8069"
    restart: unless-stopped

volumes:
  odoo-db-data:
  odoo-data:
  odoo-config:
  odoo-addons:
```

### Step 3: Start Odoo

```bash
# Start containers in detached mode
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f odoo
```

### Step 4: Initial Setup

1. Open browser: http://localhost:8069
2. Create database:
   - **Database Name:** `ai_employee`
   - **Email:** Your admin email
   - **Password:** Secure admin password
   - **Language:** English
   - **Country:** Your country
3. Select **Demo data: No** for production use

## Option 2: Windows Native Installation

For Windows users who prefer a native installation.

### Step 1: Install PostgreSQL

1. Download PostgreSQL 15+ from [postgresql.org](https://www.postgresql.org/download/windows/)
2. Run installer with default settings
3. Remember the password set for `postgres` user
4. Add to PATH: `C:\Program Files\PostgreSQL\15\bin`

### Step 2: Create Database User

Open pgAdmin or psql:
```sql
CREATE USER odoo WITH PASSWORD 'odoo_secure_password_123';
ALTER USER odoo CREATEDB;
CREATE DATABASE ai_employee OWNER odoo;
```

### Step 3: Install Odoo

1. Download Odoo 19 Windows installer from [odoo.com](https://www.odoo.com/page/download)
2. Run installer
3. Configure PostgreSQL connection during setup
4. Start Odoo service

### Step 4: Configure Odoo

Edit `odoo.conf` (usually in `C:\Program Files\Odoo 19.0`):

```ini
[options]
admin_passwd = admin_master_password
db_host = localhost
db_port = 5432
db_user = odoo
db_password = odoo_secure_password_123
db_name = ai_employee
addons_path = C:\Program Files\Odoo 19.0\server\odoo\addons
xmlrpc_port = 8069
```

## Required Modules Installation

After initial setup, install these modules from the Odoo Apps menu:

### Essential Modules

1. **Accounting (account)** - Core accounting features
   - Go to Apps > Search "Accounting" > Install

2. **Invoicing (account_invoicing)** - Invoice management
   - Usually installed with Accounting

3. **Expenses (hr_expense)** - Expense tracking
   - Apps > Search "Expenses" > Install

4. **Contacts (contacts)** - Customer/Vendor management
   - Apps > Search "Contacts" > Install

### Optional but Recommended

5. **Sales (sale_management)** - Sales orders and quotes
6. **Purchase (purchase)** - Purchase order management
7. **Dashboard (board)** - Custom dashboards

### Enable Accounting Features

1. Go to **Invoicing > Configuration > Settings**
2. Enable:
   - [x] Analytic Accounting
   - [x] Invoice Online Payment
   - [x] Customer Addresses
   - [x] Payment Terms

## Environment Variables Configuration

Add these to your `.env` file in the AI_Employee directory:

```bash
# Odoo Configuration
ODOO_URL=http://localhost:8069
ODOO_DB=ai_employee
ODOO_USERNAME=admin
ODOO_PASSWORD=your_admin_password_here

# Optional: For different environments
ODOO_ENVIRONMENT=development

# MCP Server Options
DRY_RUN=false
```

### Windows Environment Variables

1. Open System Properties > Environment Variables
2. Under "User variables", click "New"
3. Add each variable:
   - `ODOO_URL` = `http://localhost:8069`
   - `ODOO_DB` = `ai_employee`
   - `ODOO_USERNAME` = `admin`
   - `ODOO_PASSWORD` = `your_password`

## Setting Up API Access

### Create API User (Recommended)

For security, create a dedicated API user:

1. Go to **Settings > Users & Companies > Users**
2. Click **Create**
3. Fill in:
   - **Name:** AI Employee API
   - **Email:** api@ai-employee.local
   - **Password:** Generate secure password
4. Set access rights:
   - Accounting > Billing
   - Human Resources > Officer (for expenses)
5. Save and note the user credentials

### Enable External API

Odoo's external API is enabled by default. Verify by testing:

```bash
curl -X POST http://localhost:8069/jsonrpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
      "service": "common",
      "method": "version"
    },
    "id": 1
  }'
```

## Testing the Integration

### 1. Test MCP Server Connection

```bash
cd C:/Users/E/Desktop/AI_Employee/mcp/odoo-mcp
npm install
DRY_RUN=true node index.js
```

### 2. Create Test Invoice

Using the MCP tools:
```json
{
  "tool": "odoo_create_invoice",
  "arguments": {
    "partner_name": "Test Customer",
    "amount": 100.00,
    "description": "Test Invoice from AI Employee"
  }
}
```

### 3. Verify in Odoo UI

1. Open http://localhost:8069
2. Go to Invoicing > Customers > Invoices
3. Confirm the test invoice appears

## Chart of Accounts Setup

For accurate financial reporting, configure your Chart of Accounts:

1. Go to **Invoicing > Configuration > Chart of Accounts**
2. Select your country's chart or create custom
3. Key accounts needed:
   - **1000** - Cash and Bank
   - **1100** - Accounts Receivable
   - **2000** - Accounts Payable
   - **4000** - Revenue
   - **5000** - Cost of Goods Sold
   - **6000** - Operating Expenses

## Troubleshooting

### Connection Issues

**Error:** "Could not connect to Odoo"
- Check if Odoo is running: `docker ps` or check Windows Services
- Verify URL: http://localhost:8069
- Check firewall settings

**Error:** "Authentication failed"
- Verify username/password in .env
- Ensure user has API access
- Check database name matches

### Docker Issues

**Container won't start:**
```bash
docker-compose down
docker volume prune  # Warning: removes data!
docker-compose up -d
```

**Port conflict:**
Change port in docker-compose.yml:
```yaml
ports:
  - "8070:8069"
```

### Database Issues

**Reset database:**
```bash
docker-compose down
docker volume rm ai_employee_odoo-db-data
docker-compose up -d
```

Then recreate database through web interface.

## Security Best Practices

1. **Change default passwords** immediately after installation
2. **Use API user** instead of admin for automation
3. **Enable SSL/HTTPS** in production
4. **Regular backups:**
   ```bash
   docker exec odoo_postgres pg_dump -U odoo ai_employee > backup.sql
   ```
5. **Restrict network access** to Odoo port in production

## Integration Architecture

```
AI Employee System
       |
       v
  [Odoo MCP Server]
       |
   JSON-RPC/XML-RPC
       |
       v
  [Odoo 19 Server]
       |
       v
  [PostgreSQL DB]
```

## Next Steps

After installation:

1. [ ] Create API user with appropriate permissions
2. [ ] Configure environment variables
3. [ ] Test MCP server connection
4. [ ] Create sample invoice
5. [ ] Set up chart of accounts
6. [ ] Configure expense categories
7. [ ] Test CEO briefing generation

## Support

- **Odoo Documentation:** https://www.odoo.com/documentation/19.0/
- **Odoo Forums:** https://www.odoo.com/forum/help-1
- **PostgreSQL Docs:** https://www.postgresql.org/docs/15/

---
*Generated for AI Employee Gold Tier - Odoo Integration*
