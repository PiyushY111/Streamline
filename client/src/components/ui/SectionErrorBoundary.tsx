'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  sectionName: string;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class SectionErrorBoundary extends Component<Props, State> {
  public override state: State = { hasError: false, error: null };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[SectionErrorBoundary] Error in section "${this.props.sectionName}":`, error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          role="alert"
          aria-live="assertive"
          className="flex flex-col items-center justify-center p-8 rounded-2xl bg-card/60 dark:bg-slate-900/60 backdrop-blur-md border border-destructive/30 text-center space-y-4 m-4 shadow-lg"
        >
          <div className="w-12 h-12 rounded-full bg-destructive/10 dark:bg-destructive/20 flex items-center justify-center text-destructive">
            <AlertTriangle className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Unable to display {this.props.sectionName}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mt-1">
              {this.state.error?.message || 'An unexpected rendering error occurred while loading this view.'}
            </p>
          </div>
          <button
            type="button"
            onClick={this.handleReset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-slate-900 cursor-pointer shadow-sm"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" /> Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
