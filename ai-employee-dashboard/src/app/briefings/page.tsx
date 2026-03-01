'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  TrendingUp,
  FileText,
  Calendar,
  Bot,
  ArrowLeft,
  Sparkles,
  Download,
  AlertCircle,
  Loader2,
  RefreshCw,
  Eye
} from 'lucide-react';
import type { VaultStats, Briefing } from '@/types/vault';
import { generateBriefing } from '@/lib/api';

export default function BriefingsPage() {
  const [stats, setStats] = useState<VaultStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('weekly');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedBriefing, setGeneratedBriefing] = useState<string>('');
  const [generatedFilename, setGeneratedFilename] = useState<string>('');
  const [existingBriefings, setExistingBriefings] = useState<Briefing[]>([]);

  const templates = [
    {
      id: 'daily',
      name: 'Daily Snapshot',
      description: 'Quick daily overview of key metrics',
      period: 'Last 24 hours',
      lookbackDays: 1
    },
    {
      id: 'weekly',
      name: 'Weekly CEO Briefing',
      description: 'Comprehensive weekly business summary',
      period: 'Last 7 days',
      lookbackDays: 7
    },
    {
      id: 'monthly',
      name: 'Monthly Review',
      description: 'Detailed monthly performance review',
      period: 'Last 30 days',
      lookbackDays: 30
    }
  ];

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch vault stats
      const statsRes = await fetch('/api/vault?action=stats');
      const statsData = await statsRes.json();
      if (statsData.stats) {
        setStats(statsData.stats);
      }

      // Fetch existing briefings
      const briefingsRes = await fetch('/api/vault?action=briefings');
      const briefingsData = await briefingsRes.json();
      if (briefingsData.briefings) {
        setExistingBriefings(briefingsData.briefings);
      }

      setError(null);
    } catch (err) {
      console.error('Failed to fetch briefing data:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const template = templates.find(t => t.id === selectedTemplate);
      const result = await generateBriefing({
        lookbackDays: template?.lookbackDays || 7,
        template: selectedTemplate as 'daily' | 'weekly' | 'monthly'
      });

      if (result.success && result.content) {
        setGeneratedBriefing(result.content);
        setGeneratedFilename(result.filename || '');
        // Refresh briefings list
        fetchData();
      } else {
        setError(result.error || 'Failed to generate briefing');
      }
    } catch (err) {
      console.error('Failed to generate briefing:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate briefing');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    const element = document.createElement('a');
    const file = new Blob([generatedBriefing], { type: 'text/markdown' });
    element.href = URL.createObjectURL(file);
    element.download = generatedFilename || `CEO_Briefing_${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const viewBriefing = (briefing: Briefing) => {
    // If we have full content, show it; otherwise show preview
    setGeneratedBriefing(briefing.content || briefing.preview || '');
    setGeneratedFilename(briefing.filename);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-6">
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#d4a574] to-[#b8956a] flex items-center justify-center shadow-lg shadow-[#d4a574]/20">
              <BarChart3 className="w-7 h-7 text-black" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                CEO Briefing Generator
                <Sparkles className="w-5 h-5 text-[#d4a574]" />
              </h1>
              <p className="text-[#a0a0a0]">Monday Morning Reports & Business Insights</p>
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

      {/* Error State */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span className="text-red-400">Error: {error}</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center">
            <Loader2 className="w-12 h-12 animate-spin text-[#d4a574] mb-4" />
            <p className="text-[#a0a0a0]">Loading briefing data...</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Controls Panel */}
          <div className="lg:col-span-1 space-y-6">
            {/* Generate Briefing Card */}
            <div className="bg-[#111111] rounded-2xl border border-[#1f1f1f] p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-[#d4a574]/20 rounded-lg">
                  <Calendar className="w-5 h-5 text-[#d4a574]" />
                </div>
                <h2 className="text-lg font-semibold text-white">Generate Briefing</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#a0a0a0] mb-2">
                    Template
                  </label>
                  <select
                    className="w-full bg-[#161616] border border-[#1f1f1f] rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-[#d4a574]/50 focus:border-[#d4a574] transition-all"
                    value={selectedTemplate}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                  >
                    {templates.map(template => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-[#666] mt-1">
                    {templates.find(t => t.id === selectedTemplate)?.description}
                  </p>
                </div>

                <button
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-[#d4a574] to-[#b8956a] text-black rounded-xl font-medium hover:shadow-lg hover:shadow-[#d4a574]/25 transition-all disabled:opacity-50"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Bot className="w-5 h-5" />
                      Generate Briefing
                    </>
                  )}
                </button>

                {generatedBriefing && (
                  <div className="flex gap-2 pt-2">
                    <button
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#161616] text-[#a0a0a0] rounded-xl font-medium hover:text-white hover:border-[#d4a574]/30 border border-[#1f1f1f] transition-colors"
                      onClick={handleDownload}
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Stats Preview */}
            <div className="bg-[#111111] rounded-2xl border border-[#1f1f1f] p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">Current Stats</h2>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-[#161616] rounded-xl border border-[#1f1f1f]">
                  <span className="text-sm text-[#a0a0a0]">Needs Action</span>
                  <span className="font-bold text-[#d4a574]">{stats?.Needs_Action || 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-[#161616] rounded-xl border border-[#1f1f1f]">
                  <span className="text-sm text-[#a0a0a0]">Pending Approval</span>
                  <span className="font-bold text-amber-400">{stats?.Pending_Approval || 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-[#161616] rounded-xl border border-[#1f1f1f]">
                  <span className="text-sm text-[#a0a0a0]">Completed</span>
                  <span className="font-bold text-emerald-400">{stats?.Done || 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-[#161616] rounded-xl border border-[#1f1f1f]">
                  <span className="text-sm text-[#a0a0a0]">Failed</span>
                  <span className="font-bold text-red-400">{stats?.Failed || 0}</span>
                </div>
              </div>
            </div>

            {/* Recent Briefings */}
            <div className="bg-[#111111] rounded-2xl border border-[#1f1f1f] p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-[#1f1f1f] rounded-lg">
                  <FileText className="w-5 h-5 text-[#a0a0a0]" />
                </div>
                <h2 className="text-lg font-semibold text-white">Recent Briefings</h2>
              </div>

              {existingBriefings.length === 0 ? (
                <p className="text-center text-[#666] py-4">No briefings yet</p>
              ) : (
                <div className="space-y-3">
                  {existingBriefings.slice(0, 5).map((briefing) => (
                    <button
                      key={briefing.filename}
                      onClick={() => viewBriefing(briefing)}
                      className="w-full flex items-center justify-between p-3 bg-[#161616] rounded-xl border border-[#1f1f1f] hover:border-[#d4a574]/30 transition-colors text-left"
                    >
                      <div>
                        <p className="font-medium text-white text-sm">{briefing.date || 'Unknown date'}</p>
                        <p className="text-xs text-[#666] truncate max-w-[180px]">{briefing.filename}</p>
                      </div>
                      <Eye className="w-4 h-4 text-[#666]" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Briefing Preview */}
          <div className="lg:col-span-2">
            <div className="bg-[#111111] rounded-2xl border border-[#1f1f1f] p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#1f1f1f] rounded-lg">
                    <FileText className="w-5 h-5 text-[#a0a0a0]" />
                  </div>
                  <h2 className="text-lg font-semibold text-white">Briefing Preview</h2>
                </div>
                {generatedBriefing && (
                  <span className="px-3 py-1 bg-[#d4a574]/20 text-[#d4a574] rounded-full text-xs font-medium border border-[#d4a574]/30">
                    {templates.find(t => t.id === selectedTemplate)?.period}
                  </span>
                )}
              </div>

              {generatedBriefing ? (
                <div className="bg-[#0a0a0a] p-6 rounded-xl border border-[#1f1f1f] max-h-[700px] overflow-y-auto">
                  <pre className="whitespace-pre-wrap font-sans text-sm text-[#a0a0a0] leading-relaxed">
                    {generatedBriefing}
                  </pre>
                </div>
              ) : (
                <div className="text-center py-16 border-2 border-dashed border-[#1f1f1f] rounded-xl">
                  <Bot className="w-16 h-16 mx-auto text-[#2a2a2a] mb-4" />
                  <h3 className="text-lg font-medium text-[#a0a0a0] mb-2">Generate Your CEO Briefing</h3>
                  <p className="text-[#666] max-w-md mx-auto">
                    Click &quot;Generate Briefing&quot; to create your Monday Morning CEO report.
                    Your AI Employee will analyze vault data, business metrics, and generate actionable insights.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
