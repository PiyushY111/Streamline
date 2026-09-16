'use client';

import React, { useState } from 'react';
import { X, Edit2, Trash2, Clock, MapPin, Users, Video, AlertTriangle, Copy, Check } from 'lucide-react';
import { EventData } from '@/lib/api';

interface EventDetailsModalProps {
  event: EventData | null;
  onClose: () => void;
  onDelete: (id: string) => void;
}

export const EventDetailsModal: React.FC<EventDetailsModalProps> = ({ event, onClose, onDelete }) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [rsvpState, setRsvpState] = useState<'yes' | 'maybe' | 'no'>('yes');

  if (!event) return null;

  const start = new Date(event.startTime);
  const end = new Date(event.endTime);

  const handleCopyMeet = () => {
    if (event.meetLink) {
      navigator.clipboard.writeText(event.meetLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden font-sans space-y-0">
        {/* Top Header Action Strip */}
        <div
          className="px-6 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80"
          style={{ borderTop: `6px solid ${event.accountColor || '#4285F4'}` }}
        >
          <div className="flex items-center space-x-2">
            <span
              className="px-3 py-1 rounded-full text-xs font-semibold"
              style={{
                backgroundColor: `${event.accountColor || '#4285F4'}20`,
                color: event.accountColor || '#1a73e8',
              }}
            >
              {event.accountName || 'Calendar'}
            </span>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => {
                if (confirm(`Delete "${event.title}"?`)) {
                  onDelete(event.id);
                  onClose();
                }
              }}
              title="Delete event"
              className="p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-400 hover:text-red-600 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content body */}
        <div className="p-6 space-y-5">
          {/* Conflict Alert Banner */}
          {event.hasConflict && (
            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/50 flex items-center space-x-3 text-amber-900 dark:text-amber-200">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 animate-pulse" />
              <div className="text-xs">
                <span className="font-bold">Double-Booking Conflict Detected!</span>
                <p className="opacity-90">This event overlaps with another scheduled block on your calendar.</p>
              </div>
            </div>
          )}

          {/* Title */}
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">{event.title}</h2>
            <div className="flex items-center space-x-2 mt-2 text-xs font-mono text-slate-600 dark:text-slate-300">
              <Clock className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                {start.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
                {' • '}
                {start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} –{' '}
                {end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </span>
            </div>
          </div>

          {/* Join with Google Meet */}
          {event.meetLink && (
            <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex items-center justify-between gap-3">
              <div className="flex items-center space-x-3 truncate">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-sm shadow-blue-500/30">
                  <Video className="w-5 h-5" />
                </div>
                <div className="truncate">
                  <h4 className="text-xs font-bold text-blue-900 dark:text-blue-200">Join with Google Meet</h4>
                  <span className="text-[11px] text-blue-600 dark:text-blue-400 font-mono truncate block">
                    {event.meetLink}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-1 shrink-0">
                <button
                  onClick={handleCopyMeet}
                  title="Copy link"
                  className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-colors"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
                <a
                  href={event.meetLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-all"
                >
                  Join
                </a>
              </div>
            </div>
          )}

          {/* Location */}
          {event.location && (
            <div className="flex items-start space-x-3 text-xs text-slate-700 dark:text-slate-300">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <span>{event.location}</span>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {event.description}
            </div>
          )}

          {/* RSVP Status Selection */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Going?</span>
            <div className="flex items-center space-x-2">
              {(['yes', 'maybe', 'no'] as const).map((choice) => (
                <button
                  key={choice}
                  onClick={() => setRsvpState(choice)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-all ${
                    rsvpState === choice
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  {choice}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
