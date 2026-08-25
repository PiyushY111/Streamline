'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Inbox,
  Calendar,
  CheckSquare,
  Settings,
  Layers,
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
  { name: 'Connected Accounts', href: '/settings' },
];

const iconsMap: Record<string, React.ElementType> = {
  '/inbox': Inbox,
  '/calendar': Calendar,
  '/tasks': CheckSquare,
  '/settings': Settings,
};

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-50/90 dark:bg-slate-950/80 border-r border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between shrink-0 h-screen sticky top-0 backdrop-blur-xl z-30 transition-colors duration-200">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-200/80 dark:border-slate-800/60 flex items-center justify-between">
        <Link href="/inbox" className="flex items-center space-x-3 group">
          <div className="h-9 w-9 rounded-xl bg-purple-600 flex items-center justify-center shadow-md shadow-purple-500/20 group-hover:scale-105 transition-transform duration-200">
            <Layers className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white">
              Streamline
            </span>
            <span className="text-[10px] text-purple-600 dark:text-purple-400 font-mono tracking-wider uppercase">
              Personal OS
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation List */}
      <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-semibold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
          Workspace Navigation
        </div>
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/inbox' && pathname.startsWith(item.href));
          const Icon = iconsMap[item.href] || Inbox;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group',
                isActive
                  ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/20 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-900/60'
              )}
            >
              <div className="flex items-center space-x-3">
                <Icon
                  className={cn(
                    'h-4 w-4 transition-colors',
                    isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200'
                  )}
                />
                <span>{item.name}</span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Footer Sync Engine Status & Theme Switcher */}
      <div className="p-4 border-t border-slate-200/80 dark:border-slate-800/60 space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center space-x-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Sync Engine</span>
          </div>

          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
