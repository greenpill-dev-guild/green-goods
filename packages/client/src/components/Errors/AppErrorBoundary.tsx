import { Component, createRef, type ErrorInfo, type ReactNode } from "react";
import { ErrorRecovery, type RecoveryView } from "./ErrorRecovery";

interface Props {
  children: ReactNode;
  /** Where the failure is shown. A boundary outside the router takes `frame`. */
  view: RecoveryView;
  /** Names the boundary in reports. */
  name?: string;
  /**
   * What is on screen under the boundary, for one that stays mounted while that changes: the
   * garden's page keeps its boundary across its child pages. A failure is cleared when this
   * differs from what it was caught under, so leaving the page that failed draws the next one.
   */
  resetKey?: string;
}

/** Until the render that follows a catch has recorded what was on screen. */
const UNRECORDED = Symbol("unrecorded");

interface State {
  failed: boolean;
  error: unknown;
  caughtUnder: string | undefined | typeof UNRECORDED;
}

const WORKING: State = { failed: false, error: null, caughtUnder: UNRECORDED };

/**
 * Catches what its children throw while rendering. React Router catches route failures before a
 * boundary like this sees them, so routes carry `RouteErrorBoundary`; both hand the failure to
 * `ErrorRecovery`, which owns everything that happens next.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = WORKING;

  // Written in the commit, before the fallback's effects run, so the report can carry it.
  private componentStack = createRef<string>();

  static getDerivedStateFromError(error: unknown): State {
    return { failed: true, error, caughtUnder: UNRECORDED };
  }

  /**
   * The key is compared with the one the failure was caught under, not with the previous
   * render's: a page that fails as it arrives changes the key in the same update, and comparing
   * renders would clear that failure at once, draw the page again and report it twice.
   */
  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (!state.failed) return null;
    if (state.caughtUnder === UNRECORDED) return { caughtUnder: props.resetKey };
    return props.resetKey === state.caughtUnder ? null : WORKING;
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
