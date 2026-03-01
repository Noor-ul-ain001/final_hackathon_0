'use client';

import Navigation from '@/components/navigation';
import { useState } from 'react';
import { Menu, LayoutDashboard, Calendar, Clock, FolderOpen, FileText, Users, BarChart3, Settings, HelpCircle } from 'lucide-react';
import { NotificationProvider } from '@/contexts/notification-context';

export default function LayoutClient({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <NotificationProvider>
      <div className="flex h-screen bg-[#0a0a0a]">
        <Navigation />

        {/* Mobile menu button */}
        <div className="md:hidden fixed top-4 left-4 z-50">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg bg-[#161616] border border-[#1f1f1f] hover:border-[#d4a574]/30 transition-colors"
          >
            <Menu className="w-5 h-5 text-[#a0a0a0]" />
          </button>
        </div>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Mobile sidebar */}
        <div
          className={`fixed top-0 left-0 h-full w-64 bg-[#0d0d0d] border-r border-[#1f1f1f] z-50 transform transition-transform duration-300 ease-in-out ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } md:hidden`}
        >
          <div className="p-4 border-b border-[#1f1f1f]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#d4a574] to-[#b8956a] flex items-center justify-center shadow-lg shadow-[#d4a574]/20 shrink-0 animate-float">
                  <span className="text-black font-bold text-xl">E</span>
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white">AI Employee</h1>
                  <p className="text-xs text-[#666]">Your autopilot</p>
                </div>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 rounded-lg hover:bg-[#1f1f1f]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#a0a0a0]" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile navigation items */}
          <nav className="p-3 overflow-y-auto">
            <ul className="space-y-1">
              {[
                { href: '/', label: 'Dashboard', icon: LayoutDashboard },
                { href: '/calendar', label: 'Calendar', icon: Calendar },
                { href: '/approvals', label: 'Approvals', icon: Clock },
                { href: '/vault', label: 'Vault', icon: FolderOpen },
                { href: '/briefings', label: 'Briefings', icon: FileText },
                { href: '/team', label: 'Team', icon: Users },
                { href: '/reports', label: 'Reports', icon: BarChart3 },
                { href: '/settings', label: 'Settings', icon: Settings },
                { href: '/help', label: 'Help Center', icon: HelpCircle },
              ].map((item) => {
                const IconComponent = item.icon;
                return (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      className="flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 text-[#a0a0a0] hover:bg-[#161616] hover:text-white"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <IconComponent className="w-5 h-5" />
                      <span className="font-medium">{item.label}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        <main className="flex-1 overflow-y-auto bg-[#0a0a0a] md:ml-0 pt-14 md:pt-0 transition-all duration-300">
          {children}
        </main>
      </div>
    </NotificationProvider>
  );
}