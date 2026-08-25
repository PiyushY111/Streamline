'use client';

import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Lightbulb,
  User,
  MapPin,
  Plus,
  ChevronRight,
  ChevronLeft,
  X,
  Trash2,
  Check,
} from 'lucide-react';
import { fetchTasks, createTaskApi, updateTaskApi, deleteTaskApi, TaskData } from '@/lib/api';

export const GoogleCalendarRightToolbar: React.FC = () => {
  const [activePanel, setActivePanel] = useState<'keep' | 'tasks' | 'contacts' | 'maps' | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Keep Notes state
  const [notes, setNotes] = useState<Array<{ id: string; title: string; content: string }>>([
    { id: '1', title: 'Meeting Prep', content: 'Review roadmap slides before 10 AM sync.' },
  ]);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');

  // Tasks state
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  useEffect(() => {
    if (activePanel === 'tasks') {
      fetchTasks()
        .then((t) => setTasks(t))
        .catch(() => {});
    }
  }, [activePanel]);

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (newNoteTitle.trim() || newNoteContent.trim()) {
      setNotes([
        { id: Date.now().toString(), title: newNoteTitle.trim() || 'Untitled Note', content: newNoteContent.trim() },
        ...notes,
      ]);
      setNewNoteTitle('');
      setNewNoteContent('');
    }
  };

  const handleDeleteNote = (id: string) => {
    setNotes(notes.filter((n) => n.id !== id));
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newTaskTitle.trim()) {
      try {
        const created = await createTaskApi({ title: newTaskTitle.trim(), status: 'todo' });
        setTasks([created, ...tasks]);
      } catch (err) {
        setTasks([
          { id: `t-${Date.now()}`, title: newTaskTitle.trim(), status: 'todo', priority: 'medium' },
          ...tasks,
        ]);
      }
      setNewTaskTitle('');
    }
  };

  const handleToggleTask = async (task: TaskData) => {
    const nextStatus = task.status === 'completed' ? 'todo' : 'completed';
    setTasks(tasks.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)));
    try {
      await updateTaskApi(task.id, { status: nextStatus });
    } catch (e) {}
  };

  if (isCollapsed) {
    return (
      <div className="border-l border-slate-200 dark:border-slate-800 bg-[#f8f9fa] dark:bg-slate-950 p-2 flex items-center justify-center">
        <button
          onClick={() => setIsCollapsed(false)}
          title="Expand side panel"
          className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex shrink-0">
      {/* Active Panel Drawer */}
      {activePanel && (
        <aside className="w-72 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col p-4 z-20 shadow-xl animate-in slide-in-from-right duration-200 select-none">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white capitalize flex items-center space-x-2">
              {activePanel === 'keep' && <Lightbulb className="w-4 h-4 text-amber-500" />}
              {activePanel === 'tasks' && <CheckCircle2 className="w-4 h-4 text-blue-500" />}
              {activePanel === 'contacts' && <User className="w-4 h-4 text-blue-500" />}
              {activePanel === 'maps' && <MapPin className="w-4 h-4 text-red-500" />}
              <span>{activePanel === 'keep' ? 'Google Keep Notes' : activePanel === 'tasks' ? 'Google Tasks' : activePanel}</span>
            </h3>
            <button onClick={() => setActivePanel(null)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* KEEP NOTES PANEL */}
          {activePanel === 'keep' && (
            <div className="flex-1 flex flex-col space-y-3 overflow-hidden">
              <form onSubmit={handleAddNote} className="space-y-2 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <input
                  type="text"
                  placeholder="Take a note..."
                  value={newNoteTitle}
                  onChange={(e) => setNewNoteTitle(e.target.value)}
                  className="w-full text-xs font-bold bg-transparent border-0 focus:outline-none text-slate-900 dark:text-white placeholder-slate-400"
                />
                <textarea
                  placeholder="Note content..."
                  rows={2}
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  className="w-full text-xs bg-transparent border-0 focus:outline-none text-slate-700 dark:text-slate-300 resize-none placeholder-slate-400"
                />
                <div className="flex justify-end">
                  <button type="submit" className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-semibold">
                    Done
                  </button>
                </div>
              </form>

              <div className="flex-1 overflow-y-auto space-y-2">
                {notes.map((n) => (
                  <div key={n.id} className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 relative group">
                    <button onClick={() => handleDeleteNote(n.id)} className="opacity-0 group-hover:opacity-100 absolute right-2 top-2 text-slate-400 hover:text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">{n.title}</h4>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">{n.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TASKS PANEL */}
          {activePanel === 'tasks' && (
            <div className="flex-1 flex flex-col space-y-3 overflow-hidden">
              <form onSubmit={handleAddTask} className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="+ Add a task"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="flex-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </form>

              <div className="flex-1 overflow-y-auto space-y-1.5">
                {tasks.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => handleToggleTask(t)}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center space-x-2.5 cursor-pointer hover:border-blue-400 transition-colors"
                  >
                    <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-white shrink-0 ${t.status === 'completed' ? 'bg-blue-600 border-blue-600' : 'border-slate-400'}`}>
                      {t.status === 'completed' && <Check className="w-3 h-3 stroke-[3]" />}
                    </span>
                    <span className={`text-xs font-medium truncate ${t.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'}`}>
                      {t.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CONTACTS / MAPS PANEL */}
          {(activePanel === 'contacts' || activePanel === 'maps') && (
            <div className="flex-1 text-xs text-slate-500 space-y-2">
              <p>Quick lookup for {activePanel}:</p>
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                Connected with Google Workspace integration.
              </div>
            </div>
          )}
        </aside>
      )}

      {/* Main Narrow Toolbar Strip */}
      <aside className="w-14 bg-[#f8f9fa] dark:bg-slate-950 border-l border-slate-200/80 dark:border-slate-800 flex flex-col items-center py-4 justify-between shrink-0 select-none">
        <div className="flex flex-col items-center space-y-5">
          {/* Keep */}
          <button
            onClick={() => setActivePanel(activePanel === 'keep' ? null : 'keep')}
            title="Google Keep"
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors group ${activePanel === 'keep' ? 'bg-amber-100 dark:bg-amber-950/50' : 'hover:bg-slate-200/70 dark:hover:bg-slate-800'}`}
          >
            <div className="w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center text-white shadow-2xs group-hover:scale-105 transition-transform">
              <Lightbulb className="w-4 h-4 text-white fill-white" />
            </div>
          </button>

          {/* Tasks */}
          <button
            onClick={() => setActivePanel(activePanel === 'tasks' ? null : 'tasks')}
            title="Google Tasks"
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors group ${activePanel === 'tasks' ? 'bg-blue-100 dark:bg-blue-950/50' : 'hover:bg-slate-200/70 dark:hover:bg-slate-800'}`}
          >
            <div className="w-6 h-6 rounded-full bg-[#1a73e8] flex items-center justify-center text-white shadow-2xs group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-4 h-4 text-white" />
            </div>
          </button>

          {/* Contacts */}
          <button
            onClick={() => setActivePanel(activePanel === 'contacts' ? null : 'contacts')}
            title="Contacts"
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors group ${activePanel === 'contacts' ? 'bg-blue-100 dark:bg-blue-950/50' : 'hover:bg-slate-200/70 dark:hover:bg-slate-800'}`}
          >
            <div className="w-6 h-6 rounded-full bg-[#1a73e8] flex items-center justify-center text-white shadow-2xs group-hover:scale-105 transition-transform">
              <User className="w-4 h-4 text-white" />
            </div>
          </button>

          {/* Maps */}
          <button
            onClick={() => setActivePanel(activePanel === 'maps' ? null : 'maps')}
            title="Maps"
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors group ${activePanel === 'maps' ? 'bg-red-100 dark:bg-red-950/50' : 'hover:bg-slate-200/70 dark:hover:bg-slate-800'}`}
          >
            <div className="w-6 h-6 rounded-full bg-[#ea4335] flex items-center justify-center text-white shadow-2xs group-hover:scale-105 transition-transform">
              <MapPin className="w-4 h-4 text-white" />
            </div>
          </button>

          <div className="w-6 h-px bg-slate-300 dark:bg-slate-800 my-1" />
        </div>

        {/* Side panel toggle chevron */}
        <button
          onClick={() => setIsCollapsed(true)}
          title="Collapse side panel"
          className="w-8 h-8 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </aside>
    </div>
  );
};
