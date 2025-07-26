import React, { Component, type ReactNode } from "react";
import { track } from "@/modules/posthog";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class SyncErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Track sync errors
    track("sync_error_boundary_triggered", {
      error_message: error.message,
      error_stack: error.stack,
      component_stack: errorInfo.componentStack,
    });

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    console.error("SyncErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="inline-flex items-center gap-2 px-3 py-1 text-xs bg-yellow-100 border border-yellow-300 text-yellow-800 rounded">
            <span>⚠️ Sync temporarily unavailable</span>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, error: undefined })}
              className="text-xs underline hover:no-underline text-yellow-700"
            >
              Retry
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
