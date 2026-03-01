'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign, TrendingUp, TrendingDown, AlertTriangle,
  RefreshCw, Loader2, CheckCircle, Clock, FileText,
  ArrowUpRight, ArrowDownRight, Plus, X, CreditCard,
  BarChart3, Wifi, WifiOff
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Summary {
  revenue: { invoiced: number; received: number; outstanding: number; overdue_amount: number; overdue_count: number };
  expenses: { total: number; count: number };
  net_cashflow: number;
  invoices: { total: number; paid: number; outstanding: number; overdue: number; draft: number };
  simulated?: boolean;
}

interface Invoice {
  id: string;
  number: string;
  contact: string;
  status: string;
  date: string;
  due_date: string;
  total: number;
  amount_due: number;
  amount_paid: number;
  is_overdue: boolean;
}

interface Transaction {
  id: string;
  type: 'RECEIVE' | 'SPEND';
  date: string;
  amount: number;
  description: string;
  contact: string;
  bank_account: string;
}

interface PLData {
  income: { name: string; amount: number }[];
  expenses: { name: string; amount: number }[];
  total_income: number;
  total_expenses: number;
  net_profit: number;
  simulated?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function statusBadge(status: string, isOverdue: boolean) {
  if (isOverdue) return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-500/20 text-red-400 border border-red-500/30">Overdue</span>;
  const map: Record<string, string> = {
    PAID: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    AUTHORISED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    DRAFT: 'bg-[#d4a574]/20 text-[#d4a574] border-[#d4a574]/30',
    VOIDED: 'bg-[#333]/60 text-[#666] border-[#333]',
  };
  return <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${map[status] || 'bg-[#222] text-[#888] border-[#333]'}`}>{status}</span>;
}

// ── Create Invoice Modal ──────────────────────────────────────────────────────

function CreateInvoiceModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [contact, setContact] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitAmount, setUnitAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contact || !description || !unitAmount) { setError('Contact, description and amount are required.'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/accounting?action=create_invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_name: contact,
          line_items: [{ description, quantity: parseFloat(quantity), unit_amount: parseFloat(unitAmount) }],
          due_date: dueDate || undefined,
          reference: reference || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) { onCreated(); onClose(); }
      else setError(data.error || 'Failed to create invoice');
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-white">New Invoice</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-[#1f1f1f] rounded-lg transition-colors"><X className="h-4 w-4 text-[#666]" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-[#666] mb-1 block">Contact / Customer *</label>
            <input value={contact} onChange={e => setContact(e.target.value)} placeholder="Acme Corp"
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#d4a574]/50" />
          </div>
          <div>
            <label className="text-xs text-[#666] mb-1 block">Description *</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Consulting Services – March 2026"
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#d4a574]/50" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#666] mb-1 block">Qty</label>
              <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} min="1"
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#d4a574]/50" />
            </div>
            <div>
              <label className="text-xs text-[#666] mb-1 block">Unit Price (USD) *</label>
              <input type="number" value={unitAmount} onChange={e => setUnitAmount(e.target.value)} placeholder="500"
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#d4a574]/50" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#666] mb-1 block">Due Date</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#d4a574]/50" />
            </div>
            <div>
              <label className="text-xs text-[#666] mb-1 block">Reference / PO#</label>
              <input value={reference} onChange={e => setReference(e.target.value)} placeholder="PO-1234"
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#d4a574]/50" />
            </div>
          </div>

          {unitAmount && quantity && (
            <div className="bg-[#1a1a1a] rounded-lg px-3 py-2 text-sm text-[#d4a574] font-medium">
              Total: {fmt(parseFloat(quantity || '0') * parseFloat(unitAmount || '0'))}
            </div>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 text-sm text-[#a0a0a0] border border-[#2a2a2a] rounded-lg hover:bg-[#1a1a1a] transition-colors">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 text-sm font-medium bg-[#d4a574] text-black rounded-lg hover:bg-[#c49464] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? 'Creating…' : 'Create Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AccountingPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pl, setPL] = useState<PLData | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'invoices' | 'transactions' | 'pl'>('invoices');
  const [invoiceFilter, setInvoiceFilter] = useState<string>('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, summaryRes, invoicesRes, txnRes, plRes] = await Promise.all([
        fetch('/api/accounting?action=status'),
        fetch('/api/accounting?action=summary'),
        fetch('/api/accounting?action=invoices'),
        fetch('/api/accounting?action=transactions'),
        fetch(`/api/accounting?action=pl&from=${monthStart}&to=${now.toISOString().split('T')[0]}`),
      ]);

      const [statusData, summaryData, invoicesData, txnData, plData] = await Promise.all([
        statusRes.json(), summaryRes.json(), invoicesRes.json(), txnRes.json(), plRes.json(),
      ]);

      setConnected(statusData.connected ?? false);
      if (summaryData.revenue) setSummary(summaryData);
      if (invoicesData.invoices) setInvoices(invoicesData.invoices);
      if (txnData.transactions) setTransactions(txnData.transactions);
      if (plData.total_income !== undefined) setPL(plData);
    } catch (err) {
      console.error('Accounting fetch error:', err);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filteredInvoices = invoiceFilter === 'ALL'
    ? invoices
    : invoiceFilter === 'OVERDUE'
      ? invoices.filter(i => i.is_overdue)
      : invoices.filter(i => i.status === invoiceFilter);

  // ── Summary Cards ────────────────────────────────────────────────────────

  const SummaryCard = ({ label, value, sub, icon, color }: { label: string; value: string; sub?: string; icon: React.ReactNode; color: string }) => (
    <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm text-[#666]">{label}</p>
        <div className={`p-2 rounded-xl ${color}`}>{icon}</div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-[#666] mt-1">{sub}</p>}
    </div>
  );

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Xero Accounting</h1>
          <p className="text-sm text-[#666] mt-0.5">Invoices, transactions &amp; financial reports</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border ${connected ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-[#1f1f1f] text-[#666] border-[#2a2a2a]'}`}>
            {connected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {connected ? 'Live' : 'Simulated'}
          </div>
          <button onClick={fetchAll} disabled={loading}
            className="p-2 border border-[#2a2a2a] rounded-xl hover:bg-[#1a1a1a] transition-colors disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 text-[#666] ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#d4a574] text-black text-sm font-medium rounded-xl hover:bg-[#c49464] transition-colors">
            <Plus className="h-4 w-4" /> New Invoice
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {loading && !summary ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="h-8 w-8 animate-spin text-[#d4a574]" /></div>
      ) : summary ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              label="Revenue (Paid)"
              value={fmt(summary.revenue.received)}
              sub={`${summary.invoices.paid} invoices paid`}
              icon={<TrendingUp className="h-4 w-4 text-emerald-400" />}
              color="bg-emerald-500/10"
            />
            <SummaryCard
              label="Outstanding"
              value={fmt(summary.revenue.outstanding)}
              sub={`${summary.invoices.outstanding} invoices`}
              icon={<Clock className="h-4 w-4 text-blue-400" />}
              color="bg-blue-500/10"
            />
            <SummaryCard
              label="Expenses"
              value={fmt(summary.expenses.total)}
              sub={`${summary.expenses.count} transactions`}
              icon={<TrendingDown className="h-4 w-4 text-red-400" />}
              color="bg-red-500/10"
            />
            <SummaryCard
              label="Net Cash Flow"
              value={fmt(summary.net_cashflow)}
              sub="Revenue minus expenses"
              icon={<DollarSign className="h-4 w-4 text-[#d4a574]" />}
              color="bg-[#d4a574]/10"
            />
          </div>

          {/* Overdue Alert */}
          {summary.invoices.overdue > 0 && (
            <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
              <p className="text-sm text-red-300">
                <span className="font-semibold">{summary.invoices.overdue} overdue {summary.invoices.overdue === 1 ? 'invoice' : 'invoices'}</span>
                {' '}totalling <span className="font-semibold">{fmt(summary.revenue.overdue_amount)}</span> — action required.
              </p>
            </div>
          )}
        </>
      ) : null}

      {/* Tabs */}
      <div className="flex gap-1 bg-[#111] border border-[#1f1f1f] rounded-xl p-1 w-fit">
        {(['invoices', 'transactions', 'pl'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors capitalize ${activeTab === tab ? 'bg-[#d4a574] text-black' : 'text-[#666] hover:text-white'}`}>
            {tab === 'pl' ? 'P&L' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Invoices Tab ── */}
      {activeTab === 'invoices' && (
        <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#1f1f1f]">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#d4a574]" />
              <h2 className="font-medium text-white">Invoices</h2>
            </div>
            <div className="flex gap-1">
              {['ALL', 'AUTHORISED', 'PAID', 'OVERDUE', 'DRAFT'].map(f => (
                <button key={f} onClick={() => setInvoiceFilter(f)}
                  className={`px-3 py-1 text-xs rounded-lg transition-colors ${invoiceFilter === f ? 'bg-[#d4a574]/20 text-[#d4a574] border border-[#d4a574]/30' : 'text-[#666] hover:text-white'}`}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1f1f1f]">
                  {['Invoice', 'Contact', 'Date', 'Due', 'Total', 'Due Amount', 'Status'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs text-[#555] font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-[#555]">No invoices found</td></tr>
                ) : filteredInvoices.map(inv => (
                  <tr key={inv.id} className="border-b border-[#161616] hover:bg-[#161616] transition-colors">
                    <td className="px-5 py-3 text-[#d4a574] font-medium">{inv.number}</td>
                    <td className="px-5 py-3 text-white">{inv.contact}</td>
                    <td className="px-5 py-3 text-[#666]">{inv.date?.slice(0, 10)}</td>
                    <td className={`px-5 py-3 ${inv.is_overdue ? 'text-red-400' : 'text-[#666]'}`}>{inv.due_date?.slice(0, 10)}</td>
                    <td className="px-5 py-3 text-white font-medium">{fmt(inv.total)}</td>
                    <td className={`px-5 py-3 font-medium ${Number(inv.amount_due) > 0 ? 'text-amber-400' : 'text-[#555]'}`}>{fmt(inv.amount_due)}</td>
                    <td className="px-5 py-3">{statusBadge(inv.status, inv.is_overdue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Transactions Tab ── */}
      {activeTab === 'transactions' && (
        <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-[#1f1f1f]">
            <CreditCard className="h-4 w-4 text-[#d4a574]" />
            <h2 className="font-medium text-white">Bank Transactions</h2>
          </div>
          <div className="divide-y divide-[#161616]">
            {transactions.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-[#555]">No transactions found</p>
            ) : transactions.map(txn => (
              <div key={txn.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-[#161616] transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${txn.type === 'RECEIVE' ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                    {txn.type === 'RECEIVE'
                      ? <ArrowUpRight className="h-4 w-4 text-emerald-400" />
                      : <ArrowDownRight className="h-4 w-4 text-red-400" />}
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium">{txn.description}</p>
                    <p className="text-xs text-[#555]">{txn.contact} · {txn.bank_account}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${txn.type === 'RECEIVE' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {txn.type === 'RECEIVE' ? '+' : '-'}{fmt(txn.amount)}
                  </p>
                  <p className="text-xs text-[#555]">{txn.date?.slice(0, 10)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── P&L Tab ── */}
      {activeTab === 'pl' && pl && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Income */}
          <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-[#1f1f1f]">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              <h2 className="font-medium text-white">Income</h2>
            </div>
            <div className="divide-y divide-[#161616]">
              {pl.income.map((row, i) => (
                <div key={i} className="flex justify-between px-5 py-3 text-sm">
                  <span className="text-[#a0a0a0]">{row.name}</span>
                  <span className="text-emerald-400 font-medium">{fmt(row.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between px-5 py-3 text-sm font-semibold border-t border-[#2a2a2a]">
                <span className="text-white">Total Income</span>
                <span className="text-emerald-400">{fmt(pl.total_income)}</span>
              </div>
            </div>
          </div>

          {/* Expenses */}
          <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-[#1f1f1f]">
              <TrendingDown className="h-4 w-4 text-red-400" />
              <h2 className="font-medium text-white">Expenses</h2>
            </div>
            <div className="divide-y divide-[#161616]">
              {pl.expenses.map((row, i) => (
                <div key={i} className="flex justify-between px-5 py-3 text-sm">
                  <span className="text-[#a0a0a0]">{row.name}</span>
                  <span className="text-red-400 font-medium">{fmt(row.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between px-5 py-3 text-sm font-semibold border-t border-[#2a2a2a]">
                <span className="text-white">Total Expenses</span>
                <span className="text-red-400">{fmt(pl.total_expenses)}</span>
              </div>
            </div>
          </div>

          {/* Net Profit */}
          <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-4 w-4 text-[#d4a574]" />
                <h2 className="font-medium text-white">Net Profit</h2>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#666]">Total Income</span>
                  <span className="text-emerald-400">{fmt(pl.total_income)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#666]">Total Expenses</span>
                  <span className="text-red-400">−{fmt(pl.total_expenses)}</span>
                </div>
                <div className="h-px bg-[#2a2a2a]" />
                <div className="flex justify-between font-semibold">
                  <span className="text-white">Net Profit</span>
                  <span className={pl.net_profit >= 0 ? 'text-emerald-400' : 'text-red-400'}>{fmt(pl.net_profit)}</span>
                </div>
              </div>
            </div>
            <div className={`mt-6 p-4 rounded-xl flex items-center gap-3 ${pl.net_profit >= 0 ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
              {pl.net_profit >= 0
                ? <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
                : <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />}
              <p className="text-xs text-[#a0a0a0]">
                {pl.net_profit >= 0
                  ? `Profitable month — ${fmt(pl.net_profit)} net`
                  : `Operating at a loss of ${fmt(Math.abs(pl.net_profit))}`}
              </p>
            </div>
            {pl.simulated && (
              <p className="text-xs text-[#555] mt-3 text-center">Simulated data — connect Xero for live figures</p>
            )}
          </div>
        </div>
      )}

      {showCreateModal && (
        <CreateInvoiceModal onClose={() => setShowCreateModal(false)} onCreated={fetchAll} />
      )}
    </div>
  );
}
