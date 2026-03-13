'use client';

import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import i18n from '@/lib/i18n';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

// Class component cannot use hooks — read translations directly from i18n instance
function getT(key: string): string {
  return i18n.t(key);
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    if (process.env.NODE_ENV === 'production') {
      console.error('ErrorBoundary caught:', error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleGoHome = () => {
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const isNetworkError = this.state.error?.message?.toLowerCase().includes('network') ||
                             this.state.error?.message?.toLowerCase().includes('fetch');

      return (
        <div className="flex items-center justify-center min-h-[400px] p-8" style={{ background: 'var(--surface)' }}>
          <div className="text-center max-w-md">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              {isNetworkError ? getT('errorBoundary.networkError') : getT('errorBoundary.pageError')}
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              {isNetworkError
                ? getT('errorBoundary.networkHint')
                : getT('errorBoundary.pageHint')}
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="text-left mb-4 p-3 rounded-lg text-xs font-mono overflow-auto max-h-32" style={{ background: 'var(--surface-hover)', color: 'var(--text-tertiary)' }}>
                <summary className="cursor-pointer flex items-center gap-1 hover:text-red-500">
                  <Bug className="w-3 h-3" /> {getT('errorBoundary.details')}
                </summary>
                <pre className="mt-2 whitespace-pre-wrap">{this.state.error.message}</pre>
              </details>
            )}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={this.handleRetry}
                className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 text-sm transition-colors"
              >
                <RefreshCw className="w-4 h-4" /> {getT('errorBoundary.retry')}
              </button>
              <button
                onClick={this.handleGoHome}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors"
                style={{ background: 'var(--surface-hover)', color: 'var(--text-secondary)' }}
              >
                <Home className="w-4 h-4" /> {getT('errorBoundary.goHome')}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
