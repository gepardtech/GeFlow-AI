import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw, Home, ArrowLeft } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error captured by ErrorBoundary:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleHardReload = () => {
    try {
      sessionStorage.clear();
    } catch (e) {
      console.warn("Storage clear notice:", e);
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-card border border-border/80 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6 text-center">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
              <AlertCircle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Something went wrong</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                An unexpected interface issue was caught safely without crashing your data. You can restore the session below.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-3 bg-muted/60 border border-border/50 rounded-xl text-left text-xs font-mono text-muted-foreground overflow-x-auto max-h-32">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition shadow-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>

              <button
                type="button"
                onClick={this.handleHardReload}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-secondary text-secondary-foreground font-semibold text-sm hover:bg-secondary/80 transition"
              >
                Reload App
              </button>
            </div>

            <div className="pt-2 border-t border-border/40 flex items-center justify-center gap-4 text-xs text-muted-foreground">
              <a href="/" className="inline-flex items-center gap-1 hover:text-foreground transition">
                <Home className="w-3.5 h-3.5" /> Home
              </a>
              <span>•</span>
              <a href="/dashboard" className="inline-flex items-center gap-1 hover:text-foreground transition">
                <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
