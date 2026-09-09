'use client';

import React, { useEffect, useState } from 'react';
import {
  CheckSquare,
  Plus,
  Clock,
  CheckCircle2,
  Circle,
  RefreshCw,
  Trash2,
  Layers,
  Lock,
  Sparkles,
  Sliders,
} from 'lucide-react';
import {
  fetchTasks,
  createTaskApi,
  updateTaskApi,
  deleteTaskApi,
  fetchProjects,
  TaskData,
  ProjectData,
} from '@/lib/api';
import { NextTaskCard } from '@/components/tasks/NextTaskCard';
import { ProjectsManager } from '@/components/tasks/ProjectsManager';
import { AiTaskRadar } from '@/components/tasks/AiTaskRadar';
import { PendingActionsBanner } from '@/components/agent/PendingActionsBanner';

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'todo' | 'in_progress' | 'completed'>('all');
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined);
  const [refreshKey, setRefreshKey] = useState(0);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [newImportance, setNewImportance] = useState<number>(0.5);
  const [newEstimatedMinutes, setNewEstimatedMinutes] = useState<number | undefined>(30);
  const [newProjectId, setNewProjectId] = useState<string | undefined>(undefined);
  const [selectedDependencies, setSelectedDependencies] = useState<string[]>([]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [taskList, projectList] = await Promise.all([
        fetchTasks(),
        fetchProjects(),
      ]);
      setTasks(taskList);
      setProjects(projectList);
    } catch (err) {
      console.warn('Failed to load tasks data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshKey]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      const created = await createTaskApi({
        title: newTitle.trim(),
        description: newDesc.trim() || undefined,
        priority: newPriority,
        importance: newImportance,
        estimatedMinutes: newEstimatedMinutes || undefined,
        projectId: newProjectId || selectedProjectId || null,
        dependencies: selectedDependencies,
      });
      setTasks((prev) => [created, ...prev]);
      setNewTitle('');
      setNewDesc('');
      setNewPriority('medium');
      setNewImportance(0.5);
      setNewEstimatedMinutes(30);
      setSelectedDependencies([]);
      setShowModal(false);
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      alert(`Failed to create task: ${err.message}`);
    }
  };

  const toggleTaskStatus = async (task: TaskData) => {
    const nextStatus = task.status === 'completed' ? 'todo' : 'completed';
    try {
      const updated = await updateTaskApi(task.id, {
        status: nextStatus,
        completedAt: nextStatus === 'completed' ? new Date().toISOString() : null,
      });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      alert(`Failed to update task: ${err.message}`);
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      await deleteTaskApi(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      alert(`Failed to delete task: ${err.message}`);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (selectedProjectId && t.projectId !== selectedProjectId) return false;
    if (filter === 'all') return true;
    return t.status === filter;
  });

  const projectMap = new Map(projects.map((p) => [p.id, p]));

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl clean-card">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Tasks & Actionables
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Deterministic DAG planning, calendar slot matching, and multi-project orchestration.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all hover:scale-[1.01] active:scale-95 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Task</span>
        </button>
      </div>

      {/* Pending Actions Banner (Human-in-the-Loop Safeguard) */}
      <PendingActionsBanner
        key={`pending-${refreshKey}`}
        onActionResolved={() => setRefreshKey((k) => k + 1)}
      />

      {/* Deterministic Next Best Action Planner Card */}
      <NextTaskCard
        key={refreshKey}
        selectedProjectId={selectedProjectId}
        onTaskUpdated={() => setRefreshKey((k) => k + 1)}
      />

      {/* Projects Management Filter */}
      <ProjectsManager
        selectedProjectId={selectedProjectId}
        onSelectProject={setSelectedProjectId}
        onProjectsChanged={() => setRefreshKey((k) => k + 1)}
      />

      {/* AI Task Radar */}
      <AiTaskRadar />

      {/* Filter Tabs Bar */}
      <div className="flex items-center justify-between p-1.5 rounded-2xl clean-card">
        <div className="flex items-center space-x-1">
          {(['all', 'todo', 'in_progress', 'completed'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium capitalize transition-all ${
                filter === tab
                  ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {tab.replace('_', ' ')}
            </button>
          ))}
        </div>

        <button
          onClick={loadData}
          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Task Creation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Create New Task</h3>
            <form onSubmit={handleCreateTask} className="space-y-3.5">
              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Write release notes, Run database migration..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Description</label>
                <textarea
                  rows={2}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Optional details, acceptance criteria..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e: any) => setNewPriority(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Project</label>
                  <select
                    value={newProjectId || ''}
                    onChange={(e) => setNewProjectId(e.target.value || undefined)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">(No Project)</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex justify-between">
                    <span>Importance</span>
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                      {Math.round(newImportance * 100)}%
                    </span>
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={newImportance}
                    onChange={(e) => setNewImportance(parseFloat(e.target.value))}
                    className="w-full accent-indigo-600 mt-2"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Estimated Time (Minutes)
                  </label>
                  <input
                    type="number"
                    min="5"
                    step="5"
                    value={newEstimatedMinutes || ''}
                    onChange={(e) => setNewEstimatedMinutes(e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="30"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 mt-1"
                  />
                </div>
              </div>

              {/* Dependency selector (DAG) */}
              {tasks.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 block">
                    Prerequisites (Must be completed first)
                  </label>
                  <div className="max-h-28 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl p-2 bg-slate-50 dark:bg-slate-950 space-y-1">
                    {tasks
                      .filter((t) => t.status !== 'completed')
                      .map((t) => {
                        const checked = selectedDependencies.includes(t.id);
                        return (
                          <label
                            key={t.id}
                            className="flex items-center space-x-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer p-1 rounded hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedDependencies((prev) => [...prev, t.id]);
                                } else {
                                  setSelectedDependencies((prev) => prev.filter((id) => id !== t.id));
                                }
                              }}
                              className="accent-indigo-600 rounded"
                            />
                            <span className="truncate">{t.title}</span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}

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
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tasks List */}
      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="p-12 text-center clean-card rounded-3xl space-y-2">
            <CheckSquare className="w-10 h-10 text-slate-400 mx-auto" />
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">No Tasks Match Filter</h3>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
              Click &quot;New Task&quot; or change your project/status filter.
            </p>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const project = task.projectId ? projectMap.get(task.projectId) : null;
            const hasDependencies = task.dependencies && task.dependencies.length > 0;

            return (
              <div
                key={task.id}
                className={`p-4 rounded-2xl clean-card clean-card-hover flex items-start justify-between gap-4 ${
                  task.status === 'completed' ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start space-x-3.5 flex-1 min-w-0">
                  <button
                    onClick={() => toggleTaskStatus(task)}
                    className="mt-0.5 hover:scale-110 transition-transform shrink-0"
                  >
                    {task.status === 'completed' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    ) : task.status === 'in_progress' ? (
                      <Clock className="w-5 h-5 text-amber-500" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" />
                    )}
                  </button>

                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <h3
                        className={`text-sm font-semibold text-slate-900 dark:text-white tracking-tight ${
                          task.status === 'completed' ? 'line-through text-slate-400' : ''
                        }`}
                      >
                        {task.title}
                      </h3>

                      {/* Priority Tag */}
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider ${
                          task.priority === 'high'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30'
                            : task.priority === 'medium'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {task.priority}
                      </span>

                      {/* Project Tag */}
                      {project && (
                        <span
                          className="px-2 py-0.5 rounded-md text-[10px] font-medium flex items-center space-x-1"
                          style={{
                            backgroundColor: `${project.color}15`,
                            color: project.color,
                            border: `1px solid ${project.color}30`,
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: project.color }}
                          />
                          <span>{project.name}</span>
                        </span>
                      )}

                      {/* Estimated duration badge */}
                      {task.estimatedMinutes && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                          {task.estimatedMinutes}m
                        </span>
                      )}

                      {/* Dependency badge */}
                      {hasDependencies && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center space-x-1">
                          <Lock className="w-2.5 h-2.5" />
                          <span>{task.dependencies?.length} prerequisite{task.dependencies && task.dependencies.length > 1 ? 's' : ''}</span>
                        </span>
                      )}
                    </div>

                    {task.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {task.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
