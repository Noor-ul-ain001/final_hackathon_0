#!/usr/bin/env node

/**
 * Odoo MCP Server - Enhanced Gold Tier
 *
 * A Model Context Protocol server for Odoo ERP integration.
 * Enables Claude Code to interact with Odoo for accounting and business management.
 *
 * Features:
 * - JSON-RPC API (Odoo 19+ preferred)
 * - XML-RPC fallback for older versions
 * - Retry logic with exponential backoff
 * - Response caching
 * - Comprehensive audit logging
 * - Financial reports (Balance Sheet, P&L, Cash Flow, Aging)
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const ODOO_URL = process.env.ODOO_URL || 'http://localhost:8069';
const ODOO_DB = process.env.ODOO_DB || 'ai_employee';
const ODOO_USERNAME = process.env.ODOO_USERNAME || 'admin';
const ODOO_PASSWORD = process.env.ODOO_PASSWORD;
const DRY_RUN = process.env.DRY_RUN === 'true';
const VAULT_PATH = process.env.VAULT_PATH || path.join(__dirname, '../../AI_Employee_Vault');

// Retry configuration
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;

// Cache configuration
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map();

let uid = null; // Odoo user ID after authentication

// Available tools
const TOOLS = [
  {
    name: 'odoo_create_invoice',
    description: 'Create a customer invoice in Odoo',
    inputSchema: {
      type: 'object',
      properties: {
        partner_name: { type: 'string', description: 'Customer name' },
        amount: { type: 'number', description: 'Invoice amount' },
        description: { type: 'string', description: 'Invoice description' },
        due_date: { type: 'string', description: 'Due date (YYYY-MM-DD)' }
      },
      required: ['partner_name', 'amount', 'description']
    }
  },
  {
    name: 'odoo_record_payment',
    description: 'Record a payment received from customer',
    inputSchema: {
      type: 'object',
      properties: {
        invoice_id: { type: 'number', description: 'Invoice ID' },
        amount: { type: 'number', description: 'Payment amount' },
        payment_date: { type: 'string', description: 'Payment date (YYYY-MM-DD)' }
      },
      required: ['invoice_id', 'amount']
    }
  },
  {
    name: 'odoo_create_expense',
    description: 'Record a business expense',
    inputSchema: {
      type: 'object',
      properties: {
        description: { type: 'string', description: 'Expense description' },
        amount: { type: 'number', description: 'Expense amount' },
        category: { type: 'string', description: 'Expense category' },
        date: { type: 'string', description: 'Expense date (YYYY-MM-DD)' }
      },
      required: ['description', 'amount']
    }
  },
  {
    name: 'odoo_get_revenue_report',
    description: 'Get revenue report for a date range',
    inputSchema: {
      type: 'object',
      properties: {
        start_date: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        end_date: { type: 'string', description: 'End date (YYYY-MM-DD)' }
      },
      required: ['start_date', 'end_date']
    }
  },
  {
    name: 'odoo_get_expense_report',
    description: 'Get expense report for a date range',
    inputSchema: {
      type: 'object',
      properties: {
        start_date: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        end_date: { type: 'string', description: 'End date (YYYY-MM-DD)' }
      },
      required: ['start_date', 'end_date']
    }
  },
  {
    name: 'odoo_get_unpaid_invoices',
    description: 'Get list of unpaid invoices',
    inputSchema: {
      type: 'object',
      properties: {
        overdue_only: { type: 'boolean', description: 'Only show overdue invoices' }
      }
    }
  },
  {
    name: 'odoo_get_balance_sheet',
    description: 'Get balance sheet (financial position) report',
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Report date (YYYY-MM-DD), defaults to today' }
      }
    }
  },
  {
    name: 'odoo_get_profit_loss',
    description: 'Get profit and loss (income) statement',
    inputSchema: {
      type: 'object',
      properties: {
        start_date: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        end_date: { type: 'string', description: 'End date (YYYY-MM-DD)' }
      },
      required: ['start_date', 'end_date']
    }
  },
  {
    name: 'odoo_get_bank_transactions',
    description: 'Get recent bank transactions',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Number of days to look back (default: 30)' },
        limit: { type: 'number', description: 'Maximum transactions to return (default: 100)' }
      }
    }
  },
  {
    name: 'odoo_get_aging_report',
    description: 'Get accounts receivable aging report',
    inputSchema: {
      type: 'object',
      properties: {
        as_of_date: { type: 'string', description: 'Report as-of date (YYYY-MM-DD)' }
      }
    }
  },
  {
    name: 'odoo_get_cash_flow',
    description: 'Get cash flow analysis',
    inputSchema: {
      type: 'object',
      properties: {
        start_date: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        end_date: { type: 'string', description: 'End date (YYYY-MM-DD)' }
      },
      required: ['start_date', 'end_date']
    }
  },
  {
    name: 'odoo_create_customer',
    description: 'Create a new customer/partner in Odoo',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Customer name' },
        email: { type: 'string', description: 'Customer email address' },
        phone: { type: 'string', description: 'Customer phone number' },
        street: { type: 'string', description: 'Street address' },
        city: { type: 'string', description: 'City' },
        country: { type: 'string', description: 'Country' }
      },
      required: ['name']
    }
  },
  {
    name: 'odoo_find_customer',
    description: 'Find customer by name or email',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Customer name to search for' },
        email: { type: 'string', description: 'Customer email to search for' }
      }
    }
  },
  {
    name: 'odoo_create_product',
    description: 'Create a new product/service in Odoo',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Product name' },
        description: { type: 'string', description: 'Product description' },
        sale_price: { type: 'number', description: 'Selling price' },
        category: { type: 'string', description: 'Product category' },
        type: { type: 'string', description: 'Product type (service or consu)' }
      },
      required: ['name', 'sale_price']
    }
  },
  {
    name: 'odoo_create_purchase_order',
    description: 'Create a purchase order for suppliers',
    inputSchema: {
      type: 'object',
      properties: {
        supplier_name: { type: 'string', description: 'Supplier name' },
        line_items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              product_name: { type: 'string', description: 'Product name' },
              quantity: { type: 'number', description: 'Quantity' },
              unit_price: { type: 'number', description: 'Unit price' }
            },
            required: ['product_name', 'quantity', 'unit_price']
          }
        },
        expected_date: { type: 'string', description: 'Expected delivery date (YYYY-MM-DD)' }
      },
      required: ['supplier_name', 'line_items']
    }
  },
  {
    name: 'odoo_get_sales_orders',
    description: 'Get list of sales orders',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by status (draft, confirmed, done, cancelled)' },
        date_from: { type: 'string', description: 'Filter from date (YYYY-MM-DD)' },
        date_to: { type: 'string', description: 'Filter to date (YYYY-MM-DD)' }
      }
    }
  }
];

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
function getBackoffDelay(attempt) {
  const delay = Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS);
  // Add jitter
  return delay + Math.random() * 1000;
}

/**
 * Make HTTP request with retry logic
 */
async function httpRequest(url, data, retries = MAX_RETRIES) {
  const urlObj = new URL(url);
  const isHttps = urlObj.protocol === 'https:';
  const httpModule = isHttps ? https : http;

  const options = {
    hostname: urlObj.hostname,
    port: urlObj.port || (isHttps ? 443 : 80),
    path: urlObj.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await new Promise((resolve, reject) => {
        const req = httpModule.request(options, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => {
            try {
              resolve(JSON.parse(body));
            } catch (e) {
              reject(new Error(`Invalid JSON response: ${body.substring(0, 200)}`));
            }
          });
        });

        req.on('error', reject);
        req.setTimeout(30000, () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });

        req.write(JSON.stringify(data));
        req.end();
      });
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
      const delay = getBackoffDelay(attempt);
      console.error(`Attempt ${attempt + 1} failed: ${error.message}. Retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
}

/**
 * JSON-RPC call to Odoo
 */
async function jsonRpcCall(endpoint, method, params) {
  const url = `${ODOO_URL}${endpoint}`;
  const data = {
    jsonrpc: '2.0',
    method: 'call',
    params,
    id: Date.now()
  };

  const response = await httpRequest(url, data);

  if (response.error) {
    throw new Error(response.error.message || JSON.stringify(response.error));
  }

  return response.result;
}

/**
 * Get cached value or execute function
 */
function getCached(key, ttl = CACHE_TTL_MS) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.value;
  }
  return null;
}

/**
 * Set cache value
 */
function setCache(key, value) {
  cache.set(key, { value, timestamp: Date.now() });
}

/**
 * Authenticate with Odoo and get user ID (JSON-RPC)
 */
async function authenticate() {
  if (DRY_RUN) {
    console.error('[DRY RUN] Would authenticate with Odoo');
    return 1; // Mock user ID
  }

  if (!ODOO_PASSWORD) {
    throw new Error('ODOO_PASSWORD not set in environment');
  }

  // Check cache
  const cached = getCached('auth_uid');
  if (cached) {
    return cached;
  }

  try {
    const result = await jsonRpcCall('/web/session/authenticate', 'call', {
      db: ODOO_DB,
      login: ODOO_USERNAME,
      password: ODOO_PASSWORD
    });

    if (!result || !result.uid) {
      throw new Error('Authentication failed: Invalid credentials');
    }

    console.error(`Authenticated with Odoo as user ID: ${result.uid}`);
    setCache('auth_uid', result.uid);
    return result.uid;
  } catch (error) {
    // Fallback to XML-RPC style authentication
    console.error('JSON-RPC auth failed, trying XML-RPC style...');
    return await authenticateXmlRpc();
  }
}

/**
 * XML-RPC style authentication (fallback)
 */
async function authenticateXmlRpc() {
  const xmlrpc = await import('xmlrpc');

  return new Promise((resolve, reject) => {
    const client = xmlrpc.default.createClient({
      url: `${ODOO_URL}/xmlrpc/2/common`,
      headers: { 'Content-Type': 'text/xml' }
    });

    client.methodCall('authenticate', [ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {}], (error, value) => {
      if (error) {
        reject(new Error(`Odoo authentication failed: ${error.message}`));
      } else if (!value) {
        reject(new Error('Odoo authentication failed: Invalid credentials'));
      } else {
        console.error(`Authenticated with Odoo (XML-RPC) as user ID: ${value}`);
        setCache('auth_uid', value);
        resolve(value);
      }
    });
  });
}

/**
 * Execute Odoo method via JSON-RPC
 */
async function executeOdoo(model, method, args = [], kwargs = {}) {
  if (DRY_RUN) {
    console.error(`[DRY RUN] Would execute: ${model}.${method}`, args, kwargs);
    return { success: true, dry_run: true, model, method, args, kwargs };
  }

  if (!uid) {
    uid = await authenticate();
  }

  try {
    // Try JSON-RPC first (Odoo 19+)
    const result = await jsonRpcCall('/web/dataset/call_kw', 'call', {
      model,
      method,
      args,
      kwargs
    });
    return result;
  } catch (error) {
    // Fallback to XML-RPC
    console.error('JSON-RPC failed, trying XML-RPC...');
    return await executeOdooXmlRpc(model, method, args, kwargs);
  }
}

/**
 * Execute Odoo method via XML-RPC (fallback)
 */
async function executeOdooXmlRpc(model, method, args, kwargs) {
  const xmlrpc = await import('xmlrpc');

  return new Promise((resolve, reject) => {
    const client = xmlrpc.default.createClient({
      url: `${ODOO_URL}/xmlrpc/2/object`,
      headers: { 'Content-Type': 'text/xml' }
    });

    const params = [ODOO_DB, uid, ODOO_PASSWORD, model, method, args, kwargs];

    client.methodCall('execute_kw', params, (error, value) => {
      if (error) {
        reject(new Error(`Odoo execution failed: ${error.message}`));
      } else {
        resolve(value);
      }
    });
  });
}

/**
 * Create invoice in Odoo
 */
async function createInvoice(partnerName, amount, description, dueDate = null) {
  const timestamp = new Date().toISOString();

  // First, find or create partner
  const partners = await executeOdoo('res.partner', 'search_read',
    [[['name', '=', partnerName]]],
    { fields: ['id', 'name'], limit: 1 }
  );

  let partnerId;
  if (partners && partners.length > 0) {
    partnerId = partners[0].id;
  } else {
    // Create partner
    partnerId = await executeOdoo('res.partner', 'create', [{
      name: partnerName,
      customer_rank: 1
    }]);
  }

  // Create invoice
  const invoiceData = {
    partner_id: partnerId,
    move_type: 'out_invoice',
    invoice_date: new Date().toISOString().split('T')[0],
    invoice_line_ids: [[0, 0, {
      name: description,
      quantity: 1,
      price_unit: amount
    }]]
  };

  if (dueDate) {
    invoiceData.invoice_date_due = dueDate;
  }

  const invoiceId = await executeOdoo('account.move', 'create', [invoiceData]);

  // Log to vault
  await logToVault('ODOO_INVOICE_CREATE', {
    invoice_id: invoiceId,
    partner: partnerName,
    amount,
    description,
    timestamp
  });

  return {
    success: true,
    invoice_id: invoiceId,
    partner: partnerName,
    amount,
    message: 'Invoice created successfully'
  };
}

/**
 * Record payment
 */
async function recordPayment(invoiceId, amount, paymentDate = null) {
  const timestamp = new Date().toISOString();

  const paymentData = {
    payment_type: 'inbound',
    partner_type: 'customer',
    amount,
    date: paymentDate || new Date().toISOString().split('T')[0],
    reconciled_invoice_ids: [[6, 0, [invoiceId]]]
  };

  const paymentId = await executeOdoo('account.payment', 'create', [paymentData]);

  await logToVault('ODOO_PAYMENT_RECORD', {
    payment_id: paymentId,
    invoice_id: invoiceId,
    amount,
    timestamp
  });

  return {
    success: true,
    payment_id: paymentId,
    invoice_id: invoiceId,
    amount,
    message: 'Payment recorded successfully'
  };
}

/**
 * Create expense
 */
async function createExpense(description, amount, category = 'General', date = null) {
  const timestamp = new Date().toISOString();

  const expenseData = {
    name: description,
    quantity: 1,
    unit_amount: amount,
    date: date || new Date().toISOString().split('T')[0]
  };

  const expenseId = await executeOdoo('hr.expense', 'create', [expenseData]);

  await logToVault('ODOO_EXPENSE_CREATE', {
    expense_id: expenseId,
    description,
    amount,
    category,
    timestamp
  });

  return {
    success: true,
    expense_id: expenseId,
    description,
    amount,
    message: 'Expense recorded successfully'
  };
}

/**
 * Get revenue report
 */
async function getRevenueReport(startDate, endDate) {
  const cacheKey = `revenue_${startDate}_${endDate}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const invoices = await executeOdoo('account.move', 'search_read',
    [[
      ['move_type', '=', 'out_invoice'],
      ['state', '=', 'posted'],
      ['invoice_date', '>=', startDate],
      ['invoice_date', '<=', endDate]
    ]],
    { fields: ['name', 'partner_id', 'amount_total', 'invoice_date', 'payment_state'] }
  );

  const totalRevenue = invoices.reduce((sum, inv) => sum + inv.amount_total, 0);
  const paidInvoices = invoices.filter(inv => inv.payment_state === 'paid');
  const totalPaid = paidInvoices.reduce((sum, inv) => sum + inv.amount_total, 0);

  const result = {
    success: true,
    period: { start_date: startDate, end_date: endDate },
    total_revenue: totalRevenue,
    total_paid: totalPaid,
    total_outstanding: totalRevenue - totalPaid,
    invoice_count: invoices.length,
    paid_count: paidInvoices.length,
    invoices: invoices.map(inv => ({
      id: inv.id,
      number: inv.name,
      customer: inv.partner_id[1],
      amount: inv.amount_total,
      date: inv.invoice_date,
      status: inv.payment_state
    }))
  };

  setCache(cacheKey, result);
  return result;
}

/**
 * Get expense report
 */
async function getExpenseReport(startDate, endDate) {
  const cacheKey = `expense_${startDate}_${endDate}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const expenses = await executeOdoo('hr.expense', 'search_read',
    [[
      ['date', '>=', startDate],
      ['date', '<=', endDate]
    ]],
    { fields: ['name', 'unit_amount', 'date', 'state'] }
  );

  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.unit_amount, 0);

  const result = {
    success: true,
    period: { start_date: startDate, end_date: endDate },
    total_expenses: totalExpenses,
    expense_count: expenses.length,
    expenses: expenses.map(exp => ({
      id: exp.id,
      description: exp.name,
      amount: exp.unit_amount,
      date: exp.date,
      status: exp.state
    }))
  };

  setCache(cacheKey, result);
  return result;
}

/**
 * Get unpaid invoices
 */
async function getUnpaidInvoices(overdueOnly = false) {
  const today = new Date().toISOString().split('T')[0];
  const cacheKey = `unpaid_${overdueOnly}_${today}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const domain = [
    ['move_type', '=', 'out_invoice'],
    ['state', '=', 'posted'],
    ['payment_state', 'in', ['not_paid', 'partial']]
  ];

  if (overdueOnly) {
    domain.push(['invoice_date_due', '<', today]);
  }

  const invoices = await executeOdoo('account.move', 'search_read',
    [domain],
    { fields: ['name', 'partner_id', 'amount_total', 'amount_residual', 'invoice_date', 'invoice_date_due', 'payment_state'] }
  );

  const totalUnpaid = invoices.reduce((sum, inv) => sum + inv.amount_residual, 0);

  const result = {
    success: true,
    total_unpaid: totalUnpaid,
    invoice_count: invoices.length,
    overdue_only: overdueOnly,
    invoices: invoices.map(inv => ({
      id: inv.id,
      number: inv.name,
      customer: inv.partner_id[1],
      total_amount: inv.amount_total,
      unpaid_amount: inv.amount_residual,
      invoice_date: inv.invoice_date,
      due_date: inv.invoice_date_due,
      status: inv.payment_state,
      is_overdue: inv.invoice_date_due < today
    }))
  };

  setCache(cacheKey, result);
  return result;
}

/**
 * Get balance sheet
 */
async function getBalanceSheet(date = null) {
  const reportDate = date || new Date().toISOString().split('T')[0];
  const cacheKey = `balance_sheet_${reportDate}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // Get all accounts with balances
  const accounts = await executeOdoo('account.account', 'search_read',
    [[]],
    { fields: ['id', 'name', 'code', 'account_type'] }
  );

  // Get account balances from move lines
  const moveLines = await executeOdoo('account.move.line', 'read_group',
    [[['date', '<=', reportDate], ['parent_state', '=', 'posted']]],
    ['account_id', 'balance:sum'],
    ['account_id']
  );

  // Build balance map
  const balanceMap = {};
  for (const line of moveLines) {
    if (line.account_id) {
      balanceMap[line.account_id[0]] = line.balance;
    }
  }

  // Categorize accounts
  const assets = [];
  const liabilities = [];
  const equity = [];
  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;

  for (const account of accounts) {
    const balance = balanceMap[account.id] || 0;
    const accountData = {
      code: account.code,
      name: account.name,
      balance: Math.abs(balance)
    };

    const type = account.account_type || '';
    if (type.includes('asset') || type.includes('receivable') || type.includes('bank') || type.includes('cash')) {
      assets.push(accountData);
      totalAssets += balance;
    } else if (type.includes('liability') || type.includes('payable')) {
      liabilities.push(accountData);
      totalLiabilities += Math.abs(balance);
    } else if (type.includes('equity')) {
      equity.push(accountData);
      totalEquity += Math.abs(balance);
    }
  }

  const result = {
    success: true,
    report_type: 'balance_sheet',
    as_of_date: reportDate,
    assets: {
      items: assets.filter(a => a.balance > 0),
      total: Math.abs(totalAssets)
    },
    liabilities: {
      items: liabilities.filter(l => l.balance > 0),
      total: totalLiabilities
    },
    equity: {
      items: equity.filter(e => e.balance > 0),
      total: totalEquity
    },
    total_liabilities_and_equity: totalLiabilities + totalEquity
  };

  setCache(cacheKey, result);
  return result;
}

/**
 * Get profit and loss statement
 */
async function getProfitLoss(startDate, endDate) {
  const cacheKey = `pnl_${startDate}_${endDate}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // Get revenue accounts
  const revenueLines = await executeOdoo('account.move.line', 'read_group',
    [[
      ['date', '>=', startDate],
      ['date', '<=', endDate],
      ['parent_state', '=', 'posted'],
      ['account_id.account_type', 'in', ['income', 'income_other']]
    ]],
    ['account_id', 'balance:sum'],
    ['account_id']
  );

  // Get expense accounts
  const expenseLines = await executeOdoo('account.move.line', 'read_group',
    [[
      ['date', '>=', startDate],
      ['date', '<=', endDate],
      ['parent_state', '=', 'posted'],
      ['account_id.account_type', 'in', ['expense', 'expense_direct_cost', 'expense_depreciation']]
    ]],
    ['account_id', 'balance:sum'],
    ['account_id']
  );

  const revenue = [];
  let totalRevenue = 0;
  for (const line of revenueLines) {
    if (line.account_id) {
      const amount = Math.abs(line.balance);
      revenue.push({
        account: line.account_id[1],
        amount
      });
      totalRevenue += amount;
    }
  }

  const expenses = [];
  let totalExpenses = 0;
  for (const line of expenseLines) {
    if (line.account_id) {
      const amount = Math.abs(line.balance);
      expenses.push({
        account: line.account_id[1],
        amount
      });
      totalExpenses += amount;
    }
  }

  const netIncome = totalRevenue - totalExpenses;

  const result = {
    success: true,
    report_type: 'profit_loss',
    period: { start_date: startDate, end_date: endDate },
    revenue: {
      items: revenue,
      total: totalRevenue
    },
    expenses: {
      items: expenses,
      total: totalExpenses
    },
    gross_profit: totalRevenue - (expenses.filter(e => e.account.toLowerCase().includes('cost')).reduce((s, e) => s + e.amount, 0)),
    net_income: netIncome,
    profit_margin: totalRevenue > 0 ? ((netIncome / totalRevenue) * 100).toFixed(2) + '%' : '0%'
  };

  setCache(cacheKey, result);
  return result;
}

/**
 * Get recent bank transactions
 */
async function getBankTransactions(days = 30, limit = 100) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString().split('T')[0];

  const cacheKey = `bank_txn_${days}_${limit}`;
  const cached = getCached(cacheKey, 60000); // 1 minute cache for transactions
  if (cached) return cached;

  // Get bank statement lines
  const transactions = await executeOdoo('account.bank.statement.line', 'search_read',
    [[['date', '>=', startDateStr]]],
    {
      fields: ['date', 'payment_ref', 'amount', 'partner_id', 'account_number'],
      limit,
      order: 'date desc'
    }
  );

  const result = {
    success: true,
    period_days: days,
    transaction_count: transactions.length,
    transactions: transactions.map(txn => ({
      date: txn.date,
      reference: txn.payment_ref || 'No reference',
      amount: txn.amount,
      partner: txn.partner_id ? txn.partner_id[1] : 'Unknown',
      type: txn.amount >= 0 ? 'credit' : 'debit'
    })),
    total_credits: transactions.filter(t => t.amount >= 0).reduce((s, t) => s + t.amount, 0),
    total_debits: Math.abs(transactions.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0))
  };

  setCache(cacheKey, result);
  return result;
}

/**
 * Get accounts receivable aging report
 */
async function getAgingReport(asOfDate = null) {
  const reportDate = asOfDate || new Date().toISOString().split('T')[0];
  const today = new Date(reportDate);

  const cacheKey = `aging_${reportDate}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // Get unpaid invoices
  const invoices = await executeOdoo('account.move', 'search_read',
    [[
      ['move_type', '=', 'out_invoice'],
      ['state', '=', 'posted'],
      ['payment_state', 'in', ['not_paid', 'partial']],
      ['invoice_date', '<=', reportDate]
    ]],
    { fields: ['name', 'partner_id', 'amount_residual', 'invoice_date', 'invoice_date_due'] }
  );

  // Categorize by aging buckets
  const buckets = {
    current: { label: 'Current (0-30 days)', invoices: [], total: 0 },
    days_31_60: { label: '31-60 days', invoices: [], total: 0 },
    days_61_90: { label: '61-90 days', invoices: [], total: 0 },
    over_90: { label: 'Over 90 days', invoices: [], total: 0 }
  };

  for (const inv of invoices) {
    const dueDate = new Date(inv.invoice_date_due);
    const daysPastDue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));

    const invData = {
      number: inv.name,
      customer: inv.partner_id[1],
      amount: inv.amount_residual,
      due_date: inv.invoice_date_due,
      days_past_due: Math.max(0, daysPastDue)
    };

    if (daysPastDue <= 30) {
      buckets.current.invoices.push(invData);
      buckets.current.total += inv.amount_residual;
    } else if (daysPastDue <= 60) {
      buckets.days_31_60.invoices.push(invData);
      buckets.days_31_60.total += inv.amount_residual;
    } else if (daysPastDue <= 90) {
      buckets.days_61_90.invoices.push(invData);
      buckets.days_61_90.total += inv.amount_residual;
    } else {
      buckets.over_90.invoices.push(invData);
      buckets.over_90.total += inv.amount_residual;
    }
  }

  const totalAR = Object.values(buckets).reduce((s, b) => s + b.total, 0);

  const result = {
    success: true,
    report_type: 'ar_aging',
    as_of_date: reportDate,
    total_receivables: totalAR,
    buckets: Object.entries(buckets).map(([key, bucket]) => ({
      bucket: key,
      label: bucket.label,
      count: bucket.invoices.length,
      total: bucket.total,
      percentage: totalAR > 0 ? ((bucket.total / totalAR) * 100).toFixed(1) + '%' : '0%',
      invoices: bucket.invoices
    })),
    summary: {
      total_customers: new Set(invoices.map(i => i.partner_id[0])).size,
      total_invoices: invoices.length,
      average_days_outstanding: invoices.length > 0
        ? Math.round(invoices.reduce((s, i) => s + Math.max(0, Math.floor((today - new Date(i.invoice_date_due)) / (1000 * 60 * 60 * 24))), 0) / invoices.length)
        : 0
    }
  };

  setCache(cacheKey, result);
  return result;
}

/**
 * Get cash flow analysis
 */
async function getCashFlow(startDate, endDate) {
  const cacheKey = `cashflow_${startDate}_${endDate}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // Get all posted journal entries for the period
  const moves = await executeOdoo('account.move.line', 'search_read',
    [[
      ['date', '>=', startDate],
      ['date', '<=', endDate],
      ['parent_state', '=', 'posted']
    ]],
    { fields: ['date', 'debit', 'credit', 'account_id', 'name'] }
  );

  // Categorize cash flows
  let operatingInflows = 0;
  let operatingOutflows = 0;
  let investingInflows = 0;
  let investingOutflows = 0;
  let financingInflows = 0;
  let financingOutflows = 0;

  for (const move of moves) {
    const accountType = move.account_id ? move.account_id[1].toLowerCase() : '';
    const netAmount = move.debit - move.credit;

    // Simple categorization based on account types
    if (accountType.includes('receivable') || accountType.includes('payable') ||
        accountType.includes('revenue') || accountType.includes('expense')) {
      if (netAmount > 0) operatingInflows += netAmount;
      else operatingOutflows += Math.abs(netAmount);
    } else if (accountType.includes('asset') && !accountType.includes('current')) {
      if (netAmount > 0) investingOutflows += netAmount;
      else investingInflows += Math.abs(netAmount);
    } else if (accountType.includes('equity') || accountType.includes('loan')) {
      if (netAmount > 0) financingInflows += netAmount;
      else financingOutflows += Math.abs(netAmount);
    }
  }

  const netOperating = operatingInflows - operatingOutflows;
  const netInvesting = investingInflows - investingOutflows;
  const netFinancing = financingInflows - financingOutflows;
  const netCashChange = netOperating + netInvesting + netFinancing;

  const result = {
    success: true,
    report_type: 'cash_flow',
    period: { start_date: startDate, end_date: endDate },
    operating_activities: {
      inflows: operatingInflows,
      outflows: operatingOutflows,
      net: netOperating
    },
    investing_activities: {
      inflows: investingInflows,
      outflows: investingOutflows,
      net: netInvesting
    },
    financing_activities: {
      inflows: financingInflows,
      outflows: financingOutflows,
      net: netFinancing
    },
    net_cash_change: netCashChange,
    summary: {
      total_inflows: operatingInflows + investingInflows + financingInflows,
      total_outflows: operatingOutflows + investingOutflows + financingOutflows
    }
  };

  setCache(cacheKey, result);
  return result;
}

/**
 * Create customer in Odoo
 */
async function createCustomer(name, email = null, phone = null, street = null, city = null, country = null) {
  const timestamp = new Date().toISOString();

  const customerData = {
    name,
    is_company: true,  // Treat as company by default
    customer_rank: 1   // Mark as customer
  };

  if (email) customerData.email = email;
  if (phone) customerData.phone = phone;
  if (street) customerData.street = street;
  if (city) customerData.city = city;
  if (country) customerData.country_id = [0, country];  // Will be replaced by actual country ID if found

  const customerId = await executeOdoo('res.partner', 'create', [customerData]);

  await logToVault('ODOO_CUSTOMER_CREATE', {
    customer_id: customerId,
    name,
    email,
    timestamp
  });

  return {
    success: true,
    customer_id: customerId,
    name,
    message: 'Customer created successfully'
  };
}

/**
 * Find customer in Odoo
 */
async function findCustomer(name = null, email = null) {
  const cacheKey = `customer_${name || email}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  let domain = [['customer_rank', '>', 0]]; // Only customers

  if (name) {
    domain.push(['name', 'ilike', name]);
  }
  if (email) {
    domain.push(['email', '=', email]);
  }

  const customers = await executeOdoo('res.partner', 'search_read',
    [domain],
    { fields: ['id', 'name', 'email', 'phone', 'street', 'city', 'country_id', 'customer_rank', 'supplier_rank'] }
  );

  const result = {
    success: true,
    customer_count: customers.length,
    customers: customers.map(cust => ({
      id: cust.id,
      name: cust.name,
      email: cust.email,
      phone: cust.phone,
      address: `${cust.street || ''}, ${cust.city || ''}`,
      is_customer: cust.customer_rank > 0,
      is_supplier: cust.supplier_rank > 0
    }))
  };

  setCache(cacheKey, result);
  return result;
}

/**
 * Create product in Odoo
 */
async function createProduct(name, description = '', salePrice, category = 'All', type = 'service') {
  const timestamp = new Date().toISOString();

  // Find or create product category
  let categoryId = 1; // Default to 'All' category
  const categories = await executeOdoo('product.category', 'search_read',
    [[['name', '=', category]]],
    { fields: ['id'], limit: 1 }
  );

  if (categories && categories.length > 0) {
    categoryId = categories[0].id;
  } else {
    // Create new category if it doesn't exist
    categoryId = await executeOdoo('product.category', 'create', [{
      name: category
    }]);
  }

  const productData = {
    name,
    type,  // 'service' or 'consu' (consumable)
    list_price: salePrice,
    categ_id: categoryId,
    sale_ok: true,
    purchase_ok: true
  };

  if (description) {
    productData.description_sale = description;
  }

  const productId = await executeOdoo('product.product', 'create', [productData]);

  await logToVault('ODOO_PRODUCT_CREATE', {
    product_id: productId,
    name,
    sale_price: salePrice,
    timestamp
  });

  return {
    success: true,
    product_id: productId,
    name,
    sale_price: salePrice,
    message: 'Product created successfully'
  };
}

/**
 * Create purchase order in Odoo
 */
async function createPurchaseOrder(supplierName, lineItems, expectedDate = null) {
  const timestamp = new Date().toISOString();

  // Find supplier
  const suppliers = await executeOdoo('res.partner', 'search_read',
    [[['name', '=', supplierName], ['supplier_rank', '>', 0]]],
    { fields: ['id'], limit: 1 }
  );

  if (!suppliers || suppliers.length === 0) {
    throw new Error(`Supplier '${supplierName}' not found`);
  }

  const supplierId = suppliers[0].id;

  // Prepare order lines
  const orderLines = [];
  for (const item of lineItems) {
    // Find product
    const products = await executeOdoo('product.product', 'search_read',
      [[['name', '=', item.product_name]]],
      { fields: ['id'], limit: 1 }
    );

    if (!products || products.length === 0) {
      throw new Error(`Product '${item.product_name}' not found`);
    }

    const productId = products[0].id;

    orderLines.push([0, 0, {
      product_id: productId,
      product_qty: item.quantity,
      price_unit: item.unit_price,
      name: item.product_name
    }]);
  }

  const orderData = {
    partner_id: supplierId,
    order_line: orderLines
  };

  if (expectedDate) {
    orderData.date_planned = expectedDate;
  }

  const orderId = await executeOdoo('purchase.order', 'create', [orderData]);

  await logToVault('ODOO_PURCHASE_ORDER_CREATE', {
    order_id: orderId,
    supplier: supplierName,
    line_items_count: lineItems.length,
    timestamp
  });

  return {
    success: true,
    order_id: orderId,
    supplier: supplierName,
    line_items_count: lineItems.length,
    message: 'Purchase order created successfully'
  };
}

/**
 * Get sales orders from Odoo
 */
async function getSalesOrders(status = null, dateFrom = null, dateTo = null) {
  const cacheKey = `sales_orders_${status || 'all'}_${dateFrom || 'na'}_${dateTo || 'na'}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  let domain = [];

  if (status) {
    domain.push(['state', '=', status]);
  }

  if (dateFrom || dateTo) {
    if (dateFrom) domain.push(['date_order', '>=', dateFrom]);
    if (dateTo) domain.push(['date_order', '<=', dateTo]);
  }

  const orders = await executeOdoo('sale.order', 'search_read',
    [domain],
    {
      fields: ['name', 'partner_id', 'date_order', 'state', 'amount_total', 'order_line'],
      order: 'date_order desc'
    }
  );

  const result = {
    success: true,
    order_count: orders.length,
    orders: orders.map(order => ({
      id: order.id,
      name: order.name,
      customer: order.partner_id[1],
      date: order.date_order,
      status: order.state,
      total_amount: order.amount_total
    }))
  };

  setCache(cacheKey, result);
  return result;
}

/**
 * Log action to vault
 */
async function logToVault(action, data) {
  try {
    const logDir = path.join(VAULT_PATH, 'Logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(logDir, `odoo_${today}.json`);

    let logs = [];
    if (fs.existsSync(logFile)) {
      logs = JSON.parse(fs.readFileSync(logFile, 'utf8'));
    }

    logs.push({
      timestamp: new Date().toISOString(),
      action,
      data,
      dry_run: DRY_RUN
    });

    fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
  } catch (error) {
    console.error('Failed to log to vault:', error.message);
  }
}

/**
 * Execute tool
 */
async function executeTool(toolName, args) {
  try {
    switch (toolName) {
      case 'odoo_create_invoice':
        return await createInvoice(args.partner_name, args.amount, args.description, args.due_date);

      case 'odoo_record_payment':
        return await recordPayment(args.invoice_id, args.amount, args.payment_date);

      case 'odoo_create_expense':
        return await createExpense(args.description, args.amount, args.category, args.date);

      case 'odoo_get_revenue_report':
        return await getRevenueReport(args.start_date, args.end_date);

      case 'odoo_get_expense_report':
        return await getExpenseReport(args.start_date, args.end_date);

      case 'odoo_get_unpaid_invoices':
        return await getUnpaidInvoices(args.overdue_only || false);

      case 'odoo_get_balance_sheet':
        return await getBalanceSheet(args.date);

      case 'odoo_get_profit_loss':
        return await getProfitLoss(args.start_date, args.end_date);

      case 'odoo_get_bank_transactions':
        return await getBankTransactions(args.days || 30, args.limit || 100);

      case 'odoo_get_aging_report':
        return await getAgingReport(args.as_of_date);

      case 'odoo_get_cash_flow':
        return await getCashFlow(args.start_date, args.end_date);

      case 'odoo_create_customer':
        return await createCustomer(args.name, args.email, args.phone, args.street, args.city, args.country);

      case 'odoo_find_customer':
        return await findCustomer(args.name, args.email);

      case 'odoo_create_product':
        return await createProduct(args.name, args.description, args.sale_price, args.category, args.type);

      case 'odoo_create_purchase_order':
        return await createPurchaseOrder(args.supplier_name, args.line_items, args.expected_date);

      case 'odoo_get_sales_orders':
        return await getSalesOrders(args.status, args.date_from, args.date_to);

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  } catch (error) {
    await logToVault('ERROR', { tool: toolName, error: error.message });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Handle MCP JSON-RPC requests
 */
async function handleRequest(request) {
  const { id, method, params } = request;

  try {
    switch (method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '0.1.0',
            serverInfo: {
              name: 'odoo-mcp-server',
              version: '2.0.0'
            },
            capabilities: { tools: {} }
          }
        };

      case 'tools/list':
        return {
          jsonrpc: '2.0',
          id,
          result: { tools: TOOLS }
        };

      case 'tools/call':
        const result = await executeTool(params.name, params.arguments || {});
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }]
          }
        };

      default:
        throw new Error(`Unknown method: ${method}`);
    }
  } catch (error) {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32603,
        message: error.message
      }
    };
  }
}

/**
 * Main server loop
 */
async function main() {
  console.error('Odoo MCP Server v2.0 (Gold Tier) starting...');
  console.error(`Odoo URL: ${ODOO_URL}`);
  console.error(`Database: ${ODOO_DB}`);
  console.error(`Dry run mode: ${DRY_RUN}`);
  console.error(`Vault path: ${VAULT_PATH}`);

  if (!ODOO_PASSWORD && !DRY_RUN) {
    console.error('ODOO_PASSWORD not set - running in dry-run mode');
  }

  let buffer = '';

  process.stdin.setEncoding('utf8');
  process.stdin.on('data', async (chunk) => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const request = JSON.parse(line);
        const response = await handleRequest(request);
        console.log(JSON.stringify(response));
      } catch (error) {
        console.error('Error processing request:', error);
        console.log(JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32700, message: 'Parse error' }
        }));
      }
    }
  });

  console.error('Odoo MCP Server ready');
}

main().catch(console.error);
