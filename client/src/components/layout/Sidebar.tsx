'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Inbox,
  Calendar,
  CheckSquare,
  Settings,
  Layers,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { ThemeToggle } from './ThemeToggle';

interface NavItem {
  name: string;
  href: string;
  icon?: React.ElementType;
}

const navItems: NavItem[] = [
  { name: 'Unified Inbox', href: '/inbox' },
  { name: 'Unified Agenda', href: '/calendar' },
  { name: 'Tasks & Actions', href: '/tasks' },
  { name: 'Daily Digest', href: '/digest' },
  { name: 'Connected Accounts', href: '/settings' },
];

const iconsMap: Record<string, React.ElementType> = {
  '/inbox': Inbox,
  '/calendar': Calendar,
  '/tasks': CheckSquare,
  '/digest': Sparkles,
  '/settings': Settings,
};


export function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('sidebar_collapsed');
    if (saved === 'true') {
      setIsCollapsed(true);
    }
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const nextState = !prev;
      localStorage.setItem('sidebar_collapsed', String(nextState));
      return nextState;
    });
  };

  return (
    <aside
      className={cn(
        'bg-slate-50/90 dark:bg-[#0B101D]/95 border-r border-slate-200/80 dark:border-slate-800/60 flex flex-col justify-between shrink-0 h-screen sticky top-0 backdrop-blur-xl z-30 transition-all duration-300 ease-in-out',
        isCollapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Brand Header & Toggle */}
      <div
        className={cn(
          'p-4 border-b border-slate-200/80 dark:border-slate-800/60 flex items-center justify-between',
          isCollapsed && 'flex-col space-y-3 p-3'
        )}
      >
        <Link href="/inbox" className="flex items-center space-x-3 group" title="Streamline OS">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-md shadow-purple-500/25 group-hover:scale-105 transition-transform duration-200 shrink-0">
            <Layers className="h-5 w-5 text-white" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col animate-in fade-in duration-200">
              <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white">
                Streamline
              </span>
              <span className="text-[10px] text-purple-600 dark:text-purple-400 font-mono tracking-wider uppercase font-semibold">
                Personal OS
              </span>
            </div>
          )}
        </Link>

        {/* Collapse / Expand Trigger Button */}
        <button
          onClick={toggleCollapse}
          className="p-1.5 rounded-xl bg-slate-200/60 dark:bg-slate-900/80 border border-slate-300/60 dark:border-slate-800/80 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-300/60 dark:hover:bg-slate-800 transition-colors shadow-2xs"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Navigation List */}
      <div className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        {!isCollapsed && (
          <div className="px-3 pb-2 text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase animate-in fade-in">
            Workspace Navigation
          </div>
        )}

        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/inbox' && pathname.startsWith(item.href));
          const Icon = iconsMap[item.href] || Inbox;

          return (
            <Link
              key={item.href}
              href={item.href}
              title={isCollapsed ? item.name : undefined}
              className={cn(
                'flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group',
                isCollapsed ? 'justify-center px-0' : 'justify-between space-x-3',
                isActive
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-900/60'
              )}
            >
              <div className={cn('flex items-center', !isCollapsed && 'space-x-3')}>
                <Icon
                  className={cn(
                    'h-4 w-4 transition-colors shrink-0',
                    isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-purple-300'
                  )}
                />
                {!isCollapsed && <span className="truncate">{item.name}</span>}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Sidebar Footer with Theme Toggle */}
      <div className="p-3 border-t border-slate-200/80 dark:border-slate-800/60 flex items-center justify-between">
        {!isCollapsed && (
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Theme</span>
        )}
        <ThemeToggle />
      </div>
    </aside>
  );
}
