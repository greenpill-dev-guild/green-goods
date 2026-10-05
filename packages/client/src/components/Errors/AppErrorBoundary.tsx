import { Component, createRef, type ErrorInfo, type ReactNode } from "react";
import { ErrorRecovery, type RecoveryView } from "./ErrorRecovery";

interface Props {
  children: ReactNode;
  /** Where the failure is shown. A boundary outside the router takes `frame`. */
  view: RecoveryView;
  /** Names the boundary in reports. */
  name?: string;
}

interface State {
  failed: boolean;
  error: unknown;
}

/**
 * Catches what its children throw while rendering. React Router catches route failures before a
 * boundary like this sees them, so routes carry `RouteErrorBoundary`; both hand the failure to
 * `ErrorRecovery`, which owns everything that happens next.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, error: null };

  // Written in the commit, before the fallback's effects run, so the report can carry it.
  private componentStack = createRef<string>();

  static getDerivedStateFromError(error: unknown): State {
    return { failed: true, error };
  }

  componentDidCatch(_error: unknown, info: ErrorInfo) {
    this.componentStack.current = info.componentStack ?? null;
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <ErrorRecovery
        error={this.state.error}
        view={this.props.view}
        boundary={this.props.name ?? "AppErrorBoundary"}
        componentStack={this.componentStack}
      />
    );
  }
}
