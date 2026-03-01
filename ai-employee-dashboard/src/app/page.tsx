"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Mail,
  MessageSquare,
  DollarSign,
  FolderOpen,
  Linkedin,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  Activity,
  Bot,
  Play,
  Pause,
  RefreshCw,
  Loader2,
  Sparkles
} from "lucide-react";
import type { VaultStats, WatcherStatus, BusinessMetric } from "@/types/vault";
import { AIEmployeeControl } from "@/components/ai-employee-control";
import { QuickActions } from "@/components/quick-actions";

/* =========================
   Components
========================= */
const StatCard = ({
  title,
  value,
  icon: Icon,
  loading
}: {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
}) => (
  <div className="bg-[#161616] p-4 sm:p-5 rounded-xl border border-[#1f1f1f]">
    <Icon className="w-5 h-5 text-[#d4a574] mb-2" />
    <div className="text-2xl sm:text-3xl font-bold text-white">
      {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : value}
    </div>
    <div className="text-xs sm:text-sm text-[#666]">{title}</div>
  </div>
);

const WatcherCard = ({ watcher }: { watcher: WatcherStatus }) => {
  const icons: Record<string, React.ComponentType<{ className?: string }>> = {
    gmail: Mail,
    whatsapp: MessageSquare,
    finance: DollarSign,
    xero: DollarSign,
    odoo: DollarSign,
    filesystem: FolderOpen,
    linkedin: Linkedin,
    social_media: Activity,
    ralph_wiggum: Bot,
    notification: Activity,
    approval: CheckCircle,
    scheduler: Clock
  };

  const Icon = icons[watcher.type] || Activity;

  const statusColors: Record<string, string> = {
    active: "text-emerald-400",
    inactive: "text-gray-500",
    error: "text-red-400",
    unknown: "text-gray-400"
  };

  return (
    <div className="p-4 rounded-xl bg-[#161616] border border-[#1f1f1f]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex gap-3 items-center">
          <div className="p-2 rounded-lg bg-[#d4a574]/10">
            <Icon className="w-5 h-5 text-[#d4a574]" />
          </div>
          <div>
            <div className="text-white font-medium">{watcher.name}</div>
            <div className="text-xs text-[#666]">{watcher.description}</div>
          </div>
        </div>
        <div className="text-right sm:text-left">
          <span className={`text-xs font-medium ${statusColors[watcher.status]}`}>
            {watcher.status}
          </span>
          {watcher.itemsProcessed > 0 && (
            <div className="text-xs text-[#666] mt-1">{watcher.itemsProcessed} processed</div>
          )}
        </div>
      </div>
    </div>
  );
};

const MetricRow = ({ metric }: { metric: BusinessMetric }) => (
  <div className="flex flex-col sm:flex-row justify-between py-2 border-b border-[#1f1f1f] gap-2">
    <div>
      <div className="text-white text-sm">{metric.metric}</div>
      <div className="text-xs text-[#666]">Target: {metric.target}</div>
    </div>
    <div className="sm:text-right">
      <div className="text-[#d4a574]">{metric.current}</div>
      <div className="text-xs text-[#666]">{metric.status}</div>
    </div>
  </div>
);

/* =========================
   Page
========================= */
export default function DashboardPage() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stats, setStats] = useState<VaultStats>({
    Needs_Action: 0,
    Pending_Approval: 0,
    Done: 0,
    In_Progress: 0,
    Approved: 0,
    Rejected: 0,
    Failed: 0,
    Inbox: 0,
    Briefings: 0
  });

  const [watchers, setWatchers] = useState<WatcherStatus[]>([]);
  const [metrics, setMetrics] = useState<BusinessMetric[]>([]);

  const fetchData = useCallback(async () => {
    try {
      // Fetch vault stats
      const statsRes = await fetch("/api/vault?action=stats");
      const statsData = await statsRes.json();
      let currentStats = statsData.stats;
      if (currentStats) {
        setStats(currentStats);
      } else {
        currentStats = { Needs_Action: 0, Pending_Approval: 0, Done: 0, In_Progress: 0, Approved: 0, Rejected: 0, Failed: 0, Inbox: 0, Briefings: 0 };
      }

      // Fetch watchers
      const watchersRes = await fetch("/api/watchers");
      const watchersData = await watchersRes.json();
      if (watchersData.watchers) {
        setWatchers(watchersData.watchers);
      }

      // Fetch business goals for metrics
      const goalsRes = await fetch("/api/vault?action=business_goals");
      const goalsData = await goalsRes.json();
      if (goalsData.goals?.metrics) {
        setMetrics(goalsData.goals.metrics);
      } else {
        // Default metrics if no business goals file
        setMetrics([
          { metric: "Inbox Zero", target: "Daily", current: `${currentStats.Needs_Action + currentStats.Pending_Approval}`, alertThreshold: "10", status: currentStats.Needs_Action < 10 ? "On Track" : "Warning" },
          { metric: "Task Completion", target: "90%", current: currentStats.Done > 0 ? `${Math.round((currentStats.Done / (currentStats.Done + currentStats.Failed + 1)) * 100)}%` : "N/A", alertThreshold: "70%", status: "Tracking" },
          { metric: "Items Processed", target: "100+", current: `${currentStats.Done}`, alertThreshold: "50", status: currentStats.Done >= 50 ? "On Track" : "Growing" }
        ]);
      }

      setError(null);
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="pl-16 pr-4 sm:px-6 py-4 border-b border-[#1f1f1f] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Bot className="w-6 h-6 text-[#d4a574]" />
          <div>
            <div className="font-bold">AI Employee</div>
            <div className="text-xs text-[#666]">Autopilot Dashboard</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-lg bg-[#161616] border border-[#1f1f1f] hover:border-[#d4a574]/30 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 text-[#a0a0a0] ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="p-2 rounded-lg bg-[#161616] border border-[#1f1f1f] hover:border-[#d4a574]/30 transition-colors"
            title={autoRefresh ? "Pause auto-refresh" : "Enable auto-refresh"}
          >
            {autoRefresh ? <Pause className="w-4 h-4 text-emerald-400" /> : <Play className="w-4 h-4 text-[#a0a0a0]" />}
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="p-4 sm:p-6">
        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <span className="text-red-400">Error: {error}</span>
            </div>
          </div>
        )}

        {/* AI Employee Control Panel - Prominent Position */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-[#d4a574]" />
            <h2 className="text-lg font-semibold text-white">Control Center</h2>
          </div>
          <div className="grid grid-cols-1 gap-6">
            {/* AI Employee Control - Full width on mobile, 1/3 on large screens */}
            <div className="w-full">
              <AIEmployeeControl />
            </div>

            {/* Stats Grid - Full width on mobile, stacked on small screens, side-by-side on medium */}
            <div className="w-full">
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard title="Needs Action" value={stats.Needs_Action} icon={AlertTriangle} loading={loading} />
                <StatCard title="Pending" value={stats.Pending_Approval} icon={Clock} loading={loading} />
                <StatCard title="Completed" value={stats.Done} icon={CheckCircle} loading={loading} />
                <StatCard title="Failed" value={stats.Failed} icon={XCircle} loading={loading} />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions Section */}
        <div className="mb-6">
          <QuickActions />
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* Watchers */}
          <div className="bg-[#111111] p-4 sm:p-6 rounded-2xl border border-[#1f1f1f]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
              <div className="font-semibold">System Watchers</div>
              <span className="text-xs text-[#666]">
                {watchers.filter(w => w.status === 'active').length} / {watchers.length} active
              </span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" />
              </div>
            ) : watchers.length === 0 ? (
              <div className="text-center py-8 text-[#666]">
                <Bot className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No watchers configured</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {watchers.map((w, i) => (
                  <WatcherCard key={i} watcher={w} />
                ))}
              </div>
            )}
          </div>

          {/* Metrics */}
          <div className="bg-[#111111] p-4 sm:p-6 rounded-2xl border border-[#1f1f1f]">
            <div className="font-semibold mb-3">Business Metrics</div>
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" />
              </div>
            ) : metrics.length === 0 ? (
              <div className="text-center py-4 text-[#666]">
                <p>No metrics available</p>
              </div>
            ) : (
              <div className="space-y-2">
                {metrics.map((m, i) => (
                  <MetricRow key={i} metric={m} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats Summary */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#161616] p-4 rounded-xl border border-[#1f1f1f]">
            <div className="text-xs text-[#666] mb-1">In Progress</div>
            <div className="text-xl font-bold text-[#d4a574]">{stats.In_Progress}</div>
          </div>
          <div className="bg-[#161616] p-4 rounded-xl border border-[#1f1f1f]">
            <div className="text-xs text-[#666] mb-1">Approved</div>
            <div className="text-xl font-bold text-emerald-400">{stats.Approved}</div>
          </div>
          <div className="bg-[#161616] p-4 rounded-xl border border-[#1f1f1f]">
            <div className="text-xs text-[#666] mb-1">Rejected</div>
            <div className="text-xl font-bold text-red-400">{stats.Rejected}</div>
          </div>
          <div className="bg-[#161616] p-4 rounded-xl border border-[#1f1f1f]">
            <div className="text-xs text-[#666] mb-1">Total Processed</div>
            <div className="text-xl font-bold text-white">
              {stats.Done + stats.Approved + stats.Rejected + stats.Failed}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
