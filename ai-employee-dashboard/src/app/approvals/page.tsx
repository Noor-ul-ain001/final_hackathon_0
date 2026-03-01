'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Mail,
  Eye,
  FileText,
  MessageSquare,
  RefreshCw,
  Check,
  X,
  AlertTriangle,
  Bot,
  ArrowLeft,
  Sparkles,
  Loader2,
  Smartphone,
  Copy,
  Hash
} from 'lucide-react';
import type { VaultItem } from '@/types/vault';
import { moveVaultFile } from '@/lib/api';

interface ApprovalItem extends VaultItem {
  code?: string;
  emailBody?: string;
  emailTo?: string;
  fullContent?: string;
}

interface ApprovalStats {
  pending: number;
  approvedToday: number;
  rejectedToday: number;
  completedToday: number;
}

export default function ApprovalsPage() {
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalItem[]>([]);
  const [approvedItems, setApprovedItems] = useState<ApprovalItem[]>([]);
  const [rejectedItems, setRejectedItems] = useState<ApprovalItem[]>([]);
  const [stats, setStats] = useState<ApprovalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch from new approvals API for codes
      const approvalsRes = await fetch('/api/approvals');
      const approvalsData = await approvalsRes.json();

      // Also fetch from vault API for full data
      const [pendingRes, approvedRes, rejectedRes] = await Promise.all([
        fetch('/api/vault?action=pending_approval'),
        fetch('/api/vault?action=approved'),
        fetch('/api/vault?action=rejected')
      ]);

      const pendingData = await pendingRes.json();
      const approvedData = await approvedRes.json();
      const rejectedData = await rejectedRes.json();

      // Merge codes and email details into pending items
      const pendingWithCodes = (pendingData.items || []).map((item: VaultItem & { emailBody?: string; emailTo?: string }) => {
        const matchingApproval = approvalsData.approvals?.find(
          (a: { filename: string }) => a.filename === item.filename
        );
        return {
          ...item,
          code: matchingApproval?.code,
          emailBody: item.emailBody || '',
          emailTo: item.emailTo || item.frontmatter?.reply_to || ''
        };
      });

      setPendingApprovals(pendingWithCodes);
      setApprovedItems(approvedData.items?.slice(0, 10) || []);
      setRejectedItems(rejectedData.items?.slice(0, 10) || []);
      setStats(approvalsData.stats || null);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch approvals:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(`approve ${code}`);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const [sentNotice, setSentNotice] = useState<string | null>(null);

  const handleApprove = async (item: VaultItem) => {
    setProcessingId(item.id);
    try {
      const result = await moveVaultFile({
        filename: item.filename,
        fromFolder: 'Pending_Approval',
        toFolder: 'Approved',
        updateFrontmatter: true
      });

      if (result.success) {
        window.dispatchEvent(new CustomEvent('vault-stats-changed'));
        setPendingApprovals(prev => prev.filter(i => i.id !== item.id));
        setApprovedItems(prev => [{ ...item, folder: 'Approved' }, ...prev]);

        // Show sent confirmation if email was dispatched
        const emailSent = result.execution?.emailSent;
        setSentNotice(emailSent
          ? `Email sent to ${(item as ApprovalItem).emailTo || 'recipient'}`
          : 'Approved — email will be sent when watcher runs');
        setTimeout(() => setSentNotice(null), 5000);
      } else {
        setError(result.error || 'Failed to approve item');
      }
    } catch (err) {
      console.error('Failed to approve item:', err);
      setError(err instanceof Error ? err.message : 'Failed to approve item');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (item: VaultItem) => {
    setProcessingId(item.id);
    try {
      const result = await moveVaultFile({
        filename: item.filename,
        fromFolder: 'Pending_Approval',
        toFolder: 'Rejected',
        updateFrontmatter: true
      });

      if (result.success) {
        window.dispatchEvent(new CustomEvent('vault-stats-changed'));
        setPendingApprovals(prev => prev.filter(i => i.id !== item.id));
        setRejectedItems(prev => [{ ...item, folder: 'Rejected' }, ...prev]);
      } else {
        setError(result.error || 'Failed to reject item');
      }
    } catch (err) {
      console.error('Failed to reject item:', err);
      setError(err instanceof Error ? err.message : 'Failed to reject item');
    } finally {
      setProcessingId(null);
    }
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, React.ComponentType<{ className?: string }>> = {
      email: Mail,
      whatsapp: MessageSquare,
      transaction: DollarSign,
      response: Mail,
      payment: DollarSign,
      social: Eye,
      file: FileText
    };
    const Icon = icons[type] || FileText;
    return Icon;
  };

  const getTypeColors = (type: string) => {
    const colors: Record<string, { bg: string; text: string; icon: string }> = {
      email: { bg: 'bg-blue-500/10', text: 'text-blue-400', icon: 'bg-blue-500/20' },
      whatsapp: { bg: 'bg-green-500/10', text: 'text-green-400', icon: 'bg-green-500/20' },
      transaction: { bg: 'bg-purple-500/10', text: 'text-purple-400', icon: 'bg-purple-500/20' },
      response: { bg: 'bg-[#d4a574]/10', text: 'text-[#d4a574]', icon: 'bg-[#d4a574]/20' },
      payment: { bg: 'bg-purple-500/10', text: 'text-purple-400', icon: 'bg-purple-500/20' },
      social: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', icon: 'bg-cyan-500/20' },
      file: { bg: 'bg-[#2a2a2a]', text: 'text-[#a0a0a0]', icon: 'bg-[#1f1f1f]' }
    };
    return colors[type] || colors.file;
  };

  const ApprovalCard = ({ item, showActions = false }: { item: ApprovalItem; showActions?: boolean }) => {
    const Icon = getTypeIcon(item.type);
    const colors = getTypeColors(item.type);
    const isProcessing = processingId === item.id;
    const isExpanded = expandedId === item.id;

    return (
      <div className={`bg-[#161616] rounded-xl border border-[#1f1f1f] hover:border-[#d4a574]/30 hover:shadow-lg hover:shadow-[#d4a574]/5 transition-all duration-300 ${isProcessing ? 'opacity-50' : ''}`}>
        {/* Header */}
        <div className="p-5">
          <div className="flex items-start gap-4">
            <div className={`p-3 ${colors.icon} rounded-xl`}>
              <Icon className={`w-5 h-5 ${colors.text}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${colors.text} ${colors.bg}`}>
                  {item.type}
                </span>
                {item.code && (
                  <button
                    onClick={() => copyCode(item.code!)}
                    className="flex items-center gap-1 px-2 py-1 bg-[#2a2a2a] rounded-lg text-xs font-mono text-[#d4a574] hover:bg-[#333] transition-colors group"
                    title="Click to copy WhatsApp command"
                  >
                    <Hash className="w-3 h-3" />
                    {item.code}
                    {copiedCode === item.code ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </button>
                )}
                <span className="text-xs text-[#666666]">
                  {new Date(item.modifiedAt).toLocaleString()}
                </span>
              </div>
              <h3 className="font-semibold text-white mb-1">{item.subject || 'Untitled'}</h3>

              {/* Recipient */}
              {(item.emailTo || item.frontmatter?.reply_to) && (
                <div className="mt-2 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#666666]" />
                  <span className="text-sm text-[#a0a0a0]">
                    To: <span className="text-white">{item.emailTo || item.frontmatter?.reply_to}</span>
                  </span>
                </div>
              )}
            </div>

            {showActions && (
              <div className="flex flex-row sm:flex-col gap-2 mt-2 sm:mt-0">
                <button
                  onClick={() => handleApprove(item)}
                  disabled={isProcessing}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-xl font-medium hover:bg-emerald-500/30 transition-colors border border-emerald-500/30 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Approve
                </button>
                <button
                  onClick={() => handleReject(item)}
                  disabled={isProcessing}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 rounded-xl font-medium hover:bg-red-500/20 transition-colors border border-red-500/20 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <X className="w-4 h-4" />
                  )}
                  Reject
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Message Body Section */}
        <div className="border-t border-[#1f1f1f]">
          <button
            onClick={() => setExpandedId(isExpanded ? null : item.id)}
            className="w-full px-5 py-3 flex items-center justify-between text-sm text-[#a0a0a0] hover:bg-[#1a1a1a] transition-colors"
          >
            <span className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              {isExpanded ? 'Hide Message Body' : 'View Message Body'}
            </span>
            <span className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>

          {isExpanded && (
            <div className="px-5 pb-5">
              <div className="bg-[#0d0d0d] rounded-lg p-4 border border-[#2a2a2a]">
                <div className="text-xs text-[#666666] mb-2 uppercase tracking-wide">Message that will be sent:</div>
                <div className="text-white whitespace-pre-wrap font-mono text-sm leading-relaxed">
                  {item.emailBody || item.preview || 'No message body found'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] p-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center">
              <Loader2 className="w-12 h-12 animate-spin text-[#d4a574] mb-4" />
              <p className="text-[#a0a0a0]">Loading approval queue...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-6">
      <div className="max-w-5xl mx-auto">
        {/* Back to Dashboard */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[#a0a0a0] hover:text-[#d4a574] transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#d4a574] to-[#b8956a] flex items-center justify-center shadow-lg shadow-[#d4a574]/20 shrink-0">
                <Clock className="w-7 h-7 text-black" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                  Approval Queue
                  <Sparkles className="w-5 h-5 text-[#d4a574]" />
                </h1>
                <p className="text-sm text-[#a0a0a0]">Human-in-the-loop decisions for your AI Employee</p>
              </div>
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-[#161616] rounded-xl text-sm font-medium text-[#a0a0a0] hover:text-[#d4a574] hover:border-[#d4a574]/30 transition-colors border border-[#1f1f1f]"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Sent Notice */}
        {sentNotice && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <span className="text-emerald-400">{sentNotice}</span>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <span className="text-red-400">Error: {error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-400 hover:text-red-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* WhatsApp Info */}
        <div className="bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 rounded-xl p-4 border border-emerald-500/20 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <Smartphone className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-white">WhatsApp Approvals Enabled</h3>
              <p className="text-sm text-[#a0a0a0]">
                Reply to notifications with &quot;approve CODE&quot; or &quot;reject CODE&quot; to approve/reject from WhatsApp
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-emerald-400 font-medium">Quick Commands</p>
              <p className="text-xs text-[#666666]">list | status | help</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#161616] rounded-xl p-4 border border-[#d4a574]/20">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#d4a574]/20 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-[#d4a574]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#d4a574]">{stats?.pending || pendingApprovals.length}</p>
                <p className="text-sm text-[#a0a0a0]">Pending</p>
              </div>
            </div>
          </div>
          <div className="bg-[#161616] rounded-xl p-4 border border-emerald-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-400">{stats?.approvedToday || approvedItems.length}</p>
                <p className="text-sm text-[#a0a0a0]">Approved Today</p>
              </div>
            </div>
          </div>
          <div className="bg-[#161616] rounded-xl p-4 border border-red-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <XCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-400">{stats?.rejectedToday || rejectedItems.length}</p>
                <p className="text-sm text-[#a0a0a0]">Rejected Today</p>
              </div>
            </div>
          </div>
          <div className="bg-[#161616] rounded-xl p-4 border border-blue-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Bot className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-400">{stats?.completedToday || 0}</p>
                <p className="text-sm text-[#a0a0a0]">Completed Today</p>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="bg-[#111111] rounded-2xl border border-[#1f1f1f] p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#d4a574]/20 rounded-lg">
                <Clock className="w-5 h-5 text-[#d4a574]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Pending Approvals</h2>
                <p className="text-sm text-[#666666]">Actions awaiting your review</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-[#d4a574]/20 text-[#d4a574] rounded-full text-sm font-medium border border-[#d4a574]/30">
              {pendingApprovals.length} items
            </span>
          </div>

          {pendingApprovals.length === 0 ? (
            <div className="text-center py-12">
              <Bot className="w-16 h-16 mx-auto text-[#2a2a2a] mb-4" />
              <h3 className="text-lg font-medium text-[#a0a0a0] mb-2">All Clear!</h3>
              <p className="text-[#666666]">No items pending approval at this time.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingApprovals.map((item) => (
                <ApprovalCard key={item.id} item={item} showActions={true} />
              ))}
            </div>
          )}
        </div>

        {/* Recent Approved */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#111111] rounded-2xl border border-[#1f1f1f] p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Recently Approved</h2>
                <p className="text-sm text-[#666666]">Items you approved</p>
              </div>
            </div>

            {approvedItems.length === 0 ? (
              <p className="text-center text-[#666666] py-8">No approved items yet</p>
            ) : (
              <div className="space-y-3">
                {approvedItems.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-4 bg-[#161616] rounded-xl hover:border-[#d4a574]/20 border border-[#1f1f1f] transition-colors"
                  >
                    <div className="p-2 bg-emerald-500/20 rounded-lg">
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">{item.subject || item.filename}</p>
                      <p className="text-xs text-[#666666]">{new Date(item.modifiedAt).toLocaleString()}</p>
                    </div>
                    <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-medium">
                      Approved
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Rejected */}
          <div className="bg-[#111111] rounded-2xl border border-[#1f1f1f] p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <XCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Recently Rejected</h2>
                <p className="text-sm text-[#666666]">Items you rejected</p>
              </div>
            </div>

            {rejectedItems.length === 0 ? (
              <p className="text-center text-[#666666] py-8">No rejected items yet</p>
            ) : (
              <div className="space-y-3">
                {rejectedItems.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-4 bg-[#161616] rounded-xl hover:border-[#d4a574]/20 border border-[#1f1f1f] transition-colors"
                  >
                    <div className="p-2 bg-red-500/20 rounded-lg">
                      <XCircle className="w-4 h-4 text-red-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">{item.subject || item.filename}</p>
                      <p className="text-xs text-[#666666]">{new Date(item.modifiedAt).toLocaleString()}</p>
                    </div>
                    <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded-full text-xs font-medium">
                      Rejected
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
