'use client';

import React from 'react';
import { Bell, Sparkles, AlertTriangle, Calendar, CheckSquare } from 'lucide-react';

export default function NotificationsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between glass-panel p-6 rounded-3xl border border-purple-500/20 bg-gradient-to-r from-slate-950 via-purple-950/20 to-slate-950">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs font-mono text-purple-300">
            <Bell className="w-3 h-3 text-purple-400" />
            <span>Daily Digest & System Alerts</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Notifications & Daily Digest</h1>
          <p className="text-xs text-slate-400">
            Structured morning digest, double-booking alerts, and sync status logs.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Morning Digest Notification Card */}
        <div className="glass-panel p-6 rounded-3xl border border-purple-500/30 bg-purple-950/10 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-3">
              <div className="h-9 w-9 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Today&apos;s Morning Digest</h3>
                <p className="text-[10px] text-slate-400 font-mono">Generated at 7:00 AM • Tuesday, Aug 25, 2026</p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-mono border border-purple-500/30">
              Unread
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
              <div className="flex items-center space-x-2 text-xs text-indigo-400 font-medium">
                <Calendar className="w-3.5 h-3.5" />
                <span>Agenda Overview</span>
              </div>
              <p className="text-xs text-slate-300">
                3 events scheduled today across 3 calendars. 1 double-booking conflict detected.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
              <div className="flex items-center space-x-2 text-xs text-purple-400 font-medium">
                <Bell className="w-3.5 h-3.5" />
                <span>Starred Emails</span>
              </div>
              <p className="text-xs text-slate-300">
                2 unread starred emails requiring response from Agency Work & Personal Gmail.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
              <div className="flex items-center space-x-2 text-xs text-blue-400 font-medium">
                <CheckSquare className="w-3.5 h-3.5" />
                <span>Tasks Due Today</span>
              </div>
              <p className="text-xs text-slate-300">1 high-priority task due today before 2:00 PM.</p>
            </div>
          </div>
        </div>

        {/* Sync Alert Notification */}
        <div className="glass-panel p-4 rounded-2xl border border-amber-500/30 bg-slate-900/40 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-white">Double-Booking Conflict Alert</h4>
              <p className="text-xs text-slate-400">
                Client Architecture Review overlaps with Personal Health Checkup on Aug 25.
              </p>
            </div>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">10:42 AM</span>
        </div>
      </div>
    </div>
  );
}
