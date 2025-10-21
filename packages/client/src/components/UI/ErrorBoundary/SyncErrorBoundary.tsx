import React, { Component, type ReactNode } from "react";
import toast from "react-hot-toast";
import { track } from "@green-goods/shared/modules";

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

    // Only show toast for unexpected errors, not network/fetch errors
    if (!error.message?.includes("fetch") && !error.message?.includes("network")) {
      toast.error("Sync temporarily unavailable", {
        duration: 4000,
        id: "sync-error", // Prevent duplicate toasts
      });
    }

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    console.error("SyncErrorBoundary caught an error:", error, errorInfo);

    // Reset error state to prevent modal from closing
    this.setState({ hasError: false });
  }

  render() {
    // Always render children - errors are handled gracefully within components
    return this.props.children;
  }
}
