'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  durationMs?: number;
}

interface ToastContextType {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id'>) => string;
  removeToast: (id: string) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

let globalAddToast: ((toast: Omit<ToastItem, 'id'>) => void) | null = null;

export const toast = {
  success: (message: string, title?: string) => globalAddToast?.({ type: 'success', message, title }),
  error: (message: string, title?: string) => globalAddToast?.({ type: 'error', message, title }),
  warning: (message: string, title?: string) => globalAddToast?.({ type: 'warning', message, title }),
  info: (message: string, title?: string) => globalAddToast?.({ type: 'info', message, title }),
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (toastInput: Omit<ToastItem, 'id'>) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newToast: ToastItem = { ...toastInput, id };
      const duration = toastInput.durationMs ?? 4000;

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }

      return id;
    },
    [removeToast],
  );

  globalAddToast = addToast;

  const success = useCallback(
    (message: string, title?: string) => addToast({ type: 'success', message, title }),
    [addToast],
  );
  const error = useCallback(
    (message: string, title?: string) => addToast({ type: 'error', message, title }),
    [addToast],
  );
  const warning = useCallback(
    (message: string, title?: string) => addToast({ type: 'warning', message, title }),
    [addToast],
  );
  const info = useCallback((message: string, title?: string) => addToast({ type: 'info', message, title }), [addToast]);

  const getToastStyles = (type: ToastType) => {
    switch (type) {
      case 'success':
        return {
          icon: CheckCircle2,
          iconColor: 'text-emerald-500 dark:text-emerald-400',
          border: 'border-emerald-500/30',
          bg: 'bg-emerald-500/10 dark:bg-emerald-950/40',
        };
      case 'error':
        return {
          icon: AlertCircle,
          iconColor: 'text-rose-500 dark:text-rose-400',
          border: 'border-rose-500/30',
          bg: 'bg-rose-500/10 dark:bg-rose-950/40',
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          iconColor: 'text-amber-500 dark:text-amber-400',
          border: 'border-amber-500/30',
          bg: 'bg-amber-500/10 dark:bg-amber-950/40',
        };
      default:
        return {
          icon: Info,
          iconColor: 'text-blue-500 dark:text-blue-400',
          border: 'border-blue-500/30',
          bg: 'bg-blue-500/10 dark:bg-blue-950/40',
        };
    }
  };

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, warning, info }}>
      {children}
      {/* Toast Render Viewport */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none p-2"
      >
        {toasts.map((t) => {
          const styles = getToastStyles(t.type);
          const Icon = styles.icon;

          return (
            <div
              key={t.id}
              role="alert"
              data-testid="toast-success"
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border ${styles.border} ${styles.bg} bg-white/80 dark:bg-slate-900/90 backdrop-blur-md shadow-lg shadow-black/5 dark:shadow-black/30 text-slate-800 dark:text-slate-100 transition-all duration-200 animate-in slide-in-from-bottom-2 fade-in`}
            >
              <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${styles.iconColor}`} aria-hidden="true" />
              <div className="flex-1 min-w-0">
                {t.title && <h4 className="text-xs font-semibold">{t.title}</h4>}
                <p className="text-xs text-slate-600 dark:text-slate-300 break-words">{t.message}</p>
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                aria-label="Close notification"
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
