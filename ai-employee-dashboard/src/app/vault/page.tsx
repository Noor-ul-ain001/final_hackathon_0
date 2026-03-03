'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Mail, ArrowLeft, Loader2, RefreshCw, ChevronRight,
  Check, X, Eye, XCircle, Clock, ChevronLeft,
  Search, AlertTriangle, Inbox, FileCheck, Sparkles,
  Send, CheckCheck, ArrowRight, RotateCcw
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────── */
interface VaultFile {
  id: string;
  name: string;
  type: 'folder' | 'file';
  size: string;
  modified: string;
  folder: string;
  preview?: string;
  subject?: string;
  sender?: string;
}
interface FolderResponse {
  items: VaultFile[];
  total: number;
  page: number;
  totalPages: number;
}

/* ─── Tab config ─────────────────────────────────────────── */
const TABS = [
  { id: 'Needs_Action',     label: 'Inbox',    icon: Inbox,      color: 'blue',    sublabel: 'Received emails' },
  { id: 'Pending_Approval', label: 'Drafts',   icon: Sparkles,   color: 'amber',   sublabel: 'AI replies to approve' },
  { id: 'Done',             label: 'Sent',     icon: FileCheck,  color: 'emerald', sublabel: 'Completed' },
  { id: 'Failed',           label: 'Failed',   icon: XCircle,    color: 'red',     sublabel: 'Errors' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const TAB_COLORS: Record<string, { ring: string; text: string; bg: string; badge: string }> = {
  blue:    { ring: 'ring-blue-500/40',    text: 'text-blue-400',    bg: 'bg-blue-500/10',    badge: 'bg-blue-500/20'    },
  amber:   { ring: 'ring-amber-500/40',   text: 'text-amber-400',   bg: 'bg-amber-500/10',   badge: 'bg-amber-500/20'   },
  emerald: { ring: 'ring-emerald-500/40', text: 'text-emerald-400', bg: 'bg-emerald-500/10', badge: 'bg-emerald-500/20' },
  red:     { ring: 'ring-red-500/40',     text: 'text-red-400',     bg: 'bg-red-500/10',     badge: 'bg-red-500/20'     },
};

/* ─── Helpers ────────────────────────────────────────────── */
function relativeTime(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000), h = Math.floor(m / 60), dy = Math.floor(h / 24);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${dy}d ago`;
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function initials(sender: string) {
  const name = sender.replace(/<.*>/, '').trim();
  const parts = name.split(/\s+/);
  return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
}

/* ─── Main page ──────────────────────────────────────────── */
export default function VaultPage() {
  const [tab, setTab]                     = useState<TabId>('Needs_Action');
  const [counts, setCounts]               = useState<Record<string, number>>({});
  const [files, setFiles]                 = useState<VaultFile[]>([]);
  const [total, setTotal]                 = useState(0);
  const [page, setPage]                   = useState(1);
  const [totalPages, setTotalPages]       = useState(0);
  const [search, setSearch]               = useState('');
  const [loading, setLoading]             = useState(false);
  const [countsLoading, setCountsLoading] = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [success, setSuccess]             = useState<string | null>(null);
  const [selectedFile, setSelectedFile]   = useState<VaultFile | null>(null);
  const [fileContent, setFileContent]     = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [generateLoading, setGenerateLoading] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading]     = useState(false);
  const [bulkProgress, setBulkProgress]   = useState<{ done: number; total: number } | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const LIMIT = 20;

  /* ── Fetch tab counts ── */
  const fetchCounts = useCallback(async () => {
    setCountsLoading(true);
    const res: Record<string, number> = {};
    await Promise.all(TABS.map(async t => {
      try {
        const r = await fetch(`/api/vault?action=folder_stats&folder=${t.id}`);
        const d = await r.json();
        res[t.id] = d.count ?? 0;
      } catch { res[t.id] = 0; }
    }));
    setCounts(res);
    setCountsLoading(false);
  }, []);

  /* ── Fetch files for current tab ── */
  const fetchFiles = useCallback(async (folder: string, pg: number, q: string) => {
    setLoading(true);
    try {
      // Inbox tab: only show real email files, not ALERT/AUDIT/TASK system files
      const typeFilter = folder === 'Needs_Action' ? 'EMAIL' : 'ALL';
      const p = new URLSearchParams({ action: 'folder', folder, page: String(pg), limit: String(LIMIT), search: q, type: typeFilter });
      const r = await fetch(`/api/vault?${p}`);
      const d: FolderResponse = await r.json();
      setFiles(d.items || []);
      setTotal(d.total || 0);
      setPage(d.page || 1);
      setTotalPages(d.totalPages || 0);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch');
    } finally { setLoading(false); }
  }, []);

  /* ── Effects ── */
  useEffect(() => { fetchCounts(); }, [fetchCounts]);
  useEffect(() => { const id = setInterval(fetchCounts, 30000); return () => clearInterval(id); }, [fetchCounts]);
  useEffect(() => { fetchFiles(tab, page, search); }, [tab, page, fetchFiles]); // eslint-disable-line
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setPage(1); fetchFiles(tab, 1, search); }, 350);
  }, [search]); // eslint-disable-line

  /* ── Switch tab ── */
  const switchTab = (id: TabId) => {
    setTab(id); setPage(1); setSearch('');
    setSelectedFile(null); setFileContent(null);
  };

  /* ── Move file ── */
  async function moveFile(file: VaultFile, to: string) {
    setActionLoading(file.id);
    try {
      const r = await fetch('/api/vault/move', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, fromFolder: file.folder, toFolder: to, updateFrontmatter: true }),
      });
      const d = await r.json();
      if (d.success) {
        const msg = to === 'Approved' && d.execution?.emailSent
          ? `Email sent to ${file.sender || 'recipient'}!`
          : `Moved to ${to}`;
        setSuccess(msg);
        setSelectedFile(null);
        fetchFiles(tab, page, search);
        fetchCounts();
        setTimeout(() => setSuccess(null), 5000);
      } else { setError(d.error || 'Move failed'); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Move failed'); }
    finally { setActionLoading(null); }
  }

  /* ── Generate AI reply for an inbox email ── */
  async function generateReply(file: VaultFile) {
    setGenerateLoading(file.id);
    setError(null);
    try {
      const r = await fetch('/api/vault/generate-reply', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, folder: file.folder }),
      });
      const d = await r.json();
      if (d.success) {
        setSuccess(`AI reply drafted! Switch to "Drafts" tab to review and approve.`);
        fetchCounts();
        setTimeout(() => setSuccess(null), 8000);
      } else { setError(d.error || 'Failed to generate reply'); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to generate reply'); }
    finally { setGenerateLoading(null); }
  }

  /* ── Bulk approve all drafts ── */
  async function bulkApprove() {
    if (!files.length || tab !== 'Pending_Approval') return;
    setBulkLoading(true);
    setBulkProgress({ done: 0, total: files.length });
    let done = 0;
    for (const f of files) {
      try {
        await fetch('/api/vault/move', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: f.name, fromFolder: f.folder, toFolder: 'Approved', updateFrontmatter: true }),
        });
        done++;
      } catch { /* skip */ }
      setBulkProgress({ done, total: files.length });
    }
    setBulkLoading(false); setBulkProgress(null);
    setSuccess(`Approved & sent ${done} of ${files.length} drafts`);
    fetchFiles(tab, page, search); fetchCounts();
    setTimeout(() => setSuccess(null), 5000);
  }

  /* ── Open file preview ── */
  async function openFile(file: VaultFile) {
    setSelectedFile(file); setFileContent(null);
    try {
      const r = await fetch(`/api/vault?action=file&folder=${encodeURIComponent(file.folder)}&file=${encodeURIComponent(file.name)}`);
      const d = await r.json();
      setFileContent(d.content || 'No content');
    } catch { setFileContent('Failed to load content'); }
  }

  const activeCfg = TABS.find(t => t.id === tab)!;
  const activeC   = TAB_COLORS[activeCfg.color];

  /* ─────────────── RENDER ── */
  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-6">
      <Link href="/" className="inline-flex items-center gap-2 text-[#a0a0a0] hover:text-[#d4a574] transition-colors mb-5">
        <ArrowLeft className="w-4 h-4" />Back to Dashboard
      </Link>

      <div className="max-w-4xl mx-auto space-y-5">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#d4a574] to-[#b8956a] flex items-center justify-center shadow-lg shadow-[#d4a574]/20">
              <Mail className="w-6 h-6 text-black" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Email Inbox</h1>
              <p className="text-xs text-[#555]">AI-powered email management</p>
            </div>
          </div>
          <button
            onClick={() => { fetchCounts(); fetchFiles(tab, page, search); }}
            disabled={loading || countsLoading}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#161616] rounded-xl text-sm text-[#a0a0a0] hover:text-[#d4a574] border border-[#1f1f1f] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading || countsLoading ? 'animate-spin' : ''}`} />Refresh
          </button>
        </div>

        {/* ── How it works banner ── */}
        <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl p-4">
          <p className="text-xs text-[#555] uppercase tracking-wider mb-3 font-semibold">How it works</p>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {[
              { icon: Inbox,     label: '1. Email arrives',        sub: 'Gmail watcher detects it',   color: 'text-blue-400'    },
              { icon: Sparkles,  label: '2. Click "Generate Reply"', sub: 'AI writes a draft for you',  color: 'text-amber-400'   },
              { icon: Check,     label: '3. Review & Approve',      sub: 'Check the draft, then send', color: 'text-emerald-400' },
              { icon: Send,      label: '4. Email sent',            sub: 'Reply lands in their inbox', color: 'text-purple-400'  },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-2 bg-[#161616] rounded-xl px-3 py-2">
                  <step.icon className={`w-4 h-4 ${step.color} shrink-0`} />
                  <div>
                    <p className="text-xs font-medium text-white whitespace-nowrap">{step.label}</p>
                    <p className="text-[10px] text-[#555] whitespace-nowrap">{step.sub}</p>
                  </div>
                </div>
                {i < 3 && <ArrowRight className="w-3 h-3 text-[#333] shrink-0" />}
              </div>
            ))}
          </div>
        </div>

        {/* ── Notifications ── */}
        {success && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-emerald-400 text-sm">
            <Check className="w-4 h-4 shrink-0" />{success}
            {success.includes('Drafts') && (
              <button onClick={() => switchTab('Pending_Approval')} className="ml-auto flex items-center gap-1 px-2 py-1 bg-emerald-500/20 rounded-lg text-xs font-medium hover:bg-emerald-500/30 transition-colors">
                View Drafts <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />{error}
            <button onClick={() => setError(null)} className="ml-auto shrink-0"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* ── Stat cards (act as tabs) ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {TABS.map(t => {
            const Icon = t.icon;
            const count = counts[t.id] ?? 0;
            const isActive = tab === t.id;
            const c = TAB_COLORS[t.color];
            return (
              <button key={t.id} onClick={() => switchTab(t.id)}
                className={`text-left p-4 rounded-2xl border transition-all ring-2 ${
                  isActive ? `${c.bg} border-transparent ${c.ring}` : 'bg-[#111] border-[#1f1f1f] ring-transparent hover:border-[#2a2a2a]'
                }`}
              >
                <div className={`inline-flex p-2 rounded-xl mb-3 ${isActive ? c.badge : 'bg-[#1a1a1a]'}`}>
                  <Icon className={`w-4 h-4 ${isActive ? c.text : 'text-[#555]'}`} />
                </div>
                <p className={`text-2xl font-bold mb-0.5 ${isActive ? c.text : 'text-white'}`}>
                  {countsLoading ? <span className="text-[#333]">–</span> : count}
                </p>
                <p className={`text-xs font-semibold ${isActive ? 'text-white' : 'text-[#777]'}`}>{t.label}</p>
                <p className="text-[10px] text-[#444] mt-0.5">{t.sublabel}</p>
              </button>
            );
          })}
        </div>

        {/* ── Search + bulk actions ── */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" />
            <input
              type="text" placeholder="Search by subject or sender…" value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-[#111] border border-[#1f1f1f] rounded-xl text-sm text-white placeholder-[#444] focus:outline-none focus:ring-2 focus:ring-[#d4a574]/40 focus:border-[#d4a574]"
            />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] hover:text-white"><X className="w-4 h-4" /></button>}
          </div>

          {/* Approve All — only on Drafts tab */}
          {tab === 'Pending_Approval' && files.length > 0 && (
            <button onClick={bulkApprove} disabled={bulkLoading || loading}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap disabled:opacity-50 shadow-lg shadow-emerald-900/30"
            >
              {bulkLoading
                ? <><Loader2 className="w-4 h-4 animate-spin" />{bulkProgress ? `${bulkProgress.done}/${bulkProgress.total}` : '…'}</>
                : <><CheckCheck className="w-4 h-4" />Approve All ({files.length})</>
              }
            </button>
          )}
        </div>

        {/* ── File list ── */}
        <div className="bg-[#111] rounded-2xl border border-[#1f1f1f] overflow-hidden">
          {/* List header */}
          <div className={`px-4 py-3 border-b border-[#1a1a1a] flex items-center justify-between ${activeC.bg}`}>
            <div className="flex items-center gap-2">
              <activeCfg.icon className={`w-4 h-4 ${activeC.text}`} />
              <span className={`text-sm font-semibold ${activeC.text}`}>{activeCfg.label}</span>
              <span className="text-xs text-[#555]">
                {loading ? '…' : `${total} email${total !== 1 ? 's' : ''}${search ? ` matching "${search}"` : ''}`}
              </span>
            </div>
            {tab === 'Needs_Action' && !loading && total > 0 && (
              <span className="text-[10px] text-blue-400/70">Click <strong>Generate Reply</strong> on any email</span>
            )}
            {tab === 'Pending_Approval' && !loading && total > 0 && (
              <span className="text-[10px] text-amber-400/70">Click <strong>Approve</strong> to send the reply</span>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-48"><Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" /></div>
          ) : files.length === 0 ? (
            <EmptyState tab={tab} search={search} onClear={() => setSearch('')} onSwitchTab={switchTab} />
          ) : (
            <div className="p-2 space-y-0">
              {files.map(file => (
                <EmailCard
                  key={file.id}
                  file={file}
                  tab={tab}
                  actionLoading={actionLoading}
                  generateLoading={generateLoading}
                  onOpen={openFile}
                  onMove={moveFile}
                  onGenerate={generateReply}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#1a1a1a] bg-[#0e0e0e]">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || loading}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#161616] rounded-xl text-xs text-[#a0a0a0] hover:text-white border border-[#1f1f1f] disabled:opacity-40 transition-colors">
                <ChevronLeft className="w-3.5 h-3.5" />Previous
              </button>
              <span className="text-xs text-[#555]">Page <span className="text-white font-medium">{page}</span> of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || loading}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#161616] rounded-xl text-xs text-[#a0a0a0] hover:text-white border border-[#1f1f1f] disabled:opacity-40 transition-colors">
                Next<ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ══ PREVIEW MODAL ══ */}
      {selectedFile && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedFile(null)}>
          <div className="bg-[#111] rounded-2xl border border-[#222] w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div className="flex items-start gap-3 p-5 border-b border-[#1f1f1f]">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shrink-0 text-xs font-bold text-white">
                {selectedFile.sender ? initials(selectedFile.sender) : <Mail className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white">{selectedFile.subject || selectedFile.name}</h3>
                {selectedFile.sender && <p className="text-xs text-[#666] mt-0.5">From: {selectedFile.sender}</p>}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-[#444]">{formatDate(selectedFile.modified)}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1f1f1f] text-[#555]">{selectedFile.folder.replace(/_/g,' ')}</span>
                </div>
              </div>
              <button onClick={() => setSelectedFile(null)} className="p-2 hover:bg-[#1f1f1f] rounded-lg transition-colors"><X className="w-5 h-5 text-[#555]" /></button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5">
              {fileContent == null
                ? <div className="flex items-center justify-center h-32"><Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" /></div>
                : <pre className="whitespace-pre-wrap text-xs text-[#ccc] font-mono bg-[#0a0a0a] rounded-xl p-4 border border-[#1a1a1a] leading-relaxed">{fileContent}</pre>
              }
            </div>

            {/* Modal actions */}
            {tab === 'Pending_Approval' && (
              <div className="p-4 border-t border-[#1f1f1f] bg-[#0e0e0e] rounded-b-2xl">
                <div className="flex gap-3">
                  <button onClick={() => moveFile(selectedFile, 'Rejected')} disabled={actionLoading === selectedFile.id}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1a1a1a] border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/10 transition-colors disabled:opacity-50">
                    {actionLoading === selectedFile.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}Reject
                  </button>
                  <button onClick={() => moveFile(selectedFile, 'Approved')} disabled={actionLoading === selectedFile.id}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-colors disabled:opacity-50 shadow-lg shadow-emerald-900/40">
                    {actionLoading === selectedFile.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Approve &amp; Send
                  </button>
                </div>
              </div>
            )}
            {tab === 'Needs_Action' && (
              <div className="p-4 border-t border-[#1f1f1f] bg-[#0e0e0e] rounded-b-2xl">
                <button onClick={() => { setSelectedFile(null); generateReply(selectedFile); }} disabled={generateLoading === selectedFile.id}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm font-semibold hover:bg-amber-500/20 transition-colors disabled:opacity-50">
                  {generateLoading === selectedFile.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Generate AI Reply
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Empty state ─────────────────────────────────────────── */
function EmptyState({ tab, search, onClear, onSwitchTab }: {
  tab: TabId; search: string; onClear: () => void; onSwitchTab: (t: TabId) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
      {tab === 'Pending_Approval' && !search ? (
        <>
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
            <Sparkles className="w-7 h-7 text-amber-500/40" />
          </div>
          <p className="text-sm font-medium text-[#888] mb-1">No AI drafts yet</p>
          <p className="text-xs text-[#444] mb-4 max-w-xs">Go to Inbox, pick an email, and click <strong className="text-amber-400">Generate Reply</strong> to create an AI draft</p>
          <button onClick={() => onSwitchTab('Needs_Action')}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-400 font-medium hover:bg-amber-500/20 transition-colors">
            <Inbox className="w-3.5 h-3.5" />Go to Inbox
          </button>
        </>
      ) : (
        <>
          <div className="w-16 h-16 rounded-2xl bg-[#161616] border border-[#1f1f1f] flex items-center justify-center mb-4">
            <Mail className="w-7 h-7 text-[#333]" />
          </div>
          <p className="text-sm text-[#444] mb-3">{search ? `No results for "${search}"` : 'Nothing here yet'}</p>
          {search && <button onClick={onClear} className="flex items-center gap-1.5 px-4 py-2 bg-[#161616] border border-[#1f1f1f] rounded-xl text-xs text-[#888] hover:text-white transition-colors"><X className="w-3.5 h-3.5" />Clear search</button>}
        </>
      )}
    </div>
  );
}

/* ─── Email card ─────────────────────────────────────────── */
function EmailCard({ file, tab, actionLoading, generateLoading, onOpen, onMove, onGenerate }: {
  file: VaultFile;
  tab: TabId;
  actionLoading: string | null;
  generateLoading: string | null;
  onOpen: (f: VaultFile) => void;
  onMove: (f: VaultFile, to: string) => void;
  onGenerate: (f: VaultFile) => void;
}) {
  const busy    = actionLoading === file.id;
  const genBusy = generateLoading === file.id;

  return (
    <div className={`flex flex-col bg-[#161616] mx-1 my-1.5 rounded-xl border border-[#222] hover:border-[#2a2a2a] transition-all ${busy || genBusy ? 'opacity-60 pointer-events-none' : ''}`}>
      {/* Clickable email info */}
      <div className="flex items-start gap-3 p-4 cursor-pointer" onClick={() => onOpen(file)}>
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shrink-0 text-[11px] font-bold text-white mt-0.5">
          {file.sender ? initials(file.sender) : <Mail className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-white line-clamp-1">{file.subject || file.name}</p>
            <span className="text-[10px] text-[#555] shrink-0 whitespace-nowrap">{relativeTime(file.modified)}</span>
          </div>
          {file.sender && <p className="text-xs text-[#666] truncate mt-0.5">{file.sender}</p>}
          {file.preview && <p className="text-xs text-[#444] mt-1.5 line-clamp-1">{file.preview}</p>}
        </div>
      </div>

      {/* Action footer */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-[#1e1e1e] bg-[#121212] rounded-b-xl">
        {/* View — always */}
        <button onClick={() => onOpen(file)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-[#777] hover:text-[#d4a574] hover:bg-[#1f1f1f] border border-[#222] hover:border-[#333] transition-all font-medium">
          <Eye className="w-3.5 h-3.5" />View
        </button>

        <div className="flex-1" />

        {/* Inbox: Generate Reply */}
        {tab === 'Needs_Action' && (
          <button onClick={e => { e.stopPropagation(); onGenerate(file); }} disabled={genBusy}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-amber-900 bg-amber-400 hover:bg-amber-300 transition-all disabled:opacity-50 shadow shadow-amber-900/30">
            {genBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {genBusy ? 'Generating…' : 'Generate Reply'}
          </button>
        )}

        {/* Drafts: Reject + Approve */}
        {tab === 'Pending_Approval' && (
          <>
            <button onClick={e => { e.stopPropagation(); onMove(file, 'Rejected'); }} disabled={busy}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 transition-all disabled:opacity-50">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}Reject
            </button>
            <button onClick={e => { e.stopPropagation(); onMove(file, 'Approved'); }} disabled={busy}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 border border-emerald-500/40 transition-all disabled:opacity-50 shadow shadow-emerald-900/40">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}Approve &amp; Send
            </button>
          </>
        )}

        {/* Failed: Retry */}
        {tab === 'Failed' && (
          <button onClick={e => { e.stopPropagation(); onMove(file, 'Pending_Approval'); }} disabled={busy}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 transition-all disabled:opacity-50">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}Retry
          </button>
        )}
      </div>
    </div>
  );
}
