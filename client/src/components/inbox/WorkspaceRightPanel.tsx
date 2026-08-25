'use client';

import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  CheckSquare as TaskIcon,
  FileText as NoteIcon,
  ChevronRight,
  ChevronLeft,
  Plus,
  CheckCircle2,
  Circle,
  Clock,
} from 'lucide-react';
import { fetchEvents, fetchTasks, createTaskApi, updateTaskApi, EventData, TaskData } from '@/lib/api';

interface WorkspaceRightPanelProps {
  currentEmailSubject?: string;
  currentEmailId?: string;
}

export function WorkspaceRightPanel({ currentEmailSubject, currentEmailId }: WorkspaceRightPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'calendar' | 'tasks' | 'notes'>('calendar');

  const [events, setEvents] = useState<EventData[]>([]);
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [notesText, setNotesText] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchEvents().then(setEvents).catch(() => {});
      fetchTasks().then(setTasks).catch(() => {});
    }
    const savedNotes = localStorage.getItem('gmail_quick_notes');
    if (savedNotes) setNotesText(savedNotes);
  }, [isOpen]);

  const handleSaveNotes = (val: string) => {
    setNotesText(val);
    localStorage.setItem('gmail_quick_notes', val);
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    try {
      const created = await createTaskApi({ title: newTaskTitle.trim(), status: 'todo', priority: 'medium' });
      setTasks((prev) => [created, ...prev]);
      setNewTaskTitle('');
    } catch (e) {
      console.warn('Failed to create task:', e);
    }
  };

  const handleAddEmailAsTask = async () => {
    if (!currentEmailSubject) return;
    try {
      const created = await createTaskApi({
        title: `Follow up: ${currentEmailSubject}`,
        sourceEmailId: currentEmailId,
        status: 'todo',
        priority: 'high',
      });
      setTasks((prev) => [created, ...prev]);
      setActiveTab('tasks');
    } catch (e) {
      console.warn('Failed to convert email to task:', e);
    }
  };

  const handleToggleTaskStatus = async (task: TaskData) => {
    const nextStatus = task.status === 'completed' ? 'todo' : 'completed';
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)));
    try {
      await updateTaskApi(task.id, { status: nextStatus });
    } catch (e) {
      console.warn('Failed to update task status:', e);
    }
  };

  return (
    <div className="flex shrink-0 z-20">
      {/* Right Icon Strip */}
      <div className="w-14 bg-[#f6f8fc] dark:bg-[#0D1322] border-l border-slate-200/80 dark:border-slate-800 flex flex-col items-center py-4 space-y-4 shrink-0 select-none">
        <button
          onClick={() => {
            setActiveTab('calendar');
            setIsOpen(true);
          }}
          className={`p-2.5 rounded-2xl transition-all ${
            isOpen && activeTab === 'calendar'
              ? 'bg-[#c2e7ff] text-[#001d35] shadow-xs dark:bg-purple-600 dark:text-white'
              : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800/80'
          }`}
          title="Google Calendar"
        >
          <CalendarIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </button>

        <button
          onClick={() => {
            setActiveTab('tasks');
            setIsOpen(true);
          }}
          className={`p-2.5 rounded-2xl transition-all ${
            isOpen && activeTab === 'tasks'
              ? 'bg-[#c2e7ff] text-[#001d35] shadow-xs dark:bg-purple-600 dark:text-white'
              : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800/80'
          }`}
          title="Google Tasks"
        >
          <TaskIcon className="w-5 h-5 text-[#0b57d0] dark:text-purple-400" />
        </button>

        <button
          onClick={() => {
            setActiveTab('notes');
            setIsOpen(true);
          }}
          className={`p-2.5 rounded-2xl transition-all ${
            isOpen && activeTab === 'notes'
              ? 'bg-[#c2e7ff] text-[#001d35] shadow-xs dark:bg-purple-600 dark:text-white'
              : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800/80'
          }`}
          title="Keep Notes"
        >
          <NoteIcon className="w-5 h-5 text-amber-500" />
        </button>

        <div className="flex-1" />

        {/* Toggle Expand / Collapse arrow */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          title={isOpen ? 'Collapse panel' : 'Expand panel'}
        >
          {isOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded Panel Drawer */}
      {isOpen && (
        <div className="w-80 bg-white dark:bg-[#0D1322] border-l border-slate-200/80 dark:border-slate-800 flex flex-col shrink-0 animate-in slide-in-from-right duration-200 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3.5 bg-[#f6f8fc] dark:bg-[#0F172A] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-xs font-bold capitalize text-slate-900 dark:text-white flex items-center space-x-2">
              {activeTab === 'calendar' && <CalendarIcon className="w-4 h-4 text-blue-600" />}
              {activeTab === 'tasks' && <TaskIcon className="w-4 h-4 text-[#0b57d0]" />}
              {activeTab === 'notes' && <NoteIcon className="w-4 h-4 text-amber-500" />}
              <span>{activeTab === 'calendar' ? 'Calendar Agenda' : activeTab === 'tasks' ? 'Tasks & To-Dos' : 'Quick Notes'}</span>
            </h3>

            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {/* 1. CALENDAR TAB */}
            {activeTab === 'calendar' && (
              <div className="space-y-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Upcoming Agenda ({events.length})
                </span>
                {events.length === 0 ? (
                  <p className="text-slate-400 text-center py-8">No upcoming events scheduled.</p>
                ) : (
                  events.map((evt) => (
                    <div
                      key={evt.id}
                      className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 space-y-1"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: evt.accountColor }} />
                        <h4 className="font-bold text-slate-900 dark:text-white truncate">{evt.title}</h4>
                      </div>
                      <div className="flex items-center space-x-1 text-[10px] text-slate-400 font-mono">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>
                          {new Date(evt.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                          {new Date(evt.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 2. TASKS TAB */}
            {activeTab === 'tasks' && (
              <div className="space-y-4">
                {currentEmailSubject && (
                  <button
                    onClick={handleAddEmailAsTask}
                    className="w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 font-semibold text-xs hover:bg-purple-100 transition-colors"
                  >
                    <Plus className="w-4 h-4 text-purple-600" />
                    <span>Add Email as Task</span>
                  </button>
                )}

                {/* Add Task Form */}
                <form onSubmit={handleAddTask} className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Add a new task..."
                    className="flex-1 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-[#0b57d0]"
                  />
                  <button type="submit" className="p-1.5 rounded-xl bg-[#0b57d0] text-white">
                    <Plus className="w-4 h-4" />
                  </button>
                </form>

                {/* Task List */}
                <div className="space-y-2">
                  {tasks.length === 0 ? (
                    <p className="text-slate-400 text-center py-6">No tasks added yet.</p>
                  ) : (
                    tasks.map((task) => {
                      const isDone = task.status === 'completed';
                      return (
                        <div
                          key={task.id}
                          onClick={() => handleToggleTaskStatus(task)}
                          className="flex items-start space-x-2.5 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer border border-transparent hover:border-slate-200 transition-all"
                        >
                          {isDone ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          ) : (
                            <Circle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                          )}
                          <span className={`text-xs ${isDone ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200 font-medium'}`}>
                            {task.title}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* 3. QUICK NOTES TAB */}
            {activeTab === 'notes' && (
              <div className="h-full flex flex-col space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Auto-saved Scratchpad
                </span>
                <textarea
                  rows={14}
                  value={notesText}
                  onChange={(e) => handleSaveNotes(e.target.value)}
                  placeholder="Jot down quick thoughts, phone numbers, or email reminders..."
                  className="w-full flex-1 p-3 rounded-2xl bg-amber-50/40 dark:bg-slate-900 border border-amber-200/80 dark:border-slate-800 text-slate-900 dark:text-white text-xs leading-relaxed focus:outline-none resize-none font-mono"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
