'use client';

import React, { useState } from 'react';
import { Search as SearchIcon, Mail, Calendar, CheckSquare, Sparkles } from 'lucide-react';

export default function SearchPage() {
  const [query, setQuery] = useState('');

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="text-center space-y-3 py-6">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300 font-mono">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Postgres Full-Text Search Engine</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Global Search</h1>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Query indexed subjects, body text, calendar titles, descriptions, and tasks instantly across all accounts.
        </p>
      </div>

      {/* Big Search Bar */}
      <div className="glass-panel p-2 rounded-2xl border border-purple-500/30 flex items-center space-x-3 shadow-2xl">
        <SearchIcon className="w-5 h-5 text-purple-400 ml-3" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search architecture review, Q3 specs, Dependabot..."
          className="w-full bg-transparent border-none text-sm text-white placeholder-slate-500 focus:outline-none py-2.5"
        />
        <kbd className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-xs font-mono text-slate-400 mr-2">
          ESC
        </kbd>
      </div>

      {/* Results Groups */}
      <div className="space-y-4 pt-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Recent Search Matches</h3>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center space-x-2 text-xs text-purple-400 font-semibold">
            <Mail className="w-4 h-4" />
            <span>Emails (1 match)</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <h4 className="text-xs font-semibold text-white">Q3 Product Roadmap Review & Sync Call Proposal</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">From: Sarah Jenkins • Agency Work</p>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center space-x-2 text-xs text-indigo-400 font-semibold">
            <Calendar className="w-4 h-4" />
            <span>Calendar Events (1 match)</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <h4 className="text-xs font-semibold text-white">Client Architecture Review (Sync)</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">Aug 25, 2:00 PM - 3:30 PM • Agency Work</p>
          </div>
        </div>
      </div>
    </div>
  );
}
