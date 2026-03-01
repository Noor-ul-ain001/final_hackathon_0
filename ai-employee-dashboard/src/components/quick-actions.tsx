"use client";

import { useState } from "react";
import {
  Twitter,
  Linkedin,
  Mail,
  FileText,
  DollarSign,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Save,
  Copy,
  Sparkles,
  Search,
  Check
} from "lucide-react";

type ActionType = 'twitter' | 'linkedin' | 'email' | 'briefing' | 'audit' | 'task' | null;

interface GeneratedContent {
  platform?: string;
  content: string;
  hashtags?: string[];
  subject?: string;
  recipient?: string;
  filename?: string;
  topic?: string;
}

export function QuickActions() {
  const [activeAction, setActiveAction] = useState<ActionType>(null);
  const [loading, setLoading] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [postType, setPostType] = useState('insight');
  const [topic, setTopic] = useState('');
  const [approving, setApproving] = useState(false);

  // Clear messages after timeout
  const clearMessages = () => {
    setTimeout(() => {
      setError(null);
      setSuccess(null);
    }, 5000);
  };

  // Generate social media post
  const handleGeneratePost = async (platform: 'twitter' | 'linkedin') => {
    setActiveAction(platform);
    setLoading(true);
    setError(null);
    setGeneratedContent(null);

    try {
      const res = await fetch('/api/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          platform,
          postType,
          topic: topic.trim() || undefined
        })
      });

      const data = await res.json();

      if (data.success) {
        setGeneratedContent({
          platform,
          content: data.generated.content,
          hashtags: data.generated.hashtags,
          topic: data.topic
        });
      } else {
        setError(data.message || 'Failed to generate post');
        clearMessages();
      }
    } catch {
      setError('Failed to generate post');
      clearMessages();
    } finally {
      setLoading(false);
    }
  };

  // Regenerate with different template
  const handleRegenerate = async () => {
    if (!generatedContent?.platform) return;

    setLoading(true);
    try {
      const res = await fetch('/api/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'regenerate',
          platform: generatedContent.platform,
          postType,
          topic: topic.trim() || generatedContent.topic || undefined
        })
      });

      const data = await res.json();

      if (data.success) {
        setGeneratedContent({
          platform: generatedContent.platform,
          content: data.generated.content,
          hashtags: data.generated.hashtags,
          topic: data.topic
        });
      }
    } catch {
      setError('Failed to regenerate');
      clearMessages();
    } finally {
      setLoading(false);
    }
  };

  // Save as draft for approval
  const handleSaveDraft = async () => {
    if (!generatedContent) return;

    setLoading(true);
    try {
      const res = await fetch('/api/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'draft',
          platform: generatedContent.platform,
          content: generatedContent.content,
          hashtags: generatedContent.hashtags
        })
      });

      const data = await res.json();

      if (data.success) {
        // Keep the modal open and show the filename for approval
        setGeneratedContent({
          ...generatedContent,
          filename: data.filename
        });
        setSuccess(`Draft saved: ${data.filename}`);
        clearMessages();
      } else {
        setError(data.message);
        clearMessages();
      }
    } catch {
      setError('Failed to save draft');
      clearMessages();
    } finally {
      setLoading(false);
    }
  };

  // Approve the draft
  const handleApprove = async () => {
    if (!generatedContent?.filename) {
      setError('Please save as draft first');
      clearMessages();
      return;
    }

    setApproving(true);
    try {
      const res = await fetch('/api/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          filename: generatedContent.filename
        })
      });

      const data = await res.json();

      if (data.success) {
        setSuccess('Post approved and ready for publishing!');
        setGeneratedContent(null);
        setActiveAction(null);
        setTopic('');
        clearMessages();
      } else {
        setError(data.message);
        clearMessages();
      }
    } catch {
      setError('Failed to approve');
      clearMessages();
    } finally {
      setApproving(false);
    }
  };

  // Post immediately to the platform
  const handlePostNow = async () => {
    if (!generatedContent?.content) {
      setError('No content to post');
      clearMessages();
      return;
    }

    setApproving(true);
    try {
      const res = await fetch('/api/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'post_now',
          platform: generatedContent.platform,
          content: generatedContent.content,
          hashtags: generatedContent.hashtags
        })
      });

      const data = await res.json();

      if (data.success) {
        const message = data.simulated
          ? 'Post simulated (configure API credentials for live posting)'
          : `Posted to ${generatedContent.platform} successfully!`;
        setSuccess(data.url ? `${message} View: ${data.url}` : message);
        setGeneratedContent(null);
        setActiveAction(null);
        setTopic('');
        clearMessages();
      } else {
        setError(data.message || 'Failed to post');
        clearMessages();
      }
    } catch {
      setError('Failed to post');
      clearMessages();
    } finally {
      setApproving(false);
    }
  };

  // Copy to clipboard
  const handleCopy = () => {
    if (generatedContent?.content) {
      navigator.clipboard.writeText(generatedContent.content);
      setSuccess('Copied to clipboard');
      clearMessages();
    }
  };

  // Generate CEO Briefing
  const handleGenerateBriefing = async () => {
    setActiveAction('briefing');
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_briefing' })
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(`Briefing generated: ${data.filename || 'CEO Briefing'}`);
        clearMessages();
      } else {
        setError(data.message);
        clearMessages();
      }
    } catch {
      setError('Failed to generate briefing');
      clearMessages();
    } finally {
      setLoading(false);
      setActiveAction(null);
    }
  };

  // Generate Email Draft
  const handleGenerateEmail = async () => {
    setActiveAction('email');
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_email',
          type: 'reply',
          style: 'professional',
          recipient: '[Recipient Name]',
          subject: '[Subject]',
          context: ''
        })
      });

      const data = await res.json();

      if (data.success) {
        setGeneratedContent({
          content: data.draft,
          subject: '[Subject]',
          recipient: '[Recipient Name]'
        });
      } else {
        setError(data.message);
        clearMessages();
      }
    } catch {
      setError('Failed to generate email');
      clearMessages();
    } finally {
      setLoading(false);
    }
  };

  // Run Subscription Audit
  const handleSubscriptionAudit = async () => {
    setActiveAction('audit');
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'subscription_audit' })
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(`Audit generated: ${data.filename}`);
        clearMessages();
      } else {
        setError(data.message);
        clearMessages();
      }
    } catch {
      setError('Failed to run audit');
      clearMessages();
    } finally {
      setLoading(false);
      setActiveAction(null);
    }
  };

  // Close modal
  const handleClose = () => {
    setActiveAction(null);
    setGeneratedContent(null);
    setError(null);
  };

  return (
    <div className="bg-[#111111] p-6 rounded-2xl border border-[#1f1f1f]">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-[#d4a574]" />
        <h3 className="font-semibold text-white">Quick Actions</h3>
        <span className="text-xs text-[#666] ml-auto">AI-Powered</span>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span className="text-sm text-emerald-400">{success}</span>
        </div>
      )}

      {error && !generatedContent && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-sm text-red-400">{error}</span>
        </div>
      )}

      {/* Topic Search Field */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666]" />
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Enter topic for AI posts (e.g., AI, productivity, marketing...)"
            className="w-full pl-10 pr-4 py-3 bg-[#0a0a0a] border border-[#1f1f1f] rounded-xl text-white placeholder-[#666] focus:outline-none focus:border-[#d4a574] transition-colors"
          />
          {topic && (
            <button
              onClick={() => setTopic('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-[#1f1f1f] rounded"
            >
              <X className="w-4 h-4 text-[#666]" />
            </button>
          )}
        </div>
        {topic && (
          <p className="text-xs text-[#d4a574] mt-2 ml-1">
            Posts will be generated about: <span className="font-medium">{topic}</span>
          </p>
        )}
      </div>

      {/* Action Buttons Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {/* Twitter Post */}
        <button
          onClick={() => handleGeneratePost('twitter')}
          disabled={loading}
          className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[#0a0a0a] border border-[#1f1f1f] hover:border-[#1DA1F2]/50 hover:bg-[#1DA1F2]/5 transition-all duration-200 group disabled:opacity-50"
        >
          {loading && activeAction === 'twitter' ? (
            <Loader2 className="w-6 h-6 text-[#1DA1F2] animate-spin" />
          ) : (
            <Twitter className="w-6 h-6 text-[#1DA1F2] group-hover:scale-110 transition-transform" />
          )}
          <span className="text-xs text-[#a0a0a0] group-hover:text-white">Post to X</span>
        </button>

        {/* LinkedIn Post */}
        <button
          onClick={() => handleGeneratePost('linkedin')}
          disabled={loading}
          className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[#0a0a0a] border border-[#1f1f1f] hover:border-[#0A66C2]/50 hover:bg-[#0A66C2]/5 transition-all duration-200 group disabled:opacity-50"
        >
          {loading && activeAction === 'linkedin' ? (
            <Loader2 className="w-6 h-6 text-[#0A66C2] animate-spin" />
          ) : (
            <Linkedin className="w-6 h-6 text-[#0A66C2] group-hover:scale-110 transition-transform" />
          )}
          <span className="text-xs text-[#a0a0a0] group-hover:text-white">Post to LinkedIn</span>
        </button>

        {/* Email Draft */}
        <button
          onClick={handleGenerateEmail}
          disabled={loading}
          className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[#0a0a0a] border border-[#1f1f1f] hover:border-[#d4a574]/50 hover:bg-[#d4a574]/5 transition-all duration-200 group disabled:opacity-50"
        >
          {loading && activeAction === 'email' ? (
            <Loader2 className="w-6 h-6 text-[#d4a574] animate-spin" />
          ) : (
            <Mail className="w-6 h-6 text-[#d4a574] group-hover:scale-110 transition-transform" />
          )}
          <span className="text-xs text-[#a0a0a0] group-hover:text-white">Draft Email</span>
        </button>

        {/* CEO Briefing */}
        <button
          onClick={handleGenerateBriefing}
          disabled={loading}
          className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[#0a0a0a] border border-[#1f1f1f] hover:border-purple-500/50 hover:bg-purple-500/5 transition-all duration-200 group disabled:opacity-50"
        >
          {loading && activeAction === 'briefing' ? (
            <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
          ) : (
            <FileText className="w-6 h-6 text-purple-400 group-hover:scale-110 transition-transform" />
          )}
          <span className="text-xs text-[#a0a0a0] group-hover:text-white">CEO Briefing</span>
        </button>

        {/* Subscription Audit */}
        <button
          onClick={handleSubscriptionAudit}
          disabled={loading}
          className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[#0a0a0a] border border-[#1f1f1f] hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all duration-200 group disabled:opacity-50"
        >
          {loading && activeAction === 'audit' ? (
            <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
          ) : (
            <DollarSign className="w-6 h-6 text-emerald-400 group-hover:scale-110 transition-transform" />
          )}
          <span className="text-xs text-[#a0a0a0] group-hover:text-white">Audit Subs</span>
        </button>

        {/* Create Task */}
        <button
          onClick={() => setActiveAction('task')}
          disabled={loading}
          className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[#0a0a0a] border border-[#1f1f1f] hover:border-amber-500/50 hover:bg-amber-500/5 transition-all duration-200 group disabled:opacity-50"
        >
          <Plus className="w-6 h-6 text-amber-400 group-hover:scale-110 transition-transform" />
          <span className="text-xs text-[#a0a0a0] group-hover:text-white">Create Task</span>
        </button>
      </div>

      {/* Generated Content Modal */}
      {generatedContent && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-[#111111] rounded-2xl border border-[#1f1f1f] max-w-2xl w-full my-auto flex flex-col max-h-[95vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#1f1f1f] flex-shrink-0">
              <div className="flex items-center gap-3">
                {generatedContent.platform === 'twitter' && <Twitter className="w-5 h-5 text-[#1DA1F2]" />}
                {generatedContent.platform === 'linkedin' && <Linkedin className="w-5 h-5 text-[#0A66C2]" />}
                {activeAction === 'email' && <Mail className="w-5 h-5 text-[#d4a574]" />}
                <span className="font-semibold text-white">
                  {generatedContent.platform ? `${generatedContent.platform.charAt(0).toUpperCase() + generatedContent.platform.slice(1)} Post` : 'Email Draft'}
                </span>
              </div>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-[#1f1f1f] rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-[#666]" />
              </button>
            </div>

            {/* Post Type Selector and Topic Display (for social) */}
            {generatedContent.platform && (
              <div className="p-4 border-b border-[#1f1f1f] flex-shrink-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div className="flex gap-2 flex-wrap">
                    {['insight', 'engagement', 'promotional'].map(type => (
                      <button
                        key={type}
                        onClick={() => setPostType(type)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          postType === type
                            ? 'bg-[#d4a574] text-black'
                            : 'bg-[#1f1f1f] text-[#a0a0a0] hover:text-white'
                        }`}
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    ))}
                  </div>
                  {generatedContent.topic && (
                    <span className="text-xs text-[#666] text-center sm:text-right">
                      Topic: <span className="text-[#d4a574]">{generatedContent.topic}</span>
                    </span>
                  )}
                </div>

                {/* Status indicator */}
                {generatedContent.filename && (
                  <div className="flex items-center gap-2 p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs text-emerald-400">
                      Draft saved: {generatedContent.filename}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Content */}
            <div className="p-4 overflow-y-auto flex-1 min-h-0">
              <div className="bg-[#0a0a0a] rounded-xl p-4 border border-[#1f1f1f]">
                <pre className="whitespace-pre-wrap text-sm text-[#e0e0e0] font-sans">
                  {generatedContent.content}
                </pre>
              </div>

              {/* Hashtags */}
              {generatedContent.hashtags && generatedContent.hashtags.length > 0 && (
                <div className="mt-4">
                  <span className="text-xs text-[#666] mb-2 block">Hashtags:</span>
                  <div className="flex gap-2 flex-wrap">
                    {generatedContent.hashtags.map((tag, i) => (
                      <span key={i} className="px-2 py-1 bg-[#1f1f1f] rounded text-xs text-[#d4a574]">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Character count for Twitter */}
              {generatedContent.platform === 'twitter' && (
                <div className="mt-4 flex items-center gap-2">
                  <span className={`text-xs ${generatedContent.content.length > 280 ? 'text-red-400' : 'text-[#666]'}`}>
                    {generatedContent.content.length} / 280 characters
                  </span>
                  {generatedContent.content.length > 280 && (
                    <AlertCircle className="w-4 h-4 text-red-400" />
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-[#1f1f1f] flex-shrink-0">
              {/* Top row - utility actions */}
              <div className="flex flex-col sm:flex-row gap-3 mb-3">
                <button
                  onClick={handleRegenerate}
                  disabled={loading || approving}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#1f1f1f] text-[#a0a0a0] hover:text-white transition-colors disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Regenerate
                </button>

                <button
                  onClick={handleCopy}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#1f1f1f] text-[#a0a0a0] hover:text-white transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  Copy
                </button>
              </div>

              {/* Bottom row - main actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                {!generatedContent.filename ? (
                  // Show Save button if not saved yet
                  <button
                    onClick={handleSaveDraft}
                    disabled={loading || approving}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-[#1f1f1f] border border-[#2a2a2a] text-white font-medium hover:border-[#d4a574]/30 transition-colors disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Draft
                  </button>
                ) : (
                  // Show saved status
                  <div className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-[#1f1f1f] border border-emerald-500/30 text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    Draft Saved
                  </div>
                )}

                {/* Approve Button */}
                <button
                  onClick={handleApprove}
                  disabled={loading || approving || !generatedContent.filename}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                    generatedContent.filename
                      ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white shadow-lg shadow-emerald-900/20'
                      : 'bg-[#1f1f1f] text-[#666] cursor-not-allowed'
                  } disabled:opacity-50`}
                >
                  {approving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  {approving ? 'Processing...' : 'Approve'}
                </button>
              </div>

              {/* Post Now Button - Direct posting with gold theme */}
              <div className="mt-3">
                <button
                  onClick={handlePostNow}
                  disabled={loading || approving}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-semibold text-base transition-all duration-300 bg-gradient-to-r from-[#d4a574] to-[#b8956a] hover:from-[#e8c9a0] hover:to-[#d4a574] text-black shadow-lg shadow-[#d4a574]/20 hover:shadow-[#d4a574]/40 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  {approving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : generatedContent.platform === 'twitter' ? (
                    <Twitter className="w-5 h-5" />
                  ) : (
                    <Linkedin className="w-5 h-5" />
                  )}
                  {approving ? 'Posting...' : `Post to ${generatedContent.platform === 'twitter' ? 'X' : 'LinkedIn'} Now`}
                </button>
              </div>

              {/* Help text */}
              <p className="text-xs text-[#666] mt-3 text-center">
                {!generatedContent.filename
                  ? 'Save draft for later, or post directly to the platform'
                  : 'Draft saved. Post now or approve for scheduled publishing'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Task Creation Modal */}
      {activeAction === 'task' && !generatedContent && (
        <TaskModal onClose={() => setActiveAction(null)} onSuccess={(msg) => { setSuccess(msg); clearMessages(); }} />
      )}
    </div>
  );
}

// Task Creation Modal Component
function TaskModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (msg: string) => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_task',
          title,
          description,
          priority,
          source: 'dashboard'
        })
      });

      const data = await res.json();

      if (data.success) {
        onSuccess(`Task created: ${data.filename}`);
        onClose();
      } else {
        setError(data.message);
      }
    } catch {
      setError('Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#111111] rounded-2xl border border-[#1f1f1f] max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#1f1f1f]">
          <div className="flex items-center gap-3">
            <Plus className="w-5 h-5 text-amber-400" />
            <span className="font-semibold text-white">Create Task</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#1f1f1f] rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-[#666]" />
          </button>
        </div>

        {/* Form */}
        <div className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-sm text-red-400">{error}</span>
            </div>
          )}

          <div>
            <label className="block text-sm text-[#a0a0a0] mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter task title"
              className="w-full px-4 py-2 bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg text-white placeholder-[#666] focus:outline-none focus:border-[#d4a574]"
            />
          </div>

          <div>
            <label className="block text-sm text-[#a0a0a0] mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter task description"
              rows={3}
              className="w-full px-4 py-2 bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg text-white placeholder-[#666] focus:outline-none focus:border-[#d4a574] resize-none"
            />
          </div>

          <div>
            <label className="block text-sm text-[#a0a0a0] mb-2">Priority</label>
            <div className="flex gap-2">
              {(['low', 'normal', 'high', 'urgent'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    priority === p
                      ? p === 'urgent' ? 'bg-red-500 text-white'
                      : p === 'high' ? 'bg-amber-500 text-black'
                      : p === 'normal' ? 'bg-blue-500 text-white'
                      : 'bg-gray-500 text-white'
                      : 'bg-[#1f1f1f] text-[#a0a0a0] hover:text-white'
                  }`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-[#1f1f1f] flex flex-col sm:flex-row gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg bg-[#1f1f1f] text-[#a0a0a0] hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-black font-medium hover:bg-amber-400 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create Task
          </button>
        </div>
      </div>
    </div>
  );
}
