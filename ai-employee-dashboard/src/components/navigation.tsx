'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Clock,
  FolderOpen,
  Settings,
  HelpCircle,
  LogOut,
  FileText,
  Bot,
  DollarSign
} from 'lucide-react';
import type { VaultStats, OrchestratorStatus } from '@/types/vault';

export default function Navigation() {
  const pathname = usePathname();
  const [stats, setStats] = useState<VaultStats | null>(null);
  const [orchestratorStatus, setOrchestratorStatus] = useState<OrchestratorStatus | null>(null);

  // Fetch stats on mount and periodically
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/vault?action=stats');
        const data = await res.json();
        if (data.stats) {
          setStats(data.stats);
        }
      } catch (err) {
        console.error('Failed to fetch nav stats:', err);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 60000); // Refresh every minute

    // Instantly refresh when any page approves/rejects a file
    window.addEventListener('vault-stats-changed', fetchStats);
    return () => {
      clearInterval(interval);
      window.removeEventListener('vault-stats-changed', fetchStats);
    };
  }, []);

  // Fetch orchestrator status
  useEffect(() => {
    const fetchOrchestratorStatus = async () => {
      try {
        const res = await fetch('/api/orchestrator');
        const data = await res.json();
        setOrchestratorStatus(data);
      } catch (err) {
        console.error('Failed to fetch orchestrator status:', err);
      }
    };

    fetchOrchestratorStatus();
    const interval = setInterval(fetchOrchestratorStatus, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const pendingCount = stats ? (stats.Needs_Action + stats.Pending_Approval) : 0;
  const completedCount = stats?.Done || 0;

  const mainNavItems = [
    {
      href: '/',
      label: 'Dashboard',
      icon: <LayoutDashboard className="h-5 w-5" />,
    },
    {
      href: '/approvals',
      label: 'Approvals',
      icon: <Clock className="h-5 w-5" />,
      badge: stats?.Pending_Approval || 0
    },
    {
      href: '/vault',
      label: 'Vault',
      icon: <FolderOpen className="h-5 w-5" />,
    },
    {
      href: '/briefings',
      label: 'Briefings',
      icon: <FileText className="h-5 w-5" />,
    },
    {
      href: '/accounting',
      label: 'Accounting',
      icon: <DollarSign className="h-5 w-5" />,
    }
  ];

  const bottomNavItems = [
    {
      href: '/settings',
      label: 'Settings',
      icon: <Settings className="h-5 w-5" />,
    },
    {
      href: '/help',
      label: 'Help Center',
      icon: <HelpCircle className="h-5 w-5" />,
    }
  ];

  return (
    <aside className="hidden md:flex md:w-20 md:hover:w-64 transition-all duration-300 bg-[#0d0d0d] border-r border-[#1f1f1f] flex-col group overflow-hidden">
      {/* Logo */}
      <div className="p-4 border-b border-[#1f1f1f]">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#d4a574] to-[#b8956a] flex items-center justify-center shadow-lg shadow-[#d4a574]/20 shrink-0 animate-float">
            <span className="text-black font-bold text-xl">E</span>
          </div>
          <div className="opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
            <h1 className="text-lg font-bold text-white">AI Employee</h1>
            <p className="text-xs text-[#666]">Your autopilot</p>
          </div>
        </Link>
      </div>

      {/* AI Employee Status Indicator */}
      <div className="p-3 border-b border-[#1f1f1f]">
        <Link
          href="/"
          className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 ${
            orchestratorStatus?.running
              ? 'bg-emerald-500/10 border border-emerald-500/30'
              : 'bg-red-500/10 border border-red-500/30'
          }`}
        >
          <div className="relative shrink-0">
            <Bot className={`w-5 h-5 ${orchestratorStatus?.running ? 'text-emerald-400' : 'text-red-400'}`} />
            <div className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${
              orchestratorStatus?.running ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
            }`} />
          </div>
          <div className="opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
            <p className={`text-sm font-medium ${orchestratorStatus?.running ? 'text-emerald-400' : 'text-red-400'}`}>
              {orchestratorStatus?.running ? 'Running' : 'Stopped'}
            </p>
            {orchestratorStatus?.running && orchestratorStatus?.uptime && (
              <p className="text-xs text-[#666]">{orchestratorStatus.uptime}</p>
            )}
          </div>
        </Link>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 p-3 overflow-y-auto">
        <ul className="space-y-1">
          {mainNavItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group/item ${
                    isActive
                      ? 'bg-[#d4a574]/10 text-[#d4a574] border-l-2 border-[#d4a574]'
                      : 'text-[#a0a0a0] hover:bg-[#161616] hover:text-white'
                  }`}
                >
                  <span className={`shrink-0 ${isActive ? 'text-[#d4a574]' : ''}`}>
                    {item.icon}
                  </span>
                  <span className={`opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap font-medium ${
                    isActive ? 'text-[#d4a574]' : 'text-[#a0a0a0]'
                  }`}>
                    {item.label}
                  </span>
                  {item.badge && item.badge > 0 && (
                    <span className="ml-auto px-2 py-0.5 bg-[#d4a574]/20 text-[#d4a574] text-xs font-medium rounded-full border border-[#d4a574]/30 opacity-0 md:group-hover:opacity-100 transition-opacity">
                      {item.badge}
                    </span>
                  )}
                  {isActive && !item.badge && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#d4a574] opacity-0 md:group-hover:opacity-100 transition-opacity" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Quick Stats Section */}
        <div className="mt-6 opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
          <h3 className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-3 px-3">
            Quick Stats
          </h3>
          <div className="space-y-2 px-3">
            <div className="flex items-center justify-between p-3 bg-[#161616] rounded-xl">
              <span className="text-sm text-[#a0a0a0]">Pending</span>
              <span className="px-2 py-0.5 bg-[#d4a574]/20 text-[#d4a574] text-xs font-medium rounded-full border border-[#d4a574]/30">
                {pendingCount}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-[#161616] rounded-xl">
              <span className="text-sm text-[#a0a0a0]">Completed</span>
              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded-full border border-emerald-500/30">
                {completedCount}
              </span>
            </div>
            {(stats?.Failed ?? 0) > 0 && (
              <div className="flex items-center justify-between p-3 bg-[#161616] rounded-xl">
                <span className="text-sm text-[#a0a0a0]">Failed</span>
                <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs font-medium rounded-full border border-red-500/30">
                  {stats?.Failed}
                </span>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Bottom Navigation */}
      <div className="p-3 border-t border-[#1f1f1f]">
        <ul className="space-y-1">
          {bottomNavItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-[#d4a574]/10 text-[#d4a574] border-l-2 border-[#d4a574]'
                      : 'text-[#a0a0a0] hover:bg-[#161616] hover:text-white'
                  }`}
                >
                  <span className={`shrink-0 ${isActive ? 'text-[#d4a574]' : 'text-[#a0a0a0]'}`}>{item.icon}</span>
                  <span className="opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap font-medium">
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        {/* User Profile */}
        <div className="mt-3 p-3 bg-[#161616] rounded-xl opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 ring-2 ring-[#d4a574] ring-offset-2 ring-offset-[#161616] bg-gradient-to-br from-[#d4a574] to-[#b8956a] flex items-center justify-center">
              <span className="text-black font-bold text-sm">NM</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">Noor ul ain</p>
              <p className="text-xs text-[#666] truncate">Admin</p>
            </div>
            <button className="p-2 hover:bg-[#1f1f1f] rounded-lg transition-colors">
              <LogOut className="w-4 h-4 text-[#666]" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
