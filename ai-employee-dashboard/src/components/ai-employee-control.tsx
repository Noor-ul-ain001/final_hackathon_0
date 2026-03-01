"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Power,
  PowerOff,
  RefreshCw,
  Activity,
  Clock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Bot,
  Server,
  Bell
} from "lucide-react";

interface OrchestratorStatus {
  running: boolean;
  pid: number | null;
  startTime: string | null;
  uptime: string;
  uptimeSeconds: number;
  watchers: {
    active: number;
    total: number;
    details: Record<string, { running: boolean }>;
  };
  webhookServer: boolean;
  pendingApprovals: number;
  lastUpdate: string | null;
  statusFileExists: boolean;
}

export function AIEmployeeControl() {
  const [status, setStatus] = useState<OrchestratorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/orchestrator");
      const data = await res.json();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError("Failed to fetch status");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    // Poll every 5 seconds
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleAction = async (action: "start" | "stop" | "restart") => {
    setActionLoading(action);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch("/api/orchestrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccessMessage(data.message);
        // Refresh status after a short delay
        setTimeout(fetchStatus, 1000);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError(`Failed to ${action} AI Employee`);
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  // Clear success message after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-[#111111] to-[#0d0d0d] p-6 rounded-2xl border border-[#1f1f1f]">
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" />
        </div>
      </div>
    );
  }

  const isRunning = status?.running ?? false;

  return (
    <div className="bg-gradient-to-br from-[#111111] to-[#0d0d0d] p-6 rounded-2xl border border-[#1f1f1f] relative overflow-hidden">
      {/* Animated background gradient when running */}
      {isRunning && (
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-[#d4a574]/5 animate-pulse" />
      )}

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl ${isRunning ? 'bg-emerald-500/20' : 'bg-[#d4a574]/10'}`}>
              <Bot className={`w-6 h-6 ${isRunning ? 'text-emerald-400' : 'text-[#d4a574]'}`} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">AI Employee</h2>
              <p className="text-xs text-[#666]">Digital FTE Control Panel</p>
            </div>
          </div>

          {/* Status Badge */}
          <div className={`px-4 py-2 rounded-full flex items-center gap-2 ${
            isRunning
              ? 'bg-emerald-500/20 border border-emerald-500/30'
              : 'bg-red-500/20 border border-red-500/30'
          }`}>
            <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            <span className={`text-sm font-medium ${isRunning ? 'text-emerald-400' : 'text-red-400'}`}>
              {isRunning ? 'Running' : 'Stopped'}
            </span>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="text-sm text-red-400">{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span className="text-sm text-emerald-400">{successMessage}</span>
          </div>
        )}

        {/* Main Control Button */}
        <div className="mb-6">
          {isRunning ? (
            <button
              onClick={() => handleAction("stop")}
              disabled={actionLoading !== null}
              className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 transition-all duration-300 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {actionLoading === "stop" ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <PowerOff className="w-5 h-5 group-hover:scale-110 transition-transform" />
              )}
              <span className="font-semibold text-white">
                {actionLoading === "stop" ? "Stopping..." : "Stop AI Employee"}
              </span>
            </button>
          ) : (
            <button
              onClick={() => handleAction("start")}
              disabled={actionLoading !== null}
              className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 transition-all duration-300 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed group shadow-lg shadow-emerald-900/20"
            >
              {actionLoading === "start" ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Power className="w-5 h-5 group-hover:scale-110 transition-transform" />
              )}
              <span className="font-semibold text-white">
                {actionLoading === "start" ? "Starting..." : "Start AI Employee"}
              </span>
            </button>
          )}
        </div>

        {/* Secondary Actions */}
        {isRunning && (
          <div className="mb-6">
            <button
              onClick={() => handleAction("restart")}
              disabled={actionLoading !== null}
              className="w-full py-3 px-4 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#d4a574]/30 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading === "restart" ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#d4a574]" />
              ) : (
                <RefreshCw className="w-4 h-4 text-[#d4a574]" />
              )}
              <span className="text-sm text-[#a0a0a0]">
                {actionLoading === "restart" ? "Restarting..." : "Restart"}
              </span>
            </button>
          </div>
        )}

        {/* Status Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {/* Uptime */}
          <div className="p-4 rounded-xl bg-[#0a0a0a] border border-[#1f1f1f]">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-[#d4a574]" />
              <span className="text-xs text-[#666]">Uptime</span>
            </div>
            <div className="text-lg font-bold text-white">
              {isRunning ? status?.uptime || "0s" : "--"}
            </div>
          </div>

          {/* Watchers */}
          <div className="p-4 rounded-xl bg-[#0a0a0a] border border-[#1f1f1f]">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-[#d4a574]" />
              <span className="text-xs text-[#666]">Watchers</span>
            </div>
            <div className="text-lg font-bold text-white">
              {isRunning ? (
                <span>
                  <span className="text-emerald-400">{status?.watchers.active}</span>
                  <span className="text-[#666]"> / {status?.watchers.total}</span>
                </span>
              ) : "--"}
            </div>
          </div>

          {/* Webhook Server */}
          <div className="p-4 rounded-xl bg-[#0a0a0a] border border-[#1f1f1f]">
            <div className="flex items-center gap-2 mb-2">
              <Server className="w-4 h-4 text-[#d4a574]" />
              <span className="text-xs text-[#666]">Webhook</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                isRunning && status?.webhookServer ? 'bg-emerald-400' : 'bg-gray-500'
              }`} />
              <span className={`text-sm ${
                isRunning && status?.webhookServer ? 'text-emerald-400' : 'text-[#666]'
              }`}>
                {isRunning && status?.webhookServer ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>

          {/* Pending Approvals */}
          <div className="p-4 rounded-xl bg-[#0a0a0a] border border-[#1f1f1f]">
            <div className="flex items-center gap-2 mb-2">
              <Bell className="w-4 h-4 text-[#d4a574]" />
              <span className="text-xs text-[#666]">Pending</span>
            </div>
            <div className="text-lg font-bold text-white">
              {isRunning ? (
                <span className={status?.pendingApprovals && status.pendingApprovals > 0 ? 'text-amber-400' : ''}>
                  {status?.pendingApprovals || 0}
                </span>
              ) : "--"}
            </div>
          </div>
        </div>

        {/* Active Watchers List */}
        {isRunning && status?.watchers.details && (
          <div className="border-t border-[#1f1f1f] pt-4">
            <h3 className="text-xs text-[#666] uppercase tracking-wider mb-3">Active Components</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(status.watchers.details).map(([name, info]) => (
                <div
                  key={name}
                  className="flex items-center gap-2 p-2 rounded-lg bg-[#0a0a0a]"
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    info.running ? 'bg-emerald-400' : 'bg-red-400'
                  }`} />
                  <span className="text-xs text-[#a0a0a0] truncate">{name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Last Update */}
        {status?.lastUpdate && (
          <div className="mt-4 pt-4 border-t border-[#1f1f1f]">
            <div className="flex items-center justify-between text-xs text-[#444]">
              <span>Last updated</span>
              <span>{new Date(status.lastUpdate).toLocaleTimeString()}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
