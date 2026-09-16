'use client';

import React, { useState, useEffect } from 'react';
import { FolderKanban, Plus, CheckCircle2, Clock, Layers, Sparkles, Trash2, Edit2, ExternalLink } from 'lucide-react';
import { fetchProjects, createProjectApi, deleteProjectApi, ProjectData } from '@/lib/api';

interface ProjectsManagerProps {
  selectedProjectId?: string;
  onSelectProject: (projectId: string | undefined) => void;
  onProjectsChanged?: () => void;
}

export function ProjectsManager({ selectedProjectId, onSelectProject, onProjectsChanged }: ProjectsManagerProps) {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [stack, setStack] = useState('');
  const [milestone, setMilestone] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const data = await fetchProjects();
      setProjects(data);
    } catch (err) {
      console.error('Failed to load projects', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await createProjectApi({
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        stack: stack.trim() || undefined,
        currentMilestone: milestone.trim() || undefined,
      });
      setName('');
      setDescription('');
      setStack('');
      setMilestone('');
      setShowModal(false);
      await load();
      onProjectsChanged?.();
    } catch (err) {
      alert('Failed to create project');
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this project?')) return;
    try {
      await deleteProjectApi(id);
      if (selectedProjectId === id) {
        onSelectProject(undefined);
      }
      await load();
      onProjectsChanged?.();
    } catch (err) {
      alert('Failed to delete project');
    }
  };

  const colors = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <FolderKanban className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Projects & Workstreams
          </h3>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 text-xs font-medium transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Project</span>
        </button>
      </div>

      {/* Horizontal pill list */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs scrollbar-thin">
        <button
          onClick={() => onSelectProject(undefined)}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium shrink-0 transition-all ${
            !selectedProjectId
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          All Projects
        </button>

        {projects.map((p) => {
          const isSelected = selectedProjectId === p.id;
          return (
            <div
              key={p.id}
              onClick={() => onSelectProject(isSelected ? undefined : p.id)}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl shrink-0 cursor-pointer border transition-all ${
                isSelected
                  ? 'bg-white dark:bg-slate-900 border-indigo-500 shadow-xs ring-2 ring-indigo-500/20'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color || '#6366f1' }} />
              <span className="font-medium text-slate-800 dark:text-slate-200">{p.name}</span>

              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold">
                {p.completedTasks}/{p.totalTasks}
              </span>

              {p.completionPercentage > 0 && (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  {p.completionPercentage}%
                </span>
              )}

              <button
                onClick={(e) => handleDelete(e, p.id)}
                className="text-slate-400 hover:text-rose-500 p-0.5"
                title="Delete project"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Creation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Create New Project</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Mobile Redesign, Q4 Marketing..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Project goal and scope..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Tech / Stack</label>
                  <input
                    type="text"
                    value={stack}
                    onChange={(e) => setStack(e.target.value)}
                    placeholder="Next.js, Postgres..."
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Milestone</label>
                  <input
                    type="text"
                    value={milestone}
                    onChange={(e) => setMilestone(e.target.value)}
                    placeholder="v1.0 Beta launch"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">
                  Accent Color
                </label>
                <div className="flex items-center space-x-2">
                  {colors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-6 h-6 rounded-full transition-transform ${
                        color === c ? 'scale-125 ring-2 ring-indigo-500 ring-offset-2' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs"
                >
                  Save Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
