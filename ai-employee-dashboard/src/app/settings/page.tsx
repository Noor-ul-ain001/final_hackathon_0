'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Settings,
  Mail,
  MessageSquare,
  DollarSign,
  Globe,
  Bot,
  Calendar,
  Bell,
  Lock,
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Save
} from 'lucide-react';

interface WatcherConfig {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  icon: React.ReactNode;
}

interface NotificationSetting {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

const WATCHER_META: Omit<WatcherConfig, 'enabled'>[] = [
  {
    id: 'gmail',
    name: 'Gmail Watcher',
    description: 'Monitor Gmail for important emails and notifications',
    icon: <Mail className="h-5 w-5 text-red-400" />
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Watcher',
    description: 'Monitor WhatsApp for messages and notifications',
    icon: <MessageSquare className="h-5 w-5 text-green-400" />
  },
  {
    id: 'finance',
    name: 'Finance Watcher',
    description: 'Track financial transactions and banking activities',
    icon: <DollarSign className="h-5 w-5 text-purple-400" />
  },
  {
    id: 'linkedin',
    name: 'LinkedIn Poster',
    description: 'Automatically post updates and engage with connections',
    icon: <Globe className="h-5 w-5 text-blue-400" />
  },
  {
    id: 'scheduler',
    name: 'Scheduler',
    description: 'Run automated tasks at scheduled intervals',
    icon: <Calendar className="h-5 w-5 text-indigo-400" />
  },
  {
    id: 'auditor',
    name: 'Auditor',
    description: 'Generate weekly CEO briefings and reports',
    icon: <Bot className="h-5 w-5 text-teal-400" />
  }
];

const NOTIFICATION_META: Omit<NotificationSetting, 'enabled'>[] = [
  {
    id: 'email_notifications',
    name: 'Email Notifications',
    description: 'Receive email alerts for important events',
  },
  {
    id: 'push_notifications',
    name: 'Push Notifications',
    description: 'Receive push notifications on your device',
  },
  {
    id: 'approval_required',
    name: 'Approval Required',
    description: 'Get notified when human approval is needed',
  },
  {
    id: 'system_alerts',
    name: 'System Alerts',
    description: 'Receive alerts about system status and errors',
  }
];

export default function SettingsPage() {
  const [watcherEnabled, setWatcherEnabled] = useState<Record<string, boolean>>({});
  const [notifEnabled, setNotifEnabled] = useState<Record<string, boolean>>({});
  const [autoApproveThreshold, setAutoApproveThreshold] = useState<number>(50);
  const [devMode, setDevMode] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/settings');
        const data = await res.json();

        if (data.success && data.settings) {
          const s = data.settings;
          setWatcherEnabled(s.watchers || {});
          setNotifEnabled(s.notifications || {});
          setAutoApproveThreshold(s.autoApproveThreshold ?? 50);
          setDevMode(s.devMode ?? false);
          setLastSaved(s.updatedAt || null);
        }
        setError(null);
      } catch (err) {
        console.error('Failed to fetch settings:', err);
        setError(err instanceof Error ? err.message : 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const toggleWatcher = (id: string) => {
    setWatcherEnabled(prev => ({ ...prev, [id]: !prev[id] }));
    setSaveStatus('idle');
  };

  const toggleNotification = (id: string) => {
    setNotifEnabled(prev => ({ ...prev, [id]: !prev[id] }));
    setSaveStatus('idle');
  };

  const handleThresholdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value)) {
      setAutoApproveThreshold(Math.max(0, Math.min(10000, value)));
      setSaveStatus('idle');
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    setSaveStatus('idle');
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          watchers: watcherEnabled,
          notifications: notifEnabled,
          autoApproveThreshold,
          devMode,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSaveStatus('success');
        setLastSaved(data.settings.updatedAt);
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
        setError(data.error || 'Failed to save');
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
      setSaveStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button
      onClick={onChange}
      role="switch"
      aria-checked={checked}
      className="relative inline-flex w-12 h-6 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#d4a574]/50"
      style={{ background: checked ? '#d4a574' : '#333' }}
    >
      <span
        className="inline-block w-4 h-4 bg-white rounded-full shadow transition-transform"
        style={{ transform: checked ? 'translateX(26px)' : 'translateX(2px)' }}
      />
    </button>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 sm:p-6">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-[#a0a0a0] hover:text-[#d4a574] transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Link>

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#d4a574] to-[#b8956a] flex items-center justify-center shadow-lg shadow-[#d4a574]/20 shrink-0">
              <Settings className="w-7 h-7 text-black" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Settings</h1>
              <p className="text-sm text-[#a0a0a0]">Configure your AI Employee preferences</p>
            </div>
          </div>
          {lastSaved && (
            <p className="text-xs text-[#666]">
              Last saved: {new Date(lastSaved).toLocaleString()}
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <span className="text-red-400 text-sm">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300 text-xs">
              Dismiss
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-10 h-10 animate-spin text-[#d4a574]" />
              <p className="text-[#a0a0a0]">Loading settings...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Watchers Configuration */}
            <div className="bg-[#111111] rounded-2xl border border-[#1f1f1f] p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-[#d4a574]/20 rounded-lg">
                  <Bot className="h-5 w-5 text-[#d4a574]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Watchers Configuration</h2>
                  <p className="text-xs text-[#666]">Enable or disable individual watchers</p>
                </div>
              </div>
              <div className="space-y-3">
                {WATCHER_META.map((meta) => (
                  <div
                    key={meta.id}
                    className="flex items-center justify-between p-4 bg-[#161616] rounded-xl border border-[#1f1f1f]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 bg-[#1f1f1f] rounded-lg shrink-0">
                        {meta.icon}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-medium text-white text-sm">{meta.name}</h3>
                        <p className="text-xs text-[#a0a0a0] truncate">{meta.description}</p>
                      </div>
                    </div>
                    <Toggle
                      checked={watcherEnabled[meta.id] ?? false}
                      onChange={() => toggleWatcher(meta.id)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Notification Settings */}
            <div className="bg-[#111111] rounded-2xl border border-[#1f1f1f] p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <Bell className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Notification Settings</h2>
                  <p className="text-xs text-[#666]">Control how you receive alerts</p>
                </div>
              </div>
              <div className="space-y-3">
                {NOTIFICATION_META.map((meta) => (
                  <div
                    key={meta.id}
                    className="flex items-center justify-between p-4 bg-[#161616] rounded-xl border border-[#1f1f1f]"
                  >
                    <div className="min-w-0 pr-4">
                      <h3 className="font-medium text-white text-sm">{meta.name}</h3>
                      <p className="text-xs text-[#a0a0a0]">{meta.description}</p>
                    </div>
                    <Toggle
                      checked={notifEnabled[meta.id] ?? false}
                      onChange={() => toggleNotification(meta.id)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Security & Permissions */}
            <div className="bg-[#111111] rounded-2xl border border-[#1f1f1f] p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-rose-500/20 rounded-lg">
                  <Lock className="h-5 w-5 text-rose-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">Security & Permissions</h2>
              </div>
              <div className="space-y-6">
                <div>
                  <h3 className="font-medium text-white mb-1">Auto-Approval Threshold</h3>
                  <p className="text-xs text-[#a0a0a0] mb-3">
                    Amounts under this value are approved automatically without human review
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="text-[#a0a0a0]">$</span>
                    <input
                      type="number"
                      value={autoApproveThreshold}
                      onChange={handleThresholdChange}
                      className="w-32 bg-[#161616] border border-[#1f1f1f] rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#d4a574]/50 focus:border-[#d4a574]"
                      min="0"
                      max="10000"
                    />
                    <span className="text-sm text-[#a0a0a0]">USD</span>
                  </div>
                  <p className="text-xs text-[#666] mt-2">
                    Transactions under ${autoApproveThreshold} will be auto-approved
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 bg-[#161616] rounded-xl border border-[#1f1f1f]">
                  <div className="min-w-0 pr-4">
                    <h3 className="font-medium text-white text-sm">Development Mode</h3>
                    <p className="text-xs text-[#a0a0a0]">Enable dev features and disable production safeguards</p>
                  </div>
                  <Toggle checked={devMode} onChange={() => { setDevMode(d => !d); setSaveStatus('idle'); }} />
                </div>
              </div>
            </div>

            {/* Save */}
            <div className="flex items-center justify-between">
              {saveStatus === 'success' && (
                <div className="flex items-center gap-2 text-emerald-400 text-sm">
                  <CheckCircle className="w-4 h-4" />
                  Settings saved successfully
                </div>
              )}
              {saveStatus === 'error' && (
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  Failed to save — check connection
                </div>
              )}
              {saveStatus === 'idle' && <span />}

              <button
                onClick={saveSettings}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#d4a574] to-[#b8956a] text-black rounded-xl font-medium hover:shadow-lg hover:shadow-[#d4a574]/25 transition-all disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
