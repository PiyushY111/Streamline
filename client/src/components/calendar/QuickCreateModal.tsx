'use client';

import React, { useState } from 'react';
import {
  X,
  Clock,
  MapPin,
  Users,
  Video,
  Calendar as CalendarIcon,
  AlignLeft,
  GripHorizontal,
  Check,
} from 'lucide-react';
import { AccountData, EventData } from '@/lib/api';

interface QuickCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (evt: Partial<EventData>) => void;
  accounts: AccountData[];
  initialDate?: Date;
  initialHour?: number;
  initialType?: 'event' | 'task' | 'reminder';
}

const COLOR_SWATCHES = [
  { name: 'Blueberry', color: '#4285F4' },
  { name: 'Peacock', color: '#039BE5' },
  { name: 'Sage', color: '#33B679' },
  { name: 'Basil', color: '#0b8043' },
  { name: 'Banana', color: '#F6BF26' },
  { name: 'Tangerine', color: '#F4511E' },
  { name: 'Flamingo', color: '#E67C73' },
  { name: 'Grape', color: '#AB47BC' },
  { name: 'Graphite', color: '#616161' },
];

export const QuickCreateModal: React.FC<QuickCreateModalProps> = ({
  isOpen,
  onClose,
  onSave,
  accounts,
  initialDate = new Date(),
  initialHour = 10,
  initialType = 'event',
}) => {
  if (!isOpen) return null;

  const [type, setType] = useState<'event' | 'task' | 'reminder'>(initialType);
  const [title, setTitle] = useState('');
  const [selectedDateStr, setSelectedDateStr] = useState(initialDate.toISOString().split('T')[0]);

  const formatHourStr = (h: number) => (h < 10 ? `0${h}:00` : `${h}:00`);
  const [startTimeStr, setStartTimeStr] = useState(formatHourStr(initialHour));
  const [endTimeStr, setEndTimeStr] = useState(formatHourStr(Math.min(23, initialHour + 1)));

  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || 'acc-1');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guests, setGuests] = useState<string[]>([]);
  const [addMeetLink, setAddMeetLink] = useState(true);
  const [colorSwatch, setColorSwatch] = useState('#4285F4');

  const handleAddGuest = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && guestEmail.trim()) {
      e.preventDefault();
      if (!guests.includes(guestEmail.trim())) {
        setGuests([...guests, guestEmail.trim()]);
      }
      setGuestEmail('');
    }
  };

  const handleRemoveGuest = (email: string) => {
    setGuests(guests.filter((g) => g !== email));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const startIso = new Date(`${selectedDateStr}T${startTimeStr}:00`).toISOString();
    const endIso = new Date(`${selectedDateStr}T${endTimeStr}:00`).toISOString();

    const acc = accounts.find((a) => a.id === selectedAccountId);

    onSave({
      title: title.trim() || 'New Event',
      type,
      startTime: startIso,
      endTime: endIso,
      accountId: selectedAccountId,
      accountName: acc?.label || 'Calendar',
      accountColor: acc?.color || colorSwatch,
      colorSwatch,
      location,
      description,
      guests,
      meetLink: addMeetLink ? `https://meet.google.com/stream-${Date.now().toString().slice(-6)}` : undefined,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150 select-none font-sans">
      {/* Floating Card Popover matching Google Calendar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-[24px] w-full max-w-[480px] shadow-2xl overflow-hidden">
        {/* Drag Bar Header Strip */}
        <div className="h-10 bg-[#f1f3f4] dark:bg-slate-950 px-4 flex items-center justify-between cursor-move border-b border-slate-200/60 dark:border-slate-800">
          <div className="flex items-center space-x-1 text-slate-400">
            <GripHorizontal className="w-4 h-4" />
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Borderless Title Input */}
          <div>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add title"
              className="w-full text-2xl font-normal text-[#3c4043] dark:text-white bg-transparent border-0 border-b-2 border-[#1a73e8] focus:outline-none pb-1 placeholder-[#5f6368] dark:placeholder-slate-400"
            />
          </div>

          {/* Category Tabs: Event | Task | Reminder */}
          <div className="flex items-center space-x-2 pt-1 pb-1">
            {(['event', 'task', 'reminder'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`px-4 py-1.5 rounded-full capitalize text-xs font-semibold transition-all ${
                  type === t
                    ? 'bg-[#e8f0fe] dark:bg-blue-950/60 text-[#1a73e8] dark:text-blue-300'
                    : 'text-[#5f6368] dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Row 1: Clock Icon & Clean Time Selector */}
          <div className="flex items-center space-x-3 text-xs pt-1">
            <Clock className="w-4 h-4 text-slate-500 shrink-0" />
            <div className="flex items-center space-x-2 flex-1 flex-wrap gap-y-1">
              <input
                type="date"
                value={selectedDateStr}
                onChange={(e) => setSelectedDateStr(e.target.value)}
                className="bg-[#f1f3f4] dark:bg-slate-800 border-0 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
              />
              <input
                type="time"
                value={startTimeStr}
                onChange={(e) => setStartTimeStr(e.target.value)}
                className="bg-[#f1f3f4] dark:bg-slate-800 border-0 rounded-lg px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
              />
              <span className="text-slate-400">–</span>
              <input
                type="time"
                value={endTimeStr}
                onChange={(e) => setEndTimeStr(e.target.value)}
                className="bg-[#f1f3f4] dark:bg-slate-800 border-0 rounded-lg px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
              />
            </div>
          </div>

          {/* Row 2: Add Google Meet Video Conferencing Button */}
          <div className="flex items-center space-x-3 pt-1">
            <div className="w-4 shrink-0" />
            {addMeetLink ? (
              <div className="flex items-center justify-between flex-1 px-4 py-2 rounded-full bg-[#1a73e8] text-white text-xs font-semibold shadow-2xs">
                <div className="flex items-center space-x-2">
                  <Video className="w-4 h-4" />
                  <span>Add Google Meet video conferencing</span>
                </div>
                <button type="button" onClick={() => setAddMeetLink(false)} className="hover:text-blue-200 ml-2">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddMeetLink(true)}
                className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center space-x-2 transition-colors"
              >
                <Video className="w-4 h-4 text-blue-600" />
                <span>Add Google Meet video conferencing</span>
              </button>
            )}
          </div>

          {/* Row 3: Add Guests Input */}
          <div className="flex items-center space-x-3 text-xs pt-1">
            <Users className="w-4 h-4 text-slate-500 shrink-0" />
            <div className="flex-1">
              <input
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                onKeyDown={handleAddGuest}
                placeholder="Add guests"
                className="w-full bg-[#f1f3f4] dark:bg-slate-800 border-0 rounded-full px-3.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-[#5f6368]"
              />
              {guests.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {guests.map((g) => (
                    <span
                      key={g}
                      className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-[11px] font-medium text-slate-800 dark:text-slate-200"
                    >
                      <span>{g}</span>
                      <button type="button" onClick={() => handleRemoveGuest(g)} className="hover:text-red-500">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Row 4: Add Location */}
          <div className="flex items-center space-x-3 text-xs pt-1">
            <MapPin className="w-4 h-4 text-slate-500 shrink-0" />
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Add location"
              className="w-full bg-[#f1f3f4] dark:bg-slate-800 border-0 rounded-full px-3.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-[#5f6368]"
            />
          </div>

          {/* Row 5: Add Description */}
          <div className="flex items-start space-x-3 text-xs pt-1">
            <AlignLeft className="w-4 h-4 text-slate-500 shrink-0 mt-2" />
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add description or attachments"
              className="w-full bg-[#f1f3f4] dark:bg-slate-800 border-0 rounded-2xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-[#5f6368] resize-none"
            />
          </div>

          {/* Row 6: Calendar Dropdown & Swatch Palette */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center space-x-2">
              <CalendarIcon className="w-4 h-4 text-slate-500 shrink-0" />
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="bg-[#f1f3f4] dark:bg-slate-800 border-0 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-none font-medium"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Google Color Swatches */}
            <div className="flex items-center space-x-1.5">
              {COLOR_SWATCHES.slice(0, 5).map((swatch) => (
                <button
                  key={swatch.name}
                  type="button"
                  onClick={() => setColorSwatch(swatch.color)}
                  style={{ backgroundColor: swatch.color }}
                  className={`w-4 h-4 rounded-full transition-transform flex items-center justify-center ${
                    colorSwatch === swatch.color ? 'scale-125 ring-2 ring-blue-500 ring-offset-1' : 'hover:scale-110'
                  }`}
                  title={swatch.name}
                >
                  {colorSwatch === swatch.color && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                </button>
              ))}
            </div>
          </div>

          {/* Footer Save & More Options */}
          <div className="flex items-center justify-between pt-3">
            <button
              type="button"
              onClick={() => alert('Full options page opened')}
              className="text-xs font-semibold text-[#1a73e8] hover:underline"
            >
              More options
            </button>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-1.5 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white text-xs font-semibold shadow-xs transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
