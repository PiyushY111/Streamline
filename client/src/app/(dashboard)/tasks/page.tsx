'use client';

import React, { useEffect, useState } from 'react';
import { CheckSquare, Plus, CheckCircle2, Circle, Trash2 } from 'lucide-react';
import { fetchTasks, createTaskApi, updateTaskApi, deleteTaskApi, TaskData } from '@/lib/api';

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchTasks().then(setTasks).finally(() => setLoading(false));
  }, []);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const created = await createTaskApi({ title: newTitle, priority: 'medium' });
    setTasks(prev => [created, ...prev]);
    setNewTitle('');
    setShowModal(false);
  };

  const toggleTaskStatus = async (task: TaskData) => {
    const nextStatus = task.status === 'completed' ? 'todo' : 'completed';
    const updated = await updateTaskApi(task.id, { status: nextStatus });
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...updated } : t));
  };

  const handleDelete = async (id: string) => {
    await deleteTaskApi(id);
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-blue-600" /> My Tasks
          </h1>
          <p className="text-xs text-gray-500">Track and manage your daily action items</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add Task
        </button>
      </div>

      <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm divide-y divide-gray-100 dark:divide-gray-800">
        {loading ? (
          <p className="p-4 text-xs text-gray-500">Loading tasks...</p>
        ) : tasks.length === 0 ? (
          <p className="p-4 text-xs text-gray-500">No tasks created yet.</p>
        ) : (
          tasks.map(task => (
            <div key={task.id} className="flex items-center justify-between py-3 px-2">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => toggleTaskStatus(task)}>
                {task.status === 'completed' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <Circle className="w-5 h-5 text-gray-400" />
                )}
                <span className={`text-sm ${task.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}>
                  {task.title}
                </span>
              </div>
              <button onClick={() => handleDelete(task.id)} className="p-1 text-gray-400 hover:text-red-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleCreateTask} className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 w-full max-w-md space-y-4">
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Create New Task</h3>
            <input
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Task title..."
              className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-sm focus:outline-none focus:border-blue-500 text-gray-900 dark:text-gray-100"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg">Save Task</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
