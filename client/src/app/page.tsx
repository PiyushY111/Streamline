import React from 'react';
import { Mail, Calendar, CheckSquare, Layers, Shield, Cpu, ArrowRight } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col justify-between p-6 md:p-12 relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Header Shell */}
      <header className="flex items-center justify-between z-10">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Layers className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
            Streamline
          </span>
        </div>
        <div className="flex items-center space-x-3 text-xs text-muted-foreground font-mono glass-panel px-3 py-1.5 rounded-full">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>V1 System Online</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="my-auto py-16 z-10 max-w-4xl mx-auto text-center space-y-8">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300">
          <Cpu className="w-3.5 h-3.5" />
          <span>Production Infrastructure Skeleton Ready</span>
        </div>

        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white via-slate-100 to-slate-400">
          Personal Productivity OS
        </h1>

        <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
          Monorepo scaffolded with Next.js App Router, Node worker service, Neon PostgreSQL database, and BullMQ task queues. Ready for feature module implementation.
        </p>

        {/* Feature Shell Modules Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-8">
          <div className="glass-panel p-6 rounded-2xl text-left hover:border-purple-500/30 transition-all duration-300 group">
            <div className="h-10 w-10 rounded-xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center mb-4 text-purple-400 group-hover:scale-105 transition-transform">
              <Mail className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">Unified Inbox</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Multi-account Gmail synchronization engine & unified thread inbox.
            </p>
          </div>

          <div className="glass-panel p-6 rounded-2xl text-left hover:border-purple-500/30 transition-all duration-300 group">
            <div className="h-10 w-10 rounded-xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center mb-4 text-indigo-400 group-hover:scale-105 transition-transform">
              <Calendar className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">Unified Agenda</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Sweep-line conflict detection and unified multi-calendar daily timeline.
            </p>
          </div>

          <div className="glass-panel p-6 rounded-2xl text-left hover:border-purple-500/30 transition-all duration-300 group">
            <div className="h-10 w-10 rounded-xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center mb-4 text-blue-400 group-hover:scale-105 transition-transform">
              <CheckSquare className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">Tasks & Links</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Native task management cross-linked with emails and calendar events.
            </p>
          </div>
        </div>
      </main>

      {/* Footer Shell */}
      <footer className="flex flex-col sm:flex-row items-center justify-between text-xs text-muted-foreground border-t border-slate-800/60 pt-6 z-10">
        <div className="flex items-center space-x-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          <span>OAuth Tokens AES-256-GCM Encrypted at Rest</span>
        </div>
        <div className="mt-2 sm:mt-0 font-mono">
          <span>Client: Next.js | Server: Node Worker | DB: Neon Postgres</span>
        </div>
      </footer>
    </div>
  );
}
