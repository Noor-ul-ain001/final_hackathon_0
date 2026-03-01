'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  HelpCircle,
  BookOpen,
  MessageSquare,
  LifeBuoy,
  Search,
  ExternalLink,
  ChevronRight,
  Star,
  Clock,
  User,
  Mail,
  Phone,
  FileText,
  Bot,
  ArrowLeft,
  X,
  CheckCircle,
  Loader2,
  AlertTriangle
} from 'lucide-react';

interface HelpArticle {
  id: string;
  title: string;
  description: string;
  category: string;
  readTime: string;
  likes: number;
  content: string;
}

interface SupportTicket {
  id: string;
  title: string;
  status: 'open' | 'in-progress' | 'resolved';
  priority: 'low' | 'medium' | 'high';
  date: string;
}

// Static real articles — documentation doesn't need to be dynamic
const ARTICLES: HelpArticle[] = [
  {
    id: '1',
    title: 'Getting Started with AI Employee',
    description: 'How to set up and configure your AI Employee for optimal performance',
    category: 'Setup',
    readTime: '5 min',
    likes: 24,
    content: 'Clone the repo, copy .env.example to .env, fill in your API credentials, then run python start_watchers.py to launch all watchers.'
  },
  {
    id: '2',
    title: 'Understanding the Approval Workflow',
    description: 'How to manage approval processes — approve or reject from the dashboard or WhatsApp',
    category: 'Workflows',
    readTime: '8 min',
    likes: 18,
    content: 'All AI actions go through Pending_Approval. You can approve/reject from the Approvals page, or reply to a WhatsApp notification with "approve CODE" or "reject CODE".'
  },
  {
    id: '3',
    title: 'Setting Up Gmail Integration',
    description: 'Step-by-step guide to connect your Gmail account with AI Employee',
    category: 'Setup',
    readTime: '10 min',
    likes: 32,
    content: 'Go to Google Cloud Console, create a project, enable Gmail API, download credentials.json and place it at mcp/email-mcp/credentials.json. Run gmail_watcher.py once to authorise.'
  },
  {
    id: '4',
    title: 'Configuring Social Media Posting',
    description: 'Connect Twitter, LinkedIn, Facebook, and Instagram for automated posting',
    category: 'Integration',
    readTime: '12 min',
    likes: 21,
    content: 'Set TWITTER_API_KEY, LINKEDIN_ACCESS_TOKEN, FACEBOOK_ACCESS_TOKEN, INSTAGRAM_ACCESS_TOKEN in your .env file. Use the Quick Actions panel to generate and post content.'
  },
  {
    id: '5',
    title: 'Odoo ERP Integration',
    description: 'Connect Odoo Community Edition for invoices, payments, and accounting',
    category: 'Integration',
    readTime: '9 min',
    likes: 15,
    content: 'Run Odoo with docker-compose up -d, create a database named ai_employee, set ODOO_PASSWORD in .env. The Odoo watcher monitors invoices and triggers CEO briefings.'
  },
  {
    id: '6',
    title: 'Troubleshooting Common Issues',
    description: 'Solutions to frequently encountered problems with watchers and API connections',
    category: 'Troubleshooting',
    readTime: '6 min',
    likes: 42,
    content: 'Gmail auth fail: delete token.json and re-run gmail_watcher.py. MCP not loading: check paths in mcp.json match your directory. Odoo refused: wait 30s for Docker boot.'
  },
  {
    id: '7',
    title: 'Security Best Practices',
    description: 'Keep your AI Employee and credentials secure',
    category: 'Security',
    readTime: '7 min',
    likes: 28,
    content: 'Never commit .env to git. Use long-lived tokens for social APIs. Set ODOO_PASSWORD in .env, not in mcp.json. Rotate tokens every 60 days for Facebook/Instagram.'
  },
  {
    id: '8',
    title: 'CEO Briefing & Weekly Audit',
    description: 'How the automated CEO briefing system works and how to trigger it manually',
    category: 'Workflows',
    readTime: '5 min',
    likes: 19,
    content: 'The briefing runs every Saturday at 8 PM (configurable via CEO_BRIEFING_DAY and CEO_BRIEFING_HOUR in .env). Trigger manually from the Briefings page or run python ceo_briefing_generator.py.'
  }
];

const CATEGORIES = ['All', 'Setup', 'Workflows', 'Integration', 'Troubleshooting', 'Security'];

// Static representative tickets (real tickets live in AI_Employee_Vault)
const STATIC_TICKETS: SupportTicket[] = [
  {
    id: '1',
    title: 'Gmail watcher stops after token expiry',
    status: 'resolved',
    priority: 'high',
    date: '2026-02-18'
  },
  {
    id: '2',
    title: 'LinkedIn post not appearing after approval',
    status: 'in-progress',
    priority: 'medium',
    date: '2026-02-20'
  },
  {
    id: '3',
    title: 'Odoo invoice sync taking too long',
    status: 'open',
    priority: 'low',
    date: '2026-02-21'
  }
];

export default function HelpPage() {
  const [activeTab, setActiveTab] = useState<'articles' | 'support' | 'contact'>('articles');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null);

  // New ticket modal state
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketTitle, setTicketTitle] = useState('');
  const [ticketDesc, setTicketDesc] = useState('');
  const [ticketPriority, setTicketPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [ticketStatus, setTicketStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [tickets, setTickets] = useState<SupportTicket[]>(STATIC_TICKETS);

  // Filter articles by search query AND category
  const filteredArticles = ARTICLES.filter(article => {
    const matchesSearch =
      searchQuery.trim() === '' ||
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.content.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      activeCategory === 'All' || article.category === activeCategory;

    return matchesSearch && matchesCategory;
  });

  const submitTicket = async () => {
    if (!ticketTitle.trim()) return;
    setTicketStatus('submitting');
    setTicketError(null);

    try {
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_task',
          title: `[Support] ${ticketTitle.trim()}`,
          description: ticketDesc.trim() || 'No description provided.',
          priority: ticketPriority,
        }),
      });

      const data = await res.json();

      if (data.success || res.ok) {
        const newTicket: SupportTicket = {
          id: Date.now().toString(),
          title: ticketTitle.trim(),
          status: 'open',
          priority: ticketPriority,
          date: new Date().toISOString().split('T')[0]
        };
        setTickets(prev => [newTicket, ...prev]);
        setTicketStatus('success');
        setTicketTitle('');
        setTicketDesc('');
        setTimeout(() => {
          setShowTicketModal(false);
          setTicketStatus('idle');
        }, 1500);
      } else {
        setTicketStatus('error');
        setTicketError(data.error || 'Failed to submit ticket');
      }
    } catch (err) {
      console.error('Failed to submit ticket:', err);
      setTicketStatus('error');
      setTicketError(err instanceof Error ? err.message : 'Network error');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
      case 'in-progress': return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
      case 'resolved': return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500/20 text-red-400 border border-red-500/30';
      case 'medium': return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
      case 'low': return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 sm:p-6">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-[#a0a0a0] hover:text-[#d4a574] transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#d4a574] to-[#b8956a] flex items-center justify-center shadow-lg shadow-[#d4a574]/20 shrink-0">
            <HelpCircle className="w-7 h-7 text-black" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Help Center</h1>
            <p className="text-sm text-[#a0a0a0]">Find answers and get support for AI Employee</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#666]" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search help articles..."
            className="w-full bg-[#161616] border border-[#1f1f1f] rounded-xl pl-12 pr-10 py-3 text-white placeholder-[#666] focus:outline-none focus:ring-2 focus:ring-[#d4a574]/50 focus:border-[#d4a574] transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#666] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {searchQuery && (
          <p className="text-xs text-[#666] mt-1 pl-1">
            {filteredArticles.length} result{filteredArticles.length !== 1 ? 's' : ''} for &quot;{searchQuery}&quot;
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[#111111] p-1 rounded-xl border border-[#1f1f1f]">
        {(['articles', 'support', 'contact'] as const).map(tab => (
          <button
            key={tab}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab ? 'bg-[#d4a574] text-black' : 'text-[#a0a0a0] hover:text-white'
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'articles' && <BookOpen className="w-4 h-4" />}
            {tab === 'support' && <LifeBuoy className="w-4 h-4" />}
            {tab === 'contact' && <MessageSquare className="w-4 h-4" />}
            <span className="hidden sm:inline">
              {tab === 'articles' ? 'Knowledge Base' : tab === 'support' ? 'Support Tickets' : 'Contact Us'}
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2">

          {/* Knowledge Base */}
          {activeTab === 'articles' && (
            <div className="bg-[#111111] rounded-2xl border border-[#1f1f1f] p-6">
              {/* Category filter */}
              <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <h2 className="text-lg font-semibold text-white">Knowledge Base</h2>
                <div className="flex gap-1 flex-wrap">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                        activeCategory === cat
                          ? 'bg-[#d4a574]/20 text-[#d4a574] border-[#d4a574]/30'
                          : 'bg-[#161616] text-[#a0a0a0] border-[#1f1f1f] hover:text-white'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {filteredArticles.length === 0 ? (
                <div className="text-center py-12">
                  <Search className="w-12 h-12 mx-auto text-[#2a2a2a] mb-3" />
                  <p className="text-[#a0a0a0]">No articles match your search</p>
                  <button
                    onClick={() => { setSearchQuery(''); setActiveCategory('All'); }}
                    className="mt-3 text-sm text-[#d4a574] hover:underline"
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredArticles.map(article => (
                    <div
                      key={article.id}
                      className="bg-[#161616] rounded-xl border border-[#1f1f1f] hover:border-[#d4a574]/30 transition-colors overflow-hidden"
                    >
                      <button
                        className="w-full p-5 text-left"
                        onClick={() => setExpandedArticle(expandedArticle === article.id ? null : article.id)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h3 className="font-semibold text-white text-sm">{article.title}</h3>
                              <ChevronRight
                                className={`w-4 h-4 text-[#666] shrink-0 transition-transform ${expandedArticle === article.id ? 'rotate-90' : ''}`}
                              />
                            </div>
                            <p className="text-xs text-[#a0a0a0] mb-2">{article.description}</p>
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="text-xs px-2 py-0.5 bg-[#1f1f1f] text-[#666] rounded-full">
                                {article.category}
                              </span>
                              <span className="text-xs text-[#666] flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {article.readTime}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-[#666] shrink-0">
                            <Star className="w-3.5 h-3.5" />
                            <span className="text-xs">{article.likes}</span>
                          </div>
                        </div>
                      </button>
                      {expandedArticle === article.id && (
                        <div className="px-5 pb-5 border-t border-[#1f1f1f]">
                          <p className="text-sm text-[#a0a0a0] leading-relaxed pt-4">
                            {article.content}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Support Tickets */}
          {activeTab === 'support' && (
            <div className="bg-[#111111] rounded-2xl border border-[#1f1f1f] p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-white">Support Tickets</h2>
                <button
                  onClick={() => { setShowTicketModal(true); setTicketStatus('idle'); setTicketError(null); }}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#d4a574] to-[#b8956a] text-black rounded-xl font-medium text-sm hover:shadow-lg hover:shadow-[#d4a574]/25 transition-all"
                >
                  <MessageSquare className="w-4 h-4" />
                  New Ticket
                </button>
              </div>

              <div className="space-y-3">
                {tickets.map(ticket => (
                  <div
                    key={ticket.id}
                    className="p-4 bg-[#161616] rounded-xl border border-[#1f1f1f] hover:border-[#d4a574]/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-white text-sm mb-2">{ticket.title}</h3>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                            {ticket.status}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(ticket.priority)}`}>
                            {ticket.priority}
                          </span>
                          <span className="text-xs text-[#666]">{ticket.date}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#666] shrink-0 mt-1" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contact */}
          {activeTab === 'contact' && (
            <div className="bg-[#111111] rounded-2xl border border-[#1f1f1f] p-6">
              <h2 className="text-lg font-semibold text-white mb-6">Contact Support</h2>
              <div className="space-y-4">
                {[
                  {
                    icon: <Mail className="w-6 h-6 text-[#d4a574]" />,
                    title: 'Email Support',
                    desc: 'Get help via email with detailed responses',
                    cta: 'Contact us',
                    href: 'mailto:noor01mk@gmail.com'
                  },
                  {
                    icon: <Phone className="w-6 h-6 text-[#d4a574]" />,
                    title: 'GitHub Issues',
                    desc: 'Report bugs or request features on GitHub',
                    cta: 'Open an issue',
                    href: 'https://github.com/Noor-ul-ain001/hackathon1/issues'
                  },
                  {
                    icon: <Bot className="w-6 h-6 text-[#d4a574]" />,
                    title: 'Claude Code',
                    desc: 'Ask Claude Code directly — it can diagnose and fix issues in the repo',
                    cta: 'Use Claude Code',
                    href: 'https://claude.ai/claude-code'
                  }
                ].map(item => (
                  <div key={item.title} className="p-5 bg-[#161616] rounded-xl border border-[#1f1f1f]">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-[#d4a574]/10 rounded-xl shrink-0">
                        {item.icon}
                      </div>
                      <div>
                        <h3 className="font-semibold text-white text-sm">{item.title}</h3>
                        <p className="text-xs text-[#a0a0a0] mb-2">{item.desc}</p>
                        <a
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-[#d4a574] hover:underline flex items-center gap-1"
                        >
                          {item.cta} <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Links */}
          <div className="bg-[#111111] rounded-2xl border border-[#1f1f1f] p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-[#d4a574]/20 rounded-lg">
                <BookOpen className="w-5 h-5 text-[#d4a574]" />
              </div>
              <h2 className="text-base font-semibold text-white">Quick Links</h2>
            </div>
            <div className="space-y-2">
              {[
                { icon: FileText, label: 'GitHub Repo', href: 'https://github.com/Noor-ul-ain001/hackathon1' },
                { icon: LifeBuoy, label: 'Open Issue', href: 'https://github.com/Noor-ul-ain001/hackathon1/issues/new' },
                { icon: ExternalLink, label: 'Vercel Dashboard', href: 'https://vercel.com/dashboard' },
                { icon: User, label: 'Claude Code Docs', href: 'https://claude.ai/claude-code' },
              ].map(item => (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-[#161616] rounded-xl border border-[#1f1f1f] hover:border-[#d4a574]/30 transition-colors"
                >
                  <item.icon className="w-4 h-4 text-[#d4a574] shrink-0" />
                  <span className="text-sm font-medium text-white">{item.label}</span>
                </a>
              ))}
            </div>
          </div>

          {/* Popular Articles */}
          <div className="bg-[#111111] rounded-2xl border border-[#1f1f1f] p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <Star className="w-5 h-5 text-emerald-400" />
              </div>
              <h2 className="text-base font-semibold text-white">Popular Articles</h2>
            </div>
            <div className="space-y-2">
              {[...ARTICLES]
                .sort((a, b) => b.likes - a.likes)
                .slice(0, 3)
                .map(article => (
                  <button
                    key={article.id}
                    onClick={() => { setActiveTab('articles'); setActiveCategory('All'); setExpandedArticle(article.id); }}
                    className="w-full text-left p-3 bg-[#161616] rounded-xl border border-[#1f1f1f] hover:border-[#d4a574]/30 transition-colors"
                  >
                    <h3 className="font-medium text-white text-xs">{article.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-[#666]">{article.readTime}</span>
                      <div className="flex items-center gap-0.5 text-[#666]">
                        <Star className="w-3 h-3" />
                        <span className="text-xs">{article.likes}</span>
                      </div>
                    </div>
                  </button>
                ))}
            </div>
          </div>

          {/* Need More Help */}
          <div className="bg-gradient-to-br from-[#d4a574] to-[#b8956a] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-black/20 rounded-lg">
                <HelpCircle className="w-5 h-5 text-black" />
              </div>
              <h2 className="text-base font-semibold text-black">Need More Help?</h2>
            </div>
            <p className="text-sm text-black/80 mb-4">
              Open a support ticket and it will be added to your AI Employee vault for tracking.
            </p>
            <button
              onClick={() => { setActiveTab('support'); setShowTicketModal(true); }}
              className="w-full py-2.5 bg-black/20 rounded-xl text-sm font-medium text-black hover:bg-black/30 transition-colors"
            >
              Open a Ticket
            </button>
          </div>
        </div>
      </div>

      {/* New Ticket Modal */}
      {showTicketModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setShowTicketModal(false); }}>
          <div className="bg-[#111111] rounded-2xl border border-[#1f1f1f] p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-white">New Support Ticket</h3>
              <button onClick={() => setShowTicketModal(false)} className="p-1.5 rounded-lg hover:bg-[#1f1f1f] text-[#666] hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {ticketStatus === 'success' ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <p className="text-white font-medium">Ticket submitted!</p>
                <p className="text-sm text-[#666] mt-1">Added to your AI Employee vault</p>
              </div>
            ) : (
              <>
                {ticketError && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    <span className="text-sm text-red-400">{ticketError}</span>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-[#a0a0a0] uppercase tracking-wide mb-1 block">
                      Title *
                    </label>
                    <input
                      type="text"
                      value={ticketTitle}
                      onChange={e => setTicketTitle(e.target.value)}
                      placeholder="Brief description of the issue"
                      className="w-full bg-[#161616] border border-[#1f1f1f] rounded-xl px-4 py-2.5 text-white text-sm placeholder-[#666] focus:outline-none focus:ring-2 focus:ring-[#d4a574]/50 focus:border-[#d4a574]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-[#a0a0a0] uppercase tracking-wide mb-1 block">
                      Details
                    </label>
                    <textarea
                      value={ticketDesc}
                      onChange={e => setTicketDesc(e.target.value)}
                      placeholder="Steps to reproduce, expected vs actual behaviour..."
                      rows={3}
                      className="w-full bg-[#161616] border border-[#1f1f1f] rounded-xl px-4 py-2.5 text-white text-sm placeholder-[#666] focus:outline-none focus:ring-2 focus:ring-[#d4a574]/50 focus:border-[#d4a574] resize-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-[#a0a0a0] uppercase tracking-wide mb-1 block">
                      Priority
                    </label>
                    <div className="flex gap-2">
                      {(['low', 'medium', 'high'] as const).map(p => (
                        <button
                          key={p}
                          onClick={() => setTicketPriority(p)}
                          className={`flex-1 py-2 rounded-xl text-sm font-medium capitalize border transition-colors ${
                            ticketPriority === p
                              ? p === 'high' ? 'bg-red-500/20 text-red-400 border-red-500/30'
                                : p === 'medium' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                              : 'bg-[#161616] text-[#666] border-[#1f1f1f] hover:text-white'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setShowTicketModal(false)}
                      className="flex-1 py-2.5 bg-[#161616] border border-[#1f1f1f] rounded-xl text-sm font-medium text-[#a0a0a0] hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={submitTicket}
                      disabled={!ticketTitle.trim() || ticketStatus === 'submitting'}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-[#d4a574] to-[#b8956a] text-black rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-[#d4a574]/25 transition-all disabled:opacity-50"
                    >
                      {ticketStatus === 'submitting' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : null}
                      {ticketStatus === 'submitting' ? 'Submitting...' : 'Submit Ticket'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
