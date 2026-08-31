import type { PublicSurfaceState as PublicSurfaceStateValue } from "@green-goods/shared/public";
import type { ReactNode } from "react";
import { FormattedMessage } from "react-intl";

export interface PublicSurfaceStateProps {
  state: PublicSurfaceStateValue;
  loading: ReactNode;
  error: ReactNode;
  empty: ReactNode;
  children: ReactNode;
  container?: "div" | "dd";
}

/** A semantic, shared state switch for public read-side collections. */
export function PublicSurfaceState({
  state,
  loading,
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
        {error}
      </Container>
    );
  }
  return (
    <Container role="status" aria-live="polite" data-public-surface-state={state}>
      {empty}
    </Container>
  );
}
