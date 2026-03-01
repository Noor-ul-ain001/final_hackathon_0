import { NextRequest, NextResponse } from 'next/server';

const XERO_CLIENT_ID = process.env.XERO_CLIENT_ID;
const XERO_CLIENT_SECRET = process.env.XERO_CLIENT_SECRET;
const XERO_TENANT_ID = process.env.XERO_TENANT_ID;
const XERO_REFRESH_TOKEN = process.env.XERO_REFRESH_TOKEN;
const XERO_API_BASE = 'https://api.xero.com/api.xro/2.0';
const XERO_TOKEN_URL = 'https://identity.xero.com/connect/token';

// In-memory token cache (per server instance)
let cachedToken: string | null = null;
let tokenExpiry: number | null = null;

const hasCredentials = !!(XERO_CLIENT_ID && XERO_CLIENT_SECRET && XERO_TENANT_ID && XERO_REFRESH_TOKEN);

// ── Token Management ──────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string | null> {
  if (!hasCredentials) return null;

  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry - 60_000) {
    return cachedToken;
  }

  const credentials = Buffer.from(`${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(XERO_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: XERO_REFRESH_TOKEN! }).toString(),
  });

  if (!res.ok) return null;
  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + data.expires_in * 1000;
  return cachedToken;
}

async function xeroGet(endpoint: string) {
  const token = await getAccessToken();
  if (!token) throw new Error('No Xero access token');

  const res = await fetch(`${XERO_API_BASE}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Xero-Tenant-Id': XERO_TENANT_ID!,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Xero API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function xeroPost(endpoint: string, body: object) {
  const token = await getAccessToken();
  if (!token) throw new Error('No Xero access token');

  const res = await fetch(`${XERO_API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Xero-Tenant-Id': XERO_TENANT_ID!,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Xero API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function xeroReport(name: string, params: Record<string, string> = {}) {
  const token = await getAccessToken();
  if (!token) throw new Error('No Xero access token');

  const query = new URLSearchParams(params).toString();
  const url = `${XERO_API_BASE}/Reports/${name}${query ? '?' + query : ''}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Xero-Tenant-Id': XERO_TENANT_ID!,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Xero Report ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

// ── Simulated Data (when no credentials) ─────────────────────────────────────

function simInvoices() {
  return {
    invoices: [
      { id: 'sim-1', number: 'INV-0001', contact: 'Acme Corp', status: 'AUTHORISED', date: '2026-02-01', due_date: '2026-03-01', total: 2500, amount_due: 2500, amount_paid: 0, is_overdue: false },
      { id: 'sim-2', number: 'INV-0002', contact: 'Globex Inc', status: 'PAID', date: '2026-01-15', due_date: '2026-02-15', total: 1800, amount_due: 0, amount_paid: 1800, is_overdue: false },
      { id: 'sim-3', number: 'INV-0003', contact: 'Initech LLC', status: 'AUTHORISED', date: '2026-01-01', due_date: '2026-01-31', total: 950, amount_due: 950, amount_paid: 0, is_overdue: true },
      { id: 'sim-4', number: 'INV-0004', contact: 'Umbrella Ltd', status: 'DRAFT', date: '2026-02-20', due_date: '2026-03-20', total: 3200, amount_due: 3200, amount_paid: 0, is_overdue: false },
    ],
    simulated: true,
  };
}

function simTransactions() {
  return {
    transactions: [
      { id: 'txn-1', type: 'RECEIVE', date: '2026-02-28', amount: 2500, description: 'Client payment INV-0001', contact: 'Acme Corp', bank_account: 'Business Checking' },
      { id: 'txn-2', type: 'SPEND', date: '2026-02-27', amount: 49.99, description: 'SaaS subscription', contact: 'Notion', bank_account: 'Business Checking' },
      { id: 'txn-3', type: 'SPEND', date: '2026-02-25', amount: 120, description: 'Office supplies', contact: 'Staples', bank_account: 'Business Checking' },
      { id: 'txn-4', type: 'RECEIVE', date: '2026-02-20', amount: 1800, description: 'Client payment INV-0002', contact: 'Globex Inc', bank_account: 'Business Checking' },
      { id: 'txn-5', type: 'SPEND', date: '2026-02-15', amount: 299, description: 'Cloud hosting', contact: 'AWS', bank_account: 'Business Checking' },
    ],
    simulated: true,
  };
}

function simSummary() {
  return {
    revenue: { invoiced: 4300, received: 4300, outstanding: 3450, overdue_amount: 950, overdue_count: 1 },
    expenses: { total: 468.99, count: 3 },
    net_cashflow: 3831.01,
    invoices: { total: 4, paid: 1, outstanding: 2, overdue: 1, draft: 1 },
    simulated: true,
  };
}

function simPL() {
  return {
    income: [{ name: 'Sales Revenue', amount: 4300 }],
    expenses: [
      { name: 'Software Subscriptions', amount: 49.99 },
      { name: 'Office Supplies', amount: 120 },
      { name: 'Cloud Hosting', amount: 299 },
    ],
    total_income: 4300,
    total_expenses: 468.99,
    net_profit: 3831.01,
    simulated: true,
  };
}

// ── Action Handlers ───────────────────────────────────────────────────────────

async function getInvoices(status?: string) {
  if (!hasCredentials) return simInvoices();

  let endpoint = '/Invoices?order=Date DESC&page=1';
  if (status) endpoint += `&where=${encodeURIComponent(`Status=="${status}"`)}`;

  const data = await xeroGet(endpoint);
  const invoices = (data.Invoices || []).map((inv: Record<string, unknown>) => ({
    id: inv.InvoiceID,
    number: inv.InvoiceNumber,
    contact: (inv.Contact as Record<string, string>)?.Name || 'Unknown',
    status: inv.Status,
    date: inv.DateString,
    due_date: inv.DueDateString,
    total: inv.Total,
    amount_due: inv.AmountDue,
    amount_paid: inv.AmountPaid,
    is_overdue: inv.Status !== 'PAID' && Number(inv.AmountDue) > 0 && new Date(inv.DueDateString as string) < new Date(),
  }));
  return { invoices };
}

async function getTransactions(fromDate?: string) {
  if (!hasCredentials) return simTransactions();

  let endpoint = '/BankTransactions?order=Date DESC';
  if (fromDate) endpoint += `&where=${encodeURIComponent(`Date>=DateTime(${fromDate.replace(/-/g, ',')})`)}`;

  const data = await xeroGet(endpoint);
  const transactions = (data.BankTransactions || []).slice(0, 20).map((t: Record<string, unknown>) => ({
    id: t.BankTransactionID,
    type: t.Type,
    date: t.DateString,
    amount: t.Total,
    description: t.Reference || 'No reference',
    contact: (t.Contact as Record<string, string>)?.Name || 'Unknown',
    bank_account: (t.BankAccount as Record<string, string>)?.Name || 'Unknown',
  }));
  return { transactions };
}

async function getSummary() {
  if (!hasCredentials) return simSummary();

  const [allInvoices, txnData] = await Promise.all([
    xeroGet('/Invoices?page=1'),
    xeroGet('/BankTransactions?order=Date DESC'),
  ]);

  const invoices = allInvoices.Invoices || [];
  const paid = invoices.filter((i: Record<string, unknown>) => i.Status === 'PAID');
  const outstanding = invoices.filter((i: Record<string, unknown>) => i.Status === 'AUTHORISED');
  const overdue = outstanding.filter((i: Record<string, unknown>) => Number(i.AmountDue) > 0 && new Date(i.DueDateString as string) < new Date());
  const draft = invoices.filter((i: Record<string, unknown>) => i.Status === 'DRAFT');

  const txns = txnData.BankTransactions || [];
  const income = txns.filter((t: Record<string, unknown>) => t.Type === 'RECEIVE').reduce((s: number, t: Record<string, unknown>) => s + Number(t.Total), 0);
  const expenses = txns.filter((t: Record<string, unknown>) => t.Type === 'SPEND').reduce((s: number, t: Record<string, unknown>) => s + Number(t.Total), 0);

  return {
    revenue: {
      invoiced: paid.reduce((s: number, i: Record<string, unknown>) => s + Number(i.Total), 0),
      received: income,
      outstanding: outstanding.reduce((s: number, i: Record<string, unknown>) => s + Number(i.AmountDue), 0),
      overdue_amount: overdue.reduce((s: number, i: Record<string, unknown>) => s + Number(i.AmountDue), 0),
      overdue_count: overdue.length,
    },
    expenses: { total: expenses, count: txns.filter((t: Record<string, unknown>) => t.Type === 'SPEND').length },
    net_cashflow: income - expenses,
    invoices: { total: invoices.length, paid: paid.length, outstanding: outstanding.length, overdue: overdue.length, draft: draft.length },
  };
}

async function getProfitLoss(fromDate: string, toDate: string) {
  if (!hasCredentials) return simPL();

  const data = await xeroReport('ProfitAndLoss', { fromDate, toDate });
  const rows = data.Reports?.[0]?.Rows || [];

  const income: { name: string; amount: number }[] = [];
  const expenses: { name: string; amount: number }[] = [];
  let totalIncome = 0, totalExpenses = 0;

  for (const section of rows) {
    const isIncome = section.Title?.toLowerCase().includes('income') || section.Title?.toLowerCase().includes('revenue');
    const isExpense = section.Title?.toLowerCase().includes('expense') || section.Title?.toLowerCase().includes('operating');

    for (const row of section.Rows || []) {
      if (row.RowType === 'Row') {
        const cells = row.Cells || [];
        const name = cells[0]?.Value || '';
        const amount = parseFloat(cells[1]?.Value?.replace(/,/g, '') || '0') || 0;
        if (isIncome && amount !== 0) { income.push({ name, amount }); totalIncome += amount; }
        if (isExpense && amount !== 0) { expenses.push({ name, amount }); totalExpenses += amount; }
      }
    }
  }

  return { income, expenses, total_income: totalIncome, total_expenses: totalExpenses, net_profit: totalIncome - totalExpenses };
}

async function createInvoice(body: { contact_name: string; line_items: { description: string; quantity: number; unit_amount: number }[]; due_date?: string; reference?: string }) {
  if (!hasCredentials) {
    return { success: true, simulated: true, invoice_number: `SIM-${Date.now()}`, total: body.line_items.reduce((s, l) => s + l.quantity * l.unit_amount, 0) };
  }

  const payload = {
    Invoices: [{
      Type: 'ACCREC',
      Contact: { Name: body.contact_name },
      LineItems: body.line_items.map(li => ({ Description: li.description, Quantity: li.quantity, UnitAmount: li.unit_amount, AccountCode: '200' })),
      ...(body.due_date ? { DueDate: `/Date(${new Date(body.due_date).getTime()}+0000)/` } : {}),
      ...(body.reference ? { Reference: body.reference } : {}),
      Status: 'AUTHORISED',
    }],
  };

  const data = await xeroPost('/Invoices', payload);
  const inv = data.Invoices?.[0];
  return { success: true, invoice_id: inv?.InvoiceID, invoice_number: inv?.InvoiceNumber, total: inv?.Total };
}

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action') || 'summary';
  const status = req.nextUrl.searchParams.get('status') || undefined;
  const fromDate = req.nextUrl.searchParams.get('from') || undefined;
  const toDate = req.nextUrl.searchParams.get('to') || new Date().toISOString().split('T')[0];

  try {
    switch (action) {
      case 'summary':     return NextResponse.json(await getSummary());
      case 'invoices':    return NextResponse.json(await getInvoices(status));
      case 'transactions':return NextResponse.json(await getTransactions(fromDate));
      case 'pl':          return NextResponse.json(await getProfitLoss(fromDate || '2026-01-01', toDate));
      case 'status':      return NextResponse.json({ connected: hasCredentials, tenant_id: XERO_TENANT_ID || null });
      default:            return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message, simulated: !hasCredentials }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action') || '';
  try {
    const body = await req.json();
    switch (action) {
      case 'create_invoice': return NextResponse.json(await createInvoice(body));
      default:               return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
