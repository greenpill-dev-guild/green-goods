import type { PublicSurfaceState as PublicSurfaceStateValue } from "@green-goods/shared/public";
import type { ReactNode } from "react";
import { FormattedMessage } from "react-intl";
import { PublicReadUnavailable } from "./PublicReadUnavailable";

export interface PublicSurfaceStateProps {
  state: PublicSurfaceStateValue;
  loading: ReactNode;
  /** Asks the read again from the standard unavailable state. */
  onRetry?: () => void;
  /** The surface's own sentence in the standard unavailable state. */
  errorMessage?: ReactNode;
  /** Replaces the standard unavailable state, for a surface whose failure is drawn elsewhere. */
  error?: ReactNode;
  empty: ReactNode;
  children: ReactNode;
  container?: "div" | "dd";
}

/** A semantic, shared state switch for public read-side collections. */
export function PublicSurfaceState({
  state,
  loading,
  onRetry,
  errorMessage,
  error,
  empty,
  children,
  container: Container = "div",
}: PublicSurfaceStateProps) {
  if (state === "ready") return <>{children}</>;
  if (state === "loading") {
    return (
      <Container aria-busy="true" data-public-surface-state={state}>
        <span className="sr-only">
          <FormattedMessage id="app.common.loading" defaultMessage="Loading..." />
        </span>
        {loading}
      </Container>
    );
  }
  if (state === "error") {
    return (
      <Container role="alert" data-public-surface-state={state}>
        {error === undefined ? (
          <PublicReadUnavailable className="mt-12" message={errorMessage} onRetry={onRetry} />
        ) : (
          error
        )}
      </Container>
    );
  }
  return (
    <Container role="status" aria-live="polite" data-public-surface-state={state}>
      {empty}
    </Container>
  );
}
